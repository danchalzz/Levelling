// ============================================================
// APP.JS — The Brain of the Frontend
// This file does 4 things:
//   1. Loads your data from the server when you open the page
//   2. Draws all the quests, stats, logs etc on screen
//   3. Handles clicks (add quest, mark done, delete etc)
//   4. Saves any changes back to the server automatically
// ============================================================


// --- STATE ---
// This is the data currently loaded in memory (in the browser).
// When you change something, we update this, then save it to the server.
let state = {
  quests: [],
  daily: {},
  dailyDate: '',
  totalXP: 0,
  log: [],
  dismissedNotifs: []
};

// Tracks which quest is being edited (null = creating a new one)
let editingQuestId = null;


// ============================================================
// SECTION 1 — TALKING TO THE SERVER
// These two functions handle all communication with server.js
// ============================================================

// Load data from server (called once on page load)
async function loadState() {
  try {
    const res = await fetch('/api/state');
    const data = await res.json();
    if (data && data.quests) {
      state = data;
    }
  } catch (err) {
    console.error('Could not load data from server:', err);
  }
  renderAll();
}

// Save data to server (called after every change)
async function saveState() {
  try {
    await fetch('/api/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state)
    });
  } catch (err) {
    console.error('Could not save data to server:', err);
  }
}


// ============================================================
// SECTION 2 — RENDERING (Drawing things on screen)
// Each render function handles one part of the page.
// ============================================================

function renderAll() {
  renderXP();
  renderStats();
  renderQuests();
  renderDaily();
  renderLog();
}

// Draw the XP bar at the top
function renderXP() {
  const xpPerRank = 500;
  const currentXP = state.totalXP || 0;
  const percent = Math.min((currentXP % xpPerRank) / xpPerRank * 100, 100);

  document.getElementById('xp-fill').style.width = percent + '%';
  document.getElementById('xp-value').textContent =
    currentXP + ' XP · E · next at ' + (Math.floor(currentXP / xpPerRank) + 1) * xpPerRank;
}

// Draw the 6 stat boxes
function renderStats() {
  const quests = state.quests || [];
  const done  = quests.filter(q => q.status === 'done').length;
  const apps  = quests.filter(q => q.track === 'AI QA' || q.track === 'RECRUIT').length;
  const interviews = quests.filter(q => q.name && q.name.toLowerCase().includes('interview')).length;
  const portfolio  = quests.filter(q => q.track === 'DATA' && q.status === 'done').length;

  document.getElementById('stat-intellect').textContent    = Math.min(done * 3 + 70, 99);
  document.getElementById('stat-adaptability').textContent = Math.min(quests.length * 2 + 50, 99);
  document.getElementById('stat-applications').textContent = apps;
  document.getElementById('stat-interviews').textContent   = interviews;
  document.getElementById('stat-portfolio').textContent    = portfolio;
  document.getElementById('stat-streak').textContent       = getDailyStreak();
}

// Calculate daily streak (how many days in a row you've used the app)
function getDailyStreak() {
  const daily = state.daily || {};
  const today = new Date().toDateString();
  return daily[today] ? '1+' : '0';
}

// Draw all quests grouped by status
function renderQuests() {
  const quests = state.quests || [];

  // Danger alerts at the top
  const danger = quests.filter(q => q.status === 'danger');
  const alertsContainer = document.getElementById('alerts-container');
  alertsContainer.innerHTML = '';
  danger.forEach(q => {
    alertsContainer.innerHTML += `
      <div class="alert-card">
        <div class="alert-title">⚠ SYSTEM NOTIFICATION — PRIORITY ALERT</div>
        <div class="alert-body">${q.name}<br><small style="color:#888">${q.desc}</small></div>
      </div>`;
  });

  renderQuestGroup('danger-quests',  '⚠ DANGER QUESTS — ACT NOW', danger,  'danger');
  renderQuestGroup('active-quests',  '▶ ACTIVE QUESTS — IN PROGRESS', quests.filter(q => q.status === 'active'), 'active');
  renderQuestGroup('pending-quests', '◈ PENDING QUESTS — QUEUED',     quests.filter(q => q.status === 'pending'), 'pending');
  renderQuestGroup('done-quests',    '✓ COMPLETED QUESTS',            quests.filter(q => q.status === 'done'), 'done');
}

// Render one group of quests (e.g. all "active" quests)
function renderQuestGroup(containerId, title, quests, statusClass) {
  const container = document.getElementById(containerId);
  if (quests.length === 0) { container.innerHTML = ''; return; }

  const cards = quests.map(q => `
    <div class="quest-card ${q.status}" data-id="${q.id}">
      <div class="quest-info">
        <div class="quest-name">${q.name}</div>
        <div class="quest-desc">${q.desc}</div>
        <div class="quest-tags">
          <span class="tag">${q.track}</span>
          <span class="tag ${q.status}">${q.status.toUpperCase()}</span>
          ${q.deadline ? `<span class="tag deadline">${q.deadline}</span>` : ''}
        </div>
      </div>
      <div class="quest-actions">
        <button class="btn-edit" onclick="openEditQuest('${q.id}')">EDIT</button>
        ${q.status !== 'done' ? `<button class="btn-status" onclick="markDone('${q.id}')">DONE</button>` : ''}
        <button class="btn-delete" onclick="deleteQuest('${q.id}')">DEL</button>
      </div>
    </div>
  `).join('');

  container.innerHTML = `
    <div class="section-header ${statusClass}">${title} [${quests.length}]</div>
    ${cards}
  `;
}

// Draw daily tasks
function renderDaily() {
  const container = document.getElementById('daily-tasks');
  const daily = state.daily || {};
  const today = new Date().toDateString();
  const tasks = Object.entries(daily).filter(([key]) => !key.startsWith('_'));

  if (tasks.length === 0) {
    container.innerHTML = '<p class="placeholder">No daily tasks yet. Add your first one below.</p>';
    return;
  }

  container.innerHTML = tasks.map(([id, task]) => `
    <div class="daily-task">
      <div class="daily-check ${task.done ? 'checked' : ''}" onclick="toggleDaily('${id}')">
        ${task.done ? '✓' : ''}
      </div>
      <div class="daily-name ${task.done ? 'checked' : ''}">${task.name}</div>
      <button class="btn-delete" onclick="deleteDaily('${id}')">DEL</button>
    </div>
  `).join('');
}

// Draw the activity log
function renderLog() {
  const container = document.getElementById('log-content');
  const log = [...(state.log || [])].reverse(); // newest first

  if (log.length === 0) {
    container.innerHTML = '<p class="placeholder">No activity logged yet.</p>';
    return;
  }

  container.innerHTML = log.map(entry => `
    <div class="log-entry">
      <span class="log-date">${new Date(entry.date).toLocaleString()}</span>
      <span class="log-action">${entry.action}</span>
      <span class="log-detail">${entry.detail || ''}</span>
    </div>
  `).join('');
}


// ============================================================
// SECTION 3 — ACTIONS (Responding to clicks)
// ============================================================

// Mark a quest as done and award XP
function markDone(questId) {
  const quest = state.quests.find(q => q.id === questId);
  if (!quest) return;

  quest.status = 'done';
  state.totalXP = (state.totalXP || 0) + 50; // 50 XP per completed quest

  addLog('Quest Completed', quest.name);
  saveState();
  renderAll();
}

// Delete a quest
function deleteQuest(questId) {
  const quest = state.quests.find(q => q.id === questId);
  if (!quest) return;
  if (!confirm('Delete quest: ' + quest.name + '?')) return;

  state.quests = state.quests.filter(q => q.id !== questId);
  addLog('Deleted Quest', quest.name);
  saveState();
  renderAll();
}

// Toggle a daily task checked/unchecked
function toggleDaily(taskId) {
  if (!state.daily[taskId]) return;
  state.daily[taskId].done = !state.daily[taskId].done;
  saveState();
  renderDaily();
}

// Delete a daily task
function deleteDaily(taskId) {
  delete state.daily[taskId];
  saveState();
  renderDaily();
}

// Add an entry to the activity log
function addLog(action, detail) {
  state.log = state.log || [];
  state.log.push({ date: new Date().toISOString(), action, detail });
  // Keep only last 50 entries
  if (state.log.length > 50) state.log = state.log.slice(-50);
}


// ============================================================
// SECTION 4 — MODAL (Add / Edit Quest popup)
// ============================================================

function openAddQuest() {
  editingQuestId = null;
  document.getElementById('modal-title').textContent = 'NEW QUEST';
  document.getElementById('quest-name').value = '';
  document.getElementById('quest-desc').value = '';
  document.getElementById('quest-track').value = 'AI QA';
  document.getElementById('quest-status').value = 'active';
  document.getElementById('quest-deadline').value = '';
  document.getElementById('modal').classList.remove('hidden');
}

function openEditQuest(questId) {
  const quest = state.quests.find(q => q.id === questId);
  if (!quest) return;

  editingQuestId = questId;
  document.getElementById('modal-title').textContent = 'EDIT QUEST';
  document.getElementById('quest-name').value = quest.name;
  document.getElementById('quest-desc').value = quest.desc;
  document.getElementById('quest-track').value = quest.track;
  document.getElementById('quest-status').value = quest.status;
  document.getElementById('quest-deadline').value = quest.deadline || '';
  document.getElementById('modal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal').classList.add('hidden');
  editingQuestId = null;
}

function saveQuest() {
  const name     = document.getElementById('quest-name').value.trim();
  const desc     = document.getElementById('quest-desc').value.trim();
  const track    = document.getElementById('quest-track').value;
  const status   = document.getElementById('quest-status').value;
  const deadline = document.getElementById('quest-deadline').value.trim();

  if (!name) { alert('Quest name is required.'); return; }

  if (editingQuestId) {
    // Update existing quest
    const quest = state.quests.find(q => q.id === editingQuestId);
    if (quest) {
      quest.name = name;
      quest.desc = desc;
      quest.track = track;
      quest.status = status;
      quest.deadline = deadline;
      addLog('Updated Quest', name);
    }
  } else {
    // Create new quest
    const newQuest = {
      id: 'q' + Date.now(),
      name, desc, track, status, deadline
    };
    state.quests.push(newQuest);
    addLog('Added Quest', name);
  }

  closeModal();
  saveState();
  renderAll();
}


// ============================================================
// SECTION 5 — BACKUP (Export and Import)
// ============================================================

// Export your data as a JSON file you can save on your computer
function exportBackup() {
  const json = JSON.stringify(state, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'system-backup-' + new Date().toISOString().slice(0,10) + '.json';
  a.click();
  URL.revokeObjectURL(url);
}

// Import a backup JSON file and restore your data
function importBackup(file) {
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const imported = JSON.parse(e.target.result);
      if (!imported.quests) throw new Error('Invalid backup file');
      state = imported;
      await saveState();
      renderAll();
      alert('✅ Backup imported successfully!');
    } catch (err) {
      alert('❌ Could not read backup file. Make sure it is a valid JSON backup.');
    }
  };
  reader.readAsText(file);
}


// ============================================================
// SECTION 6 — EVENT LISTENERS
// These connect buttons and tabs to their functions above.
// ============================================================

// Tab switching
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
    tab.classList.add('active');
    document.getElementById('tab-' + tab.dataset.tab).classList.remove('hidden');
  });
});

// Quest modal buttons
document.getElementById('btn-add-quest').addEventListener('click', openAddQuest);
document.getElementById('btn-save-quest').addEventListener('click', saveQuest);
document.getElementById('btn-cancel-quest').addEventListener('click', closeModal);

// Daily task - add new one
document.getElementById('btn-add-daily').addEventListener('click', () => {
  const name = prompt('Daily task name:');
  if (!name || !name.trim()) return;
  const id = 'daily_' + Date.now();
  state.daily[id] = { name: name.trim(), done: false };
  saveState();
  renderDaily();
});

// Backup buttons
document.getElementById('btn-export').addEventListener('click', exportBackup);
document.getElementById('btn-import').addEventListener('click', () => {
  document.getElementById('import-file').click();
});
document.getElementById('import-file').addEventListener('change', (e) => {
  if (e.target.files[0]) importBackup(e.target.files[0]);
});

// Make edit/done functions available globally (called from HTML onclick attributes)
window.openEditQuest = openEditQuest;
window.markDone      = markDone;
window.deleteQuest   = deleteQuest;
window.toggleDaily   = toggleDaily;
window.deleteDaily   = deleteDaily;


// ============================================================
// START — Load data when page opens
// ============================================================
loadState();
