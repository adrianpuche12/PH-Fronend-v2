import React, { useState, useEffect } from 'react';
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
  Image
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
import { formatAmountInput, parseFormattedNumber } from '../utils/numberFormat';
import { COLOR, SPACE, RADIUS, FONT_SIZE, FONT_WEIGHT, SHADOW } from '../theme';
import { ImageService } from '../utils/ImageService';
import ImagePicker from '../components/ImagePicker';

const BACKEND_URL = `${REACT_APP_API_URL}/api/forms`;
const TRANSACTIONS_URL = `${REACT_APP_API_URL}/transactions`;

const DynamicFormScreen = () => {
  const getCurrentFormattedDate = () => format(new Date(), 'yyyy-MM-dd');
  const parseDate = (dateString: string) => {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day, 12, 0, 0);
  };

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
    porcentajeDanli: number;
    porcentajeParaiso: number;
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
    porcentajeDanli: 50,
    porcentajeParaiso: 50,
    imageUri: '',
  });

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

  const [formType, setFormType] = useState<'transaction' | 'closing-deposits' | 'supplier-payments' | 'salary-payments' | 'gasto-admin' | ''>('');
  const [showMessageCard, setShowMessageCard] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const slideAnim = useState(new Animated.Value(-100))[0];
  const [errors, setErrors] = useState<{ [key: string]: boolean }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const today = new Date();
    setFormData(prevData => ({
      ...prevData,
      date: getCurrentFormattedDate()
    }));
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
    handleInputChange('porcentajeDanli', 50);
    handleInputChange('porcentajeParaiso', 50);
    setSelectedImage(null);
    setDateRange({
      startDate: undefined,
      endDate: undefined,
    });
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
      setFormData((prevData: FormDataType) => ({
        ...prevData,
        [selectedDateField]: formattedDate,
      }));
      setErrors((prevErrors) => ({ ...prevErrors, [selectedDateField]: false }));
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
      
      if ((formData.porcentajeDanli + formData.porcentajeParaiso) !== 100) {
        newErrors.porcentajes = true;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
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
              porcentajeDanli: formData.porcentajeDanli,
              porcentajeParaiso: formData.porcentajeParaiso,
              imageUri: imageUri,
            }
          : {
              ...formData,
              amount,
              store: { id: formData.storeId },
              username: 'default_user',
              date: formData.date,
              salaryDate: formData.date,
              paymentDate: formData.date,
              depositDate: formData.date,
              imageUri: imageUri,
            };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(basePayload),
      });

      if (response.ok) {
        if (formType === 'gasto-admin') {
          const result = await response.json();
          showMessage('success', `${result.mensaje} (ID: ${result.gastoAdminId})`);
        } else {
          showMessage('success', 'Datos enviados correctamente');
        }
        clearData();
        setFormType('');
        setErrors({});
      } else {
        const error = await response.json();
        showMessage('error', error.message || 'Error al enviar el formulario');
      }
    } catch (error) {
      showMessage('error', 'No se pudo conectar con el servidor');
    } finally {
      setIsSubmitting(false);
    }
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

  const renderGastoAdminForm = () => (
    <>     
      

      <View style={styles.inputContainer}>
        <TextInput
          label="Monto Total"
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
          placeholder="Monto a dividir entre locales"
        />
        {errors.amount && (
          <HelperText type="error" visible={true}>
            El monto debe ser mayor a 0
          </HelperText>
        )}
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
          placeholder="Descripción del gasto administrativo"
        />
        {errors.description && (
          <HelperText type="error" visible={true}>
            La descripción es obligatoria
          </HelperText>
        )}
      </View>

      <View style={styles.divisionContainer}>
        <Title style={styles.divisionTitle}>División entre Locales</Title>

        {formData.amount && parseFloat(formData.amount.replace(/,/g, '')) > 0 && (
          <Text style={styles.totalAmount}>
            Monto a dividir: ${parseFloat(formData.amount.replace(/,/g, '')).toFixed(2)}
          </Text>
        )}

        <View style={styles.quickButtonsContainer}>
          <Text style={styles.quickButtonsLabel}>Divisiones rápidas:</Text>
          <View style={styles.quickButtons}>
            {[
              { danli: 100, paraiso: 0, label: '100/0' },
              { danli: 70, paraiso: 30, label: '70/30' },
              { danli: 60, paraiso: 40, label: '60/40' },
              { danli: 50, paraiso: 50, label: '50/50' },
              { danli: 40, paraiso: 60, label: '40/60' },
              { danli: 30, paraiso: 70, label: '30/70' },
              { danli: 0, paraiso: 100, label: '0/100' }
            ].map(preset => (
              <TouchableOpacity
                key={preset.label}
                onPress={() => {
                  handleInputChange('porcentajeDanli', preset.danli);
                  handleInputChange('porcentajeParaiso', preset.paraiso);
                }}
                style={styles.quickButton}
              >
                <Text style={styles.quickButtonText}>{preset.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.localesContainer}>
          <View style={styles.localCard}>
            <Text style={styles.localName}>Danli</Text>
            <View style={styles.percentageContainer}>
              <TextInput
                mode="outlined"
                value={formData.porcentajeDanli.toString()}
                onChangeText={(value) => {
                  const numValue = parseInt(value) || 0;
                  const validValue = Math.max(0, Math.min(100, numValue));
                  handleInputChange('porcentajeDanli', validValue);
                  handleInputChange('porcentajeParaiso', Math.max(0, 100 - validValue));
                }}
                keyboardType="numeric"
                style={styles.percentageInput}
                maxLength={3}
                theme={{ colors: { primary: COLOR.brand } }}
              />
              <Text style={styles.percentageSymbol}>%</Text>
            </View>
            {formData.amount && (
              <Text style={styles.localAmount}>
                ${((parseFloat(formData.amount.replace(/,/g, '')) || 0) * formData.porcentajeDanli / 100).toFixed(2)}
              </Text>
            )}
          </View>

          <View style={styles.localCard}>
            <Text style={styles.localName}>El Paraíso</Text>
            <View style={styles.percentageContainer}>
              <TextInput
                mode="outlined"
                value={formData.porcentajeParaiso.toString()}
                onChangeText={(value) => {
                  const numValue = parseInt(value) || 0;
                  const validValue = Math.max(0, Math.min(100, numValue));
                  handleInputChange('porcentajeParaiso', validValue);
                  handleInputChange('porcentajeDanli', Math.max(0, 100 - validValue));
                }}
                keyboardType="numeric"
                style={styles.percentageInput}
                maxLength={3}
                theme={{ colors: { primary: COLOR.brand } }}
              />
              <Text style={styles.percentageSymbol}>%</Text>
            </View>
            {formData.amount && (
              <Text style={styles.localAmount}>
                ${((parseFloat(formData.amount.replace(/,/g, '')) || 0) * formData.porcentajeParaiso / 100).toFixed(2)}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.validationContainer}>
          {(formData.porcentajeDanli + formData.porcentajeParaiso) === 100 ? (
            <Text style={styles.validationSuccess}>
              ✅ Porcentajes válidos: {(formData.porcentajeDanli + formData.porcentajeParaiso)}%
            </Text>
          ) : (
            <Text style={styles.validationError}>
              ❌ Los porcentajes deben sumar 100% (actual: {(formData.porcentajeDanli + formData.porcentajeParaiso)}%)
            </Text>
          )}
        </View>
      </View>

      {formData.amount && formData.description && (formData.porcentajeDanli + formData.porcentajeParaiso) === 100 && (
        <View style={styles.summaryContainer}>
          <Title style={styles.summaryTitle}>Vista Previa</Title>
          <Text style={styles.summaryText}>
            <Text style={styles.summaryBold}>Se crearán 2 transacciones:</Text>
          </Text>
          <Text style={styles.summaryText}>
            • Danli ({formData.porcentajeDanli}%): ${((parseFloat(formData.amount.replace(/,/g, '')) || 0) * formData.porcentajeDanli / 100).toFixed(2)}
          </Text>
          <Text style={styles.summaryText}>
            • El Paraíso ({formData.porcentajeParaiso}%): ${((parseFloat(formData.amount.replace(/,/g, '')) || 0) * formData.porcentajeParaiso / 100).toFixed(2)}
          </Text>
        </View>
      )}
      {renderImagePicker()}
    </>
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
            <StoreSelector
              selectedStore={formData.storeId}
              onStoreChange={(storeId) => handleInputChange('storeId', storeId)}
              style={styles.storeSelector}
            />

            <View style={styles.inputContainer}>
              <TextInput
                label="Cantidad de cierres (opcional)"
                value={formData.closingsCount}
                onChangeText={(value) => handleInputChange('closingsCount', value)}
                keyboardType="numeric"
                mode="outlined"
                style={styles.input}
                left={<TextInput.Icon icon="counter" color={COLOR.brandDark} />}
                outlineColor={COLOR.border2}
                activeOutlineColor={COLOR.brand}
                theme={{ colors: { primary: COLOR.brand } }}
              />
            </View>
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
                label="Fecha de Depósito"
                value={formData.date ? format(parseDate(formData.date), 'yyyy-MM-dd') : ''}
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
                showSoftInputOnFocus={false}
              />
              {errors.date && (
                <HelperText type="error" visible={true}>
                  La fecha de depósito es obligatoria
                </HelperText>
              )}
            </View>

            <View style={styles.inputContainer}>
              <TextInput
                label="Periodo (Desde - Hasta)"
                value={formData.periodStart && formData.periodEnd ?
                  `${formData.periodStart} - ${formData.periodEnd}` :
                  ''}
                mode="outlined"
                onFocus={() => {
                  setDateRangePickerVisible(true);
                }}
                style={styles.input}
                error={errors.periodStart || errors.periodEnd}
                left={<TextInput.Icon icon="calendar-range" color={COLOR.brandDark} />}
                outlineColor={COLOR.border2}
                activeOutlineColor={COLOR.brand}
                theme={{ colors: { primary: COLOR.brand } }}
              />
              {(errors.periodStart || errors.periodEnd) && (
                <HelperText type="error" visible={true}>
                  Debe seleccionar el periodo completo
                </HelperText>
              )}
            </View>
            {renderImagePicker()}
          </>
        );
      case 'supplier-payments':
        return (
          <>
            <Title style={styles.formSectionTitle}>Selecciona un proveedor</Title>
            {renderSupplierList()}

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
      case 'salary-payments':
        return (
          <>
            <StoreSelector
              selectedStore={formData.storeId}
              onStoreChange={(storeId) => handleInputChange('storeId', storeId)}
              style={styles.storeSelector}
            />

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
            {renderImagePicker()}
          </>
        );
      default:
        return null;
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <StatusBar barStyle="dark-content" backgroundColor={COLOR.brandTint} />

      <View style={styles.topSection}>
        <View style={styles.logoContainer}>
          <Avatar.Image
            size={100}
            source={require('../assets/images/logo_proyecto_Humberto.jpg')}
            style={styles.logo}
          />
        </View>
        <Title style={styles.welcomeText}>Administración de Operaciones</Title>
      </View>

      <ScrollView style={styles.scrollView}>
        <Card style={styles.card}>
          <Card.Content>
            <Title style={styles.cardTitle}>Formulario de Operaciones</Title>

            <Title style={styles.formSectionTitle}>Seleccione tipo de operación</Title>
            
            <RadioButton.Group
              onValueChange={(value: any) => setFormType(value)}
              value={formType}
            >
              <View style={styles.operationTypeContainer}>
                <RadioButton.Item
                  label="Transacción"
                  value="transaction"
                  style={styles.radioItem}
                  labelStyle={styles.radioLabel}
                  color={COLOR.brandDark}
                />
                <RadioButton.Item
                  label="Gasto Administrativo"
                  value="gasto-admin"
                  style={styles.radioItem}
                  labelStyle={styles.radioLabel}
                  color={COLOR.brandDark}
                />
                <RadioButton.Item
                  label="Depósito de Cierres"
                  value="closing-deposits"
                  style={styles.radioItem}
                  labelStyle={styles.radioLabel}
                  color={COLOR.brandDark}
                />
                <RadioButton.Item
                  label="Pago a Proveedores"
                  value="supplier-payments"
                  style={styles.radioItem}
                  labelStyle={styles.radioLabel}
                  color={COLOR.brandDark}
                />
                <RadioButton.Item
                  label="Salarios"
                  value="salary-payments"
                  style={styles.radioItem}
                  labelStyle={styles.radioLabel}
                  color={COLOR.brandDark}
                />
              </View>
            </RadioButton.Group>

            {renderFormFields()}
            
            <View style={styles.buttonContainer}>
              <Button
                mode="contained"
                onPress={handleSubmit}
                disabled={isSubmitting}
                loading={isSubmitting}
                style={styles.submitButton}
                contentStyle={styles.buttonContent}
                labelStyle={styles.buttonText}
                buttonColor={COLOR.info}
              >
                {isSubmitting ? 'ENVIANDO...' : 'ENVIAR'}
              </Button>

              <Button
                mode="contained"
                onPress={clearData}
                style={styles.clearButton}
                contentStyle={styles.buttonContent}
                labelStyle={styles.buttonText}
                buttonColor={COLOR.warn}
              >
                ↻ LIMPIAR FORMULARIO
              </Button>
            </View>
          </Card.Content>
        </Card>
      </ScrollView>

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
    paddingVertical: 30,
    alignItems: 'center',
    borderBottomLeftRadius: RADIUS.r5,
    borderBottomRightRadius: RADIUS.r5,
    ...SHADOW.md,
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
    marginTop: -25,
  },
  card: {
    marginHorizontal: SPACE.s5,
    marginBottom: SPACE.s5,
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
    marginBottom: SPACE.s4,
    borderRadius: RADIUS.full,
    elevation: 2,
    paddingVertical: 5,
  },
  clearButton: {
    borderRadius: RADIUS.full,
    elevation: 2,
    paddingVertical: 5,
  },
  buttonContent: {
    paddingVertical: SPACE.s2,
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
});

export default DynamicFormScreen;