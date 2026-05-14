import React from 'react';
import { View } from 'react-native';
import { StoreProvider } from '../context/StoreContext';
import POSScreen from './POSScreen';
import LogoutButton from '../components/LogoutButton';

/**
 * Dashboard del usuario con rol 'user' (empleada/cajero).
 * Muestra directamente el POS — su única función es registrar ventas.
 */
const UserDashboard = () => (
  <StoreProvider>
    <View style={{ flex: 1 }}>
      <POSScreen />
      <LogoutButton />
    </View>
  </StoreProvider>
);

export default UserDashboard;
