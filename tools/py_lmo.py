# -*- coding: utf-8 -*-
"""Minimal po2lmo (from luci po2lmo.c logic): po -> .lmo + self-verify."""
import os
import struct
import sys

MASK = 0xFFFFFFFF


def sfh_get16(d, i):
    return ((d[i + 1] << 8) + d[i]) & MASK if i + 1 < len(d) else d[i]


def sfh_hash(data, init):
    if isinstance(data, str):
        data = data.encode('utf-8')
    h = init & MASK
    n = len(data)
    rem = n & 3
    length = n >> 2
    pos = 0
    for _ in range(length):
        h = (h + ((data[pos + 1] << 8) + data[pos])) & MASK
        tmp = ((((data[pos + 3] << 8) + data[pos + 2]) << 11) ^ h) & MASK
        h = ((h << 16) ^ tmp) & MASK
        pos += 4
        h = (h + (h >> 11)) & MASK
    if rem == 3:
        h = (h + ((data[pos + 1] << 8) + data[pos])) & MASK
        h ^= (h << 16) & MASK
        b = data[pos + 2]
        b = b - 256 if b > 127 else b
        h ^= (b << 18) & MASK
        h = (h + (h >> 11)) & MASK
    elif rem == 2:
        h = (h + ((data[pos + 1] << 8) + data[pos])) & MASK
        h ^= (h << 11) & MASK
        h = (h + (h >> 17)) & MASK
    elif rem == 1:
        b = data[pos]
        b = b - 256 if b > 127 else b
        h = (h + b) & MASK
        h ^= (h << 10) & MASK
        h = (h + (h >> 1)) & MASK
    h ^= (h << 3) & MASK
    h = (h + (h >> 5)) & MASK
    h ^= (h << 4) & MASK
    h = (h + (h >> 17)) & MASK
    h ^= (h << 25) & MASK
    h = (h + (h >> 6)) & MASK
    return h & MASK


def parse_po(path):
    entries = []
    mid, mstr = None, None
    for line in open(path, encoding='utf-8').read().split('\n'):
        line = line.strip()
        if line.startswith('msgid "'):
            if mid is not None:
                entries.append((mid, mstr))
            mid = line[7:-1].replace('\\"', '"').replace('\\\\', '\\')
            mstr = None
        elif line.startswith('msgstr "'):
            mstr = line[8:-1].replace('\\"', '"').replace('\\\\', '\\')
    if mid is not None:
        entries.append((mid, mstr))
    return [(k, v) for k, v in entries if k and v]


def build_lmo(entries):
    blob = b''
    index = []
    offset = 0
    for k, v in entries:
        kb = k.encode('utf-8')
        vb = v.encode('utf-8')
        kh = sfh_hash(kb, len(kb))
        vh = sfh_hash(vb, len(vb))
        if kh == vh:
            continue
        index.append((kh, 1, offset, len(vb)))
        blob += vb
        blob += b'\x00' * ((4 - len(vb) % 4) % 4)
        offset += len(vb) + ((4 - len(vb) % 4) % 4)
    index.sort()
    out = blob
    for kh, plural, off, ln in index:
        out += struct.pack('>IIII', kh, plural, off, ln)
    out += struct.pack('>I', offset)
    return out, len(index)


def verify_lmo(path, probes):
    """Binary-search reader mirroring lmo_find_entry."""
    data = open(path, 'rb').read()
    idx_off = struct.unpack('>I', data[-4:])[0]
    n = (len(data) - idx_off - 4) // 16
    idx = [struct.unpack('>IIII', data[idx_off + i * 16:idx_off + i * 16 + 16])
           for i in range(n)]

    def find(key):
        h = sfh_hash(key.encode('utf-8'), len(key.encode('utf-8')))
        lo, hi = 0, n - 1
        while lo <= hi:
            m = (lo + hi) // 2
            if idx[m][0] == h:
                _, _, off, ln = idx[m]
                return data[off:off + ln].decode('utf-8')
            elif idx[m][0] > h:
                hi = m - 1
            else:
                lo = m + 1
        return None

    ok = True
    for k, want in probes:
        got = find(k)
        mark = 'OK' if got == want else 'FAIL(%r)' % got
        if got != want:
            ok = False
        print(mark, k[:40])
    return ok


if __name__ == '__main__':
    here = os.path.dirname(os.path.abspath(__file__))
    po = os.path.normpath(os.path.join(here, '../luci-app-geoguard/po/en/geoguard.po'))
    entries = parse_po(po)
    print('parsed', len(entries))
    out, n = build_lmo(entries)
    lmo = os.path.normpath(os.path.join(here, '../luci-app-geoguard/po/en/geoguard.en.lmo'))
    open(lmo, 'wb').write(out)
    print('wrote', lmo, len(out), 'bytes,', n, 'entries')
    probes = [
        ('登入防護', 'Login Guard'),
        ('解除所有IP的封鎖', 'Unban all IPs'),
        ('每天', 'Daily'),
    ]
    assert verify_lmo(lmo, probes), 'LMO VERIFY FAILED'
    print('LMO-VERIFY-OK')
