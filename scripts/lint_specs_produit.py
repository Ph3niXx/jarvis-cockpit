#!/usr/bin/env python3
"""
Lint bloquant pour les sections produit des docs/specs/tab-*.md.

Sections scannees : `## Fonctionnalites` et `## Parcours utilisateur`.

Regle editoriale (identique pour les deux) : ces sections racontent CE QUE
L'UTILISATEUR VOIT ET FAIT, pas le code qui tourne en dessous. Les details
techniques (chemins fichier, composants JSX, props, colonnes DB, endpoints,
jargon infra Tier 1 / bootTier / loadPanel / localStorage technique) vont
dans "Front — structure UI" / "Front — fonctions JS" / "Back — sources de
donnees", pas ici.

Le script parcourt tous les `docs/specs/tab-*.md`, extrait pour chaque spec
la portion entre chaque en-tete surveille et le prochain `## `, et echoue
(exit 1) des qu'une regle matche. Utilise en CI par `.github/workflows/
lint-specs.yml` (bloquant) et executable localement avant commit.

Usage local : python scripts/lint_specs_produit.py
"""

from __future__ import annotations

import re
import sys
from dataclasses import dataclass
from pathlib import Path

SPECS_DIR = Path(__file__).resolve().parent.parent / "docs" / "specs"

# Sections surveillees. Ajouter ici une nouvelle section activera le meme
# set de regles RULES (meme regle editoriale "vocabulaire produit").
SECTIONS: tuple[str, ...] = (
    "## Fonctionnalités",
    "## Parcours utilisateur",
)


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
            r"signals_summary|jarvis_take|source_type|"
            r"mass_kg|fat_pct|weight_kg|total_elevation_gain)\b"
        ),
        "nom de colonne DB specifique (brief_html, mention_count, etc.)",
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
    # Regles specifiques "Parcours utilisateur" (s'appliquent aussi a
    # Fonctionnalites pour coherence). Ciblent le jargon d'architecture
    # frontend qui n'a rien a faire dans un recit utilisateur.
    Rule(
        "infra_tier",
        re.compile(r"\bTier\s*[12]\b"),
        "jargon infra Tier 1 / Tier 2 (architecture data loading)",
    ),
    Rule(
        "infra_boot",
        re.compile(r"\b(?:bootTier[12]?|loadPanel|tryModes|transformJarvis"
                   r"[A-Za-z]*|transformForme|buildRadar|buildOpportunitiesFromDB"
                   r"|replaceShape|hydrateGlobalsFromTier1)\b"),
        "nom de fonction interne (bootTier1, loadPanel, transformXxx, etc.)",
    ),
    Rule(
        "infra_localstorage",
        re.compile(r"\blocalStorage\.[\w.-]+"),
        "cle localStorage technique (localStorage.jarvis-prefill-input, etc.)",
    ),
    Rule(
        "infra_react_hooks",
        re.compile(r"\buse(?:Effect|State|Memo|Ref|Callback)\b"),
        "hook React (useEffect, useState, useMemo...)",
    ),
)


@dataclass(frozen=True)
class Violation:
    file: str
    section: str
    line: int
    rule: str
    match: str
    excerpt: str
    description: str


def extract_section(text: str, header: str) -> list[tuple[int, str]]:
    """Retourne les (numero de ligne 1-indexe, contenu) de la section
    identifiee par `header` (ex: `## Fonctionnalites`) jusqu'au prochain
    `## `.
    """
    out: list[tuple[int, str]] = []
    inside = False
    for i, line in enumerate(text.splitlines(), start=1):
        stripped = line.lstrip()
        if stripped.startswith(header):
            inside = True
            continue
        if inside and stripped.startswith("## "):
            break
        if inside:
            out.append((i, line))
    return out


def strip_html_comments(section: list[tuple[int, str]]) -> list[tuple[int, str]]:
    """Retire le contenu des `<!-- ... -->` (multi-ligne supporte) tout en
    preservant l'alignement des numeros de ligne.
    """
    if not section:
        return section
    full = "\n".join(line for _, line in section)
    stripped = re.sub(r"<!--.*?-->", "", full, flags=re.DOTALL)
    new_lines = stripped.split("\n")
    # Longueur doit rester la meme car DOTALL n'enleve pas les \n.
    return list(zip((n for n, _ in section), new_lines))


def lint_file(path: Path, repo_root: Path) -> list[Violation]:
    text = path.read_text(encoding="utf-8")
    rel = path.relative_to(repo_root).as_posix()
    violations: list[Violation] = []
    for header in SECTIONS:
        section = strip_html_comments(extract_section(text, header))
        if not section:
            continue
        for lineno, line in section:
            for rule in RULES:
                for m in rule.pattern.finditer(line):
                    violations.append(
                        Violation(
                            file=rel,
                            section=header,
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

    sections_desc = " + ".join(s.replace("## ", "") for s in SECTIONS)

    if not all_violations:
        print(
            f"ok -- {len(md_files)} specs scannees sur "
            f"sections [{sections_desc}], aucune violation."
        )
        return 0

    # Group by file for a lisible output.
    by_file: dict[str, list[Violation]] = {}
    for v in all_violations:
        by_file.setdefault(v.file, []).append(v)

    for file, viols in by_file.items():
        print(f"\n{file}")
        for v in viols:
            section_short = v.section.replace("## ", "")
            # Format GitHub Actions annotation + ligne humaine.
            print(
                f"  ::error file={v.file},line={v.line},title=lint-specs::"
                f"[{section_short} / {v.rule}] {v.description} "
                f"-- matched '{v.match}'"
            )
            print(f"  L{v.line}  [{section_short}]  {v.excerpt}")
            print(f"         -> {v.rule}: '{v.match}' ({v.description})")

    print()
    print(
        f"fail -- {len(all_violations)} violations dans {len(by_file)} fichiers."
    )
    print(
        "Reecris la section en vocabulaire produit "
        "(voir CLAUDE.md sections 'Regle editoriale section Fonctionnalites' "
        "et 'Regle editoriale section Parcours utilisateur')."
    )
    return 1


if __name__ == "__main__":
    sys.exit(main())
