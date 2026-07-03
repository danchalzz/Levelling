// ============================================================
// SERVER.JS — The Engine
// This file does 3 things:
//   1. Connects to your Neon database
//   2. Serves your dashboard (the HTML/JS files)
//   3. Handles saving and loading your data
// ============================================================

import express from 'express';
import { neon } from '@neondatabase/serverless';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const PORT = process.env.PORT || 3000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicPath = path.join(__dirname, 'public');

// --- DATABASE CONNECTION ---
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL is not set. Please add it in Railway → Variables.');
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
app.use(express.static(publicPath));

app.get('/', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

// ============================================================
// API ROUTES
// ============================================================

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

app.post('/api/state', async (req, res) => {
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
