#!/usr/bin/env python3
"""Build the course pages.

    python3 src/build.py              # website pages: indonesian/index.html, burmese/index.html
    python3 src/build.py --artifact   # single-file pages for claude.ai artifacts (artifact-build/)
"""
import json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'src')
SITE = json.load(open(os.path.join(SRC, 'site.json'), encoding='utf-8'))

def rd(*p):
    return open(os.path.join(SRC, *p), encoding='utf-8').read()

COURSES = {
    'indonesian': dict(title='Kancil Indonesian', short='Kancil', file='indonesian.json',
        theme=('#EFF1F6', '#12141F'),
        desc='Learn Indonesian in short daily lessons: a skill tree with crowns, tips, typing, listening, and sentence building.',
        fonts='https://fonts.googleapis.com/css2?family=Gabarito:wght@500;600;700;800;900&family=Lexend:wght@400;500;600;700&display=swap'),
    'burmese': dict(title='Zaga Burmese', short='Zaga', file='burmese.json',
        theme=('#EEF1EA', '#16131B'),
        desc='Learn Burmese in short daily lessons: a skill tree with crowns, tips, script practice, and sentence building.',
        fonts='https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&family=Bricolage+Grotesque:opsz,wght@12..96,600..800&family=Padauk:wght@400;700&display=swap'),
}

BODY = '''<div id="app">
  <header class="top"><div class="top-in gutter" id="topbar"></div></header>
  <main id="main" class="gutter"></main>
  <nav class="tabs gutter" aria-label="Sections"><div class="tabs-in" id="tabs"></div></nav>
  <div id="toast" class="toast" role="status" hidden></div>
</div>
<section id="lesson" class="overlay" aria-label="Lesson" hidden></section>
<section id="guide" class="overlay" aria-label="Tips" hidden></section>'''

def scripts(name, c, sync):
    course = rd('courses', name, 'course.txt')
    for bad in ('`', '${', '</'):
        assert bad not in course, f'{name}: course text may not contain {bad!r}'
    extra = f"CFG.syncFile = {json.dumps(c['file'])};\nCFG.progressRepo = {json.dumps(SITE.get('progressRepo', ''))};\n"
    return ('<script>\n' + rd('courses', name, 'config.js') + extra + 'const COURSE = `\n' + course + '`;\n</script>\n'
            '<script>\n' + rd('engine', sync) + '</script>\n'
            '<script>\n' + rd('engine', 'engine.js') + '</script>\n')

def css(name):
    return rd('engine', 'base.css') + rd('courses', name, 'theme.css')

def site():
    for name, c in COURSES.items():
        page = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{c['title']}</title>
<meta name="description" content="{c['desc']}">
<meta name="theme-color" content="{c['theme'][0]}" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="{c['theme'][1]}" media="(prefers-color-scheme: dark)">
<link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="icon-180.png">
<link rel="icon" type="image/png" href="icon-192.png">
<meta name="apple-mobile-web-app-title" content="{c['short']}">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="{c['fonts']}">
<style>
:root{{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}}
img{{max-width:100%}}
{css(name)}</style>
</head>
<body>
{BODY}
{scripts(name, c, 'sync-github.js')}<script>
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('../sw.js').catch(() => {{}});
</script>
</body>
</html>
'''
        os.makedirs(os.path.join(ROOT, name), exist_ok=True)
        open(os.path.join(ROOT, name, 'index.html'), 'w', encoding='utf-8').write(page)
        manifest = {'name': c['title'], 'short_name': c['short'], 'description': c['desc'], 'start_url': './', 'scope': './',
                    'display': 'standalone', 'background_color': c['theme'][0], 'theme_color': c['theme'][0],
                    'icons': [{'src': 'icon-192.png', 'sizes': '192x192', 'type': 'image/png'},
                              {'src': 'icon-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'any maskable'}]}
        open(os.path.join(ROOT, name, 'manifest.webmanifest'), 'w', encoding='utf-8').write(json.dumps(manifest, indent=2) + '\n')
        print('built', name, len(page) // 1024, 'KB')

def artifact():
    out = os.path.join(ROOT, 'artifact-build'); os.makedirs(out, exist_ok=True)
    for name, c in COURSES.items():
        page = (f"<title>{c['title']}</title>\n<meta name=\"claude:viewport-fit-sides\" content=\"cover\">\n"
                '<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
                f"<link rel=\"stylesheet\" href=\"{c['fonts']}\">\n<style>\n{css(name)}</style>\n{BODY}\n{scripts(name, c, 'sync-claude.js')}")
        open(os.path.join(out, name + '.html'), 'w', encoding='utf-8').write(page)
        print('built artifact', name)

artifact() if '--artifact' in sys.argv else site()
