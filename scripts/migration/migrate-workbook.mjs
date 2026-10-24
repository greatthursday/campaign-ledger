// Explicit migration for the two Cleric ledgers on Experience. No live GitHub writes.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {createCharacter,replayCampaign,awardAllocations,exportJSON,importJSON} from '../../js/index.js';
import {q,str,div,mul,cmp,number,round} from '../../js/rational.js';

export function migrateWorkbook(source,starter,{importedAt=new Date().toISOString()}={}){
 const sheet=source.sheets.find(s=>s.name==='Experience');if(!sheet)throw new Error('Experience worksheet not found');
 const cells=sheet.cells,cell=a=>cells[a],exact=a=>cell(a)?.exact??'0/1';
 const required=['F2','F4','F5','M2','M4','M5','M6','M8'];
 for(const a of required)if(!cell(a)?.exact||cell(a).calculationError)throw new Error('Uncalculated control: '+a);
 if(cell('F5').formula.replace(/\s/g,'')!=='F2/1.1*1.25'||cell('M5').formula.replace(/\s/g,'')!=='M4/1.25*1.5'||cell('M8').formula.replace(/\s/g,'').toUpperCase()!=='1237500+SUM(K135:K1000)')throw new Error('Control formulas changed. Review the migration mapping before continuing.');
 if(cmp(exact('M6'),1237500)!==0)throw new Error('Book baseline changed');
 const c=structuredClone(starter);if(c.characters.length||c.events.length)throw new Error('Migration requires an empty campaign. Never overwrite an existing ledger implicitly.');
 c.name='Our AD&D campaign';c.illustrative=false;c.notes='Imported from the original workbook. Historical multipliers and descriptions are preserved. Unknown event dates are labelled; date anchors preserve source ordering.';
 c.categories.push({id:'legacy-workbook',name:'Historical XP — workbook',multiplier:1,active:true});
 c.characters=[
  createCharacter({id:'callista',campaignId:c.id,name:'Callista',classId:'cleric',wisdom:19,namedOverride:true,stronghold:true,notes:'Wisdom 19 confirmed in campaign context. Current combined 1.50× follows Experience!M5. Opening M2 is already on the old 1.25× scale. Magic-book baseline at M6/M8 supersedes all earlier awards. Event dates are incomplete in the workbook.'}),
  createCharacter({id:'diemer',campaignId:c.id,name:'Diemer',classId:'cleric',wisdom:null,wisdomOverride:true,namedOverride:true,notes:'Wisdom score was not recorded in the workbook. The +10% Wisdom bonus is explicitly enabled from F5 (old 1.10× converted to 1.25×). Named bonus retained from the workbook; no stronghold bonus applied. Opening F2 is adjusted XP at 1.10×.'})
 ];
 const issues=[],records=[],nodes=new Map(),sequences=new Map(),used=new Map();
 const issue=(eventId,characterId,field,reference,message)=>issues.push({eventId,characterId,field,reference,message});
 const common=(id,date,description)=>({id,campaignId:c.id,date,dateStatus:'unknown',createdAt:importedAt,modifiedAt:importedAt,description,notes:'',order:0});
 const sourceRecord=(characterId,row,baseCol,descCol,awardCol,dateCol)=>{
  const address=baseCol+row,description=cell(descCol+row)?.value??'',base=exact(address),awarded=exact(awardCol+row);
  return {characterId,row,baseCell:address,descriptionCell:descCol+row,awardedCell:awardCol+row,dateCell:dateCol+row,originalDescription:description,originalInputValue:cell(address)?.value??null,originalBaseXp:base,originalAdjustedXp:awarded,cachedAdjustedXp:cell(awardCol+row)?.value??null,originalFormula:cell(address)?.formula??null,adjustedFormula:cell(awardCol+row)?.formula??null,recordedDate:cell(dateCol+row)?.excelDate??null};
 };
 const definitions=[{id:'diemer',base:'C',desc:'D',award:'E',date:'B',baseline:'F2',conversion:'1.10',end:190},{id:'callista',base:'I',desc:'J',award:'K',date:'H',baseline:'M2',conversion:'1.25',end:1000}];
 for(const def of definitions){
  const seq=[],firstDate=cell(def.date+'4')?.excelDate;if(!firstDate)throw new Error('First source date missing');let anchor=firstDate;
  const id='legacy-opening-'+def.id,amount=number(exact(def.baseline));
  const opening={...common(id,firstDate,def.id==='diemer'?'Diemer — opening XP from workbook':'Callista — opening XP from workbook'),type:'adjustment',method:'setAdjusted',reason:'Preserve the workbook opening adjusted XP and original conversion scale.',allocations:[{characterId:def.id,amount,conversionMultiplier:str(def.conversion),baseXp:str(div(exact(def.baseline),def.conversion))}],source:{workbookSha256:source.sha256,sheet:'Experience',references:[def.baseline],records:[]},reviewFlags:['unknown-date']};
  opening.notes=`Original ${def.baseline}: ${amount} adjusted XP at ${def.conversion}×. Current bonuses apply retroactively. Stored date ${firstDate} is only an ordering anchor; opening balance predates the first recorded award.`;
  nodes.set(id,{event:opening,rank:2});seq.push(id);issue(id,def.id,'date',def.baseline,'Opening date not recorded; anchored before the first dated award.');
  for(let row=4;row<=def.end;row++){
   if(cell(def.date+row)?.excelDate)anchor=cell(def.date+row).excelDate;
   const baseCell=cell(def.base+row),desc=String(cell(def.desc+row)?.value??'');
   if(baseCell?.type!=='number'&&!desc.trim())continue;
   if(!baseCell&&!desc.trim())continue;
   if(row>=135&&def.id==='callista')throw new Error('Post-book rows now contain data. Review their recorded multiplier before migrating.');
   const record=sourceRecord(def.id,row,def.base,def.desc,def.award,def.date);records.push(record);
   const split=baseCell?.split??null,original=record.originalBaseXp;
   const mergeKey=split?JSON.stringify([desc.trim().toLowerCase(),split,anchor]):null;
   let existing=mergeKey?used.get(mergeKey)?.find(event=>!event.allocations.some(a=>a.characterId===def.id)):null;
   let event;
   if(existing){event=existing;event.allocations.push({characterId:def.id,baseXp:original});event.source.records.push(record);event.source.references.push(record.baseCell);if(record.recordedDate){event.dateStatus='recorded';event.sourceDate=record.recordedDate;}}
   else{
    const eventId='legacy-'+def.id+'-'+row;
    event={...common(eventId,anchor,desc.trim()||`Unlabelled historical award (${def.id}, row ${row})`),type:'award',categoryId:'legacy-workbook',inputValue:split?split.inputValue:number(original),multiplier:split?split.multiplier:1,distribution:split?'shared':'individual',divisor:split?split.divisor:null,unit:'XP',itemDescription:'',treasureKey:null,allocations:[{characterId:def.id,baseXp:original}],source:{workbookSha256:source.sha256,sheet:'Experience',references:[record.baseCell],records:[record]},reviewFlags:[]};
    if(record.recordedDate){event.dateStatus='recorded';event.sourceDate=record.recordedDate;}
    if(split){if(!used.has(mergeKey))used.set(mergeKey,[]);used.get(mergeKey).push(event);}
    nodes.set(eventId,{event,rank:row});
   }
   if(!desc.trim()){if(!event.reviewFlags.includes('missing-description'))event.reviewFlags.push('missing-description');issue(event.id,def.id,'description',record.descriptionCell,'Source description is blank; a neutral placeholder is displayed.');}
   if(!record.recordedDate)issue(event.id,def.id,'date',record.dateCell,'No date recorded for this recipient; source order and preceding date anchor retained.');
   if(split&&split.multiplier!==1){if(!event.reviewFlags.includes('source-factor-meaning'))event.reviewFlags.push('source-factor-meaning');issue(event.id,def.id,'multiplier',record.baseCell,'The original multiplication factor is preserved exactly. The workbook does not label whether it represents extra shares or an XP conversion rate.');}
   if(baseCell?.formula&&/ROUND/i.test(baseCell.formula)){event.reviewFlags.push('rounded-source-allocation');issue(event.id,def.id,'allocation',record.baseCell,'Original rounded share amount is retained; it is not recomputed with current category defaults.');}
   if(cmp(awardAllocations(event).find(a=>a.characterId===def.id).baseXp,original)!==0)throw new Error('Exact source allocation mismatch at '+record.baseCell);
   seq.push(event.id);
  }
  sequences.set(def.id,seq);
 }
 const bookId='legacy-magic-book-callista',bookDate=nodes.get(sequences.get('callista').at(-1)).event.date;
 const book={...common(bookId,bookDate,'Magic book — Callista XP reset'),type:'adjustment',method:'setAdjusted',reason:'Workbook explicitly sets a new post-magic-book total of 1,237,500 adjusted XP at M6/M8.',notes:`Book date is not recorded. The reset is placed after the last pre-book row I134 and before the future range K135:K1000, as specified by M8. Stored date ${bookDate} is an ordering anchor only.`,allocations:[{characterId:'callista',amount:1237500,conversionMultiplier:'3/2',baseXp:'825000/1'}],source:{workbookSha256:source.sha256,sheet:'Experience',references:['M6','M7','M8'],records:[],originalFormula:cell('M8').formula},reviewFlags:['unknown-date']};
 nodes.set(bookId,{event:book,rank:1001});sequences.get('callista').push(bookId);issue(bookId,'callista','date','M6:M8','Book date absent; source formula places the reset after row 134.');
 // Topological ordering preserves each independent column's source sequence after shared-event merging.
 const incoming=new Map([...nodes.keys()].map(id=>[id,new Set()])),outgoing=new Map([...nodes.keys()].map(id=>[id,new Set()]));
 for(const sequence of sequences.values())for(let i=1;i<sequence.length;i++){const a=sequence[i-1],b=sequence[i];if(a!==b){incoming.get(b).add(a);outgoing.get(a).add(b);}}
 const pending=new Set(nodes.keys());let order=0;
 while(pending.size){const ready=[...pending].filter(id=>incoming.get(id).size===0).sort((a,b)=>nodes.get(a).event.date.localeCompare(nodes.get(b).event.date)||nodes.get(a).rank-nodes.get(b).rank||a.localeCompare(b));if(!ready.length)throw new Error('Shared-event merging introduced inconsistent source order');const id=ready[0],event=nodes.get(id).event;event.order=order++;
  if(event.dateStatus==='unknown'&&!event.reviewFlags.includes('unknown-date'))event.reviewFlags.push('unknown-date');
  if(event.type==='award'){event.notes='Historical base award preserved exactly. Category defaults were not applied. Original adjusted awards and formulas remain in source metadata.';if(event.dateStatus==='unknown')event.notes+=' Event date was not recorded; stored date is only a source-order anchor.';}
  c.events.push(event);pending.delete(id);for(const child of outgoing.get(id))incoming.get(child).delete(id);
 }
 const replay=replayCampaign(c),bookHistory=replay.history.find(h=>h.eventId===bookId).entries[0];
 const controls=[{characterId:'diemer',cell:'F4',expected:exact('F4'),actual:replay.characters.find(x=>x.characterId==='diemer').adjustedXpExact},{characterId:'callista',cell:'M5',expected:exact('M5'),actual:bookHistory.before.adjustedXpExact},{characterId:'callista',cell:'M8',expected:exact('M8'),actual:replay.characters.find(x=>x.characterId==='callista').adjustedXpExact}];
 for(const check of controls){check.matches=cmp(check.actual,check.expected)===0;check.cachedValue=cell(check.cell).value;check.rounded=round(check.expected,c.settings.rounding);if(!check.matches)throw new Error('Reconciliation failed at '+check.cell);}
 issue(null,'diemer','wisdom','F5','Wisdom score absent. Keep it unknown; enable the documented legacy Wisdom bonus explicitly.');
 issue('legacy-diemer-132','diemer','allocation','C132 / I133','Dragon-parts XP differs: Diemer retains 42370/7; Callista retains the entered 6052. Do not normalize away this source difference.');
 issue('legacy-diemer-131','diemer','source-value','C131 / L11','Currency split formula uses 23781; side workings use 23871. Preserve the recorded XP award and flag the 90-gp discrepancy for review.');
 const summary={source:{filename:source.filename,sha256:source.sha256,sheet:'Experience'},importedAt,campaignId:c.id,eventCount:c.events.length,sourceAwardRows:records.length,sharedEventCount:c.events.filter(e=>e.distribution==='shared').length,unknownEventDates:c.events.filter(e=>e.dateStatus==='unknown').length,blankDescriptions:records.filter(r=>!r.originalDescription.trim()).length,controls,reviewItems:issues,excludedAreas:[{range:'Experience!Q:U',reason:'Separate Frolic ledger, outside the requested two-character migration. Source retained. U4 excludes the later Purple worm row R91/T91.'},{range:'Experience!W:AE',reason:'Treasure valuation/split workings, not additional awards. Importing again would duplicate XP already entered in the character ledgers.'},{range:'Gold',reason:'Empty worksheet.'}],status:'reconciled-with-review-items'};
 c.migration={source:summary.source,importedAt,status:summary.status,reviewItemCount:issues.length,reviewFile:'migration/review.csv',reportFile:'migration/report.md',notes:'Unknown dates are ordering anchors, not invented session dates. Original per-recipient values/formulas remain attached to events.'};
 replayCampaign(c);return {campaign:c,summary};
}
export function migrationReport(summary){const lines=['# Workbook migration reconciliation','',`Source: ${summary.source.filename}, Experience worksheet. SHA-256: ${summary.source.sha256}.`,'','Status: all three XP controls reconcile exactly. Historical dates and source gaps remain labelled for review.','','| Character / control | Workbook XP, rounded | Imported XP, rounded | Difference |','| --- | ---: | ---: | ---: |',...summary.controls.map(x=>`| ${x.characterId} / ${x.cell}${x.cell==='M5'?' (pre-book)':''} | ${x.rounded.toLocaleString('en-US')} | ${round(x.actual).toLocaleString('en-US')} | 0 |`),'',`Imported ${summary.sourceAwardRows} source award rows into ${summary.eventCount} events, including ${summary.sharedEventCount} explicit shared-pool events and three baseline/reset events.`,`${summary.unknownEventDates} events have no recorded date. ${summary.blankDescriptions} source award descriptions are blank.`,'','## Preserved calculations','','- Diemer: F2 opening 185,117 adjusted XP at 1.10× is retained as an exact base conversion. F5 explicitly normalizes it to 1.25×. Current multiplier remains 1.25×.','- Callista: M2 opening 257,207 adjusted XP is already on the 1.25× scale in M4. M5 applies 1.50× retroactively; its exact pre-book result is 912,820.15 XP.','- Callista: M6/M8 explicitly reset adjusted XP to 1,237,500 after the magic book. This is 825,000 base XP at 1.50×. Earlier awards stay visible but cannot change the later reset.','- Historical raw awards and the E/K adjusted awards remain in source metadata. Current category defaults are never applied. Old magic-item XP is retained.','- Arithmetic shared splits are reconstructed, including the recorded 5.5-share divisor. An unlabelled multiplication factor is preserved and flagged for meaning review rather than silently reinterpreted. Original rounded share awards stay as recorded.','- Per-character row order is preserved by deterministic ordering, including when two source rows become one shared event.','','## Review items','','Dates are sparse: the recorded sessions are 2022-12-03, 2022-12-10 and 2023-02-18. All other event dates are explicitly unknown; the last recorded date is used only as an internal sorting anchor. No claim is made that the later events occurred in February 2023.','','Diemer’s Wisdom score is unknown. The bonus is enabled explicitly from the original conversion formula, without inventing a score. Callista’s Wisdom 19 comes from campaign context; her current +50% is supported by M5. Named bonuses are enabled to preserve the sheet’s existing retroactive bonus state.','','Dragon-parts awards differ in the source: Diemer 6,052.857142857… base XP (C132), Callista 6,052 (I133). Both are retained. C131 uses 23,781 in the currency split while side calculations use 23,871. No silent correction is made.','','Blank descriptions use neutral placeholders; their original empty cells remain in source records. See review.csv for all per-cell review entries.','','## Excluded to avoid double-counting','',...summary.excludedAreas.map(x=>`- ${x.range}: ${x.reason}`),'','The complete extracted workbook, including shared-formula expansions and cached values, is retained as source-workbook.json.gz (gzip-compressed JSON) in this private migration folder. The original workbook is unchanged.',''];return lines.join('\n');}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const [sourcePath,starterPath,outputDir]=process.argv.slice(2);if(!outputDir)throw new Error('Usage: node migrate-workbook.mjs extracted.json starter.json output-dir');
 const result=migrateWorkbook(JSON.parse(readFileSync(sourcePath,'utf8')),importJSON(readFileSync(starterPath,'utf8')));mkdirSync(outputDir,{recursive:true});writeFileSync(outputDir+'/campaign.json',exportJSON(result.campaign));writeFileSync(outputDir+'/reconciliation.json',JSON.stringify(result.summary,null,2)+'\n');writeFileSync(outputDir+'/report.md',migrationReport(result.summary));
 const csvCell=x=>'"'+String(x??'').replaceAll('"','""')+'"';writeFileSync(outputDir+'/review.csv',[['eventId','characterId','field','reference','message'],...result.summary.reviewItems.map(x=>[x.eventId,x.characterId,x.field,x.reference,x.message])].map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n');
 console.log(JSON.stringify({events:result.summary.eventCount,sourceAwardRows:result.summary.sourceAwardRows,sharedEvents:result.summary.sharedEventCount,unknownDates:result.summary.unknownEventDates,blankDescriptions:result.summary.blankDescriptions,controls:result.summary.controls},null,2));
}
