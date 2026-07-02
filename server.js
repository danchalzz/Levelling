// ============================================================
// SERVER.JS — The Engine
// This file does 3 things:
//   1. Connects to your Neon database
//   2. Serves your dashboard (the HTML/JS files)
//   3. Handles saving and loading your data
// ============================================================

import express from 'express';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const app = express();
const PORT = process.env.PORT || 3000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --- DATABASE CONNECTION ---
// This reads the DATABASE_URL secret you set in Railway.
// It connects to your Neon database automatically.
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// --- SETUP ---
// This makes sure the data table exists in your database when the app starts.
async function setupDatabase() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS system_state (
      id INTEGER PRIMARY KEY DEFAULT 1,
      state JSONB NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  console.log('✅ Database ready');
}

// --- MIDDLEWARE ---
// These two lines allow the server to read JSON data and serve your public files.
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================
// API ROUTES — How the frontend talks to the backend
// ============================================================

// LOAD DATA — Called when you open the app
// The frontend asks: "GET /api/state" → server returns your saved data
app.get('/api/state', async (req, res) => {
  try {
    const result = await db.query('SELECT state FROM system_state WHERE id = 1');

    if (result.rows.length === 0) {
      // No data yet — return empty defaults
      return res.json({ quests: [], daily: {}, totalXP: 0, log: [], dismissedNotifs: [] });
    }

    res.json(result.rows[0].state);
  } catch (err) {
    console.error('Error loading state:', err);
    res.status(500).json({ error: 'Could not load data' });
  }
});

// SAVE DATA — Called whenever you make a change
// The frontend sends: "POST /api/state" with your new data → server saves it to Neon
app.post('/api/state', async (req, res) => {
  try {
    const newState = req.body;

    await db.query(`
      INSERT INTO system_state (id, state, updated_at)
      VALUES (1, $1, NOW())
      ON CONFLICT (id) DO UPDATE
        SET state = $1, updated_at = NOW()
    `, [JSON.stringify(newState)]);

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
