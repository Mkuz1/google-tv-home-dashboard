#!/usr/bin/env python3
"""Summarise how photos appear in a Google Photos shared-album page.

    python3 tools/album_probe.py <share link> [saved.html]
"""
import re
import sys
import urllib.request
from collections import Counter

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

url = sys.argv[1]
if len(sys.argv) > 2:
    html = open(sys.argv[2], encoding="utf-8", errors="replace").read()
else:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "en"})
    html = urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "replace")

title = re.search(r"<title>([^<]*)", html)
print("title:", title.group(1) if title else "?")
print("page size:", len(html))

urls = re.findall(r"https://lh3\.googleusercontent\.com/pw/[A-Za-z0-9_\-]+", html)
print("pw urls (all / unique):", len(urls), "/", len(set(urls)))

# What comes right before and after each photo URL, with the URL itself blanked out.
before = Counter()
after = Counter()
for m in re.finditer(r"(.{0,24})https://lh3\.googleusercontent\.com/pw/[A-Za-z0-9_\-]+(.{0,24})", html):
    before[re.sub(r"[A-Za-z0-9_\-]{20,}", "<id>", m.group(1))] += 1
    after[re.sub(r"[A-Za-z0-9_\-]{20,}", "<id>", m.group(2))] += 1
print("\ncontext before:")
for k, v in before.most_common(6):
    print(f"  {v:4d}  {k!r}")
print("context after:")
for k, v in after.most_common(6):
    print(f"  {v:4d}  {k!r}")

sized = re.findall(r'\["(https://lh3\.googleusercontent\.com/pw/[A-Za-z0-9_\-]+)",(\d+),(\d+)', html)
print("\n[url,w,h] entries:", len(sized), "unique:", len({u for u, _, _ in sized}))
print("sizes:", Counter(f"{w}x{h}" for _, w, h in sized).most_common(8))

# Data blocks embedded in the page.
for key in re.findall(r"AF_initDataCallback\(\{key: '(ds:\d+)'", html):
    print("data block:", key)
print("item count hint:", re.findall(r'"(\d+) items?"', html)[:3], re.findall(r"(\d+) (?:photos?|items?)", html)[:5])
