import {importJSON,exportJSON} from './serialization.js';
const KEY='campaign-ledger.local.v1';
export function loadLocal(storage){const text=storage.getItem(KEY);return text===null?null:importJSON(text);}
export function saveLocal(storage,campaign){storage.setItem(KEY,exportJSON(campaign));}
