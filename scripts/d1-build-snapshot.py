"""Build and verify a SQLite copy from a read-only PostgreSQL snapshot.

No network or production writes. Source data and generated import SQL stay outside Git.
"""
import gzip, hashlib, json, pathlib, re, sqlite3

backup = pathlib.Path('../source-backup')
catalog = json.loads((backup / 'catalog.json').read_text())
manifest = json.loads((backup / 'manifest.json').read_text())
assert manifest['complete'], 'Source export is incomplete'
q = lambda name: '"' + name.replace('"', '""') + '"'
target = lambda schema, name: name if schema == 'public' else schema + '__' + name
now = "(strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z')"
uuid = "(lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1,1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6))))"

def strip_casts(s):
    return re.sub(r'::(?:character varying|double precision|text|jsonb|integer|bigint|real|boolean)(?:\[\])?', '', s)

def constraint(s):
    s = strip_casts(s)
    # Catalog enum checks have a single ANY(ARRAY[...]) expression.
    s = re.sub(r'= ANY \(\(ARRAY\[([^]]+)\]\)\)', r'IN (\1)', s)
    s = re.sub(r'= ANY \(ARRAY\[([^]]+)\]\)', r'IN (\1)', s)
    s = re.sub(r'\(?zip_code\)? ~ \'\^\[0-9\]\{5\}\$\'', "zip_code GLOB '[0-9][0-9][0-9][0-9][0-9]'", s)
    s = re.sub(r'\(?checksum_sha256\)? ~ \'\^\[a-f0-9\]\{64\}\$\'', "length(checksum_sha256) = 64 AND checksum_sha256 NOT GLOB '*[^a-f0-9]*'", s)
    s = re.sub(r'REFERENCES (?:(\w+)\.)?(\w+)', lambda m: 'REFERENCES '+q(target(m[1] or 'public', m[2])), s)
    return s.replace(' NOT VALID', '')

def default(c):
    value=c['column_default']
    if value is None or value.startswith('nextval('): return ''
    if 'gen_random_uuid()' in value: return ' DEFAULT '+uuid
    if 'now()' in value or value == 'CURRENT_TIMESTAMP': return ' DEFAULT '+now
    if value == "'{}'::text[]": value="'[]'"
    return ' DEFAULT '+strip_casts(value)

tables=[]; indexes=[]; views=[]; triggers=[]; omitted_indexes=[]
for table in catalog['tables']:
    schema,name=table['table_schema'],table['table_name']; dest=target(schema,name)
    columns=[c for c in catalog['columns'] if (c['table_schema'],c['table_name'])==(schema,name)]
    assert len(columns)<=100, f'{dest} exceeds D1 column limit'
    definitions=[]
    for c in columns:
        typ=c['data_type']
        affinity='INTEGER' if typ in ('integer','bigint','boolean') else 'REAL' if typ in ('real','double precision') else 'TEXT'
        definitions.append(q(c['column_name'])+' '+affinity+(' NOT NULL' if c['is_nullable']=='NO' else '')+default(c))
    for c in catalog['constraints']:
        if (c['schema'],c['table'])==(schema,name) and c['type'] in ('p','u','f','c'):
            definitions.append('CONSTRAINT '+q(c['name'])+' '+constraint(c['definition']))
    tables.append('CREATE TABLE '+q(dest)+' (\n  '+',\n  '.join(definitions)+'\n);')
    for ix in catalog['indexes']:
        if (ix['schemaname'],ix['tablename'])!=(schema,name): continue
        if any(c['schema']==schema and c['table']==name and c['name']==ix['indexname'] and c['type'] in ('p','u') for c in catalog['constraints']): continue
        if ' USING gin ' in ix['indexdef']:
            omitted_indexes.append(ix); continue # Archived Stripe API-key JSON index; no application query uses it.
        tail=ix['indexdef'].split(' USING btree ',1)[1]
        indexes.append(('CREATE UNIQUE INDEX ' if 'CREATE UNIQUE' in ix['indexdef'] else 'CREATE INDEX ')+q(target(schema,ix['indexname']))+' ON '+q(dest)+' '+strip_casts(tail)+';')
for v in catalog['views']:
    views.append('CREATE VIEW '+q(target(v['schemaname'],v['viewname']))+' AS '+strip_casts(v['definition']))
for tr in catalog['triggers']:
    dest=target(tr['event_object_schema'],tr['event_object_table'])
    col='updated_at' if 'set_updated_at_metadata' in tr['action_statement'] else '_updated_at'
    triggers.append(f'CREATE TRIGGER {q(dest+"__"+tr["trigger_name"])} AFTER UPDATE ON {q(dest)} WHEN NEW.{q(col)} IS OLD.{q(col)} BEGIN UPDATE {q(dest)} SET {q(col)} = {now} WHERE rowid = NEW.rowid; END;')

schema_sql='\n\n'.join(tables+indexes+views+triggers)+'\n'
migrations=pathlib.Path('migrations/d1'); migrations.mkdir(parents=True,exist_ok=True)
(migrations/'0000_neon_schema.sql').write_text('-- PostgreSQL catalog port: tables, constraints, indexes, views and update triggers.\n'+schema_sql,encoding='utf8')
(backup/'schema-exceptions.json').write_text(json.dumps({'archivedStripeIndexWithoutSQLiteEquivalent':omitted_indexes},indent=2))
dbfile=backup/'realtors-dashboard.sqlite'
assert not dbfile.exists(), 'Destination already exists; choose a new snapshot directory'
db=sqlite3.connect(dbfile)
db.execute('PRAGMA journal_mode=WAL'); db.execute('PRAGMA synchronous=NORMAL')
db.executescript('\n'.join(tables))

def convert(value,c):
    if value is None: return None
    typ=c['data_type']
    if typ in ('jsonb','ARRAY'): return json.dumps(value,ensure_ascii=False,separators=(',',':'))
    if typ=='boolean': return int(value)
    if typ=='bigint': return int(value)
    if typ.startswith('timestamp'):
        # Export session is UTC. Keep all six source fractional digits.
        value=re.sub(r'(?:\+00(?::00)?|Z)$','',value).replace(' ','T')
        whole,dot,fraction=value.partition('.')
        return whole+'.'+fraction.ljust(6,'0')+'Z'
    return value

report=[]
for t in manifest['tables']:
    dest=target(t['schema'],t['name'])
    columns=[c for c in catalog['columns'] if (c['table_schema'],c['table_name'])==(t['schema'],t['name'])]
    insert='INSERT INTO '+q(dest)+' VALUES ('+','.join('?' for _ in columns)+')'
    h=hashlib.sha256(); count=0; max_bytes=0
    with gzip.open(backup/t['file'],'rt',encoding='utf8') as source:
        for line in source:
            h.update(line.encode()); values=[convert(v,c) for v,c in zip(json.loads(line),columns)]
            row_bytes=sum(len(v.encode()) if isinstance(v,str) else 8 for v in values if v is not None)
            max_bytes=max(max_bytes,row_bytes)
            assert row_bytes < 2_000_000, f'{dest} exceeds D1 row limit'
            db.execute(insert,values); count+=1
            if count % 10000 == 0: db.commit()
    db.commit()
    assert count==t['count'] and h.hexdigest()==t['sha256'], f'{dest}: source checksum mismatch'
    assert db.execute('SELECT count(*) FROM '+q(dest)).fetchone()[0]==count
    report.append({'table':dest,'rows':count,'maxRowBytes':max_bytes,'sourceSha256Verified':True})
    print(f'{dest}: {count} rows verified',flush=True)
db.executescript('\n'.join(indexes+views+triggers))
violations=db.execute('PRAGMA foreign_key_check').fetchall()
assert not violations, f'Foreign key violations: {violations[:10]}'
assert db.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
db.execute('PRAGMA wal_checkpoint(TRUNCATE)'); db.close()
(backup/'sqlite-validation.json').write_text(json.dumps({'tables':report,'bytes':dbfile.stat().st_size,'foreignKeys':'ok','integrity':'ok'},indent=2))
print(f'Validated SQLite snapshot: {dbfile.stat().st_size} bytes',flush=True)
