#!/usr/bin/env python3
"""
Membaca semua file summary-<profil>-<waktu>.json hasil k6, lalu menghitung
rata-rata dan rentang (min-maks) lintas run untuk tiap profil.

Pakai:
    python3 aggregate-results.py                 # semua file summary-*.json
    python3 aggregate-results.py summary-baseline-*.json   # file tertentu
"""
import glob
import json
import re
import sys
from collections import defaultdict


def get(metrics, name, stat):
    return metrics.get(name, {}).get("values", {}).get(stat)


def profile_of(filename):
    m = re.match(r"summary-(.+?)-\d{4}-\d{2}-\d{2}T", filename)
    return m.group(1) if m else "?"


def load_run(path):
    with open(path) as f:
        m = json.load(f)["metrics"]
    return {
        "file": path,
        "reqs": get(m, "http_reqs", "count"),
        "rps": get(m, "http_reqs", "rate"),
        "failed_pct": (get(m, "http_req_failed", "rate") or 0) * 100,
        "p95": get(m, "http_req_duration", "p(95)"),
        "avg": get(m, "http_req_duration", "avg"),
        "login_p95": get(m, "dur_login", "p(95)"),
        "dash_p95": get(m, "dur_dashboard", "p(95)"),
    }


def fmt(x, unit=""):
    if x is None:
        return "-"
    if abs(x) >= 100:
        return f"{x:.0f}{unit}"
    return f"{x:.1f}{unit}"


def agg(values):
    vals = [v for v in values if v is not None]
    if not vals:
        return None, None, None
    return sum(vals) / len(vals), min(vals), max(vals)


FIELDS = [
    ("Total request", "reqs", ""),
    ("Throughput (req/detik)", "rps", ""),
    ("Request gagal (%)", "failed_pct", "%"),
    ("p95 keseluruhan (ms)", "p95", "ms"),
    ("Login p95 (ms)", "login_p95", "ms"),
    ("Dashboard p95 (ms)", "dash_p95", "ms"),
]


def main():
    patterns = sys.argv[1:] or ["summary-*.json"]
    files = sorted({f for p in patterns for f in glob.glob(p)})
    if not files:
        print("Tidak ada file summary yang cocok.")
        return

    by_profile = defaultdict(list)
    for f in files:
        by_profile[profile_of(f)].append(load_run(f))

    for profile, runs in by_profile.items():
        runs.sort(key=lambda r: r["file"])
        print(f"\n### Profil: {profile} ({len(runs)} run)\n")

        # Tabel per-run (biar outlier kelihatan)
        print("Per run:")
        print("| Run | Total req | Throughput | Gagal | p95 total | Login p95 | Dashboard p95 |")
        print("|---|---|---|---|---|---|---|")
        for i, r in enumerate(runs, 1):
            print(
                f"| {i} | {fmt(r['reqs'])} | {fmt(r['rps'])}/s | {fmt(r['failed_pct'],'%')} "
                f"| {fmt(r['p95'],'ms')} | {fmt(r['login_p95'],'ms')} | {fmt(r['dash_p95'],'ms')} |"
            )

        # Tabel agregat
        print("\nRata-rata dan rentang:")
        print("| Metrik | Rata-rata | Min | Maks |")
        print("|---|---|---|---|")
        for label, key, unit in FIELDS:
            mean, lo, hi = agg([r[key] for r in runs])
            print(f"| {label} | {fmt(mean,unit)} | {fmt(lo,unit)} | {fmt(hi,unit)} |")


if __name__ == "__main__":
    main()
