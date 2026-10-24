import {LEVEL_TABLES,progression} from './level-tables.js';
import {cmp,q} from './rational.js';
export function validateCampaign(c) {
 const errors=[];const check=(v,m)=>{if(!v)errors.push(m);};
 const text=v=>typeof v==='string'&&v.length>0;
 const num=(v,min=-1e12,max=1e12)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
 const rat=(v,nonnegative=false)=>{try {q(v);return !nonnegative||cmp(v,0)>=0;}catch{return false;}};
 const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
 const time=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T.*Z$/.test(v)&&Number.isFinite(Date.parse(v));
 if(!c||typeof c!=='object')return {valid:false,errors:['Campaign must be an object']};
 check(c.schemaVersion===1,'Unsupported schemaVersion');check(text(c.id)&&text(c.name),'Campaign id/name required');
 for(const k of ['characters','events','categories'])check(Array.isArray(c[k]),`${k} must be an array`);
 if(errors.length)return {valid:false,errors};
 const unique=(arr,key,label)=>{check(new Set(arr.map(x=>x?.[key])).size===arr.length,`Duplicate ${label}`);};
 unique(c.characters,'id','character id');unique(c.events,'id','event id');unique(c.categories,'id','category id');
 const s=c.settings??{};
 check(['nearest','floor','ceil'].includes(s.rounding),'Invalid rounding');check([3,5,10,20].includes(s.recentEventCount),'Invalid recent count');check(['beforeNamed','includingNamed'].includes(s.namedQualification),'Invalid named qualification');
 for(const k of Object.keys(LEVEL_TABLES))check(Number.isInteger(s.namedLevels?.[k])&&s.namedLevels[k]>=1&&s.namedLevels[k]<=20,`Invalid named level: ${k}`);
 for(const cat of c.categories)check(cat&&text(cat.id)&&text(cat.name)&&num(cat.multiplier,0)&&typeof cat.active==='boolean','Invalid category');
 for(const ch of c.characters){
  if(!ch){errors.push('Invalid character');continue;}
  check(text(ch.id)&&text(ch.name)&&ch.campaignId===c.id,'Invalid character identity');
  check(typeof ch.race==='string'&&typeof ch.notes==='string','Invalid character text');
  check(Boolean(LEVEL_TABLES[ch.classId]),'Invalid class');try{progression(ch.classId,ch.progressionTrack);}catch{errors.push('Invalid progression track');}
  check(Number.isInteger(ch.wisdom)&&ch.wisdom>=1&&ch.wisdom<=25,'Invalid wisdom');
  check(ch.manualLevel===null||(Number.isInteger(ch.manualLevel)&&ch.manualLevel>=1&&ch.manualLevel<=20),'Invalid manual level');
  for(const k of ['namedOverride','wisdomOverride'])check(ch[k]===null||typeof ch[k]==='boolean',`Invalid ${k}`);
  check(typeof ch.stronghold==='boolean'&&typeof ch.active==='boolean','Invalid character status');
  check(num(ch.customBonusPercent,-99,1000),'Invalid custom bonus');
 }
 const ids=new Set(c.characters.map(x=>x?.id));const cats=new Set(c.categories.map(x=>x?.id));
 for(const e of c.events){
  if(!e){errors.push('Invalid event');continue;}
  check(text(e.id)&&e.campaignId===c.id&&text(e.description),'Invalid event identity');
  check(typeof e.notes==='string','Invalid event notes');
  check(date(e.date)&&time(e.createdAt)&&time(e.modifiedAt)&&Date.parse(e.modifiedAt)>=Date.parse(e.createdAt),'Invalid event dates');
  check(Number.isSafeInteger(e.order)&&e.order>=0,'Invalid event order');
  check(['award','adjustment'].includes(e.type),'Invalid event type');
  check(Array.isArray(e.allocations)&&e.allocations.length>0,'Recipients required');
  if(!Array.isArray(e.allocations))continue;
  if(e.allocations.some(a=>!a||typeof a!=='object')){errors.push('Invalid allocation');continue;}
  unique(e.allocations,'characterId','recipient');
  for(const a of e.allocations)check(a&&ids.has(a.characterId),'Unknown recipient (archive instead of deleting referenced character)');
  if(e.type==='award'){
   check(cats.has(e.categoryId),'Unknown category');check(typeof e.unit==='string'&&typeof e.itemDescription==='string','Invalid award text');check(num(e.inputValue,0)&&num(e.multiplier,0),'Invalid award input');
   check(['shared','individual','custom'].includes(e.distribution),'Invalid distribution');
   check(e.distribution!=='shared'||(Number.isInteger(e.divisor)&&e.divisor>=e.allocations.length),'Invalid share divisor');
   for(const a of e.allocations)check(rat(a.baseXp,true),'Invalid allocation baseXp');
   if(e.treasureKey!=null)check(text(e.treasureKey),'Invalid treasure key');
  }else{
   check(['setAdjusted','addAdjusted','setBase'].includes(e.method),'Invalid adjustment method');
   check(text(e.reason),'Adjustment reason required');
   for(const a of e.allocations){check(num(a.amount),'Invalid adjustment amount');check(e.method==='addAdjusted'||a.amount>=0,'Negative baseline');check(rat(a.baseXp),'Invalid adjustment baseXp');check(rat(a.conversionMultiplier,true)&&cmp(a.conversionMultiplier,0)>0,'Invalid conversion multiplier');}
  }
 }
 const keys=c.events.filter(e=>e?.type==='award'&&e.treasureKey).map(e=>e.treasureKey);check(new Set(keys).size===keys.length,'Treasure already awarded (duplicate treasureKey)');
 return {valid:errors.length===0,errors};
}
export function assertCampaign(c){const r=validateCampaign(c);if(!r.valid)throw new Error(r.errors.join('; '));return c;}
