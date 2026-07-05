import express from 'express';
import session from 'express-session';
import path from 'path';
import { fileURLToPath } from 'url';
import { neon } from '@neondatabase/serverless';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const { DATABASE_URL, ADMIN_PASSWORD, SESSION_SECRET, PORT } = process.env;

if (!DATABASE_URL || !ADMIN_PASSWORD || !SESSION_SECRET) {
  console.error('Missing required env vars: DATABASE_URL, ADMIN_PASSWORD, SESSION_SECRET must all be set.');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function ensureTable() {
  await sql`CREATE TABLE IF NOT EXISTS system_state (
    id INT PRIMARY KEY,
    data JSONB
  )`;
  console.log('✅ Database ready');
}

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 30 // 30 days
  }
}));

// --- Auth routes ---
app.post('/api/login', (req, res) => {
  const { password } = req.body || {};
  if (password && password === ADMIN_PASSWORD) {
    req.session.authenticated = true;
    return res.json({ ok: true });
  }
  return res.status(401).json({ ok: false });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/auth-status', (req, res) => {
  res.json({ authenticated: !!(req.session && req.session.authenticated) });
});

// --- State routes ---
app.get('/api/state', async (req, res) => {
  try {
    const rows = await sql`SELECT data FROM system_state WHERE id = 1`;
    res.json({ state: rows[0]?.data || null });
  } catch (err) {
    console.error('GET /api/state error', err);
    res.status(500).json({ error: 'Failed to load state' });
  }
});

function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) return next();
  return res.status(401).json({ error: 'Not authenticated' });
}

app.post('/api/state', requireAuth, async (req, res) => {
  const { state } = req.body || {};
  if (!state) return res.status(400).json({ error: 'Missing state' });
  try {
    await sql`
      INSERT INTO system_state (id, data) VALUES (1, ${JSON.stringify(state)}::jsonb)
      ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data
    `;
    res.json({ ok: true });
  } catch (err) {
    console.error('POST /api/state error', err);
    res.status(500).json({ error: 'Failed to save state' });
  }
});

// --- Static frontend ---
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const port = PORT || 8080;
ensureTable().then(() => {
  app.listen(port, () => console.log(`🚀 SYSTEM online at http://localhost:${port}`));
});
