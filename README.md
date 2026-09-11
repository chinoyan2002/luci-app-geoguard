# 國門守衛 GeoGuard（luci-app-geoguard）

OpenWrt LuCI App：勾選國家＋自訂白名單 → 從雙訂閱源抓取 IP 地理定位 CIDR → 合併成 firewall4 ipset 集合，另含登入防護（LuCI／SSH 爆破封鎖）與 DDNS 免封名單。IPv4 only，正體中文／English 雙語。

## 功能

- **IPs 設定**：217 國家勾選、雙訂閱源（主／備自動切換）、白名單（單 IP／CIDR／A-B 範圍）、每日／每週自動更新
- **登入防護**：5 分鐘內失敗 N 次即封鎖 2 小時（網頁＋SSH 分開計數），全擋被封 IP 的 WAN 流向，內網永不封鎖
- **DDNS 免封**：動態域名自動追 IP，只保防護免封、不動 IP 集合
- 本包只生產集合、不動防火牆規則；掛集合到規則上一行設定即可（頁面有手把手說明）

## 安裝

- OpenWrt 24.x（opkg）：`opkg install luci-app-geoguard_*_all.ipk`
- OpenWrt 25.x（apk）：`apk add luci-app-geoguard_*_all.apk`（另有 `luci-i18n-geoguard-zh-tw` 語系包；英文即原始字串，不需語系包）
- 預編包見 GitHub Releases；或用 SDK：`make package/luci-app-geoguard/compile`
- 裝完到 網路 → 國門守衛 GeoGuard 按一次「立即更新並合併」即活

## 佈署自己的防火牆規則（範例）

```sh
# 集合掛到既有規則（B 組：只放行集合內來源）
uci set firewall.@rule[0].ipset='allowed-IPList'
uci commit firewall && fw4 reload
```

## 開發

- `luci-app-geoguard/`：標準 luci.mk 結構（`Makefile`＋`root/`＋`po/`）
- `tools/luci-harness.js`：前端測試（mini-DOM）；`tools/i18n-check.js`：中英對齊檢查；`tools/py_lmo.py`：po→lmo
- `packaging/`：APKBUILD＋一鍵產線 `build_packages.py`＋說明 `BUILD.md`
- 改 `.js` 跑 harness 全綠，改 `.sh` 跑 `sh -n`＋零 CR；LF 換行（`.gitattributes` 鎖定）

## 授權

MIT，見 LICENSE。
