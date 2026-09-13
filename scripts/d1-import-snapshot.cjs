// Import only into the isolated destination named below. No Neon writes.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {spawn}=require('node:child_process');
const root=path.resolve('../source-backup/d1-import');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
const wrangler=path.resolve('node_modules/wrangler/bin/wrangler.js');
const completedFile=path.join(root,'import-progress.json');
const progress=fs.existsSync(completedFile)?JSON.parse(fs.readFileSync(completedFile,'utf8')):{completed:[]};
function run(args,log){return new Promise((resolve,reject)=>{const fd=fs.openSync(log,'w');const child=spawn(process.execPath,[wrangler,...args],{stdio:['ignore',fd,fd],windowsHide:true});child.on('error',reject);child.on('exit',code=>{fs.closeSync(fd);resolve(code)});});}
async function main(){
 if(process.env.D1_ALLOW_ISOLATED_IMPORT!=='YES')throw new Error('Initial migration import is disabled by default. It must only run against a verified isolated, non-live destination.');
 for(const part of manifest.parts){
  if(progress.completed.some(p=>p.file===part.file))continue;
  const file=path.join(root,part.file);
  if(!part.contentSha256){
   const contents=fs.readFileSync(file);part.contentSha256=crypto.createHash('sha256').update(contents).digest('hex');
   fs.appendFileSync(file,`INSERT INTO migration_import_parts(part_name,content_sha256,row_count) VALUES('${part.file}','${part.contentSha256}',${part.rows});\n`);
   fs.writeFileSync(path.join(root,'manifest.json'),JSON.stringify(manifest,null,2));
  }
  const log=path.join(root,part.file+'.log');
  const started=Date.now();console.log(`Importing ${part.file}: ${part.rows} rows`);
  const code=await run(['d1','execute','DB','--remote','--config','wrangler.data.jsonc','--file',file,'--yes'],log);
  if(code!==0){console.error(`Import stopped on ${part.file}, exit ${code}. Inspect its private log and remote audit marker before retrying.`);process.exitCode=1;return;}
  progress.completed.push({file:part.file,rows:part.rows,seconds:Math.round((Date.now()-started)/1000),completedAt:new Date().toISOString()});
  fs.writeFileSync(completedFile,JSON.stringify(progress,null,2));
  console.log(`Completed ${progress.completed.length}/${manifest.parts.length}: ${part.file}`);
 }
 console.log('All snapshot import files completed. Remote row-count verification is still required.');
}
main().catch(error=>{console.error(error.message);process.exitCode=1});
