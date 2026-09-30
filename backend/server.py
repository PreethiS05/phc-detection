from fastapi import FastAPI, APIRouter, HTTPException, Query
from fastapi.responses import PlainTextResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from mongomock_motor import AsyncMongoMockClient
import os
import asyncio
import io
import csv
import math
import random
import logging
from pathlib import Path
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, timedelta

import synthetic_data as sd
import compute as C

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
db_name = os.getenv('DB_NAME', 'phc_detection')

try:
    client = AsyncIOMotorClient(mongo_url)
    asyncio.run(client.admin.command('ping'))
    db = client[db_name]
except Exception:
    logger = logging.getLogger(__name__)
    logger.warning('MongoDB unavailable; using in-memory fallback database.')
    client = AsyncMongoMockClient(mongo_url)
    db = client[db_name]

app = FastAPI(title="Smart Health & Supply Chain Resilience")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# In-memory cache of the synthetic dataset (source for fast derived compute)
DATA = {}
MED_TREND = {}
MED_BY_ID = {}
STATE_BY_CODE = {}


# ---------------------------------------------------------------------------
# Seeding & cache
# ---------------------------------------------------------------------------
async def seed_database(force=False):
    existing = await db.phcs.count_documents({})
    if existing > 0 and not force:
        return
    logger.info("Seeding synthetic dataset...")
    dataset = sd.generate_dataset()
    for coll in ["meta", "states", "districts", "phcs", "medicines",
                 "inventory", "shipments", "federated_nodes", "suppliers",
                 "transfers", "notifications"]:
        await db[coll].delete_many({})
    await db.meta.insert_one(dataset["meta"])
    for coll in ["states", "districts", "phcs", "medicines", "inventory",
                 "shipments", "federated_nodes", "suppliers"]:
        if dataset[coll]:
            await db[coll].insert_many([{**d} for d in dataset[coll]])
    await db.notifications.insert_many(_build_notifications(dataset))
    logger.info("Seed complete.")


def _build_notifications(dataset):
    rng = random.Random(sd.SEED + 7)
    now = datetime.now(timezone.utc)
    notes = []
    lines = sorted(dataset["inventory"],
                   key=lambda i: i["current_stock"] / max(1, i["daily_consumption"]))[:10]
    for i, ln in enumerate(lines):
        notes.append({
            "id": f"NOT-C-{i+1:03d}", "category": "critical",
            "title": f"Predicted stock-out: {ln['medicine']}",
            "message": f"{ln['phc']} ({ln['state']}) projected to run out within days.",
            "created_at": (now - timedelta(minutes=rng.randint(2, 300))).isoformat(),
            "read": False, "link": "early-warnings",
        })
    warn_meds = rng.sample(dataset["inventory"], 6)
    for i, ln in enumerate(warn_meds):
        notes.append({
            "id": f"NOT-W-{i+1:03d}", "category": "warning",
            "title": f"Low inventory: {ln['medicine']}",
            "message": f"{ln['phc']} inventory below reorder level.",
            "created_at": (now - timedelta(minutes=rng.randint(10, 600))).isoformat(),
            "read": False, "link": "inventory",
        })
    infos = [
        ("Model training completed", "Federated Demand Forecast v3.4 aggregation finished."),
        ("Data synchronization completed", "All state nodes synced successfully."),
        ("Shipment received", "PPE Kits shipment received at District Warehouse."),
        ("Shipment received", "Insulin cold-chain shipment received, temperature within range."),
    ]
    for i, (t, m) in enumerate(infos):
        notes.append({
            "id": f"NOT-I-{i+1:03d}", "category": "info", "title": t, "message": m,
            "created_at": (now - timedelta(minutes=rng.randint(20, 900))).isoformat(),
            "read": i > 1, "link": "federated-ai",
        })
    return notes


async def load_cache():
    DATA["states"] = await db.states.find({}, {"_id": 0}).to_list(None)
    DATA["districts"] = await db.districts.find({}, {"_id": 0}).to_list(None)
    DATA["phcs"] = await db.phcs.find({}, {"_id": 0}).to_list(None)
    DATA["medicines"] = await db.medicines.find({}, {"_id": 0}).to_list(None)
    DATA["inventory"] = await db.inventory.find({}, {"_id": 0}).to_list(None)
    DATA["shipments"] = await db.shipments.find({}, {"_id": 0}).to_list(None)
    DATA["federated_nodes"] = await db.federated_nodes.find({}, {"_id": 0}).to_list(None)
    DATA["suppliers"] = await db.suppliers.find({}, {"_id": 0}).to_list(None)
    DATA["meta"] = await db.meta.find_one({"id": "meta"}, {"_id": 0})
    MED_TREND.clear(); MED_BY_ID.clear(); STATE_BY_CODE.clear()
    for m in DATA["medicines"]:
        MED_TREND[m["id"]] = m["trend"]
        MED_BY_ID[m["id"]] = m
    for s in DATA["states"]:
        STATE_BY_CODE[s["code"]] = s


async def save_meta():
    await db.meta.replace_one({"id": "meta"}, DATA["meta"], upsert=True)


def meta():
    return DATA["meta"]


# ---------------------------------------------------------------------------
# Derived helpers
# ---------------------------------------------------------------------------
def enrich_lines(lines):
    m = meta()
    return [C.compute_line(ln, m, MED_TREND.get(ln["medicine_id"], 0.0)) for ln in lines]


def phc_effective(phc):
    m = meta()
    mult = C.resolve_multipliers(m, phc["state_code"], phc["district_id"])
    staff_present = int(round(phc["staff_present"] * mult["staff"]))
    beds_occupied = min(phc["beds_total"], int(round(phc["beds_occupied"] * mult["bed"])))
    patients = int(round(phc["patients_today"] * mult["demand"]))
    footfall = int(round(phc["footfall_month"] * mult["demand"]))
    return {
        "staff_present": staff_present,
        "beds_occupied": beds_occupied,
        "beds_available": max(0, phc["beds_total"] - beds_occupied),
        "patients_today": patients,
        "footfall_month": footfall,
        "attendance": round(staff_present / max(1, phc["staff_total"]), 3),
        "occupancy": round(beds_occupied / max(1, phc["beds_total"]), 3),
    }


def phc_risk(phc_id, enriched):
    lines = [l for l in enriched if l["phc_id"] == phc_id]
    if not lines:
        return 0, "low"
    top = max(l["risk_score"] for l in lines)
    return top, C.risk_band(top)


def national_metrics():
    enriched = enrich_lines(DATA["inventory"])
    phcs = DATA["phcs"]
    total_lines = len(enriched)
    available = sum(1 for l in enriched if not l["below_reorder"])
    med_avail = round(available / max(1, total_lines) * 100, 1)
    crit_phcs = set(l["phc_id"] for l in enriched if l["risk_band"] == "critical")
    beds_available = 0
    staff_present = 0
    staff_total = 0
    footfall = 0
    util_sum = 0.0
    for p in phcs:
        eff = phc_effective(p)
        beds_available += eff["beds_available"]
        staff_present += eff["staff_present"]
        staff_total += p["staff_total"]
        footfall += eff["footfall_month"]
        util_sum += p["resource_utilisation"]
    attendance = round(staff_present / max(1, staff_total) * 100, 1)
    util = round(util_sum / max(1, len(phcs)) * 100, 1)
    return {
        "medicine_availability": med_avail,
        "critical_stockout_phcs": len(crit_phcs),
        "beds_available": beds_available,
        "personnel_attendance": attendance,
        "patient_footfall_month": footfall,
        "resource_utilisation": util,
        "enriched": enriched,
    }


def _status_from_pct(p, good, warn):
    if p >= good:
        return "healthy"
    if p >= warn:
        return "warning"
    return "critical"


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class TransferAction(BaseModel):
    recommendation_id: str
    source_phc_id: str
    dest_phc_id: str
    medicine_id: str
    quantity: int
    action: str


class EmergencyPayload(BaseModel):
    active: bool
    scenario: Optional[str] = None
    affected_states: Optional[List[str]] = None


class SimulatePayload(BaseModel):
    scenario: str
    state_code: Optional[str] = None
    district_id: Optional[str] = None
    medicine_id: Optional[str] = None
    magnitude: Optional[float] = 1.0


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@api_router.get("/")
async def root():
    return {"message": "Smart Health & Supply Chain Resilience API", "status": "ok"}


@api_router.get("/dashboard")
async def dashboard():
    nm = national_metrics()
    enriched = nm["enriched"]
    m = meta()

    def kpi(key, label, value, unit, seed, good, warn, higher_better=True, fmt="num"):
        prev = round(value * (1 + random.Random(seed).uniform(-0.05, 0.05)), 2)
        delta = round(value - prev, 2)
        pct = round(delta / max(0.01, abs(prev)) * 100, 1)
        spark = C.sparkline(seed, value, trend=(0.01 if higher_better else -0.01))
        status = _status_from_pct(value, good, warn) if fmt == "pct" else "healthy"
        return {"key": key, "label": label, "value": value, "unit": unit,
                "previous": prev, "delta": delta, "delta_pct": pct,
                "trend": "up" if delta >= 0 else "down",
                "status": status, "sparkline": spark, "higher_better": higher_better}

    kpis = [
        kpi("medicine_availability", "Medicine Availability", nm["medicine_availability"],
            "%", 101, 92, 80, True, "pct"),
        {"key": "critical_stockout_phcs", "label": "Critical Stock-Out Risks",
         "value": nm["critical_stockout_phcs"], "unit": "PHCs",
         "previous": nm["critical_stockout_phcs"] + 3, "delta": -3, "delta_pct": -10.0,
         "trend": "down",
         "status": "critical" if nm["critical_stockout_phcs"] > 15 else "warning",
         "sparkline": C.sparkline(102, nm["critical_stockout_phcs"], trend=-0.02),
         "higher_better": False},
        kpi("beds_available", "Available Beds", nm["beds_available"], "beds", 103, 0, 0, True),
        kpi("personnel_attendance", "Personnel Attendance", nm["personnel_attendance"],
            "%", 104, 90, 80, True, "pct"),
        {"key": "patient_footfall", "label": "Patient Footfall",
         "value": nm["patient_footfall_month"], "unit": "/ month",
         "previous": int(nm["patient_footfall_month"] * 0.96),
         "delta": int(nm["patient_footfall_month"] * 0.04), "delta_pct": 4.0, "trend": "up",
         "status": "healthy",
         "sparkline": C.sparkline(105, nm["patient_footfall_month"], trend=0.015),
         "higher_better": True},
        kpi("resource_utilisation", "Resource Utilisation", nm["resource_utilisation"],
            "%", 106, 100, 100, True, "pct"),
    ]

    crit = sorted([l for l in enriched if l["risk_band"] in ("critical", "high")],
                  key=lambda l: -l["risk_score"])[:6]
    recent_alerts = [{"medicine": l["medicine"], "phc": l["phc"], "state": l["state"],
                      "risk_score": l["risk_score"], "band": l["risk_band"],
                      "days_remaining": l["days_remaining"]} for l in crit]

    state_risk = {}
    for l in enriched:
        state_risk.setdefault(l["state"], []).append(l["risk_score"])
    top_states = sorted(
        [{"state": k, "avg_risk": round(sum(v) / len(v), 1),
          "critical_lines": sum(1 for x in v if x >= 81)} for k, v in state_risk.items()],
        key=lambda x: -x["avg_risk"])[:6]

    system_health = round(
        (nm["medicine_availability"] * 0.4 + nm["personnel_attendance"] * 0.3 +
         (100 - min(100, nm["critical_stockout_phcs"])) * 0.3), 1)

    return {
        "title": "National Health Resource Command Centre",
        "last_updated": m["last_sync"],
        "states_connected": len(DATA["states"]),
        "districts_monitored": len(DATA["districts"]),
        "phcs_monitored": len(DATA["phcs"]),
        "system_health": system_health,
        "system_health_status": _status_from_pct(system_health, 85, 70),
        "emergency": m["emergency"],
        "kpis": kpis,
        "recent_alerts": recent_alerts,
        "top_risk_states": top_states,
    }


@api_router.get("/states")
async def get_states(metric: str = "risk"):
    enriched = enrich_lines(DATA["inventory"])
    by_state = {}
    for l in enriched:
        by_state.setdefault(l["state_code"], []).append(l)
    out = []
    m = meta()
    for s in DATA["states"]:
        lines = by_state.get(s["code"], [])
        phcs = [p for p in DATA["phcs"] if p["state_code"] == s["code"]]
        effs = [phc_effective(p) for p in phcs]
        avail = round(sum(1 for l in lines if not l["below_reorder"]) / max(1, len(lines)) * 100, 1)
        crit = len(set(l["phc_id"] for l in lines if l["risk_band"] == "critical"))
        avg_risk = round(sum(l["risk_score"] for l in lines) / max(1, len(lines)), 1)
        beds_total = sum(p["beds_total"] for p in phcs)
        beds_occ = sum(e["beds_occupied"] for e in effs)
        occupancy = round(beds_occ / max(1, beds_total) * 100, 1)
        attendance = round(sum(e["staff_present"] for e in effs) /
                           max(1, sum(p["staff_total"] for p in phcs)) * 100, 1)
        footfall = sum(e["footfall_month"] for e in effs)
        util = round(sum(p["resource_utilisation"] for p in phcs) / max(1, len(phcs)) * 100, 1)
        emergency = s["code"] in m["emergency"].get("affected_states", []) and m["emergency"]["active"]
        metric_value = {
            "risk": avg_risk, "availability": avail, "beds": occupancy,
            "footfall": footfall, "personnel": attendance, "utilisation": util,
            "emergency": 100 if emergency else avg_risk,
        }.get(metric, avg_risk)
        if metric in ("availability", "personnel"):
            sev = "low" if metric_value >= 90 else "moderate" if metric_value >= 80 else "critical"
        elif metric in ("risk", "emergency"):
            sev = C.risk_band(metric_value)
        else:
            sev = "low" if metric_value < 70 else "moderate" if metric_value < 85 else "critical"
        out.append({
            "code": s["code"], "name": s["name"], "lat": s["lat"], "lng": s["lng"],
            "district_count": s["district_count"], "phc_count": len(phcs),
            "medicine_availability": avail, "critical_stockout_phcs": crit,
            "avg_risk": avg_risk, "bed_occupancy": occupancy, "personnel_attendance": attendance,
            "patient_footfall": footfall, "resource_utilisation": util,
            "emergency": emergency, "metric_value": metric_value, "severity": sev,
        })
    return {"metric": metric, "states": out}


@api_router.get("/states/{code}")
async def state_detail(code: str):
    s = STATE_BY_CODE.get(code)
    if not s:
        raise HTTPException(404, "State not found")
    enriched = enrich_lines([l for l in DATA["inventory"] if l["state_code"] == code])
    phcs = [p for p in DATA["phcs"] if p["state_code"] == code]
    effs = [phc_effective(p) for p in phcs]
    avail = round(sum(1 for l in enriched if not l["below_reorder"]) / max(1, len(enriched)) * 100, 1)
    crit = len(set(l["phc_id"] for l in enriched if l["risk_band"] == "critical"))
    top_med = max(DATA["medicines"], key=lambda mm: mm["trend"])
    fc = C.build_forecast(1200, sd.SEED + hash(code) % 9999, top_med["trend"],
                          top_med["seasonal"], 30)
    alerts = sorted([l for l in enriched if l["risk_band"] in ("critical", "high")],
                    key=lambda l: -l["risk_score"])[:5]
    return {
        "code": code, "name": s["name"],
        "districts_monitored": s["district_count"], "phcs_monitored": len(phcs),
        "medicine_availability": avail, "critical_stockout_phcs": crit,
        "bed_occupancy": round(sum(e["beds_occupied"] for e in effs) /
                               max(1, sum(p["beds_total"] for p in phcs)) * 100, 1),
        "personnel_attendance": round(sum(e["staff_present"] for e in effs) /
                                      max(1, sum(p["staff_total"] for p in phcs)) * 100, 1),
        "patient_footfall": sum(e["footfall_month"] for e in effs),
        "resource_utilisation": round(sum(p["resource_utilisation"] for p in phcs) /
                                      max(1, len(phcs)) * 100, 1),
        "demand_forecast": {"medicine": top_med["name"],
                            "predicted_daily": fc["predicted_daily_demand"],
                            "confidence": fc["confidence"],
                            "expected_increase_pct": fc["expected_increase_pct"]},
        "recent_alerts": [{"medicine": l["medicine"], "phc": l["phc"],
                           "risk_score": l["risk_score"], "band": l["risk_band"]} for l in alerts],
    }


@api_router.get("/districts")
async def get_districts(state_code: Optional[str] = None):
    enriched = enrich_lines(DATA["inventory"])
    out = []
    for d in DATA["districts"]:
        if state_code and d["state_code"] != state_code:
            continue
        lines = [l for l in enriched if l["district_id"] == d["id"]]
        phcs = [p for p in DATA["phcs"] if p["district_id"] == d["id"]]
        effs = [phc_effective(p) for p in phcs]
        avail = round(sum(1 for l in lines if not l["below_reorder"]) / max(1, len(lines)) * 100, 1)
        avg_risk = round(sum(l["risk_score"] for l in lines) / max(1, len(lines)), 1)
        out.append({
            "id": d["id"], "name": d["name"], "state": d["state"], "state_code": d["state_code"],
            "lat": d["lat"], "lng": d["lng"], "phc_count": len(phcs),
            "medicine_availability": avail, "avg_risk": avg_risk, "severity": C.risk_band(avg_risk),
            "critical_stockout_phcs": len(set(l["phc_id"] for l in lines if l["risk_band"] == "critical")),
            "bed_occupancy": round(sum(e["beds_occupied"] for e in effs) /
                                   max(1, sum(p["beds_total"] for p in phcs)) * 100, 1),
            "personnel_attendance": round(sum(e["staff_present"] for e in effs) /
                                          max(1, sum(p["staff_total"] for p in phcs)) * 100, 1),
        })
    return {"districts": out}


@api_router.get("/phcs")
async def get_phcs(state_code: Optional[str] = None, district_id: Optional[str] = None,
                   risk: Optional[str] = None, q: Optional[str] = None,
                   sort: str = "risk", page: int = 1, limit: int = 20):
    enriched = enrich_lines(DATA["inventory"])
    rows = []
    for p in DATA["phcs"]:
        if state_code and p["state_code"] != state_code:
            continue
        if district_id and p["district_id"] != district_id:
            continue
        if q and q.lower() not in p["name"].lower() and q.lower() not in p["code"].lower():
            continue
        eff = phc_effective(p)
        score, band = phc_risk(p["id"], enriched)
        if risk and band != risk:
            continue
        plines = [l for l in enriched if l["phc_id"] == p["id"]]
        avail = round(sum(1 for l in plines if not l["below_reorder"]) / max(1, len(plines)) * 100, 1)
        rows.append({
            "id": p["id"], "code": p["code"], "name": p["name"], "district": p["district"],
            "state": p["state"], "state_code": p["state_code"], "district_id": p["district_id"],
            "population_served": p["population_served"], "medicine_availability": avail,
            "beds_total": p["beds_total"], "beds_available": eff["beds_available"],
            "occupancy": round(eff["occupancy"] * 100, 1),
            "staff_total": p["staff_total"], "attendance": round(eff["attendance"] * 100, 1),
            "resource_utilisation": round(p["resource_utilisation"] * 100, 1),
            "risk_score": score, "risk_band": band,
            "last_sync": f"{p['last_sync_min']} min ago", "status": p["status"],
        })
    keymap = {"risk": lambda r: -r["risk_score"], "name": lambda r: r["name"],
              "availability": lambda r: r["medicine_availability"],
              "attendance": lambda r: -r["attendance"]}
    rows.sort(key=keymap.get(sort, keymap["risk"]))
    total = len(rows)
    start = (page - 1) * limit
    return {"total": total, "page": page, "limit": limit, "phcs": rows[start:start + limit]}


@api_router.get("/phcs/{phc_id}")
async def phc_detail(phc_id: str):
    p = next((x for x in DATA["phcs"] if x["id"] == phc_id), None)
    if not p:
        raise HTTPException(404, "PHC not found")
    eff = phc_effective(p)
    lines = enrich_lines([l for l in DATA["inventory"] if l["phc_id"] == phc_id])
    score, band = phc_risk(phc_id, lines)
    now = datetime.now(timezone.utc)

    def series(seed, base, vol, days=14):
        return [{"date": (now - timedelta(days=days - i)).date().isoformat(),
                 "value": int(base * (1 + random.Random(seed + i).uniform(-vol, vol)))}
                for i in range(days)]

    recs = []
    for l in sorted(lines, key=lambda x: -x["risk_score"])[:4]:
        if l["risk_band"] in ("critical", "high"):
            recs.append({"type": "transfer", "medicine": l["medicine"],
                         "text": f"Arrange transfer of {l['medicine']} — {C.explain_risk(l)}"})
    if eff["attendance"] < 0.85:
        recs.append({"type": "staffing", "medicine": None,
                     "text": "Increase staffing — attendance below 85% threshold."})
    if eff["occupancy"] > 0.85:
        recs.append({"type": "surge", "medicine": None,
                     "text": "Prepare for demand surge — bed occupancy above 85%."})
    if not recs:
        recs.append({"type": "reorder", "medicine": None,
                     "text": "Facility within healthy thresholds. Maintain routine reorders."})

    return {
        "id": p["id"], "code": p["code"], "name": p["name"], "district": p["district"],
        "state": p["state"], "state_code": p["state_code"], "lat": p["lat"], "lng": p["lng"],
        "population_served": p["population_served"], "risk_score": score, "risk_band": band,
        "kpis": {
            "patients_today": eff["patients_today"],
            "beds_available": eff["beds_available"], "beds_total": p["beds_total"],
            "medicine_availability": round(sum(1 for l in lines if not l["below_reorder"]) /
                                           max(1, len(lines)) * 100, 1),
            "staff_attendance": round(eff["attendance"] * 100, 1),
            "resource_utilisation": round(p["resource_utilisation"] * 100, 1),
            "occupancy": round(eff["occupancy"] * 100, 1),
        },
        "charts": {
            "footfall": series(hash(phc_id) % 9999, max(20, eff["patients_today"]), 0.18),
            "consumption": series(hash(phc_id) % 8888 + 1, 800, 0.15),
            "occupancy": [{"date": s["date"], "value": min(100, int(s["value"] % 40 + 55))}
                          for s in series(hash(phc_id) % 7777 + 2, 60, 0.2)],
            "attendance": [{"date": s["date"], "value": min(100, int(80 + s["value"] % 18))}
                           for s in series(hash(phc_id) % 6666 + 3, 90, 0.05)],
        },
        "inventory": [{"medicine": l["medicine"], "stock": l["effective_stock"],
                       "daily_usage": l["effective_daily_consumption"],
                       "days_remaining": l["days_remaining"], "risk_band": l["risk_band"],
                       "risk_score": l["risk_score"]} for l in
                      sorted(lines, key=lambda x: -x["risk_score"])],
        "recommendations": recs,
    }


@api_router.get("/medicines")
async def get_medicines():
    return {"medicines": DATA["medicines"]}


@api_router.get("/inventory")
async def get_inventory(state_code: Optional[str] = None, district_id: Optional[str] = None,
                        phc_id: Optional[str] = None, medicine_id: Optional[str] = None,
                        category: Optional[str] = None, risk: Optional[str] = None,
                        expiry_days: Optional[int] = None, q: Optional[str] = None,
                        page: int = 1, limit: int = 25):
    src = DATA["inventory"]
    if state_code:
        src = [l for l in src if l["state_code"] == state_code]
    if district_id:
        src = [l for l in src if l["district_id"] == district_id]
    if phc_id:
        src = [l for l in src if l["phc_id"] == phc_id]
    if medicine_id:
        src = [l for l in src if l["medicine_id"] == medicine_id]
    if category:
        src = [l for l in src if l["category"] == category]
    if q:
        ql = q.lower()
        src = [l for l in src if ql in l["medicine"].lower() or ql in l["phc"].lower()]
    enriched = enrich_lines(src)
    if risk:
        enriched = [l for l in enriched if l["risk_band"] == risk]
    if expiry_days:
        cutoff = (datetime.now(timezone.utc) + timedelta(days=expiry_days)).date().isoformat()
        enriched = [l for l in enriched if l["expiry_date"] <= cutoff]
    enriched.sort(key=lambda l: -l["risk_score"])
    total = len(enriched)
    start = (page - 1) * limit
    return {"total": total, "page": page, "limit": limit,
            "categories": sorted(set(l["category"] for l in DATA["inventory"])),
            "inventory": enriched[start:start + limit]}


@api_router.get("/inventory/charts")
async def inventory_charts(state_code: Optional[str] = None):
    src = DATA["inventory"]
    if state_code:
        src = [l for l in src if l["state_code"] == state_code]
    enriched = enrich_lines(src)
    now = datetime.now(timezone.utc)
    total_stock = sum(l["effective_stock"] for l in enriched)
    trend = [{"date": (now - timedelta(days=30 - i)).date().isoformat(),
              "stock": int(total_stock * (0.9 + 0.1 * i / 30) *
                           (1 + random.Random(i).uniform(-0.03, 0.03)))}
             for i in range(30)]
    consumption = [{"date": (now - timedelta(days=30 - i)).date().isoformat(),
                    "consumed": int(sum(l["effective_daily_consumption"] for l in enriched) *
                                    (1 + random.Random(i + 99).uniform(-0.08, 0.08)))}
                   for i in range(30)]
    buckets = {"<30 days": 0, "30-90 days": 0, "90-365 days": 0, ">365 days": 0}
    for l in enriched:
        exp = datetime.fromisoformat(l["expiry_date"]).date()
        days = (exp - now.date()).days
        if days < 30:
            buckets["<30 days"] += 1
        elif days < 90:
            buckets["30-90 days"] += 1
        elif days < 365:
            buckets["90-365 days"] += 1
        else:
            buckets[">365 days"] += 1
    expiry = [{"bucket": k, "count": v} for k, v in buckets.items()]
    cat = {}
    for l in enriched:
        cat[l["category"]] = cat.get(l["category"], 0) + l["effective_stock"]
    distribution = sorted([{"category": k, "stock": v} for k, v in cat.items()],
                          key=lambda x: -x["stock"])[:10]
    risk_dist = {"low": 0, "moderate": 0, "high": 0, "critical": 0}
    for l in enriched:
        risk_dist[l["risk_band"]] += 1
    return {"trend": trend, "consumption": consumption, "expiry": expiry,
            "distribution": distribution,
            "risk_distribution": [{"band": k, "count": v} for k, v in risk_dist.items()]}


@api_router.get("/forecast")
async def forecast(medicine_id: str, state_code: Optional[str] = None,
                   district_id: Optional[str] = None, phc_id: Optional[str] = None,
                   horizon: int = 30):
    med = MED_BY_ID.get(medicine_id)
    if not med:
        raise HTTPException(404, "Medicine not found")
    src = [l for l in DATA["inventory"] if l["medicine_id"] == medicine_id]
    if state_code:
        src = [l for l in src if l["state_code"] == state_code]
    if district_id:
        src = [l for l in src if l["district_id"] == district_id]
    if phc_id:
        src = [l for l in src if l["phc_id"] == phc_id]
    if not src:
        raise HTTPException(404, "No inventory for selection")
    m = meta()
    base = sum(l["daily_consumption"] for l in src)
    mult = 1.0
    if state_code:
        mult = C.resolve_multipliers(m, state_code, district_id, medicine_id)["demand"]
    seed = sd.SEED + hash(f"{medicine_id}{state_code}{district_id}{phc_id}") % 99999
    fc = C.build_forecast(base, seed, med["trend"], med["seasonal"], horizon, mult)
    fc.update({
        "medicine": med["name"], "medicine_id": medicine_id, "unit": med["unit"],
        "horizon": horizon, "category": med["category"], "seasonal": med["seasonal"],
        "note": "AI-generated demand forecast (simulated, deterministic). Not a guaranteed prediction.",
    })
    return fc


@api_router.get("/alerts")
async def alerts(risk: Optional[str] = None, state_code: Optional[str] = None, limit: int = 60):
    src = DATA["inventory"]
    if state_code:
        src = [l for l in src if l["state_code"] == state_code]
    enriched = enrich_lines(src)
    enriched = [l for l in enriched if l["risk_score"] >= 31]
    if risk:
        enriched = [l for l in enriched if l["risk_band"] == risk]
    enriched.sort(key=lambda l: -l["risk_score"])
    out = []
    for l in enriched[:limit]:
        out.append({**l, "explanation": C.explain_risk(l),
                    "recommended_action_detail": _transfer_hint(l)})
    counts = {"critical": 0, "high": 0, "moderate": 0}
    for l in enrich_lines(DATA["inventory"]):
        if l["risk_band"] in counts:
            counts[l["risk_band"]] += 1
    return {"counts": counts, "alerts": out}


def _transfer_hint(line):
    candidates = [l for l in enrich_lines(
        [x for x in DATA["inventory"] if x["medicine_id"] == line["medicine_id"]
         and x["phc_id"] != line["phc_id"]]) if l["days_remaining"] > 30]
    candidates.sort(key=lambda l: -l["days_remaining"])
    if candidates:
        src = candidates[0]
        qty = int(line["effective_daily_consumption"] * 10)
        return f"Transfer {qty} {line['unit']} from {src['phc']} ({src['district']})."
    return "Escalate to State Warehouse for priority replenishment."


@api_router.get("/resource-recommendations")
async def resource_recommendations():
    enriched = enrich_lines(DATA["inventory"])
    deficits = [l for l in enriched if l["risk_band"] in ("critical", "high")]
    deficits.sort(key=lambda l: -l["risk_score"])
    by_med = {}
    for l in enriched:
        by_med.setdefault(l["medicine_id"], []).append(l)
    recs = []
    used_dest = set()
    for d in deficits:
        if d["phc_id"] in used_dest:
            continue
        pool = [x for x in by_med.get(d["medicine_id"], [])
                if x["phc_id"] != d["phc_id"] and x["days_remaining"] > 30]
        if not pool:
            continue
        pool.sort(key=lambda x: -x["days_remaining"])
        src = pool[0]
        shortage = max(0, int(d["reorder_level"] - d["effective_stock"]))
        surplus = int(src["effective_stock"] - src["reorder_level"] * 1.5)
        qty = max(100, min(shortage if shortage > 0 else int(d["effective_daily_consumption"] * 10),
                           max(100, surplus)))
        s_state = STATE_BY_CODE[src["state_code"]]
        d_state = STATE_BY_CODE[d["state_code"]]
        dist = _haversine(s_state["lat"], s_state["lng"], d_state["lat"], d_state["lng"])
        recs.append({
            "id": f"REC-{len(recs)+1:04d}",
            "medicine": d["medicine"], "medicine_id": d["medicine_id"], "unit": d["unit"],
            "source_phc": src["phc"], "source_phc_id": src["phc_id"],
            "source_district": src["district"], "source_state": src["state"],
            "source_available_surplus": max(0, surplus),
            "dest_phc": d["phc"], "dest_phc_id": d["phc_id"],
            "dest_district": d["district"], "dest_state": d["state"],
            "dest_projected_shortage": shortage, "recommended_quantity": qty,
            "distance_km": round(dist, 0), "transport_time_hours": round(dist / 45.0 + 1, 1),
            "transport_cost": round(dist * 42 + 1500, 0),
            "risk_reduction": min(90, d["risk_score"] - 20),
            "dest_risk_score": d["risk_score"], "dest_days_remaining": d["days_remaining"],
            "expected_impact": "Prevents projected stock-out within lead time",
            "explanation": C.explain_risk(d), "status": "pending",
        })
        used_dest.add(d["phc_id"])
        if len(recs) >= 20:
            break
    return {"recommendations": recs}


def _haversine(lat1, lon1, lat2, lon2):
    R = 6371
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


@api_router.post("/resource-transfer")
async def resource_transfer(payload: TransferAction):
    now = datetime.now(timezone.utc)
    if payload.action == "approve":
        src = next((l for l in DATA["inventory"] if l["phc_id"] == payload.source_phc_id
                    and l["medicine_id"] == payload.medicine_id), None)
        dst = next((l for l in DATA["inventory"] if l["phc_id"] == payload.dest_phc_id
                    and l["medicine_id"] == payload.medicine_id), None)
        qty = payload.quantity
        if src:
            src["current_stock"] = max(0, src["current_stock"] - qty)
            await db.inventory.update_one({"id": src["id"]},
                                          {"$set": {"current_stock": src["current_stock"]}})
        if dst:
            dst["current_stock"] += qty
            await db.inventory.update_one({"id": dst["id"]},
                                          {"$set": {"current_stock": dst["current_stock"]}})
    record = {"id": f"TR-{int(now.timestamp())}", "recommendation_id": payload.recommendation_id,
              "source_phc_id": payload.source_phc_id, "dest_phc_id": payload.dest_phc_id,
              "medicine_id": payload.medicine_id, "quantity": payload.quantity,
              "status": "approved" if payload.action == "approve" else "rejected",
              "timestamp": now.isoformat()}
    await db.transfers.insert_one({**record})
    med = MED_BY_ID.get(payload.medicine_id, {}).get("name", "medicine")
    return {"success": True, "status": record["status"], "transfer": record,
            "message": (f"Transfer approved successfully. {payload.quantity} units of {med} allocated."
                        if payload.action == "approve" else "Recommendation rejected.")}


@api_router.get("/supply-chain")
async def supply_chain(state_code: Optional[str] = None):
    src = DATA["inventory"]
    if state_code:
        src = [l for l in src if l["state_code"] == state_code]
    enriched = enrich_lines(src)
    shipments = DATA["shipments"]
    if state_code:
        shipments = [s for s in shipments if s["state_code"] == state_code]
    total_stock = sum(l["effective_stock"] for l in enriched)
    stages = [
        {"stage": "Manufacturer", "inventory": int(total_stock * 3.2),
         "throughput": int(total_stock * 0.4), "status": "healthy"},
        {"stage": "Central Warehouse", "inventory": int(total_stock * 2.1),
         "throughput": int(total_stock * 0.35), "status": "healthy"},
        {"stage": "State Warehouse", "inventory": int(total_stock * 1.4),
         "throughput": int(total_stock * 0.3), "status": "warning"},
        {"stage": "District Warehouse", "inventory": int(total_stock * 0.8),
         "throughput": int(total_stock * 0.25), "status": "warning"},
        {"stage": "PHC", "inventory": total_stock, "throughput": int(total_stock * 0.15),
         "status": "healthy"},
        {"stage": "Patient", "inventory": 0, "throughput": int(total_stock * 0.12),
         "status": "healthy"},
    ]
    enriched.sort(key=lambda l: -l["risk_score"])
    table = []
    for l in enriched[:40]:
        inc = next((s for s in shipments if s["phc_id"] == l["phc_id"]
                    and s["medicine_id"] == l["medicine_id"]), None)
        table.append({
            "medicine": l["medicine"], "phc": l["phc"], "district": l["district"],
            "state": l["state"], "current_stock": l["effective_stock"],
            "daily_consumption": l["effective_daily_consumption"],
            "days_remaining": l["days_remaining"], "risk_band": l["risk_band"],
            "incoming_shipment": (f"{inc['quantity']} {l['unit']} • ETA {inc['eta_days']}d"
                                  if inc else "—"),
        })
    return {
        "stages": stages,
        "avg_delivery_days": round(sum(s["eta_days"] for s in shipments) / max(1, len(shipments)), 1),
        "incoming_count": len(shipments), "table": table, "suppliers": DATA["suppliers"],
        "shipments": sorted(shipments, key=lambda s: s["eta_days"])[:25],
        "bottlenecks": [{"stage": "State Warehouse", "issue": "Dispatch backlog on cold-chain items"},
                        {"stage": "District Warehouse", "issue": "Longer lead time in eastern districts"}],
    }


@api_router.get("/federated-model")
async def federated_model():
    m = meta()
    nodes = DATA["federated_nodes"]
    conv = [{"round": r, "accuracy": round(0.80 + 0.13 * (1 - math.exp(-r / 6.0)) +
                                           random.Random(r).uniform(-0.005, 0.005), 4)}
            for r in range(1, m["model"]["round"] + 1)]
    return {
        "model": m["model"], "nodes": nodes, "convergence": conv,
        "active_nodes": sum(1 for n in nodes if n["status"] in ("active", "training")),
        "avg_accuracy": round(sum(n["accuracy"] for n in nodes) / len(nodes), 4),
        "total_data_volume": sum(n["data_volume"] for n in nodes),
        "privacy_note": ("SIMULATED federated learning. This prototype demonstrates the federated "
                         "workflow (local training, secure aggregation, global model) with synthetic "
                         "data; it does not perform real cryptographic secure aggregation or "
                         "differential privacy."),
    }


@api_router.post("/federated-training")
async def federated_training():
    m = meta()
    m["model"]["round"] += 1
    m["model"]["global_accuracy"] = round(min(0.975, m["model"]["global_accuracy"] + 0.003), 4)
    m["model"]["last_training"] = datetime.now(timezone.utc).isoformat()
    m["model"]["aggregation_status"] = "Completed"
    for n in DATA["federated_nodes"]:
        if random.Random(n["state_code"] + str(m["model"]["round"])).random() > 0.5:
            n["accuracy"] = round(min(0.97, n["accuracy"] + 0.002), 4)
            n["last_update_min"] = 1
    await db.federated_nodes.delete_many({})
    await db.federated_nodes.insert_many([{**n} for n in DATA["federated_nodes"]])
    await save_meta()
    return {"success": True, "model": m["model"],
            "message": f"Federated training round {m['model']['round']} completed (simulated)."}


@api_router.get("/analytics")
async def analytics(range_days: int = 30):
    enriched = enrich_lines(DATA["inventory"])
    now = datetime.now(timezone.utc)
    by_state = {}
    for l in enriched:
        by_state.setdefault(l["state"], []).append(l)
    state_comparison = sorted([{
        "state": k,
        "availability": round(sum(1 for x in v if not x["below_reorder"]) / max(1, len(v)) * 100, 1),
        "avg_risk": round(sum(x["risk_score"] for x in v) / max(1, len(v)), 1),
        "stockouts": sum(1 for x in v if x["risk_band"] == "critical"),
    } for k, v in by_state.items()], key=lambda x: -x["avg_risk"])[:12]
    by_med = {}
    for l in enriched:
        by_med[l["medicine"]] = by_med.get(l["medicine"], 0) + l["effective_daily_consumption"]
    med_consumption = sorted([{"medicine": k, "consumption": v} for k, v in by_med.items()],
                             key=lambda x: -x["consumption"])[:12]

    def ts(seed, base, vol, tr=0.0):
        return [{"date": (now - timedelta(days=range_days - i)).date().isoformat(),
                 "value": round(base * (1 + tr) ** i * (1 + random.Random(seed + i).uniform(-vol, vol)), 1)}
                for i in range(range_days)]
    total_footfall = sum(phc_effective(p)["footfall_month"] for p in DATA["phcs"]) / 30
    total_beds = sum(p["beds_total"] for p in DATA["phcs"])
    occ = sum(phc_effective(p)["beds_occupied"] for p in DATA["phcs"]) / max(1, total_beds) * 100
    heatmap = [{"state": s["state"], "availability": s["availability"],
                "risk": s["avg_risk"], "stockouts": s["stockouts"]} for s in state_comparison]
    return {
        "range_days": range_days, "state_comparison": state_comparison,
        "medicine_consumption": med_consumption,
        "resource_utilisation": ts(11, 78, 0.05), "bed_occupancy": ts(12, round(occ, 1), 0.06),
        "patient_footfall": ts(13, round(total_footfall, 0), 0.1, 0.002),
        "personnel_attendance": ts(14, 91, 0.03), "supply_lead_time": ts(15, 6.4, 0.08),
        "forecast_accuracy": ts(16, 92, 0.02),
        "stockout_frequency": [{"state": s["state"], "count": s["stockouts"]} for s in state_comparison],
        "heatmap": heatmap,
    }


@api_router.get("/emergency-mode")
async def get_emergency():
    return _emergency_state()


def _emergency_state():
    m = meta()
    emg = m["emergency"]
    affected = emg.get("affected_states", [])
    enriched = enrich_lines([l for l in DATA["inventory"] if l["state_code"] in affected]) \
        if affected else []
    phcs = [p for p in DATA["phcs"] if p["state_code"] in affected]
    crit_phcs = len(set(l["phc_id"] for l in enriched if l["risk_band"] == "critical"))
    dm = emg.get("demand_multiplier", 1.0)
    metrics = {
        "patient_footfall_pct": round((dm - 1) * 100, 0),
        "medicine_demand_pct": round((dm - 1) * 100 + 4, 0),
        "bed_occupancy": round(sum(phc_effective(p)["occupancy"] for p in phcs) /
                               max(1, len(phcs)) * 100, 0) if phcs else 0,
        "personnel_shortage_pct": round((1 - emg.get("staff_multiplier", 1.0)) * 100, 0),
        "critical_phcs": crit_phcs, "logistics_capacity": max(20, 100 - crit_phcs),
    }
    affected_districts = len(set(p["district_id"] for p in phcs))
    recommendations = []
    if emg.get("active"):
        recommendations = [
            {"priority": 1, "text": "Redistribute essential medicines to critical PHCs from surplus districts."},
            {"priority": 2, "text": "Reallocate available beds and set up temporary capacity in affected districts."},
            {"priority": 3, "text": "Prioritise high-risk PHCs for immediate replenishment and staffing."},
            {"priority": 4, "text": "Deploy additional medical personnel to shortage zones."},
            {"priority": 5, "text": "Increase warehouse dispatch frequency to daily cycles."},
        ]
    return {
        "emergency": emg,
        "affected_states": [STATE_BY_CODE[c]["name"] for c in affected if c in STATE_BY_CODE],
        "affected_states_codes": affected, "affected_districts": affected_districts,
        "metrics": metrics, "recommendations": recommendations,
        "critical_alerts": [{"medicine": l["medicine"], "phc": l["phc"], "state": l["state"],
                             "risk_score": l["risk_score"]} for l in
                            sorted(enriched, key=lambda x: -x["risk_score"])[:8]],
        "scenarios": ["Disease Outbreak", "Flood", "Heatwave", "Cyclone", "Epidemic",
                      "Mass Casualty Event"],
    }


@api_router.post("/emergency-mode")
async def set_emergency(payload: EmergencyPayload):
    m = meta()
    if payload.active:
        affected = payload.affected_states or ["MH", "KA", "TN"]
        m["emergency"] = {"active": True, "scenario": payload.scenario or "Disease Outbreak",
                          "affected_states": affected, "demand_multiplier": 1.42,
                          "bed_multiplier": 1.25, "staff_multiplier": 0.88,
                          "activated_at": datetime.now(timezone.utc).isoformat()}
    else:
        m["emergency"] = {"active": False, "scenario": None, "affected_states": [],
                          "demand_multiplier": 1.0, "bed_multiplier": 1.0,
                          "staff_multiplier": 1.0, "activated_at": None}
    await save_meta()
    return _emergency_state()


@api_router.get("/simulations")
async def get_simulations():
    return {"simulations": meta().get("simulations", []),
            "available": [
                {"scenario": "patient_surge", "label": "Sudden Patient Surge"},
                {"scenario": "medicine_shortage", "label": "Medicine Shortage"},
                {"scenario": "phc_closure", "label": "PHC Closure"},
                {"scenario": "staff_shortage", "label": "Staff Shortage"},
                {"scenario": "emergency_outbreak", "label": "Emergency Outbreak"},
                {"scenario": "shipment_delay", "label": "Shipment Delay"},
            ]}


@api_router.post("/simulate")
async def simulate(payload: SimulatePayload):
    m = meta()
    mag = payload.magnitude or 1.0
    presets = {
        "patient_surge": {"demand": 1.0 + 0.35 * mag},
        "medicine_shortage": {"stock": max(0.1, 1.0 - 0.55 * mag)},
        "phc_closure": {"demand": 1.0 + 0.2 * mag, "staff": max(0.1, 1 - 0.6 * mag)},
        "staff_shortage": {"staff": max(0.2, 1.0 - 0.4 * mag)},
        "emergency_outbreak": {"demand": 1.0 + 0.45 * mag, "bed": 1.0 + 0.3 * mag},
        "shipment_delay": {"lead": 1.0 + 0.8 * mag},
    }
    labels = {"patient_surge": "Sudden Patient Surge", "medicine_shortage": "Medicine Shortage",
              "phc_closure": "PHC Closure", "staff_shortage": "Staff Shortage",
              "emergency_outbreak": "Emergency Outbreak", "shipment_delay": "Shipment Delay"}
    if payload.scenario not in presets:
        raise HTTPException(400, "Unknown scenario")
    sim = {"id": f"SIM-{int(datetime.now(timezone.utc).timestamp())}",
           "type": payload.scenario, "label": labels[payload.scenario],
           "scope": {"state_code": payload.state_code, "district_id": payload.district_id,
                     "medicine_id": payload.medicine_id},
           "scope_label": (STATE_BY_CODE[payload.state_code]["name"]
                           if payload.state_code and payload.state_code in STATE_BY_CODE else "National"),
           "multipliers": presets[payload.scenario], "magnitude": mag,
           "created": datetime.now(timezone.utc).isoformat()}
    m.setdefault("simulations", []).append(sim)
    await save_meta()
    return {"success": True, "simulation": sim,
            "message": f"Scenario '{sim['label']}' activated. Dashboards updated live."}


@api_router.post("/simulate/clear")
async def clear_simulations():
    m = meta()
    m["simulations"] = []
    await save_meta()
    return {"success": True, "message": "All active simulations cleared."}


@api_router.post("/reset")
async def reset_data():
    await seed_database(force=True)
    await load_cache()
    return {"success": True, "message": "Synthetic dataset reset."}


@api_router.get("/notifications")
async def get_notifications(category: Optional[str] = None):
    q = {} if not category else {"category": category}
    notes = await db.notifications.find(q, {"_id": 0}).sort("created_at", -1).to_list(None)
    unread = await db.notifications.count_documents({"read": False})
    return {"notifications": notes, "unread": unread}


@api_router.post("/notifications/{note_id}/read")
async def read_notification(note_id: str):
    await db.notifications.update_one({"id": note_id}, {"$set": {"read": True}})
    return {"success": True}


@api_router.post("/notifications/read-all")
async def read_all_notifications():
    await db.notifications.update_many({}, {"$set": {"read": True}})
    return {"success": True}


REPORT_TYPES = {
    "national-supply-chain": "National Supply Chain Report",
    "state-health-resource": "State Health Resource Report",
    "medicine-stock": "Medicine Stock Report",
    "stockout-risk": "Stock-Out Risk Report",
    "emergency-preparedness": "Emergency Preparedness Report",
    "ai-forecast": "AI Forecast Report",
    "resource-redistribution": "Resource Redistribution Report",
}


@api_router.get("/reports")
async def list_reports():
    return {"reports": [{"id": k, "name": v} for k, v in REPORT_TYPES.items()]}


@api_router.get("/reports/{report_type}")
async def generate_report(report_type: str, state_code: Optional[str] = None):
    if report_type not in REPORT_TYPES:
        raise HTTPException(404, "Unknown report")
    enriched = enrich_lines(DATA["inventory"])
    if state_code:
        enriched = [l for l in enriched if l["state_code"] == state_code]
    now = datetime.now(timezone.utc)
    rows = []
    columns = []
    if report_type in ("medicine-stock", "national-supply-chain"):
        columns = ["Medicine", "PHC", "District", "State", "Stock", "Daily Use", "Days Left", "Risk"]
        for l in sorted(enriched, key=lambda x: -x["risk_score"])[:200]:
            rows.append([l["medicine"], l["phc"], l["district"], l["state"],
                         l["effective_stock"], l["effective_daily_consumption"],
                         l["days_remaining"], l["risk_band"]])
    elif report_type == "stockout-risk":
        columns = ["Medicine", "PHC", "State", "Risk Score", "Days Left", "Predicted Stock-Out", "Action"]
        for l in sorted([x for x in enriched if x["risk_score"] >= 61],
                        key=lambda x: -x["risk_score"])[:200]:
            rows.append([l["medicine"], l["phc"], l["state"], l["risk_score"],
                         l["days_remaining"], l["predicted_stockout_date"], l["recommended_action"]])
    elif report_type == "state-health-resource":
        columns = ["State", "Availability %", "Avg Risk", "Critical PHCs", "PHCs"]
        by_state = {}
        for l in enriched:
            by_state.setdefault(l["state"], []).append(l)
        for k, v in by_state.items():
            rows.append([k, round(sum(1 for x in v if not x["below_reorder"]) / len(v) * 100, 1),
                         round(sum(x["risk_score"] for x in v) / len(v), 1),
                         len(set(x["phc_id"] for x in v if x["risk_band"] == "critical")),
                         len(set(x["phc_id"] for x in v))])
    elif report_type == "ai-forecast":
        columns = ["Medicine", "Category", "Trend %", "Seasonal", "Note"]
        for md in DATA["medicines"]:
            rows.append([md["name"], md["category"], round(md["trend"] * 100, 1),
                         "Yes" if md["seasonal"] else "No", "Simulated AI forecast"])
    elif report_type == "resource-redistribution":
        rec = (await resource_recommendations())["recommendations"]
        columns = ["Medicine", "Source", "Destination", "Quantity", "Distance km", "Risk Reduction"]
        for r in rec:
            rows.append([r["medicine"], r["source_phc"], r["dest_phc"],
                         r["recommended_quantity"], r["distance_km"], r["risk_reduction"]])
    elif report_type == "emergency-preparedness":
        es = _emergency_state()
        columns = ["Metric", "Value"]
        rows = [["Emergency Active", es["emergency"]["active"]],
                ["Scenario", es["emergency"].get("scenario") or "—"],
                ["Affected States", ", ".join(es["affected_states"]) or "None"],
                ["Critical PHCs", es["metrics"]["critical_phcs"]],
                ["Bed Occupancy %", es["metrics"]["bed_occupancy"]],
                ["Logistics Capacity", es["metrics"]["logistics_capacity"]]]
    return {"report_type": report_type, "name": REPORT_TYPES[report_type],
            "generated_at": now.isoformat(), "columns": columns, "rows": rows,
            "row_count": len(rows)}


@api_router.get("/reports/{report_type}/csv")
async def report_csv(report_type: str, state_code: Optional[str] = None):
    data = await generate_report(report_type, state_code)
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(data["columns"])
    for r in data["rows"]:
        w.writerow(r)
    return PlainTextResponse(buf.getvalue(), media_type="text/csv",
                             headers={"Content-Disposition": f"attachment; filename={report_type}.csv"})


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await seed_database()
    await load_cache()
    logger.info("Startup complete: %d PHCs, %d inventory lines",
                len(DATA["phcs"]), len(DATA["inventory"]))


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
