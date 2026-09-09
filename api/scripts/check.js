import {readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
async function check(directory){
 for(const file of await readdir(directory,{withFileTypes:true})){
  const full=path.join(directory,file.name);
  if(file.isDirectory())await check(full);
  else if(file.name.endsWith('.js')){
   const result=spawnSync(process.execPath,['--check',full],{stdio:'inherit'});
   if(result.status!==0)process.exit(result.status||1);
  }
 }
}
for(const directory of ['src','scripts','migrations','test'])await check(directory);
console.log('JavaScript syntax checks passed.');

