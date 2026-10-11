#!/usr/bin/env python3
"""Vendor the experiment's and the simulation's results at their pinned commits, and export the run logs.

    python3 scripts/vendor.py ../DeMo_Fixed_Band_Experiment ../Training_Transit_Sim           # write
    python3 scripts/vendor.py ../DeMo_Fixed_Band_Experiment ../Training_Transit_Sim --check   # CI: unchanged?

Every file is read with ``git show <commit>:<path>`` from a clone of each repository, so the working tree's
state does not matter. Copied byte for byte:

* DeMo_Fixed_Band_Experiment @ b1f62d3: ``results/tinystories-gpu/results.json`` and ``results.md``,
  ``docs/optics_investigation.md`` (into ``src/data/vendor/experiment/``) and ``colab/run_sweep.ipynb``
  (into ``public/``, where the site serves it for download);
* Training_Transit_Sim @ c6de1f4: ``examples/results.json`` and ``results.md`` (into ``src/data/vendor/sim/``).

Written by this script from the experiment's run logs (``results/tinystories-gpu/*.jsonl`` at the same commit):
``src/data/derived/runs.json``, every completed run's evaluations (validation and training loss, cumulative
payload and wire bytes, the optics' clip rates) and diagnostics (captured energy per tensor, group and selector),
plus its GPU and run time. A run counts as completed when its last record is ``done``, as in the experiment's
``experiment/analyse.py``. Nothing is rounded.

``VENDORED.json`` records each file's source repository, commit, path and SHA-256.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

EXPERIMENT = ("BrendanJamesLynskey/DeMo_Fixed_Band_Experiment", "b1f62d394ac79250df9ce555d3a55d85cf1cd517")
SIM = ("BrendanJamesLynskey/Training_Transit_Sim", "c6de1f4019547050ae7bacbb4ab13f9d9ee9586c")

# (source, path in the source repository, path in this repository)
FILES = [
    (EXPERIMENT, "results/tinystories-gpu/results.json", "src/data/vendor/experiment/results.json"),
    (EXPERIMENT, "results/tinystories-gpu/results.md", "src/data/vendor/experiment/results.md"),
    (EXPERIMENT, "docs/optics_investigation.md", "src/data/vendor/experiment/optics_investigation.md"),
    (EXPERIMENT, "colab/run_sweep.ipynb", "public/run_sweep.ipynb"),
    (SIM, "examples/results.json", "src/data/vendor/sim/results.json"),
    (SIM, "examples/results.md", "src/data/vendor/sim/results.md"),
]
RUNS_DIR = "results/tinystories-gpu"
RUNS_OUT = "src/data/derived/runs.json"
CONFIG_KEYS = ("variant", "band", "keep", "chunk_mode", "chunk", "enob", "planes", "fs_every", "feedback", "lr", "seed")


def git_show(repo: Path, commit: str, path: str) -> bytes:
    return subprocess.check_output(["git", "-C", str(repo), "show", f"{commit}:{path}"])


def git_ls(repo: Path, commit: str, path: str) -> list[str]:
    out = subprocess.check_output(["git", "-C", str(repo), "ls-tree", "--name-only", f"{commit}:{path}"], text=True)
    return [f"{path}/{n}" for n in out.split()]


def sha256(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def export_runs(repo: Path) -> bytes:
    """Every completed run's evaluations and diagnostics, unrounded, in a compact layout."""
    commit = EXPERIMENT[1]
    rows = {r["group"]: r for r in json.loads(git_show(repo, commit, f"{RUNS_DIR}/results.json"))["rows"]}
    runs = []
    for path in sorted(p for p in git_ls(repo, commit, RUNS_DIR) if p.endswith(".jsonl")):
        recs = [json.loads(ln) for ln in git_show(repo, commit, path).decode().splitlines() if ln.strip()]
        if not recs or recs[-1].get("type") != "done":
            continue
        head = recs[0]
        name = head["name"]
        group = re.sub(r"-s\d+$", "", name)
        evals = [r for r in recs if r["type"] == "eval"]
        diags = [r for r in recs if r["type"] == "diag"]
        # one list per tensor/group/selector, aligned with the diagnostic steps: a selector missing at a step
        # (the calibrated band before calibration ends) is null there
        keys = []
        for d in diags:
            for src, groups in d["energy"].items():
                for grp, sel in groups.items():
                    for s in sel:
                        if f"{src}/{grp}/{s}" not in keys:
                            keys.append(f"{src}/{grp}/{s}")
        energy = {k: [d["energy"].get(k.split("/")[0], {}).get(k.split("/")[1], {}).get(k.split("/")[2])
                      for d in diags] for k in keys}
        runs.append({
            "name": name,
            "group": group,
            "label": rows[group]["label"],
            "config": {k: head["config"].get(k) for k in CONFIG_KEYS},
            "device": head["hardware"]["device"],
            "seconds": recs[-1]["seconds"],
            "evals": {
                "step": [e["step"] for e in evals],
                "val_loss": [e["val_loss"] for e in evals],
                "train_loss": [e["train_loss"] for e in evals],
                "payload_bytes": [e["payload_bytes"] for e in evals],
                "wire_bytes": [e["wire_bytes"] for e in evals],
                "seconds": [e["seconds"] for e in evals],
                "clip_rate": [e.get("clip_rate") for e in evals],
                "clip_rate_interval": [e.get("clip_rate_interval") for e in evals],
            },
            "diags": {"step": [d["step"] for d in diags], "energy": energy},
        })
    out = {"source": EXPERIMENT[0], "commit": commit, "path": RUNS_DIR, "runs": runs}
    return (json.dumps(out, separators=(",", ":"), sort_keys=False) + "\n").encode()


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("experiment", type=Path, help="a clone of DeMo_Fixed_Band_Experiment")
    ap.add_argument("sim", type=Path, help="a clone of Training_Transit_Sim")
    ap.add_argument("--check", action="store_true", help="fail if any file would change")
    a = ap.parse_args(argv)
    repos = {EXPERIMENT: a.experiment, SIM: a.sim}

    outputs: dict[str, bytes] = {}
    record = {"vendored": [], "derived": []}
    for src, path, dest in FILES:
        b = git_show(repos[src], src[1], path)
        outputs[dest] = b
        record["vendored"].append({"file": dest, "source": src[0], "commit": src[1], "path": path, "sha256": sha256(b)})
    runs = export_runs(a.experiment)
    outputs[RUNS_OUT] = runs
    record["derived"].append({"file": RUNS_OUT, "source": EXPERIMENT[0], "commit": EXPERIMENT[1],
                              "path": f"{RUNS_DIR}/*.jsonl", "generated_by": "scripts/vendor.py",
                              "sha256": sha256(runs)})
    outputs["VENDORED.json"] = (json.dumps(record, indent=2) + "\n").encode()

    stale = []
    for dest, b in outputs.items():
        p = ROOT / dest
        if a.check:
            if not p.exists() or p.read_bytes() != b:
                stale.append(dest)
        else:
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_bytes(b)
    if stale:
        print("out of date: " + ", ".join(stale), file=sys.stderr)
        return 1
    print(("checked " if a.check else "wrote ") + ", ".join(outputs))
    return 0


if __name__ == "__main__":
    sys.exit(main())
