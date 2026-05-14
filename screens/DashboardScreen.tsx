import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, useWindowDimensions, RefreshControl,
} from 'react-native';
import { Button } from 'react-native-paper';
import axios from 'axios';
import { REACT_APP_API_URL } from '../config';
import { useAuth } from '../context/AuthContext';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface StoreDashboard {
  storeId: number;
  storeName: string;
  hasActiveShift: boolean;
  shiftCode: string | null;
  shiftUsername: string | null;
  shiftOpenedAt: string | null;
  shiftSalesCount: number;
  shiftSalesTotal: number;
  totalProducts: number;
  lowStockCount: number;
  estimatedValue: number;
}

interface DashboardData {
  stores: StoreDashboard[];
  totalActiveShifts: number;
  totalSalesToday: number;
  totalAmountToday: number;
  totalLowStockAlerts: number;
}

const money = (v: number) =>
  `L ${Number(v).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit' });

// ─── DashboardScreen ──────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const API = REACT_APP_API_URL;
  const { userName } = useAuth();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [data, setData]         = useState<DashboardData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]       = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get<DashboardData>(`${API}/api/v2/dashboard`);
      setData(res.data);
    } catch {
      setError('No se pudo cargar el dashboard.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (loading) return <ActivityIndicator size="large" color="#ffd43b" style={{ flex: 1, marginTop: 60 }} />;
  if (error)   return <View style={styles.centered}><Text style={styles.errorText}>{error}</Text><Button onPress={load}>Reintentar</Button></View>;
  if (!data)   return null;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ffd43b" />}
    >

      {/* ── Saludo ── */}
      <View style={styles.greetRow}>
        <View>
          <Text style={styles.greetTitle}>Buen día, {userName} 👋</Text>
          <Text style={styles.greetSub}>Resumen del sistema en tiempo real</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={load}>
          <Text style={styles.refreshIcon}>↻</Text>
        </TouchableOpacity>
      </View>

      {/* ── KPIs globales ── */}
      <View style={[styles.kpiRow, isDesktop && styles.kpiRowDesktop]}>
        <KpiCard icon="🏪" label="Locales activos"   value={String(data.stores.length)} />
        <KpiCard icon="⏱" label="Turnos abiertos"   value={String(data.totalActiveShifts)} highlight={data.totalActiveShifts > 0} />
        <KpiCard icon="🛒" label="Ventas hoy"        value={String(data.totalSalesToday)} />
        <KpiCard icon="💰" label="Total del día"     value={money(data.totalAmountToday)} />
        <KpiCard icon="⚠" label="Alertas stock"     value={String(data.totalLowStockAlerts)} warn={data.totalLowStockAlerts > 0} />
      </View>

      {/* ── Tarjetas por local ── */}
      <Text style={styles.sectionTitle}>Estado por local</Text>
      <View style={[styles.storeGrid, isDesktop && styles.storeGridDesktop]}>
        {data.stores.map(store => (
          <View key={store.storeId} style={styles.storeCard}>

            {/* Header de la tarjeta */}
            <View style={styles.storeCardHead}>
              <Text style={styles.storeName}>{store.storeName}</Text>
              <View style={[styles.shiftBadge, store.hasActiveShift ? styles.shiftOpen : styles.shiftClosed]}>
                <Text style={styles.shiftBadgeText}>
                  {store.hasActiveShift ? '● Turno abierto' : '○ Sin turno'}
                </Text>
              </View>
            </View>

            {/* Info del turno activo */}
            {store.hasActiveShift && store.shiftCode ? (
              <View style={styles.shiftInfo}>
                <Text style={styles.shiftCode}>{store.shiftCode}</Text>
                <Text style={styles.shiftMeta}>
                  {store.shiftUsername}  ·  desde {store.shiftOpenedAt ? fmtTime(store.shiftOpenedAt) : '—'}
                </Text>
              </View>
            ) : (
              <Text style={styles.noShiftText}>No hay turno activo para este local</Text>
            )}

            {/* Stats del turno */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{store.shiftSalesCount}</Text>
                <Text style={styles.statLabel}>Ventas</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{money(store.shiftSalesTotal)}</Text>
                <Text style={styles.statLabel}>Total turno</Text>
              </View>
            </View>

            {/* Inventario */}
            <View style={styles.inventoryRow}>
              <View style={[styles.inventoryStat, store.lowStockCount > 0 && styles.inventoryStatWarn]}>
                <Text style={[styles.inventoryIcon, store.lowStockCount > 0 && { color: '#c05f00' }]}>
                  {store.lowStockCount > 0 ? '⚠' : '📦'}
                </Text>
                <Text style={[styles.inventoryText, store.lowStockCount > 0 && { color: '#c05f00' }]}>
                  {store.lowStockCount > 0
                    ? `${store.lowStockCount} producto${store.lowStockCount !== 1 ? 's' : ''} con stock bajo`
                    : `${store.totalProducts} productos · stock OK`}
                </Text>
              </View>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

// ─── KpiCard (componente interno) ─────────────────────────────────────────────

const KpiCard = ({ icon, label, value, highlight, warn }: {
  icon: string; label: string; value: string; highlight?: boolean; warn?: boolean;
}) => (
  <View style={[styles.kpiCard, highlight && styles.kpiCardHL, warn && styles.kpiCardWarn]}>
    <Text style={styles.kpiIcon}>{icon}</Text>
    <Text style={styles.kpiValue}>{value}</Text>
    <Text style={styles.kpiLabel}>{label}</Text>
  </View>
);

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:             { flex: 1, backgroundColor: '#f4f6f8' },
  content:          { padding: 16, gap: 16 },
  centered:         { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  errorText:        { color: '#d32121', fontWeight: '700', fontSize: 15 },

  // Saludo
  greetRow:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  greetTitle:       { fontSize: 22, fontWeight: '950', color: '#161616', letterSpacing: -0.5 },
  greetSub:         { fontSize: 13, color: '#6b7581', fontWeight: '600', marginTop: 2 },
  refreshBtn:       { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e8ecf2', justifyContent: 'center', alignItems: 'center' },
  refreshIcon:      { fontSize: 20, color: '#53606d', fontWeight: '900' },

  // KPIs globales
  kpiRow:           { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpiRowDesktop:    { flexWrap: 'nowrap' },
  kpiCard:          { flex: 1, minWidth: 100, backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#e8ecf2', padding: 14, alignItems: 'center', gap: 4 },
  kpiCardHL:        { borderColor: '#168542', backgroundColor: '#f5fdf8' },
  kpiCardWarn:      { borderColor: '#efd37d', backgroundColor: '#fff9e6' },
  kpiIcon:          { fontSize: 24 },
  kpiValue:         { fontSize: 22, fontWeight: '950', color: '#161616', letterSpacing: -0.5 },
  kpiLabel:         { fontSize: 11, fontWeight: '700', color: '#6b7581', textAlign: 'center' },

  // Sección
  sectionTitle:     { fontSize: 16, fontWeight: '950', color: '#161616' },

  // Grid de locales
  storeGrid:        { gap: 12 },
  storeGridDesktop: { flexDirection: 'row', flexWrap: 'wrap' },

  // Tarjeta de local
  storeCard:        { flex: 1, minWidth: 280, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#e8ecf2', padding: 16, gap: 12 },
  storeCardHead:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  storeName:        { fontSize: 18, fontWeight: '950', color: '#161616' },

  shiftBadge:       { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  shiftOpen:        { backgroundColor: '#e9f8ef' },
  shiftClosed:      { backgroundColor: '#f4f6f8' },
  shiftBadgeText:   { fontSize: 12, fontWeight: '800', color: '#53606d' },

  shiftInfo:        { gap: 2 },
  shiftCode:        { fontSize: 14, fontWeight: '900', color: '#161616' },
  shiftMeta:        { fontSize: 12, color: '#6b7581', fontWeight: '600' },
  noShiftText:      { fontSize: 13, color: '#b8c0cc', fontWeight: '600' },

  statsRow:         { flexDirection: 'row', backgroundColor: '#f4f6f8', borderRadius: 12, padding: 12 },
  statItem:         { flex: 1, alignItems: 'center', gap: 2 },
  statDivider:      { width: 1, backgroundColor: '#e8ecf2', marginVertical: 2 },
  statValue:        { fontSize: 18, fontWeight: '950', color: '#161616' },
  statLabel:        { fontSize: 11, fontWeight: '700', color: '#6b7581' },

  inventoryRow:     { gap: 6 },
  inventoryStat:    { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#f4f6f8', borderRadius: 10, padding: 8 },
  inventoryStatWarn:{ backgroundColor: '#fff9e6', borderWidth: 1, borderColor: '#efd37d' },
  inventoryIcon:    { fontSize: 16 },
  inventoryText:    { fontSize: 12, fontWeight: '700', color: '#53606d' },
});
