#!/usr/bin/env node
import {cp, mkdir, lstat, readFile, mkdtemp, rename, rm, open, realpath} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
const root=await realpath(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'));
const args=process.argv.slice(2);const get=k=>{const i=args.indexOf(k);return i<0?null:args[i+1]};
const agent=get('--agent'), project=get('--project');
const dirs={codex:'.agents/skills',claude:'.claude/skills',antigravity:'.agents/skills',opencode:'.opencode/skills'};
function fail(error,hint,extra={}){console.log(JSON.stringify({ok:false,error,hint,...extra}));process.exitCode=1}
async function present(p){try{await lstat(p);return true}catch(e){if(e.code==='ENOENT')return false;throw e}}
if(!dirs[agent]||!project){fail('usage','--agent codex|claude|antigravity|opencode --project <existing-directory> [--apply] [--upgrade] [--with-deps]');}
else {
 let stageRoot=null, externalStage=null, backupRoot=null, target=null, movedOld=false, lock=null, lockPath=null;
 try {
  const info=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
  if(typeof info.name!=='string'||!/^tw-[a-z0-9-]+-skill$/.test(info.name))throw Error('invalid skill package name');
  const projectRoot=await realpath(path.resolve(project)), skillsDir=path.join(projectRoot,dirs[agent]);target=path.join(skillsDir,info.name);
  if(target===root)throw Error('source and target are identical');
  const diag=spawnSync(process.execPath,[path.join(root,'scripts/portable-core/agent-doctor.mjs'),'--agent',agent],{encoding:'utf8',cwd:projectRoot,timeout:20000});
  if(diag.status!==0)throw Error('diagnosis failed');
  const diagnosis=JSON.parse(diag.stdout), exists=await present(target), upgrade=args.includes('--upgrade');
  if(exists&&!upgrade){fail('target-exists',`已有 ${target}；明確使用 --upgrade 才會先備份並升級。`);}
  else if(!args.includes('--apply'))console.log(JSON.stringify({ok:true,mode:'preview',target,existing:exists,upgrade,diagnosis,installDependencies:args.includes('--with-deps')?'npm ci --ignore-scripts in staging':'not requested',hint:'Add --apply to install. Existing targets additionally require --upgrade.'}));
  else if(!diagnosis.node.meetsMinimum||!diagnosis.workspaceWritable)fail('preflight-failed','請先處理 Node 版本與目標目錄寫入權限。');
  else {
   await mkdir(skillsDir,{recursive:true});
   lockPath=path.join(skillsDir,`.edtech-${info.name}.lock`);
   try{lock=await open(lockPath,'wx')}catch(e){if(e.code==='EEXIST'){fail('install-locked','此技能已有另一個安裝程序或遺留鎖定；先確認程序狀態。');throw Error('install-locked')}throw e}
   if((await present(target))!==exists){fail('target-changed','安裝預覽後目標已變更，請重新檢查。');throw Error('target-changed')}
   stageRoot=await mkdtemp(path.join(skillsDir,'.edtech-staging-'));const staged=path.join(stageRoot,info.name);
   const relativeSkills=path.relative(root,skillsDir);const skillsInsideSource=relativeSkills && !relativeSkills.startsWith('..') && !path.isAbsolute(relativeSkills);
   if(skillsInsideSource)externalStage=await mkdtemp(path.join(tmpdir(),'edtech-source-'));
   const firstDestination=externalStage?path.join(externalStage,info.name):staged;
   await cp(root,firstDestination,{recursive:true,errorOnExist:true,force:false,filter:p=>{
    const absolute=path.resolve(p),rel=path.relative(root,absolute);
    if(rel.split(path.sep).some(x=>['.git','node_modules','.edtech-skill-backups'].includes(x)))return false;
    if(absolute===stageRoot||absolute.startsWith(stageRoot+path.sep))return false;
    if(skillsInsideSource&&(absolute===skillsDir||absolute.startsWith(skillsDir+path.sep)))return false;
    return true;
   }});
   if(externalStage)await cp(firstDestination,staged,{recursive:true,errorOnExist:true,force:false});
   let dependencyStatus='not-requested';
   if(args.includes('--with-deps')) {
    const npm=spawnSync(process.platform==='win32'?'npm.cmd':'npm',['ci','--ignore-scripts','--no-audit','--no-fund'],{cwd:staged,encoding:'utf8',timeout:90000});
    if(npm.status!==0){fail('dependency-install-failed','依賴安裝失敗；原有安裝未變動。', {target,dependencyStatus:'failed'});throw Error('dependency-install-failed');}
    dependencyStatus='installed';
   }
   if(exists){const backupParent=path.join(projectRoot,'.edtech-skill-backups');await mkdir(backupParent,{recursive:true});backupRoot=await mkdtemp(path.join(backupParent,`${info.name}-`));await rename(target,path.join(backupRoot,info.name));movedOld=true;}
   await rename(staged,target);movedOld=false;
   console.log(JSON.stringify({ok:true,mode:exists?'upgraded':'installed',target,backup:backupRoot?path.join(backupRoot,info.name):null,diagnosis,dependencyStatus,next:'Reload the agent and test skill discovery.'}));
  }
 } catch(e){
  if(movedOld&&backupRoot&&target){try{await rename(path.join(backupRoot,path.basename(target)),target);movedOld=false}catch(rollback){fail('rollback-failed','升級失敗且無法自動復原；請依 backup 路徑手動還原。',{target,backup:path.join(backupRoot,path.basename(target))});}}
  if(!process.exitCode)fail('install-failed',String(e.message));
 } finally {if(stageRoot)await rm(stageRoot,{recursive:true,force:true});if(externalStage)await rm(externalStage,{recursive:true,force:true});if(lock){await lock.close();await rm(lockPath,{force:true});}}
}
