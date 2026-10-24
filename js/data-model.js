export const DEFAULT_SETTINGS=Object.freeze({rounding:'nearest',recentEventCount:5,namedQualification:'beforeNamed',namedLevels:Object.freeze({cleric:9,fighter:9,ranger:10,paladin:9,mage:9,thief:10,bard:9,druid:12})});
export function createCampaign({id,name}) {
 return {schemaVersion:1,id,name,illustrative:false,settings:structuredClone(DEFAULT_SETTINGS),categories:[['combat','Combat',1],['currency','Treasure — Currency',1],['gems','Treasure — Gems & Jewelry',1],['magic','Treasure — Magic Items',0],['roleplay','Roleplay & Actions',1],['quests','Quests & Milestones',1],['other','Treasure — Other Valuable Items',1]].map(([id,name,multiplier])=>({id,name,multiplier,active:true})),characters:[],events:[]};
}
export function createCharacter({id,campaignId,name,classId,...rest}) {
 return {id,campaignId,name,classId,race:'Human',wisdom:10,progressionTrack:'standard',manualLevel:null,namedOverride:null,wisdomOverride:null,stronghold:false,customBonusPercent:0,notes:'',active:true,...rest};
}
