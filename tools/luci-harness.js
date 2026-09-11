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
  console.error('HARNESS-FAIL: setname 不可用 uciname（連字號會被擋）');
  process.exit(1);
}

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
    taboption: function(tab) {
      if (!this._tabs[tab])
        throw new ReferenceError('Associated tab not declared');
      const o = mkOpt(); o._tab = tab; OPTS.push(o); return o;
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
let statusCalls = 0;
const fsStub = {
  list: () => Promise.resolve([]),
  exec: (cmd) => {
    execCalls.push(cmd);
    if (cmd === '/usr/bin/countryallow-status') {
      statusCalls++;
      if (statusCalls === 1)
        return Promise.resolve({ code: 0, stdout: '===== 集合狀態 =====\n集合檔：x (100 行)\n===== 更新歷史（近 20 筆） =====\n2026-09-11|update|ok\n' });
      return Promise.resolve({ code: 0, stdout: '===== 集合狀態 =====\n===== 更新歷史（近 20 筆） =====\n（尚無記錄）\n' });
    }
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
    setname: 'allowed-IPList', white_name: 'MyAllowed', update_freq: 'daily', update_hour: '3', update_min: '10',
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
  applyCalls: 0,
  apply: function() { this.applyCalls++; execCalls.push('APPLY'); return Promise.resolve(0); },
};

const document = { createTextNode: (t) => t };
const factory = new Function('view', 'form', 'fs', 'ui', 'uci', 'E', '_', 'document', code);
const v = factory(view, form, fsStub, ui, uci, E, _, document);

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
  if (execCalls.indexOf('APPLY') < 0 || execCalls.indexOf('APPLY') > execCalls.indexOf('/usr/bin/countryallow-update')) {
    console.error('HARNESS-FAIL: uci.apply 未在更新前執行');
    process.exit(1);
  }
  console.log('apply-before-exec OK');
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
  const newGateExecs = execCalls.slice(execBefore).filter((c) => c !== 'APPLY');
  if (newGateExecs.length !== 0) {
    process.exit(1);
  }
  if (!notifications.some((t) => t.indexOf('不合規格') >= 0)) {
    console.error('HARNESS-FAIL: 非法集合名無錯誤通知');
    process.exit(1);
  }
  console.log('setname gate OK');
  store.countryallow.main.setname = 'allowed-IPList';
  store.countryallow.main.white_name = 'bad name!';
  const execBeforeW = execCalls.length;
  await mergeBtn.fire('click');
  const newGateExecsW = execCalls.slice(execBeforeW).filter((c) => c !== 'APPLY');
  if (newGateExecsW.length !== 0) {
    process.exit(1);
  }
  console.log('white-name gate OK');
  store.countryallow.main.white_name = 'MyAllowed';
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
  // 動作列：A1 註＋三鍵同父層
  const footNote = NODES.find((n) => n.tag === 'span' && n.textContent.indexOf('A1') >= 0);
  const abtns = ['立即更新 IP 集合', '立即更新並合併', '儲存設定'].map((t) =>
    NODES.find((n) => n.tag === 'button' && n.textContent === t));
  if (!footNote || abtns.some((b) => !b) ||
      !(footNote.parent === abtns[0].parent && abtns[0].parent === abtns[1].parent &&
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
  // valueless checkboxes: header allCb + autoCb；取最後一個（排程區較晚建立）
  const autoCb = autoBoxes[autoBoxes.length - 1];
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
  // 12b. 清除更新歷史 → 跑 clear 腳本＋pre 重刷為空
  const clrHist = NODES.find((n) => n.tag === 'button' && n.textContent === '清除更新歷史');
  if (!clrHist) { console.error('HARNESS-FAIL: 找不到清除更新歷史鍵'); process.exit(1); }
  await clrHist.fire('click');
  if (!execCalls.includes('/usr/bin/countryallow-clear-history')) {
    console.error('HARNESS-FAIL: 沒打到清除腳本');
    process.exit(1);
  }
  const pres2 = NODES.filter((n) => n.tag === 'pre');
  if (!pres2.some((p) => p.textContent.indexOf('尚無記錄') >= 0)) {
    console.error('HARNESS-FAIL: 清除後 pre 未更新');
    process.exit(1);
  }
  console.log('clear-history OK');
  // 12. 白名單自訂新增列：非法擋下、合法加入、刪除、存檔
  const wlInput = NODES.find((n) => n.tag === 'input' && n.attrs.type === 'text' && (n.attrs.placeholder || '').indexOf('203.0.113.10') >= 0);
  const wlAdd = NODES.find((n) => n.tag === 'button' && n.textContent === '新增');
  const wlErr = NODES.find((n) => n.tag === 'div' && n.attrs.class === 'wl-error');
  const wlList = NODES.find((n) => n.tag === 'div' && n.attrs.class === 'wl-list');
  if (!wlInput || !wlAdd || !wlErr || !wlList) { console.error('HARNESS-FAIL: 白名單自訂列缺件'); process.exit(1); }
  const wlCount = () => wlList.children.length;
  const n0 = wlCount();
  for (const bad of ['999.1.1.1', '1.2.3.4/33', 'abc']) {
    wlInput.value = bad;
    await wlAdd.fire('click');
    if (wlCount() !== n0 || wlErr.textContent === '') { console.error('HARNESS-FAIL: 非法白名單未擋下: ' + bad); process.exit(1); }
  }
  wlInput.value = '10.7.7.1-10.7.7.3';
  await wlAdd.fire('click');
  if (wlCount() !== n0 + 1 || wlErr.textContent !== '') { console.error('HARNESS-FAIL: 合法範圍未加入'); process.exit(1); }
  // 刪掉剛加的（最後一個刪除鍵）
  const delBtns = NODES.filter((n) => n.tag === 'button' && n.textContent === '刪除');
  await delBtns[delBtns.length - 1].fire('click');
  if (wlCount() !== n0) { console.error('HARNESS-FAIL: 白名單刪除失敗'); process.exit(1); }
  // 再加一個真的要存的
  wlInput.value = '10.9.9.9';
  await wlAdd.fire('click');
  // 存檔（用儲存設定鍵，只驗 UCI，不跑後端）
  const saveOnly = NODES.find((n) => n.tag === 'button' && n.textContent === '儲存設定');
  await saveOnly.fire('click');
  const wlStored = store.countryallow.main.whitelist || [];
  if (wlStored.indexOf('10.9.9.9') < 0) { console.error('HARNESS-FAIL: 白名單未存入 UCI: ' + JSON.stringify(wlStored)); process.exit(1); }
  // 清掉測試殘留
  store.countryallow.main.whitelist = ['158.101.65.154'];
  console.log('whitelist-custom-row OK');
  console.log('HARNESS-DONE');
})().catch((e) => { console.error('HARNESS-FAIL:', e.stack.split('\n').slice(0, 3).join(' | ')); process.exit(1); });
