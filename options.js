const $ = (id) => document.getElementById(id);

const state = {
  settings: { relicServerUrl: '', apiToken: '', defaultCollectionId: '' },
  collections: [],
  tokenVisible: false,
};

async function init() {
  state.settings = await browser.storage.local.get([
    'relicServerUrl',
    'apiToken',
    'defaultCollectionId',
  ]);
  $('server-url').value = state.settings.relicServerUrl || '';
  $('api-token').value = state.settings.apiToken || '';
  $('api-token').type = 'password';

  if (state.settings.relicServerUrl && state.settings.apiToken) {
    await loadCollections();
  } else {
    renderCollections();
  }
}

function apiBase() {
  return (state.settings.relicServerUrl || '').replace(/\/+$/, '');
}

async function loadCollections() {
  const btn = $('refresh-collections');
  btn.disabled = true;
  clearFeedback();
  try {
    const res = await fetch(`${apiBase()}/api/collections?limit=100`, {
      headers: { Authorization: `Bearer ${state.settings.apiToken}` },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    const body = await res.json();
    state.collections = body.data || [];
    renderCollections();
  } catch (err) {
    showError('Could not load collections: ' + (err.message || String(err)));
  } finally {
    btn.disabled = false;
  }
}

function renderCollections() {
  const select = $('default-collection');
  const current = state.settings.defaultCollectionId;
  select.innerHTML = '';
  const none = document.createElement('option');
  none.value = '';
  none.textContent = 'No default';
  select.appendChild(none);
  for (const c of state.collections) {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    select.appendChild(opt);
  }
  select.value = current;
}

async function save() {
  const serverUrl = $('server-url').value.trim().replace(/\/+$/, '');
  const apiToken = $('api-token').value.trim();
  const defaultCollectionId = $('default-collection').value;
  if (!serverUrl || !apiToken) {
    showError('Server URL and API token are required.');
    return;
  }

  const prevUrl = state.settings.relicServerUrl;
  const prevToken = state.settings.apiToken;
  state.settings = { relicServerUrl: serverUrl, apiToken, defaultCollectionId };
  await browser.storage.local.set(state.settings);

  if (serverUrl !== prevUrl || apiToken !== prevToken) {
    await loadCollections();
  }

  showSuccess('Settings saved.');
}

function clearFeedback() {
  $('success').textContent = '';
  $('error').textContent = '';
}

function showSuccess(text) {
  $('success').textContent = text;
  $('error').textContent = '';
}

function showError(text) {
  $('error').textContent = text;
  $('success').textContent = '';
}

document.addEventListener('DOMContentLoaded', () => {
  $('toggle-token').addEventListener('click', () => {
    const input = $('api-token');
    state.tokenVisible = !state.tokenVisible;
    input.type = state.tokenVisible ? 'text' : 'password';
  });
  $('refresh-collections').addEventListener('click', loadCollections);
  $('save').addEventListener('click', save);
  init();
});
