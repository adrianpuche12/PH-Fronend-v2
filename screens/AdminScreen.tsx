import React, { useState, useCallback, useRef } from 'react';
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
import ImageButton from '../components/ImageButton';

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
  store?: {
    id: number;
    name: string;
  };
  // Nuevo campo para la URL de la imagen
  imageUri?: string;
}


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
          <MaterialCommunityIcons name="arrow-down-bold-circle-outline" size={20} color="#4CAF50" />
          <Text style={styles.balanceLabel}>Ingresos:</Text>
          <Text style={styles.balanceValue}>{formatCurrency(ingresos)}</Text>
        </View>
        <View style={styles.balanceRow}>
          <MaterialCommunityIcons name="arrow-up-bold-circle-outline" size={20} color="#F44336" />
          <Text style={styles.balanceLabel}>Egresos:</Text>
          <Text style={styles.balanceValue}>{formatCurrency(egresos)}</Text>
        </View>
        <View style={styles.balanceRow}>
          <MaterialCommunityIcons name="calculator-variant" size={20} color="#2196F3" />
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
          <MaterialCommunityIcons name="arrow-down-bold-circle-outline" size={20} color="#4CAF50" />
          <Text style={styles.balanceLabel}>Ingresos:</Text>
          <Text style={styles.balanceValue}>{formatCurrency(ingresos)}</Text>
        </View>
        <View style={styles.balanceRow}>
          <MaterialCommunityIcons name="arrow-up-bold-circle-outline" size={20} color="#F44336" />
          <Text style={styles.balanceLabel}>Egresos:</Text>
          <Text style={styles.balanceValue}>{formatCurrency(egresos)}</Text>
        </View>
        <View style={styles.balanceRow}>
          <MaterialCommunityIcons name="calculator-variant" size={20} color="#2196F3" />
          <Text style={styles.balanceLabel}>Total:</Text>
          <Text style={[styles.balanceValue, { fontWeight: 'bold' }]}>{formatCurrency(total)}</Text>
        </View>
      </Card.Content>
    </Card>
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
          {/* Fechas */}
          <TextInput
            label="Desde"
            value={formatDate(startDate)}
            mode="outlined"
            dense
            style={styles.compactDateInput}
            onFocus={() => {
              setSelectedDateInput('start');
              setDatePickerOpen(true);
            }}
            left={<TextInput.Icon icon="calendar" color="#D4A72B" size={20} />}
            outlineColor="#DDDDDD"
            activeOutlineColor="#D4A72B"
            theme={{ colors: { primary: '#D4A72B' } }}
          />
          <TextInput
            label="Hasta"
            value={formatDate(endDate)}
            mode="outlined"
            dense
            style={styles.compactDateInput}
            onFocus={() => {
              setSelectedDateInput('end');
              setDatePickerOpen(true);
            }}
            left={<TextInput.Icon icon="calendar" color="#D4A72B" size={20} />}
            outlineColor="#DDDDDD"
            activeOutlineColor="#D4A72B"
            theme={{ colors: { primary: '#D4A72B' } }}
          />
        </View>

        {/* Selector de tienda */}
        <View style={isLargeScreen ? styles.storeFilterWeb : styles.storeFilterCompact}>
          <SegmentedButtons
            value={selectedStore?.toString() || 'all'}
            onValueChange={(value) => setSelectedStore(value === 'all' ? null : Number(value))}
            buttons={[
              { value: 'all', label: 'Todos' },
              { value: '1', label: 'Danli' },
              { value: '2', label: 'El Paraiso' },
            ]}
            style={styles.storeSelectorCompact}
          />
        </View>

        {/* Botones — grid 2 columnas para que no se corten en mobile */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 4, marginTop: 4 }}>
          <Button
            mode={showAdminExpenses ? "contained" : "outlined"}
            compact
            onPress={onToggleAdminExpenses}
            style={{ flex: 1, minWidth: '45%' }}
            icon="bank"
            buttonColor={showAdminExpenses ? "#FF9800" : "transparent"}
            textColor={showAdminExpenses ? "white" : "#FF9800"}
          >
            G. Admin
          </Button>
          <Button
            mode="contained"
            compact
            onPress={() => fetchData(startDate, endDate, selectedStore)}
            style={{ flex: 1, minWidth: '45%' }}
            icon="refresh"
            buttonColor="#2196F3"
          >
            Actualizar
          </Button>
          <Button
            mode="contained"
            compact
            onPress={onExcelPress}
            style={{ flex: 1, minWidth: '45%' }}
            icon="microsoft-excel"
            buttonColor="#28a745"
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
              textColor="#D4A72B"
            >
              Limpiar
            </Button>
          )}
        </View>
      </View>
    </View>
  );
};

const AdminScreen = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [selectedDateInput, setSelectedDateInput] = useState<'start' | 'end'>('start');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedStore, setSelectedStore] = useState<number | null>(null);
  const [showAdminExpenses, setShowAdminExpenses] = useState(false);
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  // Estados para el modal de edición
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [datePickerEditVisible, setDatePickerEditVisible] = useState(false);
  const [dateEditField, setDateEditField] = useState<'date' | 'periodStart' | 'periodEnd'>('date');

  // Estado para gestión de Excel
  const [showExcelManager, setShowExcelManager] = useState(false);

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
    setLoading(true);
    try {
      let url = `${REACT_APP_API_URL}/api/operations/admin-expenses`;
      const queryParams = [];

      if (start && end) {
        const startStr = format(start, 'yyyy-MM-dd');
        const endStr = format(end, 'yyyy-MM-dd');
        queryParams.push(`startDate=${startStr}`);
        queryParams.push(`endDate=${endStr}`);
      }

      if (storeId) {
        queryParams.push(`storeId=${storeId}`);
      }

      if (queryParams.length > 0) {
        url += `?${queryParams.join('&')}`;
      }

      const response = await fetch(url);
      let adminExpensesData: Transaction[] = [];

      if (response.ok) {
        adminExpensesData = await response.json();
      }

      setTransactions(adminExpensesData);
      setCurrentPage(1);
    } catch (err) {
      console.error('Error al cargar los gastos administrativos:', err);
    } finally {
      setLoading(false);
    }
  };

  // Función para obtener datos de dos endpoints y unificarlos.
  const fetchData = async (start?: Date, end?: Date, storeId?: number | null) => {
    setLoading(true);
    try {
      // Se obtienen las operaciones desde el endpoint de operaciones.
      let urlOperations = `${REACT_APP_API_URL}/api/operations/all`;
      const queryParams = [];

      if (start && end) {
        const startStr = format(start, 'yyyy-MM-dd');
        const endStr = format(end, 'yyyy-MM-dd');
        queryParams.push(`startDate=${startStr}`);
        queryParams.push(`endDate=${endStr}`);
      }

      if (storeId) {
        queryParams.push(`storeId=${storeId}`);
      }

      if (queryParams.length > 0) {
        urlOperations += `?${queryParams.join('&')}`;
      }

      const responseOps = await fetch(urlOperations);
      let operationsData: Transaction[] = [];

      if (responseOps.ok) {
        operationsData = await responseOps.json();
        operationsData = operationsData.map(op => {
          const newOp = { ...op };

          if (op.type === 'CLOSING' && op.depositDate) {
            newOp.date = op.depositDate;
          } else if (op.type === 'SUPPLIER' && op.paymentDate) {
            newOp.date = op.paymentDate;
          } else if (op.type === 'SALARY' && op.salaryDate) {
            newOp.date = op.salaryDate;
          }
          return newOp;
        });
      }

      let urlTransactions = `${REACT_APP_API_URL}/transactions`;
      const transactionParams = [];

      if (storeId) {
        urlTransactions = `${REACT_APP_API_URL}/api/transactions/store/${storeId}`;
      }

      const responseTrans = await fetch(urlTransactions);
      let transactionsData: Transaction[] = [];

      if (responseTrans.ok) {
        transactionsData = await responseTrans.json();

        if (start && end) {
          const startDateStr = format(start, 'yyyy-MM-dd');
          const endDateStr = format(end, 'yyyy-MM-dd');

          transactionsData = transactionsData.filter(tx => {
            if (!tx.date) return false;

            try {
              const txDateStr = typeof tx.date === 'string'
                ? tx.date.split('T')[0]
                : format(new Date(tx.date), 'yyyy-MM-dd');

              return txDateStr >= startDateStr && txDateStr <= endDateStr;
            } catch (error) {
              console.warn('Error al procesar fecha:', tx.date, error);
              return false;
            }
          });
        }
      }
      // Se unen ambos arreglos
      const merged = [...operationsData, ...transactionsData];
      const sortedTransactions = merged.sort((a, b) => {
        if (!a.date) return 1;
        if (!b.date) return -1;
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);

        return dateB.getTime() - dateA.getTime();
      });

      setTransactions(sortedTransactions);
      setCurrentPage(1);
    } catch (err) {
      console.error('Error al cargar las transacciones:', err);
    } finally {
      setLoading(false);
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
  const filteredByType = typeFilter === 'all'
    ? transactions
    : typeFilter === 'income'
      ? transactions.filter(tx => INCOME_TYPES.includes(tx.type))
      : transactions.filter(tx => EXPENSE_TYPES.includes(tx.type));

  // Paginación
  const totalPages = Math.ceil(filteredByType.length / ITEMS_PER_PAGE);
  const paginatedTransactions = filteredByType.slice(
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
      <SegmentedButtons
        value={newStoreId?.toString() ?? ''}
        onValueChange={(value) => setNewStoreId(Number(value))}
        buttons={[
          { value: '1', label: 'Danli' },
          { value: '2', label: 'El Paraiso' },
        ]}
        style={styles.storeSelector}
      />
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

  // Render de cada tarjeta de operación (se omite el ID)
  const renderTransaction = (item: Transaction, index: number) => {
  let dateToShow = item.date;

  if (item.type === 'CLOSING' && item.depositDate) {
    dateToShow = item.depositDate;
  } else if (item.type === 'SUPPLIER' && item.paymentDate) {
    dateToShow = item.paymentDate;
  } else if (item.type === 'SALARY' && item.depositDate) {
    dateToShow = item.depositDate;
  }

  let typeIcon, typeColor;

  switch (item.type) {
    case 'CLOSING':
    case 'income':
      typeIcon = 'arrow-down-bold-circle-outline';
      typeColor = '#4CAF50';
      break;
    case 'SUPPLIER':
    case 'SALARY':
    case 'GASTO_ADMIN':
    case 'expense':
    case 'gasto_admin':
      typeIcon = 'arrow-up-bold-circle-outline';
      typeColor = '#F44336';
      break;
    default:
      typeIcon = 'help-circle-outline';
      typeColor = '#9E9E9E';
  }

  const imageUri = item.imageUri || (item as any).image_uri;

  return (
    <Card key={`transaction-${item.id}-${index}`} style={styles.transactionCard}>
      <Card.Content>
        <View style={styles.transactionHeader}>
          <View style={styles.transactionTypeContainer}>
            <MaterialCommunityIcons name={typeIcon} size={24} color={typeColor} />
            <Text style={[styles.transactionType, { color: typeColor }]}>
              {TRANSACTION_LABELS[item.type]}
            </Text>
          </View>
          <Text style={styles.transactionAmount}>
            {formatCurrency(item.amount)}
          </Text>
        </View>

        <View style={styles.transactionDetails}>
          {dateToShow && (
            <View style={styles.detailRow}>
              <MaterialCommunityIcons name="calendar" size={16} color="#8B7214" />
              <Text style={styles.detailText}>{'Fecha: ' + formatDate(dateToShow)}</Text>
            </View>
          )}

          {item.description && (
            <View style={styles.detailRow}>
              <MaterialCommunityIcons name="text" size={16} color="#8B7214" />
              <Text style={styles.detailText}>{'Descripción: ' + item.description}</Text>
            </View>
          )}

          {/* Mostrar local */}
          <View style={styles.detailRow}>
            <MaterialCommunityIcons name="store" size={16} color="#8B7214" />
            <Text style={styles.detailText}>
              {'Local: ' + (
                item.store?.name ||
                item.storeName ||
                (item.store?.id ?
                  (item.store.id === 1 ? 'Danli' : 'El Paraiso') :
                  (item.storeId ?
                    (item.storeId === 1 ? 'Danli' : 'El Paraiso') :
                    'No asignado'
                  )
                )
              )}
            </Text>
          </View>
          {/* Mostrar período para CLOSING */}
          {item.type === 'CLOSING' && item.periodStart && item.periodEnd && (
            <View style={styles.detailRow}>
              <MaterialCommunityIcons name="calendar-range" size={16} color="#8B7214" />
              <Text style={styles.detailText}>
                {'Período: ' + formatDate(item.periodStart) + ' al ' + formatDate(item.periodEnd)}
              </Text>
            </View>
          )}
          {/* Comprobante */}
          {imageUri && (
            <View style={styles.detailRow}>
              <MaterialCommunityIcons name="image" size={16} color="#8B7214" />
              <Text style={styles.detailText}>Comprobante:</Text>
              <ImageViewer imageUri={imageUri} size="small" />
            </View>
          )}

          {TRANSACTION_LABELS[item.type] === 'CLOSING' && item.closingsCount && (
            <View style={styles.detailRow}>
              <MaterialCommunityIcons name="counter" size={16} color="#8B7214" />
              <Text style={styles.detailText}>{'Cantidad de cierres: ' + item.closingsCount}</Text>
            </View>
          )}

          {TRANSACTION_LABELS[item.type] === 'CLOSING' && item.periodStart && item.periodEnd && (
            <View style={styles.detailRow}>
              <MaterialCommunityIcons name="calendar-range" size={16} color="#8B7214" />
              <Text style={styles.detailText}>
                {'Período: ' + formatDate(item.periodStart) + ' al ' + formatDate(item.periodEnd)}
              </Text>
            </View>
          )}

          {TRANSACTION_LABELS[item.type] === 'SUPPLIER' && item.supplier && (
            <View style={styles.detailRow}>
              <MaterialCommunityIcons name="truck-delivery" size={16} color="#8B7214" />
              <Text style={styles.detailText}>{'Proveedor: ' + item.supplier}</Text>
            </View>
          )}
          
          
        </View>

        <View style={styles.buttonContainer}>
          <Button
            mode="contained"
            onPress={() => handleEdit(item)}
            style={styles.editButton}
            buttonColor="#2196F3"
            icon="pencil"
          >
            Editar
          </Button>
          <Button
            mode="contained"
            onPress={() => handleDelete(item)}
            style={styles.deleteButton}
            buttonColor="#F44336"
            icon="delete"
          >
            Eliminar
          </Button>
        </View>
      </Card.Content>
    </Card>
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
          color={currentPage === 1 ? '#BBBBBB' : '#2196F3'}
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
          color={currentPage === totalPages ? '#BBBBBB' : '#2196F3'}
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
        <View style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e8ecf2' }}>
          {/* Fila: título + botón colapsar */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6 }}>
            <ThemedText style={[styles.title, { marginBottom: 0 }]}>Operaciones</ThemedText>
            <Button
              mode="outlined"
              onPress={() => setFiltersExpanded(v => !v)}
              textColor="#53606d"
              style={{ borderColor: '#e8ecf2', minWidth: 0 }}
              labelStyle={{ fontSize: 12 }}
            >
              {filtersExpanded ? 'Cerrar ▲' : 'Filtros ▼'}
            </Button>
          </View>

          {/* Filtro tipo: siempre visible */}
          <View style={{ flexDirection: 'row', marginHorizontal: 12, marginBottom: 8, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#e8ecf2' }}>
            {(['all', 'income', 'expense'] as const).map((f) => (
              <View key={f} style={{ flex: 1 }}>
                <Button
                  mode="contained"
                  onPress={() => { setTypeFilter(f); setCurrentPage(1); }}
                  buttonColor={typeFilter === f ? '#ffd43b' : '#f4f6f8'}
                  textColor={typeFilter === f ? '#161616' : '#6b7581'}
                  style={{ borderRadius: 0, margin: 0 }}
                  labelStyle={{ fontSize: 13, fontWeight: '700' }}
                >
                  {f === 'all' ? 'Todos' : f === 'income' ? 'Ingresos' : 'Egresos'}
                </Button>
              </View>
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
                />
                <BalanceCard transactions={filteredByType} />
              </View>
            </ScrollView>
          )}
        </View>
      )}

      {/* ── DESKTOP ── */}
      {isLargeScreen && (
        <View style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e8ecf2' }}>
          {/* Fila: título + filtro tipo + botón colapsar */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, gap: 12 }}>
            <ThemedText style={[styles.title, { marginBottom: 0 }]}>Todas las Operaciones.</ThemedText>

            {/* Filtro Todos/Ingresos/Egresos */}
            <View style={{ flexDirection: 'row', borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#e8ecf2' }}>
              {(['all', 'income', 'expense'] as const).map((f) => (
                <Button
                  key={f}
                  mode="contained"
                  onPress={() => { setTypeFilter(f); setCurrentPage(1); }}
                  buttonColor={typeFilter === f ? '#ffd43b' : '#f4f6f8'}
                  textColor={typeFilter === f ? '#161616' : '#6b7581'}
                  style={{ borderRadius: 0, margin: 0 }}
                  labelStyle={{ fontSize: 13, fontWeight: '700' }}
                >
                  {f === 'all' ? 'Todos' : f === 'income' ? 'Ingresos' : 'Egresos'}
                </Button>
              ))}
            </View>

            <Button
              mode="outlined"
              onPress={() => setFiltersExpanded(v => !v)}
              textColor="#53606d"
              style={{ borderColor: '#e8ecf2' }}
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
              />
              <BalanceCard transactions={filteredByType} />
            </View>
          )}
        </View>
      )}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <ThemedText style={styles.loadingText}>
            Cargando datos desde la base de datos...
          </ThemedText>
        </View>
      ) : (
        <ScrollView style={styles.scrollView}>
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
              <Button onPress={handleCancelEdit} mode="outlined" style={styles.modalButton}>
                Cancelar
              </Button>
              <Button onPress={handleSaveEdit} mode="contained" style={styles.modalButton}>
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
              <Button onPress={() => setShowDeleteConfirmation(false)} mode="outlined" style={styles.modalButton}>
                Cancelar
              </Button>
              <Button onPress={confirmDelete} mode="contained" style={styles.modalButton}>
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
      />
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 0,
    backgroundColor: '#F5F5F5',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginVertical: 12,
    textAlign: 'center',
    color: '#333',
  },
  // Estilos para la vista de escritorio (originales)
  headerContainer: {
    padding: 16,
    marginTop: -10,
  },
  dateInputsContainer: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    elevation: 3,
    marginBottom: 16,
  },
  dateInput: {
    backgroundColor: '#fff',
    marginBottom: 12,
    flex: 1,
    marginHorizontal: 5,
  },
  refreshButton: {
    borderRadius: 30,
    marginTop: 5,
    marginBottom: 10,
    elevation: 2,
    marginRight: 8,
  },
  clearButton: {
    marginTop: 5,
    borderColor: '#D4A72B',
    marginRight: 8,
  },
  excelButton: {
    borderRadius: 30,
    marginTop: 5,
    marginBottom: 10,
    elevation: 2,
  },

  // Estilos para la vista móvil (nuevos, compactos)
  controlsContainer: {
    padding: 10,
    marginBottom: 5,
  },
  mobileControlsContainer: {
    padding: 10,
    marginBottom: 5,
  },
  compactFiltersContainer: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 10,
    elevation: 3,
    marginBottom: 10,
  },
  compactDateInputs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  compactDateInput: {
    flex: 1,
    marginHorizontal: 4,
    height: 50,
    backgroundColor: '#fff',
    fontSize: 15,
    minWidth: 130,
  },
  compactButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  compactClearButton: {
    flex: 1,
    marginRight: 5,
    borderColor: '#D4A72B',
    height: 36,
  },
  compactRefreshButton: {
    flex: 1,
    marginLeft: 5,
    marginRight: 5,
    borderRadius: 30,
    height: 36,
  },
  compactExcelButton: {
    flex: 1,
    marginLeft: 5,
    borderRadius: 30,
    height: 36,
  },
  compactAdminButton: {
    flex: 1,
    marginLeft: 5,
    marginRight: 5,
    borderRadius: 30,
    height: 36,
    borderColor: '#FF9800',
  },

  // Estilos para la selección de local
  storeFilterContainer: {
    marginBottom: 10,
  },
  storeFilterCompact: {
    marginBottom: 8,
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
    marginBottom: 8,
  },
  filtersRowWeb: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
  },
  inputGroupWeb: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 3,
    gap: 10,
  },
  buttonGroupWeb: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flex: 2,
    gap: 10,
  },
  dateFiltersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#555',
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
    borderRadius: 10,
    elevation: 3,
    marginBottom: 10,
    overflow: 'hidden',
    backgroundColor: 'white',
  },
  balanceHeaderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f8f8f8',
  },
  balanceContentContainer: {
    overflow: 'hidden',
    paddingHorizontal: 16,
  },
  balanceTitle: {
    fontSize: 18,
    color: '#333',
    fontWeight: 'bold',
    marginBottom: 5,
    textAlign: 'center',
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  balanceLabel: {
    fontSize: 16,
    color: '#333',
    marginLeft: 8,
    flex: 1,
  },
  balanceValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },

  // Estilos para la lista de transacciones
  scrollView: {
    padding: 0,
    flex: 1,
  },
  transactionCard: {
    marginBottom: 16,
    borderRadius: 10,
    elevation: 3,
    backgroundColor: 'white',
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  transactionTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  transactionType: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  transactionAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  transactionDetails: {
    marginBottom: 15,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  detailText: {
    fontSize: 14,
    color: '#555',
    marginLeft: 8,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  editButton: {
    flex: 1,
    marginRight: 5,
    borderRadius: 30,
  },
  deleteButton: {
    flex: 1,
    marginLeft: 5,
    borderRadius: 30,
  },

  // Estilos para el modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    elevation: 5,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
    color: '#333',
  },
  modalInput: {
    marginBottom: 12,
    backgroundColor: 'white',
  },
  modalButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 15,
  },
  modalButton: {
    flex: 1,
    marginHorizontal: 5,
    borderRadius: 30,
  },
  modalInputContainer: {
    marginBottom: 12,
  },
  modalInputLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#555',
  },

  // Estilos para la paginación
  fixedPaginationContainer: {
    paddingVertical: 10,
    backgroundColor: '#f5f5f5',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
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
    borderRadius: 20,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#DDDDDD',
    elevation: 2,
  },
  paginationText: {
    fontSize: 16,
    color: '#555',
  },
  activeButton: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  activeText: {
    color: 'white',
    fontWeight: 'bold',
  },
  disabledButton: {
    opacity: 0.5,
  },

  // Otros estilos
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#D4A72B',
    textAlign: 'center',
  },
  noDataText: {
    fontSize: 18,
    textAlign: 'center',
    marginVertical: 40,
    color: '#888',
  },
  confirmationText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    color: '#555',
    lineHeight: 24,
  },
  snackbar: {
    backgroundColor: '#333333',
    borderRadius: 10,
  },
  imageContainer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
  },
  imageLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#8B7214',
  },
  transactionImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    resizeMode: 'contain',
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
});

export default AdminScreen;
