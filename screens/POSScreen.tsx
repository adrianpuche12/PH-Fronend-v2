import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput as RNTextInput, ActivityIndicator, Modal,
  useWindowDimensions, Platform,
} from 'react-native';
import { Button, Snackbar } from 'react-native-paper';
import axios from 'axios';
import { REACT_APP_API_URL } from '../config';
import { useStore } from '../context/StoreContext';
import { useAuth } from '../context/AuthContext';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Shift {
  id: number; code: string; username: string; status: string;
  storeId: number; storeName: string; openedAt: string;
}
interface Category { id: number; name: string; active: boolean; children: Category[]; productCount: number; }
interface StockItem {
  stockId: number; productId: number; productName: string; productSku: string;
  productType: string; productActive: boolean; price: number; quantity: number;
  minStock: number; lowStock: boolean; categoryPath: string; categoryId: number | null;
}
interface CartItem { productId: number; productName: string; price: number; qty: number; subtotal: number; }
interface SaleRecord {
  id: number; shiftId: number; username: string; saleDate: string; status: string;
  subtotal: number; isv: number; total: number; createdAt: string;
  items: { id: number; productId: number; productName: string; unitPrice: number; quantity: number; subtotal: number; }[];
}
interface ProductSummaryItem { productId: number; productName: string; quantity: number; subtotal: number; }
interface DailySummary {
  date: string; storeId: number; storeName: string; totalSales: number;
  totalSubtotal: number; totalIsv: number; totalAmount: number;
  productSummary: ProductSummaryItem[];
}

const ISV      = 0.15;
const money    = (v: number) => `L ${v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
const confirm  = (msg: string) => Platform.OS === 'web' ? window.confirm(msg) : true;

// Aplana categorías para chips
const flatCats = (cats: Category[]): Category[] => {
  const out: Category[] = [];
  for (const c of cats) { out.push(c); if (c.children?.length) out.push(...flatCats(c.children)); }
  return out;
};

// ─── POSScreen ────────────────────────────────────────────────────────────────

export default function POSScreen() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;

  const { selectedStore, stores, setSelectedStore } = useStore();
  const { userName } = useAuth();
  const storeId = selectedStore?.id ?? null;
  const API     = REACT_APP_API_URL;

  // ── Estado base ───────────────────────────────────────────────────────────

  const [shift, setShift]             = useState<Shift | null>(null);
  const [loadingShift, setLoadingShift] = useState(true);
  const [categories, setCategories]   = useState<Category[]>([]);
  const [stock, setStock]             = useState<StockItem[]>([]);
  const [loading, setLoading]         = useState(false);
  const [selectedCat, setSelectedCat] = useState<number | null>(null);
  const [search, setSearch]           = useState('');

  // Selección y cantidad pendiente (no se agrega al carrito hasta click en Agregar)
  const [selectedId, setSelectedId]   = useState<number | null>(null);
  const [pendingQty, setPendingQty]   = useState(1);

  // Carrito: array fijo — solo se puede eliminar, no editar qty
  const [cart, setCart]               = useState<CartItem[]>([]);
  const [snackbar, setSnackbar]       = useState('');
  const [submitting, setSubmitting]   = useState(false);

  // Tab del POS
  const [posTab, setPosTab]               = useState<'nueva' | 'ventas'>('nueva');
  const [shiftSales, setShiftSales]       = useState<SaleRecord[]>([]);
  const [loadingSales, setLoadingSales]   = useState(false);
  const [cancellingId, setCancellingId]   = useState<number | null>(null);

  // Modales
  const [openShiftModal, setOpenShiftModal] = useState(false);
  const [closingModal, setClosingModal]     = useState(false);
  const [summary, setSummary]               = useState<DailySummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [closingDone, setClosingDone]       = useState(false);

  // ── Cargar turno y catálogo ───────────────────────────────────────────────

  const loadShift = useCallback(async () => {
    if (!storeId) return;
    setLoadingShift(true);
    try {
      const res = await axios.get<Shift>(`${API}/api/v2/shifts/active/${storeId}`);
      setShift(res.data ?? null);
    } catch { setShift(null); }
    finally { setLoadingShift(false); }
  }, [storeId]);

  const loadCatalog = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const [catRes, stockRes] = await Promise.all([
        axios.get<Category[]>(`${API}/api/v2/stores/${storeId}/categories`),
        axios.get<StockItem[]>(`${API}/api/v2/stores/${storeId}/stock`),
      ]);
      setCategories(catRes.data);
      setStock(stockRes.data.filter(s => s.productActive));
    } catch { setSnackbar('Error al cargar catálogo'); }
    finally { setLoading(false); }
  }, [storeId]);

  useEffect(() => { loadShift(); }, [loadShift]);
  useEffect(() => { loadCatalog(); setCart([]); setSelectedId(null); setPendingQty(1); }, [loadCatalog]);

  const loadShiftSales = useCallback(async () => {
    if (!shift) return;
    setLoadingSales(true);
    try {
      const res = await axios.get<SaleRecord[]>(`${API}/api/v2/shifts/${shift.id}/sales`);
      setShiftSales(res.data);
    } catch { /* silencioso */ }
    finally { setLoadingSales(false); }
  }, [shift]);

  const handleSwitchTab = (tab: 'nueva' | 'ventas') => {
    setPosTab(tab);
    if (tab === 'ventas') loadShiftSales();
  };

  const handleCancelSale = async (saleId: number) => {
    if (!confirm('¿Anular esta venta? Se revertirá el stock.')) return;
    setCancellingId(saleId);
    try {
      await axios.delete(`${API}/api/v2/sales/${saleId}`);
      setShiftSales(prev => prev.filter(s => s.id !== saleId));
      loadCatalog(); // refresca stock
    } catch (e: any) { setSnackbar(e.response?.data?.error || 'Error al anular'); }
    finally { setCancellingId(null); }
  };

  // ── Filtrado ──────────────────────────────────────────────────────────────

  function allCatIds(cat: Category): number[] {
    return [cat.id, ...cat.children.flatMap(allCatIds)];
  }
  function findCat(cats: Category[], id: number): Category | null {
    for (const c of cats) { if (c.id === id) return c; const f = findCat(c.children, id); if (f) return f; }
    return null;
  }

  const filtered = stock.filter(item => {
    if (search) {
      const q = search.toLowerCase();
      if (!item.productName.toLowerCase().includes(q) && !(item.productSku || '').toLowerCase().includes(q)) return false;
    }
    if (selectedCat !== null) {
      const cat = findCat(categories, selectedCat);
      if (!cat || !item.categoryId) return false;
      if (!allCatIds(cat).includes(item.categoryId)) return false;
    }
    return true;
  });

  // ── Carrito ───────────────────────────────────────────────────────────────

  const cartSubtotal  = cart.reduce((s, i) => s + i.subtotal, 0);
  const cartISV       = cartSubtotal * ISV;
  const cartTotal     = cartSubtotal + cartISV;
  const cartItemCount = cart.reduce((s, i) => s + i.qty, 0);

  const isInCart = (productId: number) => cart.some(c => c.productId === productId);

  // Seleccionar producto (solo si no está ya en el carrito)
  const selectProduct = (item: StockItem) => {
    if (isInCart(item.productId)) {
      setSnackbar('Ya está en el carrito. Eliminalo para cambiar la cantidad.');
      return;
    }
    setSelectedId(item.productId);
    setPendingQty(1);
  };

  // Confirmar adición al carrito
  const addToCart = () => {
    const item = stock.find(s => s.productId === selectedId);
    if (!item || pendingQty < 1) return;
    setCart(prev => [...prev, { productId: item.productId, productName: item.productName, price: item.price, qty: pendingQty, subtotal: item.price * pendingQty }]);
    setSelectedId(null);
    setPendingQty(1);
  };

  const removeFromCart = (productId: number) =>
    setCart(prev => prev.filter(c => c.productId !== productId));

  const clearCart = () => { setCart([]); setSelectedId(null); setPendingQty(1); };

  // ── Abrir turno ───────────────────────────────────────────────────────────

  const handleOpenShift = async () => {
    if (!storeId) return;
    try {
      const res = await axios.post<Shift>(`${API}/api/v2/stores/${storeId}/shifts`, { username: userName ?? 'empleada' });
      setShift(res.data);
      setOpenShiftModal(false);
      setSnackbar(`Turno ${res.data.code} abierto`);
    } catch (e: any) { setSnackbar(e.response?.data?.error || 'Error al abrir turno'); }
  };

  // ── Confirmar venta ───────────────────────────────────────────────────────

  const handleSubmitSale = async () => {
    if (!shift || cart.length === 0) return;
    setSubmitting(true);
    try {
      await axios.post(`${API}/api/v2/shifts/${shift.id}/sales`, {
        username: userName ?? 'empleada',
        items: cart.map(i => ({ productId: i.productId, quantity: i.qty })),
      });
      clearCart();
      loadCatalog();
      if (posTab === 'ventas') loadShiftSales();
    } catch (e: any) { setSnackbar(e.response?.data?.error || 'Error al registrar venta'); }
    finally { setSubmitting(false); }
  };

  // ── Cierre de turno ───────────────────────────────────────────────────────

  const openClosing = async () => {
    if (!shift) return;
    setLoadingSummary(true);
    setClosingModal(true);
    setClosingDone(false);
    try {
      const res = await axios.get<DailySummary>(`${API}/api/v2/shifts/${shift.id}/summary`);
      setSummary(res.data);
    } catch { setSnackbar('Error al cargar resumen'); setClosingModal(false); }
    finally { setLoadingSummary(false); }
  };

  const handleConfirmClosing = async () => {
    if (!shift) return;
    try {
      await axios.post(`${API}/api/v2/shifts/${shift.id}/closing`, { username: userName ?? 'empleada' });
      setClosingDone(true);
      setShift(null);
      clearCart();
    } catch (e: any) { setSnackbar(e.response?.data?.error || 'Error al confirmar cierre'); }
  };

  // ── Stock color ───────────────────────────────────────────────────────────

  const stockColor = (item: StockItem) =>
    item.quantity === 0 ? '#d32121' : item.lowStock ? '#c05f00' : '#168542';

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  if (loadingShift) return <ActivityIndicator size="large" color="#ffd43b" style={{ flex: 1, marginTop: 60 }} />;

  // ── Sin turno activo ──────────────────────────────────────────────────────

  if (!shift) return (
    <View style={styles.noShift}>
      <Text style={styles.noShiftIcon}>⏱</Text>
      <Text style={styles.noShiftTitle}>Sin turno activo</Text>
      <Text style={styles.noShiftSub}>Abrí un turno para comenzar a registrar ventas</Text>

      {/* Selector de local */}
      <View style={styles.localChips}>
        {stores.map(s => (
          <TouchableOpacity key={s.id} style={[styles.localChip, selectedStore?.id === s.id && styles.localChipActive]} onPress={() => setSelectedStore(s)}>
            <Text style={[styles.localChipText, selectedStore?.id === s.id && styles.localChipTextActive]}>{s.name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Button mode="contained" onPress={() => setOpenShiftModal(true)} buttonColor="#ffd43b" textColor="#161616" style={{ borderRadius: 12 }} labelStyle={{ fontSize: 16, fontWeight: '900' }}>
        Abrir turno
      </Button>

      <Modal visible={openShiftModal} transparent animationType="fade" onRequestClose={() => setOpenShiftModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Abrir turno</Text>
            <Text style={styles.modalSub}>Local: <Text style={{ fontWeight: '900' }}>{selectedStore?.name ?? '—'}</Text></Text>
            <Text style={styles.modalSub}>Empleada: <Text style={{ fontWeight: '900' }}>{userName ?? '—'}</Text></Text>
            <View style={styles.modalActions}>
              <Button mode="outlined" onPress={() => setOpenShiftModal(false)} style={{ flex: 1 }}>Cancelar</Button>
              <Button mode="contained" onPress={handleOpenShift} buttonColor="#ffd43b" textColor="#161616" style={{ flex: 1 }}>Confirmar</Button>
            </View>
          </View>
        </View>
      </Modal>

      <Snackbar visible={!!snackbar} onDismiss={() => setSnackbar('')} duration={2500}>{snackbar}</Snackbar>
    </View>
  );

  // ── POS activo ────────────────────────────────────────────────────────────

  const allFlat = flatCats(categories).filter(c => c.active);

  return (
    <View style={styles.root}>

      {/* ══ HEADER ══ */}
      <View style={styles.header}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.headerBrand}>🐔 POLLOS HERMANOS</Text>
          <Text style={styles.headerShift} numberOfLines={1}>● {shift.code} · {shift.username}</Text>
        </View>

        {/* Selector de local */}
        <View style={styles.localChips}>
          {stores.map(s => (
            <TouchableOpacity key={s.id} style={[styles.localChip, selectedStore?.id === s.id && styles.localChipActive]} onPress={() => setSelectedStore(s)}>
              <Text style={[styles.localChipText, selectedStore?.id === s.id && styles.localChipTextActive]}>{s.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Button mode="outlined" onPress={openClosing} textColor="#d32121" style={{ borderColor: '#d32121', borderRadius: 8 }} labelStyle={{ fontSize: 11, fontWeight: '900' }}>
          Cerrar turno
        </Button>
      </View>

      {/* ══ TABS: Nueva venta / Ventas del turno ══ */}
      <View style={styles.tabBar}>
        <TouchableOpacity style={[styles.posTab, posTab === 'nueva' && styles.posTabActive]} onPress={() => handleSwitchTab('nueva')}>
          <Text style={[styles.posTabText, posTab === 'nueva' && styles.posTabTextActive]}>Nueva venta</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.posTab, posTab === 'ventas' && styles.posTabActive]} onPress={() => handleSwitchTab('ventas')}>
          <Text style={[styles.posTabText, posTab === 'ventas' && styles.posTabTextActive]}>
            Ventas del turno{shiftSales.length > 0 ? ` (${shiftSales.length})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ══ CHIPS DE CATEGORÍA (solo en tab nueva venta) ══ */}
      {posTab === 'nueva' && <View style={styles.chipsBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 12 }}>
          <TouchableOpacity style={[styles.catChip, selectedCat === null && styles.catChipActive]} onPress={() => setSelectedCat(null)}>
            <Text style={[styles.catChipText, selectedCat === null && styles.catChipTextActive]}>Todas</Text>
          </TouchableOpacity>
          {allFlat.map(c => (
            <TouchableOpacity key={c.id} style={[styles.catChip, selectedCat === c.id && styles.catChipActive]} onPress={() => setSelectedCat(selectedCat === c.id ? null : c.id)}>
              <Text style={[styles.catChipText, selectedCat === c.id && styles.catChipTextActive]}>{c.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>}

      {/* ══ BUSCADOR (solo en tab nueva venta) ══ */}
      {posTab === 'nueva' && <View style={styles.searchWrap}>
        <View style={styles.searchBox}>
          <Text style={{ color: '#6b7581', marginRight: 6 }}>⌕</Text>
          <RNTextInput
            placeholder="Buscar producto por nombre o código..." placeholderTextColor="#b8c0cc"
            value={search} onChangeText={setSearch} style={styles.searchInput}
          />
          {search ? <TouchableOpacity onPress={() => setSearch('')}><Text style={{ color: '#b8c0cc', fontSize: 18, lineHeight: 20 }}>×</Text></TouchableOpacity> : null}
        </View>
        {/* Conteo de productos + local */}
        <Text style={styles.catalogMeta}>Productos activos · {selectedStore?.name}  <Text style={styles.catalogCount}>{filtered.length} productos</Text></Text>
      </View>}

      {/* ══ LAYOUT PRINCIPAL ══ */}
      {posTab === 'nueva' && <View style={[styles.main, isDesktop && styles.mainDesktop]}>

        {/* Grilla de productos */}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.grid}>
          {loading
            ? <ActivityIndicator color="#ffd43b" style={{ marginTop: 40 }} />
            : filtered.length === 0
              ? <Text style={styles.empty}>No hay productos en esta categoría.</Text>
              : filtered.map(item => {
                  const isSelected  = selectedId === item.productId;
                  const inCart      = isInCart(item.productId);
                  const outOfStock  = item.quantity === 0;
                  return (
                    <TouchableOpacity
                      key={item.productId}
                      activeOpacity={outOfStock ? 1 : 0.85}
                      disabled={outOfStock}
                      onPress={() => selectProduct(item)}
                      style={[
                        styles.productCard,
                        isSelected  && styles.productCardSelected,
                        inCart      && styles.productCardInCart,
                        outOfStock  && styles.productCardDisabled,
                      ]}
                    >
                      {/* Badges de estado */}
                      {inCart && (
                        <View style={styles.inCartBadge}>
                          <Text style={styles.inCartBadgeText}>✓ En carrito</Text>
                        </View>
                      )}
                      {outOfStock && (
                        <View style={styles.outOfStockBadge}>
                          <Text style={styles.outOfStockBadgeText}>Sin stock</Text>
                        </View>
                      )}

                      {/* Fila 1: info + precio */}
                      <View style={styles.pcTop}>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.pcName} numberOfLines={2}>{item.productName}</Text>
                          {item.productSku ? <Text style={styles.pcCode}>{item.productSku}</Text> : null}
                        </View>
                        <Text style={styles.pcPrice}>{money(item.price)}</Text>
                      </View>

                      {/* Fila 2: stock */}
                      <Text style={[styles.pcStock, { color: stockColor(item) }]}>
                        Stock: {item.quantity}
                      </Text>

                      {/* Fila 3: qty controls + Agregar (solo cuando está seleccionado) */}
                      {isSelected ? (
                        <View style={styles.pcBottom}>
                          <View style={styles.qtyControl}>
                            <TouchableOpacity style={styles.qtyBtn} onPress={() => setPendingQty(q => Math.max(1, q - 1))}>
                              <Text style={styles.qtyBtnText}>−</Text>
                            </TouchableOpacity>
                            <Text style={styles.qtyNum}>{pendingQty}</Text>
                            <TouchableOpacity style={styles.qtyBtn} onPress={() => setPendingQty(q => q + 1)}>
                              <Text style={styles.qtyBtnText}>+</Text>
                            </TouchableOpacity>
                          </View>
                          <TouchableOpacity style={styles.addBtn} onPress={addToCart}>
                            <Text style={styles.addBtnText}>Agregar</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        /* Estado inactivo */
                        <View style={styles.pcBottomInactive}>
                          <Text style={[styles.pcTapHint, outOfStock && { color: '#d32121' }]}>
                            {outOfStock ? 'No disponible' : inCart ? '✓ Agregado' : 'Toca para seleccionar'}
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })
          }
        </ScrollView>

        {/* ══ TICKET ══ */}
        {isDesktop
          ? <View style={styles.ticketDesktop}><Ticket cart={cart} subtotal={cartSubtotal} isv={cartISV} total={cartTotal} itemCount={cartItemCount} onRemove={removeFromCart} onClear={clearCart} onSubmit={handleSubmitSale} submitting={submitting} full /></View>
          : <View style={styles.ticketMobile}><Ticket cart={cart} subtotal={cartSubtotal} isv={cartISV} total={cartTotal} itemCount={cartItemCount} onRemove={removeFromCart} onClear={clearCart} onSubmit={handleSubmitSale} submitting={submitting} full={false} /></View>
        }
      </View>}

      {/* ══ TAB VENTAS DEL TURNO ══ */}
      {posTab === 'ventas' && (
        <View style={{ flex: 1 }}>
          {loadingSales ? (
            <ActivityIndicator color="#ffd43b" size="large" style={{ marginTop: 40 }} />
          ) : (
            <ScrollView contentContainerStyle={{ padding: 12, gap: 10 }}>
              {shiftSales.length === 0 ? (
                <View style={styles.salesEmpty}>
                  <Text style={styles.salesEmptyIcon}>🧾</Text>
                  <Text style={styles.salesEmptyText}>Todavía no hay ventas en este turno.</Text>
                  <Text style={styles.salesEmptySub}>Registrá una venta y aparecerá aquí.</Text>
                </View>
              ) : (
                <>
                  {/* Resumen del turno */}
                  <View style={styles.salesSummary}>
                    <Text style={styles.salesSummaryText}>
                      {shiftSales.length} venta{shiftSales.length !== 1 ? 's' : ''}
                    </Text>
                    <Text style={styles.salesSummaryTotal}>
                      {money(shiftSales.reduce((s, v) => s + v.total, 0))}
                    </Text>
                  </View>

                  {/* Lista de ventas (más reciente primero) */}
                  {[...shiftSales].reverse().map(sale => (
                    <View key={sale.id} style={styles.saleCard}>
                      {/* Header de la venta */}
                      <View style={styles.saleCardHead}>
                        <Text style={styles.saleCardTime}>
                          {new Date(sale.createdAt).toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                        <Text style={styles.saleCardTotal}>{money(sale.total)}</Text>
                        <TouchableOpacity
                          style={[styles.cancelBtn, cancellingId === sale.id && { opacity: 0.5 }]}
                          onPress={() => handleCancelSale(sale.id)}
                          disabled={cancellingId === sale.id}
                        >
                          <Text style={styles.cancelBtnText}>
                            {cancellingId === sale.id ? '...' : '✕ Anular'}
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {/* Items de la venta */}
                      <View style={styles.saleCardItems}>
                        {sale.items.map(item => (
                          <Text key={item.id} style={styles.saleCardItem} numberOfLines={1}>
                            · {item.productName} × {item.quantity}  <Text style={{ color: '#6b7581' }}>{money(item.subtotal)}</Text>
                          </Text>
                        ))}
                      </View>

                      {/* ISV */}
                      <View style={styles.saleCardFooter}>
                        <Text style={styles.saleCardFooterText}>Subtotal: {money(sale.subtotal)}  ·  ISV 15%: {money(sale.isv)}</Text>
                      </View>
                    </View>
                  ))}
                </>
              )}
            </ScrollView>
          )}
        </View>
      )}

      {/* ══ MODAL CIERRE DE TURNO ══ */}
      <Modal visible={closingModal} transparent animationType="slide" onRequestClose={() => !closingDone && setClosingModal(false)}>
        <View style={styles.overlay}>
          <View style={[styles.modal, { maxWidth: 520, maxHeight: '92%' }]}>
            {closingDone ? (
              <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                <Text style={{ fontSize: 52 }}>✅</Text>
                <Text style={[styles.modalTitle, { textAlign: 'center', marginTop: 12 }]}>Turno cerrado</Text>
                <Text style={{ color: '#53606d', textAlign: 'center', marginTop: 8 }}>El cierre fue registrado en el sistema financiero.</Text>
                <Button mode="contained" buttonColor="#ffd43b" textColor="#161616" style={{ marginTop: 20, borderRadius: 10 }} onPress={() => setClosingModal(false)}>Aceptar</Button>
              </View>
            ) : loadingSummary ? (
              <ActivityIndicator color="#ffd43b" style={{ margin: 40 }} />
            ) : summary ? (
              <>
                <Text style={styles.modalTitle}>📋 Cierre de turno</Text>
                <Text style={styles.modalSub}>{selectedStore?.name} · {shift.code}</Text>

                <ScrollView style={{ maxHeight: 260, marginVertical: 12 }}>
                  <View style={styles.sumRow}>
                    <Text style={[styles.sumCell, styles.sumHeader, { flex: 1 }]}>Producto</Text>
                    <Text style={[styles.sumCell, styles.sumHeader, { width: 46, textAlign: 'center' }]}>Cant.</Text>
                    <Text style={[styles.sumCell, styles.sumHeader, { width: 88, textAlign: 'right' }]}>Subtotal</Text>
                  </View>
                  {summary.productSummary.map((p, i) => (
                    <View key={i} style={styles.sumRow}>
                      <Text style={[styles.sumCell, { flex: 1 }]} numberOfLines={1}>{p.productName}</Text>
                      <Text style={[styles.sumCell, { width: 46, textAlign: 'center' }]}>{p.quantity}</Text>
                      <Text style={[styles.sumCell, { width: 88, textAlign: 'right' }]}>{money(p.subtotal)}</Text>
                    </View>
                  ))}
                </ScrollView>

                <View style={styles.sumDivider} />
                <View style={{ gap: 4 }}>
                  <View style={styles.sumTotalRow}><Text style={styles.sumLabel}>Subtotal</Text><Text style={styles.sumValue}>{money(summary.totalSubtotal)}</Text></View>
                  <View style={styles.sumTotalRow}><Text style={styles.sumLabel}>ISV (15%)</Text><Text style={styles.sumValue}>{money(summary.totalIsv)}</Text></View>
                  <View style={[styles.sumTotalRow, { borderTopWidth: 2, borderTopColor: '#161616', marginTop: 6, paddingTop: 6 }]}>
                    <Text style={{ fontSize: 16, fontWeight: '900', color: '#161616' }}>TOTAL DEL DÍA</Text>
                    <Text style={{ fontSize: 18, fontWeight: '900', color: '#161616' }}>{money(summary.totalAmount)}</Text>
                  </View>
                  <Text style={{ fontSize: 12, color: '#6b7581', marginTop: 4 }}>{summary.totalSales} venta{summary.totalSales !== 1 ? 's' : ''} registrada{summary.totalSales !== 1 ? 's' : ''}</Text>
                </View>

                <Text style={styles.closingWarn}>⚠ Esta acción no se puede deshacer</Text>

                <View style={styles.modalActions}>
                  <Button mode="outlined" onPress={() => setClosingModal(false)} style={{ flex: 1 }}>Cancelar</Button>
                  <Button mode="contained" buttonColor="#d32121" textColor="#fff" style={{ flex: 1 }} onPress={handleConfirmClosing}>Confirmar cierre</Button>
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>

      <Snackbar visible={!!snackbar} onDismiss={() => setSnackbar('')} duration={2500}>{snackbar}</Snackbar>
    </View>
  );
}

// ─── Ticket (componente interno) ──────────────────────────────────────────────

function Ticket({ cart, subtotal, isv, total, itemCount, onRemove, onClear, onSubmit, submitting, full }: {
  cart: CartItem[];
  subtotal: number; isv: number; total: number; itemCount: number;
  onRemove: (id: number) => void;
  onClear: () => void;
  onSubmit: () => void;
  submitting: boolean;
  full: boolean;
}) {
  const money = (v: number) => `L ${v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  return (
    <View style={tkStyles.root}>
      <View style={tkStyles.head}>
        <Text style={tkStyles.title}>Venta actual</Text>
        {itemCount > 0 && <View style={tkStyles.badge}><Text style={tkStyles.badgeText}>🛒 {itemCount} artículos</Text></View>}
      </View>

      {full && (
        cart.length === 0
          ? <View style={tkStyles.empty}><Text style={tkStyles.emptyText}>La venta actual está vacía.</Text></View>
          : <ScrollView style={{ flex: 1 }}>
              {cart.map(item => (
                <View key={item.productId} style={tkStyles.item}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={tkStyles.itemName} numberOfLines={1}>{item.productName}</Text>
                    <Text style={tkStyles.itemCode}>{item.qty} × {money(item.price)}</Text>
                  </View>
                  <Text style={tkStyles.itemSub}>{money(item.subtotal)}</Text>
                  <TouchableOpacity onPress={() => onRemove(item.productId)} style={tkStyles.deleteBtn}>
                    <Text style={tkStyles.deleteBtnText}>🗑</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
      )}

      {/* Totales */}
      <View style={tkStyles.totals}>
        <View style={tkStyles.totalLine}><Text style={tkStyles.totalLabel}>Subtotal</Text><Text style={tkStyles.totalValue}>{money(subtotal)}</Text></View>
        <View style={tkStyles.totalLine}><Text style={tkStyles.totalLabel}>Impuestos (ISV 15%)</Text><Text style={tkStyles.totalValue}>{money(isv)}</Text></View>
        <View style={[tkStyles.totalLine, tkStyles.totalFinal]}>
          <Text style={tkStyles.totalLabelFinal}>TOTAL</Text>
          <Text style={tkStyles.totalAmount}>{money(total)}</Text>
        </View>
      </View>

      {/* Acciones */}
      <View style={tkStyles.actions}>
        <Button mode="contained" onPress={onSubmit} loading={submitting} disabled={cart.length === 0 || submitting}
          buttonColor="#ffd43b" textColor="#161616" style={{ borderRadius: 10 }} labelStyle={{ fontWeight: '900' }}>
          🛒 Confirmar venta
        </Button>
        {cart.length > 0 && (
          <Button mode="outlined" onPress={onClear} style={{ borderRadius: 10, marginTop: 6 }} textColor="#53606d">
            ✕ Cancelar venta
          </Button>
        )}
      </View>

      {full && cart.length > 0 && (
        <View style={tkStyles.audit}>
          <Text style={tkStyles.auditText}>🛡 El sistema calcula precios, impuestos y totales automáticamente. Al confirmar se descuenta el stock.</Text>
        </View>
      )}
    </View>
  );
}

// ─── Estilos POSScreen ────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:           { flex: 1, backgroundColor: '#f4f6f8' },

  // Sin turno
  noShift:        { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 14 },
  noShiftIcon:    { fontSize: 52 },
  noShiftTitle:   { fontSize: 22, fontWeight: '900', color: '#161616' },
  noShiftSub:     { fontSize: 14, color: '#6b7581', textAlign: 'center' },

  // Header
  header:         { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, padding: 12, backgroundColor: '#ffd43b', borderBottomWidth: 1, borderBottomColor: '#f5c400' },
  headerBrand:    { fontSize: 15, fontWeight: '950', color: '#161616', letterSpacing: -0.5 },
  headerShift:    { fontSize: 11, fontWeight: '700', color: '#53606d', marginTop: 2 },

  // Local chips
  localChips:     { flexDirection: 'row', gap: 6 },
  localChip:      { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#fff8', borderWidth: 1, borderColor: '#f5c400' },
  localChipActive:{ backgroundColor: '#161616', borderColor: '#161616' },
  localChipText:  { fontSize: 12, fontWeight: '800', color: '#53606d' },
  localChipTextActive: { color: '#ffd43b', fontWeight: '900' },

  // Tabs POS
  tabBar:         { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e8ecf2' },
  posTab:         { flex: 1, paddingVertical: 11, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  posTabActive:   { borderBottomColor: '#ffd43b' },
  posTabText:     { fontSize: 13, fontWeight: '700', color: '#6b7581' },
  posTabTextActive: { color: '#161616', fontWeight: '950' },

  // Tab Ventas del turno
  salesEmpty:     { alignItems: 'center', paddingVertical: 48, gap: 8 },
  salesEmptyIcon: { fontSize: 40 },
  salesEmptyText: { fontSize: 15, fontWeight: '800', color: '#161616' },
  salesEmptySub:  { fontSize: 13, color: '#6b7581' },
  salesSummary:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff9e6', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#efd37d' },
  salesSummaryText: { fontSize: 14, fontWeight: '800', color: '#53606d' },
  salesSummaryTotal: { fontSize: 18, fontWeight: '950', color: '#161616' },
  saleCard:       { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#e8ecf2', padding: 12, gap: 6 },
  saleCardHead:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  saleCardTime:   { fontSize: 13, fontWeight: '800', color: '#161616', flex: 1 },
  saleCardTotal:  { fontSize: 15, fontWeight: '950', color: '#161616' },
  cancelBtn:      { backgroundColor: '#ffecec', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: '#ffc0c0' },
  cancelBtnText:  { fontSize: 12, fontWeight: '900', color: '#d32121' },
  saleCardItems:  { gap: 2, paddingLeft: 4 },
  saleCardItem:   { fontSize: 12, fontWeight: '600', color: '#2f3944' },
  saleCardFooter: { borderTopWidth: 1, borderTopColor: '#f4f6f8', paddingTop: 4 },
  saleCardFooterText: { fontSize: 11, color: '#6b7581', fontWeight: '700' },

  // Chips categoría
  chipsBar:       { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e8ecf2', paddingVertical: 8 },
  catChip:        { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e8ecf2' },
  catChipActive:  { backgroundColor: '#ffd43b', borderColor: '#f5c400' },
  catChipText:    { fontSize: 12, fontWeight: '850', color: '#53606d' },
  catChipTextActive: { color: '#161616', fontWeight: '950' },

  // Buscador
  searchWrap:     { backgroundColor: '#fff', padding: 10, borderBottomWidth: 1, borderBottomColor: '#e8ecf2', gap: 6 },
  searchBox:      { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f4f6f8', borderRadius: 10, paddingHorizontal: 12, height: 40 },
  searchInput:    { flex: 1, fontSize: 13, color: '#161616', outlineStyle: 'none' } as any,
  catalogMeta:    { fontSize: 13, fontWeight: '800', color: '#161616' },
  catalogCount:   { fontSize: 12, fontWeight: '700', color: '#6b7581' },

  // Layout
  main:           { flex: 1 },
  mainDesktop:    { flexDirection: 'row' },

  // Grilla de productos
  grid:           { flexDirection: 'row', flexWrap: 'wrap', padding: 10, gap: 10 },
  empty:          { width: '100%', textAlign: 'center', color: '#6b7581', marginTop: 40 },

  // Product card
  productCard:         { flex: 1, minWidth: 150, maxWidth: 220, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#e8ecf2', padding: 10, gap: 6 },
  productCardSelected: { borderColor: '#ffd43b', borderWidth: 2, backgroundColor: '#fff9e6' },
  productCardInCart:   { borderColor: '#168542', borderWidth: 1.5, backgroundColor: '#f5fdf8' },
  productCardDisabled: { opacity: 0.45, backgroundColor: '#f9f9f9' },
  inCartBadge:         { backgroundColor: '#168542', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start' },
  inCartBadgeText:     { fontSize: 10, fontWeight: '900', color: '#fff' },
  outOfStockBadge:     { backgroundColor: '#d32121', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start' },
  outOfStockBadgeText: { fontSize: 10, fontWeight: '900', color: '#fff' },
  pcBottomInactive:    { height: 30, justifyContent: 'center' },
  pcTapHint:           { fontSize: 11, color: '#b8c0cc', fontWeight: '700' },
  pcTop:          { flexDirection: 'row', gap: 6 },
  pcName:         { fontSize: 13, fontWeight: '950', color: '#161616', lineHeight: 16 },
  pcCode:         { fontSize: 10, color: '#6b7581', fontWeight: '700', marginTop: 2 },
  pcPrice:        { fontSize: 12, fontWeight: '950', color: '#161616' },
  pcStock:        { fontSize: 11, fontWeight: '850' },
  pcBottom:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },

  // Qty control (en card)
  qtyControl:     { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#d7dde6', borderRadius: 9, overflow: 'hidden', height: 28 },
  qtyBtn:         { width: 26, height: 28, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  qtyBtnText:     { fontSize: 16, fontWeight: '900', color: '#161616', lineHeight: 18 },
  qtyNum:         { width: 30, textAlign: 'center', fontSize: 13, fontWeight: '950', color: '#161616' },

  // Agregar button
  addBtn:         { flex: 1, height: 30, backgroundColor: '#ffd43b', borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  addBtnText:     { fontSize: 12, fontWeight: '950', color: '#161616' },

  // Ticket
  ticketDesktop:  { width: 340, backgroundColor: '#fff', borderLeftWidth: 1, borderLeftColor: '#e8ecf2' },
  ticketMobile:   { backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e8ecf2' },

  // Modal cierre
  sumRow:         { flexDirection: 'row', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#f4f6f8' },
  sumCell:        { fontSize: 12, color: '#161616', fontWeight: '600' },
  sumHeader:      { fontWeight: '900', color: '#53606d', fontSize: 11 },
  sumDivider:     { height: 1, backgroundColor: '#e8ecf2', marginVertical: 8 },
  sumTotalRow:    { flexDirection: 'row', justifyContent: 'space-between' },
  sumLabel:       { fontSize: 13, color: '#6b7581', fontWeight: '700' },
  sumValue:       { fontSize: 13, color: '#6b7581', fontWeight: '700' },
  closingWarn:    { fontSize: 12, color: '#c05f00', fontWeight: '700', textAlign: 'center', marginVertical: 10 },

  // Modales genéricos
  overlay:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modal:          { backgroundColor: '#fff', borderRadius: 18, padding: 22, width: '92%', maxWidth: 460 },
  modalTitle:     { fontSize: 20, fontWeight: '900', color: '#161616', marginBottom: 4 },
  modalSub:       { fontSize: 13, color: '#53606d', fontWeight: '600', marginBottom: 4 },
  modalActions:   { flexDirection: 'row', gap: 10, marginTop: 14 },
});

// ─── Estilos Ticket ───────────────────────────────────────────────────────────

const tkStyles = StyleSheet.create({
  root:           { flex: 1, padding: 12, flexDirection: 'column' },
  head:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  title:          { fontSize: 16, fontWeight: '950', color: '#161616' },
  badge:          { backgroundColor: '#fff9e6', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText:      { fontSize: 11, fontWeight: '900', color: '#725100' },
  empty:          { padding: 16, borderRadius: 12, backgroundColor: '#f4f6f8', alignItems: 'center' },
  emptyText:      { color: '#6b7581', fontWeight: '750', fontSize: 13 },

  item:           { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#e8ecf2', gap: 6, minHeight: 46 },
  itemName:       { fontSize: 12, fontWeight: '900', color: '#161616' },
  itemCode:       { fontSize: 10, color: '#6b7581', fontWeight: '650' },
  itemSub:        { fontSize: 12, fontWeight: '800', color: '#161616', width: 70, textAlign: 'right' },
  deleteBtn:      { marginLeft: 6, padding: 4 },
  deleteBtnText:  { fontSize: 16 },

  totals:         { paddingTop: 8, gap: 4, borderTopWidth: 1, borderTopColor: '#e8ecf2', marginTop: 8 },
  totalLine:      { flexDirection: 'row', justifyContent: 'space-between' },
  totalFinal:     { borderTopWidth: 1, borderTopColor: '#e8ecf2', paddingTop: 6, marginTop: 4 },
  totalLabel:     { fontSize: 12, fontWeight: '750', color: '#6b7581' },
  totalValue:     { fontSize: 12, fontWeight: '750', color: '#6b7581' },
  totalLabelFinal:{ fontSize: 15, fontWeight: '950', color: '#161616' },
  totalAmount:    { fontSize: 21, fontWeight: '950', color: '#161616', letterSpacing: -1 },

  actions:        { marginTop: 8 },
  audit:          { marginTop: 8, backgroundColor: '#fff9e6', borderWidth: 1, borderColor: '#efd37d', borderRadius: 12, padding: 8 },
  auditText:      { fontSize: 11, fontWeight: '650', color: '#2f3944' },
});
