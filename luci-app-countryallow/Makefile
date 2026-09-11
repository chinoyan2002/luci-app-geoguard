include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-countryallow
PKG_VERSION:=1.1.0
PKG_RELEASE:=1

PKG_MAINTAINER:=chinoyan
PKG_LICENSE:=MIT
PKG_LICENSE_FILES:=

LUCI_TITLE:=Country Allow List
LUCI_DESCRIPTION:=Build and maintain country-based IPv4 allow-list sets for firewall4, with whitelist and dual subscription sources.
LUCI_DEPENDS:=+firewall4 +wget-ssl +uhttpd
LUCI_PKGARCH:=all

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - luci.mk handles it
