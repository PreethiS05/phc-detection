"""
Derived computations for the platform: risk scoring, forecasting,
and reversible emergency / simulation multipliers.

Prototype-only. AI outputs are deterministic simulations, clearly labelled.
"""
import math
import random
from datetime import datetime, timezone, timedelta


# ---------------------------------------------------------------------------
# Multiplier resolution (emergency + active simulations) — non-destructive
# ---------------------------------------------------------------------------
def _sim_applies(sim, state_code, district_id, medicine_id):
    sc = sim.get("scope", {})
    if sc.get("state_code") and sc["state_code"] != state_code:
        return False
    if sc.get("district_id") and sc["district_id"] != district_id:
        return False
    if sc.get("medicine_id") and sc["medicine_id"] != medicine_id:
        return False
    return True


def resolve_multipliers(meta, state_code, district_id=None, medicine_id=None):
    demand = 1.0
    stock = 1.0
    lead = 1.0
    staff = 1.0
    bed = 1.0
    emg = meta.get("emergency", {})
    if emg.get("active") and state_code in emg.get("affected_states", []):
        demand *= emg.get("demand_multiplier", 1.0)
        staff *= emg.get("staff_multiplier", 1.0)
        bed *= emg.get("bed_multiplier", 1.0)
    for sim in meta.get("simulations", []):
        if _sim_applies(sim, state_code, district_id, medicine_id):
            m = sim.get("multipliers", {})
            demand *= m.get("demand", 1.0)
            stock *= m.get("stock", 1.0)
            lead *= m.get("lead", 1.0)
            staff *= m.get("staff", 1.0)
            bed *= m.get("bed", 1.0)
    return {"demand": demand, "stock": stock, "lead": lead, "staff": staff, "bed": bed}


# ---------------------------------------------------------------------------
# Risk scoring for an inventory line
# ---------------------------------------------------------------------------
def risk_band(score):
    if score >= 81:
        return "critical"
    if score >= 61:
        return "high"
    if score >= 31:
        return "moderate"
    return "low"


def compute_line(inv, meta, medicine_trend=0.0):
    """Return an enriched inventory line with derived, multiplier-adjusted metrics."""
    mult = resolve_multipliers(meta, inv["state_code"], inv["district_id"], inv["medicine_id"])
    consumption = max(1.0, inv["daily_consumption"] * mult["demand"])
    stock = max(0.0, inv["current_stock"] * mult["stock"])
    lead = inv["lead_time_days"] * mult["lead"]
    coverage = stock / consumption

    # Risk = f(coverage vs replenishment need, demand trend, emergency surge)
    buffer_target = max(lead * 2.2, 9.0)
    base = (buffer_target - coverage) / buffer_target * 82.0
    trend_comp = medicine_trend * 55.0
    surge_comp = (mult["demand"] - 1.0) * 50.0
    # steep penalty when coverage cannot outlast replenishment lead time
    lead_gap = 0.0
    if coverage < lead:
        lead_gap = min(22.0, (lead - coverage) / max(1.0, lead) * 30.0)
    score = base + trend_comp + surge_comp + lead_gap
    score = max(0.0, min(100.0, score))

    now = datetime.now(timezone.utc)
    stockout_date = (now + timedelta(days=coverage)).date().isoformat()
    band = risk_band(score)

    # demand surge probability (0-1), higher with trend + emergency
    surge_prob = min(0.98, 0.15 + medicine_trend * 4 + (mult["demand"] - 1.0) * 0.8)

    if band == "critical":
        action = "Immediate inter-district transfer required"
    elif band == "high":
        action = "Raise priority replenishment order"
    elif band == "moderate":
        action = "Schedule reorder within lead time"
    else:
        action = "Monitor — stock healthy"

    return {
        **{k: v for k, v in inv.items() if k != "seed"},
        "effective_stock": int(round(stock)),
        "effective_daily_consumption": int(round(consumption)),
        "effective_lead_days": round(lead, 1),
        "days_remaining": round(coverage, 1),
        "risk_score": int(round(score)),
        "risk_band": band,
        "predicted_stockout_date": stockout_date,
        "surge_probability": round(surge_prob, 2),
        "recommended_action": action,
        "below_reorder": stock < inv["reorder_level"],
    }


def explain_risk(line):
    """Human-readable rationale for a risk score (labelled AI-generated)."""
    return (f"Stock-out risk is {line['risk_band'].upper()} because current inventory covers only "
            f"{line['days_remaining']} days of demand at {line['effective_daily_consumption']} "
            f"{line['unit']}/day, while the expected replenishment lead time is "
            f"{line['effective_lead_days']} days. "
            f"Demand-surge probability is estimated at {int(line['surge_probability']*100)}%.")


# ---------------------------------------------------------------------------
# Deterministic forecast series
# ---------------------------------------------------------------------------
def build_forecast(base_daily, seed, trend, seasonal, horizon, demand_mult=1.0):
    rng = random.Random(seed)
    now = datetime.now(timezone.utc)
    hist_days = 30
    history = []
    for d in range(hist_days, 0, -1):
        day = now - timedelta(days=d)
        season = 1.0
        if seasonal:
            season = 1.0 + 0.18 * math.sin((day.timetuple().tm_yday / 365.0) * 2 * math.pi)
        noise = 1.0 + rng.uniform(-0.08, 0.08)
        val = base_daily * season * noise
        history.append({"date": day.date().isoformat(), "value": int(round(val))})

    current = history[-1]["value"]
    daily_growth = (trend / 30.0)
    predicted = []
    for d in range(1, horizon + 1):
        day = now + timedelta(days=d)
        season = 1.0
        if seasonal:
            season = 1.0 + 0.18 * math.sin((day.timetuple().tm_yday / 365.0) * 2 * math.pi)
        growth = (1 + daily_growth) ** d
        val = base_daily * season * growth * demand_mult
        ci = val * (0.06 + 0.004 * d)
        predicted.append({
            "date": day.date().isoformat(),
            "value": int(round(val)),
            "lower": int(round(val - ci)),
            "upper": int(round(val + ci)),
        })

    pred_end = predicted[-1]["value"]
    pred_daily_avg = int(round(sum(p["value"] for p in predicted) / len(predicted)))
    confidence = round(max(0.78, 0.96 - horizon * 0.0006 - trend * 0.4), 2)
    expected_increase = round((pred_daily_avg - current) / max(1, current) * 100, 1)
    return {
        "history": history,
        "predicted": predicted,
        "current_daily_demand": current,
        "predicted_daily_demand": pred_daily_avg,
        "peak_predicted_demand": pred_end,
        "confidence": confidence,
        "expected_increase_pct": expected_increase,
    }


def sparkline(seed, end_value, points=12, volatility=0.06, trend=0.0):
    rng = random.Random(seed)
    vals = []
    v = end_value / ((1 + trend) ** points)
    for i in range(points):
        v = v * (1 + trend) * (1 + rng.uniform(-volatility, volatility))
        vals.append(round(v, 2))
    vals[-1] = end_value
    return [{"i": i, "v": vals[i]} for i in range(points)]
