import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput as RNTextInput, ActivityIndicator, Modal,
  useWindowDimensions,
} from 'react-native';
import { Button, TextInput, Snackbar, IconButton } from 'react-native-paper';
import axios from 'axios';
import { REACT_APP_API_URL } from '../config';
import { useStore } from '../context/StoreContext';
import ConfirmDialog from '../components/ConfirmDialog';
import { useAuth } from '../context/AuthContext';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Store       { id: number; name: string; active: boolean }
interface Category    { id: number; name: string; active: boolean; parentId: number | null; children: Category[]; productCount: number }
interface StockItem   { stockId: number; productId: number; productName: string; productSku: string; productType: string; productActive: boolean; price: number; quantity: number; minStock: number; lowStock: boolean; categoryName: string; categoryPath: string; categoryId: number | null; storeId: number; updatedAt: string }
interface Movement    { id: number; type: string; quantity: number; reason: string | null; notes: string | null; username: string | null; productId: number; productName: string; storeId: number; createdAt: string }
interface Summary     { totalProducts: number; activeProducts: number; lowStockCount: number; categoryCount: number; estimatedValue: number }
interface ProductForm { name: string; sku: string; type: string; price: string; minStock: string; description: string; categoryId: string }

const EMPTY_PRODUCT: ProductForm = { name: '', sku: '', type: 'SIMPLE', price: '', minStock: '0', description: '', categoryId: '' };
const money = (v: number) => `L ${Number(v).toLocaleString('es-HN', { minimumFractionDigits: 2 })}`;

// Aplana el árbol de categorías en lista plana con path completo
const flattenCategories = (cats: Category[], prefix = ''): { id: number; label: string; depth: number }[] => {
  const result: { id: number; label: string; depth: number }[] = [];
  for (const cat of cats) {
    const label = prefix ? `${prefix} > ${cat.name}` : cat.name;
    result.push({ id: cat.id, label, depth: prefix.split('>').length - 1 });
    if (cat.children?.length) result.push(...flattenCategories(cat.children, label));
  }
  return result;
};

// ─── Árbol de categorías ─────────────────────────────────────────────────────

const CategoryTree = ({ categories, selected, onSelect, onNew, onEdit, onDelete, onNewChild, onToggle, isAdmin = true }: {
  categories: Category[];
  selected: number | null;
  onSelect: (id: number | null) => void;
  onNew: () => void;
  onEdit: (cat: Category) => void;
  onDelete: (cat: Category) => void;
  onNewChild: (parentId: number) => void;
  onToggle: (cat: Category) => void;
  isAdmin?: boolean;
}) => {
  const [open, setOpen] = useState<Set<number>>(new Set());
  const toggle = (id: number) => setOpen(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const renderNode = (cat: Category, depth = 0) => (
    <View key={cat.id}>
      <View style={[styles.catRow, selected === cat.id && styles.catRowSelected, { paddingLeft: 8 + depth * 14 }]}>
        {cat.children.length > 0 ? (
          <TouchableOpacity onPress={() => toggle(cat.id)} style={{ padding: 2 }}>
            <Text style={styles.catArrow}>{open.has(cat.id) ? '▾' : '▸'}</Text>
          </TouchableOpacity>
        ) : <View style={{ width: 18 }} />}

        <TouchableOpacity style={{ flex: 1 }} onPress={() => onSelect(selected === cat.id ? null : cat.id)}>
          <Text style={[styles.catName, !cat.active && { opacity: 0.4 }]} numberOfLines={1}>{cat.name}</Text>
        </TouchableOpacity>

        <View style={styles.catBadge}><Text style={styles.catBadgeText}>{cat.productCount}</Text></View>

        {/* Acciones — solo admin */}
        {isAdmin && <IconButton icon="plus"       size={16} iconColor="#168542" onPress={() => onNewChild(cat.id)} style={{ margin: 0 }} />}
        {isAdmin && <IconButton icon="pencil"     size={16} iconColor="#53606d" onPress={() => onEdit(cat)}        style={{ margin: 0 }} />}
        {isAdmin && <IconButton icon={cat.active ? 'toggle-switch' : 'toggle-switch-off'} size={16} iconColor={cat.active ? '#168542' : '#b8c0cc'} onPress={() => onToggle(cat)} style={{ margin: 0 }} />}
        {isAdmin && <IconButton icon="trash-can"  size={16} iconColor="#d32121" onPress={() => onDelete(cat)}      style={{ margin: 0 }} />}
      </View>
      {open.has(cat.id) && cat.children.map(c => renderNode(c, depth + 1))}
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      {/* Botón nueva categoría raíz — solo admin */}
      {isAdmin && (
        <TouchableOpacity style={styles.newCatBtn} onPress={onNew}>
          <Text style={styles.newCatBtnText}>+ Nueva categoría</Text>
        </TouchableOpacity>
      )}

      <ScrollView>
        <TouchableOpacity style={[styles.catRow, selected === null && styles.catRowSelected]} onPress={() => onSelect(null)}>
          <View style={{ width: 18 }} />
          <Text style={[styles.catName, { fontWeight: '900' }]}>Todas</Text>
        </TouchableOpacity>
        {categories.map(c => renderNode(c))}
      </ScrollView>
    </View>
  );
};

// ─── KPI Card ────────────────────────────────────────────────────────────────

const KpiCard = ({ icon, title, value, sub, warn }: { icon: string; title: string; value: string; sub?: string; warn?: boolean }) => (
  <View style={[styles.kpi, warn && styles.kpiWarn]}>
    <Text style={styles.kpiIcon}>{icon}</Text>
    <View>
      <Text style={styles.kpiTitle}>{title}</Text>
      <Text style={[styles.kpiValue, warn && { color: '#c05f00' }]}>{value}</Text>
      {sub ? <Text style={styles.kpiSub}>{sub}</Text> : null}
    </View>
  </View>
);

// ─── Screen principal ─────────────────────────────────────────────────────────

const InventoryScreen = () => {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;

  const { roles } = useAuth();
  const isAdmin = roles.includes('admin');

  const { stores, selectedStore, setSelectedStore } = useStore();
  const storeId = selectedStore?.id ?? null;
  const [categories, setCategories]       = useState<Category[]>([]);
  const [stock, setStock]                 = useState<StockItem[]>([]);
  const [summary, setSummary]             = useState<Summary | null>(null);
  const [loading, setLoading]             = useState(false);
  const [search, setSearch]               = useState('');
  const [selectedCat, setSelectedCat]     = useState<number | null>(null);
  const [showCatPanel, setShowCatPanel]   = useState(true);
  const [topExpanded, setTopExpanded]     = useState(true);
  const [snackbar, setSnackbar]           = useState('');
  const [activeView, setActiveView]       = useState<'stock' | 'movements'>('stock');
  const [movements, setMovements]         = useState<Movement[]>([]);
  const [loadingMov, setLoadingMov]       = useState(false);

  // ConfirmDialog
  const [confirmDlg, setConfirmDlg] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);
  const askConfirm = (title: string, message: string, onConfirm: () => void) =>
    setConfirmDlg({ title, message, onConfirm });

  // Modales
  const [adjustItem, setAdjustItem]       = useState<StockItem | null>(null);
  const [adjustType, setAdjustType]       = useState<'ENTRADA' | 'SALIDA'>('ENTRADA');
  const [adjustQty, setAdjustQty]         = useState('');
  const [adjustReason, setAdjustReason]   = useState('');
  const [adjustSaving, setAdjustSaving]   = useState(false);

  const [productModal, setProductModal]     = useState(false);
  const [editProduct, setEditProduct]       = useState<StockItem | null>(null);
  const [productForm, setProductForm]       = useState<ProductForm>(EMPTY_PRODUCT);
  const [productSaving, setProductSaving]   = useState(false);
  const [catPickerOpen, setCatPickerOpen]   = useState(false);
  const [catPickerLabel, setCatPickerLabel] = useState('');

  // Categorías modal
  const [catModal, setCatModal]           = useState(false);
  const [editCat, setEditCat]             = useState<Category | null>(null);
  const [catParentId, setCatParentId]     = useState<number | null>(null);
  const [catName, setCatName]             = useState('');
  const [catDesc, setCatDesc]             = useState('');
  const [catSaving, setCatSaving]         = useState(false);

  const API = REACT_APP_API_URL;

  // ── Carga datos ──────────────────────────────────────────────────────────────

  // El local viene del StoreContext global (selector en el Sidebar)

  const loadAll = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const [stockRes, summaryRes, catRes] = await Promise.all([
        axios.get<StockItem[]>(`${API}/api/v2/stores/${storeId}/stock`),
        axios.get<Summary>(`${API}/api/v2/stores/${storeId}/stock/summary`),
        axios.get<Category[]>(`${API}/api/v2/stores/${storeId}/categories`),
      ]);
      setStock(stockRes.data);
      setSummary(summaryRes.data);
      setCategories(catRes.data);
    } catch { setSnackbar('Error al cargar inventario'); }
    finally { setLoading(false); }
  }, [storeId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const loadMovements = useCallback(async () => {
    if (!storeId) return;
    setLoadingMov(true);
    try {
      const res = await axios.get<Movement[]>(`${API}/api/v2/stores/${storeId}/stock/movements`);
      setMovements(res.data);
    } catch { setSnackbar('Error al cargar movimientos'); }
    finally { setLoadingMov(false); }
  }, [storeId]);

  const handleViewChange = (view: 'stock' | 'movements') => {
    setActiveView(view);
    if (view === 'movements') loadMovements();
  };

  // ── Filtrado ─────────────────────────────────────────────────────────────────

  // Recoge todos los nombres de una categoría y sus descendientes
  const allCatNames = (cat: Category): string[] =>
    [cat.name, ...cat.children.flatMap(allCatNames)];

  const filtered = stock.filter(item => {
    // Filtro por búsqueda
    if (search) {
      const q = search.toLowerCase();
      if (!item.productName.toLowerCase().includes(q) &&
          !(item.productSku || '').toLowerCase().includes(q)) return false;
    }

    // Filtro por categoría seleccionada
    if (selectedCat !== null) {
      const cat = findCat(categories, selectedCat);
      if (!cat) return false;

      // Si el producto no tiene categoría → no mostrar cuando hay filtro activo
      if (!item.categoryPath) return false;

      // El path del producto debe contener la categoría seleccionada o alguna de sus hijas
      const validNames = allCatNames(cat);
      const pathParts  = item.categoryPath.split(' > ');
      const matches    = pathParts.some(part => validNames.includes(part));
      if (!matches) return false;
    }

    return true;
  });

  function findCat(cats: Category[], id: number): Category | null {
    for (const c of cats) { if (c.id === id) return c; const f = findCat(c.children, id); if (f) return f; }
    return null;
  }

  // ── Ajuste de stock ──────────────────────────────────────────────────────────

  const handleAdjust = async () => {
    if (!adjustItem || !adjustQty || Number(adjustQty) <= 0) { setSnackbar('Ingresá una cantidad válida'); return; }
    setAdjustSaving(true);
    try {
      await axios.post(`${API}/api/v2/stores/${storeId}/stock/adjustment`, {
        productId: adjustItem.productId, type: adjustType,
        quantity: Number(adjustQty), reason: adjustReason, username: 'admin',
      });
      setSnackbar(`Stock ${adjustType === 'ENTRADA' ? 'agregado' : 'descontado'} correctamente`);
      setAdjustItem(null); setAdjustQty(''); setAdjustReason('');
      loadAll();
    } catch (e: any) {
      setSnackbar(e.response?.data?.error || 'Error al ajustar stock');
    } finally { setAdjustSaving(false); }
  };

  // ── CRUD Producto ─────────────────────────────────────────────────────────────

  const openCreateProduct = () => {
    setEditProduct(null);
    setProductForm(EMPTY_PRODUCT);
    setCatPickerLabel('');
    setProductModal(true);
  };

  const openEditProduct = (item: StockItem) => {
    setEditProduct(item);
    setProductForm({ name: item.productName, sku: item.productSku || '', type: item.productType, price: String(item.price), minStock: String(item.minStock), description: '', categoryId: item.categoryId ? String(item.categoryId) : '' });
    setCatPickerLabel(item.categoryPath || '');
    setProductModal(true);
  };

  const handleSaveProduct = async () => {
    if (!productForm.name || !productForm.price) { setSnackbar('Nombre y precio son obligatorios'); return; }
    setProductSaving(true);
    try {
      const body = { name: productForm.name, sku: productForm.sku, type: productForm.type, price: Number(productForm.price), minStock: Number(productForm.minStock), description: productForm.description, categoryId: productForm.categoryId ? Number(productForm.categoryId) : null };
      if (editProduct) {
        await axios.put(`${API}/api/v2/products/${editProduct.productId}`, body);
        setSnackbar('Producto actualizado');
      } else {
        await axios.post(`${API}/api/v2/stores/${storeId}/products`, body);
        setSnackbar('Producto creado');
      }
      setProductModal(false); loadAll();
    } catch (e: any) { setSnackbar(e.response?.data?.error || 'Error al guardar'); }
    finally { setProductSaving(false); }
  };

  const handleToggleProduct = (item: StockItem) => {
    askConfirm(
      item.productActive ? 'Desactivar producto' : 'Activar producto',
      `¿${item.productActive ? 'Desactivar' : 'Activar'} "${item.productName}"?`,
      async () => {
        try { await axios.put(`${API}/api/v2/products/${item.productId}/toggle`); loadAll(); }
        catch { setSnackbar('Error al cambiar estado'); }
        finally { setConfirmDlg(null); }
      }
    );
  };

  const handleDeleteProduct = (item: StockItem) => {
    askConfirm(
      'Eliminar producto',
      `¿Eliminar "${item.productName}"? Esta acción no se puede deshacer.`,
      async () => {
        try { await axios.delete(`${API}/api/v2/products/${item.productId}`); setSnackbar('Producto eliminado'); loadAll(); }
        catch { setSnackbar('No se puede eliminar — el producto tiene historial'); }
        finally { setConfirmDlg(null); }
      }
    );
  };

  // ── CRUD Categorías ──────────────────────────────────────────────────────────

  const openNewCat = (parentId: number | null = null) => {
    setEditCat(null); setCatParentId(parentId); setCatName(''); setCatDesc(''); setCatModal(true);
  };

  const openEditCat = (cat: Category) => {
    setEditCat(cat); setCatParentId(cat.parentId); setCatName(cat.name); setCatDesc(''); setCatModal(true);
  };

  const handleSaveCat = async () => {
    if (!catName.trim()) { setSnackbar('El nombre es obligatorio'); return; }
    setCatSaving(true);
    try {
      if (editCat) {
        await axios.put(`${API}/api/v2/categories/${editCat.id}`, { name: catName, description: catDesc });
        setSnackbar('Categoría actualizada');
      } else if (catParentId) {
        await axios.post(`${API}/api/v2/stores/${storeId}/categories/${catParentId}/children`, { name: catName, description: catDesc });
        setSnackbar('Subcategoría creada');
      } else {
        await axios.post(`${API}/api/v2/stores/${storeId}/categories`, { name: catName, description: catDesc });
        setSnackbar('Categoría creada');
      }
      setCatModal(false); loadAll();
    } catch { setSnackbar('Error al guardar categoría'); }
    finally { setCatSaving(false); }
  };

  const handleDeleteCat = (cat: Category) => {
    askConfirm(
      'Eliminar categoría',
      `¿Eliminar "${cat.name}"? Se eliminará junto con sus subcategorías.`,
      async () => {
        try { await axios.delete(`${API}/api/v2/categories/${cat.id}`); setSnackbar('Categoría eliminada'); loadAll(); }
        catch { setSnackbar('No se puede eliminar — tiene subcategorías o productos activos'); }
        finally { setConfirmDlg(null); }
      }
    );
  };

  const handleToggleCat = async (cat: Category) => {
    try { await axios.put(`${API}/api/v2/categories/${cat.id}/toggle`); loadAll(); }
    catch { setSnackbar('Error al cambiar estado de categoría'); }
  };

  // ── Movimientos ──────────────────────────────────────────────────────────────

  const movTypeColor = (type: string) => {
    switch (type) {
      case 'ENTRADA': return '#168542';
      case 'SALIDA':  return '#d32121';
      case 'AJUSTE':  return '#2196F3';
      case 'VENTA':   return '#7c3aed';
      default:        return '#53606d';
    }
  };

  const movTypeLabel = (type: string) => {
    switch (type) {
      case 'ENTRADA': return '↑ Entrada';
      case 'SALIDA':  return '↓ Salida';
      case 'AJUSTE':  return '⟳ Ajuste';
      case 'VENTA':   return '$ Venta';
      default:        return type;
    }
  };

  const renderMovementRow = (m: Movement) => (
    <View key={m.id} style={styles.movRow}>
      <View style={[styles.movTypeBadge, { backgroundColor: movTypeColor(m.type) + '18' }]}>
        <Text style={[styles.movTypeText, { color: movTypeColor(m.type) }]}>{movTypeLabel(m.type)}</Text>
      </View>
      <View style={styles.movInfo}>
        <Text style={styles.movProduct} numberOfLines={1}>{m.productName}</Text>
        {m.reason ? <Text style={styles.movReason} numberOfLines={1}>{m.reason}</Text> : null}
      </View>
      <Text style={[styles.movQty, { color: (m.type === 'ENTRADA' || m.type === 'AJUSTE') ? '#168542' : '#d32121' }]}>
        {m.type === 'ENTRADA' ? '+' : '-'}{m.quantity}
      </Text>
      <Text style={styles.movDate}>
        {new Date(m.createdAt).toLocaleDateString('es-HN', { day: '2-digit', month: '2-digit' })}{'\n'}
        {new Date(m.createdAt).toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit' })}
      </Text>
    </View>
  );

  // ── Stock color ──────────────────────────────────────────────────────────────

  const stockColor = (item: StockItem) => {
    if (item.quantity === 0) return '#d32121';
    if (item.lowStock)       return '#c05f00';
    return '#168542';
  };

  // ── Render fila de producto ──────────────────────────────────────────────────

  const renderRow = (item: StockItem) => (
    <View key={item.stockId} style={[styles.row, !item.productActive && styles.rowInactive]}>

      {/* Info del producto */}
      <View style={styles.rowInfo}>
        <Text style={styles.rowName} numberOfLines={1}>{item.productName}</Text>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 2 }}>
          {item.productSku ? <Text style={styles.rowSku}>{item.productSku}</Text> : null}
          {item.categoryPath ? <Text style={styles.rowCat} numberOfLines={1}>· {item.categoryPath}</Text> : null}
        </View>
      </View>

      {/* Precio */}
      <Text style={styles.rowPrice}>{money(item.price)}</Text>

      {/* Stock badge */}
      <View style={[styles.stockBadge, { backgroundColor: stockColor(item) + '18' }]}>
        <Text style={[styles.stockNum, { color: stockColor(item) }]}>{item.quantity}</Text>
        <Text style={[styles.stockMin, { color: stockColor(item) }]}>/ {item.minStock}</Text>
      </View>

      {/* Acciones */}
      <View style={styles.rowActions}>
        {/* Botón agregar/ajustar stock — siempre visible */}
        <TouchableOpacity
          style={styles.adjustBtn}
          onPress={() => { setAdjustType('ENTRADA'); setAdjustItem(item); }}
        >
          <Text style={styles.adjustBtnText}>{isAdmin ? '📦 Ajustar' : '📦 Agregar'}</Text>
        </TouchableOpacity>

        {/* Acciones de admin: editar, toggle, eliminar */}
        {isAdmin && <IconButton icon="pencil" size={18} iconColor="#53606d" onPress={() => openEditProduct(item)} style={styles.actionIcon} />}
        {isAdmin && (
          <IconButton
            icon={item.productActive ? 'toggle-switch' : 'toggle-switch-off'}
            size={18}
            iconColor={item.productActive ? '#168542' : '#b8c0cc'}
            onPress={() => handleToggleProduct(item)}
            style={styles.actionIcon}
          />
        )}
        {isAdmin && <IconButton icon="trash-can" size={18} iconColor="#d32121" onPress={() => handleDeleteProduct(item)} style={styles.actionIcon} />}
      </View>
    </View>
  );

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Inventario</Text>
          {/* Selector de local — solo admin (usuario ya tiene su local asignado) */}
          {isAdmin ? (
            <View style={styles.storeSelector}>
              {stores.map(s => (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.storeChip, selectedStore?.id === s.id && styles.storeChipActive]}
                  onPress={() => setSelectedStore(s)}
                >
                  <Text style={[styles.storeChipText, selectedStore?.id === s.id && styles.storeChipTextActive]}>
                    {s.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#53606d' }}>
              📍 {selectedStore?.name}
            </Text>
          )}
        </View>
        <View style={styles.headerRight}>
          {/* Tabs Stock / Historial */}
          <View style={styles.viewTabs}>
            <TouchableOpacity
              style={[styles.viewTab, activeView === 'stock' && styles.viewTabActive]}
              onPress={() => handleViewChange('stock')}
            >
              <Text style={[styles.viewTabText, activeView === 'stock' && styles.viewTabTextActive]}>📦 Stock</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.viewTab, activeView === 'movements' && styles.viewTabActive]}
              onPress={() => handleViewChange('movements')}
            >
              <Text style={[styles.viewTabText, activeView === 'movements' && styles.viewTabTextActive]}>📋 Historial</Text>
            </TouchableOpacity>
          </View>

          {activeView === 'stock' && (
            <>
              <Button mode="outlined" onPress={() => setTopExpanded(v => !v)}
                textColor="#53606d" style={{ borderColor: '#e8ecf2', borderRadius: 10 }}
                labelStyle={{ fontSize: 12 }}>
                {topExpanded ? 'Cerrar ▲' : 'Resumen ▼'}
              </Button>
              {isAdmin && (
                <Button mode="contained" onPress={openCreateProduct} buttonColor="#ffd43b" textColor="#161616" style={{ borderRadius: 10 }}>
                  + Nuevo Producto
                </Button>
              )}
            </>
          )}
        </View>
      </View>

      {/* ── Sección colapsable: alerta + KPIs (solo en vista stock) ── */}
      {activeView === 'stock' && topExpanded && (
        <>
          {summary && summary.lowStockCount > 0 && (
            <View style={styles.alertBanner}>
              <Text style={styles.alertText}>⚠ {summary.lowStockCount} producto{summary.lowStockCount > 1 ? 's' : ''} con stock bajo — revisá el inventario</Text>
            </View>
          )}
          {summary && (
            <View style={styles.kpis}>
              <KpiCard icon="📦" title="Productos activos" value={String(summary.activeProducts)} sub={`de ${summary.totalProducts} totales`} />
              <KpiCard icon="⚠" title="Stock bajo" value={String(summary.lowStockCount)} warn={summary.lowStockCount > 0} />
              <KpiCard icon="🗂" title="Categorías" value={String(summary.categoryCount)} />
              <KpiCard icon="💰" title="Valor estimado" value={money(summary.estimatedValue)} />
            </View>
          )}
        </>
      )}

      {/* ── Buscador (solo en vista stock) ── */}
      {activeView === 'stock' && (
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Text style={{ color: '#6b7581', marginRight: 6 }}>⌕</Text>
            <RNTextInput
              placeholder="Buscar producto por nombre o SKU..."
              placeholderTextColor="#b8c0cc"
              value={search}
              onChangeText={setSearch}
              style={styles.searchInput}
            />
          </View>
          {!isDesktop && (
            <IconButton icon="filter-variant" size={22} iconColor="#2f3944" onPress={() => setShowCatPanel(v => !v)} />
          )}
        </View>
      )}

      {/* ── Layout principal ── */}
      {activeView === 'stock' ? (
        <View style={[styles.main, isDesktop && styles.mainDesktop]}>

          {/* Sidebar categorías */}
          {(isDesktop || showCatPanel) && (
            <View style={[styles.catPanel, !isDesktop && styles.catPanelMobile]}>
              <Text style={styles.catPanelTitle}>Categorías</Text>
              {loading ? <ActivityIndicator color="#ffd43b" /> : (
                <CategoryTree
                  categories={categories}
                  selected={selectedCat}
                  onSelect={setSelectedCat}
                  onNew={() => openNewCat(null)}
                  onEdit={openEditCat}
                  onDelete={handleDeleteCat}
                  onNewChild={(parentId) => openNewCat(parentId)}
                  onToggle={handleToggleCat}
                  isAdmin={isAdmin}
                />
              )}
            </View>
          )}

          {/* Lista de productos */}
          <View style={{ flex: 1 }}>
            {loading ? (
              <ActivityIndicator size="large" color="#ffd43b" style={{ marginTop: 40 }} />
            ) : filtered.length === 0 ? (
              <Text style={styles.empty}>No hay productos para mostrar.</Text>
            ) : (
              <ScrollView>
                {/* Header tabla (solo desktop) */}
                {isDesktop && (
                  <View style={[styles.row, styles.rowHeader]}>
                    <View style={styles.rowInfo}>
                      <Text style={styles.colHeader}>Producto</Text>
                    </View>
                    <View style={{ width: 80, alignItems: 'flex-end' }}>
                      <Text style={styles.colHeader}>Precio</Text>
                    </View>
                    <View style={{ width: 90, alignItems: 'center' }}>
                      <Text style={styles.colHeader}>Stock / Mín</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', minWidth: 180 }}>
                      <Text style={styles.colHeader}>Acciones</Text>
                    </View>
                  </View>
                )}
                {filtered.map(renderRow)}
              </ScrollView>
            )}
          </View>
        </View>
      ) : (
        /* ── Vista Historial de Movimientos ── */
        <View style={{ flex: 1 }}>
          {loadingMov ? (
            <ActivityIndicator size="large" color="#ffd43b" style={{ marginTop: 40 }} />
          ) : movements.length === 0 ? (
            <Text style={styles.empty}>No hay movimientos registrados aún.</Text>
          ) : (
            <ScrollView>
              {/* Header tabla (solo desktop) */}
              {isDesktop && (
                <View style={[styles.movRow, styles.rowHeader]}>
                  <View style={{ width: 90 }}><Text style={styles.colHeader}>Tipo</Text></View>
                  <View style={{ flex: 1 }}><Text style={styles.colHeader}>Producto</Text></View>
                  <View style={{ width: 60, alignItems: 'flex-end' }}><Text style={styles.colHeader}>Cant.</Text></View>
                  <View style={{ width: 72, alignItems: 'center' }}><Text style={styles.colHeader}>Fecha</Text></View>
                </View>
              )}
              {movements.map(renderMovementRow)}
            </ScrollView>
          )}
        </View>
      )}

      {/* ── Modal ajuste de stock ── */}
      <Modal visible={!!adjustItem} transparent animationType="fade" onRequestClose={() => setAdjustItem(null)}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>
              {adjustType === 'ENTRADA' ? '➕ Agregar stock' : '➖ Descontar stock'}
            </Text>
            <Text style={styles.modalSub}>{adjustItem?.productName}</Text>
            <Text style={styles.modalStock}>Stock actual: <Text style={{ fontWeight: '900' }}>{adjustItem?.quantity}</Text></Text>

            {/* Selector de tipo — solo admin ve SALIDA */}
            <View style={styles.typeRow}>
              {(isAdmin ? (['ENTRADA', 'SALIDA'] as const) : (['ENTRADA'] as const)).map(t => (
                <Button key={t} mode="contained" onPress={() => setAdjustType(t)}
                  buttonColor={adjustType === t ? (t === 'ENTRADA' ? '#168542' : '#d32121') : '#f4f6f8'}
                  textColor={adjustType === t ? '#fff' : '#6b7581'} style={{ flex: 1, borderRadius: 8 }}>
                  {t === 'ENTRADA' ? 'Entrada' : 'Salida'}
                </Button>
              ))}
            </View>

            <TextInput label="Cantidad *" value={adjustQty} onChangeText={setAdjustQty} keyboardType="numeric" mode="outlined" style={styles.input} />
            <TextInput label="Motivo" value={adjustReason} onChangeText={setAdjustReason} mode="outlined" style={styles.input} />

            <View style={styles.modalActions}>
              <Button mode="outlined" onPress={() => setAdjustItem(null)} style={{ flex: 1 }}>Cancelar</Button>
              <Button mode="contained" onPress={handleAdjust} loading={adjustSaving}
                buttonColor={adjustType === 'ENTRADA' ? '#168542' : '#d32121'} style={{ flex: 1 }}>
                Confirmar
              </Button>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Modal producto ── */}
      <Modal visible={productModal} transparent animationType="fade" onRequestClose={() => setProductModal(false)}>
        <View style={styles.overlay}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 16 }}>
            <View style={[styles.modal, { width: '100%', maxWidth: 480 }]}>
              <Text style={styles.modalTitle}>{editProduct ? 'Editar Producto' : 'Nuevo Producto'}</Text>

              <TextInput label="Nombre *" value={productForm.name} onChangeText={v => setProductForm({ ...productForm, name: v })} mode="outlined" style={styles.input} />
              <TextInput label="SKU (código)" value={productForm.sku} onChangeText={v => setProductForm({ ...productForm, sku: v })} mode="outlined" style={styles.input} />
              <TextInput label="Precio *" value={productForm.price} onChangeText={v => setProductForm({ ...productForm, price: v })} keyboardType="numeric" mode="outlined" style={styles.input} />
              <TextInput label="Stock mínimo (alerta)" value={productForm.minStock} onChangeText={v => setProductForm({ ...productForm, minStock: v })} keyboardType="numeric" mode="outlined" style={styles.input} />

              {/* Tipo */}
              <Text style={styles.fieldLabel}>Tipo</Text>
              <View style={styles.typeRow}>
                {['SIMPLE', 'FABRICATED'].map(t => (
                  <Button key={t} mode="contained" onPress={() => setProductForm({ ...productForm, type: t })}
                    buttonColor={productForm.type === t ? '#ffd43b' : '#f4f6f8'}
                    textColor={productForm.type === t ? '#161616' : '#6b7581'} style={{ flex: 1, borderRadius: 8 }}>
                    {t === 'SIMPLE' ? 'Simple' : 'Fabricado'}
                  </Button>
                ))}
              </View>

              {/* Selector de categoría */}
              <Text style={styles.fieldLabel}>Categoría</Text>
              <TouchableOpacity
                style={styles.catPickerBtn}
                onPress={() => setCatPickerOpen(true)}
              >
                <Text style={catPickerLabel ? styles.catPickerValue : styles.catPickerPlaceholder} numberOfLines={1}>
                  {catPickerLabel || 'Seleccionar categoría...'}
                </Text>
                <Text style={{ color: '#6b7581' }}>▾</Text>
              </TouchableOpacity>

              <TextInput label="Descripción" value={productForm.description} onChangeText={v => setProductForm({ ...productForm, description: v })} mode="outlined" style={styles.input} multiline numberOfLines={2} />

              <View style={styles.modalActions}>
                <Button mode="outlined" onPress={() => setProductModal(false)} style={{ flex: 1 }}>Cancelar</Button>
                <Button mode="contained" onPress={handleSaveProduct} loading={productSaving} buttonColor="#ffd43b" textColor="#161616" style={{ flex: 1 }}>Guardar</Button>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ── Picker de categoría (dentro del modal producto) ── */}
      <Modal visible={catPickerOpen} transparent animationType="fade" onRequestClose={() => setCatPickerOpen(false)}>
        <View style={styles.overlay}>
          <View style={[styles.modal, { maxHeight: '80%' }]}>
            <Text style={styles.modalTitle}>Seleccionar categoría</Text>
            <ScrollView style={{ marginVertical: 8 }}>
              {/* Opción sin categoría */}
              <TouchableOpacity
                style={[styles.catPickerItem, !productForm.categoryId && styles.catPickerItemActive]}
                onPress={() => { setProductForm({ ...productForm, categoryId: '' }); setCatPickerLabel(''); setCatPickerOpen(false); }}
              >
                <Text style={styles.catPickerItemText}>Sin categoría</Text>
              </TouchableOpacity>
              {/* Lista de categorías aplanada */}
              {flattenCategories(categories).map(cat => (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.catPickerItem, productForm.categoryId === String(cat.id) && styles.catPickerItemActive, { paddingLeft: 16 + cat.depth * 16 }]}
                  onPress={() => { setProductForm({ ...productForm, categoryId: String(cat.id) }); setCatPickerLabel(cat.label); setCatPickerOpen(false); }}
                >
                  <Text style={styles.catPickerItemText} numberOfLines={1}>{cat.label}</Text>
                  {productForm.categoryId === String(cat.id) && <Text style={{ color: '#ffd43b', fontWeight: '900' }}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Button mode="outlined" onPress={() => setCatPickerOpen(false)} style={{ marginTop: 8 }}>Cancelar</Button>
          </View>
        </View>
      </Modal>

      {/* ── Modal categoría ── */}
      <Modal visible={catModal} transparent animationType="fade" onRequestClose={() => setCatModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>
              {editCat ? 'Editar categoría' : catParentId ? 'Nueva subcategoría' : 'Nueva categoría'}
            </Text>
            {catParentId && !editCat && (
              <Text style={styles.modalSub}>Subcategoría de: {findCat(categories, catParentId)?.name}</Text>
            )}
            <TextInput label="Nombre *" value={catName} onChangeText={setCatName} mode="outlined" style={styles.input} />
            <TextInput label="Descripción" value={catDesc} onChangeText={setCatDesc} mode="outlined" style={styles.input} />
            <View style={styles.modalActions}>
              <Button mode="outlined" onPress={() => setCatModal(false)} style={{ flex: 1 }}>Cancelar</Button>
              <Button mode="contained" onPress={handleSaveCat} loading={catSaving} buttonColor="#ffd43b" textColor="#161616" style={{ flex: 1 }}>Guardar</Button>
            </View>
          </View>
        </View>
      </Modal>

      <ConfirmDialog
        visible={!!confirmDlg}
        title={confirmDlg?.title ?? ''}
        message={confirmDlg?.message ?? ''}
        confirmLabel="Sí, confirmar"
        onConfirm={() => confirmDlg?.onConfirm()}
        onCancel={() => setConfirmDlg(null)}
      />
      <Snackbar visible={!!snackbar} onDismiss={() => setSnackbar('')} duration={2500}>{snackbar}</Snackbar>
    </View>
  );
};

// ─── Estilos ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: '#f4f6f8' },

  // Header
  header:             { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, padding: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e8ecf2' },
  headerLeft:         { flexDirection: 'column', gap: 8 },
  headerTitle:        { fontSize: 22, fontWeight: '900', color: '#161616' },
  headerRight:        { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  storeSelector:      { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  storeChip:          { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#f4f6f8', borderWidth: 1, borderColor: '#e8ecf2' },
  storeChipActive:    { backgroundColor: '#ffd43b', borderColor: '#f5c400' },
  storeChipText:      { fontSize: 14, fontWeight: '700', color: '#6b7581' },
  storeChipTextActive:{ color: '#161616', fontWeight: '900' },

  // Alert
  alertBanner:        { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff2e4', borderBottomWidth: 1, borderBottomColor: '#efd37d', padding: 10, paddingHorizontal: 16 },
  alertText:          { color: '#3d3100', fontWeight: '700', fontSize: 13 },

  // KPIs
  kpis:               { flexDirection: 'row', flexWrap: 'wrap', gap: 10, padding: 12 },
  kpi:                { flex: 1, minWidth: 140, backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#e8ecf2', padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  kpiWarn:            { borderColor: '#efd37d', backgroundColor: '#fff9e6' },
  kpiIcon:            { fontSize: 26 },
  kpiTitle:           { fontSize: 12, fontWeight: '800', color: '#53606d', marginBottom: 2 },
  kpiValue:           { fontSize: 22, fontWeight: '950', color: '#161616', letterSpacing: -0.5 },
  kpiSub:             { fontSize: 11, color: '#6b7581', marginTop: 2 },

  // Search
  searchRow:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  searchBox:          { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e8ecf2', paddingHorizontal: 12, height: 44 },
  searchInput:        { flex: 1, fontSize: 14, color: '#161616', outlineStyle: 'none' } as any,

  // Layout principal
  main:               { flex: 1, flexDirection: 'column' },
  mainDesktop:        { flexDirection: 'row' },

  // Categorías
  catPanel:           { width: 280, backgroundColor: '#fff', borderRightWidth: 1, borderRightColor: '#e8ecf2' },
  catPanelMobile:     { width: '100%', maxHeight: 240, borderRightWidth: 0, borderBottomWidth: 1, borderBottomColor: '#e8ecf2' },
  catPanelTitle:      { fontSize: 14, fontWeight: '950', color: '#161616', padding: 12, borderBottomWidth: 1, borderBottomColor: '#e8ecf2' },
  catRow:             { flexDirection: 'row', alignItems: 'center', minHeight: 34, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginHorizontal: 6, gap: 4 },
  catRowSelected:     { backgroundColor: '#fff9e6' },
  catArrow:           { fontSize: 14, color: '#6b7581', width: 16 },
  catName:            { flex: 1, fontSize: 13, fontWeight: '700', color: '#2f3944' },
  catBadge:           { backgroundColor: '#f4f6f8', borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 },
  catBadgeText:       { fontSize: 11, fontWeight: '800', color: '#6b7581' },
  catAction:          { padding: 4 },
  catActionText:      { fontSize: 13, color: '#6b7581' },
  newCatBtn:          { margin: 8, padding: 8, backgroundColor: '#fff9e6', borderRadius: 10, borderWidth: 1, borderColor: '#ffd43b', alignItems: 'center' },
  newCatBtnText:      { fontSize: 13, fontWeight: '800', color: '#161616' },

  // Filas de productos
  empty:              { textAlign: 'center', marginTop: 40, color: '#6b7581', fontSize: 15 },
  rowHeader:          { backgroundColor: '#fcfcfb', borderBottomWidth: 2, borderBottomColor: '#e8ecf2' },
  colHeader:          { fontSize: 12, fontWeight: '950', color: '#2f3944' } as any,
  row:                { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f4f6f8', paddingHorizontal: 10, paddingVertical: 8, gap: 8 },
  rowInactive:        { opacity: 0.5 },
  rowInfo:            { flex: 1, minWidth: 0 },
  rowName:            { fontSize: 14, fontWeight: '900', color: '#161616' },
  rowSku:             { fontSize: 11, color: '#6b7581', fontWeight: '700' },
  rowCat:             { fontSize: 11, color: '#b8c0cc', marginTop: 1 },
  rowPrice:           { width: 80, fontSize: 13, fontWeight: '800', color: '#161616', textAlign: 'right' },
  stockBadge:         { flexDirection: 'row', alignItems: 'baseline', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, gap: 2, width: 90, justifyContent: 'center' },
  stockNum:           { fontSize: 16, fontWeight: '950' },
  stockMin:           { fontSize: 11, fontWeight: '700' },
  rowActions:         { flexDirection: 'row', alignItems: 'center', gap: 2 },
  adjustBtn:          { backgroundColor: '#ffd43b', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginRight: 4 },
  adjustBtnText:      { fontSize: 12, fontWeight: '800', color: '#161616' },
  actionIcon:         { margin: 0 },

  // View tabs (Stock / Historial)
  viewTabs:           { flexDirection: 'row', backgroundColor: '#f4f6f8', borderRadius: 10, padding: 3, gap: 2 },
  viewTab:            { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  viewTabActive:      { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  viewTabText:        { fontSize: 13, fontWeight: '700', color: '#6b7581' },
  viewTabTextActive:  { color: '#161616', fontWeight: '900' },

  // Filas de movimiento
  movRow:             { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f4f6f8', paddingHorizontal: 10, paddingVertical: 8, gap: 8 },
  movTypeBadge:       { width: 84, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 4, alignItems: 'center' },
  movTypeText:        { fontSize: 11, fontWeight: '900' },
  movInfo:            { flex: 1, minWidth: 0 },
  movProduct:         { fontSize: 13, fontWeight: '800', color: '#161616' },
  movReason:          { fontSize: 11, color: '#6b7581', marginTop: 2 },
  movQty:             { width: 52, fontSize: 15, fontWeight: '950', textAlign: 'right' },
  movDate:            { width: 58, fontSize: 11, fontWeight: '700', color: '#6b7581', textAlign: 'center' },

  // Modales
  overlay:            { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modal:              { backgroundColor: '#fff', borderRadius: 18, padding: 22, width: '92%', maxWidth: 460 },
  modalTitle:         { fontSize: 20, fontWeight: '900', color: '#161616', marginBottom: 4 },
  modalSub:           { fontSize: 14, color: '#53606d', fontWeight: '700', marginBottom: 4 },
  modalStock:         { fontSize: 13, color: '#6b7581', marginBottom: 14 },
  typeRow:            { flexDirection: 'row', gap: 8, marginBottom: 12 },
  input:              { marginBottom: 10 },
  fieldLabel:         { fontSize: 12, fontWeight: '800', color: '#53606d', marginBottom: 6 },
  catPickerBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#d7dde6', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 10, backgroundColor: '#fff' },
  catPickerValue:     { flex: 1, fontSize: 14, color: '#161616', fontWeight: '600' },
  catPickerPlaceholder: { flex: 1, fontSize: 14, color: '#b8c0cc' },
  catPickerItem:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 11, paddingHorizontal: 16, borderRadius: 8 },
  catPickerItemActive:{ backgroundColor: '#fff9e6' },
  catPickerItemText:  { fontSize: 14, color: '#2f3944', fontWeight: '600', flex: 1 },
  modalActions:       { flexDirection: 'row', gap: 10, marginTop: 8 },
});

export default InventoryScreen;
