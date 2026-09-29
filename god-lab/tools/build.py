#!/usr/bin/env python3
"""Inline src/ and Three.js into a single self-contained god-lab/index.html."""
import re
from pathlib import Path

root = Path(__file__).resolve().parent.parent
src = root / "src"

# Three.js ships as an ES module; turn its export list into a global THREE object.
three = (root / "vendor" / "three.module.min.js").read_text(encoding="utf-8")
m = re.search(r"export\s*\{([^}]*)\}\s*;?\s*$", three)
assert m, "three export list not found"
pairs = []
for item in m.group(1).split(","):
    item = item.strip()
    if not item:
        continue
    local, _, exported = item.partition(" as ")
    pairs.append(f"{(exported or local).strip()}:{local.strip()}")
three = three[: m.start()] + "window.THREE={" + ",".join(pairs) + "};"
three = "(function(){\n" + three + "\n})();"

html = (src / "shell.html").read_text(encoding="utf-8")
parts = [("/*@STYLE*/", (src / "style.css").read_text(encoding="utf-8")), ("/*@THREE*/", three)]
parts += [(f"/*@{n.upper()}*/", (src / f"{n}.js").read_text(encoding="utf-8")) for n in ("sim", "render", "ui")]
for marker, text in parts:
    assert marker in html, marker
    html = html.replace(marker, text.replace("</script>", "<\\/script>"))
(root / "index.html").write_text(html, encoding="utf-8")
print(f"god-lab/index.html written ({len(html) // 1024} KB)")
