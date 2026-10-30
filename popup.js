/* HuhmINK 縮址助手 — popup 邏輯 */

const $ = (id) => document.getElementById(id);

let currentTab = 'url';
let selectedFile = null;
let currentShortUrl = '';

const urlInput = $('urlInput');
const textInput = $('textInput');
const fileInput = $('fileInput');
const dropzone = $('dropzone');
const fileChip = $('fileChip');
const passwordRow = $('passwordRow');
const errorBox = $('error');
const submitBtn = $('submit');

const MAX_TEXT = 100_000;

document.addEventListener('DOMContentLoaded', async () => {
  // 分頁切換
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      const name = tab.dataset.tab;
      currentTab = name;
      document.querySelectorAll('.tab').forEach((t) => {
        const active = t === tab;
        t.classList.toggle('active', active);
        t.setAttribute('aria-selected', String(active));
      });
      document.querySelectorAll('.panel').forEach((panel) => {
        panel.classList.toggle('hidden', panel.dataset.panel !== name);
      });
      hideError();
      hideResult();
    });
  });

  // 用目前頁面
  $('useCurrent').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url && /^https?:\/\//.test(tab.url)) {
      urlInput.value = tab.url;
      hideError();
    } else {
      showError('這個分頁是特殊頁面，無法縮短');
    }
  });

  // 字數統計
  textInput.addEventListener('input', () => {
    const len = textInput.value.length;
    const el = $('charCount');
    el.textContent = `${len.toLocaleString('zh-TW')} / ${MAX_TEXT.toLocaleString('zh-TW')} 字`;
    el.classList.toggle('warn', len > MAX_TEXT * 0.95);
  });

  // 密碼欄位顯示
  $('usePassword').addEventListener('change', (e) => {
    passwordRow.classList.toggle('hidden', !e.target.checked);
  });

  // 檔案選擇
  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInput.click();
    }
  });
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('drag');
  });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag'));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('drag');
    pickFile(e.dataTransfer.files?.[0]);
  });
  fileInput.addEventListener('change', () => pickFile(fileInput.files?.[0]));
  $('fileRemove').addEventListener('click', () => {
    selectedFile = null;
    fileInput.value = '';
    fileChip.classList.add('hidden');
  });

  // 設定連結
  $('openOptions').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });

  submitBtn.addEventListener('click', () => shorten());
  $('copyBtn').addEventListener('click', async () => {
    if (currentShortUrl) {
      await navigator.clipboard.writeText(currentShortUrl).catch(() => {});
    }
  });
  $('qrBtn').addEventListener('click', () => {
    const panel = $('qrPanel');
    if (!panel.classList.contains('hidden')) {
      panel.classList.add('hidden');
      return;
    }
    if (currentShortUrl) {
      panel.innerHTML = '';
      renderQr(panel, currentShortUrl, 116);
    }
    panel.classList.toggle('hidden');
  });

  // 設定連結
  urlInput.focus();

  // 自動填入目前網址（前面用 tabs 查詢）
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url && /^https?:\/\//.test(tab.url)) urlInput.value = tab.url;
  } catch {}
});

function pickFile(file) {
  if (!file) return;
  if (file.size > 30 * 1024 * 1024) {
    showError(`檔案超過 30MB 上限（收到 ${(file.size / 1024 / 1024).toFixed(1)}MB）`);
    return;
  }
  selectedFile = file;
  hideError();
  $('fileName').textContent = file.name;
  $('fileSize').textContent = formatBytes(file.size);
  fileChip.classList.remove('hidden');
}

function formatBytes(size) {
  if (size < 1024) return `${size} B`;
  const units = ['B', 'KB', 'MB', 'GB'];
  let n = size, i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n >= 100 ? Math.round(n) : n.toFixed(1).replace(/\.0$/, '')} ${units[i]}`;
}

function renderQr(container, text, size) {
  try {
    const qr = window.qrcode(-1, 'M');
    qr.addData(text);
    qr.make();
    const svg = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
    const holder = document.createElement('div');
    holder.innerHTML = svg;
    const svgEl = holder.firstChild;
    svgEl.style.width = `${size}px`;
    svgEl.style.height = `${size}px`;
    container.appendChild(svgEl);
    const caption = document.createElement('div');
    caption.className = 'qr-caption';
    caption.textContent = '用手機相機掃描，直接打開這個連結。';
    container.appendChild(caption);
  } catch (e) {
    container.textContent = 'QR Code 產生失敗';
  }
}

function collectOptions() {
  const opts = {};
  if ($('nsfw').checked) opts.nsfw = true;
  if ($('usePassword').checked && $('password').value) {
    opts.password = $('password').value;
  }
  return opts;
}

async function shorten() {
  hideError();
  hideResult();

  const options = collectOptions();
  if (options.password && (options.password.length < 4 || options.password.length > 72)) {
    showError('密碼長度需介於 4 到 72 個字元');
    return;
  }

  setBusy(true, '');
  const bar = $('progressBar');
  const fill = $('progressFill');

  try {
    let code = null;

    if (currentTab === 'url') {
      const target = urlInput.value.trim();
      if (!/^https?:\/\/\S+$/i.test(target)) throw new Error('請輸入有效的網址（http:// 或 https://）');
      code = await shortenLink('url', { target }, options);
    } else if (currentTab === 'text') {
      const content = textInput.value;
      if (!content.trim()) throw new Error('請輸入要分享的文字');
      if (content.length > MAX_TEXT) throw new Error('文字超過上限（最多 100,000 字）');
      code = await shortenLink('text', { content }, options);
    } else {
      if (!selectedFile) throw new Error('請選擇要上傳的檔案');
      bar.classList.remove('hidden');
      fill.style.width = '10%';
      code = await shortenFile(selectedFile, options, (pct) => {
        fill.style.width = `${pct}%`;
      });
    }

    const shortUrl = await buildShortUrl(code);
    currentShortUrl = shortUrl;
    const origin = shortUrl.match(/^https?:\/\/[^/]+/)?.[0] || '';
    const shortCode = shortUrl.replace(origin + '/', '');
    $('resultUrl').innerHTML = `<span class="origin"></span>`;
    $('resultUrl').innerHTML =
      `<span class="origin">${origin}/</span>${escapeHtml(shortCode)}`;
    $('openBtn').href = shortUrl;

    const badges = $('badges');
    badges.innerHTML = '';
    if (options.nsfw) badges.innerHTML += '<span class="badge nsfw">18+</span>';
    if (options.password) badges.innerHTML += '<span class="badge lock">🔒 密碼</span>';

    $('result').classList.remove('hidden');
    $('qrPanel').classList.add('hidden');
  } catch (e) {
    showError(e instanceof Error ? e.message : '發生錯誤，請重試');
  } finally {
    setBusy(false, '');
    bar.classList.add('hidden');
    fill.style.width = '0%';
  }
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function showError(msg) {
  errorBox.textContent = '⚠ ' + msg;
  errorBox.classList.remove('hidden');
}
function hideError() { errorBox.classList.add('hidden'); }
function hideResult() { $('result').classList.add('hidden'); }

function setBusy(busy, label) {
  submitBtn.disabled = busy;
  submitBtn.textContent = busy ? label || '處理中……' : '縮成連結';
}
