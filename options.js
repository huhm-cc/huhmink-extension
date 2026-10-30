const $ = (id) => document.getElementById(id);

document.addEventListener('DOMContentLoaded', async () => {
  const stored = await chrome.storage.sync.get(['apiBase', 'shortBase']);
  $('apiBase').value = stored.apiBase || 'https://l.huhm.cc';
  $('shortBase').value = stored.shortBase || 'https://huhm.cc';

  $('save').addEventListener('click', async () => {
    await chrome.storage.sync.set({
      apiBase: $('apiBase').value.trim() || 'https://l.huhm.cc',
      shortBase: $('shortBase').value.trim() || 'https://huhm.cc',
    });
    const el = $('saved');
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 2000);
  });

  $('reset').addEventListener('click', () => {
    $('apiBase').value = 'https://l.huhm.cc';
    $('shortBase').value = 'https://huhm.cc';
  });
});
