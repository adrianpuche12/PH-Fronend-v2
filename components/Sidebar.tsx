import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Image, Modal, useWindowDimensions,
} from 'react-native';
import { IconButton } from 'react-native-paper';
import { useAuth } from '../context/AuthContext';

export type SidebarScreen = 'operations' | 'inventory' | 'stores' | 'sales';

interface Props {
  active: SidebarScreen;
  onSelect: (screen: SidebarScreen) => void;
  visible: boolean;           // mobile: controla si el drawer está abierto
  onClose: () => void;        // mobile: cierra el drawer
}

const MENU_ADMIN = [
  { key: 'sales'      as SidebarScreen, label: 'Ventas'      },
  { key: 'inventory'  as SidebarScreen, label: 'Inventario'  },
  { key: 'operations' as SidebarScreen, label: 'Operaciones' },
  { key: 'stores'     as SidebarScreen, label: 'Locales'     },
];

const MENU_USER = [
  { key: 'sales'     as SidebarScreen, label: 'Ventas'     },
  { key: 'inventory' as SidebarScreen, label: 'Inventario' },
];

const SidebarContent = ({ active, onSelect, onClose, isDesktop }: {
  active: SidebarScreen; onSelect: (s: SidebarScreen) => void;
  onClose: () => void; isDesktop: boolean;
}) => {
  const { logout, roles } = useAuth();
  const isAdmin = roles.includes('admin');
  const menu = isAdmin ? MENU_ADMIN : MENU_USER;

  const handleSelect = (screen: SidebarScreen) => {
    onSelect(screen);
    if (!isDesktop) onClose();
  };

  return (
    <View style={styles.sidebar}>
      {/* Header: logo + cerrar (mobile) */}
      <View style={styles.sidebarHeader}>
        <Image
          source={require('../assets/images/logo_proyecto_Humberto.jpg')}
          style={styles.logo}
        />
        {!isDesktop && (
          <IconButton icon="close" size={22} iconColor="#161616" onPress={onClose} style={{ margin: 0 }} />
        )}
      </View>

      {/* Menú */}
      <ScrollView style={styles.menuScroll}>
        {menu.map(item => (
          <TouchableOpacity
            key={item.key}
            style={[styles.menuItem, active === item.key && styles.menuItemActive]}
            onPress={() => handleSelect(item.key)}
          >
            <Text style={[styles.menuLabel, active === item.key && styles.menuLabelActive]}>
              {item.label}
            </Text>
            {active === item.key && <View style={styles.activeBar} />}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
        <Text style={styles.logoutIcon}>→</Text>
        <Text style={styles.logoutText}>Cerrar sesión</Text>
      </TouchableOpacity>
    </View>
  );
};

const Sidebar: React.FC<Props> = ({ active, onSelect, visible, onClose }) => {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  if (isDesktop) {
    return <SidebarContent active={active} onSelect={onSelect} onClose={onClose} isDesktop />;
  }

  // Mobile: drawer modal
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <SidebarContent active={active} onSelect={onSelect} onClose={onClose} isDesktop={false} />
        <TouchableOpacity style={styles.overlayBg} onPress={onClose} />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay:           { flex: 1, flexDirection: 'row' },
  overlayBg:         { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },

  sidebar:           { width: 260, backgroundColor: '#fff', borderRightWidth: 1, borderRightColor: '#e8ecf2', flexDirection: 'column' },

  sidebarHeader:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderBottomWidth: 1, borderBottomColor: '#e8ecf2', backgroundColor: '#ffd43b' },
  logo:              { width: 42, height: 42, borderRadius: 21, borderWidth: 2, borderColor: 'rgba(0,0,0,0.15)' },

  storeSection:      { padding: 14, borderBottomWidth: 1, borderBottomColor: '#e8ecf2' },
  storeSectionLabel: { fontSize: 11, fontWeight: '800', color: '#6b7581', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  storeScroll:       { flexDirection: 'row' },
  storeChip:         { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#f4f6f8', borderWidth: 1, borderColor: '#e8ecf2', marginRight: 6 },
  storeChipActive:   { backgroundColor: '#ffd43b', borderColor: '#f5c400' },
  storeChipText:     { fontSize: 13, fontWeight: '700', color: '#6b7581' },
  storeChipTextActive:{ color: '#161616' },

  menuScroll:        { flex: 1, paddingTop: 8 },
  menuItem:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, marginHorizontal: 8, borderRadius: 12, marginBottom: 2, position: 'relative' },
  menuItemActive:    { backgroundColor: '#fff9e6' },
  menuLabel:         { fontSize: 15, fontWeight: '700', color: '#53606d' },
  menuLabelActive:   { color: '#161616', fontWeight: '900' },
  activeBar:         { position: 'absolute', left: 0, top: 6, bottom: 6, width: 4, backgroundColor: '#ffd43b', borderRadius: 2 },

  logoutBtn:         { flexDirection: 'row', alignItems: 'center', padding: 16, borderTopWidth: 1, borderTopColor: '#e8ecf2', gap: 10 },
  logoutIcon:        { fontSize: 18, color: '#d32121' },
  logoutText:        { fontSize: 14, fontWeight: '700', color: '#d32121' },
});

export default Sidebar;
