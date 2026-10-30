# HuhmINK 縮址助手（瀏覽器擴充功能）

Chrome / Edge 擴充功能：**在任何網頁上一鍵把網址、文字、圖片、檔案縮成 `huhm.cc` 短連結**，支援密碼保護、18+ 標記與 QR Code — 和網站功能完全相同。

## 功能

- 🔗 **目前頁面一鍵縮址** — 彈出視窗自動帶入目前網址
- 📝 **文字分享** — 筆記、訊息、程式碼
- 📦 **檔案 / 圖片 / 影片** — 最大 30MB，瀏覽器直傳（與網站相同流程）
- 🔒 **密碼保護** 與 🔞 **18+ 標記** — 建立時可勾選
- 📱 **QR Code** — 每個短連結都能一鍵產生
- 🖱 **右鍵選單** — 縮短網頁 / 連結 / 圖片 / 分享選取文字，完成後自動複製短網址
- ⚙️ **可自訂** — 主網站與短網址網域都可以在設定頁改

## 安裝（載入未封裝擴充功能）

Chrome / Edge 都能用：

1. 下載本 repo（Code → Download ZIP）並解壓縮
2. 網址列輸入 `chrome://extensions`（Edge 是 `edge://extensions`）
3. 打開右上角「**開發人員模式**」
4. 點「**載入未封裝項目**」，選擇解壓縮出來的資料夾
5. 工具列出現 **HuhmINK 縮址助手** 圖示就完成了！

## 使用

- **縮目前頁面**：點工具列圖示 → 「縮成連結」
- **右鍵更快**：網頁上按右鍵 → 「用 HuhmINK 縮短」
- **自訂網域**：在 popup 右下角 ⚙ 設定（自架使用者才需要）

## 開發

純原生 HTML/CSS/JS（Manifest V3），零建置、零相依（QR Code 用的是 MIT 授權的 `qrcode-generator` 單檔版）：

```text
huhmink-extension/
├── manifest.json      # MV3 設定
├── shared.js          # 核心：縮址 / 上傳（三步驟）/ QR 共用
├── popup.html/.js/.css
├── background.js      # 右鍵選單 + 通知
├── options.html/.js   # 設定頁
├── icons/             # 16/48/128 PNG
└── qrcode-lib.js      # qrcode-generator（MIT）
```

### 檔案上傳流程（和網站完全一致）

1. `POST https://l.huhm.cc/api/blob/upload` → 取得一次性 `clientToken`
2. `PUT https://vercel.com/api/blob/?pathname=…`（Authorization: Bearer clientToken）→ 直傳檔案
3. `POST https://l.huhm.cc/api/shorten` → 寫入資料庫、取得短碼

（這三個步驟在任何網頁/擴充功能都能跑 — 網站 API 已開放 CORS。）

### 打包成 ZIP 上架

```bash
# 排除清單內容後壓縮（含 manifest.json 的資料夾即可）
zip -r huhmink-extension.zip . -x "README.md" "*.md"
```

## 授權

MIT — 與 [HuhmINK](https://l.huhm.cc) 主專案相同。
