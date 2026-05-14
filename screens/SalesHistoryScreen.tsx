import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, useWindowDimensions, RefreshControl,
} from 'react-native';
import { COLOR, SPACE, RADIUS, FONT_SIZE, FONT_WEIGHT, SHADOW } from '../theme';
import axios from 'axios';
import { REACT_APP_API_URL } from '../config';
import { useStore } from '../context/StoreContext';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface ShiftRecord {
  id: number;
  code: string;
  username: string;
  status: string;
  storeId: number;
  storeName: string;
  openedAt: string;
  closedAt: string | null;
}

interface ProductSummaryItem {
  productId: number;
  productName: string;
  quantity: number;
  subtotal: number;
}

interface ShiftSummary {
  date: string;
  storeId: number;
  storeName: string;
  totalSales: number;
  totalSubtotal: number;
  totalIsv: number;
  totalAmount: number;
  productSummary: ProductSummaryItem[];
}

const money = (v: number) => `L ${Number(v).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString('es-HN', { day: '2-digit', month: '2-digit', year: 'numeric' });

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit' });

// ─── SalesHistoryScreen ───────────────────────────────────────────────────────

export default function SalesHistoryScreen() {
  const API = REACT_APP_API_URL;
  const { stores, selectedStore, setSelectedStore } = useStore();

  const [shifts, setShifts]           = useState<ShiftRecord[]>([]);
  const [loading, setLoading]         = useState(false);
  const [refreshing, setRefreshing]   = useState(false);
  const [expanded, setExpanded]       = useState<Record<number, boolean>>({});
  const [summaries, setSummaries]     = useState<Record<number, ShiftSummary>>({});
  const [loadingSum, setLoadingSum]   = useState<Record<number, boolean>>({});
  const [error, setError]             = useState('');

  // ── Cargar turnos del local ───────────────────────────────────────────────

  const loadShifts = useCallback(async () => {
    if (!selectedStore) return;
    setLoading(true);
    setError('');
    try {
      const res = await axios.get<ShiftRecord[]>(
        `${API}/api/v2/stores/${selectedStore.id}/shifts`
      );
      setShifts(res.data);
      setExpanded({});
      setSummaries({});
    } catch {
      setError('No se pudo cargar el historial de turnos.');
    } finally { setLoading(false); }
  }, [selectedStore]);

  useEffect(() => { loadShifts(); }, [loadShifts]);

  const onRefresh = async () => { setRefreshing(true); await loadShifts(); setRefreshing(false); };

  // ── Expandir turno y cargar resumen ──────────────────────────────────────

  const toggleShift = async (shift: ShiftRecord) => {
    const isOpen = expanded[shift.id];
    setExpanded(prev => ({ ...prev, [shift.id]: !isOpen }));

    if (!isOpen && !summaries[shift.id]) {
      setLoadingSum(prev => ({ ...prev, [shift.id]: true }));
      try {
        const res = await axios.get<ShiftSummary>(
          `${API}/api/v2/shifts/${shift.id}/summary`
        );
        setSummaries(prev => ({ ...prev, [shift.id]: res.data }));
      } catch { /* resumen no disponible */ }
      finally { setLoadingSum(prev => ({ ...prev, [shift.id]: false })); }
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <View style={styles.root}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📊 Historial de ventas</Text>
        {/* Selector de local */}
        <View style={styles.storeChips}>
          {stores.map(s => (
            <TouchableOpacity
              key={s.id}
              style={[styles.chip, selectedStore?.id === s.id && styles.chipActive]}
              onPress={() => setSelectedStore(s)}
            >
              <Text style={[styles.chipText, selectedStore?.id === s.id && styles.chipTextActive]}>
                {s.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── Contenido ── */}
      {loading ? (
        <ActivityIndicator size="large" color="#ffd43b" style={{ marginTop: 40 }} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : shifts.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyText}>No hay turnos registrados para este local.</Text>
        </View>
      ) : (
        <ScrollView
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ffd43b" />}
          >
          {shifts.map(shift => {
            const isOpen    = expanded[shift.id];
            const summary   = summaries[shift.id];
            const isLoading = loadingSum[shift.id];
            const isClosed  = shift.status === 'CLOSED';

            return (
              <View key={shift.id} style={styles.shiftCard}>

                {/* ── Fila principal del turno ── */}
                <TouchableOpacity style={styles.shiftRow} onPress={() => toggleShift(shift)}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.shiftCodeRow}>
                      <Text style={styles.shiftCode}>{shift.code}</Text>
                      <View style={[styles.statusBadge, isClosed ? styles.statusClosed : styles.statusOpen]}>
                        <Text style={styles.statusText}>{isClosed ? 'Cerrado' : 'Abierto'}</Text>
                      </View>
                    </View>
                    <Text style={styles.shiftMeta}>
                      {fmt(shift.openedAt)}  ·  {fmtTime(shift.openedAt)}
                      {shift.closedAt ? ` — ${fmtTime(shift.closedAt)}` : ''}
                      {' · '}{shift.username}
                    </Text>
                  </View>
                  <Text style={styles.expandIcon}>{isOpen ? '▲' : '▼'}</Text>
                </TouchableOpacity>

                {/* ── Detalle expandible ── */}
                {isOpen && (
                  <View style={styles.detail}>
                    {isLoading ? (
                      <ActivityIndicator color="#ffd43b" style={{ margin: 12 }} />
                    ) : summary && summary.totalSales > 0 ? (
                      <>
                        {/* Tabla de productos */}
                        <View style={styles.detailHeader}>
                          <Text style={[styles.detailCol, styles.detailColName]}>Producto</Text>
                          <Text style={[styles.detailCol, { width: 44, textAlign: 'center' }]}>Cant.</Text>
                          <Text style={[styles.detailCol, { width: 88, textAlign: 'right' }]}>Subtotal</Text>
                        </View>
                        {summary.productSummary.map((p, i) => (
                          <View key={i} style={styles.detailRow}>
                            <Text style={[styles.detailCell, styles.detailColName]} numberOfLines={1}>{p.productName}</Text>
                            <Text style={[styles.detailCell, { width: 44, textAlign: 'center' }]}>{p.quantity}</Text>
                            <Text style={[styles.detailCell, { width: 88, textAlign: 'right' }]}>{money(p.subtotal)}</Text>
                          </View>
                        ))}

                        {/* Totales */}
                        <View style={styles.detailTotals}>
                          <View style={styles.totalLine}>
                            <Text style={styles.totalLabel}>{summary.totalSales} venta{summary.totalSales !== 1 ? 's' : ''}</Text>
                            <Text style={styles.totalLabel}>Subtotal: {money(summary.totalSubtotal)}</Text>
                          </View>
                          <View style={styles.totalLine}>
                            <Text style={styles.totalLabel}>ISV (15%)</Text>
                            <Text style={styles.totalLabel}>{money(summary.totalIsv)}</Text>
                          </View>
                          <View style={[styles.totalLine, styles.totalFinal]}>
                            <Text style={styles.totalFinalLabel}>TOTAL</Text>
                            <Text style={styles.totalFinalAmount}>{money(summary.totalAmount)}</Text>
                          </View>
                        </View>
                      </>
                    ) : (
                      <Text style={styles.noSalesText}>
                        {summary ? 'Turno sin ventas registradas.' : 'No se pudo cargar el resumen.'}
                      </Text>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

// ─── Estilos ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:           { flex: 1, backgroundColor: COLOR.bg },

  header:         { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: SPACE.s3, padding: SPACE.s4, backgroundColor: COLOR.surface, borderBottomWidth: 1, borderBottomColor: COLOR.border },
  headerTitle:    { fontSize: FONT_SIZE.h1, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.ink, flex: 1 },
  storeChips:     { flexDirection: 'row', gap: SPACE.s2 },
  chip:           { paddingHorizontal: SPACE.s4, paddingVertical: 7, borderRadius: RADIUS.full, backgroundColor: COLOR.bg, borderWidth: 1, borderColor: COLOR.border },
  chipActive:     { backgroundColor: COLOR.brand, borderColor: COLOR.brandDark },
  chipText:       { fontSize: FONT_SIZE.label, fontWeight: FONT_WEIGHT.semibold as any, color: COLOR.ink2 },
  chipTextActive: { color: COLOR.ink, fontWeight: FONT_WEIGHT.bold as any },

  empty:          { flex: 1, justifyContent: 'center', alignItems: 'center', gap: SPACE.s2, padding: SPACE.s8 },
  emptyIcon:      { fontSize: 40 },
  emptyText:      { fontSize: FONT_SIZE.body, color: COLOR.inkMute, fontWeight: FONT_WEIGHT.semibold as any, textAlign: 'center' },
  error:          { textAlign: 'center', color: COLOR.expense, marginTop: 40, fontWeight: FONT_WEIGHT.semibold as any },

  list:           { padding: SPACE.s4, gap: SPACE.s2 },

  shiftCard:      { backgroundColor: COLOR.surface, borderRadius: RADIUS.r3, borderWidth: 1, borderColor: COLOR.border, overflow: 'hidden', ...SHADOW.sm },
  shiftRow:       { flexDirection: 'row', alignItems: 'center', padding: SPACE.s4, gap: SPACE.s2 },
  shiftCodeRow:   { flexDirection: 'row', alignItems: 'center', gap: SPACE.s2, marginBottom: SPACE.s1 },
  shiftCode:      { fontSize: FONT_SIZE.label, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.ink },
  shiftMeta:      { fontSize: FONT_SIZE.caption, color: COLOR.inkMute, fontWeight: FONT_WEIGHT.medium as any },
  expandIcon:     { fontSize: 14, color: COLOR.inkMute },

  statusBadge:    { borderRadius: RADIUS.r2, paddingHorizontal: SPACE.s2, paddingVertical: 3 },
  statusOpen:     { backgroundColor: COLOR.incomeTint },
  statusClosed:   { backgroundColor: COLOR.surface2 },
  statusText:     { fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.ink2 },

  detail:         { borderTopWidth: 1, borderTopColor: COLOR.border, padding: SPACE.s4, backgroundColor: COLOR.bgAlt },

  detailHeader:   { flexDirection: 'row', paddingBottom: SPACE.s2, borderBottomWidth: 1, borderBottomColor: COLOR.border, marginBottom: SPACE.s1 },
  detailRow:      { flexDirection: 'row', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: COLOR.border },
  detailCol:      { fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.inkMute },
  detailCell:     { fontSize: FONT_SIZE.label, fontWeight: FONT_WEIGHT.medium as any, color: COLOR.ink },
  detailColName:  { flex: 1 },

  detailTotals:   { marginTop: SPACE.s2, gap: SPACE.s1 },
  totalLine:      { flexDirection: 'row', justifyContent: 'space-between' },
  totalFinal:     { borderTopWidth: 2, borderTopColor: COLOR.ink, paddingTop: SPACE.s2, marginTop: SPACE.s1 },
  totalLabel:     { fontSize: FONT_SIZE.label, fontWeight: FONT_WEIGHT.semibold as any, color: COLOR.inkMute },
  totalFinalLabel:{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.ink },
  totalFinalAmount:{ fontSize: FONT_SIZE.h2, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.ink },

  noSalesText:    { fontSize: FONT_SIZE.label, color: COLOR.inkMute, fontWeight: FONT_WEIGHT.semibold as any, textAlign: 'center', padding: SPACE.s2 },
});
