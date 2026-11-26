#!/usr/bin/env node
import {cp, mkdir, access, readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const args=process.argv.slice(2);const get=k=>{const i=args.indexOf(k);return i<0?null:args[i+1]};
const agent=get('--agent'), project=get('--project');
const dirs={codex:'.agents/skills',claude:'.claude/skills',antigravity:'.agents/skills',opencode:'.opencode/skills'};
function fail(error,hint){console.log(JSON.stringify({ok:false,error,hint}));process.exitCode=1}
if(!dirs[agent]||!project){fail('usage','--agent codex|claude|antigravity|opencode --project <existing-directory> [--apply]');}
else {
 try {
 const info=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));const target=path.join(path.resolve(project),dirs[agent],info.name);
 const diag=spawnSync(process.execPath,[path.join(root,'scripts/portable-core/agent-doctor.mjs'),'--agent',agent],{encoding:'utf8',cwd:path.resolve(project),timeout:20000});
 if(diag.status!==0)throw Error('diagnosis failed');
 const diagnosis=JSON.parse(diag.stdout);
 let exists=false;try{await access(target);exists=true}catch{}
 if(exists)fail('target-exists',`已有 ${target}；請先備份並檢查差異，安裝器不覆蓋。`);
 else if(!args.includes('--apply'))console.log(JSON.stringify({ok:true,mode:'preview',target,diagnosis,installDependencies:args.includes('--with-deps')?'npm ci --ignore-scripts after copy':'not requested',hint:'Add --apply to copy; add --with-deps to install dependencies without lifecycle scripts.'}));
 else if(!diagnosis.node.meetsMinimum||!diagnosis.workspaceWritable)fail('preflight-failed','請先處理 Node 版本與目標目錄寫入權限。');
 else {
  await mkdir(path.dirname(target),{recursive:true});
  await cp(root,target,{recursive:true,errorOnExist:true,force:false,filter:p=>!p.split(path.sep).some(x=>['.git','node_modules'].includes(x))});
  let dependencyStatus='not-requested';
  if(args.includes('--with-deps')) {
   const npm=spawnSync(process.platform==='win32'?'npm.cmd':'npm',['ci','--ignore-scripts','--no-audit','--no-fund'],{cwd:target,encoding:'utf8',timeout:90000});
   dependencyStatus=npm.status===0?'installed':'failed';
   if(dependencyStatus==='failed'){console.log(JSON.stringify({ok:false,error:'dependency-install-failed',target,dependencyStatus,hint:'Skill copied; inspect dependency installation locally before retrying. No npm output or credentials are logged.'}));process.exitCode=1;}
  }
  if(dependencyStatus!=='failed')console.log(JSON.stringify({ok:true,mode:'installed',target,diagnosis,dependencyStatus,next:'Reload the agent and test skill discovery.'}));
 }
 } catch(e){fail('install-failed',String(e.message));}
}
