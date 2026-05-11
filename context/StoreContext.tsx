import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { REACT_APP_API_URL } from '../config';

export interface Store {
  id: number;
  name: string;
  active: boolean;
}

interface StoreContextType {
  stores: Store[];
  selectedStore: Store | null;
  setSelectedStore: (store: Store) => void;
  loadingStores: boolean;
}

const StoreContext = createContext<StoreContextType>({
  stores: [],
  selectedStore: null,
  setSelectedStore: () => {},
  loadingStores: true,
});

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [stores, setStores]               = useState<Store[]>([]);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [loadingStores, setLoadingStores] = useState(true);

  useEffect(() => {
    axios.get<Store[]>(`${REACT_APP_API_URL}/api/v2/stores`)
      .then(r => {
        const active = r.data.filter(s => s.active);
        setStores(active);
        if (active.length > 0) setSelectedStore(active[0]);
      })
      .catch(() => {})
      .finally(() => setLoadingStores(false));
  }, []);

  return (
    <StoreContext.Provider value={{ stores, selectedStore, setSelectedStore, loadingStores }}>
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => useContext(StoreContext);
