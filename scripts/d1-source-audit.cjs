// Read-only source catalog export. Credentials and output live outside the checkout.
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');
async function main() {
 const connectionString = fs.readFileSync(path.resolve('../source-connection.txt'),'utf8').trim();
 const client = new Client({connectionString, connectionTimeoutMillis:20000});
 await client.connect();
 await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
 const metadata = {};
 for (const [name,query] of Object.entries({
 identity: "SELECT current_database(), current_user, version(), pg_database_size(current_database()) AS bytes, now() AS captured_at",
 tables: "SELECT table_schema, table_name FROM information_schema.tables WHERE table_type='BASE TABLE' AND table_schema IN ('public','stripe','_system') ORDER BY table_schema,table_name",
 columns: "SELECT table_schema,table_name,column_name,ordinal_position,data_type,udt_name,is_nullable,column_default FROM information_schema.columns WHERE table_schema IN ('public','stripe','_system') ORDER BY table_schema,table_name,ordinal_position",
 constraints: "SELECT n.nspname AS schema,t.relname AS table,c.conname AS name,c.contype AS type, pg_get_constraintdef(c.oid) AS definition FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname IN ('public','stripe','_system')",
 indexes: "SELECT schemaname,tablename,indexname,indexdef FROM pg_indexes WHERE schemaname IN ('public','stripe','_system')",
 views: "SELECT schemaname,viewname,definition FROM pg_views WHERE schemaname IN ('public','stripe','_system')",
 functions: "SELECT n.nspname AS schema,p.proname AS name,pg_get_functiondef(p.oid) AS definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','stripe','_system') AND p.prokind='f' AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid=p.oid AND d.deptype='e')",
 triggers: "SELECT event_object_schema,event_object_table,trigger_name,action_statement FROM information_schema.triggers WHERE event_object_schema IN ('public','stripe','_system')"
 })) metadata[name]=(await client.query(query)).rows;
 await client.query('COMMIT'); await client.end();
 fs.mkdirSync('../source-backup',{recursive:true});
 fs.writeFileSync('../source-backup/catalog.json',JSON.stringify(metadata,null,2));
 console.log(JSON.stringify({identity:metadata.identity,tables:metadata.tables.length,columns:metadata.columns.length,constraints:metadata.constraints.length,indexes:metadata.indexes.length,views:metadata.views.length,triggers:metadata.triggers.length}));
}
main().catch(error=>{console.error(error.message);process.exitCode=1});
