/**
 * pack.js — 將擴充功能打包成簽署 .crx 與 update.xml（維護者用）
 *
 * 用法：npm install crx@5 && node pack.js
 * 產出：dist/huhmink.crx、dist/update.xml、dist/appid.txt
 *
 * ⚠️ 簽署私鑰（key.pem）決定了擴充功能 ID ——
 *    遺失金鑰會換新 ID，使用者的 .reg 安裝原則需要重新寫一次。請妥善保管、不要公開。
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

let ChromeExtension;
try {
  ChromeExtension = require('crx');
} catch {
  console.error('請先 npm install crx@5');
  process.exit(1);
}

const SRC = __dirname;
const STAGE = path.join(SRC, '.stage');
const KEY_PEM = path.join(SRC, 'key.pem');
const OUT_DIR = path.join(SRC, 'dist');
const CODEBASE = 'https://l.huhm.cc/extension/huhmink.crx';
const VERSION = JSON.parse(fs.readFileSync(path.join(SRC, 'manifest.json'), 'utf8')).version;

(async () => {
  // 1) 私鑰（首次自動產生 RSA-2048）
  if (!fs.existsSync(KEY_PEM)) {
    const { privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    fs.writeFileSync(KEY_PEM, privateKey);
    console.log('✓ 已產生 key.pem（請妥善保管，切勿公開）');
  }
  const privateKey = fs.readFileSync(KEY_PEM, 'utf8');

  // 2) 乾淨暫存區（只放要放進 crx 的檔案）
  fs.rmSync(STAGE, { recursive: true, force: true });
  fs.mkdirSync(STAGE, { recursive: true });
  const files = [
    'manifest.json', 'shared.js', 'popup.html', 'popup.js', 'popup.css',
    'background.js', 'options.html', 'options.js', 'qrcode-lib.js',
  ];
  for (const f of files) fs.copyFileSync(path.join(SRC, f), path.join(STAGE, f));
  fs.cpSync(path.join(SRC, 'icons'), path.join(STAGE, 'icons'), { recursive: true });

  // 3) 打包
  const crx = new ChromeExtension({ codebase: CODEBASE, privateKey });
  await crx.load(STAGE);
  const crxBuffer = await crx.pack();
  const updateXML = await crx.generateUpdateXML();
  const appId = await crx.generateAppId();

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'huhmink.crx'), crxBuffer);
  fs.writeFileSync(path.join(OUT_DIR, 'update.xml'), Buffer.isBuffer(updateXML) ? updateXML : String(updateXML));
  fs.writeFileSync(path.join(OUT_DIR, 'appid.txt'), appId);
  fs.rmSync(STAGE, { recursive: true, force: true });

  console.log('✓ 打包完成');
  console.log('  appId:', appId);
  console.log('  version:', VERSION);
  console.log('  crx:', crxBuffer.length, 'bytes →', path.join(OUT_DIR, 'huhmink.crx'));
  console.log('  下一步：把 dist/huhmink.crx 與 dist/update.xml 放進主網站 public/extension/ 並部署');
})().catch((e) => {
  console.error('ERROR:', e);
  process.exit(1);
});
