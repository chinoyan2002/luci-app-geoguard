#!/bin/sh
# strip-deps.sh v3 (runs on LXC 201 as builder):
# remove auto-deps OpenWrt apk cannot resolve (/bin/sh has no provider there;
# /bin/sh is always present via busybox). Rebuilds the 3-member layout
# [control][data] + fresh datahash, then abuild-sign prepends the signature.
set -eu
mkdir -p /tmp/repack
cd /tmp/repack
for a in /home/builder/packages/builder/x86_64/luci-app-geoguard-2.2.0-r1.apk \
         /home/builder/packages/builder/x86_64/luci-i18n-geoguard-zh-tw-2.2.0-r1.apk; do
	[ -f "$a" ] || continue
	rm -rf w && mkdir w
	gzip -dc "$a" | tar -x -C w
	rm -f w/.SIGN.*
	sed -i '/^depend = \/bin\/sh$/d' w/.PKGINFO
	gzip -dc "$a" | tar -tf - | grep -vE '^\.' > data.txt
	[ -s data.txt ] || { echo "EMPTY-DATA $a"; exit 1; }
	(cd w && tar -cf - -T ../data.txt) | gzip -n -9 > data.gz
	DH=$(sha256sum data.gz | cut -d' ' -f1)
	sed -i "s/^datahash = .*/datahash = $DH/" w/.PKGINFO
	grep -q "^datahash = $DH" w/.PKGINFO || { echo "HASH-UPDATE-FAILED $a"; exit 1; }
	CTL=".PKGINFO"
	[ -f w/.post-install ] && CTL="$CTL .post-install"
	{ (cd w && tar -cf - $CTL | gzip -n -9); cat data.gz; } > "$a.new"
	mv -f "$a.new" "$a"
	abuild-sign "$a"
done
echo STRIP-SIGN-DONE
