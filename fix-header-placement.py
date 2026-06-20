#!/usr/bin/env python3
"""
Fix page title placement across all pages to match home page hero style.
- Desktop: nav-upgrade .hdr changes from compact 60px bar to vertical hero layout
- Mobile: removes extra 44px padding so title sits right at the top
"""
import os, glob

PUBLIC = '/root/th-am-ops-staging/public'

# ── 14 nav-upgrade pages ──────────────────────────────────────────────────────
NAV_UPGRADE_PAGES = [
    'audit.html','ceo.html','delivery.html','events.html','fdu-upload.html',
    'feedback.html','hod.html','kpi.html','performance-fy27.html',
    'performance.html','sap-upload.html','targets.html','tasks.html','training.html'
]

# Desktop .hdr: compact 60px bar → vertical hero column
OLD_DESKTOP_HDR = 'padding:0 32px!important;height:60px!important;\n  display:flex!important;align-items:center!important;gap:16px!important;'
NEW_DESKTOP_HDR = 'padding:22px 32px 18px!important;\n  display:flex!important;flex-direction:column!important;align-items:flex-start!important;gap:4px!important;'

# Mobile .hdr: 44px blank space → 14px (right at top after safe area)
OLD_MOBILE_HDR = 'padding:calc(env(safe-area-inset-top,0px) + 44px) 16px 18px!important;'
NEW_MOBILE_HDR = 'padding:calc(env(safe-area-inset-top,0px) + 14px) 20px 24px!important;'

# Desktop .hdr-sub: margin-left:auto (pushes right) → 0 (stays left)
OLD_HDRSUB = 'margin-left:auto!important;}'
NEW_HDRSUB = 'margin-left:0!important;}'

updated = []
for fname in NAV_UPGRADE_PAGES:
    path = os.path.join(PUBLIC, fname)
    with open(path) as f:
        text = f.read()
    orig = text
    text = text.replace(OLD_DESKTOP_HDR, NEW_DESKTOP_HDR)
    text = text.replace(OLD_MOBILE_HDR,  NEW_MOBILE_HDR)
    text = text.replace(OLD_HDRSUB,      NEW_HDRSUB)
    if text != orig:
        with open(path, 'w') as f:
            f.write(text)
        updated.append(fname)
    else:
        print(f'  WARN: no change in {fname}')

print(f'Nav-upgrade pages updated ({len(updated)}): {updated}')
