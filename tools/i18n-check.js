// i18n-check: EN-source i18n gate (v2.1.0+)
// view _() + menu title (EN) == pot msgids == zh_Hant msgids;
// zh_Hant msgstr must be non-empty; msgstr must be Traditional (no simplified-only chars).
// usage: node tools/i18n-check.js (run at repo root)
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const VIEW = path.join(ROOT, 'luci-app-geoguard/htdocs/luci-static/resources/view/geoguard.js');
const MENU = path.join(ROOT, 'luci-app-geoguard/root/usr/share/luci/menu.d/luci-app-geoguard.json');
const POT = path.join(ROOT, 'luci-app-geoguard/po/templates/geoguard.pot');
const PO_ZHTW = path.join(ROOT, 'luci-app-geoguard/po/zh_Hant/geoguard.po');

let fail = 0;
const code = fs.readFileSync(VIEW, 'utf8');
const srcIds = new Set();
const re = /_\(\s*'((?:\\.|[^'\\])*)'\s*\)/g;
let m;
while ((m = re.exec(code)) !== null) {
  const s = m[1].replace(/\\'/g, "'").replace(/\\n/g, '\n');
  if (s) srcIds.add(s);
}
const menu = JSON.parse(fs.readFileSync(MENU, 'utf8'));
Object.values(menu).forEach((v) => { if (v.title) srcIds.add(v.title); });

function readPo(p) {
  const txt = fs.readFileSync(p, 'utf8');
  const ids = new Set();
  const strs = new Map();
  const re2 = /^msgid "((?:[^"\\]|\\.)*)"$/gm;
  let mm;
  let first = true;
  const blocks = txt.split('\n\n');
  for (const b of blocks) {
    const im = /^msgid "((?:[^"\\]|\\.)*)"/m.exec(b);
    const sm = /^msgstr "((?:[^"\\]|\\.)*)"/m.exec(b);
    if (!im) continue;
    if (first) { first = false; continue; } // header
    const id = im[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\').replace(/\\n/g, '\n');
    const st = sm ? sm[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\').replace(/\\n/g, '\n') : '';
    ids.add(id);
    strs.set(id, st);
  }
  return { ids, strs };
}

const pot = readPo(POT);
const zhtw = readPo(PO_ZHTW);

for (const id of srcIds) {
  if (!pot.ids.has(id)) { console.error('POT-MISSING: ' + id); fail = 1; }
}
for (const id of pot.ids) {
  if (!srcIds.has(id)) { console.error('POT-STALE: ' + id); fail = 1; }
}
for (const id of srcIds) {
  if (!zhtw.ids.has(id)) { console.error('ZHTW-MISSING: ' + id); fail = 1; }
}
for (const id of zhtw.ids) {
  if (!srcIds.has(id)) { console.error('ZHTW-STALE: ' + id); fail = 1; }
  else if (!zhtw.strs.get(id)) { console.error('ZHTW-EMPTY: ' + id); fail = 1; }
}
// Traditional-only: simplified-only chars must not appear in zh msgstr
// (country data table in view.js is excluded - data, not UI strings)
const SIMP_ONLY = ['设', '发', '护', '页', '软', '网', '盘', '让', '过', '这', '进', '远', '运', '优', '会', '个', '义', '来', '为', '无', '问', '开', '关', '应', '验', '马', '龙', '门', '风', '飞', '乐', '极'];
for (const [id, st] of zhtw.strs) {
  for (const ch of SIMP_ONLY) {
    if (st.indexOf(ch) >= 0) {
      console.error('SIMPLIFIED[' + ch + '] in msgstr of: ' + id.slice(0, 50));
      fail = 1;
      break;
    }
  }
  if (fail) break;
}
// source must be English (no CJK in _() strings, country data rows excluded:
// data rows match /^..,[^,]*,[A-Z ]+$/ pattern inside array literals)
const CJK = /[\u4e00-\u9fff]/;
for (const id of srcIds) {
  if (CJK.test(id) && !/e\.g\. TW/.test(id)) {
    console.error('NON-EN-SOURCE: ' + id.slice(0, 60));
    fail = 1;
  }
}
if (!fail) console.log('I18N-OK src=' + srcIds.size + ' pot=' + pot.ids.size + ' zhtw=' + zhtw.ids.size);
process.exit(fail);
