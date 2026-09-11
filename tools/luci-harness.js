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
if (code.indexOf('IPs 設定') < 0) {
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
    if (cmd === '/usr/bin/countryallow-status')
      return Promise.resolve({ code: 0, stdout: '===== 集合狀態 =====\n集合檔：x (100 行)\n===== 更新歷史（近 20 筆） =====\n2026-09-11|update|ok\n' });
    return Promise.resolve({ code: 0 });
  },
};
const ui = {
  createHandlerFn: (t, f) => f.bind(t),
  addNotification: (a, b) => { notifications.push(b ? b.textContent : ''); },
};
const notifications = [];
const store = {
  countryallow: { main: {
    selected: [], sel_asia: ['tw', 'jp'], sel_europe: [],
    sel_africa: [], sel_northamerica: [], sel_southamerica: [], sel_oceania: [],
    setname: 'allowed-IPList', update_freq: 'daily', update_hour: '3', update_min: '10',
    ban_enabled: '1', ban_maxretry: '8', ban_findtime: '5', ban_bantime: '2',
    ban_web: '1', ban_ssh: '1',
  } },
};
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
  apply: () => Promise.resolve(),
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
      visible[0].textContent.indexOf('台灣/TAIWAN') < 0) {
    console.error('HARNESS-FAIL: 搜尋 TW 結果錯誤: ' + (visible[0] || {}).textContent);
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
  const mergeBtn = btnByText('立即更新並合併');
  const fetchBtn0 = btnByText('立即更新 IP 集合');
  const saveBtn0 = btnByText('儲存設定');
  if (!mergeBtn || !fetchBtn0 || !saveBtn0) { console.error('HARNESS-FAIL: 三鍵缺失'); process.exit(1); }
  if (!(mergeBtn.parent && mergeBtn.parent === fetchBtn0.parent && fetchBtn0.parent === saveBtn0.parent)) {
    console.error('HARNESS-FAIL: 三鍵不在同一排');
    process.exit(1);
  }
  console.log('buttons-same-row OK');
  await mergeBtn.fire('click');

  const sel = store.countryallow.main.selected;
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
  if ((store.countryallow.main.sel_asia || []).length !== 0) {
    console.error('HARNESS-FAIL: 舊 sel_asia 未清空');
    process.exit(1);
  }
  for (const need of ['/usr/bin/countryallow-update', '/usr/bin/countryallow-cron']) {
    if (!execCalls.includes(need)) {
      console.error('HARNESS-FAIL: 沒打到 ' + need);
      process.exit(1);
    }
  }
  // 4. 純白名單：全取消，selected 應被刪除（不是空陣列）
  const twBox = NODES.find((n) => n.tag === 'input' && n.attrs.type === 'checkbox' && n.attrs.value === 'tw');
  twBox.checked = false;
  await twBox.fire('change');
  const fetchBtn = NODES.find((n) => n.tag === 'button' && n.textContent === '立即更新 IP 集合');
  await fetchBtn.fire('click');
  if ('selected' in store.countryallow.main) {
    console.error('HARNESS-FAIL: 全空時 selected 應刪除，實際 ' + JSON.stringify(store.countryallow.main.selected));
    process.exit(1);
  }
  console.log('pure-whitelist (empty selected) OK');
  // 5. 記錄頁 pre 應含狀態輸出
  const pres = NODES.filter((n) => n.tag === 'pre');
  console.log('pre count=' + pres.length);
  if (!pres.some((p) => p.textContent.indexOf('集合狀態') >= 0)) {
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
  // 7. 集合名非法 → 按鈕應擋下（不打 update），且有錯誤通知
  store.countryallow.main.setname = 'bad name!';
  store.countryallow.main.selected = ['tw'];
  const execBefore = execCalls.length;
  await mergeBtn.fire('click');
  if (execCalls.length !== execBefore) {
    console.error('HARNESS-FAIL: 非法集合名仍執行了後端');
    process.exit(1);
  }
  if (!notifications.some((t) => t.indexOf('不合規格') >= 0)) {
    console.error('HARNESS-FAIL: 非法集合名無錯誤通知');
    process.exit(1);
  }
  console.log('setname gate OK');
  store.countryallow.main.setname = 'allowed-IPList';
  if (store.countryallow.main.update_freq !== 'weekly' ||
      store.countryallow.main.update_hour !== '4' ||
      store.countryallow.main.update_min !== '5') {
    console.error('HARNESS-FAIL: 排程未寫入: ' + JSON.stringify({
      f: store.countryallow.main.update_freq,
      h: store.countryallow.main.update_hour,
      m: store.countryallow.main.update_min }));
    process.exit(1);
  }
  console.log('schedule save OK');
  // 8. 已選清單行：全空後應顯示尚未勾選
  const selDivs = NODES.filter((n) => n.tag === 'div' && n.attrs && n.attrs.class === 'country-selected');
  if (selDivs.length === 0 || selDivs[0].textContent.indexOf('尚未勾選') < 0) {
    console.error('HARNESS-FAIL: 已選清單行錯誤: ' + (selDivs[0] || {}).textContent);
    process.exit(1);
  }
  console.log('selected line empty OK');
  // 9. 全選 → 存檔應有 217 國；清除已選 → selected 消失
  const selAllBtn = btnByText('全選');
  const selNoneBtn = btnByText('清除已選');
  const clrBtn = btnByText('清除');
  if (!selAllBtn || !selNoneBtn || !clrBtn) {
    console.error('HARNESS-FAIL: 全選/清除已選/清除按鈕缺失');
    process.exit(1);
  }
  // 先清搜尋（全選只作用於可見列）
  search.value = '';
  await search.fire('input');
  await selAllBtn.fire('click');
  await mergeBtn.fire('click');
  if ((store.countryallow.main.selected || []).length !== 217) {
    console.error('HARNESS-FAIL: 全選後應 217 國，實際 ' + (store.countryallow.main.selected || []).length);
    process.exit(1);
  }
  console.log('select-all OK (217)');
  await selNoneBtn.fire('click');
  await mergeBtn.fire('click');
  if ('selected' in store.countryallow.main) {
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
  const headStrong = NODES.find((n) => n.tag === 'strong' && n.textContent.indexOf('選擇國家') >= 0);
  const selAllBtn2 = btnByText('全選');
  const selNoneBtn2 = btnByText('清除已選');
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
  const abtns = ['立即更新 IP 集合', '立即更新並合併', '儲存設定'].map((t) =>
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
  if (store.countryallow.main.auto_update !== '0') {
    console.error('HARNESS-FAIL: auto_update 未寫入 0');
    process.exit(1);
  }
  const newExecs = execCalls.slice(execBeforeSave);
  if (!newExecs.includes('/usr/bin/countryallow-cron') || newExecs.includes('/usr/bin/countryallow-update')) {
    console.error('HARNESS-FAIL: 儲存設定鍵行為錯誤: ' + JSON.stringify(newExecs));
    process.exit(1);
  }
  console.log('auto-flag + save-button OK');
  // 12. 防護籤：ban 欄位存在（taboption 有名）＋兩鍵同列＋行為
  const banOpts = OPTS.filter((o) => o._tab === 'ban' && o._name);
  const banNames = banOpts.map((o) => o._name);
  for (const need of ['ban_enabled', '_banthresh', '_banscope', 'ban_exempt', 'company_ddns', '_banperiod', 'ban_wan_if', '_bannote', '_banstatus', '_banactions']) {
    if (!banNames.includes(need)) {
      console.error('HARNESS-FAIL: 防護籤缺欄位 ' + need + ' (有: ' + JSON.stringify(banNames) + ')');
      process.exit(1);
    }
  }
  console.log('ban-fields OK');
  // 12a. 籤順：登入防護 → settings → log
  const tabOrder = Object.keys(sectionRenders[0]._tabs);
  if (JSON.stringify(tabOrder) !== JSON.stringify(['ban', 'settings', 'log'])) {
    console.error('HARNESS-FAIL: 籤順錯誤: ' + JSON.stringify(tabOrder));
    process.exit(1);
  }
  console.log('tab-order OK');
  // 12a2. 防護籤列順：enabled, thresh, scope, exempt, ddns, period, wan, note, status, actions
  const banSeq = OPTS.filter((o) => o._tab === 'ban').map((o) => o._name);
  const wantSeq = ['ban_enabled', '_banthresh', '_banscope', 'ban_exempt', 'company_ddns', '_banperiod', 'ban_wan_if', '_bannote', '_banstatus', '_banactions'];
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
  for (const need of ['company_ddns']) {
    if (!banNames2.includes(need)) {
      console.error('HARNESS-FAIL: 防護籤缺DDNS欄位 ' + need);
      process.exit(1);
    }
  }
  // ddns_interval 是併列自訂輸入：用 pushBan 寫入斷言（見 ban-actions）
  const numLabels = NODES.filter((n) => n.tag === 'label').map((n) => n.textContent);
  for (const need of ['DDNS 檢查間隔', '巡邏間隔']) {
    if (!numLabels.some((t) => t.indexOf(need) >= 0)) {
      console.error('HARNESS-FAIL: 併列缺標籤 ' + need);
      process.exit(1);
    }
  }
  const setOpts = OPTS.filter((o) => o._tab === 'settings' && o._name);
  const setNames = setOpts.map((o) => o._name);
  if (setNames.includes('company_ddns') || setNames.includes('ddns_interval')) {
    console.error('HARNESS-FAIL: DDNS欄位還在設定籤');
    process.exit(1);
  }
  console.log('ddns-fields OK');
  // 12c. 全擋說明的數字跟著參數走（store ban_bantime=2 → 含「2 小時」）
  const allText = NODES.map((n) => n.textContent || '').join('\n');
  if (allText.indexOf('2 小時自動解封') < 0) {
    console.error('HARNESS-FAIL: 全擋說明未帶參數值');
    process.exit(1);
  }
  if (/\d 小時自動解封/.test(allText) && allText.indexOf('2 小時自動解封') < 0) {
    console.error('HARNESS-FAIL: 全擋說明數字寫死');
    process.exit(1);
  }
  console.log('bannote-dynamic OK');
  const banSaveBtn = btnByText('儲存防護設定並重啟');
  const unbanBtn = btnByText('全部解封');
  if (!banSaveBtn || !unbanBtn || banSaveBtn.parent !== unbanBtn.parent) {
    console.error('HARNESS-FAIL: 防護按鍵缺失或不同列');
    process.exit(1);
  }
  console.log('ban-buttons-same-row OK');
  const execBeforeBan = execCalls.length;
  await banSaveBtn.fire('click');
  await unbanBtn.fire('click');
  const banExecs = execCalls.slice(execBeforeBan);
  if (!banExecs.includes('/etc/init.d/luci-ban') || !banExecs.includes('/usr/bin/countryallow-ban-unban') || !banExecs.includes('/usr/bin/countryallow-ban-guard')) {
    console.error('HARNESS-FAIL: 防護按鍵未打到後端: ' + JSON.stringify(banExecs));
    process.exit(1);
  }
  // pushBan：存檔後 store 應有併列欄位值
  for (const k of ['ban_maxretry', 'ban_findtime', 'ban_bantime', 'ban_web', 'ban_ssh', 'ddns_interval', 'ban_interval']) {
    if (!(k in store.countryallow.main)) {
      console.error('HARNESS-FAIL: pushBan 未寫入 ' + k);
      process.exit(1);
    }
  }
  console.log('ban-actions OK');
  console.log('HARNESS-DONE');
})().catch((e) => { console.error('HARNESS-FAIL:', e.stack.split('\n').slice(0, 3).join(' | ')); process.exit(1); });
