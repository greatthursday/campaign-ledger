import {normalizeGitHubConfig} from './github-storage.js';
const KEY='campaign-ledger.github-config.v1';
export const DEFAULT_GITHUB_CONFIG=Object.freeze({owner:'greatthursday',repo:'campaign-ledger-data',branch:'main',path:'campaign.json'});
export function loadConnectionSettings(storage){const text=storage.getItem(KEY);return text?normalizeGitHubConfig(JSON.parse(text)):{...DEFAULT_GITHUB_CONFIG};}
// Only whitelisted target fields are persisted. Credentials/SHA are never stored here.
export function saveConnectionSettings(storage,config){storage.setItem(KEY,JSON.stringify(normalizeGitHubConfig(config)));}
