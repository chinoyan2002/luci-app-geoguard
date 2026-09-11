# 打包說明（給下一個發版的人）

## 產線（PVE LXC 201 `apkbuild`，Alpine）
- `.apk`：`abuild -d`（`depends` 是 OpenWrt 套件名，Alpine 裝不到，一律 `-d` 跳過依賴檢查）
- `.ipk`：**不用主倉 `ipkg-build`**（它現在吐 tar 容器，opkg 不吃）→ 用 `ipkg-build-24.10`
  建出內層後，本機 `ar_repack.py` 重包成標準 ar（`E:\Temp\opencode\` 有腳本，發行前要收進來）
- 執行位地雷三連（都踩過）：
  1. Windows 組 tarball 一律過 `modefix`（目錄 755／腳本 755／其餘 644）
  2. `APKBUILD` 的 `package()` 用 `cp -a`（`cp -r` 吃掉執行位）
  3. LXC 內 `ar` 來自 `binutils`（沒裝會靜默退回 tar 模式，要檢查魔數 `!<arch>`）
- abuild 不給 root 跑：`builder` 用戶＋`PACKAGER_PRIVKEY` 指 key；`abuild checksum` 每次 payload 變都要重跑
- 簽名 key：`root-6aa40cae`，私鑰只在 LXC，公鑰隨包發布（`packages-1.1.0/*.rsa.pub`）

## 安裝（使用者側）
- 25.x（apk）：先信任公鑰或 `apk add --allow-untrusted *.apk`；主包＋`luci-i18n-countryallow-en`
  （英文包可不裝）；語言跟 LuCI 系統走，conffile（`/etc/config/countryallow`、guard）會進
  `.apk-new` 不蓋掉現值
- 24.x（opkg）：`opkg install *.ipk`（結構已驗 ar＋control，待 24.x 真機實裝回報）

## control 模板（opkg）
見 `luci-app-countryallow` Makefile 的 Depends/Description；`CONTROL/control` 由產線腳本生成，
改版記得同步 Version。
