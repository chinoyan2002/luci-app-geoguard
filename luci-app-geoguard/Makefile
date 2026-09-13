include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-geoguard
PKG_VERSION:=2.2.1
PKG_RELEASE:=4

PKG_MAINTAINER:=chinoyan
PKG_LICENSE:=MIT
PKG_LICENSE_FILES:=

LUCI_TITLE:=GeoGuard
LUCI_DESCRIPTION:=GeoGuard builds country allow-list ipsets for firewall4 from IP-geolocation feeds, with a custom whitelist, a DDNS no-ban list and a LuCI/SSH login guard.
LUCI_DEPENDS:=+luci-base +firewall4 +wget-ssl +jsonfilter
LUCI_PKGARCH:=all

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - luci.mk handles it