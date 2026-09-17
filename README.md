# 國門守衛 GeoGuard（luci-app-geoguard）

OpenWrt LuCI App：勾選國家＋自訂白名單 → 從雙訂閱源抓取 IP 地理定位 CIDR → 合併成 firewall4 ipset 集合，另含登入防護（LuCI／SSH 爆破封鎖）與 DDNS 免封名單。IPv4 only（v6 流量不在覆蓋範圍）、正體中文／English 雙語。

> 最新發佈：v2.2.1（預編包見 [Releases](https://github.com/chinoyan2002/luci-app-geoguard/releases)）

## 功能

- **IPs 設定**：217 國家勾選、雙訂閱源（主／備自動切換）、白名單（單 IP／CIDR／A-B 範圍）、每日／每週／每月自動更新；檔名即集合名（`/etc/luci-uploads/<名>.cidr`）；改名自動重指防火牆引用，取消勾選被引用的集合會保留並報錯（不斷防護）；陳舊孤兒區段自動掃蕩；更新單次執行（cron／手按互斥）
- **登入防護**：時間窗／次數／封鎖時數可調（預設 5 分／8 次／2 小時，網頁＋SSH 分開計數，dropbear 斷線併計），全擋被封 IP 的 WAN 流向，內網＋保留段永不封鎖（`/0` 不接受），外網介面自動偵測；封鎖名單持久化，重開機按剩餘時間還原（解封同步清除）
- **DDNS 免封**：動態域名自動追 IP，只保防護免封、不動 IP 集合（選項名 `ddns_allowlist`；2.1.x 的 `company_ddns` 升級自動搬家）
- **狀態目錄**：集合／歷史／封鎖／DDNS 狀態住套件自有 `/etc/geoguard/`（2.2.0 的 `/etc/luci-uploads/` 升級自動搬家，不再跟別人共用目錄）
- 訂閱源逐行驗 CIDR 格式才入檔（壞行直接丟，壞源整批拒收保舊檔）；排程註解英文；動作按鈕序列化＋忙時鎖定；沒動過的設定存檔不覆寫；裝完 cron／防護服務自動就緒，移除自動收 cron＋停服務；本包只生產集合、不動防火牆規則；掛集合到規則上一行設定即可（頁面有手把手說明）

## 安裝

- OpenWrt 24.x（opkg）：`opkg install luci-app-geoguard_*_all.ipk`
- OpenWrt 25.x（apk）：`apk add luci-app-geoguard_*_all.apk`（另有 `luci-i18n-geoguard-zh-tw` 語系包；英文即原始字串，不需語系包）
- 預編包見 [GitHub Releases](https://github.com/chinoyan2002/luci-app-geoguard/releases)（apk 簽名公鑰隨包發布，檔名保持原樣放入 `/etc/apk/keys/` 才能驗過）；或用 SDK：`make package/luci-app-geoguard/compile`
- 裝完到 網路 → 國門守衛 GeoGuard 按一次「立即更新並合併」即活

## 佈署自己的防火牆規則（範例）

```sh
# 集合掛到既有規則（只放行集合內來源）
uci set firewall.@rule[0].ipset='allowed-IPList'
uci commit firewall && fw4 reload
```

## 開發

- `luci-app-geoguard/`：標準 luci.mk 結構（`Makefile`＋`htdocs/`＋`root/`＋`po/`，英文源＋繁中翻譯 `zh_Hant`）
- `tools/luci-harness.js`：前端測試（mini-DOM）；`tools/i18n-check.js`：中英對齊檢查；`tools/py_lmo.py`：po→lmo
- `packaging/`：APKBUILD＋一鍵產線 `build_packages.py`＋說明 `BUILD.md`
- 改 `.js` 跑 harness 全綠，改 `.sh` 跑 `sh -n`＋零 CR；LF 換行（`.gitattributes` 鎖定）

## 治理

最高指導：`GOVERNANCE.md`（上游 `openwrt/luci#9027` 內 openwrt-ai 要求優先；牴觸時它贏）。

## 授權

MIT，見 LICENSE。

---

# GeoGuard (luci-app-geoguard) — English

OpenWrt LuCI app: tick countries + custom whitelist → fetch IP-geolocation CIDRs from dual feeds → merge into firewall4 ipset sets. Also ships login guard (LuCI/SSH brute-force banning) and a DDNS no-ban list. IPv4 only (IPv6 traffic out of scope), bilingual: Traditional Chinese / English.

> Latest release: v2.2.1 (prebuilt packages under [Releases](https://github.com/chinoyan2002/luci-app-geoguard/releases))

## Features

- **IP Sets**: 217 countries, dual feeds (primary/backup auto-failover), whitelist (single IP / CIDR / A-B range), daily/weekly/monthly auto-update; file name = set name (`/etc/luci-uploads/<name>.cidr`); renames auto-repoint firewall references, deselecting a referenced set keeps it with an error; stale orphan sections auto-swept; single-flight updates (cron vs manual)
- **Login Guard**: tunable window/retries/ban time (defaults 5 min / 8 / 2 h, web + SSH counted separately, dropbear disconnects counted), full-block of banned IPs on WAN, LAN + reserved ranges never banned (`/0` rejected), WAN interface auto-detect; ban list persisted, restored with remaining time after reboot (unban purges it)
- **DDNS allowlist**: dynamic hostnames auto-tracked for guard exemption only; IP sets untouched (option `ddns_allowlist`; v2.1.x `company_ddns` auto-migrates on upgrade)
- **State directory**: sets/history/ban/DDNS state live in package-owned `/etc/geoguard/` (auto-migrated from v2.2.0 `/etc/luci-uploads/`, no longer shared)
- Feed lines are CIDR-validated before install (bad lines dropped, bad sources rejected keeping the old file); English cron comments; action buttons serialized + locked while busy; untouched settings are never overwritten on save (per-group dirty guards); cron + guard service self-activate on install and clean up on remove; the package only builds sets and never touches firewall rules; one setting binds a set to a rule (step-by-step guide on the page)

## Install

- OpenWrt 24.x (opkg): `opkg install luci-app-geoguard_*_all.ipk`
- OpenWrt 25.x (apk): `apk add luci-app-geoguard_*_all.apk` (plus optional `luci-i18n-geoguard-zh-tw`; English is the source language, no language pack needed)
- Prebuilt packages: [GitHub Releases](https://github.com/chinoyan2002/luci-app-geoguard/releases) (apk signing pubkey shipped alongside — keep the filename as-is under `/etc/apk/keys/` or verification fails); or SDK: `make package/luci-app-geoguard/compile`
- After install, open Network → GeoGuard and press update-merge once to activate

## Bind a set to your own firewall rule (example)

```sh
# attach the set to an existing rule (allow only sources inside the set)
uci set firewall.@rule[0].ipset='allowed-IPList'
uci commit firewall && fw4 reload
```

## Development

- `luci-app-geoguard/`: standard luci.mk layout (`Makefile` + `htdocs/` + `root/` + `po/`, English source + Traditional Chinese translation `zh_Hant`)
- `tools/luci-harness.js`: frontend tests (mini-DOM); `tools/i18n-check.js`: zh/en sync gate; `tools/py_lmo.py`: po→lmo
- `packaging/`: APKBUILD + one-shot pipeline `build_packages.py` + notes in `BUILD.md`
- After touching `.js`, harness must be all green; after touching `.sh`, `sh -n` + zero CR; LF endings (locked by `.gitattributes`)

## Governance

Highest guidance: `GOVERNANCE.md` (openwrt-ai requirements in upstream `openwrt/luci#9027` win on conflict).

## License

MIT, see LICENSE.
