# Animal ID App — Project Dashboard

A Kanban board for the two-person launch sprint (Navid + Mehrdad), backed by a
Google Sheet acting as the database.

## Login
- `Navid` / `Navid@2026`
- `Mehrdad` / `Mehrdad@2026`

**Note:** this is a client-side gate only — the page source (and these
passwords) is visible to anyone with the link. It keeps casual visitors out;
it is not real access control. Don't put sensitive data on this board.

## Connecting the live Google Sheet (one-time, ~3 minutes)

The board ships with the task list baked in (`seed_data.json`) so it works
immediately. To make edits sync between both of you through the Google Sheet,
do this once:

1. Open the Sheet: **Animal ID App — PM Tasks DB**
   https://docs.google.com/spreadsheets/d/1OcWDNFY3x1x2hDqeJ4LpdizVPg1_i_9Xt22nO1Cn19Y/edit
2. In the Sheet, go to **Extensions → Apps Script**.
3. Delete anything in `Code.gs` and paste the contents of
   [`AppsScript_Code.gs`](./AppsScript_Code.gs) from this repo.
4. Click **Deploy → New deployment → Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone with the link**
   - Click **Deploy**, authorize the requested Google permissions (it's your
     own script touching your own sheet).
5. Copy the **Web app URL** it gives you (ends in `/exec`).
6. In this repo, open `app.js` and set:
   ```js
   const APPS_SCRIPT_URL = "PASTE_YOUR_URL_HERE";
   ```
7. Commit and push. The dashboard now reads/writes the Sheet live, and polls
   every 20 seconds so you both see each other's changes.

Until step 6 is done, drag-and-drop still works but is saved only in your own
browser (`localStorage`), not shared with your teammate.

## Editing the task list
Add/edit rows directly in the Google Sheet — columns:
`id, phase, category, title, description, owner, status, due, notes`.
`status` must be one of `To Do`, `Waiting`, `Done`.
`phase` must be `1`, `2`, or `3`.

## Structure
- `index.html` — layout & login screen
- `app.js` — all logic (auth, data fetch, rendering, drag & drop)
- `seed_data.json` — offline fallback / first-load data, generated from the plan
- `AppsScript_Code.gs` — paste into the Google Sheet's Apps Script editor
