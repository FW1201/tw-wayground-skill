/** Cross-platform teaching brief. Semantic accuracy remains a teacher review. */
export function validateLessonV1(x) {
 const errors=[];const nonempty=v=>typeof v==='string'&&v.trim().length>0;
 if(!x||typeof x!=='object'||Array.isArray(x))return {ok:false,errors:['brief must be an object']};
 if(x.version!==1)errors.push('version must equal 1');
 for(const key of ['title','grade','language','devices','fallback'])if(!nonempty(x[key]))errors.push(`${key} is required`);
 if(!Number.isFinite(x.durationMinutes)||x.durationMinutes<=0)errors.push('durationMinutes must be positive');
 const ids=(key,fields)=>{
  if(!Array.isArray(x[key])||!x[key].length){errors.push(`${key} must be nonempty`);return new Set()}
  const seen=new Set();for(const [i,item] of x[key].entries()){
   if(!item||typeof item!=='object'){errors.push(`${key}[${i}] must be an object`);continue}
   for(const f of ['id',...fields])if(!nonempty(item[f]))errors.push(`${key}[${i}].${f} is required`);
   if(nonempty(item.id)){if(seen.has(item.id))errors.push(`${key} duplicate id ${item.id}`);seen.add(item.id)}
  }return seen;
 };
 const sources=ids('sources',['title','locator']), objectives=ids('objectives',['text']);
 let sum=0;
 if(!Array.isArray(x.activities)||!x.activities.length)errors.push('activities must be nonempty');
 else for(const [i,a] of x.activities.entries()){
  if(!a||typeof a!=='object'){errors.push(`activities[${i}] must be an object`);continue}
  for(const key of ['title','goal','playerAction','feedback','completion','evidence'])if(!nonempty(a[key]))errors.push(`activities[${i}].${key} is required`);
  if(!Number.isFinite(a.minutes)||a.minutes<=0)errors.push(`activities[${i}].minutes must be positive`);else sum+=a.minutes;
  for(const [field,set] of [['sourceIds',sources],['objectiveIds',objectives]]){
   if(!Array.isArray(a[field])||!a[field].length)errors.push(`activities[${i}].${field} must be nonempty`);
   else for(const id of a[field])if(!set.has(id))errors.push(`activities[${i}].${field} unknown id ${String(id)}`);
  }
 }
 if(Number.isFinite(x.durationMinutes)&&sum!==x.durationMinutes)errors.push(`activity minutes ${sum} do not match durationMinutes ${x.durationMinutes}`);
 return {ok:errors.length===0,version:1,errors,activityMinutes:sum,review:'教師仍須複核教材正確性、遊戲操作與實際平台內容。'};
}
