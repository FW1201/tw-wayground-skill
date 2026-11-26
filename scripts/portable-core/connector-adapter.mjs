/** Runtime adapter: the host agent must inject its own discovered tool invoker. */
export const CONNECTORS = Object.freeze({
  'padlet.board.create': {tool:'padlet_create_padlet', required:['title'], readback:'padlet_get_padlet'},
  'padlet.board.read': {tool:'padlet_get_padlet', required:['wall_url']},
  'padlet.posts.save': {tool:'padlet_save_posts', required:['wall_url','posts'], readback:'padlet_get_padlet'},
  'padlet.arcade.create': {tool:'padlet_create_padlet_arcade_activity', required:['activity_type','details','grade','topic'], readback:'player-ui'},
  'padlet.sandbox.tools.read': {tool:'padlet_get_whiteboard_tool_settings', required:['wall_url']},
  'wayground.quiz.create': {tool:'wayground_create_quiz', required:['title','grade','subject','questions'], readback:'editor-ui'},
  'wayground.flashcards.create': {tool:'wayground_create_flashcards', required:['title','grade','subject','flashcards'], readback:'editor-ui'}
});
export function resolveTool(action, toolNames) {
  const spec=CONNECTORS[action];
  if(!spec) return {ok:false,error:'unsupported-action'};
  if(!Array.isArray(toolNames)) return {ok:false,error:'tool-inventory-required'};
  const matches=toolNames.filter(name=>typeof name==='string'&&(name===spec.tool||name.endsWith('__'+spec.tool)));
  if(matches.length!==1)return {ok:false,error:matches.length?'ambiguous-tool':'tool-unavailable',action};
  return {ok:true,action,tool:matches[0],readback:spec.readback??null};
}
export async function executeConnector({action,input,toolNames,invoke}) {
  const match=resolveTool(action,toolNames);
  if(!match.ok)return {...match,externalWriteAttempted:false};
  if(!input||typeof input!=='object'||Array.isArray(input))return {ok:false,error:'invalid-input',externalWriteAttempted:false};
  const missing=CONNECTORS[action].required.filter(k=>input[k]===undefined||input[k]===null||input[k]==='');
  if(missing.length)return {ok:false,error:'missing-input',missing,externalWriteAttempted:false};
  if(typeof invoke!=='function')return {ok:false,error:'host-invoker-required',externalWriteAttempted:false};
  try {
    const response=await invoke(match.tool,input);
    let payload=response?.structuredContent ?? response;
    const content=response?.content;
    if(!response?.structuredContent && Array.isArray(content) && content.length===1 && content[0]?.type==='text') {
      try { payload=JSON.parse(content[0].text); } catch { /* text-only output is not assumed to be a structured success */ }
    }
    if(response?.isError===true||payload?.success===false||payload?.ok===false) return {ok:false,status:'failed',action,tool:match.tool,response};
    if(response==null) return {ok:false,status:'unknown',action,tool:match.tool,error:'empty-response',hint:'Inspect target before retrying.'};
    // A host may time out after a server commits a write. Do not retry without readback.
    return {ok:true,status:'submitted',action,tool:match.tool,response,readback:match.readback,completed:false};
  } catch(error) {
    return {ok:false,status:'unknown',action,tool:match.tool,error:'invocation-outcome-unknown',hint:'Inspect the target before retrying; a write may have succeeded.'};
  }
}
