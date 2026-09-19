// LuCI view 煙測 v2：mini-DOM＋uci store，走完搜尋→勾選→存檔整條路
// 用法：node luci-harness.js <view.js>
const fs = require('fs');
const src = process.argv[2];
const code = fs.readFileSync(src, 'utf8');

if (/\.on\s*\(\s*['"]save['"]/.test(code)) {
  console.error('HARNESS-FAIL: 還在用 m.on(save)');
  process.exit(1);
}
if (/setname[\s\S]{0,200}uciname/.test(code)) {
  console.error('HARNESS-FAIL: setname 用了 uciname 驗證（含連字號會炸）');
  process.exit(1);
}
if (!/var VERSION = '\d+\.\d+\.\d+'/.test(code)) {
  console.error('HARNESS-FAIL: 缺 VERSION 常數');
  process.exit(1);
}
if (code.indexOf('IP Sets') < 0) {
  console.error('HARNESS-FAIL: 缺 IPs 設定籤名');
  process.exit(1);
}
console.log('version+tabname OK');

const NODES = [];
function textOf(n) {
  if (typeof n === 'string') return n;
  return (n.children || []).map(textOf).join('');
}
function E(...a) {
  let attrs = {}, children = [];
  for (const x of a.slice(1)) {
    if (typeof x === 'string') children.push(x);
    else if (Array.isArray(x)) children = children.concat(x);
    else if (x && typeof x === 'object') attrs = Object.assign(attrs, x);
  }
  const n = {
    tag: a[0], attrs, style: { display: '' },
    checked: false, value: '',
    listeners: {},
    appendChild(c) { children.push(c); if (c && typeof c === 'object') c.parent = this; },
    removeChild(c) {
      const i = children.indexOf(c);
      if (i >= 0) children.splice(i, 1);
      return c;
    },
    addEventListener(t, f) { this.listeners[t] = f; },
    fire(t) { if (this.listeners[t]) return this.listeners[t](); },
    get textContent() { return textOf(this); },
    get firstChild() { return children.length > 0 ? children[0] : null; },
    get children() { return this._kids; },
  };
  n._kids = children;
  for (const c of children) {
    if (c && typeof c === 'object') c.parent = n;
  }
  if (typeof attrs.click === 'function') n.listeners.click = attrs.click;
  NODES.push(n);
  return n;
}
const _ = (s) => s;
const view = { extend: (o) => o };
const fakeMap = { save: () => Promise.resolve(), render: () => Promise.resolve({}) };
function mkOpt() {
  const o = {};
  ['multiple', 'optional', 'rmempty', 'datatype', 'placeholder', 'description', 'default'].forEach((k) => {
    Object.defineProperty(o, k, { set(v) {} });
  });
  o.value = () => {};
  return o;
}
const form = {
  Map: function() {}, TypedSection: function() {},
  MultiValue: function() {}, DynamicList: function() {},
  Flag: function() {}, Value: function() {}, ListValue: function() {},
  DummyValue: function() {}, Button: function() {},
};
const sectionRenders = [];
const OPTS = [];
form.Map.prototype.section = function() {
  const s = {
    _tabs: {},
    option: () => { const o = mkOpt(); OPTS.push(o); return o; },
    taboption: function(tab, type, name) {
      if (!this._tabs[tab])
        throw new ReferenceError('Associated tab not declared');
      const o = mkOpt(); o._tab = tab; o._name = name; OPTS.push(o); return o;
    },
    tab: function(name) { this._tabs[name] = true; },
    render: null, map: fakeMap,
  };
  sectionRenders.push(s);
  return s;
};
form.Map.prototype.render = function() { return Promise.resolve({}); };
form.Map.prototype.save = function() { return Promise.resolve(); };
const execCalls = [];
const fsStub = {
  list: () => Promise.resolve([]),
  exec: (cmd) => {
    execCalls.push(cmd);
    if (cmd === '/usr/bin/geoguard-status')
      return Promise.resolve({ code: 0, stdout: '===== Set status =====\nSet file:x (100 lines)\n===== Update history (last 20) =====\n2026-09-11|update|ok\n' });
    if (cmd === '/usr/bin/geoguard-counts')
      return Promise.resolve({ code: 0, stdout: 'allowed-IPList 729 658 2026-09-12_13:51:49 2026-09-12_14:38:31' });
    return Promise.resolve({ code: 0 });
  },
};
const ui = {
  createHandlerFn: (t, f) => f.bind(t),
  addNotification: (a, b) => { notifications.push(b ? b.textContent : ''); },
};
const notifications = [];
const store = {
  geoguard: { main: {
    selected: [], sel_asia: ['tw', 'jp'], sel_europe: [],
    sel_africa: [], sel_northamerica: [], sel_southamerica: [], sel_oceania: [],
    setname: 'allowed-IPList', update_freq: 'daily', update_hour: '3', update_min: '10',
    ban_enabled: '1', ban_maxretry: '8', ban_findtime: '5', ban_bantime: '2',
    ban_web: '1', ban_ssh: '1',
  } },
};
let applyMode = 'ok';
const uci = {
  load: () => Promise.resolve(),
  get: (c, s, o) => {
    const v = (((store[c] || {})[s] || {})[o]);
    return Array.isArray(v) ? v.slice() : v;
  },
  // 模擬 rpcd：空陣列會被打回 ubus code 2，必須用 unset
  set: (c, s, o, v) => {
    if (Array.isArray(v) && v.length === 0)
      throw new Error('RPC call to uci/set failed with ubus code 2');
    store[c][s][o] = v;
  },
  unset: (c, s, o) => { delete store[c][s][o]; },
  save: () => Promise.resolve(),
  apply: () => {
    if (applyMode === 'nodata')
      return Promise.reject(new Error('RPC call to uci/apply failed with ubus code 5: No data received'));
    if (applyMode === 'boom')
      return Promise.reject(new Error('RPC call to uci/apply failed with ubus code 1: Invalid argument'));
    if (applyMode === 'flaky6') {
      applyMode = 'ok';
      return Promise.reject(new Error('RPC call to uci/apply failed with ubus code 6: Permission denied'));
    }
    return Promise.resolve();
  },
};

const factory = new Function('view', 'form', 'fs', 'ui', 'uci', 'E', '_', code);
const v = factory(view, form, fsStub, ui, uci, E, _);

const findInputs = (type) => NODES.filter((n) => n.tag === 'input' && n.attrs.type === type);

(async () => {
  const data = await v.load();
  await v.render(data);
  // 跑所有自訂 render（國家表、說明、按鈕改 form.Button 由 onclick 觸發）
  for (const s of sectionRenders) {
    if (typeof s.render === 'function') await s.render.call(s);
  }
  for (const o of OPTS) {
    if (typeof o.render === 'function') await o.render.call({ map: fakeMap });
  }

  // 0. 未觸碰國家/白名單就存檔：selected/whitelist 不得被動到（防 render 失載刪檔）
  store.geoguard.main.selected = ['tw'];
  store.geoguard.main.whitelist = ['10.9.9.9'];
  const saveEarly = NODES.find((n) => n.tag === 'button' && n.textContent === 'Save Settings');
  if (!saveEarly) { console.error('HARNESS-FAIL: 找不到儲存設定鍵'); process.exit(1); }
  await saveEarly.fire('click');
  if (JSON.stringify(store.geoguard.main.selected) !== JSON.stringify(['tw']) ||
      JSON.stringify(store.geoguard.main.whitelist) !== JSON.stringify(['10.9.9.9'])) {
    console.error('HARNESS-FAIL: 未觸碰卻改寫了 selected/whitelist: ' + JSON.stringify({ s: store.geoguard.main.selected, w: store.geoguard.main.whitelist }));
    process.exit(1);
  }
  delete store.geoguard.main.selected;
  delete store.geoguard.main.whitelist;
  console.log('clean-save OK');

  // 1. 搜尋 TW（單表，全國）
  const searches = NODES.filter((n) => n.tag === 'input' && n.attrs.type === 'text');
  if (searches.length === 0) { console.error('HARNESS-FAIL: 找不到搜尋框'); process.exit(1); }
  const search = searches[0];
  search.value = 'TW';
  await search.fire('input');
  const rows = NODES.filter((n) => n.tag === 'tr' && n.children.some((c) => typeof c !== 'string' && c.tag === 'td'));
  const visible = rows.filter((r) => r.style.display !== 'none');
  console.log('rows total=' + rows.length + ' visible-after-TW-search=' + visible.length);
  if (rows.length < 200) { console.error('HARNESS-FAIL: 國家列太少'); process.exit(1); }
  if (visible.length !== 1 || visible[0].textContent.indexOf('TW') < 0 ||
      visible[0].textContent.indexOf('TAIWAN') < 0) {
    console.error('HARNESS-FAIL: 搜尋 TW 結果錯誤: ' + (visible[0] || {}).textContent);
    process.exit(1);
  }
  // EN-source: location cell must carry no CJK literal (translated via .po at runtime)
  if (/[\u4e00-\u9fff]/.test(visible[0].textContent)) {
    console.error('HARNESS-FAIL: 地名欄殘留中文原字: ' + visible[0].textContent);
    process.exit(1);
  }
  // A1/A2 不可存在
  const vals = NODES.filter((n) => n.attrs && n.attrs.value).map((n) => n.attrs.value);
  if (vals.includes('a1') || vals.includes('a2')) {
    console.error('HARNESS-FAIL: A1/A2 不應列入');
    process.exit(1);
  }

  // 2. 取消勾 jp
  const jpBox = NODES.find((n) => n.tag === 'input' && n.attrs.type === 'checkbox' && n.attrs.value === 'jp');
  if (!jpBox) { console.error('HARNESS-FAIL: 找不到 jp checkbox'); process.exit(1); }
  jpBox.checked = false;
  await jpBox.fire('change');

  // 3. 三鍵同排（E button，點合併鍵）
  const btnByText = (t) => NODES.find((n) => n.tag === 'button' && n.textContent === t);
  const mergeBtn = btnByText('Update and Merge Now');
  const fetchBtn0 = btnByText('Update IP Sets Now');
  const saveBtn0 = btnByText('Save Settings');
  if (!mergeBtn || !fetchBtn0 || !saveBtn0) { console.error('HARNESS-FAIL: 三鍵缺失'); process.exit(1); }
  if (!(mergeBtn.parent && mergeBtn.parent === fetchBtn0.parent && fetchBtn0.parent === saveBtn0.parent)) {
    console.error('HARNESS-FAIL: 三鍵不在同一排');
    process.exit(1);
  }
  console.log('buttons-same-row OK');
  await mergeBtn.fire('click');

  const sel = store.geoguard.main.selected;
  console.log('selected after uncheck jp: ' + JSON.stringify(sel));
  if (sel.length !== 1 || sel[0] !== 'tw') {
    console.error('HARNESS-FAIL: 存檔內容錯誤');
    process.exit(1);
  }
  const selDivs0 = NODES.filter((n) => n.tag === 'div' && n.attrs && n.attrs.class === 'country-selected');
  if (selDivs0.length === 0 || selDivs0[0].textContent.indexOf('TW') < 0 ||
      selDivs0[0].textContent.indexOf('JP') >= 0) {
    console.error('HARNESS-FAIL: 已選清單行未即時更新: ' + (selDivs0[0] || {}).textContent);
    process.exit(1);
  }
  console.log('selected line OK');
  if ((store.geoguard.main.sel_asia || []).length !== 0) {
    console.error('HARNESS-FAIL: 舊 sel_asia 未清空');
    process.exit(1);
  }
  for (const need of ['/usr/bin/geoguard-update', '/usr/bin/geoguard-cron']) {
    if (!execCalls.includes(need)) {
      console.error('HARNESS-FAIL: 沒打到 ' + need);
      process.exit(1);
    }
  }
  // 4. 純白名單：全取消，selected 應被刪除（不是空陣列）
  const twBox = NODES.find((n) => n.tag === 'input' && n.attrs.type === 'checkbox' && n.attrs.value === 'tw');
  twBox.checked = false;
  await twBox.fire('change');
  const fetchBtn = NODES.find((n) => n.tag === 'button' && n.textContent === 'Update IP Sets Now');
  await fetchBtn.fire('click');
  if ('selected' in store.geoguard.main) {
    console.error('HARNESS-FAIL: 全空時 selected 應刪除，實際 ' + JSON.stringify(store.geoguard.main.selected));
    process.exit(1);
  }
  console.log('pure-whitelist (empty selected) OK');
  // 5. 記錄頁 pre 應含狀態輸出
  const pres = NODES.filter((n) => n.tag === 'pre');
  console.log('pre count=' + pres.length);
  if (!pres.some((p) => p.textContent.indexOf('Set status') >= 0)) {
    console.error('HARNESS-FAIL: 記錄頁缺少狀態輸出');
    process.exit(1);
  }
  console.log('log tab OK');
  // 6. 排程三連 select 改 weekly/4:05，存檔應寫入
  const selects = NODES.filter((n) => n.tag === 'select');
  if (selects.length < 3) { console.error('HARNESS-FAIL: 排程 select 不足 3 個'); process.exit(1); }
  // 找到頻率 select（含 daily 選項的那個）
  const freqSel = selects.find((s) => (s.children || []).some((c) => typeof c !== 'string' && c.attrs && c.attrs.value === 'weekly'));
  if (!freqSel) { console.error('HARNESS-FAIL: 找不到頻率 select'); process.exit(1); }
  freqSel.value = 'weekly';
  await freqSel.fire('change');
  // 時/分 select：取另外兩個，設 4 和 5
  const otherSels = selects.filter((s) => s !== freqSel);
  otherSels[0].value = '4';
  await otherSels[0].fire('change');
  otherSels[1].value = '5';
  await otherSels[1].fire('change');
  // 7. 集合名非法 → 按鈕應擋下（不打 update），且有錯誤通知（走 UI 輸入框真實路徑）
  const setInp = NODES.find((n) => n.tag === 'input' && n.attrs && n.attrs['data-name'] === 'setname');
  const whiteInp = NODES.find((n) => n.tag === 'input' && n.attrs && n.attrs['data-name'] === 'white_name');
  if (!setInp || !whiteInp) {
    console.error('HARNESS-FAIL: 找不到集合名輸入框');
    process.exit(1);
  }
  // 路徑前後綴裝飾（mockup 標準）
  const allText7 = NODES.map((n) => n.textContent || '').join('\n');
  if (allText7.indexOf('/etc/geoguard/') < 0 || allText7.indexOf('.cidr') < 0) {
    console.error('HARNESS-FAIL: 集合名列缺路徑前後綴');
    process.exit(1);
  }
  console.log('setname-affix OK');
  setInp.value = 'bad name!';
  await setInp.fire('change');
  store.geoguard.main.selected = ['tw'];
  const execBefore = execCalls.length;
  await mergeBtn.fire('click');
  if (execCalls.length !== execBefore) {
    console.error('HARNESS-FAIL: 非法集合名仍執行了後端');
    process.exit(1);
  }
  if (!notifications.some((t) => t.indexOf('Bad set name') >= 0)) {
    console.error('HARNESS-FAIL: 非法集合名無錯誤通知');
    process.exit(1);
  }
  console.log('setname gate OK');
  // 7b. 有效改名必須真的寫進 store（自訂輸入框寫入路徑，掉線就靜默丟失）
  setInp.value = 'NewSet';
  await setInp.fire('change');
  await saveBtn0.fire('click');
  if (store.geoguard.main.setname !== 'NewSet') {
    console.error('HARNESS-FAIL: 改名未寫入 store: ' + JSON.stringify(store.geoguard.main.setname));
    process.exit(1);
  }
  console.log('setname roundtrip OK');
  setInp.value = 'allowed-IPList';
  await setInp.fire('change');
  if (store.geoguard.main.update_freq !== 'weekly' ||
      store.geoguard.main.update_hour !== '4' ||
      store.geoguard.main.update_min !== '5') {
    console.error('HARNESS-FAIL: 排程未寫入: ' + JSON.stringify({
      f: store.geoguard.main.update_freq,
      h: store.geoguard.main.update_hour,
      m: store.geoguard.main.update_min }));
    process.exit(1);
  }
  console.log('schedule save OK');
  // 8. 已選清單行：全空後應顯示尚未勾選
  const selDivs = NODES.filter((n) => n.tag === 'div' && n.attrs && n.attrs.class === 'country-selected');
  if (selDivs.length === 0 || selDivs[0].textContent.indexOf('(none selected)') < 0) {
    console.error('HARNESS-FAIL: 已選清單行錯誤: ' + (selDivs[0] || {}).textContent);
    process.exit(1);
  }
  console.log('selected line empty OK');
  // 9. 全選 → 存檔應有 217 國；清除已選 → selected 消失
  const selAllBtn = btnByText('Select all');
  const selNoneBtn = btnByText('Clear selected');
  const clrBtn = btnByText('Clear');
  if (!selAllBtn || !selNoneBtn || !clrBtn) {
    console.error('HARNESS-FAIL: 全選/清除已選/清除按鈕缺失');
    process.exit(1);
  }
  // 先清搜尋（全選只作用於可見列）
  search.value = '';
  await search.fire('input');
  await selAllBtn.fire('click');
  await mergeBtn.fire('click');
  if ((store.geoguard.main.selected || []).length !== 217) {
    console.error('HARNESS-FAIL: 全選後應 217 國，實際 ' + (store.geoguard.main.selected || []).length);
    process.exit(1);
  }
  console.log('select-all OK (217)');
  await selNoneBtn.fire('click');
  await mergeBtn.fire('click');
  if ('selected' in store.geoguard.main) {
    console.error('HARNESS-FAIL: 清除已選後 selected 應消失');
    process.exit(1);
  }
  console.log('select-none OK');
  // 10. 搜尋清除鍵：輸入後按清除應全部可見
  search.value = 'JP';
  await search.fire('input');
  await clrBtn.fire('click');
  const rowsAgain = NODES.filter((n) => n.tag === 'tr' && n.children.some((c) => typeof c !== 'string' && c.tag === 'td'));
  if (rowsAgain.some((r) => r.style.display === 'none')) {
    console.error('HARNESS-FAIL: 搜尋清除後仍有隱藏列');
    process.exit(1);
  }
  console.log('search-clear OK');
  // 11b. 國家標頭單列：標題＋全選＋清除已選＋已選行同一父層；按鈕寬度 CSS
  const headStrong = NODES.find((n) => n.tag === 'strong' && n.textContent.indexOf('Select countries') >= 0);
  const selAllBtn2 = btnByText('Select all');
  const selNoneBtn2 = btnByText('Clear selected');
  const selDivsH = NODES.filter((n) => n.tag === 'div' && n.attrs && n.attrs.class === 'country-selected');
  if (!headStrong || !selAllBtn2 || !selNoneBtn2 || selDivsH.length === 0 ||
      !(headStrong.parent === selAllBtn2.parent && selAllBtn2.parent === selNoneBtn2.parent &&
        selNoneBtn2.parent === selDivsH[0].parent)) {
    console.error('HARNESS-FAIL: 國家標頭未同列');
    process.exit(1);
  }
  const searchInputs = NODES.filter((n) => n.tag === 'input' && n.attrs.type === 'text');
  if (searchInputs.length === 0 || searchInputs[0].parent !== headStrong.parent) {
    console.error('HARNESS-FAIL: 搜尋框不在標頭列');
    process.exit(1);
  }
  // 動作列：三鍵同父層（A1 註記已刪除）
  const abtns = ['Update IP Sets Now', 'Update and Merge Now', 'Save Settings'].map((t) =>
    NODES.find((n) => n.tag === 'button' && n.textContent === t));
  if (abtns.some((b) => !b) ||
      !(abtns[0].parent && abtns[0].parent === abtns[1].parent &&
        abtns[1].parent === abtns[2].parent)) {
    console.error('HARNESS-FAIL: 底部動作列未同列');
    process.exit(1);
  }
  console.log('header-row + action-row OK');
  const styles = NODES.filter((n) => n.tag === 'style').map((n) => n.textContent).join('');
  if (styles.indexOf('width:auto') < 0 || styles.indexOf('cbi-value-title') < 0) {
    console.error('HARNESS-FAIL: 缺少排版 CSS');
    process.exit(1);
  }
  if (styles.indexOf('flex:none') < 0 || styles.indexOf('15em') < 0) {
    console.error('HARNESS-FAIL: 缺少標題欄/輸入框收窄 CSS');
    process.exit(1);
  }
  if (styles.indexOf('overflow-wrap:anywhere') < 0 || styles.indexOf('break-all') < 0) {
    console.error('HARNESS-FAIL: 缺少溢出換行 CSS');
    process.exit(1);
  }
  console.log('header-row + css OK');
  // 11. 自動更新 checkbox 取消 → 存檔應寫 0；儲存設定鍵只存檔不跑更新
  const autoBoxes = NODES.filter((n) => n.tag === 'input' && n.attrs.type === 'checkbox' && !n.attrs.value);
  // valueless checkboxes 依建立順序：header allCb、排程 autoCb、防護 web、ssh；取第 2 個
  const autoCb = autoBoxes[1];
  if (!autoCb) { console.error('HARNESS-FAIL: 找不到自動更新 checkbox'); process.exit(1); }
  autoCb.checked = false;
  await autoCb.fire('change');
  const execBeforeSave = execCalls.length;
  try { await saveBtn0.fire('click'); } catch (e) { console.log('SAVE-CLICK-THREW=' + (e && e.message)); }
  if (store.geoguard.main.auto_update !== '0') {
    console.error('HARNESS-FAIL: auto_update 未寫入 0');
    process.exit(1);
  }
  const newExecs = execCalls.slice(execBeforeSave);
  if (!newExecs.includes('/usr/bin/geoguard-cron') || newExecs.includes('/usr/bin/geoguard-update')) {
    console.error('HARNESS-FAIL: 儲存設定鍵行為錯誤: ' + JSON.stringify(newExecs));
    process.exit(1);
  }
  console.log('auto-flag + save-button OK');
  // 12. 防護籤：ban 欄位存在（taboption 有名）＋兩鍵同列＋行為
  const banOpts = OPTS.filter((o) => o._tab === 'ban' && o._name);
  const banNames = banOpts.map((o) => o._name);
  for (const need of ['ban_enabled', '_banthresh', '_banscope', 'ban_exempt', 'ddns_allowlist', '_banperiod', 'ban_wan_if', '_bannote', '_banstatus', '_banactions']) {
    if (!banNames.includes(need)) {
      console.error('HARNESS-FAIL: 防護籤缺欄位 ' + need + ' (有: ' + JSON.stringify(banNames) + ')');
      process.exit(1);
    }
  }
  console.log('ban-fields OK');
  // 12a. 籤順：登入防護 → settings → log（找有籤的 section，頂部 counts 區無籤）
  const tabbedSection = sectionRenders.find((s) => Object.keys(s._tabs).length > 0);
  const tabOrder = Object.keys(tabbedSection._tabs);
  if (JSON.stringify(tabOrder) !== JSON.stringify(['ban', 'settings', 'log'])) {
    console.error('HARNESS-FAIL: 籤順錯誤: ' + JSON.stringify(tabOrder));
    process.exit(1);
  }
  console.log('tab-order OK');
  // 12a2. 防護籤列順：enabled, thresh, scope, exempt, ddns, period, wan, note, status, actions
  const banSeq = OPTS.filter((o) => o._tab === 'ban').map((o) => o._name);
  const wantSeq = ['ban_enabled', '_banthresh', '_banscope', 'ban_exempt', 'ddns_allowlist', '_banperiod', 'ban_wan_if', '_bannote', '_banstatus', '_banactions'];
  if (JSON.stringify(banSeq) !== JSON.stringify(wantSeq)) {
    console.error('HARNESS-FAIL: 防護列順錯誤: ' + JSON.stringify(banSeq));
    process.exit(1);
  }
  console.log('ban-row-order OK');
  // 12a3. 併列：number 輸入 ≥5 且三列 DummyValue 有渲染
  const numIns = NODES.filter((n) => n.tag === 'input' && n.attrs.type === 'number');
  if (numIns.length < 5) {
    console.error('HARNESS-FAIL: 數字輸入不足: ' + numIns.length);
    process.exit(1);
  }
  console.log('ban-rows OK');
  // 12b. 防護籤：DDNS 清單＋間隔欄位存在（已從設定籤搬家）
  const banOpts2 = OPTS.filter((o) => o._tab === 'ban' && o._name);
  const banNames2 = banOpts2.map((o) => o._name);
  for (const need of ['ddns_allowlist']) {
    if (!banNames2.includes(need)) {
      console.error('HARNESS-FAIL: 防護籤缺DDNS欄位 ' + need);
      process.exit(1);
    }
  }
  // ddns_interval 是併列自訂輸入：用 pushBan 寫入斷言（見 ban-actions）
  const numLabels = NODES.filter((n) => n.tag === 'label').map((n) => n.textContent);
  // 自訂列標籤走 DOM；框架欄位標題走原始碼（含 po msgid 一致性由 i18n-check 管）
  for (const need of ['Log review and ban interval (sec)', 'Within (minutes)']) {
    if (!numLabels.some((t) => t.indexOf(need) >= 0)) {
      console.error('HARNESS-FAIL: 併列缺標籤 ' + need);
      process.exit(1);
    }
  }
  for (const need of ['Never-block whitelist', 'Unban all IPs', 'IP Geolocation - Primary Feed', 'IP Geolocation - Backup Feed', 'Enable this option to block IP addresses with too many failed logins']) {
    if (code.indexOf(need) < 0) {
      console.error('HARNESS-FAIL: 缺新標籤 ' + need);
      process.exit(1);
    }
  }
  // 國家列按國碼遞增
  // 國家列按國碼遞增（走 tbody 樹順序＋去重；stub append 不搬移，註冊表順序不準）
  const tbody = NODES.find((n) => n.tag === 'tbody');
  const trs = tbody ? tbody.children.filter((c) => c && c.tag === 'tr') : [];
  const seen = new Set();
  const uniqRev = [];
  for (let i = trs.length - 1; i >= 0; i--) {
    if (!seen.has(trs[i])) { seen.add(trs[i]); uniqRev.push(trs[i]); }
  }
  const ordered = uniqRev.reverse();
  const codeCells = ordered.map((tr) => {
    const tds = (tr.children || []).filter((c) => c && c.tag === 'td');
    return tds.length > 1 ? (tds[1].textContent || '').trim().toLowerCase() : '';
  }).filter((s) => /^[a-z]{2}$/.test(s));
  const sortedCodes = codeCells.slice().sort();
  if (codeCells.length < 200 || JSON.stringify(codeCells) !== JSON.stringify(sortedCodes)) {
    console.error('HARNESS-FAIL: 國家列未按國碼排序');
    process.exit(1);
  }
  console.log('labels+sort OK');
  const setOpts = OPTS.filter((o) => o._tab === 'settings' && o._name);
  const setNames = setOpts.map((o) => o._name);
  if (setNames.includes('company_ddns') || setNames.includes('ddns_interval')) {
    console.error('HARNESS-FAIL: DDNS欄位還在設定籤');
    process.exit(1);
  }
  console.log('ddns-fields OK');
  // 12c. 全擋說明的數字跟著參數走（store ban_bantime=2 → 含「2 小時」）
  const allText = NODES.map((n) => n.textContent || '').join('\n');
  if (allText.indexOf('auto-released after 2 hours') < 0) {
    console.error('HARNESS-FAIL: 全擋說明未帶參數值');
    process.exit(1);
  }
  if (/auto-released after \d+ hours/.test(allText) && allText.indexOf('auto-released after 2 hours') < 0) {
    console.error('HARNESS-FAIL: 全擋說明數字寫死');
    process.exit(1);
  }
  console.log('bannote-dynamic OK');
  const banSaveBtn = btnByText('Save & Restart Guard');
  const unbanBtn = btnByText('Unban all IPs');
  if (!banSaveBtn || !unbanBtn || banSaveBtn.parent !== unbanBtn.parent) {
    console.error('HARNESS-FAIL: 防護按鍵缺失或不同列');
    process.exit(1);
  }
  console.log('ban-buttons-same-row OK');
  // 先摸一下防護數字框（dirty 才寫入，否則 pushBan 無寫斷言必倒）
  const banNums = NODES.filter((n) => n.tag === 'input' && n.attrs && n.attrs.type === 'number');
  if (banNums.length === 0) { console.error('HARNESS-FAIL: 找不到防護數字框'); process.exit(1); }
  banNums[0].value = '7';
  await banNums[0].fire('change');
  const execBeforeBan = execCalls.length;
  await banSaveBtn.fire('click');
  await unbanBtn.fire('click');
  const banExecs = execCalls.slice(execBeforeBan);
  if (!banExecs.includes('/etc/init.d/geoguard-ban') || !banExecs.includes('/usr/bin/geoguard-ban-unban') || !banExecs.includes('/usr/bin/geoguard-ban-guard')) {
    console.error('HARNESS-FAIL: 防護按鍵未打到後端: ' + JSON.stringify(banExecs));
    process.exit(1);
  }
  // pushBan：存檔後 store 應有併列欄位值
  for (const k of ['ban_maxretry', 'ban_findtime', 'ban_bantime', 'ban_web', 'ban_ssh', 'ddns_interval', 'ban_interval']) {
    if (!(k in store.geoguard.main)) {
      console.error('HARNESS-FAIL: pushBan 未寫入 ' + k);
      process.exit(1);
    }
  }
  console.log('ban-actions OK');
  // 12d. apply code 5（空變更）應放行，真錯誤仍報錯
  notifications.length = 0;
  applyMode = 'nodata';
  await banSaveBtn.fire('click');
  if (!notifications.some((t) => t.indexOf('Guard settings saved and restarted') >= 0)) {
    console.error('HARNESS-FAIL: code5 未被放行: ' + JSON.stringify(notifications));
    process.exit(1);
  }
  console.log('apply-nodata OK');
  notifications.length = 0;
  applyMode = 'boom';
  await banSaveBtn.fire('click');
  if (!notifications.some((t) => t.indexOf('Failed:') >= 0)) {
    console.error('HARNESS-FAIL: 真錯誤被吞掉: ' + JSON.stringify(notifications));
    process.exit(1);
  }
  applyMode = 'ok';
  console.log('apply-realerror OK');
  // 12e. code 6 重試一次後成功
  notifications.length = 0;
  applyMode = 'flaky6';
  await banSaveBtn.fire('click');
  if (!notifications.some((t) => t.indexOf('Guard settings saved and restarted') >= 0)) {
    console.error('HARNESS-FAIL: code6 重試未成功: ' + JSON.stringify(notifications));
    process.exit(1);
  }
  applyMode = 'ok';
  console.log('apply-retry6 OK');
  // 12f. 連打：第二、三下忽略，忙時按鈕鎖定，後端只跑一次
  const realExec = fsStub.exec;
  let updateGate = null;
  let updateRuns = 0;
  fsStub.exec = (cmd) => {
    if (cmd === '/usr/bin/geoguard-update') {
      updateRuns++;
      return new Promise((res) => { updateGate = () => res({ code: 0 }); });
    }
    return realExec(cmd);
  };
  notifications.length = 0;
  const q1 = abtns[1].fire('click');
  const lockedDuring = abtns[0].disabled === true && abtns[1].disabled === true &&
    abtns[2].disabled === true && banSaveBtn.disabled === true && unbanBtn.disabled === true;
  const q2 = abtns[1].fire('click');
  const q3 = banSaveBtn.fire('click');
  for (let i = 0; i < 200 && updateRuns === 0; i++)
    await new Promise((r) => setTimeout(r, 10));
  if (updateRuns !== 1) {
    console.error('HARNESS-FAIL: 連打後端跑了 ' + updateRuns + ' 次');
    process.exit(1);
  }
  if (!lockedDuring) {
    console.error('HARNESS-FAIL: 忙時按鈕未鎖定');
    process.exit(1);
  }
  updateGate();
  await q1; await q2; await q3;
  if (abtns[1].disabled !== false || banSaveBtn.disabled !== false) {
    console.error('HARNESS-FAIL: 跑完按鈕未解鎖');
    process.exit(1);
  }
  if (!notifications.some((t) => t.indexOf('Updated and merged successfully') >= 0)) {
    console.error('HARNESS-FAIL: 連打後成功提示缺失: ' + JSON.stringify(notifications));
    process.exit(1);
  }
  fsStub.exec = realExec;
  console.log('rapid-click OK');
  // 12g. cron 註解：英文唯一＋兩檔 NOTE_DDNS 一字不差＋有用 $DNOTE/$UNOTE
  const cronSh = fs.readFileSync(__dirname + '/../luci-app-geoguard/root/usr/bin/geoguard-cron', 'utf8');
  const ddnsSh = fs.readFileSync(__dirname + '/../luci-app-geoguard/root/usr/bin/geoguard-ddns', 'utf8');
  const noteOf = (s, n) => { const m = s.match(new RegExp('^NOTE_' + n + "='(.*)'$", 'm')); return m && m[1]; };
  if (!noteOf(cronSh, 'DDNS') || !noteOf(cronSh, 'UPDATE')) {
    console.error('HARNESS-FAIL: cron 缺 NOTE');
    process.exit(1);
  }
  if (noteOf(ddnsSh, 'DDNS') !== noteOf(cronSh, 'DDNS')) {
    console.error('HARNESS-FAIL: cron 註解兩檔不一致');
    process.exit(1);
  }
  if (/[\u4e00-\u9fff]/.test(noteOf(cronSh, 'DDNS') + noteOf(cronSh, 'UPDATE'))) {
    console.error('HARNESS-FAIL: cron 註解殘留中文');
    process.exit(1);
  }
  if (cronSh.indexOf('$DNOTE') < 0 || cronSh.indexOf('$UNOTE') < 0 || ddnsSh.indexOf('$NOTE_DDNS') < 0) {
    console.error('HARNESS-FAIL: cron 註解未使用');
    process.exit(1);
  }
  console.log('cron-notes OK');
  // 12h. msgid 禁頭尾空格（尾空格會翻不出來，見 Selected 之禍）
  const wsRe = /_\(\s*'((?:\\.|[^'\\])*)'\s*\)/g;
  let wsm;
  while ((wsm = wsRe.exec(code)) !== null) {
    const s = wsm[1].replace(/\\'/g, "'");
    if (s && s !== s.trim()) {
      console.error('HARNESS-FAIL: msgid 頭尾空格: ' + JSON.stringify(s.slice(0, 40)));
      process.exit(1);
    }
  }
  console.log('msgid-trim OK');
  // 12i. 啟用行加粗綠字
  const countsDivs = NODES.filter((n) => n.tag === 'div' && n.attrs && n.attrs.class === 'country-counts');
  if (countsDivs.length === 0 || (countsDivs[0].attrs.style || '').indexOf('bold') < 0) {
    console.error('HARNESS-FAIL: 啟用行未加粗');
    process.exit(1);
  }
  console.log('counts-emphasis OK');
  // 12j. M2: /0 不得放行（UI 兩處 validate＋後端）
  const maskNew = (code.match(/\(\[1-9\]\|\[12\]\[0-9\]\|3\[0-2\]\)/g) || []).length;
  if (maskNew < 2 || /\(\[0-9\]\|\[12\]\[0-9\]\|3\[0-2\]\)/.test(code)) {
    console.error('HARNESS-FAIL: /0 未鎖死');
    process.exit(1);
  }
  console.log('mask-nozero OK');
  // 12k. 後端靜態斷言（H1/H2/L5/M2/M5）
  const upd = fs.readFileSync(__dirname + '/../luci-app-geoguard/root/usr/bin/geoguard-update', 'utf8');
  const banSh = fs.readFileSync(__dirname + '/../luci-app-geoguard/root/usr/bin/geoguard-ban', 'utf8');
  const grdSh = fs.readFileSync(__dirname + '/../luci-app-geoguard/root/usr/bin/geoguard-ban-guard', 'utf8');
  const cntSh = fs.readFileSync(__dirname + '/../luci-app-geoguard/root/usr/bin/geoguard-counts', 'utf8');
  const needs = [
    [upd, 'another run in progress', 'H2 flock'],
    [upd, 'still referenced by rules, kept', 'H1 留引用'],
    [upd, 'nft delete set inet fw4 "$gone"', 'L5 清殘留殼'],
    [upd, 'rule repoint', '改名 repoint'],
    [banSh, 'nft get element inet fw4 geoguard_exempt', 'M2 nft 豁免查詢'],
    [grdSh, '/([1-9]|[12][0-9]|3[0-2])', 'M2 嚴格遮罩'],
    [cntSh, "A-B ranges have no '/'", 'M5 計數修正'],
  ];
  for (const [src, needle, label] of needs) {
    if (src.indexOf(needle) < 0) {
      console.error('HARNESS-FAIL: 缺 ' + label + ': ' + needle);
      process.exit(1);
    }
  }
  // repoint 必須跑在 stale 清理之前（否則改名觸發 H1 誤殺）
  if (upd.indexOf('rule repoint') > upd.indexOf('still referenced by rules, kept')) {
    console.error('HARNESS-FAIL: repoint 順序在 H1 之後');
    process.exit(1);
  }
  console.log('backend-static OK');
  // 12l. 未觸碰各組就存檔：ban/sched/name 不得被動到（fallback 覆寫防線）
  for (const o of OPTS) {
    if (o._name && ['_banthresh', '_banscope', '_banperiod', '_sched', '_setnames', '_countries', '_whitelist'].includes(o._name) && typeof o.render === 'function')
      await o.render.call({ map: fakeMap });
  }
  const snapGroups = () => JSON.stringify({ b: store.geoguard.main.ban_maxretry, s: store.geoguard.main.update_freq, n: store.geoguard.main.setname });
  const snapBefore = snapGroups();
  await saveBtn0.fire('click');
  await banSaveBtn.fire('click');
  if (snapGroups() !== snapBefore) {
    console.error('HARNESS-FAIL: 未觸碰卻改寫分組值: ' + snapBefore + ' -> ' + snapGroups());
    process.exit(1);
  }
  console.log('groups-clean-save OK');
  // 12m. counts 檢查時間格式＋Reload 鈕
  const countsDivs2 = NODES.filter((n) => n.tag === 'div' && n.attrs && n.attrs.class === 'country-counts');
  const lastCounts = countsDivs2.length ? countsDivs2[countsDivs2.length - 1].textContent : '';
  if (lastCounts.indexOf('checked') < 0 || lastCounts.indexOf('658') < 0) {
    console.error('HARNESS-FAIL: counts 檢查格式缺失: ' + lastCounts.slice(0, 120));
    process.exit(1);
  }
  console.log('counts-checked OK');
  const rldBtn = btnByText('Reload Log');
  if (!rldBtn) { console.error('HARNESS-FAIL: 缺重新載入鈕'); process.exit(1); }
  const stCalls = execCalls.filter((c) => c === '/usr/bin/geoguard-status').length;
  await rldBtn.fire('click');
  if (execCalls.filter((c) => c === '/usr/bin/geoguard-status').length !== stCalls + 1) {
    console.error('HARNESS-FAIL: Reload 未重跑狀態');
    process.exit(1);
  }
  console.log('reload-log OK');
  // 12n. status 豐富化標記（後端靜態）
  const stSh = fs.readFileSync(__dirname + '/../luci-app-geoguard/root/usr/bin/geoguard-status', 'utf8');
  for (const needle of ['Per-country files:', 'Whitelist file:', 'KiB', 'merged ranges', 'livecount']) {
    if (stSh.indexOf(needle) < 0) {
      console.error('HARNESS-FAIL: status 缺 ' + needle);
      process.exit(1);
    }
  }
  // status 與 counts 同一套 live 算法
  const pipeLine = "sed -n '/elements = {/,/}/p' | tr -d '{}' | sed 's/elements = //'";
  if (stSh.indexOf(pipeLine) < 0) {
    console.error('HARNESS-FAIL: status/counts 管線分叉');
    process.exit(1);
  }
  console.log('status-rich OK');
  // 12o. v2.1.9 後端靜態斷言（孤兒掃蕩＋持久化＋M4）
  const upd2 = fs.readFileSync(__dirname + '/../luci-app-geoguard/root/usr/bin/geoguard-update', 'utf8');
  const ban2 = fs.readFileSync(__dirname + '/../luci-app-geoguard/root/usr/bin/geoguard-ban', 'utf8');
  const unb2 = fs.readFileSync(__dirname + '/../luci-app-geoguard/root/usr/bin/geoguard-ban-unban', 'utf8');
  const init2 = fs.readFileSync(__dirname + '/../luci-app-geoguard/root/etc/init.d/geoguard-ban', 'utf8');
  const needs2 = [
    [upd2, 'loadfile lives in our uploads dir', '孤兒掃蕩註解'],
    [upd2, 'STALE_GONE="$STALE_GONE $nm"', '殘留追蹤'],
    [ban2, 'persist_ban', '持久化寫入'],
    [ban2, 'prune_persist', '過期清理'],
    [ban2, 'Exit before auth', 'M4 dropbear 覆蓋'],
    [ban2, "tr -d '<>'", '尖括號剝離'],
    [unb2, 'ban-persist', '解封清 persist'],
    [unb2, '|| true', 'grep 空行容錯'],
    [init2, 'ban-persist.list', '開機還原'],
    [init2, 'remaining time only', '剩餘時間註解'],
  ];
  for (const [src, needle, label] of needs2) {
    if (src.indexOf(needle) < 0) {
      console.error('HARNESS-FAIL: 缺 ' + label + ': ' + needle);
      process.exit(1);
    }
  }
  // MANAGED 舊迴圈必須退役（被命名空間掃蕩取代）
  if (/for m in \$MANAGED/.test(upd2)) {
    console.error('HARNESS-FAIL: MANAGED 舊迴圈還在');
    process.exit(1);
  }
  console.log('persist-sweep OK');
  console.log('HARNESS-DONE');
})().catch((e) => { console.error('HARNESS-FAIL:', e.stack.split('\n').slice(0, 3).join(' | ')); process.exit(1); });
