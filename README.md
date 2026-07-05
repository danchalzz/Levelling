[README.md](https://github.com/user-attachments/files/29682730/README.md)
# DEE-SYSTEM v2 — Deploy Notes

## What changed from before
Real login + view-only, built into the actual app this time (not bolted on):
- Anyone with the link can view your dashboard (`👁 VIEW ONLY` banner, all controls disabled).
- Only you can edit — after logging in with `🔒 Login` (top of the page), edit controls unlock and changes save.
- Enforced on the server too: `POST /api/state` returns 401 without a valid session, so a guest can't save by calling the API directly either.

## Files in this folder
- `server.js` — Express backend (auth, session, Neon, serves the built frontend)
- `package.json` — backend dependencies
- `public/` — the already-built frontend (index.html + assets/) — do not edit these by hand

## Deploy steps
1. Upload **all files in this folder** to your GitHub repo root (replacing everything), keeping `public/` as a subfolder — don't flatten it.
2. In Railway → your service → Variables, confirm these are set:
   - `DATABASE_URL` (already set)
   - `ADMIN_PASSWORD` — pick a real password, this is what unlocks editing
   - `SESSION_SECRET` — any long random string (doesn't need to be memorable)
3. Redeploy.
4. Test as a guest: open the live URL in an incognito window. You should see the `VIEW ONLY` banner and disabled buttons.
5. Test as yourself: click `🔒 Login`, enter `ADMIN_PASSWORD`, confirm edit controls unlock and a change you make actually persists after a reload.

## Note on sessions
Sessions are stored in memory, so logging back in after a redeploy/restart is expected — that's normal and only affects you, not guests (they were never logged in).
