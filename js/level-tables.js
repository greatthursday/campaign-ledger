// AD&D 2E Player's Handbook, tables 14, 20, 23, 25. See docs/RULES.md.
const fighter=[0,2000,4000,8000,16000,32000,64000,125000,250000,500000,750000,1000000,1250000,1500000,1750000,2000000,2250000,2500000,2750000,3000000];
const ranger=[0,2250,4500,9000,18000,36000,75000,150000,300000,600000,900000,1200000,1500000,1800000,2100000,2400000,2700000,3000000,3300000,3600000];
const cleric=[0,1500,3000,6000,13000,27500,55000,110000,225000,450000,675000,900000,1125000,1350000,1575000,1800000,2025000,2250000,2475000,2700000];
const mage=[0,2500,5000,10000,20000,40000,60000,90000,135000,250000,375000,750000,1125000,1500000,1875000,2250000,2625000,3000000,3375000,3750000];
const thief=[0,1250,2500,5000,10000,20000,40000,70000,110000,160000,220000,440000,660000,880000,1100000,1320000,1540000,1760000,1980000,2200000];
const druid=[0,2000,4000,7500,12500,20000,35000,60000,90000,125000,200000,300000,750000,1500000,3000000,3500000];
export const LEVEL_TABLES=Object.freeze(Object.fromEntries(Object.entries({fighter,ranger,paladin:ranger,cleric,mage,thief,bard:thief,druid}).map(([k,v])=>[k,Object.freeze([...v])])));
export function progression(classId,track='standard') {
 if(!LEVEL_TABLES[classId])throw new Error('Unknown class');
 if(track==='hierophant') {if(classId!=='druid')throw new Error('Hierophant track requires Druid');return {firstLevel:16,thresholds:[1,500000,1000000,1500000,2000000]};}
 if(track!=='standard')throw new Error('Unknown progression track');
 return {firstLevel:1,thresholds:LEVEL_TABLES[classId]};
}
export function levelInfo(classId,xp,track='standard') {
 const {firstLevel,thresholds:t}=progression(classId,track);
 let i=0;while(i+1<t.length&&xp>=t[i+1])i++;
 const next=t[i+1]??null;
 return {qualifyingLevel:firstLevel+i,currentLevelThreshold:t[i],nextLevelXp:next,xpRemaining:next===null?null:Math.max(0,next-xp),progressPercent:next===null?100:Math.max(0,Math.min(100,100*(xp-t[i])/(next-t[i]))),atTableLimit:next===null,requiresDruidRankApproval:classId==='druid'&&track==='standard'&&i+1>=12,requiresHierophantTransition:classId==='druid'&&track==='standard'&&i+1===16};
}
