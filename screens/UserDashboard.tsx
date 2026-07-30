import React, { useEffect, useRef, useState } from 'react';
import { Animated, View, Text, StyleSheet, TouchableOpacity, useWindowDimensions, Modal, Image, ScrollView } from 'react-native';
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

interface UserMenuItem { key: UserScreen; label: string; icon: string; permission?: string }
interface AccessibleStore { id: number; name: string }

const MENU_ALL: UserMenuItem[] = [
  { key: 'sales',        label: 'Ventas',      icon: 'cart-outline',          permission: 'POS' },
  { key: 'inventory',    label: 'Inventario',  icon: 'package-variant',       permission: 'INVENTORY' },
  { key: 'salesHistory', label: 'Mis ventas',  icon: 'receipt-text-outline',  permission: 'SALES_HISTORY' },
  { key: 'operaciones',  label: 'Operaciones', icon: 'clipboard-text-outline', permission: 'TRANSACTIONS' },
];

const hasPermission = (permissions: string[], section?: string) =>
  !section || permissions.length === 0 || permissions.includes(section);

// ─── UserHomeDashboard — selector de locales ──────────────────────────────────

const UserHomeDashboard = ({
  stores,
  userName,
  onSelect,
  onLogout,
}: {
  stores: AccessibleStore[];
  userName: string | null;
  onSelect: (s: AccessibleStore) => void;
  onLogout: () => void;
}) => {
  const { width } = useWindowDimensions();
  const isDesktop = width >= BREAKPOINT.desktop;

  return (
    <View style={home.root}>
      {/* Header */}
      <View style={home.header}>
        <Image
          source={require('../assets/images/logo_proyecto_Humberto.jpg')}
          style={home.logo}
        />
        <View style={{ flex: 1 }}>
          <Text style={home.brand}>Pollos Hermanos</Text>
          <Text style={home.user}>{userName ?? 'Usuario'}</Text>
        </View>
        <TouchableOpacity onPress={onLogout} style={home.logoutBtn} activeOpacity={0.7}>
          <MaterialCommunityIcons name="logout" size={18} color={COLOR.expense} />
        </TouchableOpacity>
      </View>

      {/* Body */}
      <ScrollView
        contentContainerStyle={[home.body, isDesktop && home.bodyDesktop]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={home.title}>Seleccioná un local</Text>
        <Text style={home.subtitle}>Elegí el local en el que querés trabajar</Text>

        <View style={[home.grid, isDesktop && home.gridDesktop]}>
          {stores.map(store => (
            <TouchableOpacity
              key={store.id}
              style={home.card}
              onPress={() => onSelect(store)}
              activeOpacity={0.8}
            >
              <View style={home.cardIcon}>
                <MaterialCommunityIcons name="store-outline" size={28} color={COLOR.brand} />
              </View>
              <Text style={home.cardName}>{store.name}</Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color={COLOR.inkMute} />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

// ─── Sidebar del usuario ──────────────────────────────────────────────────────

const SIDEBAR_W_EXPANDED  = 220;
const SIDEBAR_W_COLLAPSED = 64;

const UserSidebar = ({
  active,
  onSelect,
  onClose,
  isDesktop,
  storeName,
  showChangeStore,
  onChangeStore,
}: {
  active: UserScreen;
  onSelect: (s: UserScreen) => void;
  onClose: () => void;
  isDesktop: boolean;
  storeName?: string;
  showChangeStore?: boolean;
  onChangeStore?: () => void;
}) => {
  const { logout, userName, permissions } = useAuth();
  const { sidebarCollapsed, toggleSidebar } = useUIPreferences();
  const menu = MENU_ALL.filter(item => hasPermission(permissions, item.permission));
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
        <Image
          source={require('../assets/images/logo_proyecto_Humberto.jpg')}
          style={[styles.sidebarLogo, collapsed && styles.sidebarLogoCollapsed]}
        />
        {!collapsed && (
          <View style={{ flex: 1 }}>
            <Text style={styles.brandName}>Pollos Hermanos</Text>
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

      {/* Local activo + botón cambiar */}
      {!collapsed && storeName && (
        <TouchableOpacity
          style={styles.storeRow}
          onPress={showChangeStore ? onChangeStore : undefined}
          activeOpacity={showChangeStore ? 0.7 : 1}
        >
          <MaterialCommunityIcons name="store-outline" size={14} color={COLOR.brandDeep} />
          <Text style={styles.storeRowName} numberOfLines={1}>{storeName}</Text>
          {showChangeStore && (
            <MaterialCommunityIcons name="swap-horizontal" size={14} color={COLOR.brandDeep} />
          )}
        </TouchableOpacity>
      )}

      <View style={styles.menuScroll}>
        {menu.map(item => (
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
  const { userName, logout, permissions } = useAuth();
  const { setSelectedStore } = useStore();

  const [myStores, setMyStores]         = useState<AccessibleStore[]>([]);
  const [activeStore, setActiveStore]   = useState<AccessibleStore | null>(null);
  const [loading, setLoading]           = useState(true);
  const [drawerOpen, setDrawerOpen]     = useState(false);

  const filteredMenu = MENU_ALL.filter(item => hasPermission(permissions, item.permission));
  const [active, setActive] = useState<UserScreen>(filteredMenu[0]?.key ?? 'sales');

  // Cargar locales accesibles del usuario
  useEffect(() => {
    if (!userName) return;
    axios.get<AccessibleStore[]>(`${REACT_APP_API_URL}/api/v2/users/accessible-stores`)
      .then(res => {
        const stores = res.data ?? [];
        setMyStores(stores);
        if (stores.length === 1) {
          setActiveStore(stores[0]);
          setSelectedStore({ id: stores[0].id, name: stores[0].name, active: true });
        }
      })
      .catch((err: any) => {
        if (err?.response?.status === 403 &&
            err?.response?.data?.error === 'ACCOUNT_SUSPENDED') {
          logout();
          return;
        }
        // Continuar con stores vacío
      })
      .finally(() => setLoading(false));
  }, [userName]);

  const handleStoreSelect = (store: AccessibleStore) => {
    setActiveStore(store);
    setSelectedStore({ id: store.id, name: store.name, active: true });
    setActive(filteredMenu[0]?.key ?? 'sales');
  };

  const handleChangeStore = () => {
    setActiveStore(null);
  };

  const screenTitle = filteredMenu.find(m => m.key === active)?.label ?? '';

  // Estados de carga
  if (loading) {
    return <ActivityIndicator size="large" color={COLOR.brand} style={{ flex: 1, marginTop: 60 }} />;
  }

  // Sin secciones habilitadas
  if (filteredMenu.length === 0) {
    return (
      <View style={styles.noAccessContainer}>
        <MaterialCommunityIcons name="lock-outline" size={48} color={COLOR.inkMute} />
        <Text style={styles.noAccessTitle}>Sin acceso habilitado</Text>
        <Text style={styles.noAccessText}>No tenés secciones habilitadas. Contactá al encargado del sistema.</Text>
        <TouchableOpacity style={styles.noAccessLogout} onPress={logout} activeOpacity={0.7}>
          <MaterialCommunityIcons name="logout" size={16} color={COLOR.expense} />
          <Text style={styles.noAccessLogoutText}>Cerrar sesión</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Selector de locales (múltiples locales, ninguno seleccionado)
  if (myStores.length > 1 && activeStore === null) {
    return (
      <UserHomeDashboard
        stores={myStores}
        userName={userName}
        onSelect={handleStoreSelect}
        onLogout={logout}
      />
    );
  }

  // Vista de secciones (1 local o local ya seleccionado)
  return (
    <View style={styles.container}>
      {isDesktop && (
        <UserSidebar
          active={active}
          onSelect={setActive}
          onClose={() => {}}
          isDesktop
          storeName={activeStore?.name}
          showChangeStore={myStores.length > 1}
          onChangeStore={handleChangeStore}
        />
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
            {myStores.length > 1 && (
              <TouchableOpacity onPress={handleChangeStore} style={styles.changeStoreBtn} activeOpacity={0.7}>
                <MaterialCommunityIcons name="swap-horizontal" size={20} color={COLOR.brandDeep} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {active === 'sales'        && <POSScreen hideStoreSelector />}
        {active === 'inventory'    && <InventoryScreen />}
        {active === 'salesHistory' && <SalesHistoryScreen usernameFilter={userName ?? undefined} />}
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

              {/* Local activo */}
              {activeStore && (
                <View style={styles.mobileDrawerStore}>
                  <MaterialCommunityIcons name="store-outline" size={14} color={COLOR.brandDeep} />
                  <Text style={styles.mobileDrawerStoreName} numberOfLines={1}>{activeStore.name}</Text>
                  {myStores.length > 1 && (
                    <TouchableOpacity onPress={() => { setDrawerOpen(false); handleChangeStore(); }} activeOpacity={0.7}>
                      <Text style={styles.mobileDrawerStoreChange}>Cambiar</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Menú */}
              <View style={{ flex: 1, paddingTop: SPACE.s3 }}>
                {filteredMenu.map(item => {
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

// ─── Estilos — UserHomeDashboard ──────────────────────────────────────────────

const home = StyleSheet.create({
  root:        { flex: 1, backgroundColor: COLOR.bg },
  header:      { flexDirection: 'row', alignItems: 'center', gap: SPACE.s3, padding: SPACE.s4, paddingTop: SPACE.s5, backgroundColor: COLOR.brand, borderBottomWidth: 1, borderBottomColor: COLOR.brandDark },
  logo:        { width: 40, height: 40, borderRadius: RADIUS.full, borderWidth: 2, borderColor: COLOR.brandDeep },
  brand:       { fontSize: FONT_SIZE.label, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.ink },
  user:        { fontSize: FONT_SIZE.caption, color: COLOR.inkOnBrand, marginTop: 2 },
  logoutBtn:   { padding: SPACE.s2 },

  body:        { padding: SPACE.s5, paddingTop: SPACE.s6 },
  bodyDesktop: { maxWidth: 720, alignSelf: 'center', width: '100%' },
  title:       { fontSize: FONT_SIZE.h1, fontWeight: FONT_WEIGHT.black as any, color: COLOR.ink, marginBottom: SPACE.s1 },
  subtitle:    { fontSize: FONT_SIZE.body, color: COLOR.inkMute, marginBottom: SPACE.s5 },

  grid:        { gap: SPACE.s3 },
  gridDesktop: { flexDirection: 'row', flexWrap: 'wrap' },

  card:        { flexDirection: 'row', alignItems: 'center', gap: SPACE.s3, backgroundColor: COLOR.surface, borderRadius: RADIUS.r3, padding: SPACE.s4, borderWidth: 1, borderColor: COLOR.border, elevation: 1 },
  cardIcon:    { width: 48, height: 48, borderRadius: RADIUS.r2, backgroundColor: COLOR.brandTint, justifyContent: 'center', alignItems: 'center' },
  cardName:    { flex: 1, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.ink },
});

// ─── Estilos — UserDashboard principal ────────────────────────────────────────

const styles = StyleSheet.create({
  container:       { flex: 1, flexDirection: 'row', backgroundColor: COLOR.bg },
  content:         { flex: 1, flexDirection: 'column' },

  sidebar:         { backgroundColor: COLOR.surface, borderRightWidth: 1, borderRightColor: COLOR.border, flexDirection: 'column', overflow: 'hidden' },
  sidebarHeader:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SPACE.s3, borderBottomWidth: 1, borderBottomColor: COLOR.brandDark, backgroundColor: COLOR.brand, position: 'relative', minHeight: 56 },

  storeRow:        { flexDirection: 'row', alignItems: 'center', gap: SPACE.s2, paddingHorizontal: SPACE.s4, paddingVertical: SPACE.s2, backgroundColor: COLOR.brandTint, borderBottomWidth: 1, borderBottomColor: COLOR.border },
  storeRowName:    { flex: 1, fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.semibold as any, color: COLOR.inkMute },

  togglePin: {
    width: 26, height: 26, borderRadius: RADIUS.full,
    backgroundColor: COLOR.brandTint2, borderWidth: 1, borderColor: COLOR.brandDark,
    justifyContent: 'center', alignItems: 'center',
  },

  menuItemCollapsed: { alignItems: 'center', justifyContent: 'center', paddingVertical: SPACE.s3, marginHorizontal: SPACE.s2, borderRadius: RADIUS.r2, marginBottom: 2, position: 'relative' },
  sidebarLogo:          { width: 36, height: 36, borderRadius: RADIUS.full, borderWidth: 2, borderColor: COLOR.brandDeep, marginRight: SPACE.s2 },
  sidebarLogoCollapsed: { width: 32, height: 32, borderRadius: RADIUS.full, marginRight: 0 },
  brandName:            { fontSize: FONT_SIZE.label, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.ink },
  brandSub:             { fontSize: FONT_SIZE.caption, color: COLOR.inkMute, fontWeight: FONT_WEIGHT.semibold as any, marginTop: 2 },

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
  topbarTitle:     { flex: 1, fontSize: FONT_SIZE.h2, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.ink },
  changeStoreBtn:  { padding: SPACE.s1 },

  drawerOverlay:   { flex: 1, flexDirection: 'row' },
  drawerBg:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },

  mobileDrawer:         { width: 280, backgroundColor: COLOR.surface, flexDirection: 'column', borderTopRightRadius: RADIUS.r4, borderBottomRightRadius: RADIUS.r4, overflow: 'hidden' },
  mobileDrawerHeader:   { flexDirection: 'row', alignItems: 'center', gap: SPACE.s3, padding: SPACE.s4, paddingTop: SPACE.s5, backgroundColor: COLOR.brand },
  mobileDrawerLogo:     { width: 44, height: 44, borderRadius: RADIUS.full, borderWidth: 2, borderColor: COLOR.brandDeep },
  mobileDrawerBrand:    { fontSize: FONT_SIZE.label, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.ink },
  mobileDrawerUser:     { fontSize: FONT_SIZE.caption, color: COLOR.inkOnBrand, marginTop: 2, fontWeight: FONT_WEIGHT.medium as any },
  mobileDrawerClose:    { width: 32, height: 32, borderRadius: RADIUS.full, backgroundColor: 'rgba(0,0,0,0.15)', justifyContent: 'center', alignItems: 'center' },
  mobileDrawerStore:    { flexDirection: 'row', alignItems: 'center', gap: SPACE.s2, paddingHorizontal: SPACE.s4, paddingVertical: SPACE.s2, backgroundColor: COLOR.brandTint, borderBottomWidth: 1, borderBottomColor: COLOR.border },
  mobileDrawerStoreName:{ flex: 1, fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.semibold as any, color: COLOR.inkMute },
  mobileDrawerStoreChange: { fontSize: FONT_SIZE.caption, color: COLOR.brandDeep, fontWeight: FONT_WEIGHT.bold as any },
  mobileDrawerItem:     { flexDirection: 'row', alignItems: 'center', gap: SPACE.s3, marginHorizontal: SPACE.s3, marginBottom: SPACE.s1, paddingHorizontal: SPACE.s3, paddingVertical: SPACE.s3, borderRadius: RADIUS.r2 },
  mobileDrawerItemActive: { backgroundColor: COLOR.brandTint },
  mobileDrawerIconWrap: { width: 36, height: 36, borderRadius: RADIUS.r2, backgroundColor: COLOR.bg, justifyContent: 'center', alignItems: 'center' },
  mobileDrawerIconWrapActive: { backgroundColor: COLOR.brand },
  mobileDrawerLabel:    { flex: 1, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.medium as any, color: COLOR.ink2 },
  mobileDrawerLabelActive: { color: COLOR.ink, fontWeight: FONT_WEIGHT.bold as any },
  mobileDrawerLogout:   { flexDirection: 'row', alignItems: 'center', gap: SPACE.s3, padding: SPACE.s4, borderTopWidth: 1, borderTopColor: COLOR.border, marginTop: SPACE.s2 },
  mobileDrawerLogoutText: { fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold as any, color: COLOR.expense },

  // Sin acceso
  noAccessContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACE.s6, gap: SPACE.s3 },
  noAccessTitle:     { fontSize: FONT_SIZE.h2, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.ink, textAlign: 'center' },
  noAccessText:      { fontSize: FONT_SIZE.body, color: COLOR.inkMute, textAlign: 'center', lineHeight: 22 },
  noAccessLogout:    { flexDirection: 'row', alignItems: 'center', gap: SPACE.s2, marginTop: SPACE.s3, padding: SPACE.s3, borderRadius: RADIUS.r2, borderWidth: 1, borderColor: COLOR.expense },
  noAccessLogoutText:{ fontSize: FONT_SIZE.label, fontWeight: FONT_WEIGHT.semibold as any, color: COLOR.expense },
});
