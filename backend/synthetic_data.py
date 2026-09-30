"""
Deterministic synthetic data generator for the
SMART HEALTH & SUPPLY CHAIN RESILIENCE platform.

All numbers are internally consistent (stock / daily_consumption ~= days remaining).
No real patient data is used. Purely synthetic, prototype-only.
"""
import math
import random
from datetime import datetime, timezone, timedelta

SEED = 20260601

# ---------------------------------------------------------------------------
# States / UTs with approximate geographic centroids and a pool of real districts
# ---------------------------------------------------------------------------
STATES = [
    {"code": "MH", "name": "Maharashtra", "lat": 19.75, "lng": 75.71,
     "districts": ["Pune", "Mumbai Suburban", "Nagpur", "Nashik", "Aurangabad"]},
    {"code": "KA", "name": "Karnataka", "lat": 15.32, "lng": 75.71,
     "districts": ["Bengaluru North", "Bengaluru South", "Mysuru", "Belagavi", "Kalaburagi"]},
    {"code": "TN", "name": "Tamil Nadu", "lat": 11.13, "lng": 78.66,
     "districts": ["Chennai", "Coimbatore", "Madurai", "Salem", "Tiruchirappalli"]},
    {"code": "KL", "name": "Kerala", "lat": 10.85, "lng": 76.27,
     "districts": ["Thiruvananthapuram", "Ernakulam", "Kozhikode", "Thrissur"]},
    {"code": "TG", "name": "Telangana", "lat": 17.85, "lng": 79.11,
     "districts": ["Hyderabad", "Warangal", "Karimnagar", "Nizamabad"]},
    {"code": "UP", "name": "Uttar Pradesh", "lat": 26.85, "lng": 80.94,
     "districts": ["Lucknow", "Kanpur Nagar", "Varanasi", "Gorakhpur", "Meerut"]},
    {"code": "GJ", "name": "Gujarat", "lat": 22.26, "lng": 71.19,
     "districts": ["Ahmedabad", "Surat", "Vadodara", "Rajkot"]},
    {"code": "RJ", "name": "Rajasthan", "lat": 27.02, "lng": 74.22,
     "districts": ["Jaipur", "Jodhpur", "Udaipur", "Kota"]},
    {"code": "WB", "name": "West Bengal", "lat": 22.99, "lng": 87.85,
     "districts": ["Kolkata", "Howrah", "Darjeeling", "Murshidabad"]},
    {"code": "MP", "name": "Madhya Pradesh", "lat": 22.97, "lng": 78.66,
     "districts": ["Bhopal", "Indore", "Jabalpur", "Gwalior"]},
    {"code": "BR", "name": "Bihar", "lat": 25.10, "lng": 85.31,
     "districts": ["Patna", "Gaya", "Muzaffarpur", "Bhagalpur"]},
    {"code": "OD", "name": "Odisha", "lat": 20.95, "lng": 85.10,
     "districts": ["Khordha", "Cuttack", "Ganjam", "Sundargarh"]},
    {"code": "PB", "name": "Punjab", "lat": 31.15, "lng": 75.34,
     "districts": ["Ludhiana", "Amritsar", "Jalandhar", "Patiala"]},
    {"code": "HR", "name": "Haryana", "lat": 29.06, "lng": 76.09,
     "districts": ["Gurugram", "Faridabad", "Hisar", "Karnal"]},
    {"code": "AS", "name": "Assam", "lat": 26.20, "lng": 92.94,
     "districts": ["Kamrup Metropolitan", "Dibrugarh", "Cachar", "Nagaon"]},
    {"code": "JH", "name": "Jharkhand", "lat": 23.61, "lng": 85.28,
     "districts": ["Ranchi", "Dhanbad", "Jamshedpur", "Bokaro"]},
    {"code": "CT", "name": "Chhattisgarh", "lat": 21.28, "lng": 81.87,
     "districts": ["Raipur", "Durg", "Bilaspur", "Bastar"]},
    {"code": "UK", "name": "Uttarakhand", "lat": 30.07, "lng": 79.02,
     "districts": ["Dehradun", "Haridwar", "Nainital"]},
    {"code": "HP", "name": "Himachal Pradesh", "lat": 31.10, "lng": 77.17,
     "districts": ["Shimla", "Kangra", "Mandi"]},
    {"code": "GA", "name": "Goa", "lat": 15.30, "lng": 74.12,
     "districts": ["North Goa", "South Goa"]},
    {"code": "TR", "name": "Tripura", "lat": 23.94, "lng": 91.99,
     "districts": ["West Tripura", "Gomati"]},
    {"code": "ML", "name": "Meghalaya", "lat": 25.47, "lng": 91.37,
     "districts": ["East Khasi Hills", "West Garo Hills"]},
    {"code": "MN", "name": "Manipur", "lat": 24.66, "lng": 93.91,
     "districts": ["Imphal West", "Imphal East"]},
    {"code": "NL", "name": "Nagaland", "lat": 26.16, "lng": 94.56,
     "districts": ["Kohima", "Dimapur"]},
    {"code": "MZ", "name": "Mizoram", "lat": 23.16, "lng": 92.94,
     "districts": ["Aizawl", "Lunglei"]},
    {"code": "AR", "name": "Arunachal Pradesh", "lat": 28.22, "lng": 94.73,
     "districts": ["Papum Pare", "Lower Subansiri"]},
    {"code": "SK", "name": "Sikkim", "lat": 27.53, "lng": 88.51,
     "districts": ["Gangtok", "Namchi"]},
    {"code": "DL", "name": "Delhi (NCT)", "lat": 28.70, "lng": 77.10,
     "districts": ["New Delhi", "North Delhi", "South Delhi"]},
    {"code": "JK", "name": "Jammu & Kashmir", "lat": 33.78, "lng": 76.58,
     "districts": ["Srinagar", "Jammu", "Baramulla"]},
    {"code": "LA", "name": "Ladakh", "lat": 34.15, "lng": 77.58,
     "districts": ["Leh", "Kargil"]},
    {"code": "AN", "name": "Andaman & Nicobar", "lat": 11.74, "lng": 92.65,
     "districts": ["South Andaman", "Nicobar"]},
    {"code": "PY", "name": "Puducherry", "lat": 11.94, "lng": 79.80,
     "districts": ["Puducherry", "Karaikal"]},
    {"code": "CH", "name": "Chandigarh", "lat": 30.73, "lng": 76.78,
     "districts": ["Chandigarh"]},
    {"code": "DN", "name": "Dadra & Nagar Haveli", "lat": 20.27, "lng": 73.02,
     "districts": ["Silvassa"]},
    {"code": "LD", "name": "Lakshadweep", "lat": 10.57, "lng": 72.64,
     "districts": ["Kavaratti"]},
    {"code": "AP", "name": "Andhra Pradesh", "lat": 15.91, "lng": 79.74,
     "districts": ["Visakhapatnam", "Vijayawada", "Guntur", "Tirupati"]},
]

DIRECTIONS = ["Central", "North", "South", "East", "West", "Rural", "Urban", "Sector 4", "Zone II", "Township"]

# ---------------------------------------------------------------------------
# Medicines & medical supplies (realistic, 50+)
# ---------------------------------------------------------------------------
# trend = structural demand growth factor; seasonal = weather/epidemic sensitive
MEDICINES = [
    ("Paracetamol 500mg", "Analgesic/Antipyretic", "tablets", True, 0.05, True, False),
    ("Amoxicillin 250mg", "Antibiotic", "capsules", True, 0.03, True, False),
    ("Azithromycin 500mg", "Antibiotic", "tablets", True, 0.06, True, False),
    ("Ciprofloxacin 500mg", "Antibiotic", "tablets", True, 0.02, False, False),
    ("Doxycycline 100mg", "Antibiotic", "capsules", False, 0.01, False, False),
    ("Metronidazole 400mg", "Antibiotic", "tablets", True, 0.01, False, False),
    ("Ceftriaxone 1g Injection", "Antibiotic", "vials", True, 0.04, False, True),
    ("Insulin (Human) 40IU", "Antidiabetic", "vials", True, 0.08, False, True),
    ("Metformin 500mg", "Antidiabetic", "tablets", True, 0.05, False, False),
    ("Glimepiride 2mg", "Antidiabetic", "tablets", False, 0.02, False, False),
    ("ORS Sachets", "Rehydration", "sachets", True, 0.09, True, False),
    ("IV Fluids (Normal Saline)", "IV Fluid", "bottles", True, 0.07, True, False),
    ("IV Fluids (Ringer Lactate)", "IV Fluid", "bottles", True, 0.06, True, False),
    ("Dextrose 5% IV", "IV Fluid", "bottles", True, 0.04, False, False),
    ("Chloroquine 250mg", "Antimalarial", "tablets", False, 0.03, True, False),
    ("Artemisinin Combination (ACT)", "Antimalarial", "tablets", True, 0.05, True, False),
    ("Primaquine 7.5mg", "Antimalarial", "tablets", False, 0.02, True, False),
    ("Oseltamivir 75mg", "Antiviral", "capsules", True, 0.10, True, False),
    ("Acyclovir 400mg", "Antiviral", "tablets", False, 0.01, False, False),
    ("BCG Vaccine", "Vaccine", "doses", True, 0.03, False, True),
    ("Measles-Rubella Vaccine", "Vaccine", "doses", True, 0.04, True, True),
    ("Pentavalent Vaccine", "Vaccine", "doses", True, 0.03, False, True),
    ("Oral Polio Vaccine", "Vaccine", "doses", True, 0.02, False, True),
    ("Tetanus Toxoid", "Vaccine", "doses", True, 0.02, False, True),
    ("Rabies Vaccine", "Vaccine", "doses", True, 0.05, True, True),
    ("Snake Antivenom (Polyvalent)", "Emergency", "vials", True, 0.06, True, True),
    ("Adrenaline Injection", "Emergency", "ampoules", True, 0.03, False, True),
    ("Atropine Injection", "Emergency", "ampoules", False, 0.01, False, True),
    ("Diazepam Injection", "Emergency", "ampoules", False, 0.02, False, True),
    ("Hydrocortisone Injection", "Emergency", "vials", True, 0.02, False, True),
    ("Salbutamol Inhaler", "Respiratory", "units", True, 0.05, True, False),
    ("Budesonide Inhaler", "Respiratory", "units", True, 0.04, True, False),
    ("Aminophylline Injection", "Respiratory", "ampoules", False, 0.01, True, True),
    ("Amlodipine 5mg", "Cardiovascular", "tablets", True, 0.04, False, False),
    ("Atenolol 50mg", "Cardiovascular", "tablets", False, 0.02, False, False),
    ("Aspirin 75mg", "Cardiovascular", "tablets", True, 0.03, False, False),
    ("Atorvastatin 10mg", "Cardiovascular", "tablets", True, 0.05, False, False),
    ("Enalapril 5mg", "Cardiovascular", "tablets", False, 0.02, False, False),
    ("Iron & Folic Acid", "Maternal", "tablets", True, 0.04, False, False),
    ("Oxytocin Injection", "Maternal", "ampoules", True, 0.03, False, True),
    ("Misoprostol 200mcg", "Maternal", "tablets", True, 0.03, False, False),
    ("Magnesium Sulphate Inj", "Maternal", "vials", True, 0.02, False, True),
    ("Calcium Gluconate", "Supplement", "tablets", False, 0.02, False, False),
    ("Vitamin A Solution", "Supplement", "bottles", True, 0.02, True, False),
    ("Zinc Sulphate", "Supplement", "tablets", True, 0.05, True, False),
    ("PPE Kits", "PPE", "kits", True, 0.12, True, False),
    ("N95 Respirator Masks", "PPE", "units", True, 0.11, True, False),
    ("Surgical Gloves", "PPE", "pairs", True, 0.08, False, False),
    ("Hand Sanitiser 500ml", "PPE", "bottles", True, 0.06, True, False),
    ("Disposable Syringes 5ml", "Consumable", "units", True, 0.05, False, False),
    ("IV Cannula 18G", "Consumable", "units", True, 0.04, False, False),
    ("Sterile Gauze Pads", "Consumable", "packs", True, 0.03, False, False),
]

WAREHOUSE_LEVELS = ["Central Warehouse", "State Warehouse", "District Warehouse"]
SUPPLIERS = ["Bharat Pharma Ltd", "MedCore Industries", "Cipla Distribution", "Sun Supply Co",
             "Zydus Logistics", "HLL Lifecare", "Karnataka Antibiotics", "IDPL Public Sector"]


def _slug(s):
    return "".join(c for c in s.upper() if c.isalnum())[:4]


def generate_dataset():
    rng = random.Random(SEED)
    now = datetime.now(timezone.utc)

    medicines = []
    for i, (name, cat, unit, essential, trend, seasonal, cold) in enumerate(MEDICINES):
        medicines.append({
            "id": f"MED-{i+1:03d}",
            "name": name,
            "category": cat,
            "unit": unit,
            "is_essential": essential,
            "trend": trend,
            "seasonal": seasonal,
            "cold_chain": cold,
            "base_price": round(rng.uniform(2, 320), 2),
        })

    states = []
    districts = []
    phcs = []
    inventory = []
    shipments = []

    essential_ids = [m["id"] for m in medicines if m["is_essential"]]
    all_ids = [m["id"] for m in medicines]
    med_by_id = {m["id"]: m for m in medicines}

    phc_counter = 0
    for st in STATES:
        st_districts = st["districts"]
        states.append({
            "id": st["code"],
            "code": st["code"],
            "name": st["name"],
            "lat": st["lat"],
            "lng": st["lng"],
            "district_count": len(st_districts),
        })
        for di, dname in enumerate(st_districts):
            dcode = f"{st['code']}-{_slug(dname)}"
            dlat = st["lat"] + rng.uniform(-1.1, 1.1)
            dlng = st["lng"] + rng.uniform(-1.1, 1.1)
            n_phc = rng.randint(3, 6)
            districts.append({
                "id": dcode,
                "name": dname,
                "state_code": st["code"],
                "state": st["name"],
                "lat": dlat,
                "lng": dlng,
                "phc_count": n_phc,
            })
            for pi in range(n_phc):
                phc_counter += 1
                direction = DIRECTIONS[pi % len(DIRECTIONS)]
                pcode = f"PHC-{st['code']}-{_slug(dname)}-{pi+1:03d}"
                pname = f"{dname} {direction} PHC"
                population = rng.randint(18000, 96000)
                beds_total = rng.randint(6, 60)
                occ_rate = rng.uniform(0.45, 0.95)
                beds_occupied = int(beds_total * occ_rate)
                staff_total = rng.randint(8, 42)
                attendance = rng.uniform(0.78, 0.98)
                staff_present = int(staff_total * attendance)
                patients_today = int(population * rng.uniform(0.002, 0.006))
                footfall_month = int(patients_today * rng.uniform(24, 30))
                resource_util = round(rng.uniform(0.55, 0.94), 3)
                plat = dlat + rng.uniform(-0.35, 0.35)
                plng = dlng + rng.uniform(-0.35, 0.35)
                phc = {
                    "id": pcode,
                    "code": pcode,
                    "name": pname,
                    "district_id": dcode,
                    "district": dname,
                    "state_code": st["code"],
                    "state": st["name"],
                    "lat": plat,
                    "lng": plng,
                    "population_served": population,
                    "beds_total": beds_total,
                    "beds_occupied": beds_occupied,
                    "staff_total": staff_total,
                    "staff_present": staff_present,
                    "patients_today": patients_today,
                    "footfall_month": footfall_month,
                    "resource_utilisation": resource_util,
                    "status": "online",
                    "last_sync_min": rng.randint(1, 45),
                }
                phcs.append(phc)

                # Inventory lines: all essential + a random subset of others
                med_subset = list(essential_ids)
                non_essential = [m for m in all_ids if m not in essential_ids]
                extra = rng.sample(non_essential, k=min(len(non_essential), rng.randint(4, 12)))
                med_subset += extra
                scale = population / 40000.0
                for mid in med_subset:
                    med = med_by_id[mid]
                    base_daily = rng.uniform(20, 240) * scale
                    daily = max(1, int(base_daily))
                    # coverage days distribution -> some critical, some healthy
                    coverage = rng.choices(
                        [rng.uniform(2, 6), rng.uniform(6, 12), rng.uniform(12, 25),
                         rng.uniform(25, 60)],
                        weights=[0.12, 0.23, 0.35, 0.30])[0]
                    stock = int(daily * coverage)
                    reorder = int(daily * rng.uniform(7, 14))
                    lead = rng.randint(3, 10)
                    expiry_days = rng.choice(
                        [rng.randint(20, 90), rng.randint(90, 365), rng.randint(365, 720)])
                    inventory.append({
                        "id": f"INV-{len(inventory)+1:06d}",
                        "phc_id": pcode,
                        "phc": pname,
                        "district_id": dcode,
                        "district": dname,
                        "state_code": st["code"],
                        "state": st["name"],
                        "medicine_id": mid,
                        "medicine": med["name"],
                        "category": med["category"],
                        "unit": med["unit"],
                        "batch_id": f"B{rng.randint(100000, 999999)}",
                        "current_stock": stock,
                        "reorder_level": reorder,
                        "daily_consumption": daily,
                        "lead_time_days": lead,
                        "expiry_date": (now + timedelta(days=expiry_days)).date().isoformat(),
                        "cold_chain": med["cold_chain"],
                        "seed": rng.randint(1, 10 ** 9),
                    })

    # Incoming shipments for a subset of low-stock lines
    low_lines = [i for i in inventory
                 if i["current_stock"] / max(1, i["daily_consumption"]) < 14]
    for line in rng.sample(low_lines, k=min(400, len(low_lines))):
        eta_days = rng.randint(1, 12)
        shipments.append({
            "id": f"SHP-{len(shipments)+1:05d}",
            "medicine_id": line["medicine_id"],
            "medicine": line["medicine"],
            "phc_id": line["phc_id"],
            "phc": line["phc"],
            "district": line["district"],
            "state": line["state"],
            "state_code": line["state_code"],
            "quantity": int(line["reorder_level"] * rng.uniform(1.5, 3)),
            "origin": rng.choice(WAREHOUSE_LEVELS),
            "supplier": rng.choice(SUPPLIERS),
            "eta_days": eta_days,
            "eta_date": (now + timedelta(days=eta_days)).date().isoformat(),
            "status": rng.choice(["Dispatched", "In Transit", "In Transit", "Loading"]),
            "cold_chain": line["cold_chain"],
        })

    # Federated learning nodes (one per state) — SIMULATED training
    nodes = []
    for st in states:
        nodes.append({
            "id": st["code"],
            "state": st["name"],
            "state_code": st["code"],
            "status": rng.choices(["active", "active", "training", "idle"],
                                  weights=[0.55, 0.2, 0.15, 0.10])[0],
            "last_update_min": rng.randint(2, 240),
            "data_volume": rng.randint(120000, 4200000),
            "accuracy": round(rng.uniform(0.86, 0.955), 4),
            "model_version": f"v3.{rng.randint(0, 4)}",
            "epochs": rng.randint(4, 22),
            "epsilon": round(rng.uniform(0.8, 3.5), 2),
        })

    suppliers = []
    for s in SUPPLIERS:
        suppliers.append({
            "name": s,
            "on_time_rate": round(rng.uniform(0.72, 0.98), 3),
            "avg_lead_days": round(rng.uniform(3, 9), 1),
            "fulfilment_rate": round(rng.uniform(0.80, 0.99), 3),
            "quality_score": round(rng.uniform(0.85, 0.99), 3),
            "active_orders": rng.randint(4, 60),
        })

    meta = {
        "id": "meta",
        "last_sync": now.isoformat(),
        "emergency": {"active": False, "scenario": None, "affected_states": [],
                      "demand_multiplier": 1.0, "bed_multiplier": 1.0,
                      "staff_multiplier": 1.0, "activated_at": None},
        "simulations": [],
        "model": {"name": "Demand Forecast", "version": "v3.4", "round": 18,
                  "aggregation_status": "Completed", "global_accuracy": 0.932,
                  "participating_states": len(states),
                  "last_training": now.isoformat()},
    }

    return {
        "meta": meta,
        "states": states,
        "districts": districts,
        "phcs": phcs,
        "medicines": medicines,
        "inventory": inventory,
        "shipments": shipments,
        "federated_nodes": nodes,
        "suppliers": suppliers,
    }
