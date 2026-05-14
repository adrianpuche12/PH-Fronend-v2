import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, useWindowDimensions,
} from 'react-native';
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
        <ScrollView contentContainerStyle={styles.list}>
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
  root:           { flex: 1, backgroundColor: '#f4f6f8' },

  header:         { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12, padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e8ecf2' },
  headerTitle:    { fontSize: 20, fontWeight: '900', color: '#161616', flex: 1 },
  storeChips:     { flexDirection: 'row', gap: 6 },
  chip:           { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#f4f6f8', borderWidth: 1, borderColor: '#e8ecf2' },
  chipActive:     { backgroundColor: '#ffd43b', borderColor: '#f5c400' },
  chipText:       { fontSize: 13, fontWeight: '700', color: '#6b7581' },
  chipTextActive: { color: '#161616', fontWeight: '900' },

  empty:          { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10, padding: 32 },
  emptyIcon:      { fontSize: 40 },
  emptyText:      { fontSize: 15, color: '#6b7581', fontWeight: '700', textAlign: 'center' },
  error:          { textAlign: 'center', color: '#d32121', marginTop: 40, fontWeight: '700' },

  list:           { padding: 14, gap: 10 },

  shiftCard:      { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#e8ecf2', overflow: 'hidden' },
  shiftRow:       { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 8 },
  shiftCodeRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  shiftCode:      { fontSize: 14, fontWeight: '900', color: '#161616' },
  shiftMeta:      { fontSize: 12, color: '#6b7581', fontWeight: '600' },
  expandIcon:     { fontSize: 14, color: '#6b7581' },

  statusBadge:    { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  statusOpen:     { backgroundColor: '#e9f8ef' },
  statusClosed:   { backgroundColor: '#f4f6f8' },
  statusText:     { fontSize: 11, fontWeight: '900', color: '#53606d' },

  detail:         { borderTopWidth: 1, borderTopColor: '#f4f6f8', padding: 14, backgroundColor: '#fcfcfb' },

  detailHeader:   { flexDirection: 'row', paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: '#e8ecf2', marginBottom: 4 },
  detailRow:      { flexDirection: 'row', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#f4f6f8' },
  detailCol:      { fontSize: 11, fontWeight: '900', color: '#53606d' },
  detailCell:     { fontSize: 12, fontWeight: '600', color: '#161616' },
  detailColName:  { flex: 1 },

  detailTotals:   { marginTop: 10, gap: 4 },
  totalLine:      { flexDirection: 'row', justifyContent: 'space-between' },
  totalFinal:     { borderTopWidth: 2, borderTopColor: '#161616', paddingTop: 6, marginTop: 4 },
  totalLabel:     { fontSize: 12, fontWeight: '700', color: '#6b7581' },
  totalFinalLabel:{ fontSize: 15, fontWeight: '950', color: '#161616' },
  totalFinalAmount:{ fontSize: 17, fontWeight: '950', color: '#161616' },

  noSalesText:    { fontSize: 13, color: '#6b7581', fontWeight: '700', textAlign: 'center', padding: 8 },
});
