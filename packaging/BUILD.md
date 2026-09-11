# 打包說明（給下一個發版的人）

## 一鍵發版腳本
- `python packaging/build_packages.py`
  自動編譯 `.lmo`、組裝 payload、執行 modefix、傳送 LXC 201 容器、簽名生成 `.apk` (x3) 與 `.ipk`、回傳至 `packages-<VERSION>/` 並執行校驗。

## 產線（PVE LXC 201 `apkbuild`，Alpine）
- `.apk`：`abuild -d`（`depends` 是 OpenWrt 套件名，Alpine 裝不到，一律 `-d` 跳過依賴檢查）
- `.ipk`：用 `ipkg-build-24.10` 建（官方 24.10 包就是 gzip 包 tar 容器：
  `./debian-binary`、`./data.tar.gz`、`./control.tar.gz`，跟官方逐欄對過）。
  血淚教訓：**絕對不要轉成 ar！**24.10 的 opkg 不吃 ar，轉了就是
  `Malformed package file`（2026-09-12 在公司 24.10 實證）。舊的 `ar_repack.py`
  已作廢，勿用。
- 執行位地雷三連（都踩過）：
  1. Windows 組 tarball 一律過 `modefix`（目錄 755／腳本 755／其餘 644；注意前綴比對別寫錯）
  2. `APKBUILD` 的 `package()` 用 `cp -a`（`cp -r` 吃掉執行位）
  3. 驗包看外層魔數：ipk 必須是 gzip（`1f 8b`），apk 解開腳本必須 755
- abuild 不給 root 跑：`builder` 用戶＋`PACKAGER_PRIVKEY` 指 key；`abuild checksum` 每次 payload 變都要重跑
- 簽名 key：`root-6aa40cae`，私鑰只在 LXC，公鑰隨包發布（`packages-1.1.0/*.rsa.pub`）

## 安裝（使用者側）
- 25.x（apk）：先信任公鑰或 `apk add --allow-untrusted *.apk`；主包＋`luci-i18n-geoguard-zh-tw`
  （語系包可不裝；英文即原始字串無需語系包）；語言跟 LuCI 系統走，conffile（`/etc/config/geoguard`、guard）會進
  `.apk-new` 不蓋掉現值
- 24.x（opkg）：`opkg install *.ipk`（容器／成員／control／755 已對官方包逐欄驗過；
  1.1.0-1 的 ar 版已下架作廢，勿傳）

## control 模板（opkg）
見 `luci-app-geoguard` Makefile 的 Depends/Description；`CONTROL/control` 由產線腳本生成，
改版記得同步 Version。
