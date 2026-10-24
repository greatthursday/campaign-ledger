import {add,mul,div,cmp,str,round,q} from './rational.js';
import {levelInfo,progression} from './level-tables.js';
import {assertCampaign} from './validation.js';
// Dates, then persisted order, then code-point ID. Editing timestamps never reorder events.
export function compareEvents(a,b){return a.date<b.date?-1:a.date>b.date?1:a.order-b.order||(a.id<b.id?-1:a.id>b.id?1:0);}
export function bonusInfo(character,baseXp,settings){
 const wisdom=character.wisdomOverride??(character.classId==='cleric'&&character.wisdom>=16);
 const other=add(1,div(add(wisdom?10:0,add(character.stronghold?25:0,character.customBonusPercent)),100));
 if(cmp(other,0)<=0)throw new Error('Combined multiplier must be positive');
 const p=progression(character.classId,character.progressionTrack);
 const namedLevel=settings.namedLevels[character.classId];
 const threshold=p.thresholds[namedLevel-p.firstLevel];
 const candidate=mul(baseXp,settings.namedQualification==='includingNamed'?add(other,'0.15'):other);
 const qualifies=threshold===undefined?namedLevel<p.firstLevel:cmp(candidate,threshold)>=0;
 const named=character.namedOverride??qualifies;
 return {wisdom,named,namedQualifies:qualifies,multiplier:str(add(other,named?'0.15':0)),customBonusPercent:character.customBonusPercent};
}
export function calculateCharacter(character,baseXp,settings){
 const bonus=bonusInfo(character,baseXp,settings);const exact=mul(baseXp,bonus.multiplier);
 const adjustedXp=round(exact,settings.rounding);
 // Level qualification uses displayed XP, matching the configured final-total rounding policy.
 return {characterId:character.id,baseXp:str(baseXp),adjustedXpExact:str(exact),adjustedXp,...bonus,...levelInfo(character.classId,adjustedXp,character.progressionTrack),confirmedLevel:character.manualLevel};
}
export function eventBaseXp(event){return str(mul(event.inputValue,event.multiplier));}
export function awardAllocations(event){
 const total=eventBaseXp(event);
 if(event.distribution==='custom')return event.allocations.map(a=>({characterId:a.characterId,baseXp:str(a.baseXp)}));
 const value=event.distribution==='shared'?div(total,event.divisor):q(total);
 return event.allocations.map(a=>({characterId:a.characterId,baseXp:str(value)}));
}
function verifySnapshots(c){
 for(const e of c.events){
  if(e.type==='award'){
   const expected=awardAllocations(e);
   expected.forEach((a,i)=>{if(cmp(a.baseXp,e.allocations[i].baseXp)!==0)throw new Error(`Stale award allocations: ${e.id}; rebuild the edited event`);});
   if(e.distribution==='custom'&&cmp(e.allocations.reduce((s,a)=>add(s,a.baseXp),q(0)),eventBaseXp(e))>0)throw new Error('Custom allocations exceed pool');
  }else for(const a of e.allocations){const expected=e.method==='setBase'?q(a.amount):div(a.amount,a.conversionMultiplier);if(cmp(expected,a.baseXp)!==0)throw new Error('Stale adjustment conversion');}
 }
}
export function replayCampaign(c){
 assertCampaign(c);verifySnapshots(c);
 const base=new Map(c.characters.map(ch=>[ch.id,q(0)]));const history=[];
 const byId=new Map(c.characters.map(ch=>[ch.id,ch]));
 for(const e of [...c.events].sort(compareEvents)){
  const entries=[];
  for(const a of e.allocations){
   const ch=byId.get(a.characterId);const before=calculateCharacter(ch,base.get(ch.id),c.settings);
   const value=e.type==='adjustment'&&e.method!=='addAdjusted'?q(a.baseXp):add(base.get(ch.id),a.baseXp);
   if(cmp(value,0)<0)throw new Error(`Negative base XP at event ${e.id} for ${ch.id}`);
   const after=calculateCharacter(ch,value,c.settings);base.set(ch.id,value);
   entries.push({characterId:ch.id,before,after,baseChange:str(add(value,mul(before.baseXp,-1)))});
  }
  history.push({eventId:e.id,date:e.date,type:e.type,entries});
 }
 return {characters:c.characters.map(ch=>calculateCharacter(ch,base.get(ch.id),c.settings)),history};
}
function metadata(c,input){
 const old=c.events.find(e=>e.id===input.id);
 return {id:input.id,campaignId:c.id,date:input.date??old?.date,order:input.order??old?.order??Math.max(-1,...c.events.map(e=>e.order))+1,createdAt:old?.createdAt??input.createdAt,modifiedAt:input.modifiedAt??input.createdAt??old?.modifiedAt,description:input.description,notes:input.notes??old?.notes??''};
}
function checkedEvent(c,event){const candidate=structuredClone(c);candidate.events=candidate.events.filter(e=>e.id!==event.id);candidate.events.push(event);replayCampaign(candidate);return event;}
export function createAward(c,input){
 const cat=c.categories.find(x=>x.id===input.categoryId);if(!cat)throw new Error('Unknown category');
 const event={...metadata(c,input),type:'award',categoryId:cat.id,inputValue:input.inputValue,multiplier:input.multiplier??cat.multiplier,distribution:input.distribution??'individual',divisor:input.divisor??null,unit:input.unit??'XP',itemDescription:input.itemDescription??'',treasureKey:input.treasureKey??null,allocations:input.allocations??input.recipientIds?.map(characterId=>({characterId}))??[]};
 event.allocations=awardAllocations(event);return checkedEvent(c,event);
}
export function createAdjustment(c,input){
 const event={...metadata(c,input),type:'adjustment',method:input.method,reason:input.reason,allocations:[]};
 // Exclude old version and later events when converting an inserted/edited adjustment.
 const prior={...c,events:c.events.filter(e=>e.id!==event.id&&compareEvents(e,event)<0)};
 const states=replayCampaign(prior).characters;
 for(const recipient of input.recipients??[]){
  const ch=c.characters.find(x=>x.id===recipient.characterId);if(!ch)throw new Error('Unknown recipient');
  const amount=recipient.amount??input.amount;
  let multiplier=states.find(x=>x.characterId===ch.id).multiplier;
  if(input.method==='setAdjusted'){
   // Solve both possible automatic named states. Some targets fall in the named-bonus jump.
   const other=bonusInfo({...ch,namedOverride:false},0,c.settings).multiplier;
   const candidates=[other,str(add(other,'0.15'))];
   const match=candidates.find(m=>cmp(bonusInfo(ch,div(amount,m),c.settings).multiplier,m)===0);
   if(!match)throw new Error('Target lies in named-bonus discontinuity; explicitly set namedOverride before creating this reset');
   multiplier=match;
  }
  event.allocations.push({characterId:ch.id,amount,conversionMultiplier:multiplier,baseXp:str(input.method==='setBase'?amount:div(amount,multiplier))});
 }
 return checkedEvent(c,event);
}
export function upsertEvent(c,event){
 const result=structuredClone(c);result.events=result.events.filter(e=>e.id!==event.id);result.events.push(structuredClone(event));replayCampaign(result);return result;
}
export function removeEvent(c,id){const result=structuredClone(c);if(!result.events.some(e=>e.id===id))throw new Error('Unknown event');result.events=result.events.filter(e=>e.id!==id);replayCampaign(result);return result;}
export function archiveCharacter(c,id){const result=structuredClone(c);const ch=result.characters.find(ch=>ch.id===id);if(!ch)throw new Error('Unknown character');ch.active=false;return result;}
export function recalculateCategory(c,categoryId,multiplier,modifiedAt){
 const result=structuredClone(c);const cat=result.categories.find(x=>x.id===categoryId);if(!cat)throw new Error('Unknown category');cat.multiplier=multiplier;
 for(const e of result.events.filter(e=>e.type==='award'&&e.categoryId===categoryId)){
  if(e.distribution==='custom')throw new Error('Reallocate custom awards explicitly');
  e.multiplier=multiplier;e.modifiedAt=modifiedAt;e.allocations=awardAllocations(e);
 }
 replayCampaign(result);return result;
}
export function previewEvent(c,event){return replayCampaign(upsertEvent(c,event)).history.find(e=>e.eventId===event.id);}
