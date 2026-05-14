import React, { useState } from 'react';
import { View, StyleSheet, useWindowDimensions, TouchableOpacity, Text } from 'react-native';
import { IconButton } from 'react-native-paper';
import Sidebar, { SidebarScreen } from '../components/Sidebar';
import { StoreProvider } from '../context/StoreContext';
import AdminScreen from './AdminScreen';
import StoresScreen from './StoresScreen';
import InventoryScreen from './InventoryScreen';
import POSScreen from './POSScreen';

const AdminDashboard = () => {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [activeScreen, setActiveScreen] = useState<SidebarScreen>('operations');
  const [drawerOpen, setDrawerOpen]     = useState(false);

  return (
    <StoreProvider>
      <View style={styles.container}>

        {/* Sidebar fijo en desktop */}
        {isDesktop && (
          <Sidebar
            active={activeScreen}
            onSelect={setActiveScreen}
            visible={false}
            onClose={() => {}}
          />
        )}

        {/* Área de contenido */}
        <View style={styles.content}>

          {/* Topbar mobile */}
          {!isDesktop && (
            <View style={styles.topbar}>
              <TouchableOpacity onPress={() => setDrawerOpen(true)} style={styles.menuBtn}>
                <Text style={styles.menuBtnIcon}>☰</Text>
              </TouchableOpacity>
              <Text style={styles.topbarTitle}>
                {activeScreen === 'operations' ? 'Operaciones'
                  : activeScreen === 'inventory' ? 'Inventario'
                  : activeScreen === 'stores'    ? 'Locales'
                  : 'Ventas'}
              </Text>
            </View>
          )}

          {/* Pantalla activa */}
          {activeScreen === 'operations' && <AdminScreen />}
          {activeScreen === 'inventory'  && <InventoryScreen />}
          {activeScreen === 'stores'     && <StoresScreen />}
          {activeScreen === 'sales'      && <POSScreen />}
        </View>

        {/* Drawer mobile */}
        {!isDesktop && (
          <Sidebar
            active={activeScreen}
            onSelect={setActiveScreen}
            visible={drawerOpen}
            onClose={() => setDrawerOpen(false)}
          />
        )}
      </View>
    </StoreProvider>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', backgroundColor: '#f4f6f8' },
  content:   { flex: 1, flexDirection: 'column' },

  topbar:       { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffd43b', paddingHorizontal: 12, paddingVertical: 10, gap: 12 },
  menuBtn:      { padding: 4 },
  menuBtnIcon:  { fontSize: 22, fontWeight: '900', color: '#161616' },
  topbarTitle:  { fontSize: 18, fontWeight: '900', color: '#161616' },
});

export default AdminDashboard;
