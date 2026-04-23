#!/usr/bin/env python3
"""
Valide jarvis/spec.json :
- Structure conforme au schéma
- IDs uniques par phase et globalement
- depends_on référencent des features qui existent
- progress cohérent avec status (done => 100, backlog => 0)
- Dates ISO valides

Exit code 0 si tout est OK, 1 sinon.
"""
import json
import sys
from datetime import date
from pathlib import Path

SPEC_PATH = Path(__file__).parent.parent / "jarvis" / "spec.json"

VALID_PHASE_STATUS = {"done", "in_progress", "backlog", "blocked"}
VALID_FEATURE_STATUS = {"done", "in_progress", "backlog", "blocked"}
VALID_SCOPE = {"perso", "pro"}

REQUIRED_FEATURE_FIELDS = {
    "id", "name", "status", "scope", "progress",
    "description", "implementation", "depends_on", "updated_at"
}
REQUIRED_IMPL_FIELDS = {"files", "dependencies", "key_decisions"}
REQUIRED_PHASE_FIELDS = {"id", "name", "status", "order", "features"}


def fail(errors: list[str]) -> None:
    print("❌ Validation failed:\n")
    for e in errors:
        print(f"  - {e}")
    sys.exit(1)


def is_iso_date(s: str) -> bool:
    try:
        date.fromisoformat(s)
        return True
    except (ValueError, TypeError):
        return False


def validate(spec: dict) -> list[str]:
    errors = []

    # Meta
    if "meta" not in spec:
        errors.append("Missing 'meta'")
    else:
        for k in ("version", "updated_at"):
            if k not in spec["meta"]:
                errors.append(f"Missing meta.{k}")
        if "updated_at" in spec["meta"] and not is_iso_date(spec["meta"]["updated_at"]):
            errors.append(f"meta.updated_at is not ISO date: {spec['meta']['updated_at']}")

    # Phases
    if "phases" not in spec or not isinstance(spec["phases"], list):
        errors.append("Missing or invalid 'phases' array")
        return errors

    phase_ids = set()
    all_feature_refs = set()  # "phase-id.feature-id"
    orders_seen = []

    for i, phase in enumerate(spec["phases"]):
        prefix = f"phases[{i}]"
        missing = REQUIRED_PHASE_FIELDS - phase.keys()
        if missing:
            errors.append(f"{prefix} missing fields: {missing}")
            continue

        if phase["id"] in phase_ids:
            errors.append(f"{prefix} duplicate phase id: {phase['id']}")
        phase_ids.add(phase["id"])

        if phase["status"] not in VALID_PHASE_STATUS:
            errors.append(f"{prefix} invalid status: {phase['status']}")

        if not isinstance(phase["order"], int):
            errors.append(f"{prefix} order must be int")
        else:
            orders_seen.append(phase["order"])

        feature_ids_in_phase = set()
        for j, feat in enumerate(phase.get("features", [])):
            fprefix = f"{prefix}.features[{j}]"
            missing_f = REQUIRED_FEATURE_FIELDS - feat.keys()
            if missing_f:
                errors.append(f"{fprefix} missing fields: {missing_f}")
                continue

            if feat["id"] in feature_ids_in_phase:
                errors.append(f"{fprefix} duplicate feature id in phase: {feat['id']}")
            feature_ids_in_phase.add(feat["id"])
            all_feature_refs.add(f"{phase['id']}.{feat['id']}")

            if feat["status"] not in VALID_FEATURE_STATUS:
                errors.append(f"{fprefix} invalid status: {feat['status']}")
            if feat["scope"] not in VALID_SCOPE:
                errors.append(f"{fprefix} invalid scope: {feat['scope']}")

            if not isinstance(feat["progress"], int) or not (0 <= feat["progress"] <= 100):
                errors.append(f"{fprefix} progress must be int 0-100")
            else:
                if feat["status"] == "done" and feat["progress"] != 100:
                    errors.append(f"{fprefix} status=done but progress={feat['progress']}")
                if feat["status"] == "backlog" and feat["progress"] != 0:
                    errors.append(f"{fprefix} status=backlog but progress={feat['progress']}")

            # Implementation block
            impl = feat.get("implementation", {})
            missing_impl = REQUIRED_IMPL_FIELDS - impl.keys()
            if missing_impl:
                errors.append(f"{fprefix}.implementation missing: {missing_impl}")
            for key in ("files", "dependencies", "key_decisions"):
                if key in impl and not isinstance(impl[key], list):
                    errors.append(f"{fprefix}.implementation.{key} must be array")

            if not is_iso_date(feat.get("updated_at", "")):
                errors.append(f"{fprefix}.updated_at invalid ISO date")

            if not isinstance(feat.get("depends_on", []), list):
                errors.append(f"{fprefix}.depends_on must be array")

    # Phase orders unique
    if len(orders_seen) != len(set(orders_seen)):
        errors.append(f"Duplicate phase orders: {orders_seen}")

    # Dependency integrity
    for phase in spec["phases"]:
        for feat in phase.get("features", []):
            for dep in feat.get("depends_on", []):
                if dep not in all_feature_refs:
                    errors.append(
                        f"{phase['id']}.{feat['id']} depends_on unknown ref: '{dep}'"
                    )

    return errors


def main() -> None:
    if not SPEC_PATH.exists():
        fail([f"Spec file not found: {SPEC_PATH}"])

    try:
        with open(SPEC_PATH, encoding="utf-8") as f:
            spec = json.load(f)
    except json.JSONDecodeError as e:
        fail([f"Invalid JSON: {e}"])

    errors = validate(spec)
    if errors:
        fail(errors)

    # Summary
    n_phases = len(spec["phases"])
    n_features = sum(len(p.get("features", [])) for p in spec["phases"])
    print(f"✅ spec.json valid — {n_phases} phases, {n_features} features")


if __name__ == "__main__":
    main()
