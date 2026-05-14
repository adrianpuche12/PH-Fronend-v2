import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Image, Modal, useWindowDimensions,
} from 'react-native';
import { IconButton } from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import { COLOR, SPACE, RADIUS, FONT_SIZE, FONT_WEIGHT, SHADOW, CONTROL } from '../theme';

export type SidebarScreen =
  | 'dashboard' | 'operations' | 'inventory' | 'stores'
  | 'sales' | 'salesHistory' | 'users';

interface Props {
  active: SidebarScreen;
  onSelect: (screen: SidebarScreen) => void;
  visible: boolean;
  onClose: () => void;
}

const MENU_ADMIN: { key: SidebarScreen; label: string; icon: string }[] = [
  { key: 'dashboard',    label: 'Dashboard',        icon: '◈' },
  { key: 'sales',        label: 'Ventas',            icon: '🛒' },
  { key: 'salesHistory', label: 'Historial ventas',  icon: '📋' },
  { key: 'inventory',    label: 'Inventario',        icon: '📦' },
  { key: 'users',        label: 'Usuarios',          icon: '👥' },
  { key: 'operations',   label: 'Operaciones',       icon: '⚙' },
  { key: 'stores',       label: 'Locales',           icon: '🏪' },
];

const MENU_USER: { key: SidebarScreen; label: string; icon: string }[] = [
  { key: 'sales',        label: 'Ventas',     icon: '🛒' },
  { key: 'inventory',    label: 'Inventario', icon: '📦' },
];

const SidebarContent = ({ active, onSelect, onClose, isDesktop }: {
  active: SidebarScreen;
  onSelect: (s: SidebarScreen) => void;
  onClose: () => void;
  isDesktop: boolean;
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

      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.brand}>
          <Image
            source={require('../assets/images/logo_proyecto_Humberto.jpg')}
            style={styles.logo}
          />
          <View style={styles.brandText}>
            <Text style={styles.brandName}>Pollos Hermanos</Text>
            <Text style={styles.brandSub}>Sistema de gestión</Text>
          </View>
        </View>
        {!isDesktop && (
          <IconButton
            icon="close"
            size={20}
            iconColor={COLOR.ink2}
            onPress={onClose}
            style={{ margin: 0 }}
          />
        )}
      </View>

      {/* ── Menú ── */}
      <ScrollView style={styles.menuScroll} showsVerticalScrollIndicator={false}>
        {menu.map(item => {
          const isActive = active === item.key;
          return (
            <TouchableOpacity
              key={item.key}
              style={[styles.menuItem, isActive && styles.menuItemActive]}
              onPress={() => handleSelect(item.key)}
              activeOpacity={0.7}
            >
              <Text style={styles.menuIcon}>{item.icon}</Text>
              <Text style={[styles.menuLabel, isActive && styles.menuLabelActive]}>
                {item.label}
              </Text>
              {isActive && <View style={styles.activeBar} />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── Footer: logout ── */}
      <TouchableOpacity style={styles.logoutBtn} onPress={logout} activeOpacity={0.7}>
        <Text style={styles.logoutIcon}>→</Text>
        <Text style={styles.logoutLabel}>Cerrar sesión</Text>
      </TouchableOpacity>
    </View>
  );
};

const Sidebar: React.FC<Props> = ({ active, onSelect, visible, onClose }) => {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  if (isDesktop) {
    return (
      <SidebarContent
        active={active}
        onSelect={onSelect}
        onClose={onClose}
        isDesktop
      />
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <SidebarContent
          active={active}
          onSelect={onSelect}
          onClose={onClose}
          isDesktop={false}
        />
        <TouchableOpacity style={styles.overlayBg} onPress={onClose} />
      </View>
    </Modal>
  );
};

const SIDEBAR_W = 260;

const styles = StyleSheet.create({
  overlay:   { flex: 1, flexDirection: 'row' },
  overlayBg: { flex: 1, backgroundColor: COLOR.overlay },

  sidebar: {
    width: SIDEBAR_W,
    backgroundColor: COLOR.surface,
    borderRightWidth: 1,
    borderRightColor: COLOR.border,
    flexDirection: 'column',
    ...SHADOW.md,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACE.s4,
    paddingVertical: SPACE.s3,
    backgroundColor: COLOR.brand,
    borderBottomWidth: 1,
    borderBottomColor: COLOR.brandDark,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.s2,
    flex: 1,
  },
  logo: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    borderWidth: 2,
    borderColor: COLOR.brandDeep,
  },
  brandText: { flex: 1 },
  brandName: {
    fontSize: FONT_SIZE.label,
    fontWeight: FONT_WEIGHT.bold as any,
    color: COLOR.ink,
  },
  brandSub: {
    fontSize: FONT_SIZE.caption,
    color: COLOR.ink2,
    marginTop: 1,
  },

  // Menú
  menuScroll: { flex: 1, paddingTop: SPACE.s2 },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACE.s4,
    paddingVertical: SPACE.s3,
    marginHorizontal: SPACE.s2,
    borderRadius: RADIUS.r2,
    marginBottom: 2,
    gap: SPACE.s3,
    position: 'relative',
  },
  menuItemActive: { backgroundColor: COLOR.brandTint },
  menuIcon:  { fontSize: 15, width: 20, textAlign: 'center' },
  menuLabel: {
    fontSize: FONT_SIZE.body,
    fontWeight: FONT_WEIGHT.medium as any,
    color: COLOR.ink2,
    flex: 1,
  },
  menuLabelActive: {
    color: COLOR.ink,
    fontWeight: FONT_WEIGHT.semibold as any,
  },
  activeBar: {
    position: 'absolute',
    left: 0,
    top: 8,
    bottom: 8,
    width: 3,
    backgroundColor: COLOR.brand,
    borderRadius: RADIUS.full,
  },

  // Logout
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.s2,
    padding: SPACE.s4,
    borderTopWidth: 1,
    borderTopColor: COLOR.border,
  },
  logoutIcon:  { fontSize: 16, color: COLOR.expense },
  logoutLabel: {
    fontSize: FONT_SIZE.label,
    fontWeight: FONT_WEIGHT.semibold as any,
    color: COLOR.expense,
  },
});

export default Sidebar;
