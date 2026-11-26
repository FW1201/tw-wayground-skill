export function validateLesson(x){
 const missing=[];
 for(const k of ['title','grade','objectives','durationMinutes','sources','devices','activities']) if(!x||x[k]===undefined||x[k]===null||x[k]===''||(Array.isArray(x[k])&&!x[k].length)) missing.push(k);
 if(x&&(!Number.isFinite(x.durationMinutes)||x.durationMinutes<=0)) missing.push('durationMinutes:positive-number');
 if(Array.isArray(x?.activities)) x.activities.forEach((a,i)=>{for(const k of ['goal','playerAction','feedback','completion']) if(!a?.[k]) missing.push(`activities.${i}.${k}`)});
 return {ok:missing.length===0,missing};
}
