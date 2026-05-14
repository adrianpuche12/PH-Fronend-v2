import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import axios from 'axios';
import { StoreProvider, useStore } from '../context/StoreContext';
import { useAuth } from '../context/AuthContext';
import { REACT_APP_API_URL } from '../config';
import POSScreen from './POSScreen';
import LogoutButton from '../components/LogoutButton';

/**
 * Wrapper interno: espera a que StoreContext esté listo y luego
 * pre-selecciona el local asignado al empleado en la BD.
 */
const UserPOS = () => {
  const { userName } = useAuth();
  const { stores, setSelectedStore } = useStore();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!userName || stores.length === 0) return;

    // Buscar el local asignado al empleado en nuestra BD
    axios.get(`${REACT_APP_API_URL}/api/v2/users/by-username/${userName}`)
      .then(res => {
        const storeId: number = res.data.storeId;
        const assignedStore = stores.find(s => s.id === storeId);
        if (assignedStore) setSelectedStore(assignedStore);
      })
      .catch(() => {
        // Si no se encuentra en la BD (ej: usuario admin en esta vista),
        // simplemente usa el primer local disponible
        if (stores[0]) setSelectedStore(stores[0]);
      })
      .finally(() => setReady(true));
  }, [userName, stores]);

  if (!ready) return <ActivityIndicator size="large" color="#ffd43b" style={{ flex: 1, marginTop: 60 }} />;

  return (
    <View style={{ flex: 1 }}>
      <POSScreen hideStoreSelector />
      <LogoutButton />
    </View>
  );
};

/**
 * Dashboard del usuario con rol 'user' (empleada/cajero).
 * Muestra el POS con el local pre-asignado — no necesita elegir local.
 */
const UserDashboard = () => (
  <StoreProvider>
    <UserPOS />
  </StoreProvider>
);

export default UserDashboard;
