"""Demo rehearsal: reset -> watch Block B cross thresholds -> block H-27's vent -> clear it.
Repeats N runs and checks every run produces the same order.   python3 scripts/rehearse.py [BASE] [N]"""
import json
import sys
import time
import urllib.request

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000"
RUNS = int(sys.argv[2]) if len(sys.argv) > 2 else 3


def call(path, method="GET"):
    req = urllib.request.Request(BASE + path, method=method)
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.load(r)


def watch(seconds, seen, order):
    end = time.time() + seconds
    while time.time() < end:
        for h in sorted(call("/api/homes"), key=lambda h: h["id"]):
            if h["status"] in ("warning", "critical") and h["id"] not in seen:
                seen.add(h["id"])
                order.append(h["id"])
        time.sleep(2)


def one_run(i):
    rid = call("/api/sim/reset", "POST")["run_id"]
    seen, order = set(), []
    watch(20, seen, order)
    call("/api/sim/block_vent/H-27", "POST")
    watch(16, seen, order)
    h27 = next(h for h in call("/api/homes") if h["id"] == "H-27")
    call("/api/sim/clear_vent/H-27", "POST")
    print(f"run {i} {rid}: at-risk order {order}; H-27 {h27['status']} CO {h27['co_ppm']}")
    return order, h27["status"]


results = [one_run(i + 1) for i in range(RUNS)]
same = all(r == results[0] for r in results)
print("SAME_BEHAVIOR" if same else "DIFFERENT_BEHAVIOR")
sys.exit(0 if same else 1)
