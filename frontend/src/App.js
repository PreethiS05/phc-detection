import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider } from "@/context/AppContext";
import { AppShell } from "@/components/layout/AppShell";
import Landing from "@/pages/Landing";
import Overview from "@/pages/Overview";
import SupplyChain from "@/pages/SupplyChain";
import Inventory from "@/pages/Inventory";
import DemandForecast from "@/pages/DemandForecast";
import EarlyWarnings from "@/pages/EarlyWarnings";
import ResourceAllocation from "@/pages/ResourceAllocation";
import PHCNetwork from "@/pages/PHCNetwork";
import PHCDetail from "@/pages/PHCDetail";
import FederatedAI from "@/pages/FederatedAI";
import EmergencyMode from "@/pages/EmergencyMode";
import Analytics from "@/pages/Analytics";
import Reports from "@/pages/Reports";
import Settings from "@/pages/Settings";

function App() {
  return (
    <AppProvider>
      <TooltipProvider delayDuration={200}>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route element={<AppShell />}>
              <Route path="/overview" element={<Overview />} />
              <Route path="/supply-chain" element={<SupplyChain />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/demand-forecast" element={<DemandForecast />} />
              <Route path="/early-warnings" element={<EarlyWarnings />} />
              <Route path="/resource-allocation" element={<ResourceAllocation />} />
              <Route path="/phc-network" element={<PHCNetwork />} />
              <Route path="/phc/:id" element={<PHCDetail />} />
              <Route path="/federated-ai" element={<FederatedAI />} />
              <Route path="/emergency" element={<EmergencyMode />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster position="top-right" richColors />
      </TooltipProvider>
    </AppProvider>
  );
}

export default App;
