import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type UIPreferences = {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (v: boolean) => void;
};

const Ctx = createContext<UIPreferences | null>(null);
const KEY = '@ph/sidebar-collapsed';

export const UIPreferencesProvider = ({ children }: { children: React.ReactNode }) => {
  const [sidebarCollapsed, setCollapsed] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then(v => {
      if (v === '1') setCollapsed(true);
    });
  }, []);

  const setSidebarCollapsed = (v: boolean) => {
    setCollapsed(v);
    AsyncStorage.setItem(KEY, v ? '1' : '0').catch(() => {});
  };

  const toggleSidebar = () => setSidebarCollapsed(!sidebarCollapsed);

  return (
    <Ctx.Provider value={{ sidebarCollapsed, toggleSidebar, setSidebarCollapsed }}>
      {children}
    </Ctx.Provider>
  );
};

export const useUIPreferences = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error('useUIPreferences debe usarse dentro de UIPreferencesProvider');
  return v;
};
