# GitHub campaign persistence

Phase 3 implements explicit browser-to-GitHub load/save with no backend or paid database. The application source and private campaign data use separate repositories.

## Repository setup

1. Create a **private** repository named `campaign-ledger-data` under `greatthursday`.
2. Add a README to initialize its `main` branch.
3. If ChatGPT will initialize the data file for you, grant its GitHub integration access to this new repository. This connection is separate from the token used by the finished browser app.
4. Initialize `campaign.json` from `data/empty-campaign.json` in this source repository. That starter has no characters, historical awards or migrated XP balances. Alternatively, import your validated campaign backup in the app and create a new remote file from it.

Do not use the source repository (`greatthursday/campaign-ledger`) as a campaign data target. The adapter rejects that target and rejects public data repositories.

## Fine-grained token

When the website is available, create a token through GitHub Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token.

- Resource owner: `greatthursday`.
- Repository access: Only select repositories → `campaign-ledger-data`.
- Repository permissions: Contents → Read and write. GitHub includes Metadata read access as needed.
- Choose an expiration suitable for your usage. A new token can be generated when the old one expires; campaign history remains in GitHub.

Enter the token **only into the app's password field**, never in a chat, campaign JSON, source file, or issue. It stays in a private JavaScript object in memory. The form is cleared when submitted. Reloading the page requires entering a token again. Disconnect clears the active token without discarding the open campaign. A password manager is an option for your own token storage; the app itself does not persist it.

## Connect in the application

Open Settings → GitHub campaign saving. Defaults:

| Field | Value |
| --- | --- |
| Repository owner | `greatthursday` |
| Private data repository | `campaign-ledger-data` |
| Branch | `main` |
| Campaign JSON path | `campaign.json` |

Enter the fine-grained token, then Connect & load. Existing remote data is fully validated before replacing the open view. If it differs, the app asks before replacing the view. If local edits occur during the request, loading stops instead of discarding them.

If the repository exists but the file does not, Create initializes a new file after confirmation. Initializing never overwrites an existing file. The app explicitly warns when creating from illustrative sample data. A mistyped/nonexistent branch can also cause a missing-file response; correct the branch instead of creating a new one.

## Save and use another device

Edit profiles/events/settings, then use **Save to GitHub**. One click commits the complete campaign. Events do not generate automatic commits. A successful remote load/save also attempts to update the device backup. If you edit while a save is in flight, the submitted snapshot is saved and newer edits remain marked uncommitted.

On another device, use the same target settings, enter a token, and load before editing. The app remembers only owner/repository/branch/path in browser storage. It never remembers a remote version SHA across a page reload; a successful load is required before updating an existing file.

**Save on device** is independent: it does not commit to GitHub and does not clear the remote unsaved indicator. JSON exports are lossless complete backups; CSV exports are for spreadsheet review. GitHub connection details and tokens are not inserted into campaign records or backups.

## Conflicts and failures

Before updating, the adapter reads the current file version and compares its SHA to the version last loaded/saved. It then includes that same SHA in the PUT request. This catches both a change made earlier by another device and a race occurring after the preflight check. A missing/deleted file is also a conflict; it is not silently recreated.

When a conflict appears:

1. Export your local JSON so your edits remain available.
2. Load the remote version, explicitly confirming replacement of the open view.
3. Review/reapply the intended changes, then save again.

There is no automatic merge or force-overwrite option. Importing a different campaign ID disconnects the old remote association. A backup of the same campaign can be deliberately restored as a new commit after loading the current remote version and importing the backup.

Expired/revoked tokens, denied permission, rate limits, invalid JSON, wrong targets, and network failures preserve local data. A lost save response is marked **uncertain** because the commit may have succeeded. The adapter retains its old SHA and does not retry writes automatically. Export JSON and check/load the remote before continuing.

## Public storage API

`js/github-storage.js` exports `GitHubStorage`, `StorageError`, `normalizeGitHubConfig`, `encodeContent`, `decodeContent`, plus the existing `validateCampaign`, `exportJSON`, `importJSON`, and `exportCSV` functions.

```js
import {GitHubStorage} from './js/index.js';
const client = new GitHubStorage({owner, repo, branch: 'main', path: 'campaign.json'}, token);
const {campaign, sha} = await client.loadCampaign();
const {sha: newSha, commitSha} = await client.saveCampaign(editedCampaign);
client.disconnect();
```

`initializeCampaign(campaign)` only creates absent files. `fork()` creates an isolated loading session for the same target, without exposing the token; cancelling a reload cannot update the active save anchor. `config` returns a copy of the target fields. `loaded` and `sha` expose non-secret session state. Concurrent operations on one client are blocked. Fetch injection supports deterministic automated tests without live credentials.

## Scope and verification

The adapter uses GitHub.com's REST Contents API, version 2022-11-28, with no-store requests, omitted cookies, no referrer, and refused redirects. Token-bearing requests go only to the fixed `https://api.github.com` origin. Campaign files are capped at **1 MiB** in this version so the normal Contents API always returns supported base64 content. Larger histories require an adapter extension or separate archived campaign files; they remain exportable as JSON.

Automated tests use a simulated GitHub server to exercise successful updates, conflicts, races, uncertain commits, public-repository rejection, malformed data, secret-free settings and Unicode. A real PAT-based roundtrip is not claimed until the data repository and a user-entered token are available in the app.

The website is not deployed in this phase. Workbook migration is still pending.

## Official references

- GitHub Contents API: https://docs.github.com/en/rest/repos/contents
- Fine-grained personal access tokens: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens
