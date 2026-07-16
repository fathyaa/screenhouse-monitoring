#!/usr/bin/env python3
"""
Membangun laporan HTML self-contained dari hasil stepped load test.

Membaca file step-rest-<level>-*.json dan step-ws-<level>-*.json (dari
run-stepped.sh), menyusunnya jadi kurva throughput-vs-beban & latensi-vs-beban,
lalu menyuntikkan datanya ke report-template.html → laporan-beban-restws.html.

Pakai:
    python3 build-report.py            # baca data asli step-*.json
    python3 build-report.py --demo     # data contoh, untuk lihat bentuk grafik
    python3 build-report.py -o out.html
"""
import glob
import json
import re
import sys
from collections import defaultdict
from datetime import datetime, timezone
from statistics import mean

HERE = __file__.rsplit("/", 1)[0] if "/" in __file__ else "."
TEMPLATE = f"{HERE}/report-template.html"
DEFAULT_OUT = f"{HERE}/laporan-beban-restws.html"

STEP_RE = re.compile(r"step-(rest|ws)-(\d+)-")


def g(metrics, name, stat):
    return metrics.get(name, {}).get("values", {}).get(stat)


def load_rest(files):
    """Rata-ratakan run per level (kalau diulang beberapa kali)."""
    by_level = defaultdict(list)
    for f in files:
        with open(f) as fh:
            m = json.load(fh)["metrics"]
        by_level[level_of(f)].append(m)
    rows = []
    for lvl in sorted(by_level):
        runs = by_level[lvl]
        avg = lambda name, stat: _avg([g(m, name, stat) for m in runs])
        rows.append({
            "level": lvl,
            "rps": avg("http_reqs", "rate"),
            "reqs": avg("http_reqs", "count"),
            "failed_pct": (avg("http_req_failed", "rate") or 0) * 100,
            "lat": {
                "p50": avg("http_req_duration", "med"),
                "p95": avg("http_req_duration", "p(95)"),
                "p99": avg("http_req_duration", "p(99)"),
            },
        })
    return rows


def load_ws(files):
    by_level = defaultdict(list)
    for f in files:
        with open(f) as fh:
            m = json.load(fh)["metrics"]
        by_level[level_of(f)].append(m)
    rows = []
    for lvl in sorted(by_level):
        runs = by_level[lvl]
        avg = lambda name, stat: _avg([g(m, name, stat) for m in runs])
        sessions = avg("ws_sessions", "count") or 0
        errors = avg("ws_connection_errors", "count") or 0
        rows.append({
            "level": lvl,
            "connect": {
                "p50": avg("ws_connecting", "med"),
                "p95": avg("ws_connecting", "p(95)"),
                "p99": avg("ws_connecting", "p(99)"),
            },
            "err_pct": (errors / sessions * 100) if sessions else 0,
            "sustained": avg("vus_max", "value"),
            "msgs": avg("ws_msgs_received", "count"),
        })
    return rows


def _avg(vals):
    vals = [v for v in vals if v is not None]
    return mean(vals) if vals else None


def level_of(path):
    m = STEP_RE.search(path)
    return int(m.group(2)) if m else 0


def track_of(path):
    m = STEP_RE.search(path)
    return m.group(1) if m else None


def demo_data():
    rest = [
        {"level": 10,  "rps": 60,  "reqs": 2700,  "failed_pct": 0.0,  "lat": {"p50": 3,   "p95": 20,  "p99": 40}},
        {"level": 25,  "rps": 150, "reqs": 6750,  "failed_pct": 0.0,  "lat": {"p50": 4,   "p95": 28,  "p99": 60}},
        {"level": 50,  "rps": 295, "reqs": 13300, "failed_pct": 0.0,  "lat": {"p50": 6,   "p95": 45,  "p99": 95}},
        {"level": 100, "rps": 560, "reqs": 25200, "failed_pct": 0.0,  "lat": {"p50": 12,  "p95": 110, "p99": 240}},
        {"level": 200, "rps": 870, "reqs": 39000, "failed_pct": 0.2,  "lat": {"p50": 45,  "p95": 320, "p99": 650}},
        {"level": 400, "rps": 980, "reqs": 44000, "failed_pct": 3.5,  "lat": {"p50": 180, "p95": 900, "p99": 1800}},
    ]
    ws = [
        {"level": 10,  "connect": {"p50": 4,  "p95": 11,  "p99": 20},  "err_pct": 0.0, "sustained": 10,  "msgs": 40},
        {"level": 50,  "connect": {"p50": 6,  "p95": 18,  "p99": 35},  "err_pct": 0.0, "sustained": 50,  "msgs": 200},
        {"level": 100, "connect": {"p50": 9,  "p95": 30,  "p99": 60},  "err_pct": 0.0, "sustained": 100, "msgs": 400},
        {"level": 200, "connect": {"p50": 15, "p95": 60,  "p99": 120}, "err_pct": 0.0, "sustained": 200, "msgs": 800},
        {"level": 400, "connect": {"p50": 35, "p95": 140, "p99": 300}, "err_pct": 0.5, "sustained": 398, "msgs": 1580},
        {"level": 800, "connect": {"p50": 95, "p95": 420, "p99": 900}, "err_pct": 4.2, "sustained": 760, "msgs": 2900},
    ]
    return {"demo": True, "rest": rest, "ws": ws}


def main():
    args = sys.argv[1:]
    out = DEFAULT_OUT
    if "-o" in args:
        out = args[args.index("-o") + 1]

    if "--demo" in args:
        data = demo_data()
    else:
        files = sorted(glob.glob(f"{HERE}/step-*.json"))
        rest_f = [f for f in files if track_of(f) == "rest"]
        ws_f = [f for f in files if track_of(f) == "ws"]
        if not rest_f and not ws_f:
            print("Tidak ada file step-*.json. Jalankan ./run-stepped.sh dulu, "
                  "atau coba: python3 build-report.py --demo")
            return
        data = {"demo": False, "rest": load_rest(rest_f), "ws": load_ws(ws_f)}
        print(f"REST: {len(data['rest'])} level · WS: {len(data['ws'])} level")

    data["generated_at"] = datetime.now(timezone.utc).astimezone().isoformat()

    with open(TEMPLATE) as f:
        html = f.read()
    payload = json.dumps(data, ensure_ascii=False)
    html = html.replace("/*__DATA__*/null", "/*__DATA__*/" + payload, 1)

    with open(out, "w") as f:
        f.write(html)
    print(f"Laporan ditulis: {out}")


if __name__ == "__main__":
    main()
