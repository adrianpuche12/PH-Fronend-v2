import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions, Modal } from 'react-native';
import { ActivityIndicator, IconButton } from 'react-native-paper';
import axios from 'axios';
import { StoreProvider, useStore } from '../context/StoreContext';
import { useAuth } from '../context/AuthContext';
import { REACT_APP_API_URL } from '../config';
import POSScreen from './POSScreen';
import InventoryScreen from './InventoryScreen';
import SalesHistoryScreen from './SalesHistoryScreen';

type UserScreen = 'sales' | 'inventory' | 'salesHistory';

const MENU: { key: UserScreen; label: string; icon: string }[] = [
  { key: 'sales',        label: 'Ventas',      icon: '🛒' },
  { key: 'inventory',   label: 'Inventario',   icon: '📦' },
  { key: 'salesHistory',label: 'Mis ventas',   icon: '📋' },
];

// ─── Sidebar del usuario ──────────────────────────────────────────────────────

const UserSidebar = ({ active, onSelect, onClose, isDesktop }: {
  active: UserScreen; onSelect: (s: UserScreen) => void;
  onClose: () => void; isDesktop: boolean;
}) => {
  const { logout, userName } = useAuth();
  return (
    <View style={styles.sidebar}>
      <View style={styles.sidebarHeader}>
        <View>
          <Text style={styles.brandText}>🐔 POLLOS</Text>
          <Text style={styles.brandSub}>{userName}</Text>
        </View>
        {!isDesktop && (
          <IconButton icon="close" size={20} iconColor="#161616" onPress={onClose} style={{ margin: 0 }} />
        )}
      </View>

      <View style={styles.menuScroll}>
        {MENU.map(item => (
          <TouchableOpacity
            key={item.key}
            style={[styles.menuItem, active === item.key && styles.menuItemActive]}
            onPress={() => { onSelect(item.key); if (!isDesktop) onClose(); }}
          >
            <Text style={styles.menuIcon}>{item.icon}</Text>
            <Text style={[styles.menuLabel, active === item.key && styles.menuLabelActive]}>
              {item.label}
            </Text>
            {active === item.key && <View style={styles.activeBar} />}
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
        <Text style={styles.logoutText}>→ Cerrar sesión</Text>
      </TouchableOpacity>
    </View>
  );
};

// ─── Contenido interno (necesita StoreContext activo) ─────────────────────────

const UserContent = () => {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const { userName } = useAuth();
  const { stores, setSelectedStore } = useStore();

  const [active, setActive]         = useState<UserScreen>('sales');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [ready, setReady]           = useState(false);

  // Pre-seleccionar el local asignado al empleado
  useEffect(() => {
    if (!userName || stores.length === 0) return;
    axios.get(`${REACT_APP_API_URL}/api/v2/users/by-username/${userName}`)
      .then(res => {
        const store = stores.find(s => s.id === res.data.storeId);
        if (store) setSelectedStore(store);
        else if (stores[0]) setSelectedStore(stores[0]);
      })
      .catch(() => { if (stores[0]) setSelectedStore(stores[0]); })
      .finally(() => setReady(true));
  }, [userName, stores]);

  const screenTitle = MENU.find(m => m.key === active)?.label ?? '';

  if (!ready) return <ActivityIndicator size="large" color="#ffd43b" style={{ flex: 1, marginTop: 60 }} />;

  return (
    <View style={styles.container}>
      {/* Sidebar fijo en desktop */}
      {isDesktop && (
        <UserSidebar active={active} onSelect={setActive} onClose={() => {}} isDesktop />
      )}

      {/* Contenido */}
      <View style={styles.content}>
        {/* Topbar mobile */}
        {!isDesktop && (
          <View style={styles.topbar}>
            <TouchableOpacity onPress={() => setDrawerOpen(true)} style={styles.menuBtn}>
              <Text style={styles.menuBtnIcon}>☰</Text>
            </TouchableOpacity>
            <Text style={styles.topbarTitle}>{screenTitle}</Text>
          </View>
        )}

        {active === 'sales'        && <POSScreen hideStoreSelector />}
        {active === 'inventory'    && <InventoryScreen />}
        {active === 'salesHistory' && <SalesHistoryScreen />}
      </View>

      {/* Drawer mobile */}
      {!isDesktop && (
        <Modal visible={drawerOpen} transparent animationType="slide" onRequestClose={() => setDrawerOpen(false)}>
          <View style={styles.drawerOverlay}>
            <UserSidebar active={active} onSelect={setActive} onClose={() => setDrawerOpen(false)} isDesktop={false} />
            <TouchableOpacity style={styles.drawerBg} onPress={() => setDrawerOpen(false)} />
          </View>
        </Modal>
      )}
    </View>
  );
};

// ─── UserDashboard (punto de entrada) ─────────────────────────────────────────

const UserDashboard = () => (
  <StoreProvider>
    <UserContent />
  </StoreProvider>
);

export default UserDashboard;

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:      { flex: 1, flexDirection: 'row', backgroundColor: '#f4f6f8' },
  content:        { flex: 1, flexDirection: 'column' },

  sidebar:        { width: 220, backgroundColor: '#fff', borderRightWidth: 1, borderRightColor: '#e8ecf2', flexDirection: 'column' },
  sidebarHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderBottomWidth: 1, borderBottomColor: '#e8ecf2', backgroundColor: '#ffd43b' },
  brandText:      { fontSize: 15, fontWeight: '950', color: '#161616' },
  brandSub:       { fontSize: 11, color: '#53606d', fontWeight: '700', marginTop: 2 },

  menuScroll:     { flex: 1, paddingTop: 8 },
  menuItem:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, marginHorizontal: 8, borderRadius: 12, marginBottom: 2, position: 'relative', gap: 10 },
  menuItemActive: { backgroundColor: '#fff9e6' },
  menuIcon:       { fontSize: 16 },
  menuLabel:      { fontSize: 14, fontWeight: '700', color: '#53606d' },
  menuLabelActive:{ color: '#161616', fontWeight: '900' },
  activeBar:      { position: 'absolute', left: 0, top: 6, bottom: 6, width: 4, backgroundColor: '#ffd43b', borderRadius: 2 },

  logoutBtn:      { padding: 16, borderTopWidth: 1, borderTopColor: '#e8ecf2' },
  logoutText:     { fontSize: 14, fontWeight: '700', color: '#d32121' },

  topbar:         { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffd43b', paddingHorizontal: 12, paddingVertical: 10, gap: 12 },
  menuBtn:        { padding: 4 },
  menuBtnIcon:    { fontSize: 22, fontWeight: '900', color: '#161616' },
  topbarTitle:    { fontSize: 18, fontWeight: '900', color: '#161616' },

  drawerOverlay:  { flex: 1, flexDirection: 'row' },
  drawerBg:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
});
