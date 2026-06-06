import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, useWindowDimensions, RefreshControl,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { COLOR, SPACE, RADIUS, FONT_SIZE, FONT_WEIGHT, SHADOW } from '../theme';
import { formatHnl, formatDate, formatTime } from '../utils/format';
import axios from 'axios';
import { REACT_APP_API_URL } from '../config';
import { useStore } from '../context/StoreContext';
import DateRangePicker from '../components/DateRangePicker';
import StoreDropdown from '../components/StoreDropdown';

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
  openingCashAmount: number | null;
  totalCashSales: number | null;
  totalCardSales: number | null;
  totalShiftExpenses: number | null;
  declaredCashAmount: number | null;
  cashDifference: number | null;
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


// ─── SalesHistoryScreen ───────────────────────────────────────────────────────

interface Props {
  /** Si se pasa, filtra los turnos por ese username y oculta el selector de local. */
  usernameFilter?: string;
}

export default function SalesHistoryScreen({ usernameFilter }: Props) {
  const API = REACT_APP_API_URL;
  const { stores, selectedStore, setSelectedStore } = useStore();

  const [shifts, setShifts]           = useState<ShiftRecord[]>([]);
  const PAGE_SIZE = 20;

  const [loading, setLoading]         = useState(false);
  const [refreshing, setRefreshing]   = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore]         = useState(true);
  const [page, setPage]               = useState(0);
  const [dateFrom, setDateFrom]       = useState('');
  const [dateTo, setDateTo]           = useState('');
  const [expanded, setExpanded]       = useState<Record<number, boolean>>({});
  const [summaries, setSummaries]     = useState<Record<number, ShiftSummary>>({});
  const [loadingSum, setLoadingSum]   = useState<Record<number, boolean>>({});
  const [error, setError]             = useState('');

  // ── Cargar turnos del local (primera página) ─────────────────────────────

  const buildShiftsUrl = (storeId: number, pageNum: number) => {
    if (usernameFilter) {
      return `${API}/api/v2/shifts?username=${encodeURIComponent(usernameFilter)}&page=${pageNum}&size=${PAGE_SIZE}`;
    }
    let url = `${API}/api/v2/stores/${storeId}/shifts?page=${pageNum}&size=${PAGE_SIZE}`;
    if (dateFrom) url += `&from=${dateFrom}`;
    if (dateTo)   url += `&to=${dateTo}`;
    return url;
  };

  const loadShifts = useCallback(async () => {
    if (!usernameFilter && !selectedStore) return;
    setLoading(true);
    setError('');
    try {
      const res = await axios.get<ShiftRecord[]>(buildShiftsUrl(selectedStore?.id ?? 0, 0));
      setShifts(res.data);
      setPage(0);
      setHasMore(res.data.length === PAGE_SIZE);
      setExpanded({});
      setSummaries({});
    } catch {
      setError('No se pudo cargar el historial de turnos.');
    } finally { setLoading(false); }
  }, [selectedStore, usernameFilter, dateFrom, dateTo]);

  // ── Cargar más turnos ─────────────────────────────────────────────────────

  const loadMore = async () => {
    if ((!usernameFilter && !selectedStore) || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const res = await axios.get<ShiftRecord[]>(buildShiftsUrl(selectedStore?.id ?? 0, nextPage));
      setShifts(prev => [...prev, ...res.data]);
      setPage(nextPage);
      setHasMore(res.data.length === PAGE_SIZE);
    } catch { /* silencioso */ }
    finally { setLoadingMore(false); }
  };

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
        <Text style={styles.headerTitle}>
          {usernameFilter ? 'Mis ventas' : 'Historial de ventas'}
        </Text>
        {/* Selector de local — solo visible para admin (sin filtro de usuario) */}
        {!usernameFilter && (
          <StoreDropdown
            stores={stores}
            selectedId={selectedStore?.id ?? null}
            onSelect={(id) => {
              const s = stores.find(s => s.id === id);
              if (s) setSelectedStore(s);
            }}
          />
        )}
      </View>

      {/* Filtro de fechas — solo admin */}
      {!usernameFilter && (
        <View style={styles.dateFilterRow}>
          <DateRangePicker
            from={dateFrom}
            to={dateTo}
            onChange={(f, t) => { setDateFrom(f); setDateTo(t); }}
            label="Filtrar por fechas"
          />
        </View>
      )}

      {/* ── Contenido ── */}
      {loading ? (
        <ActivityIndicator size="large" color={COLOR.brand} style={{ marginTop: 40 }} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : shifts.length === 0 ? (
        <View style={styles.empty}>
          <MaterialCommunityIcons name="receipt-text-outline" size={40} color={COLOR.inkDisabled} />
          <Text style={styles.emptyText}>
            {usernameFilter ? 'No tenés ventas registradas todavía.' : 'No hay turnos registrados para este local.'}
          </Text>
        </View>
      ) : (
        <ScrollView
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLOR.brand} />}
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
                      {/* Badge de diferencia de caja — solo en turnos cerrados con reconciliación */}
                      {isClosed && shift.cashDifference != null && (() => {
                        const diff = shift.cashDifference;
                        const isOk = Math.abs(diff) < 0.01;
                        const isSurplus = diff > 0;
                        const badgeColor = isOk ? COLOR.income : isSurplus ? COLOR.info : COLOR.expense;
                        const badgeIcon  = isOk ? 'check-circle' : isSurplus ? 'arrow-up-circle' : 'alert-circle';
                        const badgeText  = isOk ? 'Cuadrada' : isSurplus ? `+${formatHnl(diff)}` : formatHnl(diff);
                        return (
                          <View style={[styles.diffBadge, { backgroundColor: badgeColor + '20', borderColor: badgeColor }]}>
                            <MaterialCommunityIcons name={badgeIcon} size={12} color={badgeColor} />
                            <Text style={[styles.diffBadgeText, { color: badgeColor }]}>{badgeText}</Text>
                          </View>
                        );
                      })()}
                    </View>
                    <Text style={styles.shiftMeta}>
                      {formatDate(shift.openedAt)}  ·  {formatTime(shift.openedAt)}
                      {shift.closedAt ? ` — ${formatTime(shift.closedAt)}` : ''}
                      {' · '}{shift.username}
                    </Text>
                  </View>
                  <MaterialCommunityIcons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={COLOR.inkMute} />
                </TouchableOpacity>

                {/* ── Detalle expandible ── */}
                {isOpen && (
                  <View style={styles.detail}>
                    {isLoading ? (
                      <ActivityIndicator color={COLOR.brand} style={{ margin: 12 }} />
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
                            <Text style={[styles.detailCell, { width: 88, textAlign: 'right' }]}>{formatHnl(p.subtotal)}</Text>
                          </View>
                        ))}

                        {/* Totales */}
                        <View style={styles.detailTotals}>
                          <View style={styles.totalLine}>
                            <Text style={styles.totalLabel}>{summary.totalSales} venta{summary.totalSales !== 1 ? 's' : ''}</Text>
                            <Text style={styles.totalLabel}>Subtotal: {formatHnl(summary.totalSubtotal)}</Text>
                          </View>
                          <View style={[styles.totalLine, styles.totalFinal]}>
                            <Text style={styles.totalFinalLabel}>TOTAL</Text>
                            <Text style={styles.totalFinalAmount}>{formatHnl(summary.totalAmount)}</Text>
                          </View>
                        </View>

                        {/* Reconciliación de caja — solo si hay datos */}
                        {isClosed && shift.declaredCashAmount != null && (
                          <View style={styles.recBox}>
                            <Text style={styles.recTitle}>Reconciliación de caja</Text>
                            <View style={styles.recLine}>
                              <Text style={styles.recLabelHist}>Fondo inicial</Text>
                              <Text style={styles.recValueHist}>{formatHnl(shift.openingCashAmount ?? 0)}</Text>
                            </View>
                            <View style={styles.recLine}>
                              <Text style={styles.recLabelHist}>Ventas efectivo</Text>
                              <Text style={styles.recValueHist}>{formatHnl(shift.totalCashSales ?? 0)}</Text>
                            </View>
                            {(shift.totalShiftExpenses ?? 0) > 0 && (
                              <View style={styles.recLine}>
                                <Text style={[styles.recLabelHist, { color: COLOR.expense }]}>Egresos del turno</Text>
                                <Text style={[styles.recValueHist, { color: COLOR.expense }]}>− {formatHnl(shift.totalShiftExpenses ?? 0)}</Text>
                              </View>
                            )}
                            <View style={[styles.recLine, { borderTopWidth: 1, borderTopColor: COLOR.border, paddingTop: SPACE.s1 }]}>
                              <Text style={[styles.recLabelHist, { fontWeight: FONT_WEIGHT.bold as any }]}>Total esperado</Text>
                              <Text style={[styles.recValueHist, { fontWeight: FONT_WEIGHT.bold as any }]}>
                                {formatHnl((shift.openingCashAmount ?? 0) + (shift.totalCashSales ?? 0) - (shift.totalShiftExpenses ?? 0))}
                              </Text>
                            </View>
                            <View style={styles.recLine}>
                              <Text style={styles.recLabelHist}>Efectivo contado</Text>
                              <Text style={styles.recValueHist}>{formatHnl(shift.declaredCashAmount)}</Text>
                            </View>
                            {(shift.totalCardSales ?? 0) > 0 && (
                              <View style={styles.recLine}>
                                <Text style={[styles.recLabelHist, { color: COLOR.info }]}>Tarjeta</Text>
                                <Text style={[styles.recValueHist, { color: COLOR.info }]}>{formatHnl(shift.totalCardSales ?? 0)}</Text>
                              </View>
                            )}
                            {(() => {
                              const diff = shift.cashDifference ?? 0;
                              const isOk = Math.abs(diff) < 0.01;
                              const c = isOk ? COLOR.income : diff > 0 ? COLOR.info : COLOR.expense;
                              return (
                                <View style={[styles.recLine, { borderTopWidth: 1, borderTopColor: COLOR.border, marginTop: SPACE.s1, paddingTop: SPACE.s1 }]}>
                                  <Text style={[styles.recLabelHist, { color: c, fontWeight: FONT_WEIGHT.bold as any }]}>
                                    {isOk ? 'Caja cuadrada' : diff > 0 ? 'Sobrante' : 'Faltante'}
                                  </Text>
                                  <Text style={[styles.recValueHist, { color: c, fontWeight: FONT_WEIGHT.bold as any }]}>
                                    {isOk ? '—' : `${diff > 0 ? '+' : ''}${formatHnl(diff)}`}
                                  </Text>
                                </View>
                              );
                            })()}
                          </View>
                        )}
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

          {/* ── Cargar más ── */}
          {hasMore && (
            <TouchableOpacity
              style={styles.loadMoreBtn}
              onPress={loadMore}
              disabled={loadingMore}
            >
              {loadingMore
                ? <ActivityIndicator size="small" color={COLOR.brand} />
                : <Text style={styles.loadMoreText}>Cargar más turnos</Text>
              }
            </TouchableOpacity>
          )}
          {!hasMore && shifts.length > 0 && (
            <Text style={styles.noMoreText}>— Fin del historial —</Text>
          )}
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
  storeChips:     { flexShrink: 1 },
  chip:           { paddingHorizontal: SPACE.s4, paddingVertical: 7, borderRadius: RADIUS.full, backgroundColor: COLOR.bg, borderWidth: 1, borderColor: COLOR.border },
  chipActive:     { backgroundColor: COLOR.brand, borderColor: COLOR.brandDark },
  chipText:       { fontSize: FONT_SIZE.label, fontWeight: FONT_WEIGHT.semibold as any, color: COLOR.ink2 },
  chipTextActive: { color: COLOR.ink, fontWeight: FONT_WEIGHT.bold as any },

  dateFilterRow:  { paddingHorizontal: SPACE.s4, paddingVertical: SPACE.s2, backgroundColor: COLOR.surface, borderBottomWidth: 1, borderBottomColor: COLOR.border },

  empty:          { flex: 1, justifyContent: 'center', alignItems: 'center', gap: SPACE.s2, padding: SPACE.s8 },
  emptyText:      { fontSize: FONT_SIZE.body, color: COLOR.inkMute, fontWeight: FONT_WEIGHT.semibold as any, textAlign: 'center' },
  error:          { textAlign: 'center', color: COLOR.expense, marginTop: 40, fontWeight: FONT_WEIGHT.semibold as any },

  list:           { padding: SPACE.s4, gap: SPACE.s2 },

  loadMoreBtn:    { margin: SPACE.s4, padding: SPACE.s3, borderRadius: RADIUS.r2, borderWidth: 1, borderColor: COLOR.border, alignItems: 'center', backgroundColor: COLOR.surface },
  loadMoreText:   { fontSize: FONT_SIZE.label, fontWeight: FONT_WEIGHT.semibold as any, color: COLOR.ink2 },
  noMoreText:     { textAlign: 'center', color: COLOR.inkDisabled, fontSize: FONT_SIZE.caption, padding: SPACE.s4 },

  shiftCard:      { backgroundColor: COLOR.surface, borderRadius: RADIUS.r3, borderWidth: 1, borderColor: COLOR.border, overflow: 'hidden', ...SHADOW.sm },
  shiftRow:       { flexDirection: 'row', alignItems: 'center', padding: SPACE.s4, gap: SPACE.s2 },
  shiftCodeRow:   { flexDirection: 'row', alignItems: 'center', gap: SPACE.s2, marginBottom: SPACE.s1 },
  shiftCode:      { fontSize: FONT_SIZE.label, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.ink },
  shiftMeta:      { fontSize: FONT_SIZE.caption, color: COLOR.inkMute, fontWeight: FONT_WEIGHT.medium as any },

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

  // Badge diferencia en fila del turno
  diffBadge:      { flexDirection: 'row', alignItems: 'center', gap: 3, borderWidth: 1, borderRadius: RADIUS.r1, paddingHorizontal: 6, paddingVertical: 2 },
  diffBadgeText:  { fontSize: FONT_SIZE.caption - 1, fontWeight: FONT_WEIGHT.bold as any },

  // Reconciliación en detalle expandido
  recBox:         { marginTop: SPACE.s3, backgroundColor: COLOR.surface, borderRadius: RADIUS.r2, borderWidth: 1, borderColor: COLOR.border, padding: SPACE.s3, gap: SPACE.s1 },
  recTitle:       { fontSize: FONT_SIZE.label, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.inkMute, marginBottom: SPACE.s1 },
  recLine:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  recLabelHist:   { fontSize: FONT_SIZE.label, color: COLOR.inkMute, fontWeight: FONT_WEIGHT.medium as any },
  recValueHist:   { fontSize: FONT_SIZE.label, color: COLOR.ink, fontWeight: FONT_WEIGHT.semibold as any },
});
