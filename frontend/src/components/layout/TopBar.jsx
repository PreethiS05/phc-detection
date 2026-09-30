import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Menu, Search, Bell, ChevronDown, RefreshCw, Siren, Cpu, User, Check, X,
} from "lucide-react";
import { useApp } from "../../context/AppContext";
import { get, post } from "../../lib/api";
import { timeAgo, fmtTime } from "../../lib/format";
import { cn } from "../../lib/utils";

const ROLES = ["National Health Director", "State Nodal Officer", "District Magistrate", "PHC Medical Officer", "Administrator"];

const CAT_STYLE = {
  critical: "border-l-red-500 bg-red-50/60",
  warning: "border-l-amber-500 bg-amber-50/60",
  info: "border-l-blue-500 bg-blue-50/60",
};

export function TopBar({ onMenu }) {
  const { states, stateCode, setStateCode, setDistrictId, emergency, unread, lastSync, refreshMeta } = useApp();
  const navigate = useNavigate();
  const [role, setRole] = useState(ROLES[0]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const [notes, setNotes] = useState([]);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState(null);
  const ref = useRef(null);

  const loadNotes = () => get("/notifications").then((d) => setNotes(d.notifications || [])).catch(() => {});
  useEffect(() => { loadNotes(); }, [unread]);

  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) { setNotifOpen(false); setRoleOpen(false); } };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const doSearch = async (v) => {
    setSearch(v);
    if (v.length < 2) { setResults(null); return; }
    try {
      const d = await get("/phcs", { q: v, limit: 6 });
      setResults(d.phcs || []);
    } catch { setResults([]); }
  };

  const markAll = async () => { await post("/notifications/read-all"); await loadNotes(); refreshMeta(); };
  const markOne = async (id) => { await post(`/notifications/${id}/read`); await loadNotes(); refreshMeta(); };

  return (
    <header className="fixed left-0 top-0 z-20 flex h-16 w-full items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur lg:pl-[17rem] xl:pl-[19rem]" ref={ref}>
      <button className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden" onClick={onMenu} data-testid="menu-toggle">
        <Menu className="h-5 w-5" />
      </button>

      <div className="relative hidden max-w-xs flex-1 md:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          data-testid="global-search-input"
          value={search}
          onChange={(e) => doSearch(e.target.value)}
          placeholder="Search PHC, facility ID…"
          className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
        />
        {results && (
          <div className="absolute mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
            {results.length === 0 ? (
              <p className="px-3 py-3 text-xs text-slate-500">No facilities found</p>
            ) : results.map((r) => (
              <button key={r.id} data-testid="search-result"
                onClick={() => { navigate(`/phc/${r.id}`); setResults(null); setSearch(""); }}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50">
                <span className="truncate">{r.name}</span>
                <span className="ml-2 text-[10px] text-slate-400">{r.state}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* State selector */}
      <div className="hidden items-center gap-2 sm:flex">
        <select
          data-testid="state-selector"
          value={stateCode}
          onChange={(e) => { setStateCode(e.target.value); setDistrictId(""); }}
          className="rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-8 text-sm font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        >
          <option value="">National View</option>
          {states.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
        </select>
      </div>

      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        {emergency?.active && (
          <button onClick={() => navigate("/emergency")} data-testid="emergency-indicator"
            className="hidden items-center gap-1.5 rounded-full bg-red-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm animate-softpulse sm:flex">
            <Siren className="h-3.5 w-3.5" /> EMERGENCY ACTIVE
          </button>
        )}

        <div className="hidden items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 lg:flex" title="Federated AI nodes online">
          <Cpu className="h-3.5 w-3.5" /> Nodes Online
        </div>

        <button onClick={refreshMeta} data-testid="sync-indicator"
          className="hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 md:flex" title="Last data synchronization">
          <RefreshCw className="h-3.5 w-3.5" /> Synced {timeAgo(lastSync)}
        </button>

        {/* Notifications */}
        <div className="relative">
          <button onClick={() => { setNotifOpen((o) => !o); setRoleOpen(false); }} data-testid="notifications-btn"
            className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100">
            <Bell className="h-5 w-5" />
            {unread > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {unread}
              </span>
            )}
          </button>
          {notifOpen && (
            <div className="absolute right-0 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl" data-testid="notifications-panel">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <p className="font-display text-sm font-bold text-slate-800">Notifications</p>
                <button onClick={markAll} className="text-xs font-semibold text-blue-600 hover:underline" data-testid="mark-all-read-btn">Mark all read</button>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {notes.length === 0 && <p className="px-4 py-6 text-center text-sm text-slate-400">No notifications</p>}
                {notes.map((n) => (
                  <div key={n.id} className={cn("flex items-start gap-2 border-l-4 px-4 py-3", CAT_STYLE[n.category], n.read && "opacity-60")}>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-800">{n.title}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{n.message}</p>
                      <p className="mt-1 text-[10px] uppercase tracking-wide text-slate-400">{timeAgo(n.created_at)}</p>
                    </div>
                    {!n.read && (
                      <button onClick={() => markOne(n.id)} title="Mark as read" data-testid="notif-read-btn"
                        className="rounded p-1 text-slate-400 hover:bg-white hover:text-emerald-600">
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Role / profile */}
        <div className="relative">
          <button onClick={() => { setRoleOpen((o) => !o); setNotifOpen(false); }} data-testid="profile-btn"
            className="flex items-center gap-2 rounded-lg border border-slate-200 py-1.5 pl-1.5 pr-2.5 hover:bg-slate-50">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#0B192C] text-white">
              <User className="h-4 w-4" />
            </span>
            <span className="hidden text-left leading-tight sm:block">
              <span className="block text-xs font-semibold text-slate-800">{role.split(" ")[0]} {role.split(" ")[1] || ""}</span>
              <span className="block text-[10px] text-slate-400">RBAC · {role.split(" ").pop()}</span>
            </span>
            <ChevronDown className="h-4 w-4 text-slate-400" />
          </button>
          {roleOpen && (
            <div className="absolute right-0 mt-2 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl" data-testid="role-menu">
              <p className="border-b border-slate-100 px-4 py-2.5 text-[11px] font-bold uppercase tracking-widest text-slate-400">Switch role (RBAC)</p>
              {ROLES.map((r) => (
                <button key={r} onClick={() => { setRole(r); setRoleOpen(false); }} data-testid={`role-${r.replace(/\s+/g, "-").toLowerCase()}`}
                  className={cn("flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-slate-50", r === role && "font-semibold text-blue-700")}>
                  {r} {r === role && <Check className="h-4 w-4" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
