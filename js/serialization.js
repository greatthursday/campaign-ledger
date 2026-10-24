// Portable, pure data operations. No network, filesystem, or browser dependencies.
import {assertCampaign} from './validation.js';
import {replayCampaign,compareEvents} from './xp-engine.js';
export function exportJSON(c){replayCampaign(c);return JSON.stringify(c,null,2)+'\n';}
export function importJSON(text){const c=JSON.parse(text);assertCampaign(c);replayCampaign(c);return c;}
function cell(v){const s=String(v??'');return '"'+s.replaceAll('"','""')+'"';}
// Prefix text beginning with spreadsheet formula characters to prevent CSV formula execution.
const safeText=v=>/^[\s]*[=+\-@]/.test(String(v))?"'"+v:v;
export function exportCSV(c){
 const replay=replayCampaign(c);const rows=[['eventId','date','description','categoryId','type','method','characterId','characterName','inputValue','unit','multiplier','distribution','divisor','allocationBaseXp','beforeAdjustedXp','afterAdjustedXp','reason','notes']];
 const history=new Map(replay.history.map(e=>[e.eventId,e]));
 for(const e of [...c.events].sort(compareEvents))for(const a of e.allocations){const h=history.get(e.id).entries.find(x=>x.characterId===a.characterId);const ch=c.characters.find(x=>x.id===a.characterId);rows.push([safeText(e.id),e.date,safeText(e.description),safeText(e.categoryId),e.type,e.method,safeText(ch.id),safeText(ch.name),e.inputValue??a.amount,safeText(e.unit),e.multiplier??a.conversionMultiplier,e.distribution,e.divisor,a.baseXp,h.before.adjustedXp,h.after.adjustedXp,safeText(e.reason),safeText(e.notes)]);}
 return rows.map(r=>r.map(cell).join(',')).join('\r\n')+'\r\n';
}
