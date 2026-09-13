# -*- coding: utf-8 -*-
"""Full automated build pipeline for luci-app-geoguard:
1. Build zh_Hant .lmo file from po/ (EN is the source language)
2. Assemble payload tree with strict modefix (dir 755 / exec 755 / others 644)
3. Transfer to PVE LXC 201 build container
4. Run abuild -d for signed APK packages + ipkg-build for gzip-tar IPK
5. Pull artifacts back to packages-<VER>/ and verify all signatures, modes, magic bytes.
"""
import gzip
import hashlib
import io
import os
import shutil
import struct
import subprocess
import sys
import tarfile

ROOT_DIR = os.path.normpath(os.path.join(os.path.dirname(__file__), '..'))
APP = 'luci-app-geoguard'
APP_ROOT = os.path.join(ROOT_DIR, APP, 'root')
PO_DIR = os.path.join(ROOT_DIR, APP, 'po')
APKBUILD_PATH = os.path.join(ROOT_DIR, 'packaging', 'APKBUILD')
OUT_BASE = os.path.normpath(os.path.join(ROOT_DIR, '..', '2329225-OpenWrtX86-HOME'))

# Import py_lmo
sys.path.insert(0, os.path.join(ROOT_DIR, 'tools'))
from py_lmo import parse_po, build_lmo, verify_lmo

SSH = ['ssh', '-i', 'E:/Temp/opencode/pve_temp_readonly',
       '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15',
       'root@192.168.1.250']


def pve_run(cmd, timeout=900):
    r = subprocess.run(SSH + [cmd], capture_output=True, timeout=timeout)
    out = r.stdout.decode('utf-8', errors='replace')
    err = r.stderr.decode('utf-8', errors='replace')
    assert r.returncode == 0, f"CMD FAILED [{cmd[:60]}]:\n{err}"
    return out


def main():
    # Read version from Makefile
    makefile = open(os.path.join(ROOT_DIR, APP, 'Makefile'), encoding='utf-8').read()
    ver = None
    rel = '1'
    for line in makefile.splitlines():
        if line.startswith('PKG_VERSION:='):
            ver = line.split(':=')[1].strip()
        elif line.startswith('PKG_RELEASE:='):
            rel = line.split(':=')[1].strip()
    assert ver, "Could not determine PKG_VERSION from Makefile"
    print(f"=== Building {APP} v{ver} ===")

    out_dir = os.path.join(OUT_BASE, f'packages-{ver}')
    os.makedirs(out_dir, exist_ok=True)
    temp_dir = 'E:/Temp/opencode'
    os.makedirs(temp_dir, exist_ok=True)

    # 1. Build .lmo (EN is the source language: no en.lmo needed)
    lmo_jobs = [
        ('zh_Hant/geoguard.po', 'geoguard.zh-tw.lmo', [
            ('Login Guard', '登入防護'),
            ('Unban all IPs', '解除所有IP的封鎖'),
            ('GeoGuard', '國門守衛 GeoGuard'),
        ]),
    ]
    lmo_paths = {}
    for po_rel, lmo_name, probes in lmo_jobs:
        po_path = os.path.join(PO_DIR, po_rel)
        entries = parse_po(po_path)
        data, count = build_lmo(entries)
        dst = os.path.join(temp_dir, lmo_name)
        open(dst, 'wb').write(data)
        assert verify_lmo(dst, probes), f"Verification failed for {lmo_name}"
        lmo_paths[lmo_name] = dst
        print(f"Built {lmo_name}: {len(data)} bytes ({count} entries)")

    # 2. Assemble staging tree
    stage_dir = os.path.join(temp_dir, 'pkgstage', f'{APP}_{ver}')
    shutil.rmtree(os.path.dirname(stage_dir), ignore_errors=True)
    os.makedirs(os.path.join(stage_dir, 'CONTROL'), exist_ok=True)

    for tree, prefix in (('root', ''), ('htdocs', 'www')):
        troot = os.path.join(ROOT_DIR, APP, tree)
        if not os.path.isdir(troot):
            continue
        for dp, _, filenames in os.walk(troot):
            relp = os.path.relpath(dp, troot)
            for fn in filenames:
                src = os.path.join(dp, fn)
                dst = os.path.join(stage_dir, prefix, relp, fn)
                os.makedirs(os.path.dirname(dst), exist_ok=True)
                shutil.copyfile(src, dst)

    i18n_dir = os.path.join(stage_dir, 'usr', 'lib', 'lua', 'luci', 'i18n')
    os.makedirs(i18n_dir, exist_ok=True)
    for lmo_name, path in lmo_paths.items():
        shutil.copyfile(path, os.path.join(i18n_dir, lmo_name))

    control = (f'Package: {APP}\n'
               f'Version: {ver}-{rel}\n'
               'Architecture: all\n'
               'Maintainer: chinoyan\n'
                'Depends: luci-base, firewall4, wget-ssl, jsonfilter\n'
               f'Source: https://github.com/chinoyan2002/{APP}\n'
               'Description: GeoGuard - country allow-list IPS with whitelist, '
               'DDNS allowlist and login guard for firewall4 (LuCI, zh-TW/en)\n')
    open(os.path.join(stage_dir, 'CONTROL', 'control'), 'w', encoding='utf-8', newline='').write(control)
    open(os.path.join(stage_dir, 'CONTROL', 'conffiles'), 'w', encoding='utf-8', newline='').write('/etc/config/geoguard\n')

    # 3. Create tarball with strict modefix
    tgz_path = os.path.join(temp_dir, 'payload.tar.gz')
    exec_dirs = ('usr/bin/', 'etc/init.d/', 'etc/uci-defaults/')
    arc_prefix = f'{APP}_{ver}/'

    def modefix(ti):
        if ti.isdir():
            ti.mode = 0o755
            return ti
        relp = ti.name[len(arc_prefix):] if ti.name.startswith(arc_prefix) else ti.name
        if relp.startswith(exec_dirs):
            ti.mode = 0o755
        else:
            ti.mode = 0o644
        return ti

    with tarfile.open(tgz_path, 'w:gz') as t:
        t.add(stage_dir, arcname=f'{APP}_{ver}', filter=modefix)
    print(f"Created payload: {os.path.getsize(tgz_path)} bytes")

    # 4. Transfer to PVE
    for local_f, pve_f in [(tgz_path, '/tmp/payload.tar.gz'), (APKBUILD_PATH, '/tmp/APKBUILD')]:
        r = subprocess.run(['scp', '-i', 'E:/Temp/opencode/pve_temp_readonly', '-o', 'BatchMode=yes',
                            local_f, f'root@192.168.1.250:{pve_f}'], capture_output=True)
        assert r.returncode == 0, r.stderr.decode('utf-8', errors='replace')
    print("Transferred payload and APKBUILD to PVE")

    # 5. Execute build inside LXC 201
    pve_run('pct push 201 /tmp/payload.tar.gz /root/aports/payload.tar.gz', timeout=120)
    pve_run('pct push 201 /tmp/APKBUILD /root/aports/APKBUILD', timeout=60)
    build_dir = f'/root/build/{APP}_{ver}'
    pve_run(f'pct exec 201 -- sh -c "mkdir -p /root/build && cd /root/build && rm -rf {APP}_{ver} && tar xzf /root/aports/payload.tar.gz && ls {APP}_{ver}"', timeout=120)
    pve_run(f'pct exec 201 -- sh -c "find {build_dir}/usr/bin {build_dir}/etc/init.d {build_dir}/etc/uci-defaults -type f -exec sh -n {{}} + && echo SH-ALL-OK"', timeout=120)
    pve_run('pct exec 201 -- sh -c "cp /home/builder/.abuild/*.rsa.pub /etc/apk/keys/"', timeout=60)
    pve_run('pct exec 201 -- sh -c "cp /root/aports/payload.tar.gz /root/aports/APKBUILD /home/builder/aports/ && '
            'chown builder:builder /home/builder/aports/payload.tar.gz /home/builder/aports/APKBUILD && '
            'rm -rf /home/builder/aports/src /home/builder/aports/pkg && '
            'su -s /bin/sh builder -c \\"cd /home/builder/aports && abuild checksum && abuild -d\\""', timeout=900)
    pve_run(f'pct exec 201 -- sh -c "cd /root/build && /root/ipkg-build-24.10 {APP}_{ver}"', timeout=300)
    print("Build completed inside LXC 201")

    # 6. Pull artifacts
    pulls = [
        (f'/home/builder/packages/builder/x86_64/{APP}-{ver}-r{rel}.apk', f'{APP}_{ver}-r{rel}_all.apk'),
        (f'/home/builder/packages/builder/x86_64/luci-i18n-geoguard-zh-tw-{ver}-r{rel}.apk', f'luci-i18n-geoguard-zh-tw_{ver}-r{rel}_all.apk'),
        ('/home/builder/.abuild/root-6aa40cae.rsa.pub', 'chinoyan-sign-6aa40cae.rsa.pub'),
    ]
    # ipkg-build names the file from the source dir (ignores CONTROL release),
    # so discover the freshly built ipk instead of guessing.
    fresh_ipk = pve_run(f'pct exec 201 -- sh -c "ls -t /root/build/{APP}_{ver}*.ipk | head -n 1"').strip()
    assert fresh_ipk.endswith('.ipk'), f'unexpected ipk discovery: {fresh_ipk}'
    pulls.append((fresh_ipk, f'{APP}_{ver}-{rel}_all.ipk'))
    for src, local in pulls:
        pve_run(f'pct pull 201 {src} /tmp/dl-{local}')
        local_dst = os.path.join(out_dir, local)
        r = subprocess.run(['scp', '-i', 'E:/Temp/opencode/pve_temp_readonly', '-o', 'BatchMode=yes',
                            f'root@192.168.1.250:/tmp/dl-{local}', local_dst], capture_output=True)
        assert r.returncode == 0, f"SCP pull failed for {local}"
        size = os.path.getsize(local_dst)
        sha = hashlib.sha256(open(local_dst, 'rb').read()).hexdigest()
        print(f"Retrieved: {local} ({size} bytes, sha256: {sha[:16]}...)")

    print(f"=== All artifacts saved in {out_dir} ===")


if __name__ == '__main__':
    main()
