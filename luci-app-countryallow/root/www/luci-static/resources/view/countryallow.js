'use strict';
'require view';
'require form';
'require fs';
'require ui';
'require uci';

var CONTINENTS = [
	['asia', '亞洲', [
		['af', '阿富汗', 'AFGHANISTAN'], ['am', '亞美尼亞', 'ARMENIA'], ['az', '亞塞拜然', 'AZERBAIJAN'],
		['bd', '孟加拉', 'BANGLADESH'], ['bh', '巴林', 'BAHRAIN'], ['bn', '汶萊', 'BRUNEI'],
		['bt', '不丹', 'BHUTAN'], ['cn', '中國', 'CHINA'], ['cy', '塞普勒斯', 'CYPRUS'],
		['ge', '喬治亞', 'GEORGIA'], ['hk', '香港', 'HONG KONG'], ['id', '印尼', 'INDONESIA'],
		['il', '以色列', 'ISRAEL'], ['in', '印度', 'INDIA'], ['iq', '伊拉克', 'IRAQ'],
		['ir', '伊朗', 'IRAN'], ['jo', '約旦', 'JORDAN'], ['jp', '日本', 'JAPAN'],
		['kg', '吉爾吉斯', 'KYRGYZSTAN'], ['kh', '柬埔寨', 'CAMBODIA'], ['kp', '北韓', 'NORTH KOREA'],
		['kr', '南韓', 'SOUTH KOREA'], ['kw', '科威特', 'KUWAIT'], ['kz', '哈薩克', 'KAZAKHSTAN'],
		['la', '寮國', 'LAOS'], ['lb', '黎巴嫩', 'LEBANON'], ['lk', '斯里蘭卡', 'SRI LANKA'],
		['mm', '緬甸', 'MYANMAR'], ['mn', '蒙古', 'MONGOLIA'], ['mo', '澳門', 'MACAO'],
		['my', '馬來西亞', 'MALAYSIA'], ['np', '尼泊爾', 'NEPAL'], ['om', '阿曼', 'OMAN'],
		['ph', '菲律賓', 'PHILIPPINES'], ['pk', '巴基斯坦', 'PAKISTAN'], ['ps', '巴勒斯坦', 'PALESTINE'],
		['qa', '卡達', 'QATAR'], ['sa', '沙烏地阿拉伯', 'SAUDI ARABIA'], ['sg', '新加坡', 'SINGAPORE'],
		['sy', '敘利亞', 'SYRIA'], ['th', '泰國', 'THAILAND'], ['tj', '塔吉克', 'TAJIKISTAN'],
		['tl', '東帝汶', 'TIMOR-LESTE'], ['tm', '土庫曼', 'TURKMENISTAN'], ['tr', '土耳其', 'TURKEY'],
		['tw', '台灣', 'TAIWAN'], ['uz', '烏茲別克', 'UZBEKISTAN'], ['vn', '越南', 'VIETNAM'],
		['ye', '葉門', 'YEMEN']
	]],
	['europe', '歐洲', [
		['ad', '安道爾', 'ANDORRA'], ['al', '阿爾巴尼亞', 'ALBANIA'], ['at', '奧地利', 'AUSTRIA'],
		['ax', '奧蘭群島', 'ALAND ISLANDS'], ['ba', '波士尼亞', 'BOSNIA AND HERZEGOVINA'], ['be', '比利時', 'BELGIUM'],
		['bg', '保加利亞', 'BULGARIA'], ['by', '白俄羅斯', 'BELARUS'], ['ch', '瑞士', 'SWITZERLAND'],
		['cz', '捷克', 'CZECHIA'], ['de', '德國', 'GERMANY'], ['dk', '丹麥', 'DENMARK'],
		['ee', '愛沙尼亞', 'ESTONIA'], ['es', '西班牙', 'SPAIN'], ['fi', '芬蘭', 'FINLAND'],
		['fo', '法羅群島', 'FAROE ISLANDS'], ['fr', '法國', 'FRANCE'], ['gb', '英國', 'UNITED KINGDOM'],
		['gg', '根西島', 'GUERNSEY'], ['gi', '直布羅陀', 'GIBRALTAR'], ['gr', '希臘', 'GREECE'],
		['hr', '克羅埃西亞', 'CROATIA'], ['hu', '匈牙利', 'HUNGARY'], ['ie', '愛爾蘭', 'IRELAND'],
		['im', '曼島', 'ISLE OF MAN'], ['is', '冰島', 'ICELAND'], ['it', '義大利', 'ITALY'],
		['je', '澤西島', 'JERSEY'], ['li', '列支敦斯登', 'LIECHTENSTEIN'], ['lt', '立陶宛', 'LITHUANIA'],
		['lu', '盧森堡', 'LUXEMBOURG'], ['lv', '拉脫維亞', 'LATVIA'], ['mc', '摩納哥', 'MONACO'],
		['md', '摩爾多瓦', 'MOLDOVA'], ['me', '蒙特內哥羅', 'MONTENEGRO'], ['mk', '北馬其頓', 'NORTH MACEDONIA'],
		['mt', '馬爾他', 'MALTA'], ['nl', '荷蘭', 'NETHERLANDS'], ['no', '挪威', 'NORWAY'],
		['pl', '波蘭', 'POLAND'], ['pt', '葡萄牙', 'PORTUGAL'], ['ro', '羅馬尼亞', 'ROMANIA'],
		['rs', '塞爾維亞', 'SERBIA'], ['ru', '俄羅斯', 'RUSSIA'], ['se', '瑞典', 'SWEDEN'],
		['si', '斯洛維尼亞', 'SLOVENIA'], ['sk', '斯洛伐克', 'SLOVAKIA'], ['sm', '聖馬利諾', 'SAN MARINO'],
		['ua', '烏克蘭', 'UKRAINE'], ['va', '梵蒂岡', 'VATICAN CITY']
	]],
	['africa', '非洲', [
		['dz', '阿爾及利亞', 'ALGERIA'], ['ao', '安哥拉', 'ANGOLA'], ['bj', '貝南', 'BENIN'],
		['bw', '波札那', 'BOTSWANA'], ['bf', '布吉納法索', 'BURKINA FASO'], ['bi', '蒲隆地', 'BURUNDI'],
		['cm', '喀麥隆', 'CAMEROON'], ['cv', '維德角', 'CABO VERDE'], ['cf', '中非', 'CENTRAL AFRICAN REPUBLIC'],
		['td', '查德', 'CHAD'], ['km', '葛摩', 'COMOROS'], ['cg', '剛果', 'CONGO'],
		['cd', '剛果民主', 'DEMOCRATIC REPUBLIC OF THE CONGO'], ['dj', '吉布地', 'DJIBOUTI'], ['eg', '埃及', 'EGYPT'],
		['gq', '赤道幾內亞', 'EQUATORIAL GUINEA'], ['er', '厄利垂亞', 'ERITREA'], ['et', '衣索比亞', 'ETHIOPIA'],
		['ga', '加彭', 'GABON'], ['gm', '甘比亞', 'GAMBIA'], ['gh', '迦納', 'GHANA'],
		['gn', '幾內亞', 'GUINEA'], ['gw', '幾內亞比索', 'GUINEA-BISSAU'], ['ke', '肯亞', 'KENYA'],
		['lr', '賴比瑞亞', 'LIBERIA'], ['ls', '賴索托', 'LESOTHO'], ['ly', '利比亞', 'LIBYA'],
		['ma', '摩洛哥', 'MOROCCO'], ['mg', '馬達加斯加', 'MADAGASCAR'], ['ml', '馬利', 'MALI'],
		['mr', '茅利塔尼亞', 'MAURITANIA'], ['mu', '模里西斯', 'MAURITIUS'], ['mw', '馬拉威', 'MALAWI'],
		['mz', '莫三比克', 'MOZAMBIQUE'], ['na', '納米比亞', 'NAMIBIA'], ['ne', '尼日', 'NIGER'],
		['ng', '奈及利亞', 'NIGERIA'], ['rw', '盧安達', 'RWANDA'], ['sc', '塞席爾', 'SEYCHELLES'],
		['sd', '蘇丹', 'SUDAN'], ['sh', '聖赫勒拿島', 'SAINT HELENA'], ['sl', '獅子山', 'SIERRA LEONE'],
		['sn', '塞內加爾', 'SENEGAL'], ['so', '索馬利亞', 'SOMALIA'], ['ss', '南蘇丹', 'SOUTH SUDAN'],
		['st', '聖多美普林西比', 'SAO TOME AND PRINCIPE'], ['sz', '史瓦帝尼', 'ESWATINI'], ['tg', '多哥', 'TOGO'],
		['tn', '突尼西亞', 'TUNISIA'], ['tz', '坦尚尼亞', 'TANZANIA'], ['ug', '烏干達', 'UGANDA'],
		['za', '南非', 'SOUTH AFRICA'], ['zm', '尚比亞', 'ZAMBIA'], ['zw', '辛巴威', 'ZIMBABWE']
	]],
	['northamerica', '北美洲', [
		['ag', '安地卡及巴布達', 'ANTIGUA AND BARBUDA'], ['ai', '安圭拉', 'ANGUILLA'], ['bs', '巴哈馬', 'BAHAMAS'],
		['bb', '巴貝多', 'BARBADOS'], ['bz', '貝里斯', 'BELIZE'], ['bm', '百慕達', 'BERMUDA'],
		['ca', '加拿大', 'CANADA'], ['cr', '哥斯大黎加', 'COSTA RICA'], ['cu', '古巴', 'CUBA'],
		['dm', '多米尼克', 'DOMINICA'], ['do', '多明尼加', 'DOMINICAN REPUBLIC'], ['sv', '薩爾瓦多', 'EL SALVADOR'],
		['gd', '格瑞那達', 'GRENADA'], ['gl', '格陵蘭', 'GREENLAND'], ['gt', '瓜地馬拉', 'GUATEMALA'],
		['ht', '海地', 'HAITI'], ['hn', '宏都拉斯', 'HONDURAS'], ['jm', '牙買加', 'JAMAICA'],
		['ky', '開曼群島', 'CAYMAN ISLANDS'], ['mx', '墨西哥', 'MEXICO'], ['ms', '蒙哲臘', 'MONTSERRAT'],
		['ni', '尼加拉瓜', 'NICARAGUA'], ['pa', '巴拿馬', 'PANAMA'], ['pm', '聖皮耶密克隆', 'SAINT PIERRE AND MIQUELON'],
		['pr', '波多黎各', 'PUERTO RICO'], ['tt', '千里達及托巴哥', 'TRINIDAD AND TOBAGO'], ['us', '美國', 'UNITED STATES'],
		['vg', '英屬維京群島', 'VIRGIN ISLANDS (BRITISH)'], ['vi', '美屬維京群島', 'VIRGIN ISLANDS (US)']
	]],
	['southamerica', '南美洲', [
		['ar', '阿根廷', 'ARGENTINA'], ['bo', '玻利維亞', 'BOLIVIA'], ['br', '巴西', 'BRAZIL'],
		['cl', '智利', 'CHILE'], ['co', '哥倫比亞', 'COLOMBIA'], ['ec', '厄瓜多', 'ECUADOR'],
		['fk', '福克蘭群島', 'FALKLAND ISLANDS'], ['gy', '蓋亞那', 'GUYANA'], ['py', '巴拉圭', 'PARAGUAY'],
		['pe', '秘魯', 'PERU'], ['sr', '蘇利南', 'SURINAME'], ['uy', '烏拉圭', 'URUGUAY'],
		['ve', '委內瑞拉', 'VENEZUELA']
	]],
	['oceania', '大洋洲', [
		['as', '美屬薩摩亞', 'AMERICAN SAMOA'], ['au', '澳洲', 'AUSTRALIA'], ['ck', '庫克群島', 'COOK ISLANDS'],
		['fj', '斐濟', 'FIJI'], ['fm', '密克羅尼西亞', 'MICRONESIA'], ['gu', '關島', 'GUAM'],
		['ki', '吉里巴斯', 'KIRIBATI'], ['mh', '馬紹爾群島', 'MARSHALL ISLANDS'], ['nc', '新喀里多尼亞', 'NEW CALEDONIA'],
		['nr', '諾魯', 'NAURU'], ['nu', '紐埃', 'NIUE'], ['nz', '紐西蘭', 'NEW ZEALAND'],
		['pf', '法屬玻里尼西亞', 'FRENCH POLYNESIA'], ['pg', '巴布亞紐幾內亞', 'PAPUA NEW GUINEA'], ['pw', '帛琉', 'PALAU'],
		['sb', '索羅門群島', 'SOLOMON ISLANDS'], ['tk', '托克勞', 'TOKELAU'], ['to', '東加', 'TONGA'],
		['tv', '吐瓦魯', 'TUVALU'], ['vu', '萬那杜', 'VANUATU'], ['wf', '瓦利斯和富圖納', 'WALLIS AND FUTUNA'],
		['ws', '薩摩亞', 'SAMOA']
	]]
];

var countryState = {};
var wlState = [];
var countsDiv = null;
var schedState = { freq: 'daily', hour: '3', min: '10', auto: '1' };
var OLD_GROUPS = ['asia', 'europe', 'africa', 'northamerica', 'southamerica', 'oceania'];

function wlCheck(v) {
	v = (v || '').trim();
	var oct = '(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])';
	var ip = '(' + oct + '\\.){3}' + oct;
	var re = new RegExp('^' + ip + '(/([0-9]|[12][0-9]|3[0-2]))?$|^' + ip + '-' + ip + '$');
	if (!re.test(v))
		return _('格式錯誤：請輸入單一 IP（如 203.0.113.10）、CIDR（如 203.0.113.0/24）或範圍（如 203.0.113.10-203.0.113.50）');
	return true;
}

function pushCountries() {
	var sel = Object.keys(countryState);
	if (sel.length > 0)
		uci.set('countryallow', 'main', 'selected', sel);
	else
		uci.unset('countryallow', 'main', 'selected');
	var i;
	for (i = 0; i < OLD_GROUPS.length; i++)
		uci.unset('countryallow', 'main', 'sel_' + OLD_GROUPS[i]);
	uci.set('countryallow', 'main', 'update_freq', schedState.freq);
	uci.set('countryallow', 'main', 'update_hour', schedState.hour);
	uci.set('countryallow', 'main', 'update_min', schedState.min);
	uci.set('countryallow', 'main', 'auto_update', schedState.auto);
	if (wlState.length > 0)
		uci.set('countryallow', 'main', 'whitelist', wlState.slice());
	else
		uci.unset('countryallow', 'main', 'whitelist');
	return uci.save();
}

function checkSetname() {
	var sn = uci.get('countryallow', 'main', 'setname') || '';
	var wn = uci.get('countryallow', 'main', 'white_name') || 'MyAllowed';
	var ok = function(v) { return /^[A-Za-z][A-Za-z0-9_-]*$/.test(v); };
	return ok(sn) && ok(wn);
}


return view.extend({
	handleSaveApply: null,
	handleReset: null,

	load: function() {
		return Promise.all([
			uci.load('countryallow'),
			fs.exec('/usr/bin/countryallow-status').then(function(res) {
				return (res.code === 0 && res.stdout) ? res.stdout : '狀態腳本執行失敗';
			}).catch(function(e) {
				return '狀態腳本執行失敗：' + e.message;
			}),
			fs.exec('/usr/bin/countryallow-counts').then(function(res) {
				return (res.code === 0 && res.stdout) ? res.stdout.trim() : '';
			}).catch(function() {
				return '';
			})
		]);
	},

	render: function(data) {
		var m, s, o;
		var logText = data[1] || '';
		var countsText = data[2] || '';

		var countsLine = function() {
			var p = (countsText || '').split(/\s+/);
			if (p.length < 4 || !p[0])
				return _('目前啟用的集合：尚無資料');
			return _('目前啟用：') + p[0] + '.cidr' + _('（') + p[1] + _(' 行／live ') + p[2] + _(' 段／更新於 ') + p[3].replace('_', ' ') + '）';
		};

		var refreshCounts = function() {
			return fs.exec('/usr/bin/countryallow-counts').then(function(res) {
				if (res.code !== 0 || !res.stdout)
					return;
				countsText = res.stdout.trim();
				if (countsDiv) {
					while (countsDiv.firstChild)
						countsDiv.removeChild(countsDiv.firstChild);
					countsDiv.appendChild(E('span', {}, [countsLine()]));
				}
			}).catch(function() {});
		};

		m = new form.Map('countryallow', _('國家IPS集合建立器 Country Allow List'),
			_('勾選國家＋白名單 IP，合併成集合檔。本頁只生產 IP 集合，不動防火牆。'));

		s = m.section(form.TypedSection, 'countryallow', _('設定'));
		s.anonymous = true;
		s.tab('settings', _('設定'));
		s.tab('log', _('記錄'));

		o = s.taboption('settings', form.DummyValue, '_countries');
		o.render = function(section_id) {
			var cur = uci.get('countryallow', 'main', 'selected') || [];
			var i, j;
			countryState = {};
			(function() {
				var old = ['sel_asia', 'sel_europe', 'sel_africa', 'sel_northamerica', 'sel_southamerica', 'sel_oceania'];
				for (var k = 0; k < old.length; k++) {
					var v = uci.get('countryallow', 'main', old[k]) || [];
					for (var n = 0; n < v.length; n++)
						if (cur.indexOf(v[n]) < 0)
							cur.push(v[n]);
				}
			})();
			cur.forEach(function(v) { countryState[v] = true; });

			var rows = [];
			var tbody = E('tbody', {});
			var selLine = E('div', { 'class': 'country-selected', 'style': 'flex:1;word-break:break-all' }, []);
			var refreshSel = function() {
				var arr = Object.keys(countryState).sort();
				while (selLine.firstChild)
					selLine.removeChild(selLine.firstChild);
				selLine.appendChild(E('strong', {}, [_('已勾選：')]));
				selLine.appendChild(E('span', {}, [arr.length > 0 ? arr.join(',').toUpperCase() : _('（尚未勾選）')]));
			};
			for (i = 0; i < CONTINENTS.length; i++) {
				for (j = 0; j < CONTINENTS[i][2].length; j++) {
					(function(cc) {
						var cb = E('input', { 'type': 'checkbox', 'value': cc[0] });
						if (countryState[cc[0]])
							cb.checked = true;
						cb.addEventListener('change', function() {
							if (cb.checked)
								countryState[cc[0]] = true;
							else
								delete countryState[cc[0]];
							refreshSel();
						});
						var tr = E('tr', {}, [
							E('td', {}, [cb]),
							E('td', {}, [cc[0].toUpperCase()]),
							E('td', {}, [cc[1] + '/' + cc[2]])
						]);
						rows.push({ cc: cc[0], text: (cc[0] + ' ' + cc[1] + ' ' + cc[2]).toUpperCase(), el: tr, cb: cb });
						tbody.appendChild(tr);
					})(CONTINENTS[i][2][j]);
				}
			}

			var allCb = E('input', { 'type': 'checkbox' });
			allCb.addEventListener('change', function() {
				rows.forEach(function(r) {
					if (r.el.style.display === 'none')
						return;
					r.cb.checked = allCb.checked ? true : false;
					if (allCb.checked)
						countryState[r.cc] = true;
					else
						delete countryState[r.cc];
				});
				refreshSel();
			});

			var input = E('input', { 'type': 'text', 'placeholder': _('搜尋，如 TW 台灣 TAIWAN'), 'class': 'country-search' });
			input.addEventListener('input', function() {
				var q = (input.value || '').toUpperCase();
				rows.forEach(function(r) {
					r.el.style.display = (q === '' || r.text.indexOf(q) >= 0) ? '' : 'none';
				});
			});
			var clearBtn = E('button', { 'class': 'btn cbi-button cbi-button-neutral' }, [_('清除')]);
			clearBtn.addEventListener('click', function(ev) {
				if (ev && ev.preventDefault)
					ev.preventDefault();
				input.value = '';
				rows.forEach(function(r) { r.el.style.display = ''; });
			});

			var selAllBtn = E('button', { 'class': 'btn cbi-button cbi-button-neutral', 'style': 'margin-right:0.5em' }, [_('全選')]);
			selAllBtn.addEventListener('click', function(ev) {
				if (ev && ev.preventDefault)
					ev.preventDefault();
				rows.forEach(function(r) {
					if (r.el.style.display === 'none')
						return;
					r.cb.checked = true;
					countryState[r.cc] = true;
				});
				refreshSel();
			});
			var selNoneBtn = E('button', { 'class': 'btn cbi-button cbi-button-neutral' }, [_('清除已選')]);
			selNoneBtn.addEventListener('click', function(ev) {
				if (ev && ev.preventDefault)
					ev.preventDefault();
				rows.forEach(function(r) {
					r.cb.checked = false;
					delete countryState[r.cc];
				});
				refreshSel();
			});

			var table = E('table', { 'class': 'table cbi-section-table', 'style': 'width:100%' }, [
				E('thead', { 'style': 'position:sticky;top:0;background-color:#f0f0f0' }, [
					E('tr', {}, [
						E('th', { 'style': 'width:40px' }, [allCb]),
						E('th', { 'style': 'width:90px' }, [_('編碼')]),
						E('th', {}, [_('位置')])
					])
				]),
				tbody
			]);
			var wrap = E('div', { 'style': 'max-height:420px;overflow:auto;border:1px solid #ccc' }, [table]);
			var headRow = E('div', { 'style': 'display:flex;align-items:center;gap:0.5em;margin-bottom:0.5em;flex-wrap:wrap' }, [
				E('strong', {}, [_('選擇國家')]),
				input, clearBtn,
				E('span', { 'style': 'color:#999' }, ['：']),
				selAllBtn, selNoneBtn, selLine
			]);
			input.style.flex = '1';
			refreshSel();
			return E('div', {}, [
				headRow,
				wrap
			]);
		};

		o = s.taboption('settings', form.DummyValue, '_counts');
		o.render = function(section_id) {
			countsDiv = E('div', { 'class': 'country-counts', 'style': 'margin:0.5em 0' }, [countsLine()]);
			return countsDiv;
		};

		o = s.taboption('settings', form.DummyValue, '_whitelist');
		o.render = function(section_id) {
			var cur = uci.get('countryallow', 'main', 'whitelist') || [];
			if (!Array.isArray(cur))
				cur = [cur];
			wlState = cur.slice();
			var listBox = E('div', { 'class': 'wl-list' });
			var errLine = E('div', { 'class': 'wl-error', 'style': 'color:#c00;margin-top:0.3em' }, []);
			var drawList = function() {
				while (listBox.firstChild)
					listBox.removeChild(listBox.firstChild);
				wlState.forEach(function(v, idx) {
					var del = E('button', { 'class': 'btn cbi-button cbi-button-neutral' }, [_('刪除')]);
					del.addEventListener('click', function(ev) {
						if (ev && ev.preventDefault)
							ev.preventDefault();
						wlState.splice(idx, 1);
						drawList();
					});
					listBox.appendChild(E('div', { 'style': 'margin-bottom:0.3em' }, [
						E('span', {}, [v]), E('span', {}, ['  ']), del
					]));
				});
			};
			var setErr = function(msg) {
				while (errLine.firstChild)
					errLine.removeChild(errLine.firstChild);
				if (msg)
					errLine.appendChild(E('span', {}, [msg]));
			};
			var inp = E('input', { 'type': 'text', 'class': 'cbi-input-text', 'placeholder': '例如 203.0.113.10、203.0.113.0/24、203.0.113.10-203.0.113.50', 'style': 'flex:1;margin-right:0.5em' });
			var addBtn = E('button', { 'class': 'btn cbi-button cbi-button-action' }, [_('新增')]);
			addBtn.addEventListener('click', function(ev) {
				if (ev && ev.preventDefault)
					ev.preventDefault();
				var v = (inp.value || '').trim();
				var msg = wlCheck(v);
				if (msg !== true) {
					setErr(msg);
					return;
				}
				if (wlState.indexOf(v) < 0)
					wlState.push(v);
				inp.value = '';
				setErr(null);
				drawList();
			});
			drawList();
			return E('div', { 'class': 'cbi-value' }, [
				E('label', { 'class': 'cbi-value-title' }, [_('除國家外要包含的 白名單：IP / CIDR / 範圍')]),
				E('div', { 'class': 'cbi-value-field' }, [
					E('div', { 'style': 'display:flex;margin-bottom:0.5em' }, [inp, addBtn]),
					listBox, errLine,
					E('div', { 'class': 'cbi-value-description' }, [_('格式：單一 IP、CIDR、A-B 範圍。國家全空＋有 IP＝純白名單。')])
				])
			]);
		};

		o = s.taboption('settings', form.Value, 'src_primary', _('主要訂閱源'));
		o.default = 'https://www.ipdeny.com/ipblocks/data/aggregated/{cc}-aggregated.zone';
		o.rmempty = false;
		o.description = _('{cc} 會換成國碼小寫，{CC} 大寫。');
		o = s.taboption('settings', form.Value, 'src_backup', _('備用訂閱源'));
		o.default = 'https://raw.githubusercontent.com/ipverse/country-ip-blocks/master/country/{cc}/ipv4-aggregated.txt';
		o.rmempty = false;
		o.description = _('失敗改抓備用；抓不到沿用舊檔。');

		o = s.taboption('settings', form.Value, 'setname', _('多國家+自訂白名單IP的總集合名稱'));
		o.validate = function(section_id, value) {
			if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(value || ''))
				return _('只允許英文開頭，後接英文數字底線連字號');
			return true;
		};
		o.default = 'allowed-IPList';
		o.rmempty = false;
		o.description = _('規則：英文開頭，僅英文數字底線連字號。檔名與 set 同名；改名舊檔保留。');
		o = s.taboption('settings', form.Value, 'white_name', _('白名單集合名稱'));
		o.validate = function(section_id, value) {
			if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(value || ''))
				return _('只允許英文開頭，後接英文數字底線連字號');
			return true;
		};
		o.default = 'CustomAllow';
		o.rmempty = false;
		o.description = _('白名單獨立成一個集合，防火牆 IP 集合頁可見，規則同上。');

		o = s.taboption('settings', form.DummyValue, '_sched');
		o.render = function(section_id) {
			var freq = uci.get('countryallow', 'main', 'update_freq') || 'daily';
			var hour = uci.get('countryallow', 'main', 'update_hour') || '3';
			var min = uci.get('countryallow', 'main', 'update_min') || '10';
			schedState.freq = freq;
			schedState.hour = hour;
			schedState.min = min;
			var freqSel = E('select', {}, [
				E('option', { 'value': 'daily' }, [_('每天')]),
				E('option', { 'value': 'weekly' }, [_('每週日')]),
				E('option', { 'value': 'monthly' }, [_('每月 1 日')])
			]);
			freqSel.value = freq;
			freqSel.addEventListener('change', function() { schedState.freq = freqSel.value; });
			var hourSel = E('select', {}, []);
			var minSel = E('select', {}, []);
			var i;
			for (i = 0; i < 24; i++) {
				var hv = String(i);
				var ho = E('option', { 'value': hv }, [hv]);
				if (hv === String(Number(hour)))
					ho.selected = true;
				hourSel.appendChild(ho);
			}
			for (i = 0; i < 60; i++) {
				var mv = String(i);
				var mo = E('option', { 'value': mv }, [mv]);
				if (mv === String(Number(min)))
					mo.selected = true;
				minSel.appendChild(mo);
			}
			hourSel.value = String(Number(hour));
			minSel.value = String(Number(min));
			hourSel.addEventListener('change', function() { schedState.hour = hourSel.value; });
			minSel.addEventListener('change', function() { schedState.min = minSel.value; });
			var autoCb = E('input', { 'type': 'checkbox' });
			if ((uci.get('countryallow', 'main', 'auto_update') || '1') === '1')
				autoCb.checked = true;
			schedState.auto = autoCb.checked ? '1' : '0';
			autoCb.addEventListener('change', function() { schedState.auto = autoCb.checked ? '1' : '0'; });
			return E('div', { 'class': 'cbi-value' }, [
				E('label', { 'class': 'cbi-value-title' }, [_('自動更新清單頻率')]),
				E('div', { 'class': 'cbi-value-field' }, [
					freqSel, E('span', {}, [' ']),
					E('span', {}, [_('時')]), E('span', {}, [' ']), hourSel,
					E('span', {}, [' ']), E('span', {}, [_('分')]), E('span', {}, [' ']), minSel,
					E('span', {}, ['  ']), autoCb, E('span', {}, [' ']), E('span', {}, [_('啟用自動更新')])
				])
			]);
		};
		o = s.taboption('settings', form.DummyValue, '_note');
		o.render = function(section_id) {
			return E('div', { 'class': 'cbi-section' }, [
				E('style', {}, ['#cbi-countryallow input.cbi-input-text{width:100%;max-width:1024px}#cbi-countryallow .cbi-value-title{width:300px;flex:0 0 300px;white-space:nowrap}#cbi-countryallow .cbi-value-field .btn{width:auto}#cbi-countryallow table.cbi-section-table td,#cbi-countryallow table.cbi-section-table th{padding:3px 6px}#cbi-countryallow p{margin:0.3em 0}#cbi-countryallow .cbi-dynlist{width:100%;max-width:none}#cbi-countryallow .cbi-dynlist .add-item{display:flex}#cbi-countryallow .cbi-dynlist .add-item input{flex:1;margin-right:0.5em}']),
				E('p', {}, [_('本頁只負責產生 IP 集合檔，不動防火牆任何規則。')]),
				E('p', {}, [_('生效方式：SSH 把集合掛到防火牆規則（LuCI 無集合欄位），例：')]),
				E('pre', {}, ["uci set firewall.@redirect[0].ipset='集合名稱'\nuci commit firewall\nfw4 reload"])
			]);
		};

		o = s.taboption('settings', form.DummyValue, '_actions');
		o.render = function(section_id) {
			var opt = this;
			var runone = function(cmd, okmsg, noexec) {
				var map = opt.map;
				return pushCountries().then(function() {
					return map.save(null, true);
				}).then(function() {
					return uci.apply();
				}).then(function() {
					if (!checkSetname()) {
						ui.addNotification(null, E('p', _('集合名稱不合規格（英文字母開頭，僅英文數字底線連字號），設定已存檔但不會執行更新')), 'error');
						throw { handled: true };
					}
					if (noexec) {
						return fs.exec('/usr/bin/countryallow-cron').then(function() {
							return { code: 0, skip: true };
						});
					}
					return fs.exec(cmd);
				}).then(function(res) {
					if (res.skip)
						return res;
					return fs.exec('/usr/bin/countryallow-cron').then(function() {
						return res;
					});
				}).then(function(res) {
					if (res.skip) {
						ui.addNotification(null, E('p', _(okmsg)), 'info');
					} else if (res.code === 0) {
						ui.addNotification(null, E('p', _(okmsg)), 'info');
						return refreshCounts();
					} else {
						ui.addNotification(null, E('p', _('更新失敗：') + (res.stderr || res.stdout || '未知錯誤')), 'error');
					}
				}).catch(function(e) {
					if (e && e.handled)
						return;
					ui.addNotification(null, E('p', _('執行失敗：') + e.message), 'error');
				});
			};
			var mkbtn = function(cmd, title, okmsg, noexec) {
				var b = E('button', { 'class': 'btn cbi-button cbi-button-action', 'style': 'margin-right:0.5em' }, [title]);
				b.addEventListener('click', function(ev) {
					if (ev && ev.preventDefault)
						ev.preventDefault();
					return runone(cmd, okmsg, noexec);
				});
				return b;
			};
			return E('div', { 'style': 'display:flex;align-items:center;gap:0.5em;flex-wrap:wrap' }, [
				E('span', { 'style': 'flex:1' }, [_('註：A1（匿名代理）／A2（衛星）無資料來源，未列入。')]),
				mkbtn('/usr/bin/countryallow-fetch', _('立即更新 IP 集合'), 'IP 集合已更新（僅抓檔，未合併重載）', false),
				mkbtn('/usr/bin/countryallow-update', _('立即更新並合併'), '已成功更新並合併（含白名單）', false),
				mkbtn(null, _('儲存設定'), '設定已儲存（排程已同步）', true)
			]);
		};

		o = s.taboption('log', form.DummyValue, '_log');
		o.render = function(section_id) {
			var pre = E('pre', { 'style': 'white-space:pre-wrap' }, [logText]);
			var clr = E('button', { 'class': 'btn cbi-button cbi-button-neutral', 'style': 'margin-bottom:0.5em' }, [_('清除更新歷史')]);
			clr.addEventListener('click', function(ev) {
				if (ev && ev.preventDefault)
					ev.preventDefault();
				return fs.exec('/usr/bin/countryallow-clear-history').then(function() {
					return fs.exec('/usr/bin/countryallow-status');
				}).then(function(res) {
					while (pre.firstChild)
						pre.removeChild(pre.firstChild);
					pre.appendChild(document.createTextNode(res.stdout || ''));
					ui.addNotification(null, E('p', _('更新歷史已清除')), 'info');
				}).catch(function(e) {
					ui.addNotification(null, E('p', _('執行失敗：') + e.message), 'error');
				});
			});
			return E('div', {}, [clr, pre]);
		};

		return m.render();
	}
});
