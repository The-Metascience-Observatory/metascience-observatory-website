#!/usr/bin/env python3
"""Import a tested dashboard export. Run with the lithium project's path as the argument."""
import argparse
import hashlib
import json
import shutil
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("analysis_project", type=Path)
args = parser.parse_args()
source = args.analysis_project.resolve() / "dashboard/public/data"
root = Path(__file__).resolve().parents[1]
bundle = root / "data/birds_eye_reviews/lithium_drinking_water"
public = root / "public/data/lithium-drinking-water"
snapshot = json.loads((source / "snapshot.v1.json").read_text())
assert snapshot["schemaVersion"] == 1, "Unsupported snapshot schema"
rows = snapshot["counties"]
assert len(rows) == len({r["fips"] for r in rows}) == 3143
assert all(len(r["fips"]) == 5 and r["fips"].isdigit() for r in rows)
assert sum(r["obesity_adjprev"] is None for r in rows) == 187
bundle.mkdir(parents=True, exist_ok=True)
public.mkdir(parents=True, exist_ok=True)
for name in ("snapshot.v1.json", "statistics-reference.v1.json"):
    shutil.copyfile(source / name, bundle / name)
for name in ("merged_county.csv", "variables.csv"):
    shutil.copyfile(source / name, public / name)
for name in ("correlations_main.csv", "texas_obesity.csv", "ols_ladders.csv"):
    shutil.copyfile(source / "results" / name, public / name)
provenance = {key: snapshot[key] for key in ("schemaVersion", "exportedAt", "fingerprint", "inputs", "sources")}
provenance["snapshotSha256"] = hashlib.sha256((bundle / "snapshot.v1.json").read_bytes()).hexdigest()
(public / "provenance.json").write_text(json.dumps(provenance, indent=2) + "\n")
print(f"Imported {len(rows):,} counties; snapshot {snapshot['fingerprint'][:16]}")
