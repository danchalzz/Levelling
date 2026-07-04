// ============================================================
// SERVER.JS — The Engine
// This file does 4 things:
//   1. Connects to your Neon database
//   2. Serves your dashboard (public — anyone with the link can view)
//   3. Handles loading data (public)
//   4. Handles saving data (only allowed once YOU log in with your password)
// ============================================================

import express from 'express';
import session from 'express-session';
import { neon } from '@neondatabase/serverless';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const PORT = process.env.PORT || 3000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicPath = path.join(__dirname, 'public');

// --- REQUIRED SECRETS ---
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL is not set. Please add it in Railway → Variables.');
  process.exit(1);
}
if (!process.env.ADMIN_PASSWORD) {
  console.error('❌ ADMIN_PASSWORD is not set. Please add it in Railway → Variables.');
  process.exit(1);
}
if (!process.env.SESSION_SECRET) {
  console.error('❌ SESSION_SECRET is not set. Please add it in Railway → Variables (any long random string).');
  process.exit(1);
}

const db = neon(process.env.DATABASE_URL);

// --- SETUP ---
async function setupDatabase() {
  await db`
    CREATE TABLE IF NOT EXISTS system_state (
      id INTEGER PRIMARY KEY DEFAULT 1,
      state JSONB NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  console.log('✅ Database ready');
}

// --- MIDDLEWARE ---
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    httpOnly: true,
    secure: true,       // Railway serves over HTTPS
    sameSite: 'lax'
  }
}));

// Everything in public/ (the dashboard itself) is visible to anyone with the link.
app.use(express.static(publicPath));

app.get('/', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

// ============================================================
// AUTH ROUTES
// ============================================================

// The frontend calls this on load to decide whether to show edit
// controls (you) or read-only mode (everyone else).
app.get('/api/auth-status', (req, res) => {
  res.json({ authenticated: !!(req.session && req.session.authenticated) });
});

app.post('/api/login', (req, res) => {
  const { password } = req.body;
  if (password === process.env.ADMIN_PASSWORD) {
    req.session.authenticated = true;
    return res.json({ success: true });
  }
  res.status(401).json({ error: 'Incorrect password' });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

// ============================================================
// DATA ROUTES
// ============================================================

// LOAD DATA — public. Anyone visiting the link can see the dashboard.
app.get('/api/state', async (req, res) => {
  try {
    const rows = await db`SELECT state FROM system_state WHERE id = 1`;
    if (rows.length === 0) {
      return res.json({ state: null });
    }
    res.json({ state: rows[0].state });
  } catch (err) {
    console.error('Error loading state:', err);
    res.status(500).json({ error: 'Could not load data' });
  }
});

// SAVE DATA — protected. Only works if you're logged in as the owner.
// (The frontend also hides/disables edit controls for guests, but this
// server-side check is what actually stops someone from saving changes
// even if they tried to call the API directly.)
app.post('/api/state', async (req, res) => {
  if (!req.session || !req.session.authenticated) {
    return res.status(401).json({ error: 'Login required to save changes' });
  }

  try {
    const newState = req.body.state;
    if (!newState || typeof newState !== 'object') {
      return res.status(400).json({ error: 'state object required' });
    }

    const stateJson = JSON.stringify(newState);
    await db`
      INSERT INTO system_state (id, state, updated_at)
      VALUES (1, ${stateJson}::jsonb, NOW())
      ON CONFLICT (id) DO UPDATE
        SET state = ${stateJson}::jsonb, updated_at = NOW()
    `;

    res.json({ success: true });
  } catch (err) {
    console.error('Error saving state:', err);
    res.status(500).json({ error: 'Could not save data' });
  }
});

// ============================================================
// START
// ============================================================
setupDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 SYSTEM online at http://localhost:${PORT}`);
  });
});
