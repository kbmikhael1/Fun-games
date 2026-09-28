#!/usr/bin/env python3
"""Inline src/ into a single self-contained index.html (no build tools needed)."""
from pathlib import Path

root = Path(__file__).resolve().parent.parent
src = root / "src"
html = (src / "shell.html").read_text(encoding="utf-8")
for marker, name in [("/*@STYLE*/", "style.css"), ("/*@ENGINE*/", "engine.js"),
                     ("/*@LEVELS*/", "levels.js"), ("/*@SOLUTIONS*/", "solutions.js"),
                     ("/*@GAME*/", "game.js")]:
    assert marker in html, marker
    html = html.replace(marker, (src / name).read_text(encoding="utf-8"))
(root / "index.html").write_text(html, encoding="utf-8")
print(f"index.html written ({len(html) // 1024} KB)")
