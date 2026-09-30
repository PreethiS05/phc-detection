"""Backend API tests for Smart Health & Supply Chain Resilience."""
import os
import pytest
import requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / '.env')
FRONTEND_ENV = Path(__file__).resolve().parents[2] / 'frontend' / '.env'
load_dotenv(FRONTEND_ENV, override=True)

BASE_URL = os.environ['REACT_APP_BACKEND_URL'].rstrip('/') + '/api'


@pytest.fixture(scope="session")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---- Health / root ----
def test_root(client):
    r = client.get(f"{BASE_URL}/", timeout=30)
    assert r.status_code == 200
    assert r.json().get("status") == "ok"


# ---- Dashboard ----
def test_dashboard(client):
    r = client.get(f"{BASE_URL}/dashboard", timeout=60)
    assert r.status_code == 200
    d = r.json()
    assert len(d["kpis"]) == 6
    assert d["states_connected"] > 0
    assert d["phcs_monitored"] > 0
    assert "top_risk_states" in d
    assert "recent_alerts" in d
    keys = {k["key"] for k in d["kpis"]}
    assert "medicine_availability" in keys
    assert "critical_stockout_phcs" in keys


# ---- States ----
def test_states_default(client):
    r = client.get(f"{BASE_URL}/states", timeout=60)
    assert r.status_code == 200
    d = r.json()
    assert d["metric"] == "risk"
    assert len(d["states"]) >= 30
    st = d["states"][0]
    for k in ("code", "name", "lat", "lng", "severity", "metric_value"):
        assert k in st


@pytest.mark.parametrize("metric", ["risk", "availability", "beds", "footfall", "personnel", "utilisation", "emergency"])
def test_states_metric(client, metric):
    r = client.get(f"{BASE_URL}/states", params={"metric": metric}, timeout=60)
    assert r.status_code == 200
    assert r.json()["metric"] == metric


def test_state_detail(client):
    states = client.get(f"{BASE_URL}/states", timeout=60).json()["states"]
    code = states[0]["code"]
    r = client.get(f"{BASE_URL}/states/{code}", timeout=60)
    assert r.status_code == 200
    d = r.json()
    assert d["code"] == code
    assert "demand_forecast" in d


def test_state_detail_404(client):
    r = client.get(f"{BASE_URL}/states/ZZ", timeout=30)
    assert r.status_code == 404


# ---- Districts ----
def test_districts(client):
    r = client.get(f"{BASE_URL}/districts", timeout=60)
    assert r.status_code == 200
    assert len(r.json()["districts"]) > 0


# ---- PHCs ----
def test_phcs_paginated(client):
    r = client.get(f"{BASE_URL}/phcs", params={"page": 1, "limit": 20}, timeout=60)
    assert r.status_code == 200
    d = r.json()
    assert d["page"] == 1 and d["limit"] == 20
    assert len(d["phcs"]) <= 20
    assert d["total"] > 0


def test_phcs_filter_search(client):
    r = client.get(f"{BASE_URL}/phcs", params={"q": "PHC"}, timeout=60)
    assert r.status_code == 200


def test_phc_detail(client):
    phcs = client.get(f"{BASE_URL}/phcs", params={"limit": 1}, timeout=60).json()["phcs"]
    pid = phcs[0]["id"]
    r = client.get(f"{BASE_URL}/phcs/{pid}", timeout=60)
    assert r.status_code == 200
    d = r.json()
    assert d["id"] == pid
    assert "kpis" in d and "charts" in d and "inventory" in d and "recommendations" in d
    assert set(d["charts"].keys()) >= {"footfall", "consumption", "occupancy", "attendance"}


def test_phc_detail_404(client):
    r = client.get(f"{BASE_URL}/phcs/NOPE", timeout=30)
    assert r.status_code == 404


# ---- Medicines ----
def test_medicines(client):
    r = client.get(f"{BASE_URL}/medicines", timeout=30)
    assert r.status_code == 200
    assert len(r.json()["medicines"]) > 0


# ---- Inventory ----
def test_inventory(client):
    r = client.get(f"{BASE_URL}/inventory", params={"page": 1, "limit": 25}, timeout=60)
    assert r.status_code == 200
    d = r.json()
    assert d["total"] > 0
    assert len(d["inventory"]) <= 25
    row = d["inventory"][0]
    # Check days_remaining ~ stock / daily
    if row["effective_daily_consumption"] > 0:
        expected = row["effective_stock"] / row["effective_daily_consumption"]
        assert abs(row["days_remaining"] - expected) <= max(2, 0.1 * expected)


def test_inventory_risk_filter(client):
    r = client.get(f"{BASE_URL}/inventory", params={"risk": "critical", "limit": 10}, timeout=60)
    assert r.status_code == 200
    for l in r.json()["inventory"]:
        assert l["risk_band"] == "critical"


def test_inventory_charts(client):
    r = client.get(f"{BASE_URL}/inventory/charts", timeout=60)
    assert r.status_code == 200
    d = r.json()
    for k in ("trend", "consumption", "expiry", "distribution", "risk_distribution"):
        assert k in d and len(d[k]) > 0


# ---- Forecast ----
@pytest.mark.parametrize("horizon", [7, 14, 30, 90])
def test_forecast(client, horizon):
    meds = client.get(f"{BASE_URL}/medicines", timeout=30).json()["medicines"]
    mid = meds[0]["id"]
    r = client.get(f"{BASE_URL}/forecast", params={"medicine_id": mid, "horizon": horizon}, timeout=60)
    assert r.status_code == 200
    d = r.json()
    assert d["horizon"] == horizon
    assert "predicted_daily_demand" in d
    assert "confidence" in d


def test_forecast_bad_medicine(client):
    r = client.get(f"{BASE_URL}/forecast", params={"medicine_id": "NOPE"}, timeout=30)
    assert r.status_code == 404


# ---- Alerts ----
def test_alerts(client):
    r = client.get(f"{BASE_URL}/alerts", timeout=60)
    assert r.status_code == 200
    d = r.json()
    assert "counts" in d and "alerts" in d
    assert set(d["counts"].keys()) >= {"critical", "high", "moderate"}


# ---- Resource recommendations & transfer ----
def test_resource_recommendations(client):
    r = client.get(f"{BASE_URL}/resource-recommendations", timeout=60)
    assert r.status_code == 200
    recs = r.json()["recommendations"]
    assert isinstance(recs, list)


def test_resource_transfer_approve(client):
    recs = client.get(f"{BASE_URL}/resource-recommendations", timeout=60).json()["recommendations"]
    if not recs:
        pytest.skip("no recs")
    rec = recs[0]
    payload = {
        "recommendation_id": rec["id"],
        "source_phc_id": rec["source_phc_id"],
        "dest_phc_id": rec["dest_phc_id"],
        "medicine_id": rec["medicine_id"],
        "quantity": rec["recommended_quantity"],
        "action": "approve",
    }
    r = client.post(f"{BASE_URL}/resource-transfer", json=payload, timeout=60)
    assert r.status_code == 200
    d = r.json()
    assert d["success"] is True
    assert d["status"] == "approved"


# ---- Supply chain ----
def test_supply_chain(client):
    r = client.get(f"{BASE_URL}/supply-chain", timeout=60)
    assert r.status_code == 200
    d = r.json()
    assert len(d["stages"]) == 6
    assert "table" in d and "suppliers" in d and "shipments" in d


# ---- Federated ----
def test_federated_model(client):
    r = client.get(f"{BASE_URL}/federated-model", timeout=60)
    assert r.status_code == 200
    d = r.json()
    assert "model" in d and "nodes" in d and "convergence" in d


def test_federated_training(client):
    before = client.get(f"{BASE_URL}/federated-model", timeout=60).json()["model"]["round"]
    r = client.post(f"{BASE_URL}/federated-training", timeout=60)
    assert r.status_code == 200
    after = r.json()["model"]["round"]
    assert after == before + 1


# ---- Analytics ----
@pytest.mark.parametrize("days", [7, 30, 90])
def test_analytics(client, days):
    r = client.get(f"{BASE_URL}/analytics", params={"range_days": days}, timeout=60)
    assert r.status_code == 200
    d = r.json()
    assert d["range_days"] == days
    assert len(d["resource_utilisation"]) == days
    assert "heatmap" in d and len(d["heatmap"]) > 0


# ---- Emergency ----
def test_emergency_activate_deactivate(client):
    r = client.post(f"{BASE_URL}/emergency-mode",
                    json={"active": True, "scenario": "Flood", "affected_states": ["MH", "KA"]}, timeout=60)
    assert r.status_code == 200
    d = r.json()
    assert d["emergency"]["active"] is True
    assert set(d["affected_states_codes"]) == {"MH", "KA"}
    # Deactivate
    r2 = client.post(f"{BASE_URL}/emergency-mode", json={"active": False}, timeout=60)
    assert r2.status_code == 200
    assert r2.json()["emergency"]["active"] is False


# ---- Simulations ----
def test_simulate_and_clear(client):
    r = client.post(f"{BASE_URL}/simulate", json={"scenario": "patient_surge", "magnitude": 1.0}, timeout=60)
    assert r.status_code == 200
    assert r.json()["success"] is True
    r2 = client.get(f"{BASE_URL}/simulations", timeout=30)
    assert r2.status_code == 200
    assert len(r2.json()["simulations"]) >= 1
    r3 = client.post(f"{BASE_URL}/simulate/clear", timeout=30)
    assert r3.status_code == 200


def test_simulate_bad_scenario(client):
    r = client.post(f"{BASE_URL}/simulate", json={"scenario": "nope"}, timeout=30)
    assert r.status_code == 400


# ---- Notifications ----
def test_notifications(client):
    r = client.get(f"{BASE_URL}/notifications", timeout=30)
    assert r.status_code == 200
    d = r.json()
    assert "notifications" in d and "unread" in d
    if d["notifications"]:
        nid = d["notifications"][0]["id"]
        r2 = client.post(f"{BASE_URL}/notifications/{nid}/read", timeout=30)
        assert r2.status_code == 200
    r3 = client.post(f"{BASE_URL}/notifications/read-all", timeout=30)
    assert r3.status_code == 200


# ---- Reports ----
def test_reports_list(client):
    r = client.get(f"{BASE_URL}/reports", timeout=30)
    assert r.status_code == 200
    assert len(r.json()["reports"]) >= 5


@pytest.mark.parametrize("rtype", [
    "national-supply-chain", "state-health-resource", "medicine-stock",
    "stockout-risk", "emergency-preparedness", "ai-forecast", "resource-redistribution",
])
def test_report_generate(client, rtype):
    r = client.get(f"{BASE_URL}/reports/{rtype}", timeout=90)
    assert r.status_code == 200
    d = r.json()
    assert d["report_type"] == rtype
    assert "columns" in d and "rows" in d


def test_report_csv(client):
    r = client.get(f"{BASE_URL}/reports/medicine-stock/csv", timeout=90)
    assert r.status_code == 200
    assert "text/csv" in r.headers.get("content-type", "")
    assert r.text.count("\n") > 1


# ---- Reset (last, since it re-seeds; keep at end) ----
def test_zz_reset(client):
    r = client.post(f"{BASE_URL}/reset", timeout=120)
    assert r.status_code == 200
    assert r.json()["success"] is True
