// Consistent, read-only PostgreSQL snapshot. Run with Node 22+.
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { createGzip } = require('node:zlib');
const { once } = require('node:events');
const { finished } = require('node:stream/promises');
const { Client, types } = require('pg');
const QueryStream = require('pg-query-stream');
types.setTypeParser(1114, value => value);
types.setTypeParser(1184, value => value);
const quote = value => '"'+value.replaceAll('"','""')+'"';
async function main() {
 const backup = path.resolve(process.env.D1_EXPORT_DIR || '../source-backup');
 fs.mkdirSync(backup,{recursive:true});
 const catalog = JSON.parse(fs.readFileSync(path.join(backup,'catalog.json'),'utf8'));
 const connectionString=fs.readFileSync(path.resolve('../source-connection.txt'),'utf8').trim().replace('sslmode=require','sslmode=verify-full');
 const client = new Client({connectionString,connectionTimeoutMillis:20000});
 await client.connect();
 await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
 await client.query("SET LOCAL statement_timeout='0'");
 await client.query("SET LOCAL TIME ZONE 'UTC'");
 const snapshot=(await client.query('SELECT pg_current_snapshot()::text AS snapshot, now() AS captured_at')).rows[0];
 const manifest={...snapshot,tables:[],complete:false};
 fs.writeFileSync(path.join(backup,'manifest.json'),JSON.stringify(manifest,null,2));
 for (const table of catalog.tables) {
  const {table_schema:schema,table_name:name}=table;
  const cols=catalog.columns.filter(c=>c.table_schema===schema&&c.table_name===name);
  const sql=`SELECT ${cols.map(c=>quote(c.column_name)).join(',')} FROM ${quote(schema)}.${quote(name)}`;
  const stream=client.query(new QueryStream(sql,[],{batchSize:1000,rowMode:'array'}));
  const file=path.join(backup,`${schema}.${name}.ndjson.gz`);
  const gzip=createGzip({level:1}); const output=fs.createWriteStream(file,{flags:'wx'}); gzip.pipe(output);
  const hash=createHash('sha256'); let count=0,bytes=0,maxRowBytes=0;
  for await (const row of stream) {
   const line=JSON.stringify(row)+'\n'; const size=Buffer.byteLength(line);
   hash.update(line);bytes+=size; maxRowBytes=Math.max(maxRowBytes,size);count++;
   if(!gzip.write(line))await once(gzip,'drain');
  }
  gzip.end();await finished(output);
  manifest.tables.push({schema,name,count,bytes,maxRowBytes,sha256:hash.digest('hex'),file:path.basename(file)});
  fs.writeFileSync(path.join(backup,'manifest.json'),JSON.stringify(manifest,null,2));
  console.log(`${schema}.${name}: ${count} rows, ${(bytes/1048576).toFixed(1)} MiB, max row ${maxRowBytes} bytes`);
 }
 await client.query('COMMIT');await client.end();
 manifest.complete=true;manifest.completedAt=new Date().toISOString();
 fs.writeFileSync(path.join(backup,'manifest.json'),JSON.stringify(manifest,null,2));
 console.log('Consistent snapshot export complete.');
}
main().catch(error=>{console.error(error.message);process.exit(1)});
