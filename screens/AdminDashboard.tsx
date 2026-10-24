import React, { useState } from 'react';
import { View, StyleSheet, useWindowDimensions, TouchableOpacity, Text, ScrollView } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Sidebar, { SidebarScreen } from '../components/Sidebar';
import { StoreProvider } from '../context/StoreContext';
import { UIPreferencesProvider } from '../context/UIPreferencesContext';
import { COLOR, SPACE, FONT_SIZE, FONT_WEIGHT, CONTROL, BREAKPOINT, RADIUS } from '../theme';
import AdminScreen from './AdminScreen';
import StoresScreen from './StoresScreen';
import InventoryScreen from './InventoryScreen';
import POSScreen from './POSScreen';
import SalesHistoryScreen from './SalesHistoryScreen';
import DashboardScreen from './DashboardScreen';
import UsersScreen from './UsersScreen';

const SCREEN_TITLE: Record<SidebarScreen, string> = {
  home:         'Inicio',
  dashboard:    'Dashboard',
  operations:   'Operaciones',
  inventory:    'Inventario',
  stores:       'Locales',
  salesHistory: 'Historial ventas',
  users:        'Usuarios',
  sales:        'Ventas',
};

const ADMIN_HOME_ITEMS: { key: SidebarScreen; label: string; icon: string }[] = [
  { key: 'dashboard',    label: 'Dashboard',        icon: 'view-dashboard-outline' },
  { key: 'salesHistory', label: 'Historial ventas',  icon: 'receipt-text-outline' },
  { key: 'inventory',    label: 'Inventario',        icon: 'package-variant' },
  { key: 'users',        label: 'Usuarios',          icon: 'account-multiple-outline' },
  { key: 'operations',   label: 'Operaciones',       icon: 'cog-outline' },
  { key: 'stores',       label: 'Locales',           icon: 'store-outline' },
];

const AdminDashboard = () => {
  const { width } = useWindowDimensions();
  const isTabletOrDesktop = width >= BREAKPOINT.tablet;

  const [activeScreen, setActiveScreen] = useState<SidebarScreen>('home');
  const [drawerOpen, setDrawerOpen]     = useState(false);

  return (
    <UIPreferencesProvider>
    <StoreProvider>
      <View style={styles.container}>

        {/* Sidebar fijo en tablet y desktop */}
        {isTabletOrDesktop && (
          <Sidebar
            active={activeScreen}
            onSelect={setActiveScreen}
            visible={false}
            onClose={() => {}}
          />
        )}

        {/* Área de contenido */}
        <View style={styles.content}>

          {/* Topbar solo en mobile */}
          {!isTabletOrDesktop && (
            <View style={styles.topbar}>
              <TouchableOpacity
                onPress={() => setDrawerOpen(true)}
                style={styles.menuBtn}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="menu" size={26} color={COLOR.ink} />
              </TouchableOpacity>
              <Text style={styles.topbarTitle}>
                {SCREEN_TITLE[activeScreen] ?? 'Menú'}
              </Text>
            </View>
          )}

          {/* Pantalla activa */}
          {activeScreen === 'home' && (
            <ScrollView contentContainerStyle={styles.homeContainer}>
              <Text style={styles.homeTitle}>¿Qué querés hacer?</Text>
              <View style={styles.homeGrid}>
                {ADMIN_HOME_ITEMS.map(item => (
                  <TouchableOpacity
                    key={item.key}
                    style={styles.homeCard}
                    onPress={() => setActiveScreen(item.key)}
                    activeOpacity={0.75}
                  >
                    <MaterialCommunityIcons name={item.icon} size={32} color={COLOR.brandDeep} />
                    <Text style={styles.homeCardLabel}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          )}
          {activeScreen === 'dashboard'    && <DashboardScreen />}
          {activeScreen === 'users'        && <UsersScreen />}
          {activeScreen === 'operations'   && <AdminScreen />}
          {activeScreen === 'inventory'    && <InventoryScreen />}
          {activeScreen === 'stores'       && <StoresScreen />}
          {activeScreen === 'sales'        && <POSScreen />}
          {activeScreen === 'salesHistory' && <SalesHistoryScreen />}
        </View>

        {/* Drawer solo en mobile */}
        {!isTabletOrDesktop && (
          <Sidebar
            active={activeScreen}
            onSelect={setActiveScreen}
            visible={drawerOpen}
            onClose={() => setDrawerOpen(false)}
          />
        )}
      </View>
    </StoreProvider>
    </UIPreferencesProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: COLOR.bg,
  },

  homeContainer: {
    padding: SPACE.s5,
    flexGrow: 1,
  },
  homeTitle: {
    fontSize: FONT_SIZE.h2,
    fontWeight: FONT_WEIGHT.bold as any,
    color: COLOR.ink,
    marginBottom: SPACE.s4,
    textAlign: 'center',
  },
  homeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACE.s3,
    justifyContent: 'center',
  },
  homeCard: {
    width: '45%',
    backgroundColor: COLOR.surface,
    borderRadius: RADIUS.r3,
    paddingVertical: SPACE.s5,
    paddingHorizontal: SPACE.s3,
    alignItems: 'center',
    gap: SPACE.s2,
    borderWidth: 1,
    borderColor: COLOR.border,
  },
  homeCardLabel: {
    fontSize: FONT_SIZE.label,
    fontWeight: FONT_WEIGHT.semibold as any,
    color: COLOR.ink,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    flexDirection: 'column',
    backgroundColor: COLOR.bg,
  },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLOR.brand,
    paddingHorizontal: SPACE.s4,
    paddingVertical: SPACE.s3,
    height: CONTROL.appBarH,
    gap: SPACE.s3,
    borderBottomWidth: 1,
    borderBottomColor: COLOR.brandDark,
  },
  menuBtn:     { padding: SPACE.s1 },
  menuBtnIcon: {
    fontSize: 22,
    fontWeight: FONT_WEIGHT.black as any,
    color: COLOR.ink,
  },
  topbarTitle: {
    fontSize: FONT_SIZE.h2,
    fontWeight: FONT_WEIGHT.bold as any,
    color: COLOR.ink,
  },
});

export default AdminDashboard;
