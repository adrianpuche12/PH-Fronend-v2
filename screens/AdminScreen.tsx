import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  type ViewStyle,
  Animated,
  Image,
} from 'react-native';
import { Card } from 'react-native-paper';
import { Title } from 'react-native-paper';
import { ThemedView } from '../components/ThemedView';
import { ThemedText } from '../components/ThemedText';
import { Button, TextInput, Snackbar, IconButton, SegmentedButtons } from 'react-native-paper';
import { DatePickerModal } from 'react-native-paper-dates';
import { useFocusEffect } from '@react-navigation/native';
import LogoutButton from '../components/LogoutButton';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { REACT_APP_API_URL } from '../config';
import { format, parseISO } from 'date-fns';
import ExcelManager from '../components/ExcelManager';
import { formatCurrency, formatNumber, formatAmountInput, parseFormattedNumber } from '../utils/numberFormat';
import ImageViewer from '../components/ImageViewer';
import StoreDropdown from '../components/StoreDropdown';
import DateRangePicker from '../components/DateRangePicker';
import ImageButton from '../components/ImageButton';
import { COLOR, SPACE, RADIUS, FONT_SIZE, FONT_WEIGHT, SHADOW } from '../theme';

const TRANSACTION_LABELS: Record<Transaction['type'], string> = {
  income: 'Ingreso',
  expense: 'Egreso',
  SALARY: 'Salario',
  SUPPLIER: 'Proveedor',
  CLOSING: 'Cierre',
  GASTO_ADMIN: 'Gasto Administrativo',
  gasto_admin: 'Gasto Administrativo',
};

// Actualizamos la interfaz para incluir los nuevos tipos
interface Transaction {
  id: number;
  type: 'CLOSING' | 'SUPPLIER' | 'SALARY' | 'GASTO_ADMIN' | 'income' | 'expense' | 'gasto_admin';
  amount: number;
  date?: string;
  description?: string;
  closingsCount?: number;
  periodStart?: string;
  periodEnd?: string;
  supplier?: string;
  depositDate?: string;
  paymentDate?: string;
  salaryDate?: string;
  storeId?: number;
  storeName?: string;
  store?: { id: number; name: string; };
  imageUri?: string;
  username?: string;
  // Datos del turno vinculado (solo en CLOSING generados por POS)
  shiftId?: number;
  shiftCode?: string;
  shiftOpenedAt?: string;
  shiftClosedAt?: string;
  salesCount?: number;
  openingCashAmount?: number;
  totalCashSales?: number;
  totalCardSales?: number;
  totalShiftExpenses?: number;
  declaredCashAmount?: number;
  cashDifference?: number;
  depositStatus?: string;
  bankDepositId?: number;
  closingShiftId?: number;
}

interface DepositGroup {
  type: 'DEPOSIT_GROUP';
  id: number;
  amount: number;
  date?: string;
  imageUri?: string;
  storeNames: string[];
  closingCount: number;
}

type DisplayItem = Transaction | DepositGroup;

const ITEMS_PER_PAGE = 5;

const CollapsibleBalanceCard = ({ transactions }: { transactions: any[] }) => {
  const [isCollapsed, setIsCollapsed] = React.useState(true);
  const animatedHeight = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(animatedHeight, {
      toValue: isCollapsed ? 0 : 1,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [isCollapsed]);

  const ingresos = transactions
    .filter(tx => tx.type === 'CLOSING' || tx.type === 'income')
    .reduce((sum, tx) => sum + tx.amount, 0);
  const egresos = transactions
    .filter(tx => tx.type === 'SUPPLIER' || tx.type === 'SALARY' || tx.type === 'GASTO_ADMIN' || tx.type === 'expense' || tx.type === 'gasto_admin')
    .reduce((sum, tx) => sum + tx.amount, 0);
  const total = ingresos - egresos;

  const balanceContainerHeight = animatedHeight.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 160]
  });

  return (
    <Card style={styles.balanceCard}>
      <TouchableOpacity
        style={styles.balanceHeaderContainer}
        onPress={() => setIsCollapsed(!isCollapsed)}
      >
        <Title style={styles.balanceTitle}>Balance General</Title>
        <IconButton
          icon={isCollapsed ? "chevron-down" : "chevron-up"}
          size={24}
          onPress={() => setIsCollapsed(!isCollapsed)}
        />
      </TouchableOpacity>

      <Animated.View style={[
        styles.balanceContentContainer,
        {
          height: balanceContainerHeight,
          opacity: animatedHeight
        }
      ]}>
        <View style={styles.balanceRow}>
          <MaterialCommunityIcons name="arrow-down-bold-circle-outline" size={20} color={COLOR.income} />
          <Text style={styles.balanceLabel}>Ingresos:</Text>
          <Text style={styles.balanceValue}>{formatCurrency(ingresos)}</Text>
        </View>
        <View style={styles.balanceRow}>
          <MaterialCommunityIcons name="arrow-up-bold-circle-outline" size={20} color={COLOR.expense} />
          <Text style={styles.balanceLabel}>Egresos:</Text>
          <Text style={styles.balanceValue}>{formatCurrency(egresos)}</Text>
        </View>
        <View style={styles.balanceRow}>
          <MaterialCommunityIcons name="calculator-variant" size={20} color={COLOR.info} />
          <Text style={styles.balanceLabel}>Total:</Text>
          <Text style={[styles.balanceValue, { fontWeight: 'bold' }]}>{formatCurrency(total)}</Text>
        </View>
      </Animated.View>
    </Card>
  );
};

const BalanceCard = ({ transactions }: { transactions: any[] }) => {
  const ingresos = transactions
    .filter(tx => tx.type === 'CLOSING' || tx.type === 'income')
    .reduce((sum, tx) => sum + tx.amount, 0);
  const egresos = transactions
    .filter(tx => tx.type === 'SUPPLIER' || tx.type === 'SALARY' || tx.type === 'GASTO_ADMIN' || tx.type === 'expense' || tx.type === 'gasto_admin')
    .reduce((sum, tx) => sum + tx.amount, 0);
  const total = ingresos - egresos;

  return (
    <Card style={styles.balanceCard}>
      <Card.Content>
        <Title style={styles.balanceTitle}>Balance General</Title>
        <View style={styles.balanceRow}>
          <MaterialCommunityIcons name="arrow-down-bold-circle-outline" size={20} color={COLOR.income} />
          <Text style={styles.balanceLabel}>Ingresos:</Text>
          <Text style={styles.balanceValue}>{formatCurrency(ingresos)}</Text>
        </View>
        <View style={styles.balanceRow}>
          <MaterialCommunityIcons name="arrow-up-bold-circle-outline" size={20} color={COLOR.expense} />
          <Text style={styles.balanceLabel}>Egresos:</Text>
          <Text style={styles.balanceValue}>{formatCurrency(egresos)}</Text>
        </View>
        <View style={styles.balanceRow}>
          <MaterialCommunityIcons name="calculator-variant" size={20} color={COLOR.info} />
          <Text style={styles.balanceLabel}>Total:</Text>
          <Text style={[styles.balanceValue, { fontWeight: 'bold' }]}>{formatCurrency(total)}</Text>
        </View>
      </Card.Content>
    </Card>
  );
};

// ─── KPI Row (4 cards: Balance · Ingresos · Egresos · Promedio) ───────────────
const KpiRow = ({ transactions }: { transactions: Transaction[] }) => {
  const INCOME_T = ['income', 'CLOSING'];
  const EXPENSE_T = ['expense', 'SALARY', 'SUPPLIER', 'GASTO_ADMIN', 'gasto_admin'];
  const incomeTxs  = transactions.filter(tx => INCOME_T.includes(tx.type));
  const expenseTxs = transactions.filter(tx => EXPENSE_T.includes(tx.type));
  const totalIncome  = incomeTxs.reduce((s, tx) => s + tx.amount, 0);
  const totalExpense = expenseTxs.reduce((s, tx) => s + tx.amount, 0);
  const balance      = totalIncome - totalExpense;
  const promedio     = balance / 30;

  const L = (v: number) =>
    `L ${Math.abs(v).toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <View style={styles.kpiRow}>
      <View style={styles.kpiCard}>
        <Text style={styles.kpiCardLabel}>BALANCE DEL PERIODO</Text>
        <Text style={[styles.kpiCardValue, { color: balance >= 0 ? COLOR.income : COLOR.expense }]}>
          {balance >= 0 ? '+' : '-'}{L(balance)}
        </Text>
        <Text style={styles.kpiCardSub}>Periodo actual</Text>
      </View>
      <View style={styles.kpiCard}>
        <Text style={styles.kpiCardLabel}>INGRESOS · {incomeTxs.length} MOV.</Text>
        <Text style={[styles.kpiCardValue, { color: COLOR.income }]}>+{L(totalIncome)}</Text>
        <Text style={styles.kpiCardSub}> </Text>
      </View>
      <View style={styles.kpiCard}>
        <Text style={styles.kpiCardLabel}>EGRESOS · {expenseTxs.length} MOV.</Text>
        <Text style={[styles.kpiCardValue, { color: COLOR.expense }]}>-{L(totalExpense)}</Text>
        <Text style={styles.kpiCardSub}> </Text>
      </View>
      <View style={styles.kpiCard}>
        <Text style={styles.kpiCardLabel}>PROMEDIO DIARIO</Text>
        <Text style={styles.kpiCardValue}>{L(promedio)}</Text>
        <Text style={styles.kpiCardSub}>Sobre el balance neto</Text>
      </View>
    </View>
  );
};

const CompactDateFilters = ({
  startDate,
  endDate,
  selectedStore,
  setStartDate,
  setEndDate,
  setSelectedStore,
  fetchData,
  setDatePickerOpen,
  setSelectedDateInput,
  onExcelPress,
  showAdminExpenses,
  onToggleAdminExpenses,
  activeStores,
  depositFilter,
  setDepositFilter,
}: {
  startDate?: Date;
  endDate?: Date;
  selectedStore: number | null;
  setStartDate: (date?: Date) => void;
  setEndDate: (date?: Date) => void;
  setSelectedStore: (storeId: number | null) => void;
  fetchData: (start?: Date, end?: Date, storeId?: number | null) => void;
  setDatePickerOpen: (open: boolean) => void;
  setSelectedDateInput: (input: 'start' | 'end') => void;
  onExcelPress: () => void;
  showAdminExpenses: boolean;
  onToggleAdminExpenses: () => void;
  activeStores: {id: number; name: string}[];
  depositFilter: 'all' | 'pending' | 'deposited';
  setDepositFilter: (filter: 'all' | 'pending' | 'deposited') => void;
}) => {
  const { width: screenWidth } = useWindowDimensions();
  const isLargeScreen = screenWidth >= 768;
  const formatDate = (date?: Date | string) => {
    if (!date) return '';
    try {
      if (typeof date === 'string') {
        return format(parseISO(date), 'yyyy-MM-dd');
      }
      return format(date, 'yyyy-MM-dd');
    } catch (error) {
      console.error('Error al formatear la fecha:', error, date);
      return String(date);
    }
  };

  return (
    <View style={styles.compactFiltersContainer}>
      <View style={isLargeScreen ? styles.filtersRowWeb : undefined}>
        <View style={isLargeScreen ? styles.inputGroupWeb : styles.compactDateInputs}>
          <DateRangePicker
            from={formatDate(startDate)}
            to={formatDate(endDate)}
            label="Filtrar por fechas"
            onChange={(from, to) => {
              setStartDate(from ? new Date(from + 'T12:00:00') : undefined);
              setEndDate(to   ? new Date(to   + 'T12:00:00') : undefined);
              fetchData(
                from ? new Date(from + 'T12:00:00') : undefined,
                to   ? new Date(to   + 'T12:00:00') : undefined,
                selectedStore
              );
            }}
          />
        </View>

        {/* Selector de tienda — dropdown */}
        <StoreDropdown
          stores={activeStores}
          selectedId={selectedStore}
          onSelect={(id) => setSelectedStore(id)}
          includeAll
          allLabel="Todos los locales"
        />

        {/* Botones — grid 2 columnas para que no se corten en mobile */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 4, marginTop: 4 }}>
          <Button
            mode={showAdminExpenses ? "contained" : "outlined"}
            compact
            onPress={onToggleAdminExpenses}
            style={{ flex: 1, minWidth: '45%' }}
            icon="bank"
            buttonColor={showAdminExpenses ? COLOR.warn : COLOR.transparent}
            textColor={showAdminExpenses ? COLOR.white : COLOR.warn}
          >
            G. Admin
          </Button>
          <Button
            mode="contained"
            compact
            onPress={() => fetchData(startDate, endDate, selectedStore)}
            style={{ flex: 1, minWidth: '45%' }}
            icon="refresh"
            buttonColor={COLOR.info}
          >
            Actualizar
          </Button>
          <Button
            mode="contained"
            compact
            onPress={onExcelPress}
            style={{ flex: 1, minWidth: '45%' }}
            icon="microsoft-excel"
            buttonColor={COLOR.income}
          >
            Excel
          </Button>
          {(startDate || endDate || selectedStore || showAdminExpenses) && (
            <Button
              mode="outlined"
              compact
              onPress={() => {
                setStartDate(undefined);
                setEndDate(undefined);
                setSelectedStore(null);
                if (showAdminExpenses) onToggleAdminExpenses();
              }}
              style={{ flex: 1, minWidth: '45%' }}
              textColor={COLOR.brandDark}
            >
              Limpiar
            </Button>
          )}
        </View>
      </View>

      {/* Filtro por estado de depósito (solo aplica a Cierres) */}
      <View style={{ flexDirection: 'row', marginHorizontal: 4, marginTop: 8, borderRadius: RADIUS.r2, overflow: 'hidden', borderWidth: 1, borderColor: COLOR.border }}>
        {([
          { key: 'all',       label: 'Todos',         icon: 'filter-variant' as const },
          { key: 'pending',   label: 'Sin depositar',  icon: 'bank-outline' as const },
          { key: 'deposited', label: 'Depositados',    icon: 'bank-check' as const },
        ] as const).map(({ key, label, icon }) => (
          <TouchableOpacity
            key={key}
            onPress={() => setDepositFilter(key)}
            style={[styles.tabBtn, depositFilter === key && styles.tabBtnActive]}
          >
            <MaterialCommunityIcons
              name={icon}
              size={14}
              color={depositFilter === key ? COLOR.ink : COLOR.inkMute}
            />
            <Text style={[styles.tabBtnText, depositFilter === key && styles.tabBtnTextActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const AdminScreen = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // Ref para saber si ya se realizó al menos una carga exitosa (evita closure stale)
  const hasLoadedRef = useRef(false);
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [selectedDateInput, setSelectedDateInput] = useState<'start' | 'end'>('start');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedStore, setSelectedStore] = useState<number | null>(null);
  const [showAdminExpenses, setShowAdminExpenses] = useState(false);
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [depositFilter, setDepositFilter] = useState<'all' | 'pending' | 'deposited'>('all');
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  // Estados para el modal de edición
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [datePickerEditVisible, setDatePickerEditVisible] = useState(false);
  const [dateEditField, setDateEditField] = useState<'date' | 'periodStart' | 'periodEnd'>('date');

  // Estado para gestión de Excel
  const [showExcelManager, setShowExcelManager] = useState(false);

  // Estado para visor de comprobante
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [expandedClosings, setExpandedClosings] = useState<Record<number, boolean>>({});
  const toggleClosingDetail = (id: number) =>
    setExpandedClosings(prev => ({ ...prev, [id]: !prev[id] }));

  // Campos para editar
  const [newAmount, setNewAmount] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newClosingsCount, setNewClosingsCount] = useState('');
  const [newPeriodStart, setNewPeriodStart] = useState('');
  const [newPeriodEnd, setNewPeriodEnd] = useState('');
  const [newSupplier, setNewSupplier] = useState('');
  const [newStoreId, setNewStoreId] = useState<number | null>(null);

  // Snackbar
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  // Estados para la eliminación (modal)
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);

  const { width: screenWidth } = useWindowDimensions();
  const isLargeScreen = screenWidth >= 768;

  // Stores activos — cargados dinámicamente desde /api/v2/stores/active
  const [activeStores, setActiveStores] = useState<{id: number; name: string}[]>([]);
  useEffect(() => {
    fetch(`${REACT_APP_API_URL}/api/v2/stores/active`)
      .then(r => r.json())
      .then(setActiveStores)
      .catch(() => {});
  }, []);

  // Manejador para éxito de importación desde Excel
  const handleImportSuccess = () => {
    if (showAdminExpenses) {
      fetchAdminExpenses(startDate, endDate, selectedStore);
    } else {
      fetchData(startDate, endDate, selectedStore);
    }
    setSnackbarMessage('Operaciones importadas correctamente');
    setSnackbarVisible(true);
  };

  // Función para alternar el filtro de gastos administrativos
  const handleToggleAdminExpenses = () => {
    const newShowAdmin = !showAdminExpenses;
    setShowAdminExpenses(newShowAdmin);
    if (newShowAdmin) {
      fetchAdminExpenses(startDate, endDate, selectedStore);
    } else {
      fetchData(startDate, endDate, selectedStore);
    }
  };

  // Función para obtener solo gastos administrativos
  const fetchAdminExpenses = async (start?: Date, end?: Date, storeId?: number | null) => {
    if (!hasLoadedRef.current) setLoading(true);
    else setRefreshing(true);
    try {
      let url = `${REACT_APP_API_URL}/api/operations/admin-expenses`;
      const queryParams: string[] = [];
      if (start && end) {
        queryParams.push(`startDate=${format(start, 'yyyy-MM-dd')}`);
        queryParams.push(`endDate=${format(end, 'yyyy-MM-dd')}`);
      }
      if (storeId) queryParams.push(`storeId=${storeId}`);
      if (queryParams.length > 0) url += `?${queryParams.join('&')}`;

      const response = await fetch(url);
      let adminExpensesData: Transaction[] = [];
      if (response.ok) adminExpensesData = await response.json();

      hasLoadedRef.current = true;
      setTransactions(adminExpensesData);
      setCurrentPage(1);
    } catch (err) {
      console.error('Error al cargar los gastos administrativos:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Obtiene datos de dos endpoints en paralelo (fetch + body) y los unifica.
  const fetchData = async (start?: Date, end?: Date, storeId?: number | null) => {
    if (!hasLoadedRef.current) setLoading(true);
    else setRefreshing(true);
    try {
      // Construir URLs
      let urlOperations = `${REACT_APP_API_URL}/api/operations/all`;
      const queryParams: string[] = [];
      if (start && end) {
        queryParams.push(`startDate=${format(start, 'yyyy-MM-dd')}`);
        queryParams.push(`endDate=${format(end, 'yyyy-MM-dd')}`);
      }
      if (storeId) queryParams.push(`storeId=${storeId}`);
      if (queryParams.length > 0) urlOperations += `?${queryParams.join('&')}`;

      const urlTransactions = storeId
        ? `${REACT_APP_API_URL}/api/transactions/store/${storeId}`
        : `${REACT_APP_API_URL}/transactions`;

      // Fetch + parse JSON completamente en paralelo
      const [opsRaw, transRaw]: [Transaction[], Transaction[]] = await Promise.all([
        fetch(urlOperations).then(r => r.ok ? r.json() : []),
        fetch(urlTransactions).then(r => r.ok ? r.json() : []),
      ]);

      const operationsData: Transaction[] = opsRaw.map(op => {
        const newOp = { ...op };
        if (op.type === 'CLOSING' && op.depositDate) newOp.date = op.depositDate;
        else if (op.type === 'SUPPLIER' && op.paymentDate) newOp.date = op.paymentDate;
        else if (op.type === 'SALARY' && op.salaryDate) newOp.date = op.salaryDate;
        return newOp;
      });

      let transactionsData: Transaction[] = transRaw;
      if (start && end) {
        const startDateStr = format(start, 'yyyy-MM-dd');
        const endDateStr   = format(end, 'yyyy-MM-dd');
        transactionsData = transRaw.filter(tx => {
          if (!tx.date) return false;
          try {
            const txDateStr = typeof tx.date === 'string'
              ? tx.date.split('T')[0]
              : format(new Date(tx.date), 'yyyy-MM-dd');
            return txDateStr >= startDateStr && txDateStr <= endDateStr;
          } catch { return false; }
        });
      }

      const merged = [...operationsData, ...transactionsData];
      const sortedTransactions = merged.sort((a, b) => {
        if (!a.date) return 1;
        if (!b.date) return -1;
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });

      hasLoadedRef.current = true;
      setTransactions(sortedTransactions);
      setCurrentPage(1);
    } catch (err) {
      console.error('Error al cargar las transacciones:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (showAdminExpenses) {
        fetchAdminExpenses(startDate, endDate, selectedStore);
      } else {
        fetchData(startDate, endDate, selectedStore);
      }
    }, [startDate, endDate, selectedStore, showAdminExpenses])
  );

  const onDismissDatePicker = () => {
    setDatePickerOpen(false);
  };

  const onConfirmDate = ({ date }: { date: Date | undefined }) => {
    setDatePickerOpen(false);
    if (date) {
      if (selectedDateInput === 'start') {
        setStartDate(date);
      } else {
        setEndDate(date);
      }
    }
  };

  const onConfirmEditDate = ({ date }: { date: Date | undefined }) => {
    if (!date) return;

    const formattedDate = format(date, 'yyyy-MM-dd');

    if (dateEditField === 'date') {
      setNewDate(formattedDate);
    } else if (dateEditField === 'periodStart') {
      setNewPeriodStart(formattedDate);
    } else if (dateEditField === 'periodEnd') {
      setNewPeriodEnd(formattedDate);
    }

    setDatePickerEditVisible(false);
  };

  const formatDate = (date?: Date | string) => {
    if (!date) return '';
    try {
      if (typeof date === 'string') {
        return format(parseISO(date), 'yyyy-MM-dd');
      }
      return format(date, 'yyyy-MM-dd');
    } catch (error) {
      console.error('Error al formatear la fecha:', error, date);
      return String(date);
    }
  };

  // Filtro por tipo de transacción
  const INCOME_TYPES = ['income', 'CLOSING'];
  const EXPENSE_TYPES = ['expense', 'SALARY', 'SUPPLIER', 'GASTO_ADMIN', 'gasto_admin'];

  // Reemplaza los cierres DEPOSITED por un único DepositGroup por bankDepositId.
  // Los cierres PENDING permanecen como items individuales.
  const displayItems: DisplayItem[] = useMemo(() => {
    const groups = new Map<number, DepositGroup>();
    const result: DisplayItem[] = [];
    for (const tx of transactions) {
      if (tx.type === 'CLOSING' && tx.depositStatus === 'DEPOSITED' && tx.bankDepositId != null) {
        const gid = tx.bankDepositId;
        const sName = tx.store?.name ?? tx.storeName ?? '—';
        if (groups.has(gid)) {
          const g = groups.get(gid)!;
          g.amount += tx.declaredCashAmount ?? tx.amount;
          g.closingCount += 1;
          if (!g.storeNames.includes(sName)) g.storeNames.push(sName);
        } else {
          const g: DepositGroup = {
            type: 'DEPOSIT_GROUP',
            id: gid,
            amount: tx.declaredCashAmount ?? tx.amount,
            date: tx.date,
            imageUri: tx.imageUri,
            storeNames: [sName],
            closingCount: 1,
          };
          groups.set(gid, g);
          result.push(g);
        }
      } else {
        result.push(tx);
      }
    }
    return result;
  }, [transactions]);

  const filteredByType = typeFilter === 'all'
    ? displayItems
    : typeFilter === 'income'
      ? displayItems.filter(tx => tx.type === 'DEPOSIT_GROUP' || INCOME_TYPES.includes((tx as Transaction).type))
      : displayItems.filter(tx => tx.type !== 'DEPOSIT_GROUP' && EXPENSE_TYPES.includes((tx as Transaction).type));

  // Conteos para badges en las tabs
  const incomeCount  = displayItems.filter(tx => tx.type === 'DEPOSIT_GROUP' || INCOME_TYPES.includes((tx as Transaction).type)).length;
  const expenseCount = displayItems.filter(tx => tx.type !== 'DEPOSIT_GROUP' && EXPENSE_TYPES.includes((tx as Transaction).type)).length;
  const allCount     = displayItems.length;

  // Filtro por estado de depósito
  const filteredByDeposit = depositFilter === 'all'
    ? filteredByType
    : depositFilter === 'deposited'
      ? filteredByType.filter(tx => tx.type === 'DEPOSIT_GROUP')
      : filteredByType.filter(tx => tx.type === 'CLOSING' && (tx as Transaction).depositStatus === 'PENDING');

  // Paginación
  const totalPages = Math.ceil(filteredByDeposit.length / ITEMS_PER_PAGE);
  const paginatedTransactions = filteredByDeposit.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );
  const maxPagesToShow = screenWidth < 768 ? 5 : screenWidth < 1024 ? 10 : 20;
  let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
  let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
  if (endPage - startPage + 1 < maxPagesToShow) {
    startPage = Math.max(1, endPage - maxPagesToShow + 1);
  }
  const pageNumbers: number[] = [];
  for (let i = startPage; i <= endPage; i++) {
    pageNumbers.push(i);
  }

  // ----------------------- PROCESO DE ELIMINACIÓN -----------------------
  const handleDelete = (transaction: Transaction) => {
    setTransactionToDelete(transaction);
    setShowDeleteConfirmation(true);
  };

  const confirmDelete = async () => {
    if (!transactionToDelete) return;
    try {
      let url = '';
      if (transactionToDelete.type === 'income' || transactionToDelete.type === 'expense' || transactionToDelete.type === 'gasto_admin') {
        url = `${REACT_APP_API_URL}/transactions/${transactionToDelete.id}`;
      } else {
        url = `${REACT_APP_API_URL}/api/operations/${transactionToDelete.type}/${transactionToDelete.id}`;
      }
      const response = await fetch(url, { method: 'DELETE' });
      if (response.ok) {
        setSnackbarMessage('La transacción ha sido eliminada correctamente.');
        setSnackbarVisible(true);
        if (showAdminExpenses) {
          fetchAdminExpenses(startDate, endDate, selectedStore);
        } else {
          fetchData(startDate, endDate, selectedStore);
        }
      } else {
        Alert.alert('Error', 'No se pudo eliminar la transacción.');
      }
    } catch (error) {
      console.error('Error al eliminar la transacción:', error);
      Alert.alert('Error', 'Ocurrió un error al eliminar la transacción.');
    } finally {
      setShowDeleteConfirmation(false);
      setTransactionToDelete(null);
    }
  };
  // -----------------------------------------------------------------------

  // Función para editar: se llenan los campos del modal
  const handleEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setNewAmount(transaction.amount.toString());

    let dateValue = '';
    if (transaction.type === 'CLOSING' || transaction.type === 'SALARY') {
      dateValue = transaction.date || '';
    } else if (transaction.type === 'SUPPLIER') {
      dateValue = transaction.date || '';
    } else {
      dateValue = transaction.date || '';
    }

    setNewDate(dateValue);
    setNewDescription(transaction.description ?? '');
    setNewClosingsCount(
      transaction.closingsCount !== undefined ? transaction.closingsCount.toString() : ''
    );
    setNewPeriodStart(transaction.periodStart ?? '');
    setNewPeriodEnd(transaction.periodEnd ?? '');
    setNewSupplier(transaction.supplier ?? '');
    setNewStoreId(null);
    setEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    if (!editingTransaction) return;
    const parsedAmount = parseFloat(newAmount.replace(/,/g, ''));
    if (isNaN(parsedAmount)) {
      Alert.alert('Error', 'Por favor ingrese un monto válido.');
      return;
    }
    if (newStoreId === null) {
      Alert.alert('Error', 'Por favor seleccione un local.');
      return;
    }

    let updatedTransaction = {};

    if (editingTransaction.type === 'CLOSING') {
      updatedTransaction = {
        amount: parsedAmount,
        username: "default_user",
        closingsCount: newClosingsCount ? parseInt(newClosingsCount) : undefined,
        periodStart: newPeriodStart || undefined,
        periodEnd: newPeriodEnd || undefined,
        depositDate: newDate || undefined,
        storeId: newStoreId
      };
    } else if (editingTransaction.type === 'SUPPLIER') {
      updatedTransaction = {
        amount: parsedAmount,
        username: "default_user",
        supplier: newSupplier || undefined,
        paymentDate: newDate || undefined,
        storeId: newStoreId,
        description: newDescription || undefined
      };
    } else if (editingTransaction.type === 'SALARY') {
      updatedTransaction = {
        amount: parsedAmount,
        description: newDescription || undefined,
        username: "default_user",
        salaryDate: newDate || undefined,
        storeId: newStoreId
      };
    } else {
      updatedTransaction = {
        type: editingTransaction.type,
        amount: parsedAmount,
        date: newDate || undefined,
        description: newDescription || undefined,
        store: { id: newStoreId }
      };
    }

    try {
      console.log("Enviando datos:", JSON.stringify(updatedTransaction, null, 2));

      let url = '';
      if (editingTransaction.type === 'income' || editingTransaction.type === 'expense' || editingTransaction.type === 'gasto_admin') {
        url = `${REACT_APP_API_URL}/transactions/${editingTransaction.id}`;
      } else {
        url = `${REACT_APP_API_URL}/api/operations/${editingTransaction.type}/${editingTransaction.id}`;
      }

      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedTransaction),
      });

      if (response.ok) {
        setSnackbarMessage('La transacción ha sido actualizada correctamente.');
        setSnackbarVisible(true);
        setEditModalVisible(false);
        setEditingTransaction(null);
        if (showAdminExpenses) {
          fetchAdminExpenses(startDate, endDate, selectedStore);
        } else {
          fetchData(startDate, endDate, selectedStore);
        }
      } else {
        const errorText = await response.text();
        console.error("Error response:", errorText);
        try {
          const errorData = JSON.parse(errorText);
          const errorMessage = errorData.message || 'No se pudo actualizar la transacción.';
          Alert.alert('Error', errorMessage);
        } catch {
          Alert.alert('Error', `Error del servidor: ${response.status}`);
        }
      }
    } catch (error) {
      console.error('Error al actualizar la transacción:', error);
      Alert.alert('Error', 'Ocurrió un error al actualizar la transacción.');
    }
  };

  const handleCancelEdit = () => {
    setEditModalVisible(false);
    setEditingTransaction(null);
  };

  // Render del modal de edición para cada tipo
  // Render del modal de edición para cada tipo
const renderEditFields = () => {
  if (!editingTransaction) return null;

  const storeSelector = (
    <View style={styles.modalInputContainer}>
      <Text style={styles.modalInputLabel}>Local:</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ flexDirection: 'row', gap: 8, paddingVertical: 4 }}>
        {activeStores.map(s => (
          <TouchableOpacity
            key={s.id}
            style={[storeChipStyle.chip, newStoreId === s.id && storeChipStyle.active]}
            onPress={() => setNewStoreId(s.id)}
          >
            <Text style={[storeChipStyle.text, newStoreId === s.id && storeChipStyle.activeText]}>{s.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  switch (editingTransaction.type) {
    case 'CLOSING':
      return (
        <>
          {storeSelector}
          <TextInput
            label="Monto"
            value={newAmount}
            onChangeText={(value) => {
              const formattedValue = formatAmountInput(value);
              setNewAmount(formattedValue);
            }}
            keyboardType="numeric"
            style={styles.modalInput}
          />
          <TextInput
            label="Fecha de Depósito"
            value={newDate}
            style={styles.modalInput}
            showSoftInputOnFocus={false}
            onFocus={() => {
              setDateEditField('date');
              setDatePickerEditVisible(true);
            }}
            right={<TextInput.Icon icon="calendar" onPress={() => {
              setDateEditField('date');
              setDatePickerEditVisible(true);
            }} />}
          />
          <TextInput
            label="Periodo Desde"
            value={newPeriodStart}
            style={styles.modalInput}
            showSoftInputOnFocus={false}
            onFocus={() => {
              setDateEditField('periodStart');
              setDatePickerEditVisible(true);
            }}
            right={<TextInput.Icon icon="calendar" onPress={() => {
              setDateEditField('periodStart');
              setDatePickerEditVisible(true);
            }} />}
          />
          <TextInput
            label="Periodo Hasta"
            value={newPeriodEnd}
            style={styles.modalInput}
            showSoftInputOnFocus={false}
            onFocus={() => {
              setDateEditField('periodEnd');
              setDatePickerEditVisible(true);
            }}
            right={<TextInput.Icon icon="calendar" onPress={() => {
              setDateEditField('periodEnd');
              setDatePickerEditVisible(true);
            }} />}
          />
        </>
      );
    case 'SUPPLIER':
      return (
        <>
          {storeSelector}
          <TextInput
            label="Monto"
            value={newAmount}
            onChangeText={(value) => {
              const formattedValue = formatAmountInput(value);
              setNewAmount(formattedValue);
            }}
            keyboardType="numeric"
            style={styles.modalInput}
          />
          <TextInput
            label="Fecha de Pago"
            value={newDate}
            style={styles.modalInput}
            showSoftInputOnFocus={false}
            onFocus={() => {
              setDateEditField('date');
              setDatePickerEditVisible(true);
            }}
            right={<TextInput.Icon icon="calendar" onPress={() => {
              setDateEditField('date');
              setDatePickerEditVisible(true);
            }} />}
          />
          <TextInput
            label="Proveedor"
            value={newSupplier}
            onChangeText={setNewSupplier}
            style={styles.modalInput}
          />
          <TextInput
            label="Descripción"
            value={newDescription}
            onChangeText={setNewDescription}
            style={styles.modalInput}
          />
        </>
      );
    case 'SALARY':
      return (
        <>
          {storeSelector}
          <TextInput
            label="Monto"
            value={newAmount}
            onChangeText={(value) => {
              const formattedValue = formatAmountInput(value);
              setNewAmount(formattedValue);
            }}
            keyboardType="numeric"
            style={styles.modalInput}
          />
          <TextInput
            label="Fecha de Salario"
            value={newDate}
            style={styles.modalInput}
            showSoftInputOnFocus={false}
            onFocus={() => {
              setDateEditField('date');
              setDatePickerEditVisible(true);
            }}
            right={<TextInput.Icon icon="calendar" onPress={() => {
              setDateEditField('date');
              setDatePickerEditVisible(true);
            }} />}
          />
          <TextInput
            label="Descripción"
            value={newDescription}
            onChangeText={setNewDescription}
            style={styles.modalInput}
          />
        </>
      );
    case 'GASTO_ADMIN':
      return (
        <>
          <TextInput
            label="Monto"
            value={newAmount}
            onChangeText={(value) => {
              const formattedValue = formatAmountInput(value);
              setNewAmount(formattedValue);
            }}
            keyboardType="numeric"
            style={styles.modalInput}
          />
          <TextInput
            label="Fecha"
            value={newDate}
            style={styles.modalInput}
            showSoftInputOnFocus={false}
            onFocus={() => {
              setDateEditField('date');
              setDatePickerEditVisible(true);
            }}
            right={<TextInput.Icon icon="calendar" onPress={() => {
              setDateEditField('date');
              setDatePickerEditVisible(true);
            }} />}
          />
          <TextInput
            label="Descripción"
            value={newDescription}
            onChangeText={setNewDescription}
            style={styles.modalInput}
          />
        </>
      );
    case 'gasto_admin':
      return (
        <>
          {storeSelector}
          <TextInput
            label="Monto"
            value={newAmount}
            onChangeText={(value) => {
              const formattedValue = formatAmountInput(value);
              setNewAmount(formattedValue);
            }}
            keyboardType="numeric"
            style={styles.modalInput}
          />
          <TextInput
            label="Fecha"
            value={newDate}
            style={styles.modalInput}
            showSoftInputOnFocus={false}
            onFocus={() => {
              setDateEditField('date');
              setDatePickerEditVisible(true);
            }}
            right={<TextInput.Icon icon="calendar" onPress={() => {
              setDateEditField('date');
              setDatePickerEditVisible(true);
            }} />}
          />
          <TextInput
            label="Descripción"
            value={newDescription}
            onChangeText={setNewDescription}
            style={styles.modalInput}
          />
        </>
      );
    case 'income':
    case 'expense':
      return (
        <>
          {storeSelector}
          
          {/* Selector de tipo específico para ingresos/egresos */}
          <View style={styles.modalInputContainer}>
            <Text style={styles.modalInputLabel}>Tipo de transacción:</Text>
            <SegmentedButtons
              value={editingTransaction.type}
              onValueChange={(value: string) => {
                // Solo permitimos 'income' o 'expense'
                if (value === 'income' || value === 'expense') {
                  setEditingTransaction({
                    ...editingTransaction,
                    type: value as 'income' | 'expense'
                  });
                }
              }}
              buttons={[
                { value: 'income', label: 'Ingreso' },
                { value: 'expense', label: 'Egreso' },
              ]}
              style={styles.storeSelector}
            />
          </View>
          
          <TextInput
            label="Monto"
            value={newAmount}
            onChangeText={(value) => {
              const formattedValue = formatAmountInput(value);
              setNewAmount(formattedValue);
            }}
            keyboardType="numeric"
            style={styles.modalInput}
          />
          <TextInput
            label="Fecha"
            value={newDate}
            style={styles.modalInput}
            showSoftInputOnFocus={false}
            onFocus={() => {
              setDateEditField('date');
              setDatePickerEditVisible(true);
            }}
            right={<TextInput.Icon icon="calendar" onPress={() => {
              setDateEditField('date');
              setDatePickerEditVisible(true);
            }} />}
          />
          <TextInput
            label="Descripción"
            value={newDescription}
            onChangeText={setNewDescription}
            style={styles.modalInput}
          />
        </>
      );
    default:
      return (
        <>
          {storeSelector}
          <TextInput
            label="Monto"
            value={newAmount}
            onChangeText={(value) => {
              const formattedValue = formatAmountInput(value);
              setNewAmount(formattedValue);
            }}
            keyboardType="numeric"
            style={styles.modalInput}
          />
          <TextInput
            label="Fecha"
            value={newDate}
            style={styles.modalInput}
            showSoftInputOnFocus={false}
            onFocus={() => {
              setDateEditField('date');
              setDatePickerEditVisible(true);
            }}
            right={<TextInput.Icon icon="calendar" onPress={() => {
              setDateEditField('date');
              setDatePickerEditVisible(true);
            }} />}
          />
          <TextInput
            label="Descripción"
            value={newDescription}
            onChangeText={setNewDescription}
            style={styles.modalInput}
          />
        </>
      );
  }
}

// Esta función puede ir en tu archivo de utils o en el mismo componente
const buildImageUrl = (imagePath: string | undefined): string | null => {
  if (!imagePath) return null;
  
  // Si ya es una URL completa (http o https)
  if (/^https?:\/\//i.test(imagePath)) {
    return imagePath;
  }
  
  // Si es una ruta relativa (comienza con /)
  if (imagePath.startsWith('/')) {
    return `${REACT_APP_API_URL}${imagePath}`;
  }
  
  // Para rutas relativas sin /
  return `${REACT_APP_API_URL}/${imagePath}`;
};

  const renderTransaction = (item: DisplayItem, index: number) => {
    // ── Card agrupado para cierres depositados ──
    if (item.type === 'DEPOSIT_GROUP') {
      const fmtD = (d?: string) => {
        if (!d) return '—';
        try { return format(parseISO(d), 'dd MMM yyyy'); } catch { return String(d).split('T')[0]; }
      };
      const amtStr = `L ${item.amount.toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      const rawUri = item.imageUri;
      const imageUri = rawUri && rawUri !== 'null' && rawUri !== 'undefined' && rawUri.startsWith('http') ? rawUri : null;
      return (
        <View key={`dg-${item.id}-${index}`} style={{ backgroundColor: COLOR.surface, borderBottomWidth: 1, borderBottomColor: COLOR.border }}>
          <View style={[styles.txRow, { borderBottomWidth: 0 }]}>
            <View style={[styles.txIconWrap, { backgroundColor: COLOR.incomeTint }]}>
              <MaterialCommunityIcons name="bank-check" size={20} color={COLOR.income} />
            </View>
            <View style={styles.txMain}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                <Text style={styles.txName}>Depósito bancario</Text>
              </View>
              {!isLargeScreen && (
                <Text style={styles.txMeta}>{fmtD(item.date)}</Text>
              )}
              <Text style={styles.txMeta} numberOfLines={1}>
                {item.closingCount} cierre{item.closingCount !== 1 ? 's' : ''} · {item.storeNames.join(', ')}
              </Text>
              <View style={[styles.depositBadge, styles.depositBadgeDone]}>
                <MaterialCommunityIcons name="bank-check" size={11} color="#166534" />
                <Text style={[styles.depositBadgeText, { color: '#166534' }]}>Depositado</Text>
              </View>
            </View>
            {isLargeScreen && (
              <Text style={styles.txStore} numberOfLines={1}>{item.storeNames.join(', ')}</Text>
            )}
            {isLargeScreen && (
              <View style={styles.txDateWrap}>
                <Text style={styles.txDate}>{fmtD(item.date)}</Text>
              </View>
            )}
            <View style={{ alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
              <View style={styles.txAmtWrap}>
                <Text style={[styles.txAmt, { color: COLOR.income }]}>+{amtStr}</Text>
                <Text style={styles.txAmtLabel}>LEMPIRAS</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {imageUri ? (
                  <TouchableOpacity onPress={() => setViewingImage(imageUri)} activeOpacity={0.8}>
                    <Image source={{ uri: imageUri }} style={{ width: 36, height: 36, borderRadius: 4, borderWidth: 1, borderColor: COLOR.border }} />
                  </TouchableOpacity>
                ) : (
                  <View style={{ width: 36 }} />
                )}
                <View style={{ width: 36 }} />
                <View style={{ width: 36 }} />
              </View>
            </View>
          </View>
        </View>
      );
    }

    const isIncome = INCOME_TYPES.includes(item.type);

    const typeIconMap: Record<string, string> = {
      CLOSING:    'home',
      income:     'arrow-down-circle',
      SUPPLIER:   'truck-delivery',
      SALARY:     'account-cash',
      GASTO_ADMIN:'bank',
      expense:    'arrow-up-circle',
      gasto_admin:'bank',
    };
    const txIcon = typeIconMap[item.type] ?? 'help-circle';
    const txColor = isIncome ? COLOR.income : COLOR.expense;
    const txBg    = isIncome ? COLOR.incomeTint : COLOR.expenseTint;

    const dateToShow = item.type === 'CLOSING' && item.depositDate ? item.depositDate
      : item.type === 'SUPPLIER' && item.paymentDate ? item.paymentDate
      : item.type === 'SALARY'   && item.depositDate ? item.depositDate
      : item.date;

    // Hora real de la operación: solo disponible para cierres vinculados a un turno
    // (shiftClosedAt es un LocalDateTime con hora de Honduras). El resto de los tipos
    // solo tienen fecha (sin hora), así que no mostramos hora para ellos.
    const timeToShow = item.type === 'CLOSING' && item.shiftClosedAt
      ? item.shiftClosedAt
      : dateToShow;

    const fmtDate = (d?: string) => {
      if (!d) return '—';
      try {
        const dt = parseISO(d);
        return format(dt, 'dd MMM yyyy');
      } catch { return String(d).split('T')[0]; }
    };
    const fmtTime = (d?: string) => {
      if (!d || !d.includes('T')) return '';
      try { return format(parseISO(d), 'HH:mm'); } catch { return ''; }
    };

    const storeIdResolved = item.store?.id ?? item.storeId;
    const storeName =
      item.store?.name ||
      item.storeName ||
      activeStores.find(s => s.id === storeIdResolved)?.name ||
      '—';

    // Para CLOSING con turno vinculado, construimos una descripción significativa
    const metaParts = item.type === 'CLOSING' && item.shiftId != null
      ? [
          item.shiftCode ?? null,
          item.salesCount != null ? `${item.salesCount} venta${item.salesCount !== 1 ? 's' : ''}` : null,
          item.shiftOpenedAt && item.shiftClosedAt
            ? `${fmtTime(item.shiftOpenedAt)} → ${fmtTime(item.shiftClosedAt)}`
            : null,
          item.username ?? null,
        ].filter(Boolean)
      : [
          item.closingsCount ? `${item.closingsCount} cierres` : null,
          item.periodStart ? `Periodo ${fmtDate(item.periodStart)}` : null,
          item.supplier || null,
          item.description || null,
        ].filter(Boolean);

    // Para CLOSING con turno vinculado, el monto mostrado es lo que hay que depositar
    // (efectivo contado - fondo inicial), no la venta total (que incluye tarjeta/recargo).
    // La cajera declara solo el efectivo de ventas (fondo excluido),
    // por lo que el monto a depositar es directamente lo que declaró.
    const displayAmount = (item.type === 'CLOSING' && item.shiftId != null
      && item.declaredCashAmount != null)
      ? item.declaredCashAmount
      : item.amount;

    const amtStr = `L ${displayAmount.toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const rawUri = item.imageUri || (item as any).image_uri;
    const imageUri = rawUri && rawUri !== 'null' && rawUri !== 'undefined' && rawUri.startsWith('http') ? rawUri : null;

    return (
      <View key={`tx-${item.id}-${index}`} style={{ backgroundColor: COLOR.surface, borderBottomWidth: 1, borderBottomColor: COLOR.border }}>
      <View style={[styles.txRow, { borderBottomWidth: 0 }]}>
        {/* Icono */}
        <View style={[styles.txIconWrap, { backgroundColor: txBg }]}>
          <MaterialCommunityIcons name={txIcon} size={20} color={txColor} />
        </View>

        {/* Nombre + badge + metadata — ocupa todo el ancho disponible */}
        <View style={styles.txMain}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
            <Text style={styles.txName}>{TRANSACTION_LABELS[item.type]}</Text>
            <View style={[styles.txBadge, { backgroundColor: txBg }]}>
              <Text style={[styles.txBadgeText, { color: txColor }]}>{TRANSACTION_LABELS[item.type]}</Text>
            </View>
          </View>
          {!isLargeScreen && (
            <Text style={styles.txMeta}>
              {fmtDate(dateToShow)}{fmtTime(timeToShow) ? ` · ${fmtTime(timeToShow)}` : ''}
            </Text>
          )}
          {metaParts.length > 0 && (
            <Text style={styles.txMeta} numberOfLines={1}>{metaParts.join(' · ')}</Text>
          )}
          {/* Flag de depósito — solo para CLOSING */}
          {item.type === 'CLOSING' && (
            <View style={[
              styles.depositBadge,
              item.depositStatus === 'DEPOSITED' ? styles.depositBadgeDone : styles.depositBadgePending
            ]}>
              <MaterialCommunityIcons
                name={item.depositStatus === 'DEPOSITED' ? 'bank-check' : 'bank-outline'}
                size={11}
                color={item.depositStatus === 'DEPOSITED' ? '#166534' : '#92400E'}
              />
              <Text style={[
                styles.depositBadgeText,
                { color: item.depositStatus === 'DEPOSITED' ? '#166534' : '#92400E' }
              ]}>
                {item.depositStatus === 'DEPOSITED' ? 'Depositado' : 'Sin depositar'}
              </Text>
            </View>
          )}
        </View>

        {/* Local (solo desktop) */}
        {isLargeScreen && (
          <Text style={styles.txStore} numberOfLines={1}>{storeName}</Text>
        )}

        {/* Fecha — solo desktop */}
        {isLargeScreen && (
          <View style={styles.txDateWrap}>
            <Text style={styles.txDate}>{fmtDate(dateToShow)}</Text>
            <Text style={styles.txTime}>{fmtTime(timeToShow)}</Text>
          </View>
        )}

        {/* Columna derecha: monto + acciones apilados */}
        <View style={{ alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
          <View style={styles.txAmtWrap}>
            <Text style={[styles.txAmt, { color: txColor }]}>
              {isIncome ? '+' : '-'}{amtStr}
            </Text>
            <Text style={styles.txAmtLabel}>LEMPIRAS</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {imageUri ? (
              <TouchableOpacity onPress={() => setViewingImage(imageUri)} activeOpacity={0.8}>
                <Image
                  source={{ uri: imageUri }}
                  style={{ width: 36, height: 36, borderRadius: 4, borderWidth: 1, borderColor: COLOR.border }}
                />
              </TouchableOpacity>
            ) : (
              <View style={{ width: 36 }} />
            )}
            <IconButton icon="pencil" size={16} onPress={() => handleEdit(item)} iconColor={COLOR.info} style={{ margin: 0 }} />
            <IconButton icon="delete" size={16} onPress={() => handleDelete(item)} iconColor={COLOR.expense} style={{ margin: 0 }} />
          </View>
        </View>

      </View>{/* fin txRow */}

        {/* ── Panel de detalle del turno (solo CLOSING con shiftId) ── */}
        {item.type === 'CLOSING' && item.shiftId != null && (() => {
          const isOpen = expandedClosings[item.id];
          const diff = item.cashDifference ?? 0;
          const isOk = Math.abs(diff) < 0.01;
          const diffColor = isOk ? COLOR.income : diff > 0 ? COLOR.info : COLOR.expense;
          const diffIcon  = isOk ? 'check-circle' : diff > 0 ? 'arrow-up-circle' : 'alert-circle';
          const diffLabel = isOk ? 'Caja cuadrada' : diff > 0 ? 'Sobrante' : 'Faltante';
          return (
            <View style={styles.closingDetailWrap}>
              {/* Toggle */}
              <TouchableOpacity style={styles.closingDetailToggle} onPress={() => toggleClosingDetail(item.id)}>
                <MaterialCommunityIcons
                  name={isOk ? 'check-circle-outline' : diff < 0 ? 'alert-circle-outline' : 'information-outline'}
                  size={14} color={diffColor}
                />
                <Text style={[styles.closingDetailToggleText, { color: diffColor }]}>
                  {diffLabel}{!isOk ? ` ${diff > 0 ? '+' : ''}L ${Math.abs(diff).toFixed(2)}` : ''}
                </Text>
                <MaterialCommunityIcons name={isOpen ? 'chevron-up' : 'chevron-down'} size={14} color={COLOR.inkMute} style={{ marginLeft: 'auto' }} />
              </TouchableOpacity>

              {/* Detalle expandido */}
              {isOpen && (
                <View style={styles.closingDetailBox}>
                  {/* Turno */}
                  <Text style={styles.closingDetailSection}>Turno</Text>
                  <View style={styles.closingDetailRow}>
                    <Text style={styles.closingDetailLabel}>Código</Text>
                    <Text style={styles.closingDetailValue}>{item.shiftCode ?? '—'}</Text>
                  </View>
                  <View style={styles.closingDetailRow}>
                    <Text style={styles.closingDetailLabel}>Horario</Text>
                    <Text style={styles.closingDetailValue}>
                      {item.shiftOpenedAt ? fmtTime(item.shiftOpenedAt) : '—'}
                      {' → '}
                      {item.shiftClosedAt ? fmtTime(item.shiftClosedAt) : '—'}
                    </Text>
                  </View>
                  <View style={styles.closingDetailRow}>
                    <Text style={styles.closingDetailLabel}>Ventas registradas</Text>
                    <Text style={styles.closingDetailValue}>{item.salesCount ?? '—'}</Text>
                  </View>

                  {/* Reconciliación */}
                  <Text style={[styles.closingDetailSection, { marginTop: 8 }]}>Reconciliación de caja</Text>
                  <View style={styles.closingDetailRow}>
                    <Text style={styles.closingDetailLabel}>Fondo inicial</Text>
                    <Text style={styles.closingDetailValue}>L {(item.openingCashAmount ?? 0).toFixed(2)}</Text>
                  </View>
                  <View style={styles.closingDetailRow}>
                    <Text style={[styles.closingDetailLabel, { color: COLOR.income }]}>Ventas efectivo</Text>
                    <Text style={[styles.closingDetailValue, { color: COLOR.income }]}>L {(item.totalCashSales ?? 0).toFixed(2)}</Text>
                  </View>
                  {(item.totalCardSales ?? 0) > 0 && (
                    <View style={styles.closingDetailRow}>
                      <Text style={[styles.closingDetailLabel, { color: COLOR.info }]}>Ventas tarjeta</Text>
                      <Text style={[styles.closingDetailValue, { color: COLOR.info }]}>L {(item.totalCardSales ?? 0).toFixed(2)}</Text>
                    </View>
                  )}
                  {(item.totalShiftExpenses ?? 0) > 0 && (
                    <View style={styles.closingDetailRow}>
                      <Text style={[styles.closingDetailLabel, { color: COLOR.expense }]}>Egresos del turno</Text>
                      <Text style={[styles.closingDetailValue, { color: COLOR.expense }]}>− L {(item.totalShiftExpenses ?? 0).toFixed(2)}</Text>
                    </View>
                  )}
                  <View style={[styles.closingDetailRow, { borderTopWidth: 1, borderTopColor: COLOR.border, paddingTop: 4, marginTop: 4 }]}>
                    <Text style={[styles.closingDetailLabel, { fontWeight: FONT_WEIGHT.bold as any }]}>Total esperado</Text>
                    <Text style={[styles.closingDetailValue, { fontWeight: FONT_WEIGHT.bold as any }]}>
                      L {((item.openingCashAmount ?? 0) + (item.totalCashSales ?? 0) - (item.totalShiftExpenses ?? 0)).toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.closingDetailRow}>
                    <Text style={styles.closingDetailLabel}>Efectivo contado</Text>
                    <Text style={styles.closingDetailValue}>L {(item.declaredCashAmount ?? 0).toFixed(2)}</Text>
                  </View>
                  <View style={[styles.closingDetailRow, { marginTop: 4 }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <MaterialCommunityIcons name={diffIcon} size={14} color={diffColor} />
                      <Text style={[styles.closingDetailLabel, { color: diffColor, fontWeight: FONT_WEIGHT.bold as any }]}>{diffLabel}</Text>
                    </View>
                    <Text style={[styles.closingDetailValue, { color: diffColor, fontWeight: FONT_WEIGHT.bold as any }]}>
                      {isOk ? '—' : `${diff > 0 ? '+' : ''}L ${Math.abs(diff).toFixed(2)}`}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          );
        })()}
      </View>
    );
  };

  const renderPagination = () => (
    <View style={styles.paginationContainer}>
      <TouchableOpacity
        onPress={() => setCurrentPage(p => Math.max(1, p - 1))}
        disabled={currentPage === 1}
        style={[styles.paginationButton, currentPage === 1 && styles.disabledButton]}
      >
        <MaterialCommunityIcons
          name="chevron-left"
          size={24}
          color={currentPage === 1 ? COLOR.inkDisabled : COLOR.info}
        />
      </TouchableOpacity>
      {pageNumbers.map((page) => (
        <TouchableOpacity
          key={page}
          onPress={() => setCurrentPage(page)}
          style={[styles.paginationButton, currentPage === page && styles.activeButton]}
        >
          <Text style={[styles.paginationText, currentPage === page && styles.activeText]}>
            {page}
          </Text>
        </TouchableOpacity>
      ))}
      <TouchableOpacity
        onPress={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
        disabled={currentPage === totalPages}
        style={[styles.paginationButton, currentPage === totalPages && styles.disabledButton]}
      >
        <MaterialCommunityIcons
          name="chevron-right"
          size={24}
          color={currentPage === totalPages ? COLOR.inkDisabled : COLOR.info}
        />
      </TouchableOpacity>
    </View>
  );

  // Estilos locales para el header (inputs de fecha y balance)
  const headerContainerStyle = [
    styles.headerContainer,
    isLargeScreen
      ? ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' } as ViewStyle)
      : ({ flexDirection: 'column' } as ViewStyle),
  ];
  const dateInputsContainerStyle = [
    styles.dateInputsContainer,
    isLargeScreen
      ? ({ flexDirection: 'row', width: '50%', justifyContent: 'space-between' } as ViewStyle)
      : {},
  ];
  const dateInputStyle: ViewStyle[] = [
    styles.dateInput,
    isLargeScreen ? { flex: 0.48 } : {}
  ];

  return (
    <ThemedView style={styles.container}>

      {/* ── CABECERA MOBILE: siempre visible ── */}
      {!isLargeScreen && (
        <View style={{ backgroundColor: COLOR.surface, borderBottomWidth: 1, borderBottomColor: COLOR.border }}>
          {/* Fila: título + botón colapsar */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6 }}>
            <ThemedText style={[styles.title, { marginBottom: 0 }]}>Operaciones</ThemedText>
            <Button
              mode="outlined"
              onPress={() => setFiltersExpanded(v => !v)}
              textColor={COLOR.ink2}
              style={{ borderColor: COLOR.border, minWidth: 0 }}
              labelStyle={{ fontSize: 12 }}
            >
              {filtersExpanded ? 'Cerrar ▲' : 'Filtros ▼'}
            </Button>
          </View>

          {/* Filtro tipo: siempre visible */}
          <View style={{ flexDirection: 'row', marginHorizontal: 12, marginBottom: 8, borderRadius: RADIUS.r2, overflow: 'hidden', borderWidth: 1, borderColor: COLOR.border }}>
            {([
              { key: 'all',     label: 'Todos',    count: allCount },
              { key: 'income',  label: 'Ingresos', count: incomeCount },
              { key: 'expense', label: 'Egresos',  count: expenseCount },
            ] as const).map(({ key, label, count }) => (
              <TouchableOpacity
                key={key}
                onPress={() => { setTypeFilter(key); setCurrentPage(1); }}
                style={[styles.tabBtn, typeFilter === key && styles.tabBtnActive]}
              >
                <Text style={[styles.tabBtnText, typeFilter === key && styles.tabBtnTextActive]}>
                  {label}
                </Text>
                <Text style={[styles.tabBtnCount, typeFilter === key && styles.tabBtnCountActive]}>
                  {count}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Filtros colapsables con scroll */}
          {filtersExpanded && (
            <ScrollView
              style={{ maxHeight: 320 }}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.mobileControlsContainer}>
                <CompactDateFilters
                  startDate={startDate}
                  endDate={endDate}
                  selectedStore={selectedStore}
                  setStartDate={setStartDate}
                  setEndDate={setEndDate}
                  setSelectedStore={setSelectedStore}
                  fetchData={fetchData}
                  setDatePickerOpen={setDatePickerOpen}
                  setSelectedDateInput={setSelectedDateInput}
                  onExcelPress={() => setShowExcelManager(true)}
                  showAdminExpenses={showAdminExpenses}
                  onToggleAdminExpenses={handleToggleAdminExpenses}
                  activeStores={activeStores}
                  depositFilter={depositFilter}
                  setDepositFilter={(f) => { setDepositFilter(f); setCurrentPage(1); }}
                />
                <BalanceCard transactions={filteredByDeposit} />
              </View>
            </ScrollView>
          )}
        </View>
      )}

      {/* ── DESKTOP ── */}
      {isLargeScreen && (
        <View style={{ backgroundColor: COLOR.surface, borderBottomWidth: 1, borderBottomColor: COLOR.border }}>
          {/* Fila: título + filtro tipo + botón colapsar */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, gap: 12 }}>
            <ThemedText style={[styles.title, { marginBottom: 0 }]}>Todas las Operaciones.</ThemedText>

            {/* Filtro Todos/Ingresos/Egresos */}
            <View style={{ flexDirection: 'row', borderRadius: RADIUS.r2, overflow: 'hidden', borderWidth: 1, borderColor: COLOR.border }}>
              {([
                { key: 'all',     label: 'Todos',    count: allCount },
                { key: 'income',  label: 'Ingresos', count: incomeCount },
                { key: 'expense', label: 'Egresos',  count: expenseCount },
              ] as const).map(({ key, label, count }) => (
                <TouchableOpacity
                  key={key}
                  onPress={() => { setTypeFilter(key); setCurrentPage(1); }}
                  style={[styles.tabBtn, typeFilter === key && styles.tabBtnActive]}
                >
                  <Text style={[styles.tabBtnText, typeFilter === key && styles.tabBtnTextActive]}>
                    {label}
                  </Text>
                  <Text style={[styles.tabBtnCount, typeFilter === key && styles.tabBtnCountActive]}>
                    {count}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Button
              mode="outlined"
              onPress={() => setFiltersExpanded(v => !v)}
              textColor={COLOR.ink2}
              style={{ borderColor: COLOR.border }}
              labelStyle={{ fontSize: 13 }}
            >
              {filtersExpanded ? 'Cerrar ▲' : 'Filtros ▼'}
            </Button>
          </View>

          {/* Filtros colapsables */}
          {filtersExpanded && (
            <View style={styles.controlsContainer}>
              <CompactDateFilters
                startDate={startDate}
                endDate={endDate}
                selectedStore={selectedStore}
                setStartDate={setStartDate}
                setEndDate={setEndDate}
                setSelectedStore={setSelectedStore}
                fetchData={fetchData}
                setDatePickerOpen={setDatePickerOpen}
                setSelectedDateInput={setSelectedDateInput}
                onExcelPress={() => setShowExcelManager(true)}
                showAdminExpenses={showAdminExpenses}
                onToggleAdminExpenses={handleToggleAdminExpenses}
                activeStores={activeStores}
                depositFilter={depositFilter}
                setDepositFilter={(f) => { setDepositFilter(f); setCurrentPage(1); }}
              />
              <BalanceCard transactions={filteredByDeposit} />
            </View>
          )}
        </View>
      )}

      {/* ── KPI stats row — solo desktop, dentro del panel de Filtros (mobile va dentro del scroll) ── */}
      {!loading && isLargeScreen && filtersExpanded && <KpiRow transactions={transactions} />}

      {/* ── Tabla header (solo desktop) ── */}
      {!loading && isLargeScreen && (
        <View style={styles.txTableHeader}>
          <View style={{ width: 40 }} />
          <Text style={[styles.txTableHeaderText, { flex: 2 }]}>OPERACIÓN</Text>
          <Text style={[styles.txTableHeaderText, { flex: 1 }]}>LOCAL</Text>
          <Text style={[styles.txTableHeaderText, { flex: 1, textAlign: 'right' }]}>FECHA</Text>
          <Text style={[styles.txTableHeaderText, { flex: 1, textAlign: 'right' }]}>MONTO</Text>
          <View style={{ width: 80 }} />
        </View>
      )}

      {/* Indicador sutil cuando hay datos previos y se está actualizando */}
      {refreshing && (
        <View style={{ paddingVertical: 6, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <ActivityIndicator size="small" color={COLOR.brand} />
          <Text style={{ fontSize: 12, color: COLOR.inkMute }}>Actualizando...</Text>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLOR.brand} />
          <ThemedText style={styles.loadingText}>
            Cargando datos desde la base de datos...
          </ThemedText>
        </View>
      ) : (
        <ScrollView style={styles.scrollView}>
          {/* KPI cards en mobile dentro del scroll — solo si el panel de Filtros está expandido */}
          {!isLargeScreen && filtersExpanded && <KpiRow transactions={transactions} />}
          {paginatedTransactions.length === 0 ? (
            <ThemedText style={styles.noDataText}>No hay transacciones para mostrar</ThemedText>
          ) : (
            <>
              {paginatedTransactions.map((item, index) => renderTransaction(item, index))}
            </>
          )}
        </ScrollView>
      )}

      <View style={styles.fixedPaginationContainer}>{renderPagination()}</View>

      <DatePickerModal
        locale="es"
        mode="single"
        visible={datePickerOpen}
        onDismiss={onDismissDatePicker}
        date={selectedDateInput === 'start' ? startDate : endDate}
        onConfirm={onConfirmDate}
        label={selectedDateInput === 'start' ? 'Fecha desde' : 'Fecha hasta'}
        saveLabel="Confirmar"
        animationType="fade"
      />

      {/* Modal para editar la transacción */}
      <Modal
        visible={editModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={handleCancelEdit}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <ThemedText style={styles.modalTitle}>Editar Transacción</ThemedText>
            <TextInput
              label="Tipo"
              value={
                editingTransaction && editingTransaction.type
                  ? TRANSACTION_LABELS[editingTransaction.type]
                  : ''
              }
              disabled
              style={styles.modalInput}
            />
            {renderEditFields()}
            <View style={styles.modalButtonContainer}>
              <Button
                onPress={handleCancelEdit}
                mode="outlined"
                style={styles.modalButton}
                textColor={COLOR.ink2}
              >
                Cancelar
              </Button>
              <Button
                onPress={handleSaveEdit}
                mode="contained"
                style={styles.modalButton}
                buttonColor={COLOR.brand}
                textColor={COLOR.inkOnBrand}
              >
                Guardar
              </Button>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de confirmación para eliminación */}
      <Modal
        visible={showDeleteConfirmation}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDeleteConfirmation(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <ThemedText style={styles.modalTitle}>Confirmar Eliminación</ThemedText>
            <Text style={styles.confirmationText}>
              ¿Estás seguro de que deseas eliminar esta transacción?
            </Text>
            <View style={styles.modalButtonContainer}>
              <Button onPress={() => setShowDeleteConfirmation(false)} mode="outlined" style={styles.modalButton} textColor={COLOR.ink2}>
                Cancelar
              </Button>
              <Button onPress={confirmDelete} mode="contained" style={styles.modalButton} buttonColor={COLOR.expense} textColor={COLOR.white}>
                Eliminar
              </Button>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de gestión de Excel */}
      <ExcelManager
        visible={showExcelManager}
        onDismiss={() => setShowExcelManager(false)}
        transactions={transactions}
        onImportSuccess={handleImportSuccess}
      />

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
        style={styles.snackbar}
      >
        {snackbarMessage}
      </Snackbar>

      {/* ── Modal visor de comprobante ── */}
      <Modal
        visible={!!viewingImage}
        transparent
        animationType="fade"
        onRequestClose={() => setViewingImage(null)}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' }}
          activeOpacity={1}
          onPress={() => setViewingImage(null)}
        >
          {viewingImage && (
            <Image
              source={{ uri: viewingImage }}
              style={{ width: '90%', height: '75%', resizeMode: 'contain', borderRadius: 8 }}
            />
          )}
          <Text style={{ color: '#fff', marginTop: 16, fontSize: 13, opacity: 0.7 }}>
            Tocá para cerrar
          </Text>
        </TouchableOpacity>
      </Modal>
      <DatePickerModal
        locale="es"
        mode="single"
        visible={datePickerEditVisible}
        onDismiss={() => setDatePickerEditVisible(false)}
        date={(() => {
          try {
            if (dateEditField === 'date' && newDate) {
              return parseISO(newDate);
            } else if (dateEditField === 'periodStart' && newPeriodStart) {
              return parseISO(newPeriodStart);
            } else if (dateEditField === 'periodEnd' && newPeriodEnd) {
              return parseISO(newPeriodEnd);
            }
            return new Date();
          } catch (error) {
            console.error('Error parsing date:', error);
            return new Date();
          }
        })()}
        onConfirm={onConfirmEditDate}
        label="Seleccionar fecha"
        saveLabel="Confirmar"
        animationType="fade"
      />
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 0,
    backgroundColor: COLOR.bg,
  },
  title: {
    fontSize: FONT_SIZE.h1,
    fontWeight: FONT_WEIGHT.bold as any,
    marginVertical: SPACE.s3,
    textAlign: 'center',
    color: COLOR.ink,
  },
  // Estilos para la vista de escritorio (originales)
  headerContainer: {
    padding: SPACE.s4,
    marginTop: -10,
  },
  dateInputsContainer: {
    backgroundColor: COLOR.surface,
    borderRadius: RADIUS.r2,
    padding: SPACE.s4,
    elevation: 3,
    marginBottom: SPACE.s4,
  },
  dateInput: {
    backgroundColor: COLOR.surface,
    marginBottom: SPACE.s3,
    flex: 1,
    marginHorizontal: 5,
  },
  refreshButton: {
    borderRadius: RADIUS.full,
    marginTop: 5,
    marginBottom: 10,
    elevation: 2,
    marginRight: SPACE.s2,
  },
  clearButton: {
    marginTop: 5,
    borderColor: COLOR.brand,
    marginRight: SPACE.s2,
  },
  excelButton: {
    borderRadius: RADIUS.full,
    marginTop: 5,
    marginBottom: 10,
    elevation: 2,
  },

  // Estilos para la vista móvil (nuevos, compactos)
  controlsContainer: {
    padding: SPACE.s3,
    marginBottom: 5,
  },
  mobileControlsContainer: {
    padding: SPACE.s3,
    marginBottom: 5,
  },
  compactFiltersContainer: {
    backgroundColor: COLOR.surface,
    borderRadius: RADIUS.r2,
    padding: SPACE.s3,
    elevation: 3,
    marginBottom: SPACE.s3,
  },
  compactDateInputs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACE.s2,
  },
  compactDateInput: {
    flex: 1,
    marginHorizontal: 4,
    height: 50,
    backgroundColor: COLOR.surface,
    fontSize: FONT_SIZE.body,
    minWidth: 130,
  },
  compactButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  compactClearButton: {
    flex: 1,
    marginRight: 5,
    borderColor: COLOR.brand,
    height: 36,
  },
  compactRefreshButton: {
    flex: 1,
    marginLeft: 5,
    marginRight: 5,
    borderRadius: RADIUS.full,
    height: 36,
  },
  compactExcelButton: {
    flex: 1,
    marginLeft: 5,
    borderRadius: RADIUS.full,
    height: 36,
  },
  compactAdminButton: {
    flex: 1,
    marginLeft: 5,
    marginRight: 5,
    borderRadius: RADIUS.full,
    height: 36,
    borderColor: COLOR.warn,
  },

  // Estilos para la selección de local
  storeFilterContainer: {
    marginBottom: SPACE.s3,
  },
  storeFilterCompact: {
    marginBottom: SPACE.s2,
  },
  filtersContainer: {
    width: '100%',
  },
  storeFilterWeb: {
    flex: 2,
    marginHorizontal: 10,
  },
  filtersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACE.s2,
  },
  filtersRowWeb: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: SPACE.s3,
  },
  inputGroupWeb: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 3,
    gap: SPACE.s3,
  },
  buttonGroupWeb: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flex: 2,
    gap: SPACE.s3,
  },
  dateFiltersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACE.s3,
  },
  filterLabel: {
    fontSize: FONT_SIZE.label,
    fontWeight: FONT_WEIGHT.bold as any,
    marginBottom: 5,
    color: COLOR.ink2,
  },
  storeSelector: {
    marginBottom: 5,
  },
  storeSelectorCompact: {
    transform: [{ scale: 0.95 }],
  },
  buttonGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 5,
  },

  // Estilos para el BalanceCard colapsable
  balanceCard: {
    borderRadius: RADIUS.r2,
    elevation: 3,
    marginBottom: SPACE.s3,
    overflow: 'hidden',
    backgroundColor: COLOR.surface,
  },
  balanceHeaderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACE.s4,
    paddingVertical: SPACE.s2,
    backgroundColor: COLOR.surface2,
  },
  balanceContentContainer: {
    overflow: 'hidden',
    paddingHorizontal: SPACE.s4,
  },
  balanceTitle: {
    fontSize: FONT_SIZE.h2,
    color: COLOR.ink,
    fontWeight: FONT_WEIGHT.bold as any,
    marginBottom: 5,
    textAlign: 'center',
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    paddingHorizontal: SPACE.s3,
    paddingVertical: 5,
  },
  balanceLabel: {
    fontSize: FONT_SIZE.h3,
    color: COLOR.ink,
    marginLeft: SPACE.s2,
    flex: 1,
  },
  balanceValue: {
    fontSize: FONT_SIZE.h3,
    color: COLOR.ink,
    fontWeight: FONT_WEIGHT.medium as any,
  },

  // Estilos para la lista de transacciones
  scrollView: {
    padding: 0,
    flex: 1,
  },
  transactionCard: {
    marginBottom: SPACE.s4,
    borderRadius: RADIUS.r2,
    elevation: 3,
    backgroundColor: COLOR.surface,
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACE.s3,
    paddingBottom: SPACE.s3,
    borderBottomWidth: 1,
    borderBottomColor: COLOR.border,
  },
  transactionTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  transactionType: {
    fontSize: FONT_SIZE.h3,
    fontWeight: FONT_WEIGHT.bold as any,
    marginLeft: SPACE.s2,
  },
  transactionAmount: {
    fontSize: FONT_SIZE.h2,
    fontWeight: FONT_WEIGHT.bold as any,
    color: COLOR.ink,
  },
  transactionDetails: {
    marginBottom: SPACE.s4,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  detailText: {
    fontSize: FONT_SIZE.label,
    color: COLOR.ink2,
    marginLeft: SPACE.s2,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACE.s3,
  },
  editButton: {
    flex: 1,
    marginRight: 5,
    borderRadius: RADIUS.full,
  },
  deleteButton: {
    flex: 1,
    marginLeft: 5,
    borderRadius: RADIUS.full,
  },

  // Estilos para el modal
  modalOverlay: {
    flex: 1,
    backgroundColor: COLOR.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '92%',
    maxWidth: 560,
    backgroundColor: COLOR.surface,
    borderRadius: RADIUS.r4,
    padding: SPACE.s5,
    maxHeight: '85%',
    ...SHADOW.lg,
  },
  modalTitle: {
    fontSize: FONT_SIZE.h2,
    fontWeight: FONT_WEIGHT.bold as any,
    marginBottom: SPACE.s5,
    textAlign: 'center',
    color: COLOR.ink,
    borderBottomWidth: 1,
    borderBottomColor: COLOR.border,
    paddingBottom: SPACE.s3,
  },
  modalInput: {
    marginBottom: SPACE.s3,
    backgroundColor: COLOR.surface,
  },
  modalButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACE.s5,
    gap: SPACE.s3,
  },
  modalButton: {
    flex: 1,
    borderRadius: RADIUS.r2,
  },
  modalInputContainer: {
    marginBottom: SPACE.s3,
  },
  modalInputLabel: {
    fontSize: FONT_SIZE.label,
    fontWeight: FONT_WEIGHT.bold as any,
    marginBottom: 5,
    color: COLOR.ink2,
  },

  // Estilos para la paginación
  fixedPaginationContainer: {
    paddingVertical: SPACE.s3,
    backgroundColor: COLOR.bg,
    borderTopWidth: 1,
    borderTopColor: COLOR.border,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  paginationButton: {
    marginHorizontal: 3,
    minWidth: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: RADIUS.r4,
    backgroundColor: COLOR.surface,
    borderWidth: 1,
    borderColor: COLOR.border2,
    elevation: 2,
  },
  paginationText: {
    fontSize: FONT_SIZE.h3,
    color: COLOR.ink2,
  },
  activeButton: {
    backgroundColor: COLOR.info,
    borderColor: COLOR.info,
  },
  activeText: {
    color: COLOR.white,
    fontWeight: FONT_WEIGHT.bold as any,
  },
  disabledButton: {
    opacity: 0.5,
  },

  // Otros estilos
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACE.s5,
  },
  loadingText: {
    marginTop: SPACE.s4,
    fontSize: FONT_SIZE.h3,
    color: COLOR.brand,
    textAlign: 'center',
  },
  noDataText: {
    fontSize: FONT_SIZE.h2,
    textAlign: 'center',
    marginVertical: 40,
    color: COLOR.inkMute,
  },
  confirmationText: {
    fontSize: FONT_SIZE.h3,
    textAlign: 'center',
    marginBottom: SPACE.s5,
    color: COLOR.ink2,
    lineHeight: 24,
  },
  snackbar: {
    backgroundColor: COLOR.ink,
    borderRadius: RADIUS.r2,
  },
  imageContainer: {
    marginTop: SPACE.s3,
    paddingTop: SPACE.s3,
    borderTopWidth: 1,
    borderTopColor: COLOR.border,
  },
  imageLabel: {
    fontSize: FONT_SIZE.label,
    fontWeight: FONT_WEIGHT.bold as any,
    marginBottom: 5,
    color: COLOR.brandDeep,
  },
  transactionImage: {
    width: '100%',
    height: 200,
    borderRadius: RADIUS.r1,
    resizeMode: 'contain',
    backgroundColor: COLOR.bg,
    borderWidth: 1,
    borderColor: COLOR.border,
  },

  // ── KPI Row ───────────────────────────────────────────────────────────────
  kpiRow:         { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.s2, padding: SPACE.s3, backgroundColor: COLOR.bg },
  kpiCard:        { flexBasis: '47%', flexGrow: 1, backgroundColor: COLOR.surface, borderRadius: RADIUS.r3, borderWidth: 1, borderColor: COLOR.border, padding: SPACE.s3, gap: 2, ...SHADOW.sm },
  kpiCardLabel:   { fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.semibold as any, color: COLOR.inkMute, letterSpacing: 0.4 },
  kpiCardValue:   { fontSize: FONT_SIZE.h3, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.ink, letterSpacing: -0.5 },
  kpiCardSub:     { fontSize: FONT_SIZE.caption, color: COLOR.inkMute },

  // ── Filter tabs con conteo ─────────────────────────────────────────────────
  tabBtn:           { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: SPACE.s2, backgroundColor: COLOR.bgAlt },
  tabBtnActive:     { backgroundColor: COLOR.surface },
  tabBtnText:       { fontSize: FONT_SIZE.label, fontWeight: FONT_WEIGHT.semibold as any, color: COLOR.inkMute },
  tabBtnTextActive: { color: COLOR.ink, fontWeight: FONT_WEIGHT.bold as any },
  tabBtnCount:      { fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.semibold as any, color: COLOR.inkDisabled },
  tabBtnCountActive:{ color: COLOR.ink2 },

  // ── Tabla header ──────────────────────────────────────────────────────────
  txTableHeader:     { flexDirection: 'row', alignItems: 'center', gap: SPACE.s3, paddingHorizontal: SPACE.s4, paddingVertical: SPACE.s2, backgroundColor: COLOR.surface2, borderBottomWidth: 1, borderBottomColor: COLOR.border },
  txTableHeaderText: { fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.inkMute, letterSpacing: 0.5 },

  // ── Transaction rows ──────────────────────────────────────────────────────
  txRow:       { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.s2, paddingHorizontal: SPACE.s3, paddingVertical: SPACE.s3, backgroundColor: COLOR.surface, borderBottomWidth: 1, borderBottomColor: COLOR.border },
  txIconWrap:  { width: 36, height: 36, borderRadius: RADIUS.full, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  txMain:      { flex: 1, minWidth: 0, gap: 2 },
  txName:      { fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold as any, color: COLOR.ink },
  txBadge:     { paddingHorizontal: SPACE.s2, paddingVertical: 2, borderRadius: RADIUS.full },
  txBadgeText: { fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.semibold as any },
  txMeta:           { fontSize: FONT_SIZE.caption, color: COLOR.inkMute, marginTop: 1 },
  depositBadge:     { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: RADIUS.full, alignSelf: 'flex-start', marginTop: 3 },
  depositBadgeDone: { backgroundColor: '#DCFCE7' },
  depositBadgePending: { backgroundColor: '#FEF3C7' },
  depositBadgeText: { fontSize: 10, fontWeight: FONT_WEIGHT.bold as any },
  txStore:     { flex: 1, fontSize: FONT_SIZE.label, color: COLOR.ink2, fontWeight: FONT_WEIGHT.medium as any },
  txDateWrap:  { alignItems: 'flex-end', minWidth: 80 },
  txDate:      { fontSize: FONT_SIZE.label, color: COLOR.ink },
  txTime:      { fontSize: FONT_SIZE.caption, color: COLOR.inkMute },
  txAmtWrap:   { alignItems: 'flex-end', minWidth: 80, flexShrink: 0 },
  txAmt:       { fontSize: FONT_SIZE.h3, fontWeight: FONT_WEIGHT.bold as any, letterSpacing: -0.3 },
  txAmtLabel:  { fontSize: FONT_SIZE.caption, color: COLOR.inkMute, fontWeight: FONT_WEIGHT.semibold as any },

  // ── Detalle de cierre (reconciliación de turno) ───────────────────────────
  closingDetailWrap:        { borderTopWidth: 1, borderTopColor: COLOR.border, backgroundColor: COLOR.bgAlt },
  closingDetailToggle:      { flexDirection: 'row', alignItems: 'center', gap: SPACE.s1, paddingHorizontal: SPACE.s3, paddingVertical: SPACE.s2 },
  closingDetailToggleText:  { fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.semibold as any },
  closingDetailBox:         { paddingHorizontal: SPACE.s4, paddingBottom: SPACE.s3, gap: 3 },
  closingDetailSection:     { fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.inkMute, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4 },
  closingDetailRow:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 2 },
  closingDetailLabel:       { fontSize: FONT_SIZE.caption, color: COLOR.inkMute, fontWeight: FONT_WEIGHT.medium as any },
  closingDetailValue:       { fontSize: FONT_SIZE.caption, color: COLOR.ink, fontWeight: FONT_WEIGHT.semibold as any },
});

const storeChipStyle = StyleSheet.create({
  chip:       { paddingHorizontal: SPACE.s3, paddingVertical: 6, borderRadius: RADIUS.full, backgroundColor: COLOR.bg, borderWidth: 1, borderColor: COLOR.border },
  active:     { backgroundColor: COLOR.brand, borderColor: COLOR.brandDark },
  text:       { fontSize: FONT_SIZE.label, fontWeight: FONT_WEIGHT.semibold as any, color: COLOR.ink2 },
  activeText: { color: COLOR.ink, fontWeight: FONT_WEIGHT.bold as any },
});

export default AdminScreen;
