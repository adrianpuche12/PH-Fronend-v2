import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput as RNTextInput, ActivityIndicator, Modal,
  useWindowDimensions, Platform,
} from 'react-native';
import { Button, Snackbar } from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import ConfirmDialog from '../components/ConfirmDialog';
import { COLOR, SPACE, RADIUS, FONT_SIZE, FONT_WEIGHT, SHADOW, CONTROL } from '../theme';
import axios from 'axios';
import { REACT_APP_API_URL } from '../config';
import { useStore } from '../context/StoreContext';
import { useAuth } from '../context/AuthContext';
import { formatHnl } from '../utils/format';
import StoreDropdown from '../components/StoreDropdown';

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
interface ShiftExpense { id: number; description: string; amount: number; username: string; createdAt: string; }
interface DailySummary {
  date: string; storeId: number; storeName: string; totalSales: number;
  totalSubtotal: number; totalIsv: number; totalAmount: number;
  openingCashAmount: number; totalCashSales: number; totalCardSales: number;
  totalCardSurcharge: number;
  totalShiftExpenses: number;
  productSummary: ProductSummaryItem[];
}

const ISV = 0; // ISV deshabilitado por solicitud del cliente
const CARD_SURCHARGE_RATE = 0.03; // Recargo por pago con tarjeta de crédito/débito

// Aplana categorías para chips
const flatCats = (cats: Category[]): Category[] => {
  const out: Category[] = [];
  for (const c of cats) { out.push(c); if (c.children?.length) out.push(...flatCats(c.children)); }
  return out;
};

// ─── POSScreen ────────────────────────────────────────────────────────────────

export default function POSScreen({ hideStoreSelector = false }: { hideStoreSelector?: boolean }) {
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

  // KPIs del turno (ventas confirmadas + total acumulado)
  const [kpiCount, setKpiCount]       = useState(0);
  const [kpiTotal, setKpiTotal]       = useState(0);

  // Selección y cantidad pendiente (no se agrega al carrito hasta click en Agregar)
  const [selectedId, setSelectedId]   = useState<number | null>(null);
  const [pendingQty, setPendingQty]   = useState(1);

  // Carrito: array fijo — solo se puede eliminar, no editar qty
  const [cart, setCart]               = useState<CartItem[]>([]);
  const [snackbar, setSnackbar]       = useState('');
  const [submitting, setSubmitting]   = useState(false);

  // Modal de método de pago
  const [paymentModal, setPaymentModal]       = useState(false);
  const [paymentMethod, setPaymentMethod]     = useState<'CASH'|'CARD'|'MIXED'>('CASH');
  const [mixedCash, setMixedCash]             = useState('');
  const [mixedCard, setMixedCard]             = useState('');

  // Tab del POS
  const [posTab, setPosTab]               = useState<'nueva' | 'ventas' | 'egresos'>('nueva');
  const [cartModalOpen, setCartModalOpen] = useState(false); // mobile: modal del carrito
  const [kpiCollapsed, setKpiCollapsed]   = useState(false); // mobile: colapsar barra de stats
  const [shiftSales, setShiftSales]       = useState<SaleRecord[]>([]);
  const [loadingSales, setLoadingSales]   = useState(false);
  const [cancellingId, setCancellingId]   = useState<number | null>(null);

  // Egresos del turno
  const [shiftExpenses, setShiftExpenses]       = useState<ShiftExpense[]>([]);
  const [loadingExpenses, setLoadingExpenses]   = useState(false);
  const [expenseDesc, setExpenseDesc]           = useState('');
  const [expenseAmount, setExpenseAmount]       = useState('');
  const [savingExpense, setSavingExpense]        = useState(false);
  const [confirmDlg, setConfirmDlg]       = useState<{ title: string; message: string; confirmLabel: string; onConfirm: () => void } | null>(null);
  const askConfirm = (title: string, message: string, onConfirm: () => void, confirmLabel = 'Sí, anular') =>
    setConfirmDlg({ title, message, confirmLabel, onConfirm });

  // Edición de egresos
  const [editingExpense, setEditingExpense]     = useState<ShiftExpense | null>(null);
  const [editExpenseDesc, setEditExpenseDesc]   = useState('');
  const [editExpenseAmount, setEditExpenseAmount] = useState('');
  const [savingEditExpense, setSavingEditExpense] = useState(false);
  const [deletingExpenseId, setDeletingExpenseId] = useState<number | null>(null);

  // Modales
  const [openShiftModal, setOpenShiftModal] = useState(false);
  const [closingModal, setClosingModal]     = useState(false);
  const [closingModalError, setClosingModalError] = useState('');
  const [summary, setSummary]               = useState<DailySummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [closingDone, setClosingDone]       = useState(false);

  // Apertura — fondo inicial
  const [openingCash, setOpeningCash]           = useState('');

  // Reconciliación de caja al cierre
  const [declaredCash, setDeclaredCash]         = useState('');
  interface ClosingResult {
    openingCashAmount: number; totalCashSales: number;
    totalShiftExpenses: number; expectedCashAmount: number;
    totalCardSales: number; totalCardSurcharge: number;
    declaredCashAmount: number; cashDifference: number;
  }
  const [closingResult, setClosingResult]       = useState<ClosingResult | null>(null);

  // ── Cargar turno y catálogo ───────────────────────────────────────────────

  const loadShift = useCallback(async () => {
    if (!storeId) return;
    setLoadingShift(true);
    try {
      const res = await axios.get<Shift>(`${API}/api/v2/shifts/active/${storeId}`, {
        params: { username: userName ?? 'empleada' },
      });
      setShift(res.data ?? null);
    } catch { setShift(null); }
    finally { setLoadingShift(false); }
  }, [storeId, userName]);

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
      // Actualiza KPIs con datos reales del servidor
      setKpiCount(res.data.length);
      setKpiTotal(res.data.reduce((s, v) => s + v.total, 0));
    } catch { /* silencioso */ }
    finally { setLoadingSales(false); }
  }, [shift]);

  // Carga KPIs al activarse el turno
  useEffect(() => {
    if (shift) loadShiftSales();
    else { setKpiCount(0); setKpiTotal(0); }
  }, [shift]);

  const handleSwitchTab = (tab: 'nueva' | 'ventas' | 'egresos') => {
    setPosTab(tab);
    if (tab === 'ventas') loadShiftSales();
    if (tab === 'egresos') loadExpenses();
  };

  const handleCancelSale = (saleId: number) => {
    askConfirm(
      'Anular venta',
      '¿Anular esta venta? El stock descontado será revertido automáticamente.',
      async () => {
        setCancellingId(saleId);
        try {
          const cancelled = shiftSales.find(s => s.id === saleId);
          await axios.delete(`${API}/api/v2/sales/${saleId}`);
          setShiftSales(prev => prev.filter(s => s.id !== saleId));
          if (cancelled) {
            setKpiCount(prev => Math.max(0, prev - 1));
            setKpiTotal(prev => Math.max(0, prev - cancelled.total));
          }
          loadCatalog();
        } catch (e: any) { setSnackbar(e.response?.data?.error || 'Error al anular'); }
        finally { setCancellingId(null); }
      }
    );
  };

  // ── Egresos del turno ────────────────────────────────────────────────────

  const loadExpenses = useCallback(async () => {
    if (!shift) return;
    setLoadingExpenses(true);
    try {
      const res = await axios.get<ShiftExpense[]>(`${API}/api/v2/shifts/${shift.id}/expenses`);
      setShiftExpenses(res.data);
    } catch { /* silencioso */ }
    finally { setLoadingExpenses(false); }
  }, [shift]);

  const handleAddExpense = async () => {
    if (!shift || !expenseDesc.trim() || !expenseAmount) return;
    const amount = parseFloat(expenseAmount);
    if (isNaN(amount) || amount <= 0) { setSnackbar('Ingresá un monto válido'); return; }
    setSavingExpense(true);
    try {
      await axios.post(`${API}/api/v2/shifts/${shift.id}/expenses`, {
        description: expenseDesc.trim(),
        amount,
        username: userName ?? 'empleada',
      });
      setExpenseDesc('');
      setExpenseAmount('');
      loadExpenses();
    } catch (e: any) { setSnackbar(e.response?.data?.error || 'Error al registrar egreso'); }
    finally { setSavingExpense(false); }
  };

  const handleEditExpense = (exp: ShiftExpense) => {
    setEditingExpense(exp);
    setEditExpenseDesc(exp.description);
    setEditExpenseAmount(String(exp.amount));
  };

  const handleSaveEditExpense = async () => {
    if (!editingExpense || !editExpenseDesc.trim() || !editExpenseAmount) return;
    const amount = parseFloat(editExpenseAmount);
    if (isNaN(amount) || amount <= 0) { setSnackbar('Ingresá un monto válido'); return; }
    setSavingEditExpense(true);
    try {
      await axios.put(`${API}/api/v2/expenses/${editingExpense.id}`, {
        description: editExpenseDesc.trim(),
        amount,
      });
      setEditingExpense(null);
      loadExpenses();
    } catch (e: any) { setSnackbar(e.response?.data?.error || 'Error al editar egreso'); }
    finally { setSavingEditExpense(false); }
  };

  const handleDeleteExpense = (exp: ShiftExpense) => {
    askConfirm(
      'Eliminar egreso',
      `¿Eliminar el egreso "${exp.description}" por ${formatHnl(exp.amount)}?`,
      async () => {
        setDeletingExpenseId(exp.id);
        try {
          await axios.delete(`${API}/api/v2/expenses/${exp.id}`);
          setShiftExpenses(prev => prev.filter(e => e.id !== exp.id));
        } catch (e: any) { setSnackbar(e.response?.data?.error || 'Error al eliminar egreso'); }
        finally { setDeletingExpenseId(null); }
      },
      'Sí, eliminar'
    );
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
    if (pendingQty > item.quantity) {
      setSnackbar(`Stock insuficiente. Disponible: ${item.quantity} unidades.`);
      return;
    }
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
      const res = await axios.post<Shift>(`${API}/api/v2/stores/${storeId}/shifts`, {
        username: userName ?? 'empleada',
        openingCashAmount: parseFloat(openingCash) || 0,
      });
      setShift(res.data);
      setOpenShiftModal(false);
      setOpeningCash('');
      setSnackbar(`Turno ${res.data.code} abierto`);
    } catch (e: any) { setSnackbar(e.response?.data?.error || 'Error al abrir turno'); }
  };

  // ── Confirmar venta ───────────────────────────────────────────────────────

  // Abre el modal de método de pago
  const handleSubmitSale = () => {
    if (!shift || cart.length === 0) return;
    setPaymentMethod('CASH');
    setMixedCash('');
    setMixedCard('');
    setPaymentModal(true);
  };

  // Envía la venta con el método de pago elegido
  const confirmWithPayment = async () => {
    if (!shift) return;

    // Validar pago mixto antes de enviar
    if (paymentMethod === 'MIXED') {
      const cash = parseFloat(mixedCash) || 0;
      const card = parseFloat(mixedCard) || 0;
      const diff = Math.abs(cash + card - cartTotal);
      if (diff > 0.01) {
        setSnackbar(`Efectivo + Tarjeta (L ${(cash + card).toFixed(2)}) no coincide con el total (L ${cartTotal.toFixed(2)})`);
        return;
      }
    }

    setSubmitting(true);
    setPaymentModal(false);
    try {
      const body: any = {
        username: userName ?? 'empleada',
        items: cart.map(i => ({ productId: i.productId, quantity: i.qty })),
        paymentMethod,
      };
      if (paymentMethod === 'MIXED') {
        body.cashAmount = parseFloat(mixedCash) || 0;
        body.cardAmount = parseFloat(mixedCard) || 0;
      }
      const res = await axios.post<SaleRecord>(`${API}/api/v2/shifts/${shift.id}/sales`, body);
      const saleTotal = res.data.total;
      setKpiCount(prev => prev + 1);
      setKpiTotal(prev => prev + saleTotal);
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
    setDeclaredCash('');
    setClosingResult(null);
    try {
      const res = await axios.get<DailySummary>(`${API}/api/v2/shifts/${shift.id}/summary`);
      setSummary(res.data);
    } catch { setSnackbar('Error al cargar resumen'); setClosingModal(false); }
    finally { setLoadingSummary(false); }
  };

  const handleConfirmClosing = async () => {
    if (!shift) return;
    if (declaredCash.trim() === '') {
      setClosingModalError('Ingresá el efectivo que tenés en mano para continuar.');
      return;
    }
    const declared = parseFloat(declaredCash);
    if (isNaN(declared) || declared < 0) {
      setClosingModalError('El monto de efectivo debe ser un número válido.');
      return;
    }
    setClosingModalError('');
    try {
      const res = await axios.post(`${API}/api/v2/shifts/${shift.id}/closing`, {
        username: userName ?? 'empleada',
        declaredCashAmount: declared,
      });
      setClosingResult(res.data);
      setClosingDone(true);
    } catch (e: any) {
      setClosingModalError(e.response?.data?.error || 'No se pudo confirmar el cierre. Intentá de nuevo.');
    }
  };

  // ── Stock color ───────────────────────────────────────────────────────────

  const stockColor = (item: StockItem) =>
    item.quantity === 0 ? COLOR.expense : item.lowStock ? COLOR.warn : COLOR.income;

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  if (loadingShift) return <ActivityIndicator size="large" color={COLOR.brand} style={{ flex: 1, marginTop: 60 }} />;

  // ── Sin turno activo ──────────────────────────────────────────────────────

  if (!shift) return (
    <View style={styles.noShift}>
      <MaterialCommunityIcons name="clock-outline" size={52} color={COLOR.inkDisabled} />
      <Text style={styles.noShiftTitle}>Sin turno activo</Text>
      <Text style={styles.noShiftSub}>Abrí un turno para comenzar a registrar ventas</Text>

      {/* Selector de local — solo para admin */}
      {!hideStoreSelector && (
        <StoreDropdown
          stores={stores}
          selectedId={selectedStore?.id ?? null}
          onSelect={(id) => { const s = stores.find(s => s.id === id); if (s) setSelectedStore(s); }}
        />
      )}

      <Button mode="contained" onPress={() => setOpenShiftModal(true)} buttonColor={COLOR.brand} textColor={COLOR.inkOnBrand} style={{ borderRadius: RADIUS.r2 }} labelStyle={{ fontSize: FONT_SIZE.h3, fontWeight: FONT_WEIGHT.black as any }}>
        Abrir turno
      </Button>

      <Modal visible={openShiftModal} transparent animationType="fade" onRequestClose={() => setOpenShiftModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Abrir turno</Text>
            <Text style={styles.modalSub}>Local: <Text style={{ fontWeight: '900' }}>{selectedStore?.name ?? '—'}</Text></Text>
            <Text style={styles.modalSub}>Empleada: <Text style={{ fontWeight: '900' }}>{userName ?? '—'}</Text></Text>

            {/* Fondo inicial */}
            <View style={[styles.cashInputBox, { marginTop: SPACE.s3 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.s2, marginBottom: SPACE.s2 }}>
                <MaterialCommunityIcons name="cash-register" size={18} color={COLOR.income} />
                <Text style={styles.cashInputLabel}>Fondo inicial en caja</Text>
              </View>
              <View style={styles.cashInputRow}>
                <Text style={styles.cashInputPrefix}>L</Text>
                <RNTextInput
                  style={styles.cashInput}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={COLOR.inkDisabled}
                  value={openingCash}
                  onChangeText={setOpeningCash}
                />
              </View>
              <Text style={{ fontSize: FONT_SIZE.caption, color: COLOR.inkMute, marginTop: SPACE.s1 }}>
                Ingresá el efectivo que ya hay en la caja al iniciar el turno.
              </Text>
            </View>

            <View style={styles.modalActions}>
              <Button mode="outlined" onPress={() => setOpenShiftModal(false)} style={{ flex: 1 }}>Cancelar</Button>
              <Button mode="contained" onPress={handleOpenShift} buttonColor={COLOR.brand} textColor={COLOR.inkOnBrand} style={{ flex: 1 }}>Confirmar</Button>
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

      {/* ══ HEADER — oculto en mobile cuando kpiCollapsed ══ */}
      {(!isDesktop && kpiCollapsed) ? null : (
        <View style={styles.header}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.headerBrand}>Pollos Hermanos</Text>
            <Text style={styles.headerShift} numberOfLines={1}>● {shift.code} · {shift.username}</Text>
          </View>

          {/* Selector de local — oculto para empleados (hideStoreSelector=true) */}
          {!hideStoreSelector && (
            <StoreDropdown
              stores={stores}
              selectedId={selectedStore?.id ?? null}
              onSelect={(id) => { const s = stores.find(s => s.id === id); if (s) setSelectedStore(s); }}
            />
          )}

          <Button mode="outlined" onPress={openClosing} textColor={COLOR.expense} style={{ borderColor: COLOR.expense, borderRadius: RADIUS.r1 }} labelStyle={{ fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.black as any }}>
            Cerrar turno
          </Button>
        </View>
      )}

      {/* ══ KPIs del turno ══ */}
      <View style={styles.kpiBar}>
        {!isDesktop && kpiCollapsed ? (
          <TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.s1 }} onPress={() => setKpiCollapsed(false)}>
            <Text style={[styles.kpiValue, { fontSize: 10 }]}>{kpiCount} ventas · {formatHnl(kpiTotal)}</Text>
            <MaterialCommunityIcons name="chevron-down" size={14} color={COLOR.brand} />
          </TouchableOpacity>
        ) : (
          <>
            <View style={styles.kpiItem}>
              <Text style={styles.kpiLabel}>Ventas del turno</Text>
              <Text style={styles.kpiValue}>{kpiCount}</Text>
            </View>
            <View style={styles.kpiDivider} />
            <View style={styles.kpiItem}>
              <Text style={styles.kpiLabel}>Total acumulado</Text>
              <Text style={styles.kpiValue}>{formatHnl(kpiTotal)}</Text>
            </View>
            <View style={styles.kpiDivider} />
            <View style={styles.kpiItem}>
              <Text style={styles.kpiLabel}>Turno</Text>
              <Text style={styles.kpiValue} numberOfLines={1}>{shift?.code ?? '—'}</Text>
            </View>
            {!isDesktop && (
              <TouchableOpacity onPress={() => setKpiCollapsed(true)} style={{ paddingHorizontal: 6, justifyContent: 'center' }}>
                <MaterialCommunityIcons name="chevron-up" size={16} color={COLOR.brand} />
              </TouchableOpacity>
            )}
          </>
        )}
      </View>

      {/* ══ TABS: Nueva venta / Ventas del turno ══ */}
      <View style={styles.tabBar}>
        <TouchableOpacity style={[styles.posTab, posTab === 'nueva' && styles.posTabActive]} onPress={() => handleSwitchTab('nueva')}>
          <Text style={[styles.posTabText, posTab === 'nueva' && styles.posTabTextActive]}>Nueva venta</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.posTab, posTab === 'ventas' && styles.posTabActive]} onPress={() => handleSwitchTab('ventas')}>
          <Text style={[styles.posTabText, posTab === 'ventas' && styles.posTabTextActive]}>
            Ventas{shiftSales.length > 0 ? ` (${shiftSales.length})` : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.posTab, posTab === 'egresos' && styles.posTabActive]} onPress={() => handleSwitchTab('egresos')}>
          <Text style={[styles.posTabText, posTab === 'egresos' && styles.posTabTextActive]}>
            Egresos{shiftExpenses.length > 0 ? ` (${shiftExpenses.length})` : ''}
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
          <MaterialCommunityIcons name="magnify" size={18} color={COLOR.inkMute} style={{ marginRight: SPACE.s1 }} />
          <RNTextInput
            placeholder="Buscar producto por nombre o código..." placeholderTextColor={COLOR.inkDisabled}
            value={search} onChangeText={setSearch} style={styles.searchInput}
          />
          {search ? <TouchableOpacity onPress={() => setSearch('')}><MaterialCommunityIcons name="close-circle" size={18} color={COLOR.inkDisabled} /></TouchableOpacity> : null}
        </View>
        {/* Conteo de productos + local — solo en desktop */}
        {isDesktop && <Text style={styles.catalogMeta}>Productos activos · {selectedStore?.name}  <Text style={styles.catalogCount}>{filtered.length} productos</Text></Text>}
      </View>}

      {/* ══ LAYOUT PRINCIPAL ══ */}
      {posTab === 'nueva' && <View style={[styles.main, isDesktop && styles.mainDesktop]}>

        {/* Grilla de productos — padding extra en mobile para no tapar con la barra flotante */}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.grid, !isDesktop && cart.length > 0 && { paddingBottom: 80 }]}>
          {loading
            ? <ActivityIndicator color={COLOR.brand} style={{ marginTop: 40 }} />
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
                          <Text style={styles.inCartBadgeText}>En carrito</Text>
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
                        <Text style={styles.pcPrice}>{formatHnl(item.price)}</Text>
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
                            <Text style={[styles.qtyNum, pendingQty >= item.quantity && { color: COLOR.expense }]}>{pendingQty}</Text>
                            <TouchableOpacity
                              style={[styles.qtyBtn, pendingQty >= item.quantity && { opacity: 0.4 }]}
                              onPress={() => setPendingQty(q => Math.min(q + 1, item.quantity))}
                              disabled={pendingQty >= item.quantity}
                            >
                              <Text style={styles.qtyBtnText}>+</Text>
                            </TouchableOpacity>
                          </View>
                          {pendingQty >= item.quantity && item.quantity > 0 && (
                            <Text style={{ fontSize: 10, color: COLOR.expense, marginBottom: 2 }}>Máx. {item.quantity}</Text>
                          )}
                          <TouchableOpacity style={styles.addBtn} onPress={addToCart}>
                            <Text style={styles.addBtnText}>Agregar</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        /* Estado inactivo */
                        <View style={styles.pcBottomInactive}>
                          <Text style={[styles.pcTapHint, outOfStock && { color: COLOR.expense }]}>
                            {outOfStock ? 'No disponible' : inCart ? 'En carrito' : 'Toca para seleccionar'}
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })
          }
        </ScrollView>

        {/* ══ TICKET ══ */}
        {isDesktop && (
          <View style={styles.ticketDesktop}>
            <Ticket cart={cart} subtotal={cartSubtotal} isv={cartISV} total={cartTotal} itemCount={cartItemCount} onRemove={removeFromCart} onClear={clearCart} onSubmit={handleSubmitSale} submitting={submitting} full />
          </View>
        )}
      </View>}

      {/* ══ BARRA FLOTANTE DEL CARRITO (mobile) ══ */}
      {!isDesktop && posTab === 'nueva' && cart.length > 0 && (
        <TouchableOpacity style={styles.cartFloatingBar} onPress={() => setCartModalOpen(true)} activeOpacity={0.9}>
          <View style={styles.cartBarBadge}>
            <Text style={styles.cartBarBadgeText}>{cartItemCount}</Text>
          </View>
          <Text style={styles.cartBarLabel}>Ver carrito</Text>
          <Text style={styles.cartBarTotal}>{formatHnl(cartTotal)}</Text>
          <MaterialCommunityIcons name="chevron-up" size={20} color={COLOR.inkOnBrand} />
        </TouchableOpacity>
      )}

      {/* ══ MODAL CARRITO MOBILE ══ */}
      <Modal visible={cartModalOpen} transparent animationType="slide" onRequestClose={() => setCartModalOpen(false)}>
        <View style={styles.cartModalOverlay}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setCartModalOpen(false)} />
          <View style={styles.cartModalSheet}>
            <View style={styles.cartModalHandle} />
            <View style={styles.cartModalHead}>
              <Text style={styles.cartModalTitle}>Carrito</Text>
              <View style={styles.cartBarBadge}><Text style={styles.cartBarBadgeText}>{cartItemCount}</Text></View>
            </View>
            <ScrollView style={{ maxHeight: 260 }}>
              {cart.map(item => (
                <View key={item.productId} style={styles.cartModalItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cartModalItemName} numberOfLines={1}>{item.productName}</Text>
                    <Text style={styles.cartModalItemSub}>{item.qty} × {formatHnl(item.price)}</Text>
                  </View>
                  <Text style={styles.cartModalItemTotal}>{formatHnl(item.subtotal)}</Text>
                  <TouchableOpacity onPress={() => removeFromCart(item.productId)} style={{ padding: 4 }}>
                    <MaterialCommunityIcons name="trash-can-outline" size={18} color={COLOR.expense} />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
            <View style={styles.cartModalTotals}>
              <Text style={styles.cartModalTotalLabel}>TOTAL</Text>
              <Text style={styles.cartModalTotalAmount}>{formatHnl(cartTotal)}</Text>
            </View>
            <View style={{ gap: SPACE.s2 }}>
              <Button mode="contained" onPress={() => { setCartModalOpen(false); handleSubmitSale(); }}
                loading={submitting} disabled={submitting}
                buttonColor={COLOR.brand} textColor={COLOR.inkOnBrand}
                style={{ borderRadius: RADIUS.r2 }} labelStyle={{ fontWeight: FONT_WEIGHT.black as any }}>
                Confirmar venta
              </Button>
              <Button mode="outlined" onPress={() => { setCartModalOpen(false); clearCart(); }}
                textColor={COLOR.expense} style={{ borderRadius: RADIUS.r2 }}>
                Cancelar venta
              </Button>
            </View>
          </View>
        </View>
      </Modal>

      {/* ══ TAB VENTAS DEL TURNO ══ */}
      {posTab === 'ventas' && (
        <View style={{ flex: 1 }}>
          {loadingSales ? (
            <ActivityIndicator color={COLOR.brand} size="large" style={{ marginTop: 40 }} />
          ) : (
            <ScrollView contentContainerStyle={{ padding: 12, gap: 10 }}>
              {shiftSales.length === 0 ? (
                <View style={styles.salesEmpty}>
                  <MaterialCommunityIcons name="receipt-text-outline" size={40} color={COLOR.inkDisabled} />
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
                      {formatHnl(shiftSales.reduce((s, v) => s + v.total, 0))}
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
                        <Text style={styles.saleCardTotal}>{formatHnl(sale.total)}</Text>
                        <TouchableOpacity
                          style={[styles.cancelBtn, cancellingId === sale.id && { opacity: 0.5 }]}
                          onPress={() => handleCancelSale(sale.id)}
                          disabled={cancellingId === sale.id}
                        >
                          <Text style={styles.cancelBtnText}>
                            {cancellingId === sale.id ? '...' : 'Anular'}
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {/* Items de la venta */}
                      <View style={styles.saleCardItems}>
                        {sale.items.map(item => (
                          <Text key={item.id} style={styles.saleCardItem} numberOfLines={1}>
                            · {item.productName} × {item.quantity}  <Text style={{ color: COLOR.ink2 }}>{formatHnl(item.subtotal)}</Text>
                          </Text>
                        ))}
                      </View>

                      <View style={styles.saleCardFooter}>
                        <Text style={styles.saleCardFooterText}>Total: {formatHnl(sale.total)}</Text>
                      </View>
                    </View>
                  ))}
                </>
              )}
            </ScrollView>
          )}
        </View>
      )}

      {/* ══ TAB EGRESOS DEL TURNO ══ */}
      {posTab === 'egresos' && (
        <View style={{ flex: 1 }}>
          {/* Formulario de nuevo egreso */}
          <View style={styles.expenseForm}>
            <Text style={styles.expenseFormTitle}>Registrar egreso en efectivo</Text>
            <RNTextInput
              style={styles.expenseInput}
              placeholder="Descripción (ej: Tortillas maíz)"
              placeholderTextColor={COLOR.inkDisabled}
              value={expenseDesc}
              onChangeText={setExpenseDesc}
            />
            <View style={{ flexDirection: 'row', gap: SPACE.s2, alignItems: 'center' }}>
              <View style={[styles.cashInputRow, { flex: 1 }]}>
                <Text style={styles.cashInputPrefix}>L</Text>
                <RNTextInput
                  style={styles.cashInput}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={COLOR.inkDisabled}
                  value={expenseAmount}
                  onChangeText={setExpenseAmount}
                />
              </View>
              <Button
                mode="contained"
                onPress={handleAddExpense}
                loading={savingExpense}
                disabled={savingExpense || !expenseDesc.trim() || !expenseAmount}
                buttonColor={COLOR.expense}
                textColor={COLOR.white}
                style={{ borderRadius: RADIUS.r2 }}
              >
                Registrar
              </Button>
            </View>
          </View>

          {/* Lista de egresos */}
          {loadingExpenses ? (
            <ActivityIndicator color={COLOR.brand} style={{ marginTop: 24 }} />
          ) : (
            <ScrollView contentContainerStyle={{ padding: SPACE.s3, gap: SPACE.s2 }}>
              {shiftExpenses.length === 0 ? (
                <View style={styles.salesEmpty}>
                  <MaterialCommunityIcons name="cash-minus" size={40} color={COLOR.inkDisabled} />
                  <Text style={styles.salesEmptyText}>Sin egresos registrados</Text>
                  <Text style={styles.salesEmptySub}>Los gastos en efectivo del turno se registran aquí.</Text>
                </View>
              ) : (
                <>
                  {/* Total de egresos */}
                  <View style={[styles.salesSummary, { borderColor: COLOR.expenseBorder }]}>
                    <Text style={styles.salesSummaryText}>
                      {shiftExpenses.length} egreso{shiftExpenses.length !== 1 ? 's' : ''}
                    </Text>
                    <Text style={[styles.salesSummaryTotal, { color: COLOR.expense }]}>
                      − {formatHnl(shiftExpenses.reduce((s, e) => s + e.amount, 0))}
                    </Text>
                  </View>

                  {shiftExpenses.map(exp => (
                    <View key={exp.id} style={styles.expenseCard}>
                      <View style={styles.expenseCardIcon}>
                        <MaterialCommunityIcons name="cash-minus" size={18} color={COLOR.expense} />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.expenseCardDesc} numberOfLines={1}>{exp.description}</Text>
                        <Text style={styles.expenseCardMeta}>
                          {new Date(exp.createdAt).toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit' })}
                          {' · '}{exp.username}
                        </Text>
                      </View>
                      <Text style={styles.expenseCardAmount}>− {formatHnl(exp.amount)}</Text>
                      <TouchableOpacity onPress={() => handleEditExpense(exp)} style={styles.expenseCardAction}>
                        <MaterialCommunityIcons name="pencil-outline" size={18} color={COLOR.inkMute} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDeleteExpense(exp)}
                        disabled={deletingExpenseId === exp.id}
                        style={[styles.expenseCardAction, deletingExpenseId === exp.id && { opacity: 0.5 }]}
                      >
                        <MaterialCommunityIcons name="trash-can-outline" size={18} color={COLOR.expense} />
                      </TouchableOpacity>
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
              <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                <MaterialCommunityIcons name="check-circle-outline" size={52} color={COLOR.income} />
                <Text style={[styles.modalTitle, { textAlign: 'center', marginTop: 12 }]}>Turno cerrado</Text>

                {closingResult && (() => {
                  const diff     = closingResult.cashDifference ?? 0;
                  const isOk     = Math.abs(diff) < 0.01;
                  const isSurplus = diff > 0;
                  const diffColor = isOk ? COLOR.income : isSurplus ? COLOR.info : COLOR.expense;
                  const diffLabel = isOk ? 'Caja cuadrada' : isSurplus ? 'Sobrante' : 'Faltante';
                  const diffIcon  = isOk ? 'check-circle' : isSurplus ? 'arrow-up-circle' : 'alert-circle';
                  return (
                    <View style={{ width: '100%', marginTop: SPACE.s4, gap: SPACE.s2 }}>
                      {/* Fondo inicial */}
                      <View style={styles.recRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.s2 }}>
                          <MaterialCommunityIcons name="cash-register" size={16} color={COLOR.inkMute} />
                          <Text style={styles.recLabel}>Fondo inicial</Text>
                        </View>
                        <Text style={styles.recValue}>{formatHnl(closingResult.openingCashAmount)}</Text>
                      </View>
                      {/* Ventas efectivo */}
                      <View style={styles.recRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.s2 }}>
                          <MaterialCommunityIcons name="cash" size={16} color={COLOR.income} />
                          <Text style={[styles.recLabel, { color: COLOR.income }]}>Ventas efectivo</Text>
                        </View>
                        <Text style={[styles.recValue, { color: COLOR.income }]}>{formatHnl(closingResult.totalCashSales)}</Text>
                      </View>
                      {/* Egresos del turno */}
                      {closingResult.totalShiftExpenses > 0 && (
                        <View style={styles.recRow}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.s2 }}>
                            <MaterialCommunityIcons name="cash-minus" size={16} color={COLOR.expense} />
                            <Text style={[styles.recLabel, { color: COLOR.expense }]}>Egresos del turno</Text>
                          </View>
                          <Text style={[styles.recValue, { color: COLOR.expense }]}>− {formatHnl(closingResult.totalShiftExpenses)}</Text>
                        </View>
                      )}
                      {/* Total esperado */}
                      <View style={[styles.recRow, { borderTopWidth: 1, borderTopColor: COLOR.border, paddingTop: SPACE.s1 }]}>
                        <Text style={[styles.recLabel, { fontWeight: FONT_WEIGHT.bold as any }]}>Total esperado</Text>
                        <Text style={[styles.recValue, { fontWeight: FONT_WEIGHT.bold as any }]}>{formatHnl(closingResult.expectedCashAmount)}</Text>
                      </View>
                      {/* Efectivo contado */}
                      <View style={styles.recRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.s2 }}>
                          <MaterialCommunityIcons name="hand-coin-outline" size={16} color={COLOR.inkMute} />
                          <Text style={styles.recLabel}>Efectivo contado</Text>
                        </View>
                        <Text style={styles.recValue}>{formatHnl(closingResult.declaredCashAmount)}</Text>
                      </View>
                      {/* Tarjeta */}
                      {closingResult.totalCardSales > 0 && (
                        <View style={styles.recRow}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.s2 }}>
                            <MaterialCommunityIcons name="credit-card-outline" size={16} color={COLOR.info} />
                            <Text style={[styles.recLabel, { color: COLOR.info }]}>Tarjeta</Text>
                          </View>
                          <Text style={[styles.recValue, { color: COLOR.info }]}>{formatHnl(closingResult.totalCardSales)}</Text>
                        </View>
                      )}
                      {/* Recargo tarjeta cobrado */}
                      {closingResult.totalCardSurcharge > 0 && (
                        <View style={styles.recRow}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.s2 }}>
                            <MaterialCommunityIcons name="cash-plus" size={16} color={COLOR.info} />
                            <Text style={[styles.recLabel, { color: COLOR.info }]}>Recargo tarjeta cobrado</Text>
                          </View>
                          <Text style={[styles.recValue, { color: COLOR.info }]}>+ {formatHnl(closingResult.totalCardSurcharge)}</Text>
                        </View>
                      )}
                      {/* Diferencia — destacada */}
                      <View style={[styles.recDiffBox, { borderColor: diffColor, backgroundColor: diffColor + '18' }]}>
                        <MaterialCommunityIcons name={diffIcon} size={20} color={diffColor} />
                        <Text style={[styles.recDiffLabel, { color: diffColor }]}>{diffLabel}</Text>
                        <Text style={[styles.recDiffAmount, { color: diffColor }]}>
                          {isOk ? '—' : `${isSurplus ? '+' : ''}${formatHnl(diff)}`}
                        </Text>
                      </View>
                    </View>
                  );
                })()}

                <Button mode="contained" buttonColor={COLOR.brand} textColor={COLOR.inkOnBrand} style={{ marginTop: 20, borderRadius: RADIUS.r2 }} onPress={() => {
                  setClosingModal(false);
                  setShift(null);
                  clearCart();
                }}>Aceptar</Button>
              </View>
            ) : loadingSummary ? (
              <ActivityIndicator color={COLOR.brand} style={{ margin: 40 }} />
            ) : summary ? (
              <>
                <Text style={styles.modalTitle}>Cierre de turno</Text>
                <Text style={styles.modalSub}>{selectedStore?.name} · {shift.code}</Text>

                <ScrollView style={{ flexShrink: 1, marginVertical: 12 }}>
                  <View style={styles.sumRow}>
                    <Text style={[styles.sumCell, styles.sumHeader, { flex: 1 }]}>Producto</Text>
                    <Text style={[styles.sumCell, styles.sumHeader, { width: 46, textAlign: 'center' }]}>Cant.</Text>
                    <Text style={[styles.sumCell, styles.sumHeader, { width: 88, textAlign: 'right' }]}>Subtotal</Text>
                  </View>
                  {summary.productSummary.map((p, i) => (
                    <View key={i} style={styles.sumRow}>
                      <Text style={[styles.sumCell, { flex: 1 }]} numberOfLines={1}>{p.productName}</Text>
                      <Text style={[styles.sumCell, { width: 46, textAlign: 'center' }]}>{p.quantity}</Text>
                      <Text style={[styles.sumCell, { width: 88, textAlign: 'right' }]}>{formatHnl(p.subtotal)}</Text>
                    </View>
                  ))}

                  <View style={styles.sumDivider} />
                <View style={{ gap: 4 }}>
                  <View style={styles.sumTotalRow}><Text style={styles.sumLabel}>Subtotal</Text><Text style={styles.sumValue}>{formatHnl(summary.totalSubtotal)}</Text></View>
                  <View style={[styles.sumTotalRow, { borderTopWidth: 2, borderTopColor: COLOR.ink, marginTop: 6, paddingTop: 6 }]}>
                    <Text style={{ fontSize: FONT_SIZE.h3, fontWeight: FONT_WEIGHT.black as any, color: COLOR.ink }}>Total del día</Text>
                    <Text style={{ fontSize: FONT_SIZE.h2, fontWeight: FONT_WEIGHT.black as any, color: COLOR.ink }}>{formatHnl(summary.totalAmount)}</Text>
                  </View>

                  {/* Desglose de caja */}
                  <View style={{ backgroundColor: COLOR.bg, borderRadius: RADIUS.r2, padding: SPACE.s3, marginTop: SPACE.s3, gap: SPACE.s1 }}>
                    <View style={styles.sumTotalRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.s2 }}>
                        <MaterialCommunityIcons name="cash-register" size={16} color={COLOR.inkMute} />
                        <Text style={styles.sumLabel}>Fondo inicial</Text>
                      </View>
                      <Text style={styles.sumValue}>{formatHnl(summary.openingCashAmount ?? 0)}</Text>
                    </View>
                    <View style={styles.sumTotalRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.s2 }}>
                        <MaterialCommunityIcons name="cash" size={16} color={COLOR.income} />
                        <Text style={[styles.sumLabel, { color: COLOR.income }]}>Ventas efectivo</Text>
                      </View>
                      <Text style={[styles.sumValue, { color: COLOR.income }]}>{formatHnl(summary.totalCashSales ?? 0)}</Text>
                    </View>
                    {(summary.totalShiftExpenses ?? 0) > 0 && (
                      <View style={styles.sumTotalRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.s2 }}>
                          <MaterialCommunityIcons name="cash-minus" size={16} color={COLOR.expense} />
                          <Text style={[styles.sumLabel, { color: COLOR.expense }]}>Egresos del turno</Text>
                        </View>
                        <Text style={[styles.sumValue, { color: COLOR.expense }]}>− {formatHnl(summary.totalShiftExpenses ?? 0)}</Text>
                      </View>
                    )}
                    <View style={[styles.sumTotalRow, { borderTopWidth: 1, borderTopColor: COLOR.border, paddingTop: SPACE.s1, marginTop: SPACE.s1 }]}>
                      <Text style={[styles.sumLabel, { fontWeight: FONT_WEIGHT.bold as any }]}>Total esperado en caja</Text>
                      <Text style={[styles.sumValue, { fontWeight: FONT_WEIGHT.bold as any, color: COLOR.ink }]}>
                        {formatHnl((summary.openingCashAmount ?? 0) + (summary.totalCashSales ?? 0) - (summary.totalShiftExpenses ?? 0))}
                      </Text>
                    </View>
                    {(summary.totalCardSales ?? 0) > 0 && (
                      <View style={styles.sumTotalRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.s2 }}>
                          <MaterialCommunityIcons name="credit-card-outline" size={16} color={COLOR.info} />
                          <Text style={[styles.sumLabel, { color: COLOR.info }]}>Tarjeta</Text>
                        </View>
                        <Text style={[styles.sumValue, { color: COLOR.info }]}>{formatHnl(summary.totalCardSales ?? 0)}</Text>
                      </View>
                    )}
                    {(summary.totalCardSurcharge ?? 0) > 0 && (
                      <View style={styles.sumTotalRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.s2 }}>
                          <MaterialCommunityIcons name="cash-plus" size={16} color={COLOR.info} />
                          <Text style={[styles.sumLabel, { color: COLOR.info }]}>Recargo tarjeta cobrado</Text>
                        </View>
                        <Text style={[styles.sumValue, { color: COLOR.info }]}>+ {formatHnl(summary.totalCardSurcharge ?? 0)}</Text>
                      </View>
                    )}
                  </View>

                  <Text style={{ fontSize: FONT_SIZE.caption, color: COLOR.ink2, marginTop: 4 }}>{summary.totalSales} venta{summary.totalSales !== 1 ? 's' : ''} registrada{summary.totalSales !== 1 ? 's' : ''}</Text>
                  {summary.totalSales === 0 && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.s2, backgroundColor: '#FFF8E1', borderRadius: RADIUS.r2, padding: SPACE.s2, marginTop: SPACE.s2 }}>
                      <MaterialCommunityIcons name="alert-outline" size={16} color="#F59E0B" />
                      <Text style={{ fontSize: FONT_SIZE.caption, color: '#92400E', flex: 1 }}>Cerrás el turno sin ventas registradas.</Text>
                    </View>
                  )}
                </View>

                {/* Input: efectivo real en mano */}
                <View style={styles.cashInputBox}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.s2, marginBottom: SPACE.s2 }}>
                    <MaterialCommunityIcons name="hand-coin-outline" size={18} color={COLOR.income} />
                    <Text style={styles.cashInputLabel}>¿Cuánto efectivo tenés en mano?</Text>
                  </View>
                  <View style={styles.cashInputRow}>
                    <Text style={styles.cashInputPrefix}>L</Text>
                    <RNTextInput
                      style={styles.cashInput}
                      keyboardType="decimal-pad"
                      placeholder="0.00"
                      placeholderTextColor={COLOR.inkDisabled}
                      value={declaredCash}
                      onChangeText={(v) => { setDeclaredCash(v); if (closingModalError) setClosingModalError(''); }}
                    />
                  </View>
                  {/* Error inline — no desplaza los botones */}
                  {!!closingModalError && (
                    <View style={styles.modalErrorBanner}>
                      <MaterialCommunityIcons name="alert-circle-outline" size={18} color={COLOR.expense} />
                      <Text style={styles.modalErrorText}>{closingModalError}</Text>
                    </View>
                  )}
                  {/* Diferencia en tiempo real */}
                  {declaredCash !== '' && summary && (() => {
                    const declared  = parseFloat(declaredCash) || 0;
                    const expected  = (summary.openingCashAmount ?? 0) + (summary.totalCashSales ?? 0) - (summary.totalShiftExpenses ?? 0);
                    const diff      = declared - expected;
                    if (Math.abs(diff) < 0.01) return (
                      <Text style={{ color: COLOR.income, fontSize: FONT_SIZE.caption, marginTop: SPACE.s1 }}>
                        Caja cuadrada
                      </Text>
                    );
                    return (
                      <Text style={{ color: diff > 0 ? COLOR.info : COLOR.expense, fontSize: FONT_SIZE.caption, marginTop: SPACE.s1 }}>
                        {diff > 0 ? `Sobrante: +${formatHnl(diff)}` : `Faltante: ${formatHnl(diff)}`}
                      </Text>
                    );
                  })()}
                </View>
                </ScrollView>

                <Text style={styles.closingWarn}>Esta acción no se puede deshacer</Text>

                <View style={styles.modalActions}>
                  <Button mode="outlined" onPress={() => { setClosingModal(false); setDeclaredCash(''); setClosingModalError(''); }} style={{ flex: 1 }}>Cancelar</Button>
                  <Button
                    mode="contained"
                    buttonColor={COLOR.brand}
                    textColor={COLOR.inkOnBrand}
                    style={{ flex: 1 }}
                    onPress={handleConfirmClosing}
                  >
                    Confirmar cierre
                  </Button>
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* ══ MODAL EDITAR EGRESO ══ */}
      <Modal visible={!!editingExpense} transparent animationType="fade" onRequestClose={() => setEditingExpense(null)}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Editar egreso</Text>

            <RNTextInput
              style={[styles.expenseInput, { marginTop: SPACE.s2 }]}
              placeholder="Descripción"
              placeholderTextColor={COLOR.inkDisabled}
              value={editExpenseDesc}
              onChangeText={setEditExpenseDesc}
            />
            <View style={[styles.cashInputRow, { marginTop: SPACE.s2 }]}>
              <Text style={styles.cashInputPrefix}>L</Text>
              <RNTextInput
                style={styles.cashInput}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={COLOR.inkDisabled}
                value={editExpenseAmount}
                onChangeText={setEditExpenseAmount}
              />
            </View>

            <View style={styles.modalActions}>
              <Button mode="outlined" onPress={() => setEditingExpense(null)} style={{ flex: 1 }}>Cancelar</Button>
              <Button
                mode="contained"
                onPress={handleSaveEditExpense}
                loading={savingEditExpense}
                disabled={savingEditExpense || !editExpenseDesc.trim() || !editExpenseAmount}
                buttonColor={COLOR.brand}
                textColor={COLOR.inkOnBrand}
                style={{ flex: 1 }}
              >
                Guardar
              </Button>
            </View>
          </View>
        </View>
      </Modal>

      <ConfirmDialog
        visible={!!confirmDlg}
        title={confirmDlg?.title ?? ''}
        message={confirmDlg?.message ?? ''}
        confirmLabel={confirmDlg?.confirmLabel ?? 'Confirmar'}
        confirmColor={COLOR.expense}
        onConfirm={() => confirmDlg?.onConfirm()}
        onCancel={() => setConfirmDlg(null)}
      />
      <Snackbar visible={!!snackbar} onDismiss={() => setSnackbar('')} duration={2500}>{snackbar}</Snackbar>

      {/* ══ MODAL MÉTODO DE PAGO ══ */}
      <Modal visible={paymentModal} transparent animationType="fade" onRequestClose={() => setPaymentModal(false)}>
        <View style={styles.payModalOverlay}>
          <View style={styles.payModalBox}>

            <Text style={styles.payModalTitle}>Método de pago</Text>
            <Text style={styles.payModalTotal}>Total: <Text style={{ color: COLOR.income, fontWeight: FONT_WEIGHT.bold as any }}>{formatHnl(cartTotal)}</Text></Text>

            {/* Botones de selección */}
            <View style={styles.payMethodRow}>
              {(['CASH','CARD','MIXED'] as const).map(m => {
                const label = m === 'CASH' ? 'Efectivo' : m === 'CARD' ? 'Tarjeta' : 'Mixto';
                const icon  = m === 'CASH' ? 'cash' : m === 'CARD' ? 'credit-card-outline' : 'swap-horizontal';
                const active = paymentMethod === m;
                return (
                  <TouchableOpacity
                    key={m}
                    style={[styles.payMethodBtn, active && styles.payMethodBtnActive]}
                    onPress={() => setPaymentMethod(m)}
                    activeOpacity={0.8}
                  >
                    <MaterialCommunityIcons name={icon} size={22} color={active ? COLOR.inkOnBrand : COLOR.ink2} />
                    <Text style={[styles.payMethodLabel, active && styles.payMethodLabelActive]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Desglose recargo tarjeta (3%) */}
            {paymentMethod === 'CARD' && (
              <View style={styles.paySurchargeBox}>
                <View style={styles.paySurchargeRow}>
                  <Text style={styles.paySurchargeLabel}>Recargo tarjeta (3%)</Text>
                  <Text style={styles.paySurchargeValue}>+{formatHnl(cartTotal * CARD_SURCHARGE_RATE)}</Text>
                </View>
                <View style={styles.paySurchargeRow}>
                  <Text style={styles.paySurchargeTotalLabel}>Total a cobrar</Text>
                  <Text style={styles.paySurchargeTotalValue}>{formatHnl(cartTotal * (1 + CARD_SURCHARGE_RATE))}</Text>
                </View>
              </View>
            )}

            {/* Campos mixto */}
            {paymentMethod === 'MIXED' && (
              <View style={styles.payMixedRow}>
                <View style={styles.payMixedField}>
                  <Text style={styles.payMixedLabel}>Efectivo (L)</Text>
                  <RNTextInput
                    style={styles.payMixedInput}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor={COLOR.inkDisabled}
                    value={mixedCash}
                    onChangeText={setMixedCash}
                  />
                </View>
                <View style={styles.payMixedField}>
                  <Text style={styles.payMixedLabel}>Tarjeta (L)</Text>
                  <RNTextInput
                    style={styles.payMixedInput}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor={COLOR.inkDisabled}
                    value={mixedCard}
                    onChangeText={setMixedCard}
                  />
                </View>
              </View>
            )}

            {/* Indicador de diferencia en pago mixto */}
            {paymentMethod === 'MIXED' && (() => {
              const cash = parseFloat(mixedCash) || 0;
              const card = parseFloat(mixedCard) || 0;
              const diff = cartTotal - cash - card;
              if (Math.abs(diff) < 0.01) return (
                <Text style={{ color: COLOR.income, fontSize: FONT_SIZE.caption, textAlign: 'center', marginTop: 4 }}>
                  ✓ Monto completo
                </Text>
              );
              return (
                <Text style={{ color: COLOR.expense, fontSize: FONT_SIZE.caption, textAlign: 'center', marginTop: 4 }}>
                  {diff > 0 ? `Falta: L ${diff.toFixed(2)}` : `Excede: L ${Math.abs(diff).toFixed(2)}`}
                </Text>
              );
            })()}

            {/* Desglose recargo tarjeta (3%) sobre la porción tarjeta */}
            {paymentMethod === 'MIXED' && (() => {
              const cash = parseFloat(mixedCash) || 0;
              const card = parseFloat(mixedCard) || 0;
              if (card <= 0) return null;
              const surcharge = card * CARD_SURCHARGE_RATE;
              return (
                <View style={styles.paySurchargeBox}>
                  <View style={styles.paySurchargeRow}>
                    <Text style={styles.paySurchargeLabel}>Recargo tarjeta (3% de L {card.toFixed(2)})</Text>
                    <Text style={styles.paySurchargeValue}>+{formatHnl(surcharge)}</Text>
                  </View>
                  <View style={styles.paySurchargeRow}>
                    <Text style={styles.paySurchargeTotalLabel}>Total a cobrar</Text>
                    <Text style={styles.paySurchargeTotalValue}>{formatHnl(cash + card + surcharge)}</Text>
                  </View>
                </View>
              );
            })()}

            {/* Acciones */}
            <View style={styles.payModalActions}>
              <Button mode="outlined" onPress={() => setPaymentModal(false)} textColor={COLOR.ink2} style={{ flex: 1, borderRadius: RADIUS.r2 }}>
                Cancelar
              </Button>
              <Button
                mode="contained"
                onPress={confirmWithPayment}
                buttonColor={COLOR.brand}
                textColor={COLOR.inkOnBrand}
                style={{ flex: 1, borderRadius: RADIUS.r2 }}
                loading={submitting}
                disabled={submitting}
              >
                Confirmar
              </Button>
            </View>
          </View>
        </View>
      </Modal>
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
  const isEmpty = cart.length === 0;

  /* Mobile + carrito vacío → ticket mínimo para no tapar los productos */
  if (!full && isEmpty) {
    return (
      <View style={tkStyles.rootCompact}>
        <Button mode="contained" disabled buttonColor={COLOR.brand} textColor={COLOR.inkOnBrand}
          style={{ borderRadius: RADIUS.r2, opacity: 0.5 }} labelStyle={{ fontWeight: FONT_WEIGHT.black as any }}>
          Confirmar venta
        </Button>
      </View>
    );
  }

  return (
    <View style={tkStyles.root}>
      <View style={tkStyles.head}>
        <Text style={tkStyles.title}>Venta actual</Text>
        {itemCount > 0 && <View style={tkStyles.badge}><Text style={tkStyles.badgeText}>{itemCount} artículos</Text></View>}
      </View>

      {full && (
        cart.length === 0
          ? <View style={tkStyles.empty}><Text style={tkStyles.emptyText}>La venta actual está vacía.</Text></View>
          : <ScrollView style={{ flex: 1 }}>
              {cart.map(item => (
                <View key={item.productId} style={tkStyles.item}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={tkStyles.itemName} numberOfLines={1}>{item.productName}</Text>
                    <Text style={tkStyles.itemCode}>{item.qty} × {formatHnl(item.price)}</Text>
                  </View>
                  <Text style={tkStyles.itemSub}>{formatHnl(item.subtotal)}</Text>
                  <TouchableOpacity onPress={() => onRemove(item.productId)} style={tkStyles.deleteBtn} accessibilityRole="button" accessibilityLabel="Quitar del carrito">
                    <MaterialCommunityIcons name="trash-can-outline" size={18} color={COLOR.expense} />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
      )}

      {/* Totales */}
      <View style={tkStyles.totals}>
        <View style={tkStyles.totalLine}><Text style={tkStyles.totalLabel}>Subtotal</Text><Text style={tkStyles.totalValue}>{formatHnl(subtotal)}</Text></View>
        <View style={[tkStyles.totalLine, tkStyles.totalFinal]}>
          <Text style={tkStyles.totalLabelFinal}>TOTAL</Text>
          <Text style={tkStyles.totalAmount}>{formatHnl(total)}</Text>
        </View>
      </View>

      {/* Acciones */}
      <View style={tkStyles.actions}>
        <Button mode="contained" onPress={onSubmit} loading={submitting} disabled={isEmpty || submitting}
          buttonColor={COLOR.brand} textColor={COLOR.inkOnBrand} style={{ borderRadius: RADIUS.r2 }} labelStyle={{ fontWeight: FONT_WEIGHT.black as any }}>
          Confirmar venta
        </Button>
        {!isEmpty && (
          <Button mode="outlined" onPress={onClear} style={{ borderRadius: RADIUS.r2, marginTop: 6 }} textColor={COLOR.ink2}>
            Cancelar venta
          </Button>
        )}
      </View>

      {full && !isEmpty && (
        <View style={tkStyles.audit}>
          <Text style={tkStyles.auditText}>El sistema calcula precios, impuestos y totales automáticamente. Al confirmar se descuenta el stock.</Text>
        </View>
      )}
    </View>
  );
}

// ─── Estilos POSScreen ────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:           { flex: 1, backgroundColor: COLOR.bg },

  // Sin turno
  noShift:        { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACE.s8, gap: SPACE.s4 },
  noShiftTitle:   { fontSize: FONT_SIZE.h1, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.ink },
  noShiftSub:     { fontSize: FONT_SIZE.label, color: COLOR.inkMute, textAlign: 'center' },

  // Header
  header:         { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: SPACE.s1, paddingHorizontal: SPACE.s3, paddingVertical: SPACE.s2, backgroundColor: COLOR.brand, borderBottomWidth: 1, borderBottomColor: COLOR.brandDark },
  headerBrand:    { fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.extrabold as any, color: COLOR.ink, letterSpacing: -0.5 },
  headerShift:    { fontSize: 10, fontWeight: FONT_WEIGHT.semibold as any, color: COLOR.ink2, marginTop: 1 },

  // Local chips
  localChips:     { flexDirection: 'row', gap: SPACE.s2 },
  localChip:      { paddingHorizontal: SPACE.s3, paddingVertical: 6, borderRadius: RADIUS.full, backgroundColor: 'rgba(255,255,255,0.5)', borderWidth: 1, borderColor: COLOR.brandDark },
  localChipActive:{ backgroundColor: COLOR.ink, borderColor: COLOR.ink },
  localChipText:  { fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.ink2 },
  localChipTextActive: { color: COLOR.brand, fontWeight: FONT_WEIGHT.bold as any },

  // KPIs bar del turno
  kpiBar:         { flexDirection: 'row', backgroundColor: COLOR.ink, paddingHorizontal: SPACE.s3, paddingVertical: 4 },
  kpiItem:        { flex: 1, alignItems: 'center' },
  kpiLabel:       { fontSize: 9, fontWeight: FONT_WEIGHT.semibold as any, color: COLOR.inkDisabled, marginBottom: 1 },
  kpiValue:       { fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.brand },
  kpiDivider:     { width: 1, backgroundColor: COLOR.ink2, marginVertical: 2 },

  // Tabs POS
  tabBar:         { flexDirection: 'row', backgroundColor: COLOR.surface, borderBottomWidth: 1, borderBottomColor: COLOR.border },
  posTab:         { flex: 1, paddingVertical: 8, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: COLOR.transparent },
  posTabActive:   { borderBottomColor: COLOR.brand },
  posTabText:     { fontSize: FONT_SIZE.label, fontWeight: FONT_WEIGHT.semibold as any, color: COLOR.inkMute },
  posTabTextActive: { color: COLOR.ink, fontWeight: FONT_WEIGHT.bold as any },

  // Tab Ventas del turno
  salesEmpty:     { alignItems: 'center', paddingVertical: 48, gap: SPACE.s2 },
  salesEmptyText: { fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.ink },
  salesEmptySub:  { fontSize: FONT_SIZE.label, color: COLOR.inkMute },
  salesSummary:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLOR.brandTint, borderRadius: RADIUS.r3, padding: SPACE.s4, borderWidth: 1, borderColor: COLOR.brandTint2 },
  salesSummaryText: { fontSize: FONT_SIZE.label, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.ink2 },
  salesSummaryTotal: { fontSize: FONT_SIZE.h2, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.ink },
  saleCard:       { backgroundColor: COLOR.surface, borderRadius: RADIUS.r3, borderWidth: 1, borderColor: COLOR.border, padding: SPACE.s3, gap: SPACE.s2, ...SHADOW.sm },
  saleCardHead:   { flexDirection: 'row', alignItems: 'center', gap: SPACE.s2 },
  saleCardTime:   { fontSize: FONT_SIZE.label, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.ink, flex: 1 },
  saleCardTotal:  { fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.ink },
  cancelBtn:      { backgroundColor: COLOR.expenseTint, borderRadius: RADIUS.r1, paddingHorizontal: SPACE.s2, paddingVertical: 5, borderWidth: 1, borderColor: COLOR.expenseBorder },
  cancelBtnText:  { fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.expense },
  saleCardItems:  { gap: 2, paddingLeft: SPACE.s1 },
  saleCardItem:   { fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.medium as any, color: COLOR.ink2 },
  saleCardFooter: { borderTopWidth: 1, borderTopColor: COLOR.border, paddingTop: SPACE.s1 },
  saleCardFooterText: { fontSize: FONT_SIZE.caption, color: COLOR.inkMute, fontWeight: FONT_WEIGHT.semibold as any },

  // Chips categoría
  chipsBar:       { backgroundColor: COLOR.surface, borderBottomWidth: 1, borderBottomColor: COLOR.border, paddingVertical: 5 },
  catChip:        { paddingHorizontal: SPACE.s3, paddingVertical: 5, borderRadius: RADIUS.r2, backgroundColor: COLOR.surface, borderWidth: 1, borderColor: COLOR.border },
  catChipActive:  { backgroundColor: COLOR.brand, borderColor: COLOR.brandDark },
  catChipText:    { fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.semibold as any, color: COLOR.ink2 },
  catChipTextActive: { color: COLOR.ink, fontWeight: FONT_WEIGHT.bold as any },

  // Buscador
  searchWrap:     { backgroundColor: COLOR.surface, paddingHorizontal: SPACE.s2, paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: COLOR.border, gap: 4 },
  searchBox:      { flexDirection: 'row', alignItems: 'center', backgroundColor: COLOR.bg, borderRadius: RADIUS.r2, paddingHorizontal: SPACE.s3, height: 40 },
  searchInput:    { flex: 1, fontSize: FONT_SIZE.label, color: COLOR.ink, outlineStyle: 'none' } as any,
  catalogMeta:    { fontSize: FONT_SIZE.label, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.ink },
  catalogCount:   { fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.semibold as any, color: COLOR.inkMute },

  // Layout
  main:           { flex: 1 },
  mainDesktop:    { flexDirection: 'row' },

  // Grilla de productos
  grid:           { flexDirection: 'row', flexWrap: 'wrap', padding: SPACE.s2, gap: SPACE.s2 },
  empty:          { width: '100%', textAlign: 'center', color: COLOR.inkMute, marginTop: 40 },

  // Product card
  productCard:         { flex: 1, minWidth: 150, maxWidth: 220, backgroundColor: COLOR.surface, borderRadius: RADIUS.r3, borderWidth: 1, borderColor: COLOR.border, padding: SPACE.s2, gap: SPACE.s2, ...SHADOW.sm },
  productCardSelected: { borderColor: COLOR.brand, borderWidth: 2, backgroundColor: COLOR.brandTint },
  productCardInCart:   { borderColor: COLOR.income, borderWidth: 1.5, backgroundColor: COLOR.incomeTint },
  productCardDisabled: { opacity: 0.45, backgroundColor: COLOR.bgAlt },
  inCartBadge:         { backgroundColor: COLOR.income, borderRadius: RADIUS.r1, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start' },
  inCartBadgeText:     { fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.white },
  outOfStockBadge:     { backgroundColor: COLOR.expense, borderRadius: RADIUS.r1, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start' },
  outOfStockBadgeText: { fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.white },
  pcBottomInactive:    { height: 30, justifyContent: 'center' },
  pcTapHint:           { fontSize: FONT_SIZE.caption, color: COLOR.inkDisabled, fontWeight: FONT_WEIGHT.semibold as any },
  pcTop:          { flexDirection: 'row', gap: SPACE.s2 },
  pcName:         { fontSize: FONT_SIZE.label, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.ink, lineHeight: 16 },
  pcCode:         { fontSize: FONT_SIZE.caption, color: COLOR.inkMute, fontWeight: FONT_WEIGHT.semibold as any, marginTop: 2 },
  pcPrice:        { fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.ink },
  pcStock:        { fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.semibold as any },
  pcBottom:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.s2 },

  // Qty control (en card)
  qtyControl:     { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLOR.border2, borderRadius: RADIUS.r1, overflow: 'hidden', height: 28 },
  qtyBtn:         { width: 26, height: 28, justifyContent: 'center', alignItems: 'center', backgroundColor: COLOR.surface },
  qtyBtnText:     { fontSize: 16, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.ink, lineHeight: 18 },
  qtyNum:         { width: 30, textAlign: 'center', fontSize: FONT_SIZE.label, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.ink },

  // Agregar button
  addBtn:         { flex: 1, height: 30, backgroundColor: COLOR.brand, borderRadius: RADIUS.r2, justifyContent: 'center', alignItems: 'center' },
  addBtnText:     { fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.ink },

  // Ticket
  ticketDesktop:  { width: 340, backgroundColor: COLOR.surface, borderLeftWidth: 1, borderLeftColor: COLOR.border },

  // Barra flotante carrito mobile
  cartFloatingBar:    { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: COLOR.brandDark, flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACE.s4, paddingVertical: SPACE.s3, gap: SPACE.s3 },
  cartBarBadge:       { backgroundColor: COLOR.inkOnBrand, borderRadius: RADIUS.full, minWidth: 24, height: 24, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6 },
  cartBarBadgeText:   { fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.black as any, color: COLOR.brandDark },
  cartBarLabel:       { flex: 1, fontSize: FONT_SIZE.label, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.inkOnBrand },
  cartBarTotal:       { fontSize: FONT_SIZE.h2, fontWeight: FONT_WEIGHT.black as any, color: COLOR.inkOnBrand },

  // Modal carrito mobile
  cartModalOverlay:   { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  cartModalSheet:     { backgroundColor: COLOR.surface, borderTopLeftRadius: RADIUS.r4, borderTopRightRadius: RADIUS.r4, padding: SPACE.s4, gap: SPACE.s3 },
  cartModalHandle:    { width: 40, height: 4, backgroundColor: COLOR.border2, borderRadius: RADIUS.full, alignSelf: 'center', marginBottom: SPACE.s2 },
  cartModalHead:      { flexDirection: 'row', alignItems: 'center', gap: SPACE.s2 },
  cartModalTitle:     { fontSize: FONT_SIZE.h2, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.ink, flex: 1 },
  cartModalItem:      { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACE.s2, borderBottomWidth: 1, borderBottomColor: COLOR.border, gap: SPACE.s2 },
  cartModalItemName:  { fontSize: FONT_SIZE.label, fontWeight: FONT_WEIGHT.semibold as any, color: COLOR.ink },
  cartModalItemSub:   { fontSize: FONT_SIZE.caption, color: COLOR.inkMute },
  cartModalItemTotal: { fontSize: FONT_SIZE.label, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.ink },
  cartModalTotals:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: SPACE.s2, borderTopWidth: 2, borderTopColor: COLOR.ink },
  cartModalTotalLabel:{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.ink },
  cartModalTotalAmount:{ fontSize: FONT_SIZE.h1, fontWeight: FONT_WEIGHT.black as any, color: COLOR.ink },
  modalErrorBanner:   { flexDirection: 'row', alignItems: 'center', gap: SPACE.s2, backgroundColor: '#FEE2E2', borderRadius: RADIUS.r2, padding: SPACE.s3, marginTop: SPACE.s2, borderLeftWidth: 3, borderLeftColor: COLOR.expense },
  modalErrorText:     { flex: 1, fontSize: FONT_SIZE.label, color: '#991B1B', fontWeight: FONT_WEIGHT.semibold as any },

  // Modal método de pago
  payModalOverlay:    { flex: 1, backgroundColor: COLOR.overlay, justifyContent: 'center', alignItems: 'center', padding: SPACE.s4 },
  payModalBox:        { backgroundColor: COLOR.surface, borderRadius: RADIUS.r4, padding: SPACE.s5, width: '100%', maxWidth: 420, ...SHADOW.lg },
  payModalTitle:      { fontSize: FONT_SIZE.h2, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.ink, marginBottom: SPACE.s1 },
  payModalTotal:      { fontSize: FONT_SIZE.body, color: COLOR.ink2, marginBottom: SPACE.s4 },
  payMethodRow:       { flexDirection: 'row', gap: SPACE.s2, marginBottom: SPACE.s4 },
  payMethodBtn:       { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACE.s1, paddingVertical: SPACE.s3, borderRadius: RADIUS.r2, borderWidth: 1.5, borderColor: COLOR.border, backgroundColor: COLOR.bg },
  payMethodBtnActive: { backgroundColor: COLOR.brand, borderColor: COLOR.brandDark },
  payMethodLabel:     { fontSize: FONT_SIZE.label, fontWeight: FONT_WEIGHT.semibold as any, color: COLOR.ink2 },
  payMethodLabelActive: { color: COLOR.inkOnBrand, fontWeight: FONT_WEIGHT.bold as any },
  payMixedRow:        { flexDirection: 'row', gap: SPACE.s3, marginBottom: SPACE.s4 },
  payMixedField:      { flex: 1 },
  payMixedLabel:      { fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.semibold as any, color: COLOR.ink2, marginBottom: SPACE.s1 },
  payMixedInput:      { borderWidth: 1, borderColor: COLOR.border, borderRadius: RADIUS.r2, paddingHorizontal: SPACE.s3, paddingVertical: SPACE.s2, fontSize: FONT_SIZE.body, color: COLOR.ink, backgroundColor: COLOR.surface },
  payModalActions:    { flexDirection: 'row', gap: SPACE.s3, marginTop: SPACE.s2 },
  paySurchargeBox:    { backgroundColor: COLOR.bg, borderRadius: RADIUS.r2, padding: SPACE.s3, marginBottom: SPACE.s4, gap: 4 },
  paySurchargeRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  paySurchargeLabel:  { fontSize: FONT_SIZE.label, color: COLOR.ink2 },
  paySurchargeValue:  { fontSize: FONT_SIZE.label, fontWeight: FONT_WEIGHT.semibold as any, color: COLOR.ink },
  paySurchargeTotalLabel: { fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.ink },
  paySurchargeTotalValue: { fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.income },

  // Modal cierre
  sumRow:         { flexDirection: 'row', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: COLOR.border },
  sumCell:        { fontSize: FONT_SIZE.caption, color: COLOR.ink, fontWeight: FONT_WEIGHT.medium as any },
  sumHeader:      { fontWeight: FONT_WEIGHT.bold as any, color: COLOR.inkMute, fontSize: FONT_SIZE.caption },
  sumDivider:     { height: 1, backgroundColor: COLOR.border, marginVertical: SPACE.s2 },
  sumTotalRow:    { flexDirection: 'row', justifyContent: 'space-between' },
  sumLabel:       { fontSize: FONT_SIZE.label, color: COLOR.inkMute, fontWeight: FONT_WEIGHT.semibold as any },
  sumValue:       { fontSize: FONT_SIZE.label, color: COLOR.inkMute, fontWeight: FONT_WEIGHT.semibold as any },
  closingWarn:    { fontSize: FONT_SIZE.caption, color: COLOR.warn, fontWeight: FONT_WEIGHT.semibold as any, textAlign: 'center', marginVertical: SPACE.s2 },

  // Modales genéricos
  overlay:        { flex: 1, backgroundColor: COLOR.overlay, justifyContent: 'center', alignItems: 'center' },
  modal:          { backgroundColor: COLOR.surface, borderRadius: RADIUS.r4, padding: SPACE.s5, width: '92%', maxWidth: 460 },
  modalTitle:     { fontSize: FONT_SIZE.h1, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.ink, marginBottom: SPACE.s1 },
  modalSub:       { fontSize: FONT_SIZE.label, color: COLOR.ink2, fontWeight: FONT_WEIGHT.medium as any, marginBottom: SPACE.s1 },
  modalActions:   { flexDirection: 'row', gap: SPACE.s2, marginTop: SPACE.s4 },

  // Tab Egresos del turno
  expenseForm:    { backgroundColor: COLOR.surface, borderBottomWidth: 1, borderBottomColor: COLOR.border, padding: SPACE.s3, gap: SPACE.s2 },
  expenseFormTitle: { fontSize: FONT_SIZE.label, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.ink, marginBottom: SPACE.s1 },
  expenseInput:   { borderWidth: 1, borderColor: COLOR.border, borderRadius: RADIUS.r2, paddingHorizontal: SPACE.s3, paddingVertical: SPACE.s2, fontSize: FONT_SIZE.body, color: COLOR.ink, backgroundColor: COLOR.bg },
  expenseCard:    { flexDirection: 'row', alignItems: 'center', backgroundColor: COLOR.surface, borderRadius: RADIUS.r3, borderWidth: 1, borderColor: COLOR.expenseBorder, padding: SPACE.s3, gap: SPACE.s2 },
  expenseCardIcon:{ width: 36, height: 36, borderRadius: 18, backgroundColor: COLOR.expenseTint, alignItems: 'center', justifyContent: 'center' },
  expenseCardDesc:{ fontSize: FONT_SIZE.label, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.ink },
  expenseCardMeta:{ fontSize: FONT_SIZE.caption, color: COLOR.inkMute, marginTop: 2 },
  expenseCardAmount: { fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.expense },
  expenseCardAction: { padding: 4 },

  // Input efectivo real
  cashInputBox:   { backgroundColor: COLOR.bg, borderRadius: RADIUS.r3, padding: SPACE.s3, marginTop: SPACE.s3, borderWidth: 1, borderColor: COLOR.border },
  cashInputLabel: { fontSize: FONT_SIZE.label, fontWeight: FONT_WEIGHT.semibold as any, color: COLOR.ink },
  cashInputRow:   { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: COLOR.income, borderRadius: RADIUS.r2, overflow: 'hidden' },
  cashInputPrefix:{ paddingHorizontal: SPACE.s3, paddingVertical: SPACE.s2, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.income, backgroundColor: COLOR.incomeTint },
  cashInput:      { flex: 1, paddingHorizontal: SPACE.s3, paddingVertical: SPACE.s2, fontSize: FONT_SIZE.body, color: COLOR.ink, outlineStyle: 'none' } as any,

  // Resultado reconciliación (pantalla post-cierre)
  recRow:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 },
  recLabel:       { fontSize: FONT_SIZE.label, color: COLOR.inkMute, fontWeight: FONT_WEIGHT.medium as any },
  recValue:       { fontSize: FONT_SIZE.label, color: COLOR.ink, fontWeight: FONT_WEIGHT.bold as any },
  recDiffBox:     { flexDirection: 'row', alignItems: 'center', gap: SPACE.s2, borderWidth: 1.5, borderRadius: RADIUS.r3, padding: SPACE.s3, marginTop: SPACE.s2 },
  recDiffLabel:   { flex: 1, fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold as any },
  recDiffAmount:  { fontSize: FONT_SIZE.h3, fontWeight: FONT_WEIGHT.black as any },
});

// ─── Estilos Ticket ───────────────────────────────────────────────────────────

const tkStyles = StyleSheet.create({
  root:           { flex: 1, padding: SPACE.s3, flexDirection: 'column' },
  rootCompact:    { padding: SPACE.s3, borderTopWidth: 1, borderTopColor: COLOR.border, backgroundColor: COLOR.surface },
  head:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACE.s2 },
  title:          { fontSize: FONT_SIZE.h3, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.ink },
  badge:          { backgroundColor: COLOR.brandTint, borderRadius: RADIUS.r2, paddingHorizontal: SPACE.s2, paddingVertical: SPACE.s1 },
  badgeText:      { fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.brandDeep },
  empty:          { padding: SPACE.s4, borderRadius: RADIUS.r3, backgroundColor: COLOR.bg, alignItems: 'center' },
  emptyText:      { color: COLOR.inkMute, fontWeight: FONT_WEIGHT.medium as any, fontSize: FONT_SIZE.label },

  item:           { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: COLOR.border, gap: SPACE.s2, minHeight: 46 },
  itemName:       { fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.ink },
  itemCode:       { fontSize: FONT_SIZE.caption, color: COLOR.inkMute, fontWeight: FONT_WEIGHT.medium as any },
  itemSub:        { fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.ink, width: 70, textAlign: 'right' },
  deleteBtn:      { marginLeft: SPACE.s2, padding: SPACE.s1 },

  totals:         { paddingTop: SPACE.s2, gap: SPACE.s1, borderTopWidth: 1, borderTopColor: COLOR.border, marginTop: SPACE.s2 },
  totalLine:      { flexDirection: 'row', justifyContent: 'space-between' },
  totalFinal:     { borderTopWidth: 1, borderTopColor: COLOR.border, paddingTop: SPACE.s2, marginTop: SPACE.s1 },
  totalLabel:     { fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.medium as any, color: COLOR.inkMute },
  totalValue:     { fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.medium as any, color: COLOR.inkMute },
  totalLabelFinal:{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.ink },
  totalAmount:    { fontSize: FONT_SIZE.amountHero - 10, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.ink, letterSpacing: -1 },

  actions:        { marginTop: SPACE.s2 },
  audit:          { marginTop: SPACE.s2, backgroundColor: COLOR.brandTint, borderWidth: 1, borderColor: COLOR.brandTint2, borderRadius: RADIUS.r3, padding: SPACE.s2 },
  auditText:      { fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.medium as any, color: COLOR.ink2 },
});
