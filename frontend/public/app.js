const API = '/api';

let token = localStorage.getItem('token');
let currentUser = localStorage.getItem('username');
let editingId = null;
let isRegisterMode = false;

// ── DOM refs ──────────────────────────────────────────────────────────────────
const authSection    = document.getElementById('auth-section');
const notesSection   = document.getElementById('notes-section');
const authTitle      = document.getElementById('auth-title');
const authSubmit     = document.getElementById('auth-submit');
const authToggleLink = document.getElementById('auth-toggle-link');
const authToggleText = document.getElementById('auth-toggle-text');
const authError      = document.getElementById('auth-error');
const authUsername   = document.getElementById('auth-username');
const authPassword   = document.getElementById('auth-password');

const userInfo       = document.getElementById('user-info');
const usernameDisplay= document.getElementById('username-display');
const btnLogout      = document.getElementById('btn-logout');

const addNoteForm    = document.getElementById('add-note-form');
const newTitle       = document.getElementById('new-title');
const newContent     = document.getElementById('new-content');
const addError       = document.getElementById('add-error');
const notesList      = document.getElementById('notes-list');
const emptyState     = document.getElementById('empty-state');

const modalOverlay   = document.getElementById('modal-overlay');
const editTitleEl    = document.getElementById('edit-title');
const editContentEl  = document.getElementById('edit-content');
const editError      = document.getElementById('edit-error');
const modalCancel    = document.getElementById('modal-cancel');
const modalSave      = document.getElementById('modal-save');

// ── Auth helpers ──────────────────────────────────────────────────────────────
function saveSession(t, u) {
  token = t; currentUser = u;
  localStorage.setItem('token', t);
  localStorage.setItem('username', u);
}

function clearSession() {
  token = null; currentUser = null;
  localStorage.removeItem('token');
  localStorage.removeItem('username');
}

function showApp() {
  authSection.style.display = 'none';
  notesSection.style.display = 'block';
  userInfo.style.display = 'flex';
  usernameDisplay.textContent = currentUser;
  loadNotes();
}

function showAuth() {
  authSection.style.display = 'block';
  notesSection.style.display = 'none';
  userInfo.style.display = 'none';
}

// ── API ───────────────────────────────────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(API + path, { ...options, headers });
  const body = res.status === 204 ? null : await res.json();
  if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
  return body;
}

// ── Auth ──────────────────────────────────────────────────────────────────────
authToggleLink.addEventListener('click', () => {
  isRegisterMode = !isRegisterMode;
  authTitle.textContent = isRegisterMode ? 'Rejestracja' : 'Logowanie';
  authSubmit.textContent = isRegisterMode ? 'Zarejestruj' : 'Zaloguj';
  authToggleText.textContent = isRegisterMode ? 'Masz już konto?' : 'Nie masz konta?';
  authToggleLink.textContent = isRegisterMode ? 'Zaloguj się' : 'Zarejestruj się';
  authError.textContent = '';
});

authSubmit.addEventListener('click', async () => {
  authError.textContent = '';
  const username = authUsername.value.trim();
  const password = authPassword.value;
  if (!username || !password) { authError.textContent = 'Wypełnij wszystkie pola.'; return; }
  try {
    const endpoint = isRegisterMode ? '/auth/register' : '/auth/login';
    const data = await apiFetch(endpoint, { method: 'POST', body: JSON.stringify({ username, password }) });
    saveSession(data.token, data.username);
    authPassword.value = '';
    showApp();
  } catch (err) {
    authError.textContent = err.message;
  }
});

btnLogout.addEventListener('click', () => {
  clearSession();
  showAuth();
});

// ── Notes ─────────────────────────────────────────────────────────────────────
async function loadNotes() {
  try {
    const notes = await apiFetch('/notes');
    renderNotes(notes);
  } catch (err) {
    if (err.message.includes('401') || err.message === 'Invalid token' || err.message === 'Missing token') {
      clearSession(); showAuth();
    }
  }
}

function renderNotes(notes) {
  notesList.innerHTML = '';
  if (notes.length === 0) { emptyState.style.display = 'block'; return; }
  emptyState.style.display = 'none';
  notes.forEach(n => {
    const card = document.createElement('div');
    card.className = 'note-card';
    card.dataset.id = n.id;
    const date = new Date(n.updated_at).toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' });
    card.innerHTML = `
      <h3>${escHtml(n.title)}</h3>
      <p>${escHtml(n.content)}</p>
      <div class="note-meta">Edytowano: ${date}</div>
      <div class="note-actions">
        <button class="btn-edit">Edytuj</button>
        <button class="btn-delete">Usuń</button>
      </div>`;
    card.querySelector('.btn-edit').addEventListener('click', () => openEdit(n));
    card.querySelector('.btn-delete').addEventListener('click', () => deleteNote(n.id));
    notesList.appendChild(card);
  });
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

addNoteForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  addError.textContent = '';
  try {
    await apiFetch('/notes', { method: 'POST', body: JSON.stringify({ title: newTitle.value, content: newContent.value }) });
    newTitle.value = ''; newContent.value = '';
    loadNotes();
  } catch (err) {
    addError.textContent = err.message;
  }
});

async function deleteNote(id) {
  if (!confirm('Usunąć notatkę?')) return;
  try {
    await apiFetch(`/notes/${id}`, { method: 'DELETE' });
    loadNotes();
  } catch (err) {
    alert(err.message);
  }
}

// ── Edit modal ────────────────────────────────────────────────────────────────
function openEdit(note) {
  editingId = note.id;
  editTitleEl.value = note.title;
  editContentEl.value = note.content;
  editError.textContent = '';
  modalOverlay.classList.add('open');
}

modalCancel.addEventListener('click', () => modalOverlay.classList.remove('open'));
modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) modalOverlay.classList.remove('open'); });

modalSave.addEventListener('click', async () => {
  editError.textContent = '';
  try {
    await apiFetch(`/notes/${editingId}`, {
      method: 'PUT',
      body: JSON.stringify({ title: editTitleEl.value, content: editContentEl.value })
    });
    modalOverlay.classList.remove('open');
    loadNotes();
  } catch (err) {
    editError.textContent = err.message;
  }
});

// ── Init ──────────────────────────────────────────────────────────────────────
if (token) { showApp(); } else { showAuth(); }
