#!/usr/bin/env python3
"""Standardise page headers across all HTML pages to match index.html's clean style:
   - Mobile: white/surface bg + dark text (was: red gradient + white text)
   - Desktop: 26px font (was: 20px)
"""
import os, re, glob

HTML_DIR = '/root/th-am-ops-staging/public'

# ── replacements inside nav-upgrade <style> blocks ────────────────────────────

DESKTOP_OLD1 = 'font-size:20px!important;font-weight:700!important;color:#1D1D1F!important;letter-spacing:-0.3px!important;}'
DESKTOP_NEW  = 'font-size:26px!important;font-weight:700!important;color:var(--text)!important;letter-spacing:-0.5px!important;}'

DESKTOP_OLD2 = 'font-size:20px!important;font-weight:700!important;color:var(--text)!important;letter-spacing:-0.3px!important;}'
# same new

MOBILE_BG_OLD = 'background:linear-gradient(150deg,#1A0508 0%,#C8102E 60%,#9B0D22 100%)!important;'
MOBILE_BG_NEW = 'background:var(--surface)!important;border-bottom:1px solid var(--border)!important;'

MOBILE_TITLE_OLD = 'font-size:24px!important;color:#fff!important;}'
MOBILE_TITLE_NEW = 'font-size:26px!important;color:var(--text)!important;}'

MOBILE_EYE_OLD = '.hdr-eye{color:rgba(255,255,255,0.55)!important;}'
MOBILE_EYE_NEW = '.hdr-eye{color:var(--text3)!important;}'

MOBILE_SUB_OLD = 'color:rgba(255,255,255,0.6)!important;margin-left:0!important;}'
MOBILE_SUB_NEW = 'color:var(--text2)!important;margin-left:0!important;}'

MOBILE_COMMENT_OLD = '/* restore mobile gradient header */'
MOBILE_COMMENT_NEW = '/* restore mobile header */'

changed_files = []

for path in sorted(glob.glob(os.path.join(HTML_DIR, '*.html'))):
    fname = os.path.basename(path)
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content

    content = content.replace(MOBILE_BG_OLD,     MOBILE_BG_NEW)
    content = content.replace(MOBILE_TITLE_OLD,   MOBILE_TITLE_NEW)
    content = content.replace(MOBILE_EYE_OLD,     MOBILE_EYE_NEW)
    content = content.replace(MOBILE_SUB_OLD,     MOBILE_SUB_NEW)
    content = content.replace(MOBILE_COMMENT_OLD, MOBILE_COMMENT_NEW)
    content = content.replace(DESKTOP_OLD1,       DESKTOP_NEW)
    content = content.replace(DESKTOP_OLD2,       DESKTOP_NEW)

    if content != original:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        changed_files.append(fname)
        print(f'  updated: {fname}')

print(f'\n{len(changed_files)} pages updated.')
