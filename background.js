/* HuhmINK 縮址助手 — 右鍵選單與背景縮址 */

importScripts('shared.js');

const MENU_PARENT = 'huhmink-parent';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_PARENT,
    title: '用 HuhmINK 縮短',
    contexts: ['page', 'selection', 'link', 'image'],
  });
  chrome.contextMenus.create({ id: 'shorten-page', parentId: MENU_PARENT, title: '縮短這個網頁', contexts: ['page'] });
  chrome.contextMenus.create({ id: 'shorten-link', parentId: MENU_PARENT, title: '縮短這則連結', contexts: ['link'] });
  chrome.contextMenus.create({ id: 'shorten-image', parentId: MENU_PARENT, title: '縮短這張圖片', contexts: ['image'] });
  chrome.contextMenus.create({ id: 'share-text', parentId: MENU_PARENT, title: '分享選取的文字', contexts: ['selection'] });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  try {
    let shortUrl = null;
    if (info.menuItemId === 'shorten-page' && info.pageUrl) {
      const code = await shortenLink('url', { target: info.pageUrl }, {});
      shortUrl = await buildShortUrl(code);
    } else if (info.menuItemId === 'shorten-link' && info.linkUrl) {
      const code = await shortenLink('url', { target: info.linkUrl }, {});
      shortUrl = await buildShortUrl(code);
    } else if (info.menuItemId === 'share-text' && info.selectionText) {
      const code = await shortenLink('text', { content: info.selectionText }, {});
      shortUrl = await buildShortUrl(code);
    } else if (info.menuItemId === 'shorten-image' && info.srcUrl) {
      const response = await fetch(info.srcUrl);
      if (!response.ok) throw new Error('無法下載圖片');
      const blob = await response.blob();
      const name = new URL(info.srcUrl).pathname.split('/').pop() || 'image';
      const file = new File([blob], name, { type: blob.type || 'image/png' });
      const code = await shortenFile(file, {}, () => {});
      shortUrl = await buildShortUrl(code);
    } else {
      return;
    }

    await copyToClipboard(shortUrl);
    showDone(shortUrl);
  } catch (e) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'HuhmINK',
      message: `⚠ ${e instanceof Error ? e.message : '縮短失敗'}`,
    });
  }
});

function showDone(shortUrl) {
  // 已複製的提示 + 開啟連結
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: 'HuhmINK 已縮短 ✓',
    message: `短網址（已複製）：${shortUrl}`,
  });
  // 讓 popup 開著時也能更新（目前不需要）
  void shortUrl;
}

chrome.notifications.onClicked.addListener(() => {});
