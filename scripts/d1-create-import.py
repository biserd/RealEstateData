"""Create bounded D1 import files from the verified local SQLite snapshot."""
import json, pathlib, sqlite3
root=pathlib.Path('../source-backup')
validation=json.loads((root/'sqlite-validation.json').read_text())
assert validation['foreignKeys']=='ok' and validation['integrity']=='ok'
db=sqlite3.connect(f'file:{(root/"realtors-dashboard.sqlite").resolve().as_posix()}?mode=ro',uri=True)
q=lambda s:'"'+s.replace('"','""')+'"'
tables=[t['table'] for t in validation['tables']]
dependencies={t:{row[2] for row in db.execute('PRAGMA foreign_key_list('+q(t)+')') if row[2]!=t} for t in tables}
order=[]
while dependencies:
 ready=sorted(t for t,refs in dependencies.items() if not refs-set(order))
 assert ready, f'Cross-table foreign-key cycle needs a combined transaction: {dependencies}'
 for t in ready:order.append(t);del dependencies[t]
out=root/'d1-import';out.mkdir(exist_ok=True)
parts=[]
def literal(v):
 if v is None:return 'NULL'
 if isinstance(v,str):return "CAST(X'"+v.encode().hex()+"' AS TEXT)" if '\0' in v else "'"+v.replace("'","''")+"'"
 if isinstance(v,bytes):return "X'"+v.hex()+"'"
 return str(v)
for table in order:
 file=None; size=0; count=0; part=0
 for row in db.execute('SELECT * FROM '+q(table)):
  line='INSERT INTO '+q(table)+' VALUES('+','.join(literal(v) for v in row)+');\n'
  encoded=line.encode('utf8');assert len(encoded)<100_000
  if file is None or size+len(encoded)>64*1024*1024:
   if file: file.close();parts.append({'table':table,'file':name,'rows':count,'bytes':size})
   name=f'{len(parts):03d}-{table}-{part}.sql';part+=1;file=(out/name).open('xb')
   header=b'PRAGMA defer_foreign_keys=ON;\n';file.write(header);size=len(header);count=0
  file.write(encoded);size+=len(encoded);count+=1
 if file:file.close();parts.append({'table':table,'file':name,'rows':count,'bytes':size})
 print(f'{table}: import prepared',flush=True)
(out/'manifest.json').write_text(json.dumps({'parts':parts,'sourceSnapshot':validation},indent=2))
print(f'{len(parts)} files, {sum(p["rows"] for p in parts)} rows, {sum(p["bytes"] for p in parts)} bytes',flush=True)
