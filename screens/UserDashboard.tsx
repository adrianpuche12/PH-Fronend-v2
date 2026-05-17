import React, { useEffect, useRef, useState } from 'react';
import { Animated, View, Text, StyleSheet, TouchableOpacity, useWindowDimensions, Modal, Image } from 'react-native';
import { ActivityIndicator, IconButton } from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import axios from 'axios';
import { StoreProvider, useStore } from '../context/StoreContext';
import { UIPreferencesProvider, useUIPreferences } from '../context/UIPreferencesContext';
import { useAuth } from '../context/AuthContext';
import { REACT_APP_API_URL } from '../config';
import { COLOR, SPACE, RADIUS, FONT_SIZE, FONT_WEIGHT, BREAKPOINT, CONTROL } from '../theme';
import POSScreen from './POSScreen';
import InventoryScreen from './InventoryScreen';
import SalesHistoryScreen from './SalesHistoryScreen';
import DynamicFormScreen from './DynamicFormScreen';

type UserScreen = 'sales' | 'inventory' | 'salesHistory' | 'operaciones';

const MENU: { key: UserScreen; label: string; icon: string }[] = [
  { key: 'sales',        label: 'Ventas',           icon: 'cart-outline' },
  { key: 'inventory',    label: 'Inventario',        icon: 'package-variant' },
  { key: 'salesHistory', label: 'Mis ventas',        icon: 'receipt-text-outline' },
  { key: 'operaciones',  label: 'Operaciones',       icon: 'clipboard-text-outline' },
];

// ─── Sidebar del usuario ──────────────────────────────────────────────────────

const SIDEBAR_W_EXPANDED  = 220;
const SIDEBAR_W_COLLAPSED = 64;

const UserSidebar = ({ active, onSelect, onClose, isDesktop }: {
  active: UserScreen; onSelect: (s: UserScreen) => void;
  onClose: () => void; isDesktop: boolean;
}) => {
  const { logout, userName } = useAuth();
  const { sidebarCollapsed, toggleSidebar } = useUIPreferences();
  const collapsed = isDesktop && sidebarCollapsed;

  const animW = useRef(new Animated.Value(
    collapsed ? SIDEBAR_W_COLLAPSED : SIDEBAR_W_EXPANDED
  )).current;

  useEffect(() => {
    Animated.timing(animW, {
      toValue: collapsed ? SIDEBAR_W_COLLAPSED : SIDEBAR_W_EXPANDED,
      duration: 250,
      useNativeDriver: false,
    }).start();
  }, [collapsed]);

  return (
    <Animated.View style={[styles.sidebar, isDesktop && { width: animW }]}>
      <View style={styles.sidebarHeader}>
        {!collapsed && (
          <View style={{ flex: 1 }}>
            <Text style={styles.brandText}>PH</Text>
            <Text style={styles.brandSub}>{userName}</Text>
          </View>
        )}
        {!isDesktop && (
          <IconButton icon="close" size={20} iconColor={COLOR.ink} onPress={onClose} style={{ margin: 0 }} />
        )}
        {isDesktop && (
          <TouchableOpacity style={styles.togglePin} onPress={toggleSidebar} activeOpacity={0.8}>
            <MaterialCommunityIcons
              name={collapsed ? 'chevron-right' : 'chevron-left'}
              size={16}
              color={COLOR.brandDeep}
            />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.menuScroll}>
        {MENU.map(item => (
          <TouchableOpacity
            key={item.key}
            style={[
              collapsed ? styles.menuItemCollapsed : styles.menuItem,
              active === item.key && styles.menuItemActive,
            ]}
            onPress={() => { onSelect(item.key); if (!isDesktop) onClose(); }}
          >
            <MaterialCommunityIcons
              name={item.icon}
              size={20}
              color={active === item.key ? COLOR.brandDeep : COLOR.ink2}
            />
            {!collapsed && (
              <Text style={[styles.menuLabel, active === item.key && styles.menuLabelActive]}>
                {item.label}
              </Text>
            )}
            {active === item.key && <View style={styles.activeBar} />}
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={[styles.logoutBtn, collapsed && { justifyContent: 'center', paddingHorizontal: 0 }]} onPress={logout}>
        <MaterialCommunityIcons name="logout" size={18} color={COLOR.expense} />
        {!collapsed && <Text style={styles.logoutText}>Cerrar sesión</Text>}
      </TouchableOpacity>
    </Animated.View>
  );
};

// ─── Contenido interno (necesita StoreContext activo) ─────────────────────────

const UserContent = () => {
  const { width } = useWindowDimensions();
  const isDesktop = width >= BREAKPOINT.desktop;
  const { userName, logout } = useAuth();
  const { stores, setSelectedStore } = useStore();

  const [active, setActive]         = useState<UserScreen>('sales');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [ready, setReady]           = useState(false);

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

  if (!ready) return <ActivityIndicator size="large" color={COLOR.brand} style={{ flex: 1, marginTop: 60 }} />;

  return (
    <View style={styles.container}>
      {isDesktop && (
        <UserSidebar active={active} onSelect={setActive} onClose={() => {}} isDesktop />
      )}

      <View style={styles.content}>
        {!isDesktop && (
          <View style={styles.topbar}>
            <TouchableOpacity
              onPress={() => setDrawerOpen(true)}
              style={styles.menuBtn}
              accessibilityRole="button"
              accessibilityLabel="Abrir menú"
            >
              <MaterialCommunityIcons name="menu" size={26} color={COLOR.ink} />
            </TouchableOpacity>
            <Text style={styles.topbarTitle}>{screenTitle}</Text>
          </View>
        )}

        {active === 'sales'        && <POSScreen hideStoreSelector />}
        {active === 'inventory'    && <InventoryScreen />}
        {active === 'salesHistory' && <SalesHistoryScreen />}
        {active === 'operaciones'  && <DynamicFormScreen />}
      </View>

      {!isDesktop && (
        <Modal visible={drawerOpen} transparent animationType="slide" onRequestClose={() => setDrawerOpen(false)}>
          <View style={styles.drawerOverlay}>
            <View style={styles.mobileDrawer}>
              {/* Header */}
              <View style={styles.mobileDrawerHeader}>
                <Image
                  source={require('../assets/images/logo_proyecto_Humberto.jpg')}
                  style={styles.mobileDrawerLogo}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.mobileDrawerBrand}>Pollos Hermanos</Text>
                  <Text style={styles.mobileDrawerUser}>{userName ?? 'Usuario'}</Text>
                </View>
                <TouchableOpacity onPress={() => setDrawerOpen(false)} style={styles.mobileDrawerClose} activeOpacity={0.7}>
                  <MaterialCommunityIcons name="close" size={20} color={COLOR.inkOnBrand} />
                </TouchableOpacity>
              </View>

              {/* Menú */}
              <View style={{ flex: 1, paddingTop: SPACE.s3 }}>
                {MENU.map(item => {
                  const isActive = active === item.key;
                  return (
                    <TouchableOpacity
                      key={item.key}
                      style={[styles.mobileDrawerItem, isActive && styles.mobileDrawerItemActive]}
                      onPress={() => { setActive(item.key); setDrawerOpen(false); }}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.mobileDrawerIconWrap, isActive && styles.mobileDrawerIconWrapActive]}>
                        <MaterialCommunityIcons name={item.icon} size={20} color={isActive ? COLOR.inkOnBrand : COLOR.ink2} />
                      </View>
                      <Text style={[styles.mobileDrawerLabel, isActive && styles.mobileDrawerLabelActive]}>
                        {item.label}
                      </Text>
                      {isActive && <MaterialCommunityIcons name="chevron-right" size={16} color={COLOR.brandDark} />}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Logout */}
              <TouchableOpacity style={styles.mobileDrawerLogout} onPress={logout} activeOpacity={0.7}>
                <MaterialCommunityIcons name="logout-variant" size={20} color={COLOR.expense} />
                <Text style={styles.mobileDrawerLogoutText}>Cerrar sesión</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.drawerBg} onPress={() => setDrawerOpen(false)} activeOpacity={1} />
          </View>
        </Modal>
      )}
    </View>
  );
};

// ─── UserDashboard (punto de entrada) ─────────────────────────────────────────

const UserDashboard = () => (
  <UIPreferencesProvider>
    <StoreProvider>
      <UserContent />
    </StoreProvider>
  </UIPreferencesProvider>
);

export default UserDashboard;

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:       { flex: 1, flexDirection: 'row', backgroundColor: COLOR.bg },
  content:         { flex: 1, flexDirection: 'column' },

  sidebar:         { backgroundColor: COLOR.surface, borderRightWidth: 1, borderRightColor: COLOR.border, flexDirection: 'column', overflow: 'hidden' },
  sidebarHeader:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SPACE.s3, borderBottomWidth: 1, borderBottomColor: COLOR.brandDark, backgroundColor: COLOR.brand, position: 'relative', minHeight: 56 },

  togglePin: {
    width: 26, height: 26, borderRadius: RADIUS.full,
    backgroundColor: COLOR.brandTint2, borderWidth: 1, borderColor: COLOR.brandDark,
    justifyContent: 'center', alignItems: 'center',
  },

  menuItemCollapsed: { alignItems: 'center', justifyContent: 'center', paddingVertical: SPACE.s3, marginHorizontal: SPACE.s2, borderRadius: RADIUS.r2, marginBottom: 2, position: 'relative' },
  brandText:       { fontSize: FONT_SIZE.h3, fontWeight: FONT_WEIGHT.black as any, color: COLOR.ink },
  brandSub:        { fontSize: FONT_SIZE.caption, color: COLOR.inkMute, fontWeight: FONT_WEIGHT.semibold as any, marginTop: 2 },

  menuScroll:      { flex: 1, paddingTop: SPACE.s2 },
  menuItem:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACE.s4, paddingVertical: SPACE.s3, marginHorizontal: SPACE.s2, borderRadius: RADIUS.r2, marginBottom: 2, position: 'relative', gap: SPACE.s3 },
  menuItemActive:  { backgroundColor: COLOR.brandTint },
  menuLabel:       { fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.ink2, flex: 1 },
  menuLabelActive: { color: COLOR.ink, fontWeight: FONT_WEIGHT.black as any },
  activeBar:       { position: 'absolute', left: 0, top: 6, bottom: 6, width: 4, backgroundColor: COLOR.brand, borderRadius: RADIUS.full },

  logoutBtn:       { flexDirection: 'row', alignItems: 'center', gap: SPACE.s2, padding: SPACE.s4, borderTopWidth: 1, borderTopColor: COLOR.border },
  logoutText:      { fontSize: FONT_SIZE.label, fontWeight: FONT_WEIGHT.semibold as any, color: COLOR.expense },

  topbar:          { flexDirection: 'row', alignItems: 'center', backgroundColor: COLOR.brand, paddingHorizontal: SPACE.s4, height: CONTROL.appBarH, gap: SPACE.s3, borderBottomWidth: 1, borderBottomColor: COLOR.brandDark },
  menuBtn:         { padding: SPACE.s1 },
  topbarTitle:     { fontSize: FONT_SIZE.h2, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.ink },

  drawerOverlay:   { flex: 1, flexDirection: 'row' },
  drawerBg:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },

  mobileDrawer:         { width: 280, backgroundColor: COLOR.surface, flexDirection: 'column', borderTopRightRadius: RADIUS.r4, borderBottomRightRadius: RADIUS.r4, overflow: 'hidden' },
  mobileDrawerHeader:   { flexDirection: 'row', alignItems: 'center', gap: SPACE.s3, padding: SPACE.s4, paddingTop: SPACE.s5, backgroundColor: COLOR.brand },
  mobileDrawerLogo:     { width: 44, height: 44, borderRadius: RADIUS.full, borderWidth: 2, borderColor: COLOR.brandDeep },
  mobileDrawerBrand:    { fontSize: FONT_SIZE.label, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.ink },
  mobileDrawerUser:     { fontSize: FONT_SIZE.caption, color: COLOR.inkOnBrand, marginTop: 2, fontWeight: FONT_WEIGHT.medium as any },
  mobileDrawerClose:    { width: 32, height: 32, borderRadius: RADIUS.full, backgroundColor: 'rgba(0,0,0,0.15)', justifyContent: 'center', alignItems: 'center' },
  mobileDrawerItem:     { flexDirection: 'row', alignItems: 'center', gap: SPACE.s3, marginHorizontal: SPACE.s3, marginBottom: SPACE.s1, paddingHorizontal: SPACE.s3, paddingVertical: SPACE.s3, borderRadius: RADIUS.r2 },
  mobileDrawerItemActive: { backgroundColor: COLOR.brandTint },
  mobileDrawerIconWrap: { width: 36, height: 36, borderRadius: RADIUS.r2, backgroundColor: COLOR.bg, justifyContent: 'center', alignItems: 'center' },
  mobileDrawerIconWrapActive: { backgroundColor: COLOR.brand },
  mobileDrawerLabel:    { flex: 1, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.medium as any, color: COLOR.ink2 },
  mobileDrawerLabelActive: { color: COLOR.ink, fontWeight: FONT_WEIGHT.bold as any },
  mobileDrawerLogout:   { flexDirection: 'row', alignItems: 'center', gap: SPACE.s3, padding: SPACE.s4, borderTopWidth: 1, borderTopColor: COLOR.border, marginTop: SPACE.s2 },
  mobileDrawerLogoutText: { fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold as any, color: COLOR.expense },
});
