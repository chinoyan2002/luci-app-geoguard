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
    shutil.copyfile(os.path.join(ROOT_DIR, 'packaging', 'ipk-postinst'),
                    os.path.join(stage_dir, 'CONTROL', 'postinst'))

    # 3. Create tarball with strict modefix
    tgz_path = os.path.join(temp_dir, 'payload.tar.gz')
    exec_dirs = ('usr/bin/', 'etc/init.d/', 'etc/uci-defaults/')
    arc_prefix = f'{APP}_{ver}/'

    def modefix(ti):
        if ti.isdir():
            ti.mode = 0o755
            return ti
        relp = ti.name[len(arc_prefix):] if ti.name.startswith(arc_prefix) else ti.name
        if relp.startswith(exec_dirs) or relp == 'CONTROL/postinst':
            ti.mode = 0o755
        else:
            ti.mode = 0o644
        return ti

    with tarfile.open(tgz_path, 'w:gz') as t:
        t.add(stage_dir, arcname=f'{APP}_{ver}', filter=modefix)
    print(f"Created payload: {os.path.getsize(tgz_path)} bytes")

    # 4. Transfer to PVE
    for local_f, pve_f in [(tgz_path, '/tmp/payload.tar.gz'), (APKBUILD_PATH, '/tmp/APKBUILD'),
                           (os.path.join(ROOT_DIR, 'packaging', 'luci-app-geoguard.post-install'),
                            '/tmp/luci-app-geoguard.post-install')]:
        r = subprocess.run(['scp', '-i', 'E:/Temp/opencode/pve_temp_readonly', '-o', 'BatchMode=yes',
                            local_f, f'root@192.168.1.250:{pve_f}'], capture_output=True)
        assert r.returncode == 0, r.stderr.decode('utf-8', errors='replace')
    print("Transferred payload and APKBUILD to PVE")

    # 5. Execute build inside LXC 201
    pve_run('pct push 201 /tmp/payload.tar.gz /root/aports/payload.tar.gz', timeout=120)
    pve_run('pct push 201 /tmp/APKBUILD /root/aports/APKBUILD', timeout=60)
    pve_run('pct push 201 /tmp/luci-app-geoguard.post-install /root/aports/luci-app-geoguard.post-install', timeout=60)
    build_dir = f'/root/build/{APP}_{ver}'
    pve_run(f'pct exec 201 -- sh -c "mkdir -p /root/build && cd /root/build && rm -rf {APP}_{ver} && tar xzf /root/aports/payload.tar.gz && ls {APP}_{ver}"', timeout=120)
    pve_run(f'pct exec 201 -- sh -c "find {build_dir}/usr/bin {build_dir}/etc/init.d {build_dir}/etc/uci-defaults -type f -exec sh -n {{}} + && echo SH-ALL-OK"', timeout=120)
    pve_run('pct exec 201 -- sh -c "cp /home/builder/.abuild/*.rsa.pub /etc/apk/keys/"', timeout=60)
    pve_run('pct exec 201 -- sh -c "cp /root/aports/payload.tar.gz /root/aports/APKBUILD /root/aports/luci-app-geoguard.post-install /home/builder/aports/ && '
            'chown builder:builder /home/builder/aports/payload.tar.gz /home/builder/aports/APKBUILD /home/builder/aports/luci-app-geoguard.post-install && '
            'rm -rf /home/builder/aports/src /home/builder/aports/pkg && '
            'su -s /bin/sh builder -c \\"cd /home/builder/aports && abuild checksum && abuild -d\\""', timeout=900)
    # 5b. Strip unresolvable auto-deps (OpenWrt apk has no /bin/sh provider;
    # /bin/sh is always present via busybox) and re-sign.
    for local_f, pve_f in [(os.path.join(ROOT_DIR, 'packaging', 'strip-deps.sh'),
                            '/tmp/strip-deps.sh')]:
        r = subprocess.run(['scp', '-i', 'E:/Temp/opencode/pve_temp_readonly', '-o', 'BatchMode=yes',
                            local_f, f'root@192.168.1.250:{pve_f}'], capture_output=True)
        assert r.returncode == 0, r.stderr.decode('utf-8', errors='replace')
    pve_run('pct push 201 /tmp/strip-deps.sh /root/strip-deps.sh', timeout=60)
    pve_run('pct exec 201 -- sh -c "cp /root/strip-deps.sh /home/builder/strip-deps.sh && chown builder:builder /home/builder/strip-deps.sh && su -s /bin/sh builder -c \'/bin/sh /home/builder/strip-deps.sh\'"', timeout=300)
    pve_run(f'pct exec 201 -- sh -c "cd /root/build && /root/ipkg-build-24.10 {APP}_{ver}"', timeout=300)
    print("Build completed inside LXC 201")

    # 6. Pull artifacts
    pulls = [
        (f'/home/builder/packages/builder/x86_64/{APP}-{ver}-r{rel}.apk', f'{APP}_{ver}-r{rel}_all.apk'),
        (f'/home/builder/packages/builder/x86_64/luci-i18n-geoguard-zh-tw-{ver}-r{rel}.apk', f'luci-i18n-geoguard-zh-tw_{ver}-r{rel}_all.apk'),
        ('/home/builder/.abuild/root-6aa40cae.rsa.pub', 'root-6aa40cae.rsa.pub'),
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

    # 7. Structural verify of both apk files (gzip-member aware: member0 =
    # signature tar, member1 = data tar; never concatenate, --cut breaks that).
    for apk_local, want_post in ((f'{APP}_{ver}-r{rel}_all.apk', True),
                                 (f'luci-i18n-geoguard-zh-tw_{ver}-r{rel}_all.apk', False)):
        raw = open(os.path.join(out_dir, apk_local), 'rb').read()
        offs = [i for i in range(len(raw)) if raw[i:i + 2] == b'\x1f\x8b']
        assert len(offs) >= 2, f'{apk_local}: want 2+ gzip members, got {len(offs)}'
        signames = tarfile.open(fileobj=io.BytesIO(_gz1(raw, offs[0]))).getnames()
        assert any(n.startswith('.SIGN') for n in signames), f'{apk_local}: no .SIGN: {signames}'
        ctlnames = tarfile.open(fileobj=io.BytesIO(_gz1(raw, offs[1]))).getnames()
        assert '.PKGINFO' in ctlnames, f'{apk_local}: control w/o PKGINFO: {ctlnames}'
        has_post = '.post-install' in ctlnames
        assert has_post == want_post, f'{apk_local}: control .post-install={has_post}'
        data = _gz1(raw, offs[-1])
        dtar = tarfile.open(fileobj=io.BytesIO(data))
        names = dtar.getnames()
        assert '.PKGINFO' in names, f'{apk_local}: .PKGINFO missing: {names[:6]}'
        assert not any(n.startswith('CONTROL') for n in names), f'{apk_local}: stray CONTROL/'
        info = tarfile.open(fileobj=io.BytesIO(_gz1(raw, offs[1]))).extractfile('.PKGINFO').read().decode()
        assert 'depend = /bin/sh' not in info, f'{apk_local}: /bin/sh dep still present'
        dh = [l for l in info.split('\n') if l.startswith('datahash')][0].split('=')[1].strip()
        assert hashlib.sha256(raw[offs[-1]:]).hexdigest() == dh, f'{apk_local}: datahash mismatch'
        assert not any(n.startswith('CONTROL') for n in names), f'{apk_local}: stray CONTROL/'
        print(f"Verified apk structure: {apk_local} (control={ctlnames} data={len(names)} entries)")

    print(f"=== All artifacts saved in {out_dir} ===")


def _gz1(raw, off):
    """Decompress a single gzip member starting at off."""
    import zlib
    d = zlib.decompressobj(31)
    out = d.decompress(raw[off:])
    assert d.eof, 'truncated gzip member'
    return out


if __name__ == '__main__':
    main()
