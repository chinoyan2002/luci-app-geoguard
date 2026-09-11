# 規格書：國家IPS集合建立器 Country Allow List（SPEC v1，2026-09-11）

## 1. 目的
在 OpenWrt 上用 LuCI 勾選國家＋自訂白名單，自動產生 firewall4 可引用的 IPv4
集合（ipset），擋掉名單外的國家。頁面本身不寫防火牆規則，只生產集合。

## 2. 元件與路徑（分享器上）
| 元件 | 路徑 | 性質 |
|---|---|---|
| 前端 | `/www/luci-static/resources/view/countryallow.js` | 設定／記錄雙籤 |
| 抓取 | `/usr/bin/countryallow-fetch` | 只抓各國檔 |
| 更新 | `/usr/bin/countryallow-update` | 抓取＋合併＋同步區段＋刷新 live |
| 排程 | `/usr/bin/countryallow-cron` | 依 UCI 寫 crontab |
| 狀態 | `/usr/bin/countryallow-status` | 記錄頁輸出 |
| 筆數 | `/usr/bin/countryallow-counts` | 設定頁輸出 `名 行數 live數 日期` |
| 清歷史 | `/usr/bin/countryallow-clear-history` | 清 history.log |
| 設定 | `/etc/config/countryallow` | 全部設定（conffile） |
| 資料 | `/etc/luci-uploads/*.cidr` | 各國檔＋合併檔（執行期產生） |
| 對照 | `/etc/luci-uploads/cc-en.txt` | 國碼→英文（註解用） |
| 歷史 | `/etc/luci-uploads/history.log` | 更新歷史（200 行輪轉） |
| 選單/權限 | `/usr/share/luci/menu.d/`、`/usr/share/rpcd/acl.d/` | 各一 json |

## 3. 訂閱源（LuCI 可改，`{cc}`小寫 `{CC}`大寫）
- 主要：`https://www.ipdeny.com/ipblocks/data/aggregated/{cc}-aggregated.zone`
- 備用：`https://raw.githubusercontent.com/ipverse/country-ip-blocks/master/country/{cc}/ipv4-aggregated.txt`
- 逐國先主後備；全掛沿用舊檔；`#` 註解行先濾掉再校驗（≥15 行＋全 CIDR）。

## 4. 白名單三格式（UI 即時擋＋腳本二次驗）
單一 IP（自動補 `/32`）、CIDR（遮罩 0–32）、`A-B` 範圍（awk 展開最小 CIDR，
已對 Python ipaddress 驗到逐段一致）。非法進不了清單；國家全空＋有 IP＝純白名單。

## 5. 集合規則
- 各國：有檔才建 `tw`、`jp`…；退選 → flush＋刪區段（live 不留孤兒）。
- 合併：`<setname>.cidr`（預設 `allowed-IPList`），國家＋白名單合併。
- 白名單獨立集合（預設 `CustomAllow`）；空白不建不留檔。
- 改名：舊區段刪除＋引用規則自動改指；`applied_*`＋`managed` 追蹤。
- 註解：國家 `<EN> IPs`（cc-en.txt）、合併 `Merged allow IPs`、白名單 `Custom allow IPs`。
- fw4 reload **不重讀 loadfile**，所以每次更新都 flush＋重填 live（fail-closed 毫秒級）。

## 6. 排程
每天／每週日／每月1日＋時分＋啟用旗標 → `countryallow-cron` 寫 crontab。
按鈕流程一律：存檔 → `uci.apply()` 落盤 → 檢集合名 → 跑後端 → 同步 cron。

## 7. LuCI 頁面（設定／記錄雙籤）
- 國家單表 217 國：搜尋（碼/中/英）、全選（僅可見）、清除、已勾選即時行。
- 筆數行：`目前啟用：<名>.cidr（N 行／live M 段／更新於 ...）`，更新後自動重刷。
- 白名單自訂新增列（格式即時擋）、來源、集合名（自訂校驗＋執行前閘門）、排程單列、三鍵同排、儲存。
- 記錄頁：狀態＋更新歷史（逐國結果＋無更新明示）＋系統日誌＋清除鍵。
- A1/A2 未列入（訂閱源無此分類）。

## 8. 驗證（改完必跑）
`node --check`＋`tools/luci-harness.js`（mini-DOM：唯讀 children、strict、空陣列 RPC 拒收皆仿真）
→ scp＋sha256 來回對 → `sh -n`＋零 CR → headless Chrome 截圖親眼看。

## 9. 已知限制
- IPv4 only；LuCI 防火牆頁無集合欄位，掛規則走 uci；TW/JP 舊系統已退役。
- ban LuCI（luci-ban）是另一專案，不在本包。
