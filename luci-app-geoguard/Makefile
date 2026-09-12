include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-geoguard
PKG_VERSION:=2.1.9
PKG_RELEASE:=2

PKG_MAINTAINER:=chinoyan
PKG_LICENSE:=MIT
PKG_LICENSE_FILES:=

LUCI_TITLE:=GeoGuard
LUCI_DESCRIPTION:=Country allow-list IPS builder with whitelist, DDNS allowlist and login guard for firewall4 (LuCI, zh-TW/en).
LUCI_DEPENDS:=+firewall4 +wget-ssl +uhttpd
LUCI_PKGARCH:=all

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - luci.mk handles it
