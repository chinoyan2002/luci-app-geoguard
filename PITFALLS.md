# 地雷誌 PITFALLS（2026-09-11 夜血淚結晶，動手前讀完）

> 格式：現象 → 原因 → 正解。每條都是當晚真實踩過的。

## A. 傳輸（中文檔專區）
1. `cat 本機檔 | ssh 目的端 "cat > 檔"` 傳中文檔會爛（SSH locale 轉碼）。
   → **一律 `scp`＋`sha256sum` 來回對**。中文檔絕不用管線傳。
2. dropbear 的 scp 多檔一次傳會 `protocol error` → 一次只傳**單檔**。
3. PVE 的 scp 預設走 SFTP，分享器沒有 SFTP → 對分享器一律加 `-O`（`scp -O -P 2222`）。
4. Windows 直連分享器 SSH key 已失效（`Permission denied (publickey)`）。
   → 一律經 PVE 跳：本機→PVE（key直連）→PVE→分享器（port 2222）。

## B. Windows 本機環境
5. PowerShell 寫檔／管線會偷塞 CR、吃中文、`$` 跳脫地獄。
   → **文字處理只用 `python`**（注意指令叫 `python`，3.7，不是 `python3`）；PowerShell 只跑系統指令。
6. `subprocess text=True` 在 cp950 locale 下讀到 UTF-8 中文會炸。
   → 用 bytes 接＋`decode('utf-8', errors='replace')`。
7. `find` 遇到中文路徑編碼炸 → 改用 `Get-ChildItem -LiteralPath`。
8. 換行：`.sh`/`.js` 必須全 LF。`.gitattributes` 已鎖 `* text=auto eol=lf`，
   但編輯器仍可能寫 CRLF → 上線前 `grep -c $'\r'` 必須 0。

## C. Shell／BusyBox（分享器上）
9. `sh -n` 是最低門檻，傳完目的端再跑一次（傳輸可能截斷）。
10. `$$` 在子 shell 拿到的是**父 pid**，寫 pidfile 會錯 → 用 `$!` 或寫死路徑＋`flock`。
11. BusyBox 缺一堆 applet（`paste`、`pkill`、`hexdump`、`od -A` 皆無；`flock` 有）。
    寫腳本前先 `command -v` 確認，否則用 awk/sed 土炮。
12. `nft` set 名含連字號（`allowed-IPList`）在 shell 變數裡沒事，但文件裡別跟減號搞混；
    匿名 uci 區段是 `@ipset[N]`，**N 會隨增刪浮動**，刪除由大到小、勿 hardcode。

## D. firewall4／nft
13. `firewall.@redirect/@rule` 的 `option ipset` **必須**配 uci ipset 區段；
    自建 include 裡的 set 引用不到（`references unknown set`）。
14. **`fw4 reload` 不重讀 loadfile**。只改檔不 flush＝live 還是舊的。
    → 更新腳本一律 flush＋重填（fail-closed 空窗毫秒級）。
15. `/etc/nftables.d/` 會被 fw4 自動載入；uci 裡再 include 一次＝載入兩次打架。
16. 改 ipset 區段前先手動清舊 chain，否則新舊物件並存、規則指到舊的。

## E. LuCI／UCI API（25.x）
17. `uci.set` 空陣列會被 rpcd 打回（ubus code 2）→ 空值用 `uci.unset`。
18. `m.on('save')`、`uci.validate=uciname`（含連字號不行）等舊 API 在 25.x 已死，
    照抄舊文／舊包會炸。改前端前先查現行 `luci.js` 原碼。
19. 真實 DOM 的 `children` **唯讀**；`tools/luci-harness.js` 已仿真——harness 全綠才上線，別繞過。
20. 按鈕流程必須自己 `uci.apply()` 落盤（本包三鍵皆已內含）。
    另注意：RPC 拿到的設定是**快照**，按鈕跑後端前先存檔，否則後端讀到舊值。

## F. 瀏覽器／快取（驗證時）
21. 改完 UI 用戶端說「還是舊的」→ 先問 Ctrl+F5，九成是快取。
22. LuCI 右上角「未儲存的變更: N」可能是**瀏覽器暫存**（server 端 `uci changes` 是空的）。
    → 以 `uci changes` 為準；暫存數字大時叫使用者重開頁，**勿按儲存**。
23. Headless 登入要在 `username` 欄位**先清空再輸入**（直接 type 會黏到 placeholder 送錯）。
24. 截圖驗收要親眼看像素，不要只看「有圖就好」；表格行數、筆數行、按鈕排版都要對。

## G. 資料／語意
25. 訂閱源偶爾回 HTML 錯誤頁或空檔 → 每國檔校驗（≥15 行＋全 CIDR），失敗沿用舊檔並記來源。
26. 來源檔的 `#` 註解行要先濾掉，否則校驗誤殺整檔。
27. A1/A2（匿名/衛星）在訂閱源無此分類——需求單上有也做不出來，先講清楚。
28. 白名單 `A-B` 範圍展開前先驗 A≤B、同家族（v4）；`TEST-NET` 段進白名單會污染合併集。
29. 白名單全空時**不建集合不留檔**（否則空 set 擋掉一切或留孤兒區段）。
