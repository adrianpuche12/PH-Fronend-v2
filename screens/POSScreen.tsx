import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput as RNTextInput, ActivityIndicator, Modal,
  useWindowDimensions, Platform,
} from 'react-native';
import { Button, Snackbar, IconButton } from 'react-native-paper';
import axios from 'axios';
import { REACT_APP_API_URL } from '../config';
import { useStore } from '../context/StoreContext';
import { useAuth } from '../context/AuthContext';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Shift {
  id: number; code: string; username: string; status: string;
  storeId: number; storeName: string; openedAt: string; closedAt: string | null;
}
interface Category { id: number; name: string; active: boolean; children: Category[]; productCount: number; }
interface StockItem {
  stockId: number; productId: number; productName: string; productSku: string;
  productType: string; productActive: boolean; price: number; quantity: number;
  minStock: number; lowStock: boolean; categoryName: string; categoryPath: string; categoryId: number | null;
}
interface CartItem { productId: number; productName: string; unitPrice: number; quantity: number; subtotal: number; }
interface ProductSummaryItem { productId: number; productName: string; quantity: number; subtotal: number; }
interface DailySummary {
  date: string; storeId: number; storeName: string; totalSales: number;
  totalSubtotal: number; totalIsv: number; totalAmount: number;
  productSummary: ProductSummaryItem[];
}

const ISV = 0.15;
const money = (v: number) => `L ${Number(v).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
const confirm = (msg: string) => Platform.OS === 'web' ? window.confirm(msg) : true;

// ─── Árbol de categorías aplanado para chips ──────────────────────────────────

const flatCats = (cats: Category[]): Category[] => {
  const result: Category[] = [];
  for (const c of cats) { result.push(c); if (c.children?.length) result.push(...flatCats(c.children)); }
  return result;
};

// ─── POSScreen ────────────────────────────────────────────────────────────────

const POSScreen = () => {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;
  const isMedium  = width >= 600;

  const { selectedStore, stores, setSelectedStore } = useStore();
  const { userName } = useAuth();
  const storeId = selectedStore?.id ?? null;
  const API = REACT_APP_API_URL;

  // ── Estado ───────────────────────────────────────────────────────────────────

  const [shift, setShift]               = useState<Shift | null>(null);
  const [loadingShift, setLoadingShift] = useState(true);
  const [categories, setCategories]     = useState<Category[]>([]);
  const [stock, setStock]               = useState<StockItem[]>([]);
  const [loading, setLoading]           = useState(false);
  const [selectedCat, setSelectedCat]   = useState<number | null>(null);
  const [search, setSearch]             = useState('');
  const [cart, setCart]                 = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen]         = useState(false); // mobile: toggle carrito
  const [snackbar, setSnackbar]         = useState('');
  const [submitting, setSubmitting]     = useState(false);

  // Modales
  const [openShiftModal, setOpenShiftModal]   = useState(false);
  const [qtyModal, setQtyModal]               = useState<StockItem | null>(null);
  const [qtyInput, setQtyInput]               = useState('1');
  const [closingModal, setClosingModal]       = useState(false);
  const [summary, setSummary]                 = useState<DailySummary | null>(null);
  const [loadingSummary, setLoadingSummary]   = useState(false);
  const [confirmModal, setConfirmModal]       = useState(false);
  const [closingDone, setClosingDone]         = useState(false);

  // ── Cargar turno activo ───────────────────────────────────────────────────────

  const loadShift = useCallback(async () => {
    if (!storeId) return;
    setLoadingShift(true);
    try {
      const res = await axios.get<Shift>(`${API}/api/v2/shifts/active/${storeId}`);
      setShift(res.data ?? null);
    } catch (e: any) {
      if (e.response?.status === 204) setShift(null);
      else setShift(null);
    } finally { setLoadingShift(false); }
  }, [storeId]);

  // ── Cargar catálogo ───────────────────────────────────────────────────────────

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
  useEffect(() => { loadCatalog(); }, [loadCatalog]);

  // ── Filtrado de productos ─────────────────────────────────────────────────────

  const allCatIds = (cat: Category): number[] =>
    [cat.id, ...cat.children.flatMap(allCatIds)];

  const filtered = stock.filter(item => {
    if (search) {
      const q = search.toLowerCase();
      if (!item.productName.toLowerCase().includes(q) &&
          !(item.productSku || '').toLowerCase().includes(q)) return false;
    }
    if (selectedCat !== null) {
      const catNode = findCat(categories, selectedCat);
      if (!catNode) return false;
      const validIds = allCatIds(catNode);
      if (!item.categoryId || !validIds.includes(item.categoryId)) return false;
    }
    return true;
  });

  function findCat(cats: Category[], id: number): Category | null {
    for (const c of cats) { if (c.id === id) return c; const f = findCat(c.children, id); if (f) return f; }
    return null;
  }

  // ── Carrito ───────────────────────────────────────────────────────────────────

  const cartSubtotal = cart.reduce((s, i) => s + i.subtotal, 0);
  const cartISV      = cartSubtotal * ISV;
  const cartTotal    = cartSubtotal + cartISV;

  const addToCart = (item: StockItem, qty: number) => {
    setCart(prev => {
      const idx = prev.findIndex(c => c.productId === item.productId);
      if (idx >= 0) {
        const updated = [...prev];
        const newQty  = updated[idx].quantity + qty;
        updated[idx]  = { ...updated[idx], quantity: newQty, subtotal: updated[idx].unitPrice * newQty };
        return updated;
      }
      return [...prev, { productId: item.productId, productName: item.productName, unitPrice: item.price, quantity: qty, subtotal: item.price * qty }];
    });
    setQtyModal(null);
    setQtyInput('1');
    if (!isDesktop) setCartOpen(true);
  };

  const updateQty = (productId: number, delta: number) => {
    setCart(prev => prev
      .map(c => c.productId === productId ? { ...c, quantity: c.quantity + delta, subtotal: c.unitPrice * (c.quantity + delta) } : c)
      .filter(c => c.quantity > 0)
    );
  };

  const removeFromCart = (productId: number) =>
    setCart(prev => prev.filter(c => c.productId !== productId));

  const clearCart = () => setCart([]);

  // ── Abrir turno ───────────────────────────────────────────────────────────────

  const handleOpenShift = async () => {
    if (!storeId) return;
    try {
      const res = await axios.post<Shift>(`${API}/api/v2/stores/${storeId}/shifts`, { username: userName ?? 'empleada' });
      setShift(res.data);
      setOpenShiftModal(false);
      setSnackbar(`Turno ${res.data.code} abierto`);
    } catch (e: any) {
      setSnackbar(e.response?.data?.error || 'Error al abrir turno');
    }
  };

  // ── Confirmar venta ───────────────────────────────────────────────────────────

  const handleSubmitSale = async () => {
    if (!shift || cart.length === 0) return;
    setSubmitting(true);
    try {
      await axios.post(`${API}/api/v2/shifts/${shift.id}/sales`, {
        username: userName ?? 'empleada',
        items: cart.map(c => ({ productId: c.productId, quantity: c.quantity })),
      });
      clearCart();
      setCartOpen(false);
      setSnackbar('✓ Venta registrada');
    } catch (e: any) {
      setSnackbar(e.response?.data?.error || 'Error al registrar venta');
    } finally { setSubmitting(false); }
  };

  // ── Cierre de turno ───────────────────────────────────────────────────────────

  const openClosingModal = async () => {
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
    } catch (e: any) {
      setSnackbar(e.response?.data?.error || 'Error al confirmar cierre');
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  if (loadingShift) return <ActivityIndicator size="large" color="#ffd43b" style={{ flex: 1, marginTop: 60 }} />;

  // Sin turno activo
  if (!shift) return (
    <View style={styles.noShift}>
      <Text style={styles.noShiftIcon}>⏱</Text>
      <Text style={styles.noShiftTitle}>Sin turno activo</Text>
      <Text style={styles.noShiftSub}>Abrí un turno para comenzar a registrar ventas</Text>
      <View style={styles.storeChips}>
        {stores.map(s => (
          <TouchableOpacity key={s.id} style={[styles.chip, selectedStore?.id === s.id && styles.chipActive]} onPress={() => setSelectedStore(s)}>
            <Text style={[styles.chipText, selectedStore?.id === s.id && styles.chipTextActive]}>{s.name}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Button mode="contained" onPress={() => setOpenShiftModal(true)} buttonColor="#ffd43b" textColor="#161616" style={{ borderRadius: 12, marginTop: 8 }} labelStyle={{ fontSize: 16, fontWeight: '900' }}>
        Abrir turno
      </Button>

      {/* Modal abrir turno */}
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

  // ── POS activo ──────────────────────────────────────────────────────────────

  const allFlatCats = flatCats(categories).filter(c => c.active);

  return (
    <View style={styles.posContainer}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>🏪 {selectedStore?.name}</Text>
          <Text style={styles.headerSub}>Turno {shift.code} · {shift.username}</Text>
        </View>
        {/* Selector de local */}
        <View style={styles.storeChips}>
          {stores.map(s => (
            <TouchableOpacity key={s.id} style={[styles.chip, selectedStore?.id === s.id && styles.chipActive]} onPress={() => setSelectedStore(s)}>
              <Text style={[styles.chipText, selectedStore?.id === s.id && styles.chipTextActive]}>{s.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Button mode="outlined" onPress={openClosingModal} textColor="#d32121" style={{ borderColor: '#d32121', borderRadius: 8 }} labelStyle={{ fontSize: 12, fontWeight: '900' }}>
          Cerrar turno
        </Button>
      </View>

      {/* ── Categorías (chips horizontales) ── */}
      <View style={styles.catsBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 12 }}>
          <TouchableOpacity style={[styles.catChip, selectedCat === null && styles.catChipActive]} onPress={() => setSelectedCat(null)}>
            <Text style={[styles.catChipText, selectedCat === null && styles.catChipTextActive]}>Todos</Text>
          </TouchableOpacity>
          {allFlatCats.map(c => (
            <TouchableOpacity key={c.id} style={[styles.catChip, selectedCat === c.id && styles.catChipActive]} onPress={() => setSelectedCat(selectedCat === c.id ? null : c.id)}>
              <Text style={[styles.catChipText, selectedCat === c.id && styles.catChipTextActive]}>{c.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ── Buscador ── */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Text style={{ color: '#6b7581', marginRight: 6 }}>⌕</Text>
          <RNTextInput
            placeholder="Buscar producto..." placeholderTextColor="#b8c0cc"
            value={search} onChangeText={setSearch} style={styles.searchInput}
          />
          {search ? <TouchableOpacity onPress={() => setSearch('')}><Text style={{ color: '#b8c0cc', fontSize: 18 }}>×</Text></TouchableOpacity> : null}
        </View>
      </View>

      {/* ── Layout principal ── */}
      <View style={[styles.main, isDesktop && styles.mainDesktop]}>

        {/* Grid de productos */}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.grid}>
          {loading ? <ActivityIndicator color="#ffd43b" style={{ marginTop: 40 }} /> :
           filtered.length === 0 ? <Text style={styles.empty}>No hay productos para mostrar</Text> :
           filtered.map(item => (
            <TouchableOpacity key={item.productId} style={styles.productCard} onPress={() => { setQtyModal(item); setQtyInput('1'); }}>
              <Text style={styles.productName} numberOfLines={2}>{item.productName}</Text>
              {item.productSku ? <Text style={styles.productSku}>{item.productSku}</Text> : null}
              <Text style={styles.productPrice}>{money(item.price)}</Text>
              <View style={[styles.stockBadge, { backgroundColor: item.quantity === 0 ? '#d3212118' : item.lowStock ? '#c05f0018' : '#16854218' }]}>
                <Text style={[styles.stockText, { color: item.quantity === 0 ? '#d32121' : item.lowStock ? '#c05f00' : '#168542' }]}>
                  {item.quantity === 0 ? 'Sin stock' : `Stock: ${item.quantity}`}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ── Carrito (desktop: columna fija / mobile: panel inferior) ── */}
        {isDesktop ? (
          <View style={styles.cartDesktop}>
            <CartPanel
              cart={cart} subtotal={cartSubtotal} isv={cartISV} total={cartTotal}
              onUpdate={updateQty} onRemove={removeFromCart} onClear={clearCart}
              onSubmit={handleSubmitSale} submitting={submitting}
            />
          </View>
        ) : (
          <>
            {/* Barra sticky mobile */}
            <TouchableOpacity style={styles.cartBar} onPress={() => setCartOpen(v => !v)}>
              <Text style={styles.cartBarText}>🛒 {cart.length} producto{cart.length !== 1 ? 's' : ''}</Text>
              <Text style={styles.cartBarTotal}>{money(cartTotal)}</Text>
              <Text style={styles.cartBarArrow}>{cartOpen ? '▼' : '▲'}</Text>
            </TouchableOpacity>

            {/* Panel expandible */}
            {cartOpen && (
              <View style={styles.cartMobile}>
                <CartPanel
                  cart={cart} subtotal={cartSubtotal} isv={cartISV} total={cartTotal}
                  onUpdate={updateQty} onRemove={removeFromCart} onClear={clearCart}
                  onSubmit={handleSubmitSale} submitting={submitting}
                />
              </View>
            )}
          </>
        )}
      </View>

      {/* ── Modal: ingresar cantidad ── */}
      <Modal visible={!!qtyModal} transparent animationType="fade" onRequestClose={() => setQtyModal(null)}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle} numberOfLines={2}>{qtyModal?.productName}</Text>
            <Text style={styles.modalPrice}>{qtyModal ? money(qtyModal.price) : ''} por unidad</Text>
            <View style={styles.qtyRow}>
              <TouchableOpacity style={styles.qtyBtn} onPress={() => setQtyInput(v => String(Math.max(1, Number(v) - 1)))}>
                <Text style={styles.qtyBtnText}>−</Text>
              </TouchableOpacity>
              <RNTextInput
                style={styles.qtyInput} value={qtyInput} keyboardType="numeric"
                onChangeText={v => setQtyInput(v.replace(/[^0-9]/g, ''))}
              />
              <TouchableOpacity style={styles.qtyBtn} onPress={() => setQtyInput(v => String(Number(v) + 1))}>
                <Text style={styles.qtyBtnText}>+</Text>
              </TouchableOpacity>
            </View>
            {qtyModal && Number(qtyInput) > 0 && (
              <Text style={styles.modalSubtotal}>Subtotal: {money(qtyModal.price * Number(qtyInput))}</Text>
            )}
            <View style={styles.modalActions}>
              <Button mode="outlined" onPress={() => setQtyModal(null)} style={{ flex: 1 }}>Cancelar</Button>
              <Button mode="contained" buttonColor="#ffd43b" textColor="#161616" style={{ flex: 1 }}
                onPress={() => qtyModal && Number(qtyInput) > 0 && addToCart(qtyModal, Number(qtyInput))}>
                Agregar
              </Button>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Modal: cierre de turno ── */}
      <Modal visible={closingModal} transparent animationType="slide" onRequestClose={() => !closingDone && setClosingModal(false)}>
        <View style={styles.overlay}>
          <View style={[styles.modal, { maxWidth: 540, maxHeight: '90%' }]}>
            {closingDone ? (
              <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                <Text style={{ fontSize: 48 }}>✅</Text>
                <Text style={[styles.modalTitle, { textAlign: 'center', marginTop: 12 }]}>Turno cerrado</Text>
                <Text style={{ color: '#53606d', textAlign: 'center', marginTop: 8 }}>El cierre fue registrado en el sistema financiero.</Text>
                <Button mode="contained" buttonColor="#ffd43b" textColor="#161616" style={{ marginTop: 20, borderRadius: 10 }}
                  onPress={() => setClosingModal(false)}>
                  Aceptar
                </Button>
              </View>
            ) : loadingSummary ? (
              <ActivityIndicator color="#ffd43b" style={{ margin: 40 }} />
            ) : summary ? (
              <>
                <Text style={styles.modalTitle}>📋 Cierre de turno</Text>
                <Text style={styles.modalSub}>{selectedStore?.name} · {shift.code}</Text>

                <ScrollView style={{ maxHeight: 280, marginVertical: 12 }}>
                  {/* Header */}
                  <View style={styles.sumRow}>
                    <Text style={[styles.sumCell, styles.sumHeader, { flex: 1 }]}>Producto</Text>
                    <Text style={[styles.sumCell, styles.sumHeader, { width: 50, textAlign: 'center' }]}>Cant.</Text>
                    <Text style={[styles.sumCell, styles.sumHeader, { width: 90, textAlign: 'right' }]}>Subtotal</Text>
                  </View>
                  {summary.productSummary.map((p, i) => (
                    <View key={i} style={styles.sumRow}>
                      <Text style={[styles.sumCell, { flex: 1 }]} numberOfLines={1}>{p.productName}</Text>
                      <Text style={[styles.sumCell, { width: 50, textAlign: 'center' }]}>{p.quantity}</Text>
                      <Text style={[styles.sumCell, { width: 90, textAlign: 'right' }]}>{money(p.subtotal)}</Text>
                    </View>
                  ))}
                </ScrollView>

                <View style={styles.sumDivider} />
                <View style={styles.sumTotals}>
                  <View style={styles.sumTotalRow}><Text style={styles.sumLabel}>Subtotal</Text><Text style={styles.sumValue}>{money(summary.totalSubtotal)}</Text></View>
                  <View style={styles.sumTotalRow}><Text style={styles.sumLabel}>ISV (15%)</Text><Text style={styles.sumValue}>{money(summary.totalIsv)}</Text></View>
                  <View style={[styles.sumTotalRow, styles.sumTotalRowBig]}><Text style={styles.sumLabelBig}>TOTAL DEL DÍA</Text><Text style={styles.sumValueBig}>{money(summary.totalAmount)}</Text></View>
                  <Text style={styles.sumCount}>{summary.totalSales} venta{summary.totalSales !== 1 ? 's' : ''} registrada{summary.totalSales !== 1 ? 's' : ''}</Text>
                </View>

                <Text style={styles.closingWarn}>⚠ Esta acción no se puede deshacer</Text>

                <View style={styles.modalActions}>
                  <Button mode="outlined" onPress={() => setClosingModal(false)} style={{ flex: 1 }}>Cancelar</Button>
                  <Button mode="contained" buttonColor="#d32121" textColor="#fff" style={{ flex: 1 }} onPress={handleConfirmClosing}>
                    Confirmar cierre
                  </Button>
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>

      <Snackbar visible={!!snackbar} onDismiss={() => setSnackbar('')} duration={2500}>{snackbar}</Snackbar>
    </View>
  );
};

// ─── CartPanel (componente interno) ──────────────────────────────────────────

const CartPanel = ({ cart, subtotal, isv, total, onUpdate, onRemove, onClear, onSubmit, submitting }: {
  cart: CartItem[]; subtotal: number; isv: number; total: number;
  onUpdate: (id: number, delta: number) => void;
  onRemove: (id: number) => void;
  onClear: () => void;
  onSubmit: () => void;
  submitting: boolean;
}) => (
  <View style={styles.cart}>
    <View style={styles.cartHeader}>
      <Text style={styles.cartTitle}>Carrito</Text>
      {cart.length > 0 && <TouchableOpacity onPress={onClear}><Text style={styles.cartClear}>Vaciar</Text></TouchableOpacity>}
    </View>

    {cart.length === 0 ? (
      <View style={styles.cartEmpty}><Text style={styles.cartEmptyText}>Sin productos</Text><Text style={styles.cartEmptyIcon}>🛒</Text></View>
    ) : (
      <ScrollView style={{ flex: 1 }}>
        {cart.map(item => (
          <View key={item.productId} style={styles.cartItem}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cartItemName} numberOfLines={1}>{item.productName}</Text>
              <Text style={styles.cartItemPrice}>{money(item.unitPrice)} c/u</Text>
            </View>
            <View style={styles.cartQtyRow}>
              <TouchableOpacity style={styles.cartQtyBtn} onPress={() => onUpdate(item.productId, -1)}><Text style={styles.cartQtyBtnText}>−</Text></TouchableOpacity>
              <Text style={styles.cartQtyNum}>{item.quantity}</Text>
              <TouchableOpacity style={styles.cartQtyBtn} onPress={() => onUpdate(item.productId, 1)}><Text style={styles.cartQtyBtnText}>+</Text></TouchableOpacity>
            </View>
            <Text style={styles.cartItemSub}>{money(item.subtotal)}</Text>
            <TouchableOpacity onPress={() => onRemove(item.productId)} style={{ marginLeft: 4 }}>
              <Text style={{ color: '#d32121', fontSize: 16 }}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    )}

    {/* Totales */}
    <View style={styles.cartTotals}>
      <View style={styles.cartTotalRow}><Text style={styles.cartTotalLabel}>Subtotal</Text><Text style={styles.cartTotalValue}>{money(subtotal)}</Text></View>
      <View style={styles.cartTotalRow}><Text style={styles.cartTotalLabel}>ISV (15%)</Text><Text style={styles.cartTotalValue}>{money(isv)}</Text></View>
      <View style={[styles.cartTotalRow, styles.cartTotalRowBig]}><Text style={styles.cartTotalLabelBig}>Total</Text><Text style={styles.cartTotalValueBig}>{money(total)}</Text></View>
    </View>

    <Button
      mode="contained" onPress={onSubmit} loading={submitting}
      disabled={cart.length === 0 || submitting}
      buttonColor="#168542" textColor="#fff"
      style={{ borderRadius: 10, marginTop: 10 }}
      labelStyle={{ fontSize: 15, fontWeight: '900' }}>
      ✓ Confirmar venta
    </Button>
  </View>
);

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Sin turno
  noShift:        { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 16 },
  noShiftIcon:    { fontSize: 52 },
  noShiftTitle:   { fontSize: 22, fontWeight: '900', color: '#161616' },
  noShiftSub:     { fontSize: 14, color: '#6b7581', textAlign: 'center' },

  // POS container
  posContainer:   { flex: 1, backgroundColor: '#f4f6f8', flexDirection: 'column' },

  // Header
  header:         { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, padding: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e8ecf2' },
  headerTitle:    { fontSize: 18, fontWeight: '900', color: '#161616' },
  headerSub:      { fontSize: 12, color: '#6b7581', fontWeight: '700', marginTop: 2 },

  // Chips de local
  storeChips:     { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  chip:           { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#f4f6f8', borderWidth: 1, borderColor: '#e8ecf2' },
  chipActive:     { backgroundColor: '#ffd43b', borderColor: '#f5c400' },
  chipText:       { fontSize: 13, fontWeight: '700', color: '#6b7581' },
  chipTextActive: { color: '#161616', fontWeight: '900' },

  // Barra de categorías
  catsBar:        { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e8ecf2', paddingVertical: 10 },
  catChip:        { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#f4f6f8', borderWidth: 1, borderColor: '#e8ecf2' },
  catChipActive:  { backgroundColor: '#ffd43b18', borderColor: '#ffd43b' },
  catChipText:    { fontSize: 13, fontWeight: '700', color: '#53606d' },
  catChipTextActive: { color: '#161616', fontWeight: '900' },

  // Buscador
  searchRow:      { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e8ecf2' },
  searchBox:      { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f4f6f8', borderRadius: 10, paddingHorizontal: 12, height: 40 },
  searchInput:    { flex: 1, fontSize: 14, color: '#161616', outlineStyle: 'none' } as any,

  // Layout
  main:           { flex: 1 },
  mainDesktop:    { flexDirection: 'row' },

  // Grilla de productos
  grid:           { flexDirection: 'row', flexWrap: 'wrap', padding: 10, gap: 10 },
  empty:          { flex: 1, textAlign: 'center', color: '#6b7581', marginTop: 40 },
  productCard:    { width: 150, minWidth: 140, flex: 1, maxWidth: 200, backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#e8ecf2', padding: 12, gap: 4 },
  productName:    { fontSize: 14, fontWeight: '900', color: '#161616' },
  productSku:     { fontSize: 11, color: '#6b7581', fontWeight: '700' },
  productPrice:   { fontSize: 18, fontWeight: '950', color: '#161616', marginTop: 4 },
  stockBadge:     { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3, alignSelf: 'flex-start', marginTop: 4 },
  stockText:      { fontSize: 11, fontWeight: '800' },

  // Carrito desktop
  cartDesktop:    { width: 300, backgroundColor: '#fff', borderLeftWidth: 1, borderLeftColor: '#e8ecf2' },

  // Carrito mobile
  cartBar:        { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffd43b', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#f5c400' },
  cartBarText:    { flex: 1, fontSize: 14, fontWeight: '900', color: '#161616' },
  cartBarTotal:   { fontSize: 16, fontWeight: '950', color: '#161616', marginRight: 8 },
  cartBarArrow:   { fontSize: 16, color: '#161616' },
  cartMobile:     { backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e8ecf2', maxHeight: 380 },

  // CartPanel interno
  cart:           { flex: 1, padding: 14, flexDirection: 'column' },
  cartHeader:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  cartTitle:      { fontSize: 16, fontWeight: '950', color: '#161616' },
  cartClear:      { fontSize: 12, color: '#d32121', fontWeight: '700' },
  cartEmpty:      { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  cartEmptyText:  { color: '#b8c0cc', fontSize: 14, fontWeight: '700' },
  cartEmptyIcon:  { fontSize: 32 },
  cartItem:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f4f6f8', gap: 6 },
  cartItemName:   { fontSize: 13, fontWeight: '800', color: '#161616' },
  cartItemPrice:  { fontSize: 11, color: '#6b7581' },
  cartQtyRow:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cartQtyBtn:     { width: 26, height: 26, borderRadius: 6, backgroundColor: '#f4f6f8', justifyContent: 'center', alignItems: 'center' },
  cartQtyBtnText: { fontSize: 16, fontWeight: '900', color: '#161616' },
  cartQtyNum:     { fontSize: 14, fontWeight: '900', color: '#161616', minWidth: 22, textAlign: 'center' },
  cartItemSub:    { fontSize: 13, fontWeight: '800', color: '#161616', minWidth: 70, textAlign: 'right' },
  cartTotals:     { borderTopWidth: 1, borderTopColor: '#e8ecf2', paddingTop: 10, gap: 4, marginTop: 8 },
  cartTotalRow:   { flexDirection: 'row', justifyContent: 'space-between' },
  cartTotalRowBig:{ marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#e8ecf2' },
  cartTotalLabel: { fontSize: 13, color: '#6b7581', fontWeight: '700' },
  cartTotalValue: { fontSize: 13, color: '#6b7581', fontWeight: '700' },
  cartTotalLabelBig: { fontSize: 16, fontWeight: '950', color: '#161616' },
  cartTotalValueBig: { fontSize: 18, fontWeight: '950', color: '#161616' },

  // Modal cantidad
  qtyRow:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, marginVertical: 14 },
  qtyBtn:         { width: 42, height: 42, borderRadius: 10, backgroundColor: '#f4f6f8', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#e8ecf2' },
  qtyBtnText:     { fontSize: 22, fontWeight: '900', color: '#161616' },
  qtyInput:       { width: 70, height: 46, borderWidth: 1, borderColor: '#e8ecf2', borderRadius: 10, textAlign: 'center', fontSize: 22, fontWeight: '900', color: '#161616', backgroundColor: '#fff' },
  modalPrice:     { fontSize: 20, fontWeight: '900', color: '#168542', marginTop: 4 },
  modalSubtotal:  { textAlign: 'center', fontSize: 14, color: '#53606d', fontWeight: '700', marginBottom: 8 },

  // Modal cierre
  sumRow:         { flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f4f6f8' },
  sumCell:        { fontSize: 13, color: '#161616', fontWeight: '600' },
  sumHeader:      { fontWeight: '900', color: '#53606d', fontSize: 12 },
  sumDivider:     { height: 1, backgroundColor: '#e8ecf2', marginVertical: 8 },
  sumTotals:      { gap: 4 },
  sumTotalRow:    { flexDirection: 'row', justifyContent: 'space-between' },
  sumTotalRowBig: { marginTop: 6, paddingTop: 6, borderTopWidth: 2, borderTopColor: '#161616' },
  sumLabel:       { fontSize: 13, color: '#6b7581', fontWeight: '700' },
  sumValue:       { fontSize: 13, color: '#6b7581', fontWeight: '700' },
  sumLabelBig:    { fontSize: 16, fontWeight: '950', color: '#161616' },
  sumValueBig:    { fontSize: 18, fontWeight: '950', color: '#161616' },
  sumCount:       { fontSize: 12, color: '#6b7581', marginTop: 4 },
  closingWarn:    { fontSize: 13, color: '#c05f00', fontWeight: '700', textAlign: 'center', marginVertical: 10 },

  // Modales genéricos
  overlay:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modal:          { backgroundColor: '#fff', borderRadius: 18, padding: 22, width: '92%', maxWidth: 460 },
  modalTitle:     { fontSize: 20, fontWeight: '900', color: '#161616', marginBottom: 4 },
  modalSub:       { fontSize: 14, color: '#53606d', fontWeight: '600', marginBottom: 4 },
  modalActions:   { flexDirection: 'row', gap: 10, marginTop: 14 },
});

export default POSScreen;
