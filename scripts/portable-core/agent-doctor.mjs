#!/usr/bin/env node
import {existsSync,constants,accessSync,readFileSync,lstatSync} from 'node:fs';import {createHash} from 'node:crypto';import {spawnSync} from 'node:child_process';import {homedir,platform,release} from 'node:os';import path from 'node:path';import {fileURLToPath} from 'node:url';
const names=['codex','claude','antigravity','opencode'];
const docs={codex:'https://developers.openai.com/codex/skills/',claude:'https://code.claude.com/docs/en/skills',antigravity:'https://antigravity.google/docs/skills',opencode:'https://opencode.ai/docs/skills/'};
const version=n=>{const r=spawnSync(n,['--version'],{encoding:'utf8',timeout:3000});return r.status===0?r.stdout.trim().split('\n')[0].slice(0,120):null};
const opts=process.argv.slice(2);const value=k=>{const i=opts.indexOf(k);return i<0?null:opts[i+1]};const selected=value('--agent');
if(selected&&!names.includes(selected)&&selected!=='other'){console.log(JSON.stringify({ok:false,error:'unsupported-agent',choices:[...names,'other']}));process.exit(1)}
const binaries={codex:'codex',claude:'claude',antigravity:'agy',opencode:'opencode'};
const availableAgents=Object.fromEntries(names.map(n=>[n,version(binaries[n])]));
const antigravityDesktop=process.platform==='darwin'?existsSync('/Applications/Antigravity.app'):null;let agent=selected||process.env.EDTECH_AGENT||null;
if(!agent){const found=names.filter(n=>availableAgents[n]);if(found.length===1)agent=found[0]}
if(agent&&![...names,'other'].includes(agent))agent=null;
const cwd=process.cwd(),home=homedir(),root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const paths={codex:'.agents/skills',claude:'.claude/skills',antigravity:'.agents/skills',opencode:'.opencode/skills'};
let workspaceWritable;try{accessSync(cwd,constants.W_OK);workspaceWritable=true}catch{workspaceWritable=false}
let pkg;try{pkg=JSON.parse(readFileSync(path.join(root,'package.json'),'utf8'))}catch{pkg=null}
const dependencies=Object.keys(pkg?.dependencies??{}).map(name=>({name,installed:existsSync(path.join(root,'node_modules',...name.split('/'),'package.json'))}));
const npmVersion=version('npm');const nodeMajor=Number(process.versions.node.split('.')[0]);const skillPath=agent&&paths[agent]?path.join(cwd,paths[agent],pkg?.name??''):null;
// Scan only this package's known locations, never credentials or other skills.
const globalPaths={
 codex:[path.join(process.env.CODEX_HOME||path.join(home,'.codex'),'skills')],
 claude:[path.join(home,'.claude','skills')],
 antigravity:[path.join(home,'.gemini','config','skills'),path.join(home,'.gemini','antigravity','skills'),path.join(home,'.gemini','antigravity-cli','skills'),path.join(home,'.gemini','skills')],
 opencode:[path.join(home,'.config','opencode','skills'),path.join(home,'.claude','skills'),path.join(home,'.agents','skills')]
};
const safeName=typeof pkg?.name==='string'&&/^tw-[a-z0-9-]+-skill$/.test(pkg.name)?pkg.name:null;
const sourceSkill=(()=>{try{return createHash('sha256').update(readFileSync(path.join(root,'SKILL.md'))).digest('hex')}catch{return null}})();
function inspectSkill(p,scope){
 try{lstatSync(p)}catch(e){return {path:p,scope,status:e.code==='ENOENT'?'missing':'unknown',version:null,entryMatchesSource:null};}
 let installed=null;try{const v=JSON.parse(readFileSync(path.join(p,'package.json'),'utf8')).version;if(typeof v==='string')installed=v}catch{}
 let matches=null,entry='unknown';try{const content=readFileSync(path.join(p,'SKILL.md'));entry='available';if(sourceSkill)matches=createHash('sha256').update(content).digest('hex')===sourceSkill}catch(e){if(e.code==='ENOENT')entry='missing'}
 return {path:p,scope,status:'present',version:installed,entry,entryMatchesSource:matches};
}
const installationPaths=agent&&safeName&&paths[agent]?[{path:path.join(cwd,paths[agent],safeName),scope:'project'},...(globalPaths[agent]??[]).map(dir=>({path:path.join(dir,safeName),scope:'global'}))]:[];
const installations=installationPaths.map(({path:p,scope})=>inspectSkill(p,scope));
const discoveredInstallations=installations.filter(x=>x.status==='present');
const installationWarning=discoveredInstallations.length>1?'Multiple copies detected; actual discovery and precedence depend on this agent, configuration and workspace. Check the loaded path in a new conversation.':null;

const checks=[{name:'node',tier:'required',status:nodeMajor>=18?'available':'missing'},{name:'npm',tier:'required-for-dependencies',status:npmVersion?'available':'missing'},{name:'workspace-write',tier:'required-for-install',status:workspaceWritable?'available':'missing'},{name:'dependencies',tier:'required-for-local-cli',status:dependencies.every(d=>d.installed)?'available':'missing'},{name:'connector-and-account',tier:'optional-alternative',status:'unknown'},{name:'browser-control-and-login',tier:'optional-alternative',status:'unknown'}];
console.log(JSON.stringify({ok:true,version:'1.2.0',agent:agent??'unknown',agentSelectionRequired:!agent,availableAgents,antigravityDesktop,os:{platform:platform(),release:release()},node:{version:process.versions.node,meetsMinimum:nodeMajor>=18},npm:{version:npmVersion},package:{name:pkg?.name??null,version:pkg?.version??null,dependencies},skillProjectDirectory:agent&&paths[agent]?path.join(cwd,paths[agent]):null,existingProjectSkill:skillPath?existsSync(skillPath):null,installations,installationWarning,workspaceWritable,checks,padletCredential:{present:Boolean(process.env.PADLET_API_KEY)||existsSync(path.join(home,'.tw-edu-skills/padlet/config.json')),validity:'unknown'},connectors:{status:'unknown',reason:'Inspect the current agent tool inventory; subprocess cannot see host tools.'},mcp:{status:'unknown',reason:'Configured servers and available tools require runtime discovery.'},browserControl:{status:'unknown',reason:'Runtime capability, login and platform permissions require interactive inspection.'},network:{status:'unknown',reason:'No network requests are made during diagnosis.'},guidance:{documentation:docs[agent]??null,selection:'Run with --agent codex|claude|antigravity|opencode|other when ambiguous.',dependencies:'Use the provided installer --with-deps or run npm ci --ignore-scripts in the skill directory.',connector:'Discover tools in the active agent and inspect its schema.',login:'Use the platform native login and permission flow.'}}));
