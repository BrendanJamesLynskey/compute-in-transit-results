#!/usr/bin/env python3
"""The chain animation's inputs and parity fixture, from the experiment's own code (DeMo_Fixed_Band_Experiment).

    ../DeMo_Fixed_Band_Experiment/.venv/bin/python scripts/chain_reference.py ../DeMo_Fixed_Band_Experiment           # write
    python scripts/chain_reference.py ../DeMo_Fixed_Band_Experiment --check                                          # CI

The clone's ``experiment/compressors.py`` must be the one at the commit in VENDORED.json (b1f62d3); the script
checks its hash. It needs NumPy and PyTorch (CPU). Writes:

* ``src/data/derived/chain_inputs.json``: one illustrative 256-value chunk per worker (8 workers): a gradient
  (a shared smooth signal plus each worker's own noise) and the residual error feedback is holding (out-of-band,
  as late in training), from a seeded NumPy generator. The animation runs these through the TypeScript port
  (``src/lib/chain/model.ts``); nothing in them is a measured result.
* ``tests/fixtures/chain_parity.json``: what the experiment's functions make of those inputs, step by step, as
  ``experiment/train.py``'s ``demo_step`` does it for variant E (1-D chunks of 256, the low band, k = 16,
  feedback of the values sent): the delta update, the orthonormal DCT-II, the band, the input quantisation and
  two's-complement bit planes, the optics' band with exact readout (``OpticsEmulator`` with ``enob=None``), the
  scatter-mean over the workers, the inverse DCT, the sign, and the residual after feedback. The readout noise
  itself is random (``torch.randn``), so the fixture records its RMS, and the unit tests check the port's noise
  against it statistically.

Floats are written with ``repr``, which round-trips to the same double in JavaScript.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INPUTS = ROOT / "src/data/derived/chain_inputs.json"
PARITY = ROOT / "tests/fixtures/chain_parity.json"
COMMIT = "b1f62d394ac79250df9ce555d3a55d85cf1cd517"
# sha256 of experiment/compressors.py at b1f62d3 (git show b1f62d3:experiment/compressors.py | sha256sum)
COMPRESSORS_SHA = "e38492878e42b02ce151e419420b36e809c89185208c0deeabe760a4f9d470a6"

W, M, KEEP = 8, 256, 1 / 16
DECAY, LR, KAPPA = 0.999, 1e-3, 4.0            # RunConfig defaults (decay, kappa) and the runs' lr
PLANES = (4, 8, 12)
ENOBS = (6.0, 8.0, 10.0, 12.0)
SEED = 2026


def dump(obj) -> str:
    return json.dumps(obj, indent=1, sort_keys=True) + "\n"


def same(a, b, path="") -> list[str]:
    """Structural equality, floats to 1e-12 relative: BLAS may sum in a different order on another CPU."""
    if isinstance(a, dict) and isinstance(b, dict):
        if a.keys() != b.keys():
            return [f"{path}: keys differ"]
        return [m for k in a for m in same(a[k], b[k], f"{path}.{k}")]
    if isinstance(a, list) and isinstance(b, list):
        if len(a) != len(b):
            return [f"{path}: length {len(a)} != {len(b)}"]
        return [m for i, (x, y) in enumerate(zip(a, b)) for m in same(x, y, f"{path}[{i}]")]
    if isinstance(a, float) or isinstance(b, float):
        ok = math.isclose(float(a), float(b), rel_tol=1e-12, abs_tol=1e-15)
        return [] if ok else [f"{path}: {a!r} != {b!r}"]
    return [] if a == b else [f"{path}: {a!r} != {b!r}"]


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("exp", type=Path, help="a clone of DeMo_Fixed_Band_Experiment")
    ap.add_argument("--check", action="store_true", help="fail if either file would change")
    a = ap.parse_args(argv)
    src = a.exp.resolve() / "experiment" / "compressors.py"
    sha = hashlib.sha256(src.read_bytes()).hexdigest()
    if sha != COMPRESSORS_SHA:
        print(f"{src}: sha256 {sha}, expected the file at {COMMIT[:7]} ({COMPRESSORS_SHA})", file=sys.stderr)
        return 1
    sys.path.insert(0, str(a.exp.resolve()))

    import numpy as np
    import torch

    from experiment import compressors as C

    torch.set_default_dtype(torch.float64)
    rng = np.random.default_rng(SEED)
    t = np.arange(M)
    # a shared smooth signal: a few low and middle frequencies, as momentum has; each worker adds its own noise
    shared = sum(rng.normal() / (1 + j) * np.cos(2 * np.pi * (1 + rng.integers(0, 24)) * t / M + rng.uniform(0, 2 * np.pi))
                 for j in range(6))
    grad = np.stack([shared + 0.6 * rng.normal(size=M) for _ in range(W)])
    # the residual error feedback holds: everything not yet sent, so out of band
    ch = C.Chunker((M,), "1d", M, dtype=torch.float64)
    k = C.keep_count(ch.m, KEEP)
    pos = C.band_order(ch.chunk_shape, "low")[:k]
    res = torch.from_numpy(2e-3 * rng.normal(size=(W, M)))
    rc = ch.encode(res)
    rc[..., pos] = 0
    # six significant figures: what the page ships, and what everything below is computed from
    r6 = np.vectorize(lambda x: float(f"{x:.6g}"))
    grad = r6(grad)
    resid = torch.from_numpy(r6(ch.decode(rc).numpy()))

    inputs = {"source": "scripts/chain_reference.py (illustrative: a seeded NumPy generator, not a measured run)",
              "seed": SEED, "workers": W, "m": M, "k": k, "decay": DECAY, "lr": LR, "kappa": KAPPA,
              "grad": grad.tolist(), "residual": resid.tolist()}

    # demo_step, variant E, for this one chunk (experiment/train.py at b1f62d3)
    g = torch.from_numpy(grad)
    d = resid.clone().mul_(DECAY).add_(g, alpha=LR)                       # d.mul_(cfg.decay).add_(g, alpha=lr)
    coef = ch.encode(d)                                                    # (W, chunks=1, m)
    idx = pos.expand(W, ch.chunks, k)
    val = coef[..., pos]
    rms = math.sqrt(float((d.double() ** 2).sum()) / d.numel())          # the full scale's mean square (a MAC)
    per_planes = {}
    for p in PLANES:
        emu = C.OpticsEmulator(ch, pos, C.OpticsConfig(planes=p, enob=None, kappa=KAPPA, native=256))
        emu.calibrate(rms)
        tx = emu(ch.to_chunks(d).reshape(W * ch.chunks, ch.m), torch.Generator()).reshape(W, ch.chunks, k)
        qmax = 2 ** (p - 1) - 1
        q = torch.round(ch.to_chunks(d).reshape(W, ch.m) / emu.scale_in * qmax)
        dd = d.clone()
        dd.sub_(ch.decode(torch.zeros_like(coef).scatter_(-1, idx, tx)))  # feedback="sent"
        agg = C.scatter_mean(ch.chunks, ch.m, [idx.transpose(0, 1).reshape(ch.chunks, W * k)],
                             [tx.transpose(0, 1).reshape(ch.chunks, W * k)], torch.float64)
        upd = ch.decode(agg)
        per_planes[str(p)] = {
            "scale_in": emu.scale_in, "clipped": emu.clipped, "q0": q[0].clamp(-qmax, qmax).to(torch.int64).tolist(),
            "tx": tx.reshape(W, k).tolist(), "agg": agg.reshape(M).tolist(), "update": upd.tolist(),
            "sign": upd.sign().tolist(), "residual_after": dd.tolist()}
    emu8 = C.OpticsEmulator(ch, pos, C.OpticsConfig(planes=8, enob=8.0, kappa=KAPPA, native=256))
    parity = {"commit": COMMIT, "positions": pos.tolist(), "k": k, "delta": d.tolist(), "coef": coef.reshape(W, M).tolist(),
              "band": val.reshape(W, k).tolist(), "rms": rms, "fs_out": emu8.fs_out,
              "noise_rms": {str(e): C.OpticsEmulator(ch, pos, C.OpticsConfig(planes=8, enob=e)).plane_noise_rms() for e in ENOBS},
              "planes": per_planes, "index_bytes_256": C.index_bytes(M), "value_bytes": C.VALUE_BYTES}

    out = {INPUTS: json.dumps(inputs, sort_keys=True, separators=(",", ":")) + "\n", PARITY: dump(parity)}
    if a.check:
        bad = []
        for p, s in out.items():
            if not p.exists():
                bad.append(f"{p.relative_to(ROOT)}: missing")
                continue
            bad += [f"{p.relative_to(ROOT)}{m}" for m in same(json.loads(p.read_text()), json.loads(s))][:5]
        if bad:
            print("out of date:\n  " + "\n  ".join(bad), file=sys.stderr)
            return 1
        print("chain inputs and parity fixture are up to date")
        return 0
    for p, s in out.items():
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(s)
        print(f"wrote {p.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
