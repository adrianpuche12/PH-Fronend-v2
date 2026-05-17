import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Modal,
  Text,
} from 'react-native';
import { TextInput, Button, Card, Title, SegmentedButtons } from 'react-native-paper';
import { DatePickerModal } from 'react-native-paper-dates';
import { Picker } from '@react-native-picker/picker';
import ResponsiveButton from '../components/ui/responsiveButton';
import { REACT_APP_API_URL } from '../config';

interface FormScreenProps {
  onClose?: () => void;
}

const FormScreen: React.FC<FormScreenProps> = ({ onClose }) => {
  const [type, setType] = useState('income');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState<Date | undefined>();
  const [description, setDescription] = useState('');
  const [open, setOpen] = useState(false);
  const [showMessageCard, setShowMessageCard] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const slideAnim = useState(new Animated.Value(-100))[0]; // Inicia fuera de la pantalla
  const [selectedStore, setSelectedStore] = useState<number>(1);

  const [modalVisible, setModalVisible] = useState(false);

  const BACKEND_URL = `${REACT_APP_API_URL}/transactions`

  const handleOpenModal = () => {
    if (!type || !amount || !date || !description) {
      showMessage('Todos los campos son obligatorios.', 'error');
      return;
    }
  
    const amountRegex = /^[0-9]+([.,][0-9]{1,2})?$/;
    if (!amountRegex.test(amount)) {
      showMessage('El monto debe ser un número válido (ej. 100.50).', 'error');
      return;
    }
  
    setModalVisible(true); // Si pasa las validaciones, abre el modal
  };

  const clearData = () => {
    setType('income');
    setAmount('');
    setDate(undefined);
    setDescription('');
    setSelectedStore(1);
  };

  const showMessage = (message: string, type: 'success' | 'error') => {
    setMessage(message);
    setMessageType(type);
    setShowMessageCard(true);

    // Animación de entrada
    Animated.timing(slideAnim, {
      toValue: 0, // Desliza hacia la posición 0
      duration: 300,
      useNativeDriver: true,
    }).start();

    // Ocultar después de 3 segundos
    setTimeout(() => hideMessage(), 3000);
  };

  const hideMessage = () => {
    // Animación de salida
    Animated.timing(slideAnim, {
      toValue: -100, // Desliza fuera de la pantalla
      duration: 300,
      useNativeDriver: true,
    }).start(() => setShowMessageCard(false));
  };

  const handleSubmit = async () => {
    // Validación de campos vacíos
    if (!type || !amount || !date || !description) {
      showMessage('Todos los campos son obligatorios.', 'error');
      return;
    }

    // Validación del campo amount (solo números, puntos y comas)
    const amountRegex = /^[0-9]+([.,][0-9]{1,2})?$/;
    if (!amountRegex.test(amount)) {
      showMessage('El monto debe ser un número válido (ej. 100.50).', 'error');
      return;
    }

    const transactionData = {
      type,
      amount: parseFloat(amount.replace(',', '.')), // Convertir coma a punto para el backend
      date: date.toISOString().split('T')[0],
      description,
      store: { id: selectedStore },
    };

    try {
      const response = await fetch(BACKEND_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(transactionData),
      });

      if (response.ok) {
        setModalVisible(false);
        showMessage('Transacción registrada correctamente.', 'success');
        
        // Limpiar todos los campos después de un envío exitoso
        clearData();
        onClose?.();
      } else {
        const error = await response.json();
        setModalVisible(false);
        showMessage(error.message || 'Error al registrar la transacción.', 'error');
      }
    } catch (error) {
      setModalVisible(false);
      showMessage('No se pudo conectar con el servidor.', 'error');
    }
  };

  const onConfirm = (params: { date: Date | undefined }) => {
    setOpen(false);
    setDate(params.date);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      {/* Contenido desplazable */}
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Card style={styles.card}>
          <Card.Content>
            <Title style={styles.title}>Registrar Transacción</Title>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={type}
                onValueChange={(itemValue) => setType(itemValue)}
                style={styles.picker}
              >
                <Picker.Item label="Ingreso" value="income" />
                <Picker.Item label="Egreso" value="expense" />
              </Picker>
            </View>
            
            {/* Selector de Local */}
            <View style={styles.storeContainer}>
              <Text style={styles.storeLabel}>Seleccionar Local:</Text>
              <SegmentedButtons
                value={selectedStore.toString()}
                onValueChange={(value) => setSelectedStore(Number(value))}
                buttons={[
                  { value: '1', label: 'Danli' },
                  { value: '2', label: 'El Paraiso' },
                ]}
                style={styles.storeSelector}
              />
            </View>
            
            <TextInput
              label="Monto (ej. 100.50)"
              value={amount}
              onChangeText={(text) => setAmount(text.replace(/[^0-9.,]/g, ''))} // Solo permite números, puntos y comas
              keyboardType="numeric"
              mode="outlined"
              style={styles.input}
            />
            <TextInput
              label="Fecha"
              value={date ? date.toISOString().split('T')[0] : ''}
              mode="outlined"
              style={styles.input}
              onFocus={() => setOpen(true)}
              showSoftInputOnFocus={false}
            />
            <DatePickerModal
              mode="single"
              visible={open}
              onDismiss={() => setOpen(false)}
              date={date || new Date()}
              onConfirm={onConfirm}
              locale="es"
            />
            <TextInput
              label="Descripción"
              value={description}
              onChangeText={setDescription}
              mode="outlined"
              style={styles.input}
            />
            
            <ResponsiveButton title="Enviar" onPress={handleOpenModal} mode="contained"/>
            <ResponsiveButton title="↻ Limpiar Formulario" onPress={clearData} mode="contained"/>
          </Card.Content>
        </Card>
      </ScrollView>

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.title}>Informacion a enviar</Text>
            <View>
              <Text style={styles.modalText}>Tipo: {type}</Text>
              <Text style={styles.modalText}>Local: {selectedStore === 1 ? 'Danli' : 'El Paraiso'}</Text>
              <Text style={styles.modalText}>Monto: {amount}</Text>
              <Text style={styles.modalText}>Fecha: {date ? date.toISOString().split('T')[0] : ''}</Text>
              <Text style={styles.modalText}>Descripción: {description}</Text>
            </View>
            <View style={{ borderTopWidth: 1, borderTopColor: '#ccc', marginTop: 20, paddingTop: 10, width: '100%' }}>
              <Button style={styles.button} onPress={handleSubmit} mode="contained">
                Confirmar
              </Button>
              <Button style={styles.button} onPress={() => setModalVisible(false)} mode="outlined">
                Cerrar
              </Button>
            </View>
          </View>
        </View>
      </Modal>


      {/* Tarjeta de mensajes con animación de slide */}
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
    backgroundColor: '#f5f5f5',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 16,
    marginTop: 0, // Ajusta este valor para que el formulario comience lo más arriba posible
  },
  card: {
    borderRadius: 8,
    elevation: 4,
    backgroundColor: 'white',
  },
  title: {
    fontSize: 24,
    marginBottom: 16,
    textAlign: 'center',
  },
  input: {
    marginBottom: 16,
    height: 56,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    marginBottom: 16,
    justifyContent: 'center',
    height: 56,
  },
  picker: {
    width: '100%',
    height: '100%',
  },
  storeContainer: {
    marginBottom: 16,
  },
  storeLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#555',
  },
  storeSelector: {
    marginTop: 5,
  },
  button: {
    marginTop: 16,
  },
  messageCard: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: 16,
    zIndex: 2, // Asegura que esté por encima del AdminDashboard
  },
  successCard: {
    backgroundColor: '#4CAF50',
  },
  errorCard: {
    backgroundColor: '#F44336',
  },
  messageText: {
    color: 'white',
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '85%',
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 10,
    alignItems: 'center',
  },
  modalText: {
    fontSize: 20,
    marginBottom: 10,
  },
  
});

export default FormScreen;