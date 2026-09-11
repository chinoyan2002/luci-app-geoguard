# 國家IPS集合建立器 Country Allow List（交接文件，給下一個 AI / 工程師）

> 第一句先讀這份。有問題先看「已知地雷」，不要重踩。

## 一句話
OpenWrt LuCI App：勾選國家＋自訂白名單 IP → 從雙訂閱源抓 CIDR → 合併成 nft 集合檔 → firewall4 的 ipset 區段引用，全中文介面。

## 線上位置（家裡實機，2026-09-11 驗證過）
- 分享器：`root@192.168.1.1:2222`（從 PVE `root@192.168.1.250` 用 key 跳，Windows 直連 key 已失效）
- LuCI：`http://192.168.1.1` → 網路 → Country Allow List；防火牆 → IP 集合
- PVE 快照：`pre-2512`、`post-country-v5`（出事回滾用）

## 檔案地圖（本目錄 `luci-app-countryallow/root/` 原樣對應分享器路徑）
| 分享器路徑 | 來源 | 說明 |
|---|---|---|
| `/www/.../view/countryallow.js` | 本包 | LuCI 前端（設定/記錄雙籤） |
| `/usr/bin/countryallow-fetch` | 本包 | 只抓各國檔（主→備自動切換） |
| `/usr/bin/countryallow-update` | 本包 | 抓取＋合併＋同步 ipset 區段＋刷新 live set |
| `/usr/bin/countryallow-cron` | 本包 | 依 UCI 排程寫 crontab |
| `/usr/bin/countryallow-status` | 本包 | 記錄頁的狀態輸出 |
| `/etc/config/countryallow` | 本包（conffile） | 全部設定 |
| `/etc/luci-uploads/cc-en.txt` | 本包 | 國碼→英文對照（註解用） |
| `/usr/share/luci/menu.d/*.json`、`/usr/share/rpcd/acl.d/*.json` | 本包 | 選單＋權限 |
| `/etc/uci-defaults/40-*` | 本包 | 初裝跑一次（只排 cron，不抓檔） |
| `/etc/luci-uploads/*.cidr` | 執行期產生 | 各國檔＋合併檔（tw.cidr、allowed-IPList.cidr…） |
| `/root/luci-ban.sh`、`/root/luci-ban-loop.sh` | **不在本包** | LuCI 防爆（另一專案，勿動） |
| `/etc/nftables.d/10-luci-guard.nft` | **不在本包** | ban 用的鏈（另一專案，勿動） |

## 資料流
勾選國家（UCI selected）→ fetch（主 ipdeny→備 ipverse）→ `/etc/luci-uploads/<cc>.cidr`
＋白名單（單IP補/32、CIDR、A-B 範圍展開）→ 合併 `<setname>.cidr`＋`<white>.cidr`
→ uci ipset 區段（loadfile 指向檔＋英文註解）→ flush＋重填 live set。
**fw4 reload 不重讀 loadfile**，所以更新腳本一律手動 flush＋add（fail-closed 空窗毫秒級）。

## 驗證清單（改完必跑）
1. `node --check`＋`tools/luci-harness.js`（在 `2329225-OpenWrtX86-HOME/`，沿用）
2. `scp` 上傳＋`sha256sum` 來回對（`cat \| ssh` 管線會壓爛中文，**一律用 scp**）
3. 本機 `.sh` 先 `sh -n`，且全檔零 CR（`grep -c $'\r'` 必須 0，PowerShell 會偷塞 CR）
4. 線上跑一次更新，看 `/var/log` 的 countryallow 行＋`nft list set` 數量
5. UI 改動：headless Chrome（`tools/luci-verify.js`，帳密問使用者拿）截圖親眼看

## 已知地雷（血淚，勿重蹈）
1. `cat | ssh` 傳中文檔會爛 → 只用 scp＋對 hash。
2. PowerShell 會塞 CR 進檔案 → `.sh` 上傳前先掃，傳完跑 `sh -n`。
3. fw4 `option ipset` 一定要配 uci ipset 區段；include 自建的 set 引用不到（`references unknown set`）。
4. fw4 reload 不重讀 loadfile；改區段先手動清舊 chain 否則新舊打架。
5. LuCI `uci.set` 空陣列會被 rpcd 打回（ubus code 2）→ 用 `uci.unset`。
6. `m.on('save')`、`uci.validate=uciname（含連字號不行）` 等 API 在 25.x 已死，照抄舊文會炸。
7. 真實 DOM 的 `children` 唯讀、`$$` 在子 shell 拿到父 pid——harness 已仿真，別繞過 harness。
8. `/etc/nftables.d/` 會被 fw4 自動載入；uci 裡再引一次就會載入兩次。

## 打包成 .apk/.ipk（給別台 OpenWrt 用）
- 本包已是標準 `luci-app-*` 結構（`Makefile`＋`root/`＋conffile＋uci-defaults），純 shell＋js 無編譯碼，`LUCI_PKGARCH:=all`，單一包通吃所有架構。
- 24.x（opkg）：用該版 ImageBuilder/SDK `make package/luci-app-countryallow/compile` → `.ipk`。
- 25.x（apk）：同上用 25.12 SDK → `.apk`（檔名會是 `luci-app-countryallow_2026.09.11-1_all.apk`，這就是你要的 `.apk`）。
- 安裝：LuCI 軟體頁上傳或 `apk add xxx.apk`／`opkg install xxx.ipk`；裝完到本頁按一次「立即更新並合併」即活（uci-defaults 只排 cron 不抓檔）。
- 注意：別台機器的防火牆規則要自己掛集合（`uci set firewall.@rule[X].ipset='<集合名>'`），本包只生產集合不動規則。
