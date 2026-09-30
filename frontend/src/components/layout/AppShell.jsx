import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { useApp } from "../../context/AppContext";
import { Siren } from "lucide-react";

export function AppShell() {
  const [open, setOpen] = useState(false);
  const { emergency } = useApp();
  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <TopBar onMenu={() => setOpen(true)} />
      <main className="pt-16 lg:pl-64 xl:pl-72">
        {emergency?.active && (
          <div className="flex items-center gap-2 bg-red-600 px-5 py-2 text-sm font-semibold text-white">
            <Siren className="h-4 w-4 animate-softpulse" />
            EMERGENCY RESPONSE MODE ACTIVE — {emergency.scenario}. Critical alerts prioritised across affected states.
          </div>
        )}
        <div className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
