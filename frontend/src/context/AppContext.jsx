import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { get } from "../lib/api";

const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

export function AppProvider({ children }) {
  const [stateCode, setStateCode] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [version, setVersion] = useState(0);
  const [emergency, setEmergency] = useState({ active: false });
  const [unread, setUnread] = useState(0);
  const [lastSync, setLastSync] = useState(new Date().toISOString());
  const [states, setStates] = useState([]);

  const bump = useCallback(() => setVersion((v) => v + 1), []);

  const refreshMeta = useCallback(async () => {
    try {
      const [dash, notes] = await Promise.all([
        get("/dashboard"),
        get("/notifications"),
      ]);
      setEmergency(dash.emergency || { active: false });
      setLastSync(dash.last_updated);
      setUnread(notes.unread || 0);
    } catch (e) {
      // ignore
    }
  }, []);

  useEffect(() => {
    get("/states").then((d) => setStates(d.states || [])).catch(() => {});
  }, []);

  useEffect(() => {
    refreshMeta();
  }, [refreshMeta, version]);

  const value = {
    stateCode, setStateCode, districtId, setDistrictId,
    version, bump, emergency, setEmergency, unread, setUnread,
    lastSync, states, refreshMeta,
  };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
