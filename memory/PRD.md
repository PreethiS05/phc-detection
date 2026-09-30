# PRD — Smart Health & Supply Chain Resilience
**Subtitle:** Federated AI Platform for National Health Resource Intelligence

## Original Problem Statement
National-scale federated AI platform to improve healthcare supply-chain resilience across India's Primary Health Centre (PHC) network. Real-time visibility into medicine inventory, consumption/demand, patient footfall, bed availability, personnel attendance, resource utilisation, inter-district supply movement, stock-outs and emergency surges. Federated AI concept (states collaborate without centralising raw data). Prototype with realistic synthetic data only — no real patient data.

## User Choices
- No login (opens straight to dashboard); role switching is UI-only RBAC demo.
- Simulated, deterministic AI (clearly labelled "AI · Simulated").
- Leaflet map (OpenStreetMap tiles).
- Full depth across all sections.
- Requested PostgreSQL, but managed env only supports MongoDB → built on MongoDB (no feature impact).

## Architecture
- **Frontend:** React (CRA/craco) + Tailwind + shadcn/ui + Recharts + react-leaflet. Fonts: Manrope/Inter/JetBrains Mono. Navy command-centre theme.
- **Backend:** FastAPI, all routes under `/api`. Deterministic synthetic dataset seeded into MongoDB on startup; derived metrics computed on the fly with reversible emergency/simulation multipliers.
- **DB:** MongoDB (collections: meta, states, districts, phcs, medicines, inventory, shipments, federated_nodes, suppliers, transfers, notifications).
- Files: `server.py`, `compute.py` (risk/forecast/multipliers), `synthetic_data.py` (generator).

## Synthetic Data
36 states/UTs, 113 districts, 505 PHCs, 51 medicines, ~thousands of inventory lines, shipments, alerts, notifications, federated nodes. Internally consistent (days_remaining ≈ stock/daily_consumption).

## Implemented (2026-06)
- Landing/login page; National Command Centre (KPIs + sparklines, mini-stats, system health).
- Interactive India map with metric filter, state drill-down panel, severity legend.
- Supply Chain (flow stages, table, suppliers, shipments, bottlenecks).
- Inventory Matrix (charts, advanced filters, pagination, row actions, detail dialog).
- AI Demand Forecast (7/14/30/90d, history + predicted + 95% CI band, stat cards).
- Early Warning System (risk-banded cards, AI reasoning, actions, count cards).
- AI Resource Redistribution (source→dest flow, distance/time/cost/risk-cut, approve/reject with confirm dialog → updates inventory).
- Federated AI Centre (concept flow, training panel, convergence chart, SVG node network, node grid, run training round). Clearly labelled SIMULATED.
- Emergency Mode (activate w/ scenario + affected states, pressure metrics, AI recommendations, global banner, deactivate).
- PHC Network directory (search/filter/sort/paginate) + PHC Detail (KPIs, 4 charts, inventory, AI recs, breadcrumbs).
- Analytics (multiple charts, date range, heatmap table).
- Reports (7 types, generate preview, CSV export, PDF via print).
- Notification Centre (categories, mark read/all).
- Demo Simulation control (6 scenarios, scope, intensity; reversible; reset).
- Global search, state selector, role switcher, live-sync indicator.

## Testing
- iteration_1: backend 49/49 pass, frontend 24/24 flows pass. No functional issues.

## Backlog / Next (P1/P2)
- P2: Split `server.py` into routers/services; single-pass metric aggregation for /alerts.
- P2: Resolve LOW React duplicate-key warning and favicon 404.
- P1 (optional): District/PHC drill-down levels directly on the map; per-metric map colour recompute; real ML forecasting if desired later.
