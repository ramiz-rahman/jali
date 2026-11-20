"""Decode every session MP3 in Playwright's own bundled Chromium (not Chrome), with decodeAudioData, as the engine
does. Also tries one of the app's current AAC .m4a clips for comparison.
usage: python3 -I -m http.server 8765 --bind 127.0.0.1 &   (from studio-audio/)
       .venv/bin/python -I scripts/decode_test.py [chromium executable]"""
import sys, glob, os
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
files = sorted("/" + os.path.relpath(p, ROOT) for p in glob.glob(os.path.join(ROOT, "sessions", "*", "audio", "*.mp3")))
files.append("/work/decode/app-s01.m4a")
exe = sys.argv[1] if len(sys.argv) > 1 else None
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=exe) if exe else p.chromium.launch()
    pg = b.new_page()
    pg.goto("http://127.0.0.1:8765/work/decode/index.html?f=" + ",".join(files))
    pg.wait_for_function("document.getElementById('out').textContent.includes('DONE')", timeout=120000)
    print("browser:", b.version)
    print(pg.inner_text("#out"))
    b.close()
