# 操作手冊 RUNBOOK（照抄指令，改數字前先看 SPEC）

## 0. 通用鐵律（每次）
- 傳檔只用 `scp`＋`sha256sum` 來回對（`cat | ssh` 會壓爛中文）。
- `.sh` 上線前：本機零 CR＋`sh -n` 過＋目的端再 `sh -n` 一次。
- 改防火牆／升級前：PVE 先打快照（`qm snapshot 100 <名> --description ...`）。
- UI 改完：`node --check`＋`tools/luci-harness.js`＋headless 截圖親眼看（帳密問使用者拿，用完提醒換掉）。
- 改完備份到 `2329225-OpenWrtX86-HOME/`（檔名帶日期版本尾碼），要進 repo 的走 git 流程（§6）。

## 1. LuCI 按鈕 ↔ 後端對照
| 按鈕 | 實際流程 |
|---|---|
| 立即更新 IP 集合 | 存檔→apply→`countryallow-fetch`（只抓各國檔）→同步 cron |
| 立即更新並合併 | 存檔→apply→`countryallow-fetch`→`countryallow-update`（合併＋區段＋刷新 live）→同步 cron |
| 儲存設定 | 存檔→apply→同步 cron（不跑更新） |
| 清除更新歷史 | 清 `history.log`＋重刷記錄頁 |
重點：按鈕會自己 `uci.apply()` 落盤，**不用**再去按右上角儲存（以前版本的 bug，已修）。

## 2. 日常操作
- 看狀態：LuCI 記錄頁，或 `/usr/bin/countryallow-status`。
- 看某集合 live 數：`nft list set inet fw4 <名> | tr ',' '\n' | grep -c '/'`。
- 查單 IP 命中：`nft get element inet fw4 <名> { 1.2.3.4 }`（成功＝在內）。
- 看更新 log：`logread | grep countryallow | tail`；歷史：`/etc/luci-uploads/history.log`。
- 加國家：LuCI 勾選→更新並合併（新集合自動建區段＋註解）。
- 退選國家：同上（區段自動刪＋live 先 flush，不留孤兒）。
- 白名單：單IP（自動補/32）／CIDR／`A-B` 範圍；全空國家＋有 IP＝純白名單；白名單空→集合不建不留檔。
- 改集合名：直接改，規則引用自動跟著改（`applied_*` 追蹤）；舊檔保留。
- 改排程：每天／週日／每月1日＋時分＋啟用旗，任一按鈕都會同步 cron。
- 清歷史：記錄頁按鈕（只清 history.log，不動系統日誌）。

## 3. 防火牆掛集合（LuCI 頁面無集合欄位，走 uci）
```sh
uci set firewall.@redirect[N].ipset='<集合名>'   # 轉址規則
uci set firewall.@rule[N].ipset='<集合名>'       # 放行規則（SSH 那種）
uci commit firewall; fw4 reload
```
查索引：`uci show firewall | grep -E "name=|ipset="`。注意 `luci-wan` 那條是死的（disabled）別管。

## 4. 排錯起手式
- 更新失敗：先看 `logread | grep countryallow`（逐國寫了來源:主要/備用）。
- 集合空白：`ls -la /etc/luci-uploads/*.cidr`＋`nft list set`＋跑一次更新（現在每次更新都重填 live，會自癒）。
- 頁面空白/怪：先問使用者 Ctrl+F5（快取），再看。
- PPPoE 斷（NEGOTIATION_FAILED）：先看 `/etc/ppp/options` 有無 `noipv6`（25.x 必備），再看數據機，最後看日誌。
- 大手術回滾：`qm rollback 100 <快照名>`（斷網 1 分鐘內回來）。

## 5. 分享器升級（25.x 注意）
- 備份：`sysupgrade -b`＋自訂包（`/root`、`/etc/nftables.d`、crontabs、rc.local、sysupgrade.conf、`/etc/config`）＋`uci show`＋套件清單，sha256 對完再動。
- 映像檔：x86/64、BIOS 選 `*-ext4-combined.img.gz`（不要 efi），hash 對官方頁。
- 升級後：`apk update`（不是 opkg！）＋跑 `/root/restore-pkgs.sh`（照升級前清單全裝回，含中文包）。
- `/etc/ppp/options` 的 `noipv6` 會保留；掉了就撥不上去。

## 6. Git（只推本專案目錄）
```sh
git status --short          # 只該有本專案的檔
git add <路徑>...           # 一個個加，不要 add .
git commit -m "..."         # 英文短句
git push
```
推前掃機密：密碼、私鑰內容、token、sessionid、stok 值（機制說明文字可留）。換行已鎖 LF。

## 7. 改 LuCI 前端必走
`ca-view.js` 改完 → `node --check` → `tools/luci-harness.js`（mini-DOM：唯讀 children、strict、空陣列 RPC、tab 歸屬全仿真）全綠 → scp＋hash → 瀏覽器截圖親眼看 → 備份。中文傳輸一律 scp；PowerShell 只跑指令不碰文字（文字用 `python`）。
