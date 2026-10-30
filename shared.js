/* HuhmINK 縮址助手 — 共用核心（popup / background / options 共用）
 *
 * 上傳流程與網站完全一致（已實測驗證）：
 *   1. POST /api/blob/upload → 取一次性 clientToken
 *   2. PUT https://vercel.com/api/blob/?pathname=… → 直傳檔案（≤ 30MB）
 *   3. POST /api/shorten → 寫入資料庫，取得短碼
 */

const HUHMINK_DEFAULTS = {
  apiBase: 'https://l.huhm.cc', // 主網站（API 端點）
  shortBase: 'https://huhm.cc', // 產生的短網址網域
};

const MAX_FILE_SIZE = 30 * 1024 * 1024; // 30MB

async function getConfig() {
  const stored = await chrome.storage.sync.get(['apiBase', 'shortBase']);
  return {
    apiBase: (stored.apiBase || HUHMINK_DEFAULTS.apiBase).replace(/\/+$/, ''),
    shortBase: (stored.shortBase || HUHMINK_DEFAULTS.shortBase).replace(/\/+$/, ''),
  };
}

function randomId() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function sanitizeFilename(name) {
  return name
    .replace(/[^\p{L}\p{N}._-]+/gu, '-')
    .replace(/^[-.]+/, '')
    .slice(-80) || 'file';
}

async function readError(res, fallback) {
  try {
    const data = await res.json();
    return data.error || `${fallback} (${res.status})`;
  } catch {
    return `${fallback} (${res.status})`;
  }
}

/** 建立短連結（url / text） */
async function shortenLink(type, payload, options) {
  const { apiBase } = await getConfig();
  const res = await fetch(`${apiBase}/api/shorten`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, ...payload, ...options }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.code) throw new Error(data.error || '建立連結失敗，請重試');
  return data.code;
}

/** 上傳檔案 → 建立短連結（三步驟，回傳短碼） */
async function shortenFile(file, options, onProgress) {
  const { apiBase } = await getConfig();

  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`檔案超過 30MB 上限（收到 ${(file.size / 1024 / 1024).toFixed(1)}MB）`);
  }

  // 1) 取一次性上傳權杖
  const pathname = `files/${randomId()}/${sanitizeFilename(file.name)}`;
  const tokenRes = await fetch(`${apiBase}/api/blob/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'blob.generate-client-token',
      payload: { pathname, callbackUrl: '', clientPayload: null, multipart: false },
    }),
  });
  const tokenData = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !tokenData.clientToken) {
    throw new Error(tokenData.error || '無法取得上傳權杖，請稍後再試');
  }
  if (onProgress) onProgress(30);

  // 2) 直傳 Vercel Blob
  const putRes = await fetch(
    `https://vercel.com/api/blob/?pathname=${encodeURIComponent(pathname)}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${tokenData.clientToken}`,
        'x-content-type': file.type || 'application/octet-stream',
        'x-api-version': '12',
      },
      body: file,
    }
  );
  if (!putRes.ok) {
    throw new Error(await readError(putRes, '上傳失敗'));
  }
  if (onProgress) onProgress(85);

  // 3) 寫入資料庫
  const res = await fetch(`${apiBase}/api/shorten`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'file',
      pathname,
      filename: file.name,
      mimetype: file.type || 'application/octet-stream',
      size: file.size,
      ...options,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.code) throw new Error(data.error || '建立連結失敗，請重試');
  if (onProgress) onProgress(100);
  return data.code;
}

async function buildShortUrl(code) {
  const { shortBase } = await getConfig();
  return `${shortBase}/${code}`;
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}
