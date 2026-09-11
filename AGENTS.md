# AGENTS.md — 國家IPS集合建立器 (luci-app-countryallow)

OpenWrt LuCI App：勾選國家＋白名單 → 抓 CIDR → firewall4 ipset 集合。IPv4 only。
詳規格看 `SPEC.md`；上工流程看 `HANDOFF.md`；指令看 `RUNBOOK.md`；地雷看 `PITFALLS.md`。

## Layout
- `luci-app-countryallow/Makefile` — 標準 luci.mk 包，`LUCI_PKGARCH:=all`，`LUCI_DEPENDS:=+firewall4 +wget-ssl +uhttpd`
- `luci-app-countryallow/root/` — **原樣對應分享器路徑**（`usr/bin/countryallow-*` 6 支腳本、`www/.../view/countryallow.js` 前端、`etc/config/countryallow` conffile、`etc/uci-defaults/40-*` 初裝只排 cron 不抓檔）
- `tools/luci-harness.js` — 前端唯一測試（mini-DOM：唯讀 children、strict、空陣列 RPC 拒收皆仿真）；`tools/luci-verify.js` — headless 截圖
- 無 build/CI；`.gitattributes` 鎖 LF；分支 `main`

## Target & access (no local runtime — deploy to live OpenWrt 25.12.5)
- Windows 直連分享器 key 已失效。一律經 PVE 跳：本機 `ssh -i E:\Temp\opencode\pve_temp_readonly root@192.168.1.250`，再 `ssh -p 2222 root@192.168.1.1`
- 傳檔只用 `scp`＋`sha256sum` 來回對（`cat | ssh` 壓爛中文；dropbear scp 一次單檔；對分享器加 `-O`）
- LuCI `http://192.168.1.1`，root 密碼每次跟使用者拿、用完提醒換掉

## Workflow (order matters)
1. 改 `.js` → `node --check` → `node tools/luci-harness.js` 全綠；改 `.sh` → 零 CR (`grep -c $'\r'` 須為 0) → `sh -n` 本機＋目的端各一次
2. scp 上線 → 線上跑一次 → `logread | grep countryallow`＋`nft list set` 對數 → headless 截圖親眼看
3. 備份到 `../2329225-OpenWrtX86-HOME/`（檔名帶日期版本）；改防火牆／升級前 PVE 先 `qm snapshot 100 <名>`
4. commit 逐檔 `add`（禁 `add .`），push 前掃機密（密碼/key/token/sessionid 不進 repo）

## Python
- Windows 文字處理只用 `python`（3.7；叫 `python` 不是 `python3`）。PowerShell 只跑指令不碰文字
- `subprocess` 用 bytes 接＋`decode('utf-8', errors='replace')`（cp950 會炸中文輸出）

## Hard rules (violations broke prod before)
- fw4：`option ipset` 須配 uci ipset 區段；`fw4 reload` 不重讀 loadfile → 更新腳本一律 flush＋重填 live；勿重複載入 `/etc/nftables.d/`
- LuCI 25.x：空陣列用 `uci.unset`（`set` 會被 rpcd 打回）；按鈕流程自帶 `uci.apply()`；匿名區段 `@ipset[N]` 下標浮動，刪由大到小
- BusyBox 無 `paste/pkill/hexdump`；`$$` 在子 shell 是父 pid
- `/root/luci-ban*`、`/etc/nftables.d/10-luci-guard.nft` 是另一專案，勿動
