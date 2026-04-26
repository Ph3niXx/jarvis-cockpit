#!/usr/bin/env python3
"""
Lint bloquant : KNOWN_SECTIONS dans jarvis/scripts/extract_signals.py
doit refleter exactement les `activePanel === "X"` de cockpit/app.jsx.

Source de verite : cockpit/app.jsx (chaine else-if du router).
Regression cible : audit hebdo qui flagge des "Section inconnue" parce
qu'on a oublie de resync KNOWN_SECTIONS apres ajout d'un panel
(cf incident 2026-04-25 : v13-S1 a resync, puis 3h plus tard veille-outils
a ete ajoute sans update KNOWN_SECTIONS).

Utilise en CI par .github/workflows/lint-known-sections.yml (bloquant)
et executable localement avant commit.

Usage local : python scripts/lint_known_sections.py
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
APP_JSX = ROOT / "cockpit" / "app.jsx"
EXTRACT = ROOT / "jarvis" / "scripts" / "extract_signals.py"


def discover_panels() -> set[str]:
    text = APP_JSX.read_text(encoding="utf-8")
    return set(re.findall(r'activePanel\s*===\s*"([a-z_-]+)"', text))


def parse_known_sections() -> set[str]:
    text = EXTRACT.read_text(encoding="utf-8")
    m = re.search(r'KNOWN_SECTIONS\s*=\s*\{([^}]+)\}', text, re.DOTALL)
    if not m:
        print("[FAIL] KNOWN_SECTIONS introuvable dans extract_signals.py",
              file=sys.stderr)
        sys.exit(1)
    return set(re.findall(r'"([a-z_-]+)"', m.group(1)))


def main() -> int:
    panels = discover_panels()
    known = parse_known_sections()
    if not panels:
        print("[FAIL] Aucun activePanel trouve dans app.jsx — pattern casse ?",
              file=sys.stderr)
        return 1
    missing = panels - known
    extra = known - panels
    if not missing and not extra:
        print(f"[OK] KNOWN_SECTIONS synchronise ({len(panels)} panels).")
        return 0
    if missing:
        print("[FAIL] Panels presents dans app.jsx mais absents de KNOWN_SECTIONS :",
              file=sys.stderr)
        for p in sorted(missing):
            print(f"  + {p}", file=sys.stderr)
    if extra:
        print("[FAIL] Sections dans KNOWN_SECTIONS mais sans activePanel correspondant :",
              file=sys.stderr)
        for p in sorted(extra):
            print(f"  - {p}", file=sys.stderr)
    print("\nFix : editer jarvis/scripts/extract_signals.py et resync.",
          file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
