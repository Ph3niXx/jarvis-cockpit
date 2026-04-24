#!/usr/bin/env python3
"""
Lint bloquant pour la section `## Fonctionnalités` des docs/specs/tab-*.md.

Règle éditoriale : cette section décrit CE QUE L'UTILISATEUR VOIT ET FAIT, pas
comment c'est implémenté. Les détails techniques (chemins fichier, composants
JSX, props, colonnes DB, endpoints) vont dans les sections "Front — structure
UI" et "Back — sources de données", pas ici.

Ce script parcourt tous les `docs/specs/tab-*.md`, extrait la portion entre
`## Fonctionnalités` et le prochain `##`, et échoue (exit 1) si une des regex
de vocabulaire technique matche. Utilisé en CI par `.github/workflows/lint-
specs.yml` (bloquant) et exécutable localement avant commit.

Usage local : python scripts/lint_specs_fonctionnalites.py
"""

from __future__ import annotations

import re
import sys
from dataclasses import dataclass
from pathlib import Path

SPECS_DIR = Path(__file__).resolve().parent.parent / "docs" / "specs"


@dataclass(frozen=True)
class Rule:
    label: str
    pattern: re.Pattern
    description: str


RULES: tuple[Rule, ...] = (
    Rule(
        "jsx_path",
        re.compile(r"\b[\w./-]+\.jsx(?::\d+)?"),
        "chemin de fichier .jsx (panel-foo.jsx, cockpit/home.jsx:42)",
    ),
    Rule(
        "py_path",
        re.compile(r"\b[\w./-]+\.py(?::\d+)?"),
        "chemin de fichier .py (main.py, pipelines/foo.py:123)",
    ),
    Rule(
        "css_path",
        re.compile(r"\b[\w./-]+\.css(?::\d+)?"),
        "chemin de fichier .css",
    ),
    Rule(
        "jsx_component",
        re.compile(r"<[A-Z]\w+[\s/>]"),
        "composant JSX (<SignalCard>, <RadarSVG/>)",
    ),
    Rule(
        "data_global",
        re.compile(r"\bdata\.[a-z_]+\b"),
        "global frontend data.xxx (data.signals, data.week)",
    ),
    Rule(
        "window_global",
        re.compile(r"\bwindow\.[A-Za-z_][\w.]*"),
        "global frontend window.X",
    ),
    Rule(
        "cockpit_data",
        re.compile(r"\b(?:COCKPIT_DATA|[A-Z][A-Z0-9]+_DATA)\b"),
        "global frontend COCKPIT_DATA / X_DATA",
    ),
    Rule(
        "db_id_col",
        re.compile(r"\b[a-z][a-z0-9]*_id\b"),
        "nom de colonne DB xxx_id (article_id, session_id)",
    ),
    Rule(
        "db_at_col",
        re.compile(r"\b[a-z][a-z0-9]*_at\b"),
        "nom de colonne DB xxx_at (created_at, updated_at)",
    ),
    Rule(
        "db_html_col",
        re.compile(r"\b[a-z][a-z0-9]*_html\b"),
        "nom de colonne DB xxx_html (brief_html)",
    ),
    Rule(
        "db_common_cols",
        re.compile(
            r"\b(?:mention_count|superseded_by|fetch_date|user_status|"
            r"score_total|playtime_forever_minutes|playtime_2weeks_minutes|"
            r"measure_date|scrobbled_at|stat_date|last_seen_date|"
            r"linkedin_job_id|source_articles|release_date|rubric_justif|"
            r"intel_depth|tokens_used|scrobble_count|unique_artists|"
            r"signals_summary|jarvis_take|source_type|tokens_used|"
            r"mass_kg|fat_pct|weight_kg|total_elevation_gain)\b"
        ),
        "nom de colonne DB spécifique (brief_html, mention_count, etc.)",
    ),
    Rule(
        "supabase_rest",
        re.compile(r"/rest/v1/|/rpc/[a-z_]+"),
        "endpoint Supabase REST (/rest/v1/..., /rpc/match_memories)",
    ),
    Rule(
        "supabase_sdk",
        re.compile(r"\bsupabase\.[a-z]+"),
        "SDK Supabase (supabase.from, supabase.channel)",
    ),
    Rule(
        "jsx_prop",
        re.compile(
            r"\b[a-zA-Z_][\w-]*="
            r"(?:true|false|null|undefined|\{[^}]*\}|\"[^\"]*\"|'[^']*')"
        ),
        "prop JSX/HTML (prop=true, key={value}, attr=\"x\")",
    ),
)


@dataclass(frozen=True)
class Violation:
    file: str
    line: int
    rule: str
    match: str
    excerpt: str
    description: str


def extract_fonctionnalites(text: str) -> list[tuple[int, str]]:
    """Retourne les (numéro de ligne 1-indexé, contenu) de la section
    `## Fonctionnalités` jusqu'au prochain `## `.
    """
    out: list[tuple[int, str]] = []
    inside = False
    for i, line in enumerate(text.splitlines(), start=1):
        stripped = line.lstrip()
        if stripped.startswith("## Fonctionnalités"):
            inside = True
            continue
        if inside and stripped.startswith("## "):
            break
        if inside:
            out.append((i, line))
    return out


def strip_html_comments(section: list[tuple[int, str]]) -> list[tuple[int, str]]:
    """Retire le contenu des `<!-- ... -->` (multi-ligne supporté) tout en
    préservant l'alignement des numéros de ligne.
    """
    if not section:
        return section
    full = "\n".join(line for _, line in section)
    stripped = re.sub(r"<!--.*?-->", "", full, flags=re.DOTALL)
    new_lines = stripped.split("\n")
    # Longueur doit rester la même car DOTALL n'enlève pas les \n.
    return list(zip((n for n, _ in section), new_lines))


def lint_file(path: Path, repo_root: Path) -> list[Violation]:
    text = path.read_text(encoding="utf-8")
    section = strip_html_comments(extract_fonctionnalites(text))
    if not section:
        return []

    rel = path.relative_to(repo_root).as_posix()
    violations: list[Violation] = []
    for lineno, line in section:
        for rule in RULES:
            for m in rule.pattern.finditer(line):
                violations.append(
                    Violation(
                        file=rel,
                        line=lineno,
                        rule=rule.label,
                        match=m.group(0),
                        excerpt=line.strip()[:180],
                        description=rule.description,
                    )
                )
    return violations


def main() -> int:
    repo_root = Path(__file__).resolve().parent.parent
    md_files = sorted(SPECS_DIR.glob("tab-*.md"))
    all_violations: list[Violation] = []
    for path in md_files:
        all_violations.extend(lint_file(path, repo_root))

    if not all_violations:
        print(f"ok — {len(md_files)} specs scannees, aucune violation.")
        return 0

    # Group by file for a lisible output.
    by_file: dict[str, list[Violation]] = {}
    for v in all_violations:
        by_file.setdefault(v.file, []).append(v)

    for file, viols in by_file.items():
        print(f"\n{file}")
        for v in viols:
            # Format GitHub Actions annotation + ligne humaine.
            print(
                f"  ::error file={v.file},line={v.line},title=lint-specs::"
                f"[{v.rule}] {v.description} -- matched '{v.match}'"
            )
            print(f"  L{v.line}  {v.excerpt}")
            print(f"         -> {v.rule}: '{v.match}' ({v.description})")

    print()
    print(
        f"fail -- {len(all_violations)} violations dans {len(by_file)} fichiers."
    )
    print(
        "Reecris la section Fonctionnalites en vocabulaire produit "
        "(voir CLAUDE.md section 'Regle editoriale section Fonctionnalites')."
    )
    return 1


if __name__ == "__main__":
    sys.exit(main())
