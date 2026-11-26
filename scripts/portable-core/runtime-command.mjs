import {readFile} from 'node:fs/promises';
import {diagnose} from './diagnose-runtime.mjs';
import {route} from './router.mjs';
export async function runRuntimeCommand(platform,args) {
 const i=args.indexOf('--inventory');const file=i>=0?args[i+1]:null;
 if(!file)return {ok:false,error:'usage',hint:'runtime --inventory <JSON file>'};
 try {
  const input=JSON.parse(await readFile(file,'utf8'));
  if(input.platform!==platform)return {ok:false,error:'platform-mismatch',platform};
  const diagnostic=diagnose(input);if(!diagnostic.ok)return diagnostic;
  const routing=route({action:input.action,available:diagnostic.options});
  return {ok:true,platform,diagnostic,routing,externalWriteAttempted:false};
 } catch(e){return {ok:false,error:'invalid-inventory-file',hint:String(e.message),externalWriteAttempted:false};}
}
