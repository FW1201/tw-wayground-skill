#!/usr/bin/env node
/** Assess only explicitly reported runtime capabilities; never probes credentials or invokes tools. */
import {readFile} from 'node:fs/promises';
import {CONNECTORS,resolveTool} from './connector-adapter.mjs';
const allowed=['padlet.board.create','padlet.board.read','padlet.posts.save','padlet.arcade.create','padlet.sandbox.tools.read','wayground.quiz.create','wayground.flashcards.create'];
export function diagnose({platform,action,tools=[],browser='unknown',api='unknown',cli='unknown',manual='unknown'}) {
 if(!['padlet','wordwall','wayground','kahoot'].includes(platform)||typeof action!=='string'||!action.startsWith(platform+'.')||!Array.isArray(tools)||tools.some(x=>typeof x!=='string'))return {ok:false,error:'invalid-inventory'};
 const connector=allowed.includes(action)?resolveTool(action,tools):{ok:false,error:'unsupported-action'};
 const options=[];
 if(connector.ok) options.push({kind:'connector',action,status:'available',tool:connector.tool,verification:'tool-discovered-permission-unverified'});
 for(const [kind,status] of [['api',api],['cli',cli],['computer-use',browser],['manual',manual]]) {
  if(!['available','unavailable','unknown'].includes(status))return {ok:false,error:'invalid-status',kind};
  options.push({kind,action,status,verification:'caller-reported'});
 }
 return {ok:true,platform,action,connector:connector.ok?connector:{status:connector.error==='unsupported-action'?'not-mapped':'not-discovered'},options,warning:'工具存在不表示登入、方案或資源權限已驗證；執行前檢查當前工具 schema 與目標帳號。'};
}
if(import.meta.url===new URL(process.argv[1], 'file:').href){
 try{const path=process.argv[2];if(!path)throw Error('usage: node diagnose-runtime.mjs <inventory.json>');const input=JSON.parse(await readFile(path,'utf8'));const output=diagnose(input);console.log(JSON.stringify(output));if(!output.ok)process.exitCode=1}catch(e){console.log(JSON.stringify({ok:false,error:'invalid-input',hint:String(e.message)}));process.exitCode=1}
}
