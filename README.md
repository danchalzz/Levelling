[README.md](https://github.com/user-attachments/files/30159544/README.md)
# DEE-SYSTEM v2.2 — Deploy Notes

## What's in this version
- Real login + view-only, enforced server-side.
- Faithful visual recreation matching the original design (extracted from the real compiled CSS you sent): glowing outlined cards, pulse-border notification, danger-quest pulse animation, exact colors/fonts/spacing.

## Files in this folder
- `server.js` — Express backend (auth, session, Neon, serves the built frontend)
- `package.json` — backend dependencies
- `public/` — the already-built frontend (index.html + assets/) — do not edit these by hand

## Deploy steps
1. Upload **all files in this folder** to your GitHub repo root (replacing everything), keeping `public/` as a subfolder.
2. In Railway → your service → Variables, confirm these are set:
   - `DATABASE_URL`
   - `ADMIN_PASSWORD`
   - `SESSION_SECRET`
3. Redeploy.
4. Test as a guest (incognito): should see `VIEW ONLY` banner, disabled controls.
5. Test as yourself: `🔒 Login`, confirm edits save and persist after reload.

## Note
Sessions are stored in memory, so your own login resets on redeploy/restart — normal, doesn't affect guests.
