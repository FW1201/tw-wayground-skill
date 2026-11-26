// Only runtime-observed exact capabilities are selectable; documentation is not a live capability.
export function route({action, available=[]}) {
 if(typeof action!=='string'||!action.trim()||!Array.isArray(available)) return {ok:false,error:'invalid-input'};
 const ordered=['connector','mcp','api','cli','computer-use','manual'];
 const candidates=available.filter(x=>x&&x.action===action&&x.status==='available'&&ordered.includes(x.kind));
 candidates.sort((a,b)=>ordered.indexOf(a.kind)-ordered.indexOf(b.kind));
 return candidates.length?{ok:true,action,selected:candidates[0],alternatives:candidates.slice(1)}:{ok:false,action,error:'no-verified-route',hint:'Discover runtime tools and permissions, or prepare an explicitly supported manual path.'};
}
export function result({action,route,status,resource=null,warnings=[],evidence=[]}) {
 if(!['pending','completed','failed','unknown','partial'].includes(status)) throw Error('invalid status');
 if(status==='completed'&&evidence.length===0) throw Error('completed requires readback evidence');
 return {version:1,action,route,status,resource,warnings,evidence};
}
