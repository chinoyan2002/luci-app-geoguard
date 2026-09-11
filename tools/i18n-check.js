// i18n-check: po 與源碼同步守門（缺譯／殘留／簡體字，任一中就紅燈）
// 用法：node tools/i18n-check.js（在 repo 根跑）
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const VIEW = path.join(ROOT, 'luci-app-geoguard/root/www/luci-static/resources/view/geoguard.js');
const MENU = path.join(ROOT, 'luci-app-geoguard/root/usr/share/luci/menu.d/luci-app-geoguard.json');
const PO = path.join(ROOT, 'luci-app-geoguard/po/en/geoguard.po');
const PO_ZHTW = path.join(ROOT, 'luci-app-geoguard/po/zh-tw/geoguard.po');

let fail = 0;
const code = fs.readFileSync(VIEW, 'utf8');
const srcIds = new Set();
const re = /_\(\s*'((?:\\.|[^'\\])*)'\s*\)/g;
let m;
while ((m = re.exec(code)) !== null) {
  const s = m[1].replace(/\\'/g, "'");
  if (s) srcIds.add(s);
}
const menu = JSON.parse(fs.readFileSync(MENU, 'utf8'));
Object.values(menu).forEach((v) => { if (v.title) srcIds.add(v.title); });

const po = fs.readFileSync(PO, 'utf8');
const poIds = new Set();
const re2 = /^msgid "((?:[^"\\]|\\.)*)"$/gm;
let m2;
let first = true;
while ((m2 = re2.exec(po)) !== null) {
  if (first) { first = false; continue; } // header
  poIds.add(m2[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\'));
}

for (const id of srcIds) {
  if (!poIds.has(id)) { console.error('MISSING: ' + id); fail = 1; }
}
for (const id of poIds) {
  if (!srcIds.has(id)) { console.error('STALE: ' + id); fail = 1; }
}
// zh-tw 只准有源碼存在的 msgid（選單標題這類）
const zhtw = fs.readFileSync(PO_ZHTW, 'utf8');
const zhIds = new Set();
const re3 = /^msgid "((?:[^"\\]|\\.)*)"$/gm;
let m3;
let zfirst = true;
while ((m3 = re3.exec(zhtw)) !== null) {
  if (zfirst) { zfirst = false; continue; }
  zhIds.add(m3[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\'));
}
for (const id of zhIds) {
  if (!srcIds.has(id)) { console.error('ZHTW-STALE: ' + id); fail = 1; }
}
// 簡體字：只認「簡體專用字」（繁簡共用字不算，避免誤殺時間／實際這類詞）
const SIMP = '设发护页软网盘让过这进远运优会个义来为无问开关联应应验时現'.replace(/./g, '');
const SIMP_ONLY = ['设', '发', '护', '页', '软', '网', '盘', '让', '过', '这', '进', '远', '运', '优', '会', '个', '义', '来', '为', '无', '问', '开', '关', '应', '验', '马', '龙', '门', '风', '飞', '乐', '极'];
// 誤殺排除：繁體也合法的字先拿掉（时间/实际類共用字不在表內即可）
for (const ch of SIMP_ONLY) {
  const idx = code.indexOf(ch);
  if (idx >= 0) {
    // 白名單：無（繁體本文不該出現上表任何一字）
    console.error('SIMPLIFIED[' + ch + '] at line ' + (code.slice(0, idx).split('\n').length));
    fail = 1;
    break;
  }
}
if (!fail) console.log('I18N-OK src=' + srcIds.size + ' po=' + poIds.size + ' zhtw=' + zhIds.size);
process.exit(fail);
