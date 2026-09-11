# 交接書 HANDOFF（給下一個 AI：開工前 15 分鐘照著做）
> **v2.0.0 改名**：本專案已從 `geoguard`／「國門守衛 GeoGuard」改名為 `geoguard`／「國門守衛 GeoGuard」。下文歷史段落中的舊名皆指同一套東西。

## 0. 先讀什麼（順序）
1. `AGENTS.md`（本 repo 的 agent 指令總綱，最精簡）
2. 本檔（環境＋上線狀態）
3. `SPEC.md`（技術規格：UCI、腳本、nft、UI 結構）
4. `RUNBOOK.md`（日常操作：更新、改設定、回滾，照抄指令）
5. `PITFALLS.md`（29 個地雷，看完再動手，動了就先跑驗證）

## 1. 環境（一句話：Windows 本機＋三台內網機）
| 角色 | 位置／帳號 | 備註 |
|---|---|---|
| 工作 PC | `C:\Users\User\Documents\路由設定檔\` | 本目錄；`2329225-OpenWrtX86-HOME/` 是備份區 |
| 本專案 | `.../國門守衛 GeoGuard/`（git repo，見 §5） | 改這裡，不動備份區 |
| PVE | `root@192.168.1.250`（key：`E:\Temp\opencode\pve_temp_readonly`） | 跳板＋快照，VMID 100＝OpenWrt |
| OpenWrt | `root@192.168.1.1:2222`（經 PVE 跳，Windows 直連 key 已失效） | 25.12.5，PPPoE 撥號 |
| DSM | `chinoyan@192.168.1.2:2244`＋sudo（經 PVE 跳） | 日誌轉發目的地，本專案只讀它 |

SSH 一律走 PVE 跳（Windows→PVE 直連，PVE→另兩台）。`scp` 跨機只用**單檔**（dropbear 多檔會 `protocol error`），且 PVE 的 scp 預設 SFTP（分享器沒有）→ 對分享器加 `-O`。

## 2. 帳密政策（鐵律）
- 密碼、key 內容、token **永不進 repo、檔案、commit**。掃過才推（見 RUNBOOK）。
- GitHub 認證用 device flow（使用者在瀏覽器按確認）；LuCI root 密碼**每次跟使用者拿臨時的**，驗完提醒他換掉。
- 本機工具：`node`（v24）、`python`（注意叫 `python` 不是 `python3`，3.7 版，文字處理只用它不用 PowerShell）、`git`＋`gh`、Chrome（`C:\Program Files\Google\Chrome\Application\chrome.exe`）＋`E:\Temp\opencode\node_modules\puppeteer-core`。

## 3. 上工檢查（5 條，輸出對不上就停手先問）
```sh
# ① 跳板通？
ssh -i E:\Temp\opencode\pve_temp_readonly -o BatchMode=yes root@192.168.1.250 "hostname"
# ② 分享器活著？（經 PVE 跳， port 2222）
# ③ PPPoE 有 IP？（應有 111.xxx 或 220.xxx）
# ④ 四集合 live 數量（tw~700、jp~3000、allowed-IPList~1400-3900、CustomAllow 看白名單）
# ⑤ 防火牆 6 規則綁 allowed-IPList（見 RUNBOOK）
```
LuCI：`http://192.168.1.1` → 網路 → GeoGuard（帳密問使用者；改完 UI 一定自己截圖看，見 RUNBOOK §驗證）。

## 4. 線上快照（2026-09-11 夜，用戶持續在玩，動手前先重查一次）
- OpenWrt 25.12.5（x86/64，BIOS，ext4）；PPPoE（`/etc/ppp/options` 必有 `noipv6`，否則被機房秒斷）。
- 集合：tw、jp、allowed-IPList（合併）、CustomAllow（白名單，空時不存在）。
- 6 規則吃 allowed-IPList：SSH-2222、8080、8081、8006、88、12290。
- cron：每天 03:10 更新；每分鐘 geoguard-ban 迴圈（另一專案）；每週一 03:00 舊 updater 已退役。
- PVE 快照：`pre-2512`、`post-country-v5`（動防火牆/升級前先打新的）。

## 5. 版本控制
- Repo：`https://github.com/chinoyan2002/Openwrt--IPS-`（私有），`main` 分支。
- 本機 repo 就在專案目錄；換行鎖 LF（`.gitattributes`，Windows checkout 才不會毒死 `.sh`）。
- 只推本專案目錄；commit 前掃機密（帳密/key/token/sessionid）；`git show --stat` 確認檔單。
