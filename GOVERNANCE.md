# GOVERNANCE — 最高指導原則（openwrt-ai #9027 優先）

> Source of truth: https://github.com/openwrt/luci/pull/9027 內 `openwrt-ai` review（PR 已於 2026-09-19 撤回，見下）。
> 本套件開發、Git 推送、簽名、commit 訊息，一切以該 PR 的 openwrt-ai 要求為準。
> 與 `AGENTS.md` Hard rules 或其他手冊牴觸時，openwrt-ai 贏，舊條文讓路並在此註明。
> 追蹤方式：活體追蹤（PR 有新 review 即更新本檔 §3＋日期）。
> 鐵律：PR 上每做完一輪修改必回覆（review thread 逐串回＋一次總結留言；bot 檢查只推碼不需回，但純訊息修正等仍留一則總結）。
>
> ## PR 撤回（2026-09-19，dibdot NAK：錯 repo＋重複＋驗證質疑）
> 接受維持者判斷，不爭辯；續留自家 repo＋release feed。rshift 認了：上機沒跑過 ban 豁免路徑，verified-live 寫過頭。round-8 三 nit 已在自家樹修掉（`127683e`），未推 PR。關門留言 `issuecomment-5744493473`。

## 1. 效力
1. `GOVERNANCE.md` > `AGENTS.md` > `HANDOFF.md`/`SPEC.md`/`RUNBOOK.md`/`PITFALLS.md`。
2. 本地舊條文（如 DEP 寫 `+uhttpd`）若與 openwrt-ai 衝突，以 openwrt-ai 為準（現行：`LUCI_DEPENDS` 須含 `+jsonfilter`）。

## 2. Git / 推送 / 簽名（openwrt-ai commit checks）
- 單一 well-formed commit（記取 #9023 broken force-push 教訓，勿重寫 parent）。
- 訊息只描述 shipped behaviour，不寫 vs 未合併舊版的 delta。
- `Signed-off-by: Yang Min Sheng <chinoyan@gmail.com>` 須與 PR 描述名一致。
- commit body 每行 ≤100 字（FormalityCheck 硬門檻；續行縮排 2 格；`1339e1a→b85849e` 只改訊息即過）。
- 認證用 GitHub device flow；密碼/key/token/sessionid 永不進 repo（push 前掃）。

## 3. openwrt-ai 鐵律清單（2026-09-19 已讀 round-7 兩條 4052202758/013；有新 review 即追加）
> PR 同步：`c1d3c5b` 已 force-push（單 commit，sign-off 不變，body ≤100）；2 串回覆 `4052545282/83`＋總結 `issuecomment-5740201560`。ban_enabled 全 repo 8 處 fail-quiet 稽核完。獨立包 repo 另有 `fetch/ban` 狀態搬家＋`js VERSION 2.2.1`（PR 未含，勿整檔覆蓋，只動手術式 hunk）。
> 兩案制（用戶原則，AI 未牴觸）：新裝零修改（三 OFF＋uci-defaults 無啟用證據即靜默）；升級照存檔還原（防 rules 指空集合鎖死）。
> 2026-09-20 修正：restore 條件從 ui_saved 擴為「任一啟用證據」（opkg prerm 升級照清 cron，舊設定無 marker 會被靜默斷排程，2244526 實證）。
- awk：BusyBox 無 `rshift()` 等 gawk 擴充，用 `int(x/2^(32-m))` 純算術（`geoguard-ban` in_list/in_exempt/ban_ip）。
- ACL：view 無 `fs.read/fs.write` 即不授 `*.cidr` 讀寫（fw4 `loadfile` 消費檔不可放寬）；每 helper 最小 `exec`；4-tab 縮排；保留 `uci geoguard` 讀寫。
- Makefile：`conffiles` 含 `/etc/config/geoguard`＋runtime 重產的 guard nft；`LUCI_PKGARCH:=all`。
- flash：`geoguard-fetch` 先 `cmp -s` 才裝檔；`keep.d` 只保真 state，`.update.lockdir/pid` 移 `/var/lock`（tmpfs，避 sysupgrade 還魂 pid 致 `kill -0` 誤判 exit 0 forever）。
- 併發：fetch/update 共用 lockdir＋`GEOGUARD_LOCKED` bypass；trap 先裝 temp-only 再升級含 lock；`/tmp` 不洩漏。
- cron：三處 append 前先補 trailing newline；`NOTE_DDNS` 兩檔 byte-for-byte 一致。
- 打包：樹內已 `100755` 者不加 no-op `chmod`；seed 背景下載須 gate 在 UI 首次 save marker，不看 shipped `list selected 'tw'`。
- 文：英文註解/ASCII 標點/無 double `_()`/`.pot` 帶 source refs；Weblate 後翻。
- dead code：`$DESIRED` 已 `[ -s ]` 過的 missing-state warning 屬 unreachable，勿加。

## 4. 驗證（本地＋上機）
- 本地：`node --check`＋`tools/luci-harness.js`；`.sh` 零 CR＋`sh -n`；`git show --stat` 逐檔 add（禁 `add .`）。
- 上機：`scp -O`＋`sha256sum` 對→`logread|grep geoguard`＋`nft list set`→headless 截圖。

## 5. 回滾
- 刪本檔＋revert `AGENTS.md`/`HANDOFF.md` 引用即回；改防火牆/升級前 PVE `qm snapshot 100 <名>`。
