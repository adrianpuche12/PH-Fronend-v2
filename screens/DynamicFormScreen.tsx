import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Animated,
  StatusBar,
  TouchableOpacity,
  Text,
  Image,
  ActivityIndicator,
  Modal,
  TextInput as RNTextInput,
} from 'react-native';
import {
  TextInput,
  Button,
  RadioButton,
  Card,
  Title,
  Avatar,
  HelperText
} from 'react-native-paper';
import { DatePickerModal } from 'react-native-paper-dates';
import { format } from 'date-fns';
import ResponsiveButton from '../components/ui/responsiveButton';
import { REACT_APP_API_URL } from '../config';
import StoreSelector from '../components/StoreSelector';
import { useAuth } from '../context/AuthContext';
import { formatHnl, formatDate } from '../utils/format';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { formatAmountInput, parseFormattedNumber } from '../utils/numberFormat';
import { COLOR, SPACE, RADIUS, FONT_SIZE, FONT_WEIGHT, SHADOW } from '../theme';
import { ImageService } from '../utils/ImageService';
import ImagePicker from '../components/ImagePicker';

const BACKEND_URL = `${REACT_APP_API_URL}/api/forms`;
const TRANSACTIONS_URL = `${REACT_APP_API_URL}/transactions`;

const DynamicFormScreen = () => {
  const { userName } = useAuth();
  const [activeTab, setActiveTab] = useState<'form' | 'historial'>('form');

  // ── Historial de operaciones del usuario ────────────────────────────────────
  interface OperacionHistorial {
    id: number; type: string; amount: number; date: string;
    description: string; storeName: string; username: string;
  }
  const [historial, setHistorial]         = useState<OperacionHistorial[]>([]);
  const [histLoading, setHistLoading]     = useState(false);
  const [histPage, setHistPage]           = useState(0);
  const [histHasMore, setHistHasMore]     = useState(true);
  const HIST_SIZE = 20;

  const loadHistorial = useCallback(async (reset = false) => {
    if (!userName || histLoading) return;
    setHistLoading(true);
    const page = reset ? 0 : histPage;
    try {
      const res = await fetch(
        `${REACT_APP_API_URL}/api/operations/mine?username=${userName}&page=${page}&size=${HIST_SIZE}`
      );
      const data: OperacionHistorial[] = await res.json();
      setHistorial(prev => reset ? data : [...prev, ...data]);
      setHistPage(page + 1);
      setHistHasMore(data.length === HIST_SIZE);
    } catch { /* silencioso */ }
    finally { setHistLoading(false); }
  }, [userName, histPage, histLoading]);

  useEffect(() => {
    if (activeTab === 'historial' && historial.length === 0) {
      loadHistorial(true);
    }
  }, [activeTab]);

  const getCurrentFormattedDate = () => format(new Date(), 'yyyy-MM-dd');
  const parseDate = (dateString: string) => {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day, 12, 0, 0);
  };

  interface StoreDistribucion {
    storeId: number;
    nombre: string;
    porcentaje: number;
  }

  interface FormDataType {
    type: string;
    amount: string;
    date: string;
    description: string;
    closingsCount: string;
    periodStart: string;
    periodEnd: string;
    storeId: number;
    supplier: string;
    imageUri: string;
    [key: string]: any;
  }

  interface SelectedImage {
    uri: string;
    name: string;
    type: string;
  }

  const [formData, setFormData] = useState<FormDataType>({
    type: '',
    amount: '',
    date: getCurrentFormattedDate(),
    description: '',
    closingsCount: '',
    periodStart: '',
    periodEnd: '',
    storeId: 0,
    supplier: '',
    imageUri: '',
  });

  // Locales activos (cargados desde /api/v2/stores/active)
  const [distribuciones, setDistribuciones] = useState<StoreDistribucion[]>([]);

  const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(null);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [dateRangePickerVisible, setDateRangePickerVisible] = useState(false);
  const [selectedDateField, setSelectedDateField] = useState<'date' | ''>('');
  const [dateRange, setDateRange] = useState<{
    startDate: Date | undefined,
    endDate: Date | undefined,
  }>({
    startDate: undefined,
    endDate: undefined,
  });

  const [formType, setFormType] = useState<'transaction' | 'closing-deposits' | 'supplier-payments' | 'salary-payments' | 'gasto-admin' | 'bank-deposit' | ''>('');

  // Estado para el formulario de depósito bancario
  const [pendingClosings, setPendingClosings]         = useState<any[]>([]);
  const [loadingClosings, setLoadingClosings]         = useState(false);
  const [closingsLoaded, setClosingsLoaded]           = useState(false);
  const [bankDeclaredAmount, setBankDeclaredAmount]   = useState('');
  const [bankNotes, setBankNotes]                     = useState('');
  const [bankDepositDate, setBankDepositDate]         = useState(getCurrentFormattedDate());
  const [showMessageCard, setShowMessageCard] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const slideAnim = useState(new Animated.Value(-100))[0];
  const [errors, setErrors] = useState<{ [key: string]: boolean }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal de reconciliación bancaria (solo para cierres)
  const [reconcModal, setReconcModal]   = useState(false);
  const [reconcData, setReconcData]     = useState<{
    expectedCash: number;
    declaredAmount: number;
    difference: number;
    from: string;
    to: string;
    saleCount: number;
  } | null>(null);

  useEffect(() => {
    setFormData(prevData => ({ ...prevData, date: getCurrentFormattedDate() }));
  }, []);

  // Cargar locales activos y distribuir el porcentaje en partes iguales
  useEffect(() => {
    const STORES_URL = `${REACT_APP_API_URL}/api/v2/stores/active`;
    fetch(STORES_URL)
      .then(r => r.json())
      .then((stores: { id: number; name: string }[]) => {
        if (!stores.length) return;
        const base     = Math.floor(100 / stores.length);
        const resto    = 100 - base * stores.length;
        setDistribuciones(stores.map((s, i) => ({
          storeId:    s.id,
          nombre:     s.name,
          porcentaje: i === 0 ? base + resto : base,
        })));
      })
      .catch(() => {});
  }, []);

  // Establecer tipo automáticamente para gasto-admin
  useEffect(() => {
    if (formType === 'gasto-admin') {
      handleInputChange('type', 'expense');
    }
  }, [formType]);

  const showMessage = (type: 'success' | 'error', message: string) => {
    setMessage(message);
    setMessageType(type);
    setShowMessageCard(true);

    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();

    setTimeout(() => hideMessage(), 3000);
  };

  const hideMessage = () => {
    Animated.timing(slideAnim, {
      toValue: -100,
      duration: 300,
      useNativeDriver: true,
    }).start(() => setShowMessageCard(false));
  };

  const clearData = () => {
    const currentDate = getCurrentFormattedDate();
    handleInputChange('amount', '');
    handleInputChange('date', currentDate);
    handleInputChange('description', '');
    handleInputChange('type', '');
    handleInputChange('closingsCount', '');
    handleInputChange('periodStart', '');
    handleInputChange('periodEnd', '');
    handleInputChange('storeId', 0);
    handleInputChange('supplier', '');
    setSelectedImage(null);
    setDateRange({ startDate: undefined, endDate: undefined });
    // Resetear porcentajes a partes iguales
    if (distribuciones.length > 0) {
      const base  = Math.floor(100 / distribuciones.length);
      const resto = 100 - base * distribuciones.length;
      setDistribuciones(prev => prev.map((d, i) => ({
        ...d, porcentaje: i === 0 ? base + resto : base,
      })));
    }
  };

  const handleInputChange = (field: string, value: any) => {
    if (field === 'amount') {
      if (value) {
        const formattedValue = formatAmountInput(value);
        setFormData((prevData: FormDataType) => ({
          ...prevData,
          [field]: formattedValue,
        }));
      } else {
        setFormData((prevData: FormDataType) => ({
          ...prevData,
          [field]: '',
        }));
      }
    } else {
      setFormData((prevData: FormDataType) => ({
        ...prevData,
        [field]: value,
      }));
    }
    setErrors((prevErrors) => ({ ...prevErrors, [field]: false }));
  };

  const handleDateConfirm = (params: { date: Date | undefined }) => {
    if (params.date) {
      const formattedDate = format(params.date, 'yyyy-MM-dd');
      if (formType === 'bank-deposit') {
        setBankDepositDate(formattedDate);
      } else {
        setFormData((prevData: FormDataType) => ({
          ...prevData,
          [selectedDateField]: formattedDate,
        }));
        setErrors((prevErrors) => ({ ...prevErrors, [selectedDateField]: false }));
      }
    }
    setDatePickerVisible(false);
    setSelectedDateField('');
  };

  const handleDateRangeConfirm = ({
    startDate,
    endDate
  }: {
    startDate: Date | undefined,
    endDate: Date | undefined
  }) => {
    setDateRange({ startDate, endDate });

    if (startDate) {
      const formattedStartDate = format(startDate, 'yyyy-MM-dd');
      setFormData((prevData: FormDataType) => ({
        ...prevData,
        periodStart: formattedStartDate,
      }));
      setErrors((prevErrors) => ({ ...prevErrors, periodStart: false }));
    }

    if (endDate) {
      const formattedEndDate = format(endDate, 'yyyy-MM-dd');
      setFormData((prevData: FormDataType) => ({
        ...prevData,
        periodEnd: formattedEndDate,
      }));
      setErrors((prevErrors) => ({ ...prevErrors, periodEnd: false }));
    }

    setDateRangePickerVisible(false);
  };

  const validateForm = () => {
    const newErrors: { [key: string]: boolean } = {};

    // Validación para transacciones
    if (formType === 'transaction' && !formData.type) {
      newErrors.type = true;
    }

    // Validación para gastos administrativos
    if (formType === 'gasto-admin') {
      if (!formData.amount || parseFloat(formData.amount.replace(/,/g, '')) <= 0) newErrors.amount = true;
      if (!formData.description.trim()) newErrors.description = true;
      if (!formData.date) newErrors.date = true;
      const totalPct = distribuciones.reduce((s, d) => s + d.porcentaje, 0);
      if (totalPct !== 100) newErrors.porcentajes = true;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ── Depósito bancario ───────────────────────────────────────────────────────

  const searchPendingClosings = async () => {
    if (!formData.storeId || !formData.periodStart || !formData.periodEnd) {
      showMessage('error', 'Seleccioná el local y el periodo');
      return;
    }
    setLoadingClosings(true);
    setClosingsLoaded(false);
    setPendingClosings([]);
    try {
      const params = new URLSearchParams({
        storeId: String(formData.storeId),
        from: formData.periodStart,
        to: formData.periodEnd,
      });
      const res = await fetch(`${REACT_APP_API_URL}/api/v2/deposits/pending-closings?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setPendingClosings(Array.isArray(data) ? data : []);
      setClosingsLoaded(true);
    } catch {
      showMessage('error', 'Error al buscar cierres pendientes');
    } finally {
      setLoadingClosings(false);
    }
  };

  const submitBankDeposit = async () => {
    if (pendingClosings.length === 0) {
      showMessage('error', 'No hay cierres pendientes para depositar');
      return;
    }
    const declared = parseFloat(bankDeclaredAmount.replace(/,/g, '') || '0');
    if (!declared || declared <= 0) {
      showMessage('error', 'Ingresa el monto a depositar');
      return;
    }
    if (!selectedImage) {
      showMessage('error', 'El comprobante bancario es obligatorio para el deposito');
      return;
    }
    setIsSubmitting(true);
    try {
      let imageUri = null;
      if (selectedImage) {
        const uploadResult = await ImageService.uploadImage(
          selectedImage.uri,
          selectedImage.name = ImageService.generateFileName('DEP'),
          'comprobantes'
        );
        if (uploadResult.success) imageUri = uploadResult.imageUri;
      }
      const payload = {
        shiftIds: pendingClosings.map((c: any) => c.id),
        depositDate: bankDepositDate,
        declaredAmount: declared,
        imageUri,
        notes: bankNotes,
      };
      const res = await fetch(`${REACT_APP_API_URL}/api/v2/deposits?username=${encodeURIComponent(userName ?? 'empleado')}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        showMessage('success', 'Depósito bancario registrado correctamente');
        // Resetear todo
        setFormType('');
        setPendingClosings([]);
        setClosingsLoaded(false);
        setBankDeclaredAmount('');
        setBankNotes('');
        setSelectedImage(null);
        loadHistorial(true);
        setActiveTab('historial');
      } else {
        const err = await res.json();
        showMessage('error', err.message || 'Error al registrar el depósito');
      }
    } catch {
      showMessage('error', 'No se pudo conectar con el servidor');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Llamado desde el modal de reconciliación al confirmar
  const confirmAndSubmit = () => {
    setReconcModal(false);
    executeSubmit();
  };

  const executeSubmit = async () => {
    setIsSubmitting(true);
    try {
      let imageUri = null;
      if (selectedImage) {
        const uploadResult = await ImageService.uploadImage(
          selectedImage.uri,
          selectedImage.name = ImageService.generateFileName('IMG'),
          'comprobantes'
        );
        if (uploadResult.success) {
          imageUri = uploadResult.imageUri;
        } else {
          showMessage('error', 'Error al subir imagen: ' + uploadResult.error);
          setIsSubmitting(false);
          return;
        }
      }
      const url =
        formType === 'transaction'
          ? TRANSACTIONS_URL
          : formType === 'gasto-admin'
          ? `${BACKEND_URL}/gasto-admin`
          : `${BACKEND_URL}/${formType}`;

      const amountValue = formData.amount ? formData.amount.replace(/,/g, '') : '0';
      const amount = parseFloat(amountValue);

      const basePayload: any =
        formType === 'gasto-admin'
          ? {
              fecha: formData.date,
              monto: amount,
              descripcion: formData.description.trim(),
              tipo: 'expense',
              distribuciones: distribuciones.map(d => ({
                storeId:    d.storeId,
                porcentaje: d.porcentaje,
              })),
              imageUri: imageUri,
            }
          : {
              ...formData,
              amount,
              store: { id: formData.storeId },
              username: userName ?? 'default_user',
              date: formData.date,
              salaryDate: formData.date,
              paymentDate: formData.date,
              depositDate: formData.date,
              imageUri: imageUri,
            };

      const response = await fetch(url, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(basePayload),
      });

      if (response.ok) {
        if (formType === 'gasto-admin') {
          const result = await response.json();
          showMessage('success', `${result.mensaje} (ID: ${result.gastoAdminId})`);
        } else {
          showMessage('success', 'Datos enviados correctamente');
        }
        // Reset completo del formulario
        setFormType('');
        setFormData({
          type: '', amount: '', date: getCurrentFormattedDate(),
          description: '', closingsCount: '', periodStart: '',
          periodEnd: '', storeId: 0, supplier: '', imageUri: '',
        });
        setSelectedImage(null);
        setDateRange({ startDate: undefined, endDate: undefined });
        setErrors({});
        // Refrescar historial y mostrar tab
        loadHistorial(true);
        setActiveTab('historial');
      } else {
        const error = await response.json();
        showMessage('error', error.message || 'Error al enviar el formulario');
      }
    } catch {
      showMessage('error', 'No se pudo conectar con el servidor');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting) {
      return;
    }

    if (!formType) {
      showMessage('error', 'Por favor, seleccione un tipo de operación.');
      return;
    }

    const isValid = validateForm();
    if (!isValid) {
      showMessage('error', 'Por favor complete todos los campos requeridos');
      return;
    }

    // Para depósito bancario: usar su propio submit
    if (formType === 'bank-deposit') {
      submitBankDeposit();
      return;
    }

    // Para cierres: calcular reconciliación antes de enviar
    if (formType === 'closing-deposits' && formData.periodStart && formData.periodEnd && formData.storeId > 0 && formData.amount) {
      try {
        console.log('Reconciliación:', { storeId: formData.storeId, from: formData.periodStart, to: formData.periodEnd, amount: formData.amount });
        const params = new URLSearchParams({
          storeId: String(formData.storeId),
          from: formData.periodStart,
          to: formData.periodEnd,
        });
        const res = await fetch(`${REACT_APP_API_URL}/api/v2/sales/cash-summary?${params}`);
        const data = await res.json();
        console.log('Respuesta cash-summary:', data);
        const declared = parseFloat(formData.amount.replace(/,/g, '') || '0');
        const expected = data.totalCash ?? 0;
        setReconcData({
          expectedCash:   expected,
          declaredAmount: declared,
          difference:     declared - expected,
          from:           formData.periodStart,
          to:             formData.periodEnd,
          saleCount:      data.saleCount ?? 0,
        });
        setReconcModal(true);
        return;
      } catch (err) {
        console.error('Error en cash-summary:', err);
        // Si falla la consulta, continuar con el submit normal
      }
    } else {
      console.log('No se cumple condición reconciliación:', {
        formType,
        periodStart: formData.periodStart,
        periodEnd: formData.periodEnd,
        storeId: formData.storeId,
        amount: formData.amount
      });
    }

    executeSubmit();
  };

  const renderImagePicker = () => (
    <ImagePicker
      onImageSelected={(image) => setSelectedImage(image)}
      initialImage={selectedImage}
      disabled={false}
    />
  );

  const renderSupplierList = () => {
    const suppliers = ['Pollo Rey', 'Pollo Cortijo', 'Pago a Proveedor de Frescos'];
    return (
      <View style={styles.supplierListContainer}>
        {suppliers.map((supplier) => (
          <RadioButton.Item
            key={supplier}
            label={supplier}
            value={supplier}
            status={formData.supplier === supplier ? 'checked' : 'unchecked'}
            onPress={() => handleInputChange('supplier', supplier)}
            style={styles.radioItem}
            labelStyle={styles.radioLabel}
            color={COLOR.brandDark}
          />
        ))}
      </View>
    );
  };

  const renderTransactionForm = () => (
    <>
      <Title style={styles.formSectionTitle}>Selecciona el tipo de transacción</Title>
      <RadioButton.Group
        onValueChange={(value) => handleInputChange('type', value)}
        value={formData.type}
      >
        <View style={styles.radioGroupContainer}>
          <RadioButton.Item
            label="Ingreso"
            value="income"
            style={styles.radioItem}
            labelStyle={styles.radioLabel}
            color={COLOR.brandDark}
          />
          <RadioButton.Item
            label="Egreso"
            value="expense"
            style={styles.radioItem}
            labelStyle={styles.radioLabel}
            color={COLOR.brandDark}
          />
        </View>
      </RadioButton.Group>
      {errors.type && (
        <HelperText type="error" visible>
          Debe seleccionar Ingreso o Egreso
        </HelperText>
      )}

      <StoreSelector
        selectedStore={formData.storeId}
        onStoreChange={(storeId) => handleInputChange('storeId', storeId)}
        style={styles.storeSelector}
      />

      <View style={styles.inputContainer}>
        <TextInput
          label="Monto"
          value={formData.amount}
          onChangeText={(value) => handleInputChange('amount', value)}
          keyboardType="decimal-pad"
          mode="outlined"
          style={styles.input}
          error={errors.amount}
          left={<TextInput.Icon icon="cash-multiple" color={COLOR.brandDark} />}
          outlineColor={COLOR.border2}
          activeOutlineColor={COLOR.brand}
          theme={{ colors: { primary: COLOR.brand } }}
        />
      </View>

      <View style={styles.inputContainer}>
        <TextInput
          label="Fecha"
          value={formData.date}
          mode="outlined"
          onFocus={() => {
            setSelectedDateField('date');
            setDatePickerVisible(true);
          }}
          style={styles.input}
          error={errors.date}
          left={<TextInput.Icon icon="calendar" color={COLOR.brandDark} />}
          outlineColor={COLOR.border2}
          activeOutlineColor={COLOR.brand}
          theme={{ colors: { primary: COLOR.brand } }}
        />
      </View>

      <View style={styles.inputContainer}>
        <TextInput
          label="Descripción"
          value={formData.description}
          onChangeText={(value) => handleInputChange('description', value)}
          mode="outlined"
          style={styles.input}
          error={errors.description}
          left={<TextInput.Icon icon="text" color={COLOR.brandDark} />}
          outlineColor={COLOR.border2}
          activeOutlineColor={COLOR.brand}
          theme={{ colors: { primary: COLOR.brand } }}
        />
      </View>
      {renderImagePicker()}
    </>
  );

  const updatePorcentaje = (storeId: number, valor: number) => {
    setDistribuciones(prev => prev.map(d =>
      d.storeId === storeId ? { ...d, porcentaje: Math.max(0, Math.min(100, valor)) } : d
    ));
  };

  const dividirIgual = () => {
    if (!distribuciones.length) return;
    const base  = Math.floor(100 / distribuciones.length);
    const resto = 100 - base * distribuciones.length;
    setDistribuciones(prev => prev.map((d, i) => ({ ...d, porcentaje: i === 0 ? base + resto : base })));
  };

  const renderGastoAdminForm = () => {
    const montoNum   = parseFloat((formData.amount || '0').replace(/,/g, '')) || 0;
    const totalPct   = distribuciones.reduce((s, d) => s + d.porcentaje, 0);
    const pctValidos = totalPct === 100;

    return (
      <>
        <View style={styles.inputContainer}>
          <TextInput
            label="Monto total"
            value={formData.amount}
            onChangeText={(v) => handleInputChange('amount', v)}
            keyboardType="decimal-pad"
            mode="outlined"
            style={styles.input}
            error={errors.amount}
            left={<TextInput.Icon icon="cash-multiple" color={COLOR.brandDark} />}
            outlineColor={COLOR.border2}
            activeOutlineColor={COLOR.brand}
            theme={{ colors: { primary: COLOR.brand } }}
            placeholder="Monto a dividir entre locales"
          />
          {errors.amount && <HelperText type="error" visible>El monto debe ser mayor a 0</HelperText>}
        </View>

        <View style={styles.inputContainer}>
          <TextInput
            label="Fecha"
            value={formData.date}
            mode="outlined"
            onFocus={() => { setSelectedDateField('date'); setDatePickerVisible(true); }}
            style={styles.input}
            error={errors.date}
            left={<TextInput.Icon icon="calendar" color={COLOR.brandDark} />}
            outlineColor={COLOR.border2}
            activeOutlineColor={COLOR.brand}
            theme={{ colors: { primary: COLOR.brand } }}
          />
        </View>

        <View style={styles.inputContainer}>
          <TextInput
            label="Descripción"
            value={formData.description}
            onChangeText={(v) => handleInputChange('description', v)}
            mode="outlined"
            style={styles.input}
            error={errors.description}
            left={<TextInput.Icon icon="text" color={COLOR.brandDark} />}
            outlineColor={COLOR.border2}
            activeOutlineColor={COLOR.brand}
            theme={{ colors: { primary: COLOR.brand } }}
          />
          {errors.description && <HelperText type="error" visible>La descripción es obligatoria</HelperText>}
        </View>

        {/* División dinámica por local */}
        <View style={styles.divisionContainer}>
          <Title style={styles.divisionTitle}>División entre locales</Title>

          <TouchableOpacity onPress={dividirIgual} style={styles.quickButton}>
            <Text style={styles.quickButtonText}>Dividir en partes iguales</Text>
          </TouchableOpacity>

          {distribuciones.map(d => (
            <View key={d.storeId} style={styles.localCard}>
              <Text style={styles.localName}>{d.nombre}</Text>
              <View style={styles.percentageContainer}>
                <TextInput
                  mode="outlined"
                  value={d.porcentaje.toString()}
                  onChangeText={(v) => updatePorcentaje(d.storeId, parseInt(v) || 0)}
                  keyboardType="numeric"
                  style={styles.percentageInput}
                  maxLength={3}
                  theme={{ colors: { primary: COLOR.brand } }}
                />
                <Text style={styles.percentageSymbol}>%</Text>
              </View>
              {montoNum > 0 && (
                <Text style={styles.localAmount}>
                  L {((montoNum * d.porcentaje) / 100).toFixed(2)}
                </Text>
              )}
            </View>
          ))}

          <View style={styles.validationContainer}>
            {pctValidos ? (
              <Text style={styles.validationSuccess}>Porcentajes válidos: {totalPct}%</Text>
            ) : (
              <Text style={styles.validationError}>
                Los porcentajes deben sumar 100% (actual: {totalPct}%)
              </Text>
            )}
          </View>
        </View>

        {/* Vista previa */}
        {montoNum > 0 && formData.description && pctValidos && (
          <View style={styles.summaryContainer}>
            <Title style={styles.summaryTitle}>Vista previa</Title>
            <Text style={styles.summaryText}>
              <Text style={styles.summaryBold}>Se crearán {distribuciones.length} transacciones:</Text>
            </Text>
            {distribuciones.map(d => (
              <Text key={d.storeId} style={styles.summaryText}>
                • {d.nombre} ({d.porcentaje}%): L {((montoNum * d.porcentaje) / 100).toFixed(2)}
              </Text>
            ))}
          </View>
        )}
        {renderImagePicker()}
      </>
    );
  };

  // ── Helpers de UI para formularios ───────────────────────────────────────
  // FieldLabel, FieldGroup, AmountField y DateField están definidos a nivel
  // de módulo (después de styles) para evitar el remount que causa pérdida de foco.
  // PeriodField se queda aquí porque cierra sobre formData.periodStart/periodEnd.

  const PeriodField = ({ onPress, error }: { onPress: () => void; error?: boolean }) => (
    <TouchableOpacity style={[styles.dateField, error && styles.dateFieldError]} onPress={onPress} activeOpacity={0.7}>
      <MaterialCommunityIcons name="calendar-range" size={18} color={COLOR.brandDark} />
      <Text style={[styles.dateFieldText, !(formData.periodStart && formData.periodEnd) && styles.dateFieldPlaceholder]}>
        {formData.periodStart && formData.periodEnd
          ? `${fmtDate(formData.periodStart)}  →  ${fmtDate(formData.periodEnd)}`
          : 'Seleccionar período'}
      </Text>
      <MaterialCommunityIcons name="chevron-down" size={16} color={COLOR.inkMute} />
    </TouchableOpacity>
  );

  const renderFormFields = () => {
    switch (formType) {
      case 'transaction':
        return renderTransactionForm();
      case 'gasto-admin':
        return renderGastoAdminForm();
      case 'closing-deposits':
        return (
          <>
            <FieldGroup>
              <FieldLabel label="Local" />
              <StoreSelector
                selectedStore={formData.storeId}
                onStoreChange={(storeId) => handleInputChange('storeId', storeId)}
                style={styles.storeSelector}
              />
            </FieldGroup>

            <FieldGroup>
              <FieldLabel label="Monto del cierre" />
              <AmountField
                value={formData.amount}
                onChange={(v) => handleInputChange('amount', v)}
                error={errors.amount}
              />
              {errors.amount && <Text style={styles.fieldError}>El monto es obligatorio</Text>}
            </FieldGroup>

            <FieldGroup>
              <FieldLabel label="Cantidad de cierres" />
              <TextInput
                value={formData.closingsCount}
                onChangeText={(v) => handleInputChange('closingsCount', v)}
                keyboardType="numeric"
                mode="outlined"
                placeholder="Ej: 3"
                style={styles.input}
                outlineColor={COLOR.border}
                activeOutlineColor={COLOR.brand}
                theme={{ colors: { primary: COLOR.brand } }}
              />
            </FieldGroup>

            <FieldGroup>
              <FieldLabel label="Fecha del cierre" />
              <DateField
                label="Seleccionar fecha"
                value={formData.date}
                onPress={() => { setSelectedDateField('date'); setDatePickerVisible(true); }}
                error={errors.date}
              />
              {errors.date && <Text style={styles.fieldError}>La fecha es obligatoria</Text>}
            </FieldGroup>

            <FieldGroup>
              <FieldLabel label="Período que cubre" />
              <PeriodField onPress={() => setDateRangePickerVisible(true)} error={!!(errors.periodStart || errors.periodEnd)} />
              {(errors.periodStart || errors.periodEnd) && <Text style={styles.fieldError}>Seleccioná el período completo</Text>}
            </FieldGroup>

            {renderImagePicker()}
          </>
        );
      case 'supplier-payments':
        return (
          <>
            <FieldGroup>
              <FieldLabel label="Proveedor" />
              {renderSupplierList()}
            </FieldGroup>

            <FieldGroup>
              <FieldLabel label="Local" />
              <StoreSelector
                selectedStore={formData.storeId}
                onStoreChange={(storeId) => handleInputChange('storeId', storeId)}
                style={styles.storeSelector}
              />
            </FieldGroup>

            <FieldGroup>
              <FieldLabel label="Monto pagado" />
              <AmountField value={formData.amount} onChange={(v) => handleInputChange('amount', v)} error={errors.amount} />
              {errors.amount && <Text style={styles.fieldError}>El monto es obligatorio</Text>}
            </FieldGroup>

            <FieldGroup>
              <FieldLabel label="Fecha de pago" />
              <DateField label="Seleccionar fecha" value={formData.date} onPress={() => { setSelectedDateField('date'); setDatePickerVisible(true); }} error={errors.date} />
            </FieldGroup>

            <FieldGroup>
              <FieldLabel label="Descripción" />
              <TextInput
                value={formData.description}
                onChangeText={(v) => handleInputChange('description', v)}
                mode="outlined"
                placeholder="Detalle del pago..."
                style={styles.input}
                multiline
                numberOfLines={2}
                outlineColor={COLOR.border}
                activeOutlineColor={COLOR.brand}
                theme={{ colors: { primary: COLOR.brand } }}
              />
            </FieldGroup>
            {renderImagePicker()}
          </>
        );
      case 'salary-payments':
        return (
          <>
            <FieldGroup>
              <FieldLabel label="Local" />
              <StoreSelector
                selectedStore={formData.storeId}
                onStoreChange={(storeId) => handleInputChange('storeId', storeId)}
                style={styles.storeSelector}
              />
            </FieldGroup>

            <FieldGroup>
              <FieldLabel label="Empleado / Descripción" />
              <TextInput
                value={formData.description}
                onChangeText={(v) => handleInputChange('description', v)}
                mode="outlined"
                placeholder="Nombre del empleado..."
                style={styles.input}
                outlineColor={COLOR.border}
                activeOutlineColor={COLOR.brand}
                theme={{ colors: { primary: COLOR.brand } }}
              />
            </FieldGroup>

            <FieldGroup>
              <FieldLabel label="Monto del salario" />
              <AmountField value={formData.amount} onChange={(v) => handleInputChange('amount', v)} error={errors.amount} />
              {errors.amount && <Text style={styles.fieldError}>El monto es obligatorio</Text>}
            </FieldGroup>

            <FieldGroup>
              <FieldLabel label="Fecha de pago" />
              <DateField label="Seleccionar fecha" value={formData.date} onPress={() => { setSelectedDateField('date'); setDatePickerVisible(true); }} error={errors.date} />
            </FieldGroup>

            {renderImagePicker()}
          </>
        );
      case 'bank-deposit':
        return renderBankDepositForm();

      default:
        return null;
    }
  };

  const renderBankDepositForm = () => {
    const expectedCash = pendingClosings.reduce((sum: number, c: any) => sum + (c.amount || 0), 0);
    const declared     = parseFloat(bankDeclaredAmount.replace(/,/g, '') || '0');
    const diff         = declared - expectedCash;
    const hasDiff      = declared > 0 && closingsLoaded;

    return (
      <>
        <FieldGroup>
          <FieldLabel label="Local" />
          <StoreSelector
            selectedStore={formData.storeId}
            onStoreChange={(storeId) => {
              handleInputChange('storeId', storeId);
              setClosingsLoaded(false);
              setPendingClosings([]);
            }}
            style={styles.storeSelector}
          />
        </FieldGroup>

        <FieldGroup>
          <FieldLabel label="Período a depositar" />
          <PeriodField onPress={() => setDateRangePickerVisible(true)} />
        </FieldGroup>

        <Button
          mode="outlined"
          onPress={searchPendingClosings}
          loading={loadingClosings}
          disabled={loadingClosings || !formData.storeId || !formData.periodStart}
          icon="magnify"
          style={{ borderRadius: RADIUS.r2, borderColor: COLOR.brand, marginBottom: SPACE.s3 }}
          textColor={COLOR.brandDeep}
        >
          Buscar cierres pendientes
        </Button>

        {/* Lista de cierres pendientes */}
        {closingsLoaded && (
          <>
            {pendingClosings.length === 0 ? (
              <View style={styles.bankEmptyBox}>
                <MaterialCommunityIcons name="bank-check" size={32} color={COLOR.income} />
                <Text style={styles.bankEmptyText}>No hay cierres pendientes en este periodo</Text>
                <Text style={[styles.bankEmptyText, { fontSize: FONT_SIZE.caption }]}>
                  Todos los cierres de este periodo ya fueron enviados al banco
                </Text>
              </View>
            ) : (
              <>
                <Text style={styles.bankSectionTitle}>
                  {pendingClosings.length} cierre{pendingClosings.length !== 1 ? 's' : ''} pendiente{pendingClosings.length !== 1 ? 's' : ''} de depositar
                </Text>
                {pendingClosings.map((c: any, i: number) => (
                  <View key={c.id} style={styles.bankClosingItem}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.bankClosingDate}>
                        {c.periodStart === c.periodEnd
                          ? c.periodStart
                          : `${c.periodStart} — ${c.periodEnd}`}
                      </Text>
                      <Text style={styles.bankClosingMeta}>
                        {c.closingsCount} cierre{c.closingsCount !== 1 ? 's' : ''} · {c.username}
                      </Text>
                    </View>
                    <Text style={styles.bankClosingAmount}>{formatHnl(c.amount)}</Text>
                  </View>
                ))}

                {/* Total efectivo esperado */}
                <View style={styles.bankExpectedBox}>
                  <Text style={styles.bankExpectedLabel}>Efectivo esperado en banco</Text>
                  <Text style={styles.bankExpectedAmount}>{formatHnl(expectedCash)}</Text>
                </View>

                {/* Monto a depositar */}
                <FieldGroup>
                  <FieldLabel label="Monto a depositar" />
                  <AmountField value={bankDeclaredAmount} onChange={setBankDeclaredAmount} />
                </FieldGroup>

                {/* Comparación — siempre en el árbol para evitar reflow al tipear */}
                <View style={[styles.bankCompareBox, !hasDiff && { display: 'none' }]}>
                  <View style={styles.bankCompareRow}>
                    <Text style={styles.bankCompareLabel}>Efectivo esperado</Text>
                    <Text style={styles.bankCompareValue}>{formatHnl(expectedCash)}</Text>
                  </View>
                  <View style={styles.bankCompareRow}>
                    <Text style={styles.bankCompareLabel}>Monto a depositar</Text>
                    <Text style={styles.bankCompareValue}>{formatHnl(declared)}</Text>
                  </View>
                  <View style={[styles.bankCompareRow, styles.bankCompareDivider]}>
                    <Text style={styles.bankCompareLabelBold}>Diferencia</Text>
                    <Text style={[styles.bankCompareValueBold, {
                      color: diff === 0 ? COLOR.ink : diff > 0 ? COLOR.income : COLOR.expense
                    }]}>
                      {diff === 0 ? 'Sin diferencia' : (diff > 0 ? '+' : '') + formatHnl(diff)}
                    </Text>
                  </View>
                  {diff === 0 && (
                    <Text style={styles.bankLegend}>✓ El monto coincide con el efectivo registrado.</Text>
                  )}
                  {diff > 0 && (
                    <Text style={[styles.bankLegend, { color: COLOR.income }]}>
                      Hay {formatHnl(diff)} de excedente sobre el efectivo esperado.
                    </Text>
                  )}
                  {diff < 0 && (
                    <Text style={[styles.bankLegend, { color: COLOR.expense }]}>
                      Falta {formatHnl(Math.abs(diff))} para completar el efectivo esperado.
                    </Text>
                  )}
                </View>

                {/* Fecha de depósito */}
                <FieldGroup>
                  <FieldLabel label="Fecha en banco" />
                  <DateField label="Fecha del depósito" value={bankDepositDate} onPress={() => { setSelectedDateField('date'); setDatePickerVisible(true); }} />
                </FieldGroup>

                {/* Notas */}
                <FieldGroup>
                  <FieldLabel label="Notas (opcional)" />
                  <TextInput
                    value={bankNotes}
                    onChangeText={setBankNotes}
                    mode="outlined"
                    placeholder="Observaciones..."
                    style={styles.input}
                    outlineColor={COLOR.border}
                    activeOutlineColor={COLOR.brand}
                    theme={{ colors: { primary: COLOR.brand } }}
                  />
                </FieldGroup>

                {renderImagePicker()}
              </>
            )}
          </>
        )}
      </>
    );
  };

  const TYPE_ICON: Record<string, string> = {
    CLOSING:  'bank-transfer',
    SUPPLIER: 'truck-delivery-outline',
    SALARY:   'account-cash-outline',
    income:   'arrow-down-circle-outline',
    expense:  'arrow-up-circle-outline',
    default:  'file-document-outline',
  };

  const TYPE_LABEL: Record<string, string> = {
    CLOSING:  'Cierre',
    SUPPLIER: 'Proveedor',
    SALARY:   'Salario',
    income:   'Ingreso',
    expense:  'Egreso',
  };

  const renderHistorial = () => (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: SPACE.s4, gap: SPACE.s2 }}>
      {historial.length === 0 && !histLoading && (
        <View style={{ alignItems: 'center', paddingVertical: SPACE.s8 }}>
          <MaterialCommunityIcons name="clipboard-text-outline" size={40} color={COLOR.inkDisabled} />
          <Text style={{ color: COLOR.inkMute, marginTop: SPACE.s2, fontSize: FONT_SIZE.body }}>
            No tenés operaciones registradas aún.
          </Text>
        </View>
      )}

      {historial.map(op => {
        const isIncome = op.type === 'income' || op.type === 'CLOSING';
        const isPending   = op.type === 'CLOSING' && (op as any).depositStatus === 'PENDING';
        const isDeposited = op.type === 'CLOSING' && (op as any).depositStatus === 'DEPOSITED';
        return (
        <View key={`${op.type}-${op.id}`} style={histStyles.card}>
          <View style={histStyles.row}>
            {/* Ícono */}
            <View style={[histStyles.iconWrap, { backgroundColor: isIncome ? COLOR.incomeTint : COLOR.expenseTint }]}>
              <MaterialCommunityIcons
                name={TYPE_ICON[op.type] ?? TYPE_ICON.default}
                size={20}
                color={isIncome ? COLOR.income : COLOR.expense}
              />
            </View>

            {/* Info */}
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.s2, flexWrap: 'wrap' }}>
                <Text style={histStyles.label}>{TYPE_LABEL[op.type] ?? op.type}</Text>
                {/* Badge estado bancario */}
                {isPending && (
                  <View style={histStyles.badgePending}>
                    <MaterialCommunityIcons name="bank-outline" size={10} color={COLOR.warn} />
                    <Text style={[histStyles.badgeText, { color: COLOR.warn }]}>Pendiente banco</Text>
                  </View>
                )}
                {isDeposited && (
                  <View style={histStyles.badgeDeposited}>
                    <MaterialCommunityIcons name="bank-check" size={10} color={COLOR.income} />
                    <Text style={[histStyles.badgeText, { color: COLOR.income }]}>En banco</Text>
                  </View>
                )}
              </View>
              {op.storeName && <Text style={histStyles.storeName}>{op.storeName}</Text>}
              {op.description ? (
                <Text style={histStyles.desc} numberOfLines={1}>{op.description}</Text>
              ) : null}
              <Text style={histStyles.date}>{op.date ? formatDate(op.date) : ''}</Text>
            </View>

            {/* Monto */}
            <Text style={[histStyles.amount, { color: isIncome ? COLOR.income : COLOR.expense }]}>
              {isIncome ? '+' : '-'}{formatHnl(op.amount)}
            </Text>
          </View>
        </View>
        );
      })}

      {histHasMore && (
        <TouchableOpacity style={histStyles.loadMore} onPress={() => loadHistorial(false)} disabled={histLoading}>
          {histLoading
            ? <ActivityIndicator size="small" color={COLOR.brand} />
            : <Text style={histStyles.loadMoreText}>Cargar más</Text>
          }
        </TouchableOpacity>
      )}
      {!histHasMore && historial.length > 0 && (
        <Text style={histStyles.endText}>— Fin del historial —</Text>
      )}
    </ScrollView>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <StatusBar barStyle="dark-content" backgroundColor={COLOR.brandTint} />

      {/* ── Tabs ── */}
      <View style={tabStyles.bar}>
        <TouchableOpacity
          style={[tabStyles.tab, activeTab === 'form' && tabStyles.tabActive]}
          onPress={() => setActiveTab('form')}
        >
          <MaterialCommunityIcons name="plus-circle-outline" size={16} color={activeTab === 'form' ? COLOR.brandDeep : COLOR.ink2} />
          <Text style={[tabStyles.tabText, activeTab === 'form' && tabStyles.tabTextActive]}>Nueva operación</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[tabStyles.tab, activeTab === 'historial' && tabStyles.tabActive]}
          onPress={() => setActiveTab('historial')}
        >
          <MaterialCommunityIcons name="history" size={16} color={activeTab === 'historial' ? COLOR.brandDeep : COLOR.ink2} />
          <Text style={[tabStyles.tabText, activeTab === 'historial' && tabStyles.tabTextActive]}>Mi historial</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'historial' ? renderHistorial() : (
      <ScrollView style={styles.scrollView} contentContainerStyle={{ paddingBottom: 120 }}>

        {/* ── Selector de tipo ── */}
        {!formType && (
          <View style={styles.typeSection}>
            <Text style={styles.typeSectionTitle}>¿Qué querés registrar?</Text>
            <View style={styles.typeGrid}>
              {([
                { value: 'closing-deposits',  icon: 'cash-register',          label: 'Cierre de caja',       desc: 'Cierre diario del local' },
                { value: 'bank-deposit',       icon: 'bank-outline',           label: 'Depósito bancario',    desc: 'Envío de dinero al banco' },
                { value: 'transaction',        icon: 'swap-horizontal-circle', label: 'Transacción',          desc: 'Ingreso o egreso directo' },
                { value: 'supplier-payments',  icon: 'truck-delivery-outline', label: 'Proveedor',            desc: 'Pago a proveedor' },
                { value: 'salary-payments',    icon: 'account-cash-outline',   label: 'Salario',              desc: 'Pago de salario' },
                { value: 'gasto-admin',        icon: 'office-building-cog',    label: 'Gasto administrativo', desc: 'Gasto entre locales' },
              ] as const).map(op => (
                <TouchableOpacity
                  key={op.value}
                  style={styles.typeCard}
                  onPress={() => setFormType(op.value)}
                  activeOpacity={0.8}
                >
                  <View style={styles.typeCardIcon}>
                    <MaterialCommunityIcons name={op.icon} size={28} color={COLOR.brandDeep} />
                  </View>
                  <Text style={styles.typeCardLabel}>{op.label}</Text>
                  <Text style={styles.typeCardDesc}>{op.desc}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* ── Formulario activo ── */}
        {formType && (
          <View style={styles.formSection}>
            {/* Header del tipo seleccionado */}
            <TouchableOpacity style={styles.formTypeHeader} onPress={() => { setFormType(''); setFormData({ type:'', amount:'', date: getCurrentFormattedDate(), description:'', closingsCount:'', periodStart:'', periodEnd:'', storeId: 0, supplier:'', imageUri:'' }); setErrors({}); }} activeOpacity={0.8}>
              <MaterialCommunityIcons name="chevron-left" size={20} color={COLOR.ink2} />
              <Text style={styles.formTypeHeaderText}>Cambiar tipo</Text>
            </TouchableOpacity>

            {renderFormFields()}

            <View style={styles.formActions}>
              <Button
                mode="contained"
                onPress={handleSubmit}
                disabled={isSubmitting}
                loading={isSubmitting}
                style={styles.submitButton}
                contentStyle={styles.buttonContent}
                labelStyle={styles.buttonText}
                buttonColor={COLOR.brand}
                textColor={COLOR.inkOnBrand}
              >
                {isSubmitting ? 'Enviando...' : 'Confirmar'}
              </Button>
              <Button
                mode="outlined"
                onPress={() => { clearData(); setFormType(''); }}
                style={styles.clearButton}
                contentStyle={styles.buttonContent}
                textColor={COLOR.ink2}
              >
                Cancelar
              </Button>
            </View>
          </View>
        )}
      </ScrollView>
      )}

      <DatePickerModal
        mode="single"
        visible={datePickerVisible}
        onDismiss={() => setDatePickerVisible(false)}
        onConfirm={handleDateConfirm}
        locale="es"
        date={formData.date ? parseDate(formData.date) : undefined}
        validRange={{ startDate: undefined, endDate: new Date() }}
      />

      <DatePickerModal
        mode="range"
        visible={dateRangePickerVisible}
        onDismiss={() => setDateRangePickerVisible(false)}
        onConfirm={handleDateRangeConfirm}
        locale="es"
        startDate={dateRange.startDate}
        endDate={dateRange.endDate}
      />

      {/* ── Modal de reconciliación bancaria ── */}
      <Modal visible={reconcModal} transparent animationType="fade" onRequestClose={() => setReconcModal(false)}>
        <View style={styles.reconcOverlay}>
          <View style={styles.reconcBox}>
            <Text style={styles.reconcTitle}>Verificación de depósito</Text>

            {reconcData && (
              <>
                {/* Info del periodo */}
                <View style={styles.reconcInfoRow}>
                  <MaterialCommunityIcons name="calendar-range" size={16} color={COLOR.ink2} />
                  <Text style={styles.reconcInfoText}>
                    Periodo: {reconcData.from} — {reconcData.to}
                  </Text>
                </View>
                <View style={styles.reconcInfoRow}>
                  <MaterialCommunityIcons name="receipt-text-outline" size={16} color={COLOR.ink2} />
                  <Text style={styles.reconcInfoText}>
                    {reconcData.saleCount} venta{reconcData.saleCount !== 1 ? 's' : ''} en efectivo registradas
                  </Text>
                </View>

                {/* Tabla de comparación */}
                <View style={styles.reconcTable}>
                  <View style={styles.reconcTableRow}>
                    <Text style={styles.reconcTableLabel}>Efectivo en sistema</Text>
                    <Text style={styles.reconcTableValue}>{formatHnl(reconcData.expectedCash)}</Text>
                  </View>
                  <View style={styles.reconcTableRow}>
                    <Text style={styles.reconcTableLabel}>Monto a depositar</Text>
                    <Text style={styles.reconcTableValue}>{formatHnl(reconcData.declaredAmount)}</Text>
                  </View>
                  <View style={[styles.reconcTableRow, styles.reconcTableDivider]}>
                    <Text style={styles.reconcDiffLabel}>Diferencia</Text>
                    <Text style={[
                      styles.reconcDiffValue,
                      reconcData.difference === 0 ? { color: COLOR.ink } :
                      reconcData.difference > 0  ? { color: COLOR.income } :
                                                   { color: COLOR.expense }
                    ]}>
                      {reconcData.difference === 0
                        ? formatHnl(0)
                        : (reconcData.difference > 0 ? '+' : '') + formatHnl(reconcData.difference)}
                    </Text>
                  </View>
                </View>

                {/* Leyenda */}
                {reconcData.difference === 0 && (
                  <Text style={styles.reconcLegend}>
                    ✓ El monto coincide exactamente con el efectivo registrado.
                  </Text>
                )}
                {reconcData.difference > 0 && (
                  <Text style={[styles.reconcLegend, { color: COLOR.income }]}>
                    Hay un excedente de {formatHnl(reconcData.difference)} sobre el efectivo esperado.
                  </Text>
                )}
                {reconcData.difference < 0 && (
                  <Text style={[styles.reconcLegend, { color: COLOR.expense }]}>
                    Falta {formatHnl(Math.abs(reconcData.difference))} respecto al efectivo esperado.
                  </Text>
                )}
              </>
            )}

            {/* Acciones */}
            <View style={styles.reconcActions}>
              <Button
                mode="outlined"
                onPress={() => setReconcModal(false)}
                textColor={COLOR.ink2}
                style={{ flex: 1, borderRadius: RADIUS.r2 }}
              >
                Revisar
              </Button>
              <Button
                mode="contained"
                onPress={confirmAndSubmit}
                buttonColor={COLOR.brand}
                textColor={COLOR.inkOnBrand}
                style={{ flex: 1, borderRadius: RADIUS.r2 }}
              >
                Confirmar
              </Button>
            </View>
          </View>
        </View>
      </Modal>

      {showMessageCard && (
        <Animated.View
          style={[
            styles.messageCard,
            {
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <Card style={messageType === 'success' ? styles.successCard : styles.errorCard}>
            <Card.Content>
              <Title style={styles.messageText}>{message}</Title>
            </Card.Content>
          </Card>
        </Animated.View>
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLOR.bg,
  },
  topSection: {
    backgroundColor: COLOR.brandTint,
    paddingVertical: SPACE.s3,
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACE.s3,
  },
  logo: {
    backgroundColor: COLOR.surface,
    borderWidth: 2,
    borderColor: COLOR.surface,
  },
  welcomeText: {
    color: COLOR.brandDeep,
    fontSize: FONT_SIZE.display,
    fontWeight: FONT_WEIGHT.bold as any,
    marginTop: SPACE.s3,
  },
  scrollView: {
    flex: 1,
  },
  card: {
    marginHorizontal: SPACE.s3,
    marginBottom: SPACE.s4,
    borderRadius: RADIUS.r4,
    elevation: 6,
    paddingVertical: 5,
  },
  cardTitle: {
    textAlign: 'center',
    fontSize: FONT_SIZE.h2,
    marginBottom: SPACE.s5,
    color: COLOR.ink,
    fontWeight: FONT_WEIGHT.bold as any,
  },
  formSectionTitle: {
    fontSize: FONT_SIZE.h3,
    color: COLOR.ink2,
    textAlign: 'center',
    marginBottom: SPACE.s3,
  },
  operationTypeContainer: {
    marginBottom: SPACE.s4,
  },
  radioGroupContainer: {
    marginBottom: SPACE.s4,
  },
  radioItem: {
    borderBottomWidth: 1,
    borderBottomColor: COLOR.border,
    paddingVertical: SPACE.s2,
  },
  radioLabel: {
    fontSize: FONT_SIZE.h3,
    color: COLOR.ink2,
  },
  fixedTypeContainer: {
    backgroundColor: COLOR.bgAlt,
    padding: SPACE.s3,
    borderRadius: RADIUS.r1,
    alignItems: 'center',
    marginBottom: SPACE.s4,
    borderWidth: 1,
    borderColor: COLOR.brand,
  },
  fixedTypeLabel: {
    fontSize: FONT_SIZE.h3,
    fontWeight: FONT_WEIGHT.bold as any,
    color: COLOR.ink2,
  },
  supplierListContainer: {
    marginBottom: SPACE.s4,
  },
  inputContainer: {
    marginBottom: SPACE.s3,
  },
  input: {
    backgroundColor: COLOR.surface,
  },
  buttonContainer: {
    marginTop: SPACE.s4,
  },
  submitButton: {
    marginBottom: SPACE.s3,
    borderRadius: RADIUS.full,
    elevation: 2,
  },
  clearButton: {
    borderRadius: RADIUS.full,
    elevation: 2,
  },
  buttonContent: {
    height: 52,
  },
  buttonText: {
    fontSize: FONT_SIZE.h3,
    fontWeight: FONT_WEIGHT.bold as any,
  },
  messageCard: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: SPACE.s4,
    zIndex: 2,
  },
  successCard: {
    backgroundColor: COLOR.income,
  },
  errorCard: {
    backgroundColor: COLOR.expense,
  },
  messageText: {
    color: COLOR.white,
    textAlign: 'center',
  },
  storeSelector: {
    marginBottom: SPACE.s4,
    backgroundColor: COLOR.bgAlt,
    padding: SPACE.s3,
    borderRadius: RADIUS.r1,
  },
  divisionContainer: {
    backgroundColor: COLOR.surface,
    padding: SPACE.s4,
    borderRadius: RADIUS.r1,
    marginVertical: SPACE.s3,
    borderWidth: 1,
    borderColor: COLOR.brand,
  },
  divisionTitle: {
    fontSize: FONT_SIZE.h3,
    fontWeight: FONT_WEIGHT.bold as any,
    color: COLOR.brandDark,
    marginBottom: SPACE.s4,
    textAlign: 'center',
  },
  totalAmount: {
    fontSize: FONT_SIZE.h3,
    color: COLOR.info,
    fontWeight: FONT_WEIGHT.bold as any,
    textAlign: 'center',
    marginBottom: SPACE.s4,
  },
  quickButtonsContainer: {
    marginBottom: SPACE.s4,
  },
  quickButtonsLabel: {
    fontSize: FONT_SIZE.caption,
    color: COLOR.ink2,
    marginBottom: SPACE.s3,
    textAlign: 'center',
  },
  quickButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: SPACE.s2,
  },
  quickButton: {
    backgroundColor: COLOR.infoTint,
    paddingVertical: 4,
    paddingHorizontal: SPACE.s3,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLOR.brand,
  },
  quickButtonText: {
    fontSize: FONT_SIZE.caption,
    color: COLOR.info,
    fontWeight: FONT_WEIGHT.medium as any,
  },
  localesContainer: {
    flexDirection: 'row',
    gap: SPACE.s3,
    marginBottom: SPACE.s4,
  },
  localCard: {
    flex: 1,
    backgroundColor: COLOR.bgAlt,
    padding: SPACE.s3,
    borderRadius: RADIUS.r1,
    borderWidth: 1,
    borderColor: COLOR.border,
    alignItems: 'center',
  },
  localName: {
    fontWeight: FONT_WEIGHT.bold as any,
    marginBottom: SPACE.s2,
    color: COLOR.ink2,
    fontSize: FONT_SIZE.label,
  },
  percentageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACE.s2,
  },
  percentageInput: {
    width: 60,
    height: 40,
    backgroundColor: COLOR.surface,
    textAlign: 'center',
  },
  percentageSymbol: {
    fontSize: FONT_SIZE.h3,
    fontWeight: FONT_WEIGHT.bold as any,
    color: COLOR.ink2,
    marginLeft: 4,
  },
  localAmount: {
    color: COLOR.info,
    fontWeight: FONT_WEIGHT.bold as any,
    fontSize: FONT_SIZE.h3,
  },
  validationContainer: {
    alignItems: 'center',
    paddingVertical: SPACE.s2,
  },
  validationSuccess: {
    color: COLOR.income,
    fontWeight: FONT_WEIGHT.bold as any,
    fontSize: FONT_SIZE.label,
  },
  validationError: {
    color: COLOR.expense,
    fontWeight: FONT_WEIGHT.bold as any,
    fontSize: FONT_SIZE.label,
  },
  summaryContainer: {
    backgroundColor: COLOR.infoTint,
    padding: SPACE.s4,
    borderRadius: RADIUS.r1,
    marginTop: SPACE.s4,
  },
  summaryTitle: {
    fontSize: FONT_SIZE.h3,
    fontWeight: FONT_WEIGHT.bold as any,
    color: COLOR.info,
    marginBottom: SPACE.s3,
    textAlign: 'center',
  },
  summaryText: {
    fontSize: FONT_SIZE.label,
    color: COLOR.info,
    marginBottom: 5,
  },
  summaryBold: {
    fontWeight: FONT_WEIGHT.bold as any,
  },

  // ── Helpers de campo ────────────────────────────────────────────────────────
  fieldGroup:        { marginBottom: SPACE.s4 },
  fieldLabel:        { fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.ink2, letterSpacing: 0.5, marginBottom: SPACE.s2 },
  fieldError:        { fontSize: FONT_SIZE.caption, color: COLOR.expense, marginTop: SPACE.s1 },

  // Campo de monto grande
  amountFieldWrap:   { flexDirection: 'row', alignItems: 'center', backgroundColor: COLOR.surface, borderWidth: 1.5, borderColor: COLOR.border, borderRadius: RADIUS.r2, paddingHorizontal: SPACE.s4, paddingVertical: SPACE.s2, gap: SPACE.s2 },
  amountFieldError:  { borderColor: COLOR.expense },
  amountPrefix:      { fontSize: FONT_SIZE.h1, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.ink2 },
  amountFieldInput:  { flex: 1, fontSize: FONT_SIZE.h1, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.ink, paddingVertical: SPACE.s2 } as any,

  // Campo de fecha
  dateField:         { flexDirection: 'row', alignItems: 'center', backgroundColor: COLOR.surface, borderWidth: 1.5, borderColor: COLOR.border, borderRadius: RADIUS.r2, paddingHorizontal: SPACE.s4, paddingVertical: SPACE.s3, gap: SPACE.s3 },
  dateFieldError:    { borderColor: COLOR.expense },
  dateFieldText:     { flex: 1, fontSize: FONT_SIZE.body, color: COLOR.ink, fontWeight: FONT_WEIGHT.medium as any },
  dateFieldPlaceholder: { color: COLOR.inkDisabled },

  // ── Selector de tipo ────────────────────────────────────────────────────────
  typeSection:       { padding: SPACE.s4 },
  typeSectionTitle:  { fontSize: FONT_SIZE.h3, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.ink, marginBottom: SPACE.s4 },
  typeGrid:          { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.s3 },
  typeCard:          { flexBasis: '47%', flexGrow: 1, backgroundColor: COLOR.surface, borderRadius: RADIUS.r3, borderWidth: 1.5, borderColor: COLOR.border, padding: SPACE.s4, alignItems: 'center', gap: SPACE.s2, ...SHADOW.sm },
  typeCardIcon:      { width: 56, height: 56, borderRadius: RADIUS.full, backgroundColor: COLOR.brandTint, justifyContent: 'center', alignItems: 'center' },
  typeCardLabel:     { fontSize: FONT_SIZE.label, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.ink, textAlign: 'center' },
  typeCardDesc:      { fontSize: FONT_SIZE.caption, color: COLOR.inkMute, textAlign: 'center' },

  // ── Sección de formulario activo ─────────────────────────────────────────
  formSection:       { padding: SPACE.s4, gap: SPACE.s3 },
  formTypeHeader:    { flexDirection: 'row', alignItems: 'center', gap: SPACE.s1, marginBottom: SPACE.s2 },
  formTypeHeaderText:{ fontSize: FONT_SIZE.label, color: COLOR.ink2, fontWeight: FONT_WEIGHT.medium as any },
  formActions:       { gap: SPACE.s2, marginTop: SPACE.s2 },

  // Formulario depósito bancario
  bankSectionTitle:     { fontSize: FONT_SIZE.label, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.ink2, marginBottom: SPACE.s2 },
  bankClosingItem:      { flexDirection: 'row', alignItems: 'center', backgroundColor: COLOR.bg, borderRadius: RADIUS.r2, padding: SPACE.s3, marginBottom: SPACE.s2, borderWidth: 1, borderColor: COLOR.border },
  bankClosingDate:      { fontSize: FONT_SIZE.label, fontWeight: FONT_WEIGHT.semibold as any, color: COLOR.ink },
  bankClosingMeta:      { fontSize: FONT_SIZE.caption, color: COLOR.inkMute, marginTop: 2 },
  bankClosingAmount:    { fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.ink },
  bankExpectedBox:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLOR.brandTint, borderRadius: RADIUS.r2, padding: SPACE.s3, marginBottom: SPACE.s3 },
  bankExpectedLabel:    { fontSize: FONT_SIZE.label, fontWeight: FONT_WEIGHT.semibold as any, color: COLOR.brandDeep },
  bankExpectedAmount:   { fontSize: FONT_SIZE.h3, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.brandDeep },
  bankCompareBox:       { backgroundColor: COLOR.bg, borderRadius: RADIUS.r2, padding: SPACE.s3, marginBottom: SPACE.s3, gap: SPACE.s2 },
  bankCompareRow:       { flexDirection: 'row', justifyContent: 'space-between' },
  bankCompareDivider:   { borderTopWidth: 1, borderTopColor: COLOR.border, paddingTop: SPACE.s2, marginTop: SPACE.s1 },
  bankCompareLabel:     { fontSize: FONT_SIZE.label, color: COLOR.ink2 },
  bankCompareValue:     { fontSize: FONT_SIZE.label, fontWeight: FONT_WEIGHT.semibold as any, color: COLOR.ink },
  bankCompareLabelBold: { fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.ink },
  bankCompareValueBold: { fontSize: FONT_SIZE.h3, fontWeight: FONT_WEIGHT.bold as any },
  bankLegend:           { fontSize: FONT_SIZE.caption, color: COLOR.inkMute, marginTop: 2 },
  bankEmptyBox:         { alignItems: 'center', padding: SPACE.s5, gap: SPACE.s2 },
  bankEmptyText:        { fontSize: FONT_SIZE.label, color: COLOR.inkMute, textAlign: 'center', fontWeight: FONT_WEIGHT.semibold as any },

  // Modal reconciliación bancaria
  reconcOverlay:     { flex: 1, backgroundColor: COLOR.overlay, justifyContent: 'center', alignItems: 'center', padding: SPACE.s4 },
  reconcBox:         { backgroundColor: COLOR.surface, borderRadius: RADIUS.r4, padding: SPACE.s5, width: '100%', maxWidth: 420, ...SHADOW.lg },
  reconcTitle:       { fontSize: FONT_SIZE.h2, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.ink, marginBottom: SPACE.s4 },
  reconcInfoRow:     { flexDirection: 'row', alignItems: 'center', gap: SPACE.s2, marginBottom: SPACE.s1 },
  reconcInfoText:    { fontSize: FONT_SIZE.label, color: COLOR.ink2 },
  reconcTable:       { backgroundColor: COLOR.bg, borderRadius: RADIUS.r2, padding: SPACE.s3, marginVertical: SPACE.s3, gap: SPACE.s2 },
  reconcTableRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reconcTableLabel:  { fontSize: FONT_SIZE.label, color: COLOR.ink2 },
  reconcTableValue:  { fontSize: FONT_SIZE.label, fontWeight: FONT_WEIGHT.semibold as any, color: COLOR.ink },
  reconcTableDivider:{ borderTopWidth: 1, borderTopColor: COLOR.border, paddingTop: SPACE.s2, marginTop: SPACE.s1 },
  reconcDiffLabel:   { fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.ink },
  reconcDiffValue:   { fontSize: FONT_SIZE.h3, fontWeight: FONT_WEIGHT.bold as any },
  reconcLegend:      { fontSize: FONT_SIZE.caption, color: COLOR.inkMute, marginBottom: SPACE.s3, lineHeight: 18 },
  reconcActions:     { flexDirection: 'row', gap: SPACE.s3, marginTop: SPACE.s2 },
});

const tabStyles = StyleSheet.create({
  bar:          { flexDirection: 'row', backgroundColor: COLOR.surface, borderBottomWidth: 1, borderBottomColor: COLOR.border },
  tab:          { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.s1, paddingVertical: SPACE.s3 },
  tabActive:    { borderBottomWidth: 2, borderBottomColor: COLOR.brand },
  tabText:      { fontSize: FONT_SIZE.label, fontWeight: FONT_WEIGHT.medium as any, color: COLOR.ink2 },
  tabTextActive:{ color: COLOR.brandDeep, fontWeight: FONT_WEIGHT.bold as any },
});

const histStyles = StyleSheet.create({
  card:           { backgroundColor: COLOR.surface, borderRadius: RADIUS.r3, borderWidth: 1, borderColor: COLOR.border, padding: SPACE.s3, ...SHADOW.sm },
  row:            { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.s3 },
  iconWrap:       { width: 40, height: 40, borderRadius: RADIUS.full, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  label:          { fontSize: FONT_SIZE.label, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.ink },
  storeName:      { fontSize: FONT_SIZE.caption, color: COLOR.ink2, fontWeight: FONT_WEIGHT.semibold as any, marginTop: 1 },
  desc:           { fontSize: FONT_SIZE.caption, color: COLOR.inkMute, marginTop: 1 },
  date:           { fontSize: FONT_SIZE.caption, color: COLOR.inkDisabled, marginTop: 2 },
  amount:         { fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold as any, flexShrink: 0 },
  // Badges estado bancario
  badgePending:   { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: COLOR.warnTint, borderRadius: RADIUS.full, paddingHorizontal: SPACE.s2, paddingVertical: 2 },
  badgeDeposited: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: COLOR.incomeTint, borderRadius: RADIUS.full, paddingHorizontal: SPACE.s2, paddingVertical: 2 },
  badgeText:      { fontSize: 10, fontWeight: FONT_WEIGHT.bold as any },
  loadMore:       { padding: SPACE.s3, borderRadius: RADIUS.r2, borderWidth: 1, borderColor: COLOR.border, alignItems: 'center', backgroundColor: COLOR.surface },
  loadMoreText:   { fontSize: FONT_SIZE.label, color: COLOR.ink2, fontWeight: FONT_WEIGHT.semibold as any },
  endText:        { textAlign: 'center', color: COLOR.inkDisabled, fontSize: FONT_SIZE.caption, paddingVertical: SPACE.s3 },
});

// ── Helpers de formato ───────────────────────────────────────────────────────
// Convierte 'yyyy-MM-dd' → 'dd/MM/yyyy' sin riesgo de offset de timezone.
const fmtDate = (s: string) => s.split('-').reverse().join('/');

// ── Componentes de nivel de módulo ───────────────────────────────────────────
// IMPORTANTE: todos definidos FUERA del componente padre.
// Si se definen dentro, React los considera un tipo nuevo en cada render
// → desmonta y remonta → el TextInput pierde el foco en cada keystroke.

const FieldLabel = ({ label }: { label: string }) => (
  <Text style={styles.fieldLabel}>{label.toUpperCase()}</Text>
);

const FieldGroup = ({ children }: { children: React.ReactNode }) => (
  <View style={styles.fieldGroup}>{children}</View>
);

const AmountField = ({ value, onChange, error }: {
  value: string;
  onChange: (v: string) => void;
  error?: boolean;
}) => (
  <View style={[styles.amountFieldWrap, error && styles.amountFieldError]}>
    <Text style={styles.amountPrefix}>L</Text>
    <RNTextInput
      style={styles.amountFieldInput}
      value={value}
      onChangeText={onChange}
      keyboardType="decimal-pad"
      placeholder="0.00"
      placeholderTextColor={COLOR.inkDisabled}
    />
  </View>
);

const DateField = ({ label, value, onPress, error }: {
  label: string;
  value: string;
  onPress: () => void;
  error?: boolean;
}) => (
  <TouchableOpacity style={[styles.dateField, error && styles.dateFieldError]} onPress={onPress} activeOpacity={0.7}>
    <MaterialCommunityIcons name="calendar" size={18} color={COLOR.brandDark} />
    <Text style={[styles.dateFieldText, !value && styles.dateFieldPlaceholder]}>
      {value ? fmtDate(value) : label}
    </Text>
    <MaterialCommunityIcons name="chevron-down" size={16} color={COLOR.inkMute} />
  </TouchableOpacity>
);

export default DynamicFormScreen;