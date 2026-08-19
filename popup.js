const $ = (id) => document.getElementById(id);

const state = {
  tab: null,
  settings: null,
  existingRelic: null,
  collections: [],
  tags: [],
  selectedCollectionId: null,
  selectedTagIds: new Set(),
  saving: false,
};

async function init() {
  const [settings, tab] = await Promise.all([
    browser.storage.local.get(['relicServerUrl', 'apiToken']),
    activeTab(),
  ]);
  state.tab = tab;
  state.settings = settings;

  if (!settings.relicServerUrl || !settings.apiToken) {
    showSetup('Connect your Relic server to save pages.');
    return;
  }

  if (await detectExisting()) {
    loadCollections();
    loadTags();
    return;
  }

  if (!state.tab?.url) {
    showMain();
    populateTab();
    return;
  }

  showSaving();
  await autoSave();
}

async function autoSave() {
  clearFeedback();
  setSavingText('Saving…');
  setSavingState(true);
  try {
    const relic = await api('/api/relics', {
      method: 'POST',
      body: JSON.stringify({
        url: state.tab.url,
        title: loadTitle(),
      }),
    });
    state.existingRelic = relic;
    setSavingText('Saved to your library.');
    setTimeout(() => window.close(), 800);
  } catch (err) {
    if (err.status === 409 && (await detectExisting())) {
      loadCollections();
      loadTags();
      return;
    }
    setSavingState(false);
    setSavingText(
      err.status === 401
        ? 'Unauthorized. Check your API token in Settings.'
        : message(err)
    );
  }
}

function loadTitle() {
  try {
    return state.tab?.title || null;
  } catch {
    return null;
  }
}

async function activeTab() {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  return tabs[0] || null;
}

function showSetup(message) {
  $('setup').classList.remove('hidden');
  $('main').classList.add('hidden');
  $('setup').querySelector('.muted').textContent = message;
}

function showMain() {
  $('setup').classList.add('hidden');
  $('main').classList.remove('hidden');
}

function populateTab() {
  const url = state.tab?.url || '';
  $('page-url').value = url;
  $('title').value = state.tab?.title || '';
}

function apiBase() {
  return state.settings.relicServerUrl.replace(/\/+$/, '');
}

async function api(path, options = {}) {
  const headers = {
    Authorization: `Bearer ${state.settings.apiToken}`,
    'Content-Type': 'application/json',
    ...options.headers,
  };
  const res = await fetch(`${apiBase()}${path}`, { ...options, headers });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      if (body.error) detail = body.error;
    } catch {
      /* ignore non-JSON error bodies */
    }
    const err = new Error(`HTTP ${res.status}: ${detail}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

async function loadCollections() {
  try {
    const res = await api('/api/collections?limit=100');
    state.collections = res.data || [];
    renderCollections();
    if (state.settings.defaultCollectionId) {
      const found = state.collections.find(
        (c) => c.id === state.settings.defaultCollectionId
      );
      if (found) state.selectedCollectionId = found.id;
    }
  } catch (err) {
    showError('Could not load collections: ' + message(err));
  }
}

async function loadTags() {
  try {
    const res = await api('/api/tags?limit=100');
    state.tags = res.data || [];
    renderTags();
  } catch {
    /* tags are optional; skip silently */
  }
}

async function detectExisting() {
  try {
    const res = await api(
      `/api/relics?q=${encodeURIComponent(state.tab?.url || '')}&limit=1`
    );
    const match = (res.data || []).find(
      (r) => r.url && r.url === state.tab?.url
    );
    if (match) {
      state.existingRelic = match;
      enterEditMode(match);
      return true;
    }
  } catch {
    /* assume it's new if we can't check */
  }
  return false;
}

function enterEditMode(relic) {
  showMain();
  populateTab();
  state.existingRelic = relic;
  $('save-btn').textContent = 'Save Changes';
  $('delete-btn').classList.remove('hidden');
  $('title').value = relic.title || '';
  $('note').value = relic.note || '';
  $('page-url').value = relic.url || state.tab?.url || '';
  if (relic.collections?.[0]) state.selectedCollectionId = relic.collections[0].id;
  state.selectedTagIds = new Set((relic.tags || []).map((t) => t.id));
  renderCollections();
  renderTags();
  updateSaveState();
}

function showSaving() {
  $('saved').classList.remove('hidden');
  $('main').classList.add('hidden');
}

function setSavingText(text) {
  $('saved-text').textContent = text;
}

function setSavingState(ok) {
  const icon = $('saved-icon');
  if (ok) {
    icon.classList.remove('saved-icon-error');
    $('saved-icon-path').setAttribute('d', 'M3 8.5 6.5 12 13 4.5');
  } else {
    icon.classList.add('saved-icon-error');
    $('saved-icon-path').setAttribute('d', 'M4.5 4.5l7 7M11.5 4.5l-7 7');
  }
}

function renderCollections() {
  const select = $('collection');
  const current = state.selectedCollectionId;
  select.innerHTML = '';
  const none = document.createElement('option');
  none.value = '';
  none.textContent = 'No collection';
  select.appendChild(none);
  for (const c of state.collections) {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    select.appendChild(opt);
  }
  select.value = current;
  state.selectedCollectionId = current || '';
}

function renderTags() {
  const dropdown = $('tag-dropdown');
  const filter = ($('tag-filter').value || '').trim().toLowerCase();
  dropdown.innerHTML = '';
  updateSaveState();

  const visible = state.tags
    .filter((t) => !filter || t.name.toLowerCase().includes(filter))
    .sort((a, b) => {
      const sa = state.selectedTagIds.has(a.id) ? 0 : 1;
      const sb = state.selectedTagIds.has(b.id) ? 0 : 1;
      return sa - sb || a.name.localeCompare(b.name);
    });

  for (const t of visible) {
    const label = document.createElement('label');
    label.className =
      'tag-option' + (state.selectedTagIds.has(t.id) ? ' selected' : '');

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = state.selectedTagIds.has(t.id);
    checkbox.addEventListener('change', () => toggleTag(t.id));
    label.appendChild(checkbox);

    const name = document.createElement('span');
    name.textContent = t.name;
    label.appendChild(name);

    dropdown.appendChild(label);
  }

  if (!visible.length && !filter) {
    const empty = document.createElement('div');
    empty.className = 'tag-option';
    empty.textContent = state.tags.length ? 'No tags yet' : 'Add your first tag';
    dropdown.appendChild(empty);
  }
}

function toggleTag(id) {
  if (state.selectedTagIds.has(id)) state.selectedTagIds.delete(id);
  else state.selectedTagIds.add(id);
  renderTags();
}

async function createCollection(name) {
  const res = await api('/api/collections', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
  state.collections.push(res);
  state.selectedCollectionId = res.id;
  renderCollections();
}

async function createTag(name) {
  const res = await api('/api/tags', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
  state.tags.push(res);
  state.selectedTagIds.add(res.id);
  renderTags();
}

function payload() {
  const body = {
    title: $('title').value.trim() || null,
    note: $('note').value.trim() || null,
  };
  if (state.existingRelic) {
    body.collectionIds = state.selectedCollectionId ? [state.selectedCollectionId] : [];
    body.tagIds = [...state.selectedTagIds];
    return body;
  }
  body.url = state.tab?.url || $('page-url').value;
  if (state.selectedCollectionId) body.collectionIds = [state.selectedCollectionId];
  body.tagIds = [...state.selectedTagIds];
  return body;
}

async function save() {
  if (state.saving) return;
  state.saving = true;
  setBusy(true);
  clearFeedback();
  try {
    if (state.existingRelic) {
      await api(`/api/relics/${state.existingRelic.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload()),
      });
      showMessage('Changes saved.');
    } else {
      const relic = await api('/api/relics', {
        method: 'POST',
        body: JSON.stringify(payload()),
      });
      state.existingRelic = relic;
      enterEditMode(relic);
      $('save-btn').textContent = 'Saved';
      setTimeout(() => window.close(), 900);
    }
  } catch (err) {
    showError(err.status === 409 ? 'This URL is already saved.' : message(err));
  } finally {
    state.saving = false;
    setBusy(false);
  }
}

async function remove() {
  if (!state.existingRelic || !confirm('Delete this relic?')) return;
  state.saving = true;
  setBusy(true);
  clearFeedback();
  try {
    await api(`/api/relics/${state.existingRelic.id}`, { method: 'DELETE' });
    state.existingRelic = null;
    showMessage('Relic deleted.');
    setTimeout(() => window.close(), 900);
  } catch (err) {
    showError(message(err));
  } finally {
    state.saving = false;
    setBusy(false);
  }
}

function updateSaveState() {
  if (state.existingRelic) return;
  $('save-btn').disabled = !state.tab?.url && !$('page-url').value.trim();
}

function setBusy(busy) {
  $('save-btn').disabled = busy;
  $('delete-btn').disabled = busy;
}

function clearFeedback() {
  $('message').textContent = '';
  $('error').textContent = '';
}

function showMessage(text) {
  $('message').textContent = text;
  $('error').textContent = '';
}

function showError(text) {
  $('error').textContent = text;
  $('message').textContent = '';
}

function message(err) {
  return err && err.message ? err.message : String(err);
}

document.addEventListener('DOMContentLoaded', () => {
  $('settings-btn').addEventListener('click', () =>
    browser.runtime.openOptionsPage()
  );
  $('open-settings').addEventListener('click', () =>
    browser.runtime.openOptionsPage()
  );
  $('save-btn').addEventListener('click', save);
  $('delete-btn').addEventListener('click', remove);
  $('new-collection-btn').addEventListener('click', () => {
    $('new-collection-form').classList.toggle('hidden');
    $('new-collection-name').value = '';
    $('new-collection-name').focus();
  });
  $('new-collection-create').addEventListener('click', async () => {
    const name = $('new-collection-name').value.trim();
    if (!name) return;
    try {
      await createCollection(name);
      $('new-collection-form').classList.add('hidden');
      $('new-collection-name').value = '';
    } catch (err) {
      showError(err.status === 409 ? 'Collection already exists.' : message(err));
    }
  });
  $('new-collection-name').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('new-collection-create').click();
  });
  $('tag-filter').addEventListener('input', () => {
    $('tag-dropdown').classList.remove('hidden');
    renderTags();
  });
  $('tag-filter').addEventListener('focus', () => {
    $('tag-dropdown').classList.remove('hidden');
    renderTags();
  });
  $('tag-filter').addEventListener('keydown', async (e) => {
    if (e.key !== 'Enter') return;
    const name = $('tag-filter').value.trim();
    if (!name) return;
    e.preventDefault();
    const exact = state.tags.find((t) => t.name.toLowerCase() === name.toLowerCase());
    if (exact) {
      toggleTag(exact.id);
      $('tag-filter').value = '';
      return;
    }
    await createTag(name);
    $('tag-filter').value = '';
    renderTags();
  });
  document.addEventListener('click', (e) => {
    if (!$('tag-dropdown').contains(e.target) && e.target !== $('tag-filter')) {
      $('tag-dropdown').classList.add('hidden');
    }
  });
  $('title').addEventListener('input', updateSaveState);
  $('page-url').addEventListener('input', updateSaveState);
  $('collection').addEventListener('change', (e) => {
    state.selectedCollectionId = e.target.value;
  });

  init();
});
