const storageKey = 'prompt-keeper:v1';

const form = document.getElementById('prompt-form');
const titleInput = document.getElementById('title');
const summaryInput = document.getElementById('summary');
const bodyInput = document.getElementById('body');
const statusEl = document.getElementById('form-status');
const submitBtn = document.getElementById('submit-button');
const resetBtn = document.getElementById('reset-button');
const searchInput = document.getElementById('search');
const promptList = document.getElementById('prompt-list');
const editingChip = document.getElementById('editing-chip');
const formTitle = document.getElementById('form-title');
const template = document.getElementById('prompt-card-template');

const activeTitle = document.getElementById('active-title');
const activeBody = document.getElementById('active-body');
const copyActiveBtn = document.getElementById('copy-active');
const clearActiveBtn = document.getElementById('clear-active');

let prompts = [];
let activePromptId = null;
let editingId = null;

const examplePrompts = [
  {
    id: crypto.randomUUID(),
    title: 'Safety-first assistant',
    summary: 'Firm but helpful guardrails.',
    body: 'You are a safety-focused assistant. Be explicit about limitations, and decline unsafe instructions. Offer constructive alternatives when refusing.',
    updatedAt: Date.now() - 1000 * 60 * 60 * 3
  },
  {
    id: crypto.randomUUID(),
    title: 'Concise coder',
    summary: 'Code-focused answers with tight copy.',
    body: 'Act as a senior engineer who writes terse, well-commented code. Provide only the essential explanation after code examples.',
    updatedAt: Date.now() - 1000 * 60 * 60 * 26
  }
];

function loadState() {
  const saved = localStorage.getItem(storageKey);
  if (!saved) {
    prompts = examplePrompts;
    activePromptId = prompts[0].id;
    persist();
    return;
  }

  try {
    const parsed = JSON.parse(saved);
    prompts = parsed.prompts || [];
    activePromptId = parsed.activePromptId || null;
  } catch (err) {
    console.error('Failed to parse state', err);
    prompts = examplePrompts;
    activePromptId = prompts[0].id;
  }
}

function persist() {
  localStorage.setItem(storageKey, JSON.stringify({ prompts, activePromptId }));
}

function formatDate(ts) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(ts);
}

function resetForm() {
  form.reset();
  editingId = null;
  formTitle.textContent = 'Add a system prompt';
  submitBtn.textContent = 'Save prompt';
  editingChip.hidden = true;
  statusEl.textContent = '';
}

function populateForm(prompt) {
  titleInput.value = prompt.title;
  summaryInput.value = prompt.summary || '';
  bodyInput.value = prompt.body;
  formTitle.textContent = 'Update prompt';
  submitBtn.textContent = 'Update prompt';
  editingChip.hidden = false;
  editingId = prompt.id;
  titleInput.focus();
}

function setStatus(message, type = 'info') {
  statusEl.textContent = message;
  statusEl.style.color = type === 'error' ? 'var(--danger)' : 'var(--muted)';
}

function renderActivePrompt() {
  const active = prompts.find((p) => p.id === activePromptId);
  const hasActive = Boolean(active);

  activeTitle.textContent = hasActive ? active.title : 'None selected';
  activeBody.textContent = hasActive ? active.body : 'Choose a prompt and select “Use” to stage it for your next session.';

  copyActiveBtn.disabled = !hasActive;
  clearActiveBtn.disabled = !hasActive;
}

function renderPrompts(filterTerm = '') {
  promptList.innerHTML = '';
  const normalized = filterTerm.trim().toLowerCase();
  const items = normalized
    ? prompts.filter((p) =>
        p.title.toLowerCase().includes(normalized) ||
        (p.summary && p.summary.toLowerCase().includes(normalized)) ||
        p.body.toLowerCase().includes(normalized)
      )
    : prompts;

  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'No prompts match this view. Add one or clear the search filter.';
    promptList.appendChild(empty);
    return;
  }

  items
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .forEach((prompt) => {
      const card = template.content.cloneNode(true);
      card.querySelector('.prompt-title').textContent = prompt.title;
      card.querySelector('.prompt-summary').textContent = prompt.summary || '—';
      card.querySelector('.prompt-body').textContent = prompt.body;
      card.querySelector('[data-updated]').textContent = `Updated ${formatDate(prompt.updatedAt)}`;

      const tag = card.querySelector('[data-tag]');
      const isActive = prompt.id === activePromptId;
      tag.textContent = isActive ? 'Active' : 'Saved';
      tag.style.background = isActive ? 'rgba(123, 214, 255, 0.25)' : 'rgba(167, 139, 250, 0.2)';
      tag.style.color = isActive ? 'var(--accent)' : 'var(--accent-2)';

      card.querySelectorAll('[data-action]').forEach((btn) => {
        btn.dataset.id = prompt.id;
      });

      promptList.appendChild(card);
    });
}

function handleFormSubmit(event) {
  event.preventDefault();
  const title = titleInput.value.trim();
  const summary = summaryInput.value.trim();
  const body = bodyInput.value.trim();

  if (!title || !body) {
    setStatus('Title and system prompt are required.', 'error');
    return;
  }

  const now = Date.now();

  if (editingId) {
    prompts = prompts.map((item) =>
      item.id === editingId ? { ...item, title, summary, body, updatedAt: now } : item
    );
    setStatus('Prompt updated.');
  } else {
    const newPrompt = { id: crypto.randomUUID(), title, summary, body, updatedAt: now };
    prompts = [newPrompt, ...prompts];
    setStatus('Prompt saved.');
  }

  persist();
  renderPrompts(searchInput.value);
  resetForm();
}

function handleListClick(event) {
  const button = event.target.closest('[data-action]');
  if (!button) return;

  const action = button.dataset.action;
  const id = button.dataset.id;
  const prompt = prompts.find((p) => p.id === id);
  if (!prompt) return;

  if (action === 'copy') {
    navigator.clipboard
      .writeText(prompt.body)
      .then(() => setStatus('Copied prompt to clipboard.'))
      .catch(() => setStatus('Clipboard unavailable in this browser.', 'error'));
  }

  if (action === 'use') {
    activePromptId = id;
    persist();
    renderActivePrompt();
    renderPrompts(searchInput.value);
  }

  if (action === 'edit') {
    populateForm(prompt);
    setStatus('Editing existing prompt.');
  }

  if (action === 'delete') {
    if (!confirm('Delete this prompt?')) return;
    prompts = prompts.filter((p) => p.id !== id);
    if (activePromptId === id) {
      activePromptId = prompts[0]?.id || null;
    }
    persist();
    renderPrompts(searchInput.value);
    renderActivePrompt();
    setStatus('Prompt deleted.');
  }
}

function handleCopyActive() {
  const active = prompts.find((p) => p.id === activePromptId);
  if (!active) return;
  navigator.clipboard
    .writeText(active.body)
    .then(() => setStatus('Copied active prompt.'))
    .catch(() => setStatus('Clipboard unavailable in this browser.', 'error'));
}

function handleClearActive() {
  activePromptId = null;
  persist();
  renderActivePrompt();
  renderPrompts(searchInput.value);
  setStatus('Active prompt cleared.');
}

function init() {
  loadState();
  renderPrompts();
  renderActivePrompt();

  form.addEventListener('submit', handleFormSubmit);
  resetBtn.addEventListener('click', resetForm);
  promptList.addEventListener('click', handleListClick);
  searchInput.addEventListener('input', (event) => renderPrompts(event.target.value));
  copyActiveBtn.addEventListener('click', handleCopyActive);
  clearActiveBtn.addEventListener('click', handleClearActive);
}

init();
