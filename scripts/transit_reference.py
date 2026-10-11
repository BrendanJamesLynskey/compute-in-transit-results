#!/usr/bin/env python3
"""The transit page's constants and parity fixtures, from Training_Transit_Sim's own Python package.

    ../Training_Transit_Sim/.venv/bin/python scripts/transit_reference.py ../Training_Transit_Sim           # write
    ../Training_Transit_Sim/.venv/bin/python scripts/transit_reference.py ../Training_Transit_Sim --check   # CI

The clone must be checked out at the commit in VENDORED.json (c6de1f4), with ``disagg-sim`` installed (the
simulation's pyproject pins it at 69ffd2b). Writes:

* ``src/data/derived/transit_constants.json``: every input the TypeScript port (``src/lib/transit/model.ts``)
  needs, read from the package, never typed: the experiment's setup and payloads, the steps-to-loss ladder, the
  device, the link presets, the three module settings of results.md, the band and sum kernels, and section 10's
  model sizes and sync intervals;
* ``tests/fixtures/transit_parity.json``: the package's closed forms (``analytic.py``) and its discrete-event
  engine (``engine.py``, zero background load) over a grid of WAN bandwidths, topologies, variants and module
  settings, the module's stage times over a grid of compute budgets and bit planes, and section 10's
  extrapolations (model size, sync every H steps) on the base topology. The unit tests require
  the port to equal the closed forms exactly and the engine to rounding.

Floats are written with ``repr``, which round-trips to the same double in JavaScript.
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import asdict, replace
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONSTANTS = ROOT / "src/data/derived/transit_constants.json"
PARITY = ROOT / "tests/fixtures/transit_parity.json"
COMMIT = "c6de1f4019547050ae7bacbb4ab13f9d9ee9586c"


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("sim", type=Path, help="a clone of Training_Transit_Sim at the pinned commit")
    ap.add_argument("--check", action="store_true", help="fail if either file would change")
    a = ap.parse_args(argv)
    sys.path.insert(0, str(a.sim.resolve() / "src"))

    from disagg_sim.hardware import LINKS, LLAMA3_8B
    from training_transit_sim import analytic, inputs
    from training_transit_sim.engine import CATEGORIES, simulate
    from training_transit_sim.hardware import ALL_LINKS, MFU_DEFAULT, Module, Topology, band_kernel, sum_kernel
    from training_transit_sim.model import GPU_FLOPS_PER_VALUE, VARIANTS, Config, plan

    exp = inputs.load()
    S = exp.setup
    modules = {"low": Module(gflops=10e9, transform_charged=True),
               "high": Module(gflops=99e9, transform_charged=True),
               "free": Module(gflops=99e9, transform_charged=False)}
    links = {k: ALL_LINKS[k] for k in ("ib-ndr", "eth-100g", "eth-25g", "wan-400g", "wan-800g")}
    labels = {"adamw": inputs.LABEL_ADAMW, "topk": inputs.LABEL_TOPK, "band": inputs.LABEL_BAND}
    acc = Topology("x").accelerator
    bk, sk = band_kernel(), sum_kernel(4)

    constants = {
        "source": "BrendanJamesLynskey/Training_Transit_Sim",
        "commit": COMMIT,
        "setup": {"params": S.params, "workers": S.workers, "seqs_per_worker": S.seqs_per_worker,
                  "context": S.context, "tokens_per_worker": S.tokens_per_worker, "steps": S.steps},
        "payload_per_step": {lab: exp.row(lab)["payload_per_step"] for lab in
                             [*labels.values(), *(inputs.label_optics(e) for e in inputs.ENOBS),
                              *(inputs.label_optics(8, p) for p in inputs.PLANES)]},
        "labels": {**labels, "optics": {f"{e},{p}": inputs.label_optics(e, p) for e in inputs.ENOBS for p in (8,)}
                   | {f"8,{p}": inputs.label_optics(8, p) for p in inputs.PLANES}},
        "targets": [[t, k] for t, k in exp.targets],
        "ladder": {lab: [exp.ladder[lab][round(t, 3)] for t, _ in exp.targets] for lab in exp.ladder},
        "enobs": list(inputs.ENOBS),
        "planes": list(inputs.PLANES),
        "gpu_flops_per_value": GPU_FLOPS_PER_VALUE,
        "mfu": MFU_DEFAULT,
        "accelerator": {"name": acc.name, "peak_flops": acc.peak_flops, "idle_w": acc.idle_w,
                        "pj_per_flop": acc.pj_per_flop},
        "links": {k: {"name": v.name, "bandwidth": v.bandwidth, "latency": v.latency, "pj_per_bit": v.pj_per_bit}
                  for k, v in links.items()},
        "modules": {k: asdict(m) for k, m in modules.items()},
        "band_kernel": {"name": bk.name, "ops_per_byte": bk.ops_per_byte, "fpga_ops_per_value": bk.fpga_ops_per_value,
                        "optical": bk.optical, "bytes_per_value": bk.bytes_per_value, "n": 256, "keep": 1 / 16},
        "sum_kernel_4": {"name": sk.name, "ops_per_byte": sk.ops_per_byte, "optical": sk.optical},
        "variants": {k: v["name"] for k, v in VARIANTS.items()},
        "categories": list(CATEGORIES),
        # results.md section 10 (extrapolations): the model sizes (None: the experiment's) and the sync intervals
        "extrapolate": {"sizes": [["15.8M (measured)", None], ["1B", 1e9], ["Llama-3-8B shape", float(LLAMA3_8B.params)]],
                        "sync_every": [1, 10, 100]},
    }

    # ── parity: the closed forms and the engine over a grid ──
    topologies = {
        "1x8": lambda bw: Topology("1x8", workers=8, dcs=1),
        "2x4": lambda bw: Topology("2x4", workers=8, dcs=2, inter=LINKS["eth-100g"]).with_inter(bw),
        "8x1": lambda bw: Topology("8x1", workers=8, dcs=8, inter=LINKS["eth-100g"]).with_inter(bw),
    }
    bws = [1e8 * 10 ** (i / 4) for i in range(0, 17)] + [1e9, 3.125e9, 12.5e9, 50e9, 100e9]
    rows = []
    for tk, mk in topologies.items():
        for bw in (bws if tk != "1x8" else [12.5e9]):
            for v in VARIANTS:
                for m in (("low", "high", "free") if v in ("band-pluggable", "band-switch") else ("high",)):
                    for exact in ((False, True) if v in ("band-pluggable", "band-switch") else (False,)):
                        c = Config(v, mk(bw), module=modules[m], exact_steps=exact)
                        p = plan(c)
                        r = simulate(p)
                        rows.append({"topology": tk, "bw": bw, "variant": v, "module": m, "exact": exact,
                                     "compute_s": p.compute_s, "payload": p.payload, "dense": p.dense,
                                     "sync": analytic.sync_time(p), "step": analytic.step_time(p),
                                     "wire": analytic.wire_per_worker(p),
                                     "engine_step": r.step_time, "hot_spots": r.hot_spots(),
                                     "energy": r.energy()})
    # E's steps at other ENOBs and planes, on the base topology
    for e in inputs.ENOBS:
        for pl in ((8,) if e != 8 else inputs.PLANES):
            for m in ("high", "free"):
                c = Config("band-pluggable", topologies["2x4"](12.5e9), module=replace(modules[m], enob=e, planes=pl))
                p = plan(c)
                rows.append({"topology": "2x4", "bw": 12.5e9, "variant": "band-pluggable", "module": m,
                             "exact": False, "enob": e, "planes": pl, "compute_s": p.compute_s, "payload": p.payload,
                             "dense": p.dense, "sync": analytic.sync_time(p), "step": analytic.step_time(p),
                             "wire": analytic.wire_per_worker(p)})
    stages = []
    dense = 2.0 * S.params
    for g in [1e9 * 10 ** (i / 4) for i in range(0, 21)] + [10e9, 99e9]:
        for pl in inputs.PLANES:
            for charged in (True, False):
                mod = Module(gflops=g, planes=pl, transform_charged=charged)
                st = mod.stage_times(dense, band_kernel(planes=pl))
                t, stage = mod.stream_time(dense, band_kernel(planes=pl))
                stages.append({"gflops": g, "planes": pl, "charged": charged, "stages": st, "stream": t,
                               "binding": stage})
    # section 10: the extrapolations (model size; sync every H steps), base topology, as results.py runs them
    extrapolate = []
    base = topologies["2x4"](12.5e9)
    for v in VARIANTS:
        for m in (("high", "free") if v in ("band-pluggable", "band-switch") else ("high",)):
            for _, P in constants["extrapolate"]["sizes"]:
                for H in constants["extrapolate"]["sync_every"]:
                    p = plan(Config(v, base, module=modules[m], params=P, sync_every=H))
                    r = simulate(p)
                    extrapolate.append({"variant": v, "module": m, "params": P, "sync_every": H,
                                        "compute_s": p.compute_s, "payload": p.payload, "dense": p.dense,
                                        "sync": analytic.sync_time(p), "step": analytic.step_time(p),
                                        "engine_step": r.step_time, "hot_spots": r.hot_spots()})
    parity = {"commit": COMMIT, "rows": rows, "stages": stages, "extrapolate": extrapolate}

    outs = {CONSTANTS: json.dumps(constants, indent=1) + "\n", PARITY: json.dumps(parity) + "\n"}
    stale = [str(p.relative_to(ROOT)) for p, s in outs.items() if not p.exists() or p.read_text() != s]
    if a.check:
        if stale:
            print("out of date: " + ", ".join(stale), file=sys.stderr)
            return 1
        print("checked " + ", ".join(str(p.relative_to(ROOT)) for p in outs))
        return 0
    for p, s in outs.items():
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(s)
    print("wrote " + ", ".join(str(p.relative_to(ROOT)) for p in outs), f"({len(rows)} rows, {len(stages)} stages)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
