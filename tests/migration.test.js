import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {migrateWorkbook} from '../scripts/migration/migrate-workbook.mjs';
import {createCampaign,createCharacter,replayCampaign,createAward,upsertEvent,exportCSV} from '../js/index.js';
import {add,mul,div,str} from '../js/rational.js';
import {eventDateLabel,filteredEvents} from '../js/ui.js';
function fixture(){
 const cells={},n=(address,value,formula=null,extra={})=>cells[address]={cell:address,type:'number',value:String(value),formula,exact:str(value),...extra};
 const text=(address,value)=>cells[address]={cell:address,type:'text',value,formula:null};
 n('F2',185117);n('F5',mul(div(185117,'1.1'),'1.25'),'F2/1.1*1.25');n('M2',257207);n('M6',1237500);n('M8',1237500,'1237500+SUM(K135:K1000)');
 for(const [base,award,date,desc] of [['C','E','B','D'],['I','K','H','J']]){n(base+'4',div(2000,'5.5'),'2000/5.5',{split:{inputValue:2000,multiplier:1,divisor:5.5}});n(award+'4',mul(div(2000,'5.5'),'1.25'));n(date+'4',44898,null,{excelDate:'2022-12-03'});text(desc+'4','Synthetic shared encounter');}
 n('C5',10);n('E5','12.5');
 const diemer=mul(add(div(185117,'1.1'),add(div(2000,'5.5'),10)),'1.25');n('F4',diemer,'sum(E4:E190)+F5');const m4=add(257207,mul(div(2000,'5.5'),'1.25'));n('M4',m4,'sum(K4:K180)+M2');n('M5',mul(div(m4,'1.25'),'1.5'),'M4/1.25 * 1.5');
 return {filename:'synthetic.xlsx',sha256:'synthetic-fixture',sheets:[{name:'Experience',cells},{name:'Gold',cells:{}}]};
}
const build=source=>migrateWorkbook(source??fixture(),createCampaign({id:'synthetic',name:'Synthetic'}),{importedAt:'2026-10-24T00:00:00.000Z'});
test('migration merges explicit pools including fractional shares and preserves all controls',()=>{const {campaign,summary}=build();assert.equal(summary.eventCount,5);assert.equal(summary.sourceAwardRows,3);assert.ok(summary.controls.every(c=>c.matches));const shared=campaign.events.find(e=>e.type==='award'&&e.distribution==='shared');assert.equal(shared.divisor,5.5);assert.equal(shared.allocations.length,2);assert.equal(shared.allocations[0].baseXp,'4000/11');assert.equal(shared.source.records.length,2);});
test('migration preserves source provenance and marks unknown dates and blank descriptions',()=>{const {campaign}=build();const e=campaign.events.find(e=>e.id==='legacy-diemer-5');assert.equal(e.dateStatus,'unknown');assert.ok(e.reviewFlags.includes('missing-description'));assert.equal(e.source.records[0].originalDescription,'');assert.equal(eventDateLabel(e),'Undated · source order');assert.ok(filteredEvents(campaign,{reviewOnly:true}).includes(e));const csv=exportCSV(campaign);assert.ok(csv.includes('"dateStatus","orderingDateAnchor"'));assert.ok(csv.includes('"","unknown","2022-12-03"'));});
test('imported post-book reset supersedes edits to earlier shared awards',()=>{const {campaign}=build();const old=campaign.events.find(e=>e.type==='award'&&e.distribution==='shared');const changed=upsertEvent(campaign,createAward(campaign,{...old,inputValue:3000}));const states=replayCampaign(changed).characters;assert.equal(states.find(s=>s.characterId==='callista').adjustedXp,1237500);assert.notEqual(states.find(s=>s.characterId==='diemer').adjustedXp,replayCampaign(campaign).characters.find(s=>s.characterId==='diemer').adjustedXp);});
test('migration refuses changed controls, future post-book rows and nonempty campaigns',()=>{let s=fixture();s.sheets[0].cells.F4.exact='1/1';assert.throws(()=>build(s),/Reconciliation/);s=fixture();s.sheets[0].cells.I135={type:'number',value:'100',exact:'100/1'};assert.throws(()=>build(s),/Post-book/);const c=createCampaign({id:'x',name:'x'});c.characters.push(createCharacter({id:'existing',campaignId:'x',name:'Existing',classId:'fighter'}));assert.throws(()=>migrateWorkbook(fixture(),c),/empty campaign/);});
test('unknown Wisdom is supported only with an explicit bonus override',()=>{const c=createCampaign({id:'x',name:'x'});c.characters.push(createCharacter({id:'d',campaignId:'x',name:'D',classId:'cleric',wisdom:null,wisdomOverride:true}));assert.equal(replayCampaign(c).characters[0].wisdom,true);c.characters[0].wisdomOverride=null;assert.throws(()=>replayCampaign(c),/Invalid wisdom/);});
test('read-only workbook formula extraction unit tests pass',()=>{execFileSync('python3',[fileURLToPath(new URL('../scripts/migration/test_extractor.py',import.meta.url))],{stdio:'pipe'});});
