"""Compare a fresh, consistent Neon export with the verified migration snapshot.

Produces parameter-free SQL for the brief final cutover. No network writes.
"""
import gzip, hashlib, json, os, pathlib, re, sqlite3
baseline=pathlib.Path('../source-backup'); fresh=pathlib.Path(os.environ.get('D1_DELTA_SOURCE','../source-final'))
catalog=json.loads((baseline/'catalog.json').read_text())
manifest=json.loads((fresh/'manifest.json').read_text());assert manifest['complete']
original={(t['schema'],t['name']):t for t in json.loads((baseline/'manifest.json').read_text())['tables']}
db=sqlite3.connect(f'file:{(baseline/"realtors-dashboard.sqlite").resolve().as_posix()}?mode=ro',uri=True)
q=lambda s:'"'+s.replace('"','""')+'"'
target=lambda schema,name:name if schema=='public' else schema+'__'+name
def normalize(v,c,source=False):
 if v is None:return None
 typ=c['data_type']
 if typ in ('jsonb','ARRAY'):
  value=v if source else json.loads(v)
  return json.dumps(value,sort_keys=True,ensure_ascii=False,separators=(',',':'))
 if typ in ('integer','bigint','boolean'):return int(v)
 if typ in ('real','double precision'):return float(v)
 if typ.startswith('timestamp'):
  value=re.sub(r'(?:\+00(?::00)?|Z)$','',v).replace(' ','T');whole,_,fraction=value.partition('.')
  return whole+'.'+fraction.ljust(6,'0')+'Z'
 return v
def digest(row):return hashlib.sha256(json.dumps(row,ensure_ascii=False,separators=(',',':')).encode()).digest()
def literal(v):
 if v is None:return 'NULL'
 if isinstance(v,str):return "CAST(X'"+v.encode().hex()+"' AS TEXT)" if '\0' in v else "'"+v.replace("'","''")+"'"
 return str(v)
updates={};deletes={};report=[]
for table in manifest['tables']:
 name=target(table['schema'],table['name']);cols=[c for c in catalog['columns'] if (c['table_schema'],c['table_name'])==(table['schema'],table['name'])]
 previous=original[(table['schema'],table['name'])]
 if name!='sessions' and table['count']==previous['count'] and table['sha256']==previous['sha256']:
  h=hashlib.sha256()
  with gzip.open(fresh/table['file'],'rb') as source:
   for chunk in iter(lambda:source.read(1024*1024),b''):h.update(chunk)
  assert h.hexdigest()==table['sha256'],f'{name}: fresh export checksum mismatch'
  updates[name]=[];deletes[name]=[]
  report.append({'table':name,'sourceRows':table['count'],'inserted':0,'updated':0,'deleted':0})
  print(f'{name}: unchanged source checksum',flush=True)
  continue
 info=db.execute('PRAGMA table_info('+q(name)+')').fetchall();pk=[r[1] for r in sorted(info,key=lambda r:r[5]) if r[5]]
 assert pk,f'{name} has no stable primary key'
 positions=[next(i for i,c in enumerate(cols) if c['column_name']==key) for key in pk]
 old={tuple(row[i] for i in positions):digest([normalize(v,c) for v,c in zip(row,cols)]) for row in db.execute('SELECT '+','.join(q(c['column_name']) for c in cols)+' FROM '+q(name))}
 inserted=updated=seen=0;statements=[];h=hashlib.sha256()
 with gzip.open(fresh/table['file'],'rt',encoding='utf8') as source:
  for line in source:
   h.update(line.encode());row=[normalize(v,c,True) for v,c in zip(json.loads(line),cols)];seen+=1
   key=tuple(row[i] for i in positions);before=old.pop(key,None)
   # The isolated preview may create sessions. Replace this small table from the
   # final source snapshot so no preview-only session can survive the cutover.
   if before==digest(row) and name!='sessions':continue
   if before is None:inserted+=1
   elif before!=digest(row):updated+=1
   update=', '.join(q(c['column_name'])+'=excluded.'+q(c['column_name']) for c in cols if c['column_name'] not in pk)
   statement='INSERT INTO '+q(name)+' ('+','.join(q(c['column_name']) for c in cols)+') VALUES('+','.join(literal(v) for v in row)+') ON CONFLICT('+','.join(q(k) for k in pk)+') DO UPDATE SET '+update+';\n'
   assert len(statement.encode())<100_000;statements.append(statement)
 assert seen==table['count'] and h.hexdigest()==table['sha256'],f'{name}: fresh export mismatch'
 updates[name]=statements
 deletes[name]=['DELETE FROM '+q(name)+' WHERE '+' AND '.join(q(k)+'='+literal(v) for k,v in zip(pk,key))+';\n' for key in old]
 report.append({'table':name,'sourceRows':seen,'inserted':inserted,'updated':updated,'deleted':len(old)})
 print(f'{name}: +{inserted} / ~{updated} / -{len(old)}',flush=True)
tables=list(updates);dependencies={t:{r[2] for r in db.execute('PRAGMA foreign_key_list('+q(t)+')') if r[2]!=t} for t in tables};order=[]
while dependencies:
 ready=sorted(t for t,refs in dependencies.items() if not refs-set(order));assert ready
 for t in ready:order.append(t);del dependencies[t]
with (fresh/'cutover-delta.sql').open('w',encoding='utf8') as out:
 out.write('PRAGMA defer_foreign_keys=ON;\n')
 out.write('DELETE FROM sessions;\n')
 for t in order:out.writelines(updates[t])
 for t in reversed(order):out.writelines(deletes[t])
(fresh/'delta-report.json').write_text(json.dumps({'snapshot':manifest['captured_at'],'tables':report},indent=2))
print('Cutover delta ready; review delta-report.json before applying.',flush=True)
