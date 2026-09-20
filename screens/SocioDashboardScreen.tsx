import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { REACT_APP_API_URL } from '../config';
import { COLOR, SPACE, RADIUS, FONT_SIZE, FONT_WEIGHT } from '../theme';
import { formatCurrency } from '../utils/numberFormat';

interface ActiveShiftDTO {
  code: string;
  username: string;
  openedAt: string;
  salesCount: number;
  salesTotal: number;
}

interface StoreDashboardDTO {
  storeId: number;
  storeName: string;
  hasActiveShift: boolean;
  activeShifts: ActiveShiftDTO[];
  shiftSalesCount: number;
  shiftSalesTotal: number;
  lowStockCount: number;
  totalProducts: number;
  estimatedValue: number;
}

interface DashboardDTO {
  stores: StoreDashboardDTO[];
  totalSalesToday: number;
  totalAmountToday: number;
}

const fmt = (v: number) =>
  `L ${v.toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtTime = (iso?: string) => {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit' });
  } catch { return '—'; }
};

// ─── Tarjeta de métricas de un local ─────────────────────────────────────────

const StoreCard = ({ store }: { store: StoreDashboardDTO }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={styles.storeCard}>
      {/* Header del local */}
      <View style={styles.storeHeader}>
        <View style={[styles.storeStatusDot, { backgroundColor: store.hasActiveShift ? COLOR.income : COLOR.inkMute }]} />
        <Text style={styles.storeName}>{store.storeName}</Text>
        <Text style={styles.storeStatus}>
          {store.hasActiveShift ? `${store.activeShifts.length} turno${store.activeShifts.length !== 1 ? 's' : ''} activo${store.activeShifts.length !== 1 ? 's' : ''}` : 'Sin turno activo'}
        </Text>
      </View>

      {/* Métricas hoy */}
      <View style={styles.kpiRow}>
        <View style={styles.kpiCell}>
          <MaterialCommunityIcons name="cart-check" size={18} color={COLOR.income} />
          <Text style={styles.kpiValue}>{store.shiftSalesCount}</Text>
          <Text style={styles.kpiLabel}>Ventas hoy</Text>
        </View>
        <View style={[styles.kpiCell, styles.kpiCellBorder]}>
          <MaterialCommunityIcons name="cash-multiple" size={18} color={COLOR.income} />
          <Text style={[styles.kpiValue, { color: COLOR.income }]}>{fmt(store.shiftSalesTotal)}</Text>
          <Text style={styles.kpiLabel}>Monto hoy</Text>
        </View>
        <View style={[styles.kpiCell, styles.kpiCellBorder]}>
          <MaterialCommunityIcons
            name="alert-circle-outline"
            size={18}
            color={store.lowStockCount > 0 ? COLOR.expense : COLOR.inkMute}
          />
          <Text style={[styles.kpiValue, { color: store.lowStockCount > 0 ? COLOR.expense : COLOR.ink }]}>
            {store.lowStockCount}
          </Text>
          <Text style={styles.kpiLabel}>Stock bajo</Text>
        </View>
        <View style={[styles.kpiCell, styles.kpiCellBorder]}>
          <MaterialCommunityIcons name="package-variant" size={18} color={COLOR.info} />
          <Text style={styles.kpiValue}>{store.totalProducts}</Text>
          <Text style={styles.kpiLabel}>Productos</Text>
        </View>
      </View>

      {/* Turnos activos (expandible) */}
      {store.hasActiveShift && (
        <TouchableOpacity style={styles.expandBtn} onPress={() => setExpanded(v => !v)}>
          <MaterialCommunityIcons name="clock-outline" size={14} color={COLOR.brandDeep} />
          <Text style={styles.expandBtnText}>
            {expanded ? 'Ocultar turnos activos' : 'Ver turnos activos'}
          </Text>
          <MaterialCommunityIcons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={COLOR.brandDeep} />
        </TouchableOpacity>
      )}

      {expanded && store.activeShifts.map((shift, i) => (
        <View key={i} style={styles.shiftRow}>
          <View style={styles.shiftLeft}>
            <Text style={styles.shiftCode}>{shift.code}</Text>
            <Text style={styles.shiftUser}>{shift.username} · desde {fmtTime(shift.openedAt)}</Text>
          </View>
          <View style={styles.shiftRight}>
            <Text style={styles.shiftSales}>{shift.salesCount} venta{shift.salesCount !== 1 ? 's' : ''}</Text>
            <Text style={[styles.shiftTotal, { color: COLOR.income }]}>{fmt(shift.salesTotal)}</Text>
          </View>
        </View>
      ))}
    </View>
  );
};

// ─── Pantalla principal ───────────────────────────────────────────────────────

const SocioDashboardScreen = () => {
  const { storeIds } = useAuth();
  const [dashboard, setDashboard] = useState<DashboardDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const params = storeIds.length > 0 ? `?storeIds=${storeIds.join(',')}` : '';
      const res = await fetch(`${REACT_APP_API_URL}/api/v2/dashboard${params}`);
      if (!res.ok) throw new Error('Error del servidor');
      setDashboard(await res.json());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [storeIds]);

  useFocusEffect(loadDashboard);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLOR.brand} />
      </View>
    );
  }

  if (error || !dashboard) {
    return (
      <View style={styles.center}>
        <MaterialCommunityIcons name="alert-circle-outline" size={40} color={COLOR.expense} />
        <Text style={styles.errorText}>No se pudo cargar el dashboard.</Text>
        <TouchableOpacity onPress={loadDashboard} style={styles.retryBtn}>
          <Text style={styles.retryText}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header con totales */}
      <View style={styles.totalsBanner}>
        <View style={styles.totalItem}>
          <Text style={styles.totalLabel}>VENTAS HOY</Text>
          <Text style={styles.totalValue}>{dashboard.totalSalesToday}</Text>
        </View>
        <View style={[styles.totalItem, { borderLeftWidth: 1, borderLeftColor: COLOR.brandDark }]}>
          <Text style={styles.totalLabel}>MONTO HOY</Text>
          <Text style={[styles.totalValue, { color: COLOR.income }]}>
            {fmt(Number(dashboard.totalAmountToday))}
          </Text>
        </View>
      </View>

      {/* Tarjeta por local */}
      {dashboard.stores.map(store => (
        <StoreCard key={store.storeId} store={store} />
      ))}

      {dashboard.stores.length === 0 && (
        <View style={styles.center}>
          <Text style={styles.errorText}>No hay locales asignados.</Text>
        </View>
      )}
    </ScrollView>
  );
};

export default SocioDashboardScreen;

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: COLOR.bg },
  content:      { padding: SPACE.s4, gap: SPACE.s4 },
  center:       { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACE.s6, gap: SPACE.s3 },
  errorText:    { fontSize: FONT_SIZE.body, color: COLOR.inkMute, textAlign: 'center' },
  retryBtn:     { paddingHorizontal: SPACE.s4, paddingVertical: SPACE.s2, backgroundColor: COLOR.brand, borderRadius: RADIUS.r2 },
  retryText:    { fontSize: FONT_SIZE.label, fontWeight: FONT_WEIGHT.semibold as any, color: COLOR.ink },

  totalsBanner: { flexDirection: 'row', backgroundColor: COLOR.brand, borderRadius: RADIUS.r3, overflow: 'hidden' },
  totalItem:    { flex: 1, alignItems: 'center', paddingVertical: SPACE.s4, gap: 4 },
  totalLabel:   { fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.inkOnBrand, letterSpacing: 0.5 },
  totalValue:   { fontSize: FONT_SIZE.h1, fontWeight: FONT_WEIGHT.black as any, color: COLOR.ink },

  storeCard:     { backgroundColor: COLOR.surface, borderRadius: RADIUS.r3, borderWidth: 1, borderColor: COLOR.border, overflow: 'hidden' },
  storeHeader:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACE.s4, paddingVertical: SPACE.s3, borderBottomWidth: 1, borderBottomColor: COLOR.border, gap: SPACE.s2 },
  storeStatusDot:{ width: 10, height: 10, borderRadius: RADIUS.full },
  storeName:     { fontSize: FONT_SIZE.label, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.ink, flex: 1 },
  storeStatus:   { fontSize: FONT_SIZE.caption, color: COLOR.inkMute },

  kpiRow:       { flexDirection: 'row' },
  kpiCell:      { flex: 1, alignItems: 'center', paddingVertical: SPACE.s3, gap: 3 },
  kpiCellBorder:{ borderLeftWidth: 1, borderLeftColor: COLOR.border },
  kpiValue:     { fontSize: FONT_SIZE.h2, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.ink },
  kpiLabel:     { fontSize: FONT_SIZE.caption, color: COLOR.inkMute, textAlign: 'center' },

  expandBtn:     { flexDirection: 'row', alignItems: 'center', gap: SPACE.s1, paddingHorizontal: SPACE.s4, paddingVertical: SPACE.s2, borderTopWidth: 1, borderTopColor: COLOR.border, backgroundColor: COLOR.bg },
  expandBtnText: { fontSize: FONT_SIZE.caption, color: COLOR.brandDeep, fontWeight: FONT_WEIGHT.semibold as any, flex: 1 },

  shiftRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACE.s4, paddingVertical: SPACE.s2, borderTopWidth: 1, borderTopColor: COLOR.border, backgroundColor: COLOR.surface },
  shiftLeft: { gap: 2 },
  shiftCode: { fontSize: FONT_SIZE.label, fontWeight: FONT_WEIGHT.semibold as any, color: COLOR.ink },
  shiftUser: { fontSize: FONT_SIZE.caption, color: COLOR.inkMute },
  shiftRight:{ alignItems: 'flex-end', gap: 2 },
  shiftSales:{ fontSize: FONT_SIZE.caption, color: COLOR.inkMute },
  shiftTotal:{ fontSize: FONT_SIZE.label, fontWeight: FONT_WEIGHT.bold as any },
});
