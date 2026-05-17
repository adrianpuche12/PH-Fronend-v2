import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  SafeAreaView,
  useWindowDimensions,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Button, Snackbar, Checkbox } from 'react-native-paper';
import FormScreen from './FormScreen';
import ResponsiveButton from '../components/ui/responsiveButton';
import BalanceCalculator from '../components/BalanceCalculator';
import BalanceSummary from '../components/BalanceSummary';
import { REACT_APP_API_URL } from '../config';

interface Transaction {
  id: number;
  type: string;
  amount: number;
  date: string;
  description: string;
}

const TransactionsScreen = () => {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [editingTransaction, setEditingTransaction] = useState<any | null>(null);
  const [showFormScreen, setShowFormScreen] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showNoChangesModal, setShowNoChangesModal] = useState(false);
  const [modifiedField, setModifiedField] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<any | null>(null);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [showBalanceModal, setShowBalanceModal] = useState(false);

  const itemsPerPage = 5;
  const BACKEND_URL = `${REACT_APP_API_URL}/transactions`;
  const { width: screenWidth } = useWindowDimensions();

  // Consideramos pantalla chica/tablet si el ancho es menor a 768px.
  const isSmallScreen = screenWidth < 1026;

  // Función para crear nueva transacción
  const handleCreateNew = () => {
    setShowFormScreen(true);
  };

  // Función para eliminar transacción
  const handleDelete = async (transaction: any) => {
    setTransactionToDelete(transaction);
    setShowDeleteConfirmation(true);
  };

  const confirmDelete = async () => {
    if (!transactionToDelete) return;
  
    try {
      const response = await fetch(`${BACKEND_URL}/${transactionToDelete.id}`, {
        method: 'DELETE',
      });
  
      if (response.ok) {
        await fetchTransactions();
        Alert.alert('Éxito', 'Transacción eliminada correctamente');
      } else {
        Alert.alert('Error', 'No se pudo eliminar la transacción');
      }
    } catch (error) {
      Alert.alert('Error', 'Error de conexión al intentar eliminar');
    } finally {
      setShowDeleteConfirmation(false);
      setTransactionToDelete(null);
    }
  };

  const fetchTransactions = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(BACKEND_URL);
      if (response.ok) {
        const data = await response.json();
        setTransactions(data);
      } else {
        console.error('Error al obtener las transacciones', response.statusText);
      }
    } catch (error) {
      console.error('Error al obtener las transacciones', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  const filteredTransactions = transactions.filter(transaction => {
    if (filter === 'all') return true;
    return transaction.type === filter;
  });

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentTransactions = filteredTransactions.slice(indexOfFirstItem, indexOfLastItem);

  const goToPreviousPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const goToNextPage = () => {
    if (currentPage < Math.ceil(filteredTransactions.length / itemsPerPage))
      setCurrentPage(currentPage + 1);
  };

  const goToPage = (pageNumber: number) => {
    setCurrentPage(pageNumber);
  };

  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const maxPagesToShow = screenWidth < 768 ? 5 : screenWidth < 1024 ? 10 : 20;
  let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
  let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
  if (endPage - startPage + 1 < maxPagesToShow)
    startPage = Math.max(1, endPage - maxPagesToShow + 1);
  const pageNumbers = [];
  for (let i = startPage; i <= endPage; i++) {
    pageNumbers.push(i);
  }

  const handleFilterChange = (newFilter: 'all' | 'income' | 'expense') => {
    setFilter(newFilter);
    setCurrentPage(1);
  };

  const startEditing = (transaction: any) => {
    setEditingTransaction(transaction);
  };

  const handleChange = (field: string, value: string) => {
    setEditingTransaction((prevState: any) => ({
      ...prevState,
      [field]: value,
    }));
    setModifiedField(field);
  };

  const saveTransaction = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/${editingTransaction.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editingTransaction),
      });
  
      if (response.ok) {
        const updatedTransaction = await response.json();
        setTransactions((prevState: any) =>
          prevState.map((transaction: any) =>
            transaction.id === editingTransaction.id ? updatedTransaction : transaction
          )
        );
        setEditingTransaction(null);
      } else {
        console.error('Error al actualizar la transacción', response.statusText);
      }
    } catch (error) {
      console.error('Error al actualizar la transacción', error);
    } finally {
      setShowConfirmation(false);
      setModifiedField(null);
    }
  };

  const handleSaveClick = () => {
    if (!modifiedField) {
      setShowNoChangesModal(true);
      return;
    }
    setShowConfirmation(true);
  };

  const handleCancel = () => {
    setShowConfirmation(false);
    setModifiedField(null);
  };

  const handleCloseNoChangesModal = () => {
    setShowNoChangesModal(false);
  };

  const handleDeleteRequest = (transaction: any) => {
    Alert.alert(
      'Confirmar Borrado',
      `¿Estás seguro de que quieres borrar esta transacción?\n\nTipo: ${transaction.type}\nMonto: L${transaction.amount}\nFecha: ${transaction.date}\nDescripción: ${transaction.description}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Borrar', 
          style: 'destructive', 
          onPress: () => deleteTransaction(transaction.id)
        },
      ],
      { cancelable: true }
    );
  };

  const deleteTransaction = async (id: number) => {
    try {
      const response = await fetch(`${BACKEND_URL}/${id}`, { 
        method: 'DELETE',
      });
      if (!response.ok) {
        const errorMessage = await response.text();
        console.error('Error al borrar la transacción:', errorMessage);
        Alert.alert('Error', `No se pudo borrar la transacción. \nDetalles: ${errorMessage}`);
        return;
      }
      setTransactions((prevState: any) =>
        prevState.filter((transaction: any) => transaction.id !== id)
      );
      Alert.alert('Éxito', 'La transacción ha sido borrada correctamente.');
    } catch (error) {
      console.error('Error al borrar la transacción:', error);
      Alert.alert('Error', 'Ocurrió un error al intentar borrar la transacción.');
    } finally {
      setTransactionToDelete(null);
    }
  };

  if (showFormScreen) {
    return (
      <FormScreen
        onClose={() => {
          setShowFormScreen(false);
          fetchTransactions();
          setShowSuccessMessage(true);
        }}
      />
    );
  }

  const flatListRef = useRef<FlatList>(null);

  const handleEditFromBalance = (transaction: Transaction) => {
    const newFilter: 'all' | 'income' | 'expense' =
      transaction.type === 'income' ? 'income' : 'expense';
    setFilter(newFilter);
    
    setTimeout(() => {
      const getFilteredList = (transactions: Transaction[], filterType: 'all' | 'income' | 'expense') => {
        if (filterType === 'all') return transactions;
        return transactions.filter(t => t.type === filterType);
      };

      const filtered = getFilteredList(transactions, newFilter);
      const transactionIndex = filtered.findIndex(t => t.id === transaction.id);
      
      if (transactionIndex !== -1) {
        const pageNumber = Math.floor(transactionIndex / itemsPerPage) + 1;
        setCurrentPage(pageNumber);
        
        setTimeout(() => {
          setEditingTransaction(transaction);
          setShowBalanceModal(false);
          
          const indexInCurrentPage = transactionIndex % itemsPerPage;
          if (flatListRef.current) {
            flatListRef.current.scrollToIndex({
              index: indexInCurrentPage,
              animated: true,
              viewPosition: 0.5 
            });
          }
        }, 200);
      } else {
        setShowBalanceModal(false);
      }
    }, 200);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Título de la pantalla */}
      <Text style={styles.title}>Transacciones</Text>

      {/* Sección superior: se renderiza de forma distinta según el tamaño de pantalla */}
      {isSmallScreen ? (        
        <View style={styles.summaryContainerVertical}>
          <View style={styles.verticalBlock}>
            <ResponsiveButton 
              title="Cálculo de Balance" 
              onPress={() => setShowBalanceModal(true)} 
              mode="outlined"
            />
          </View>
          <View style={styles.verticalBlock}>
            <BalanceSummary transactions={transactions} />
          </View>
          <View style={styles.checkboxRow}>
            <View style={styles.checkboxItem}>
              <Checkbox
                status={filter === 'all' ? 'checked' : 'unchecked'}
                onPress={() => handleFilterChange('all')}
                color="#007bff"
              />
              <Text style={styles.filterText}>Todos</Text>
            </View>
            <View style={styles.checkboxItem}>
              <Checkbox
                status={filter === 'income' ? 'checked' : 'unchecked'}
                onPress={() => handleFilterChange('income')}
                color="#007bff"
              />
              <Text style={styles.filterText}>Ingresos</Text>
            </View>
            <View style={styles.checkboxItem}>
              <Checkbox
                status={filter === 'expense' ? 'checked' : 'unchecked'}
                onPress={() => handleFilterChange('expense')}
                color="#007bff"
              />
              <Text style={styles.filterText}>Egresos</Text>
            </View>
          </View>
        </View>
      ) : (
        // Layout horizontal para pantallas grandes:
        <View style={styles.summaryContainer}>
          <View style={[styles.leftCheckboxes, { width: '30%' }]}>
            <View style={styles.checkboxItem}>
              <Checkbox
                status={filter === 'all' ? 'checked' : 'unchecked'}
                onPress={() => handleFilterChange('all')}
                color="#007bff"
              />
              <Text style={styles.filterText}>Todos</Text>
            </View>
            <View style={styles.checkboxItem}>
              <Checkbox
                status={filter === 'income' ? 'checked' : 'unchecked'}
                onPress={() => handleFilterChange('income')}
                color="#007bff"
              />
              <Text style={styles.filterText}>Ingresos</Text>
            </View>
            <View style={styles.checkboxItem}>
              <Checkbox
                status={filter === 'expense' ? 'checked' : 'unchecked'}
                onPress={() => handleFilterChange('expense')}
                color="#007bff"
              />
              <Text style={styles.filterText}>Egresos</Text>
            </View>
          </View>
          <View style={[styles.centerCard, { width: '40%' }]}>
            <BalanceSummary transactions={transactions} />
          </View>
          <View style={[styles.rightButton, { width: '30%' }]}>
            <ResponsiveButton 
              title="Cálculo de Balance" 
              onPress={() => setShowBalanceModal(true)} 
              mode="outlined"
            />
          </View>
        </View>
      )}

      {/* Sección de listado, modales, paginación y demás */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Cargando datos desde la base de datos...</Text>
        </View>
      ) : (
        <>
          <FlatList
            ref={flatListRef}
            data={currentTransactions}
            style={{ flex: 1, minHeight: 200 }}
            contentContainerStyle={{ flexGrow: 1 }}
            renderItem={({ item }) => (
              <View style={styles.transactionCard}>  
                {editingTransaction && editingTransaction.id === item.id ? (
                  <View>
                    <Picker
                      selectedValue={editingTransaction.type}
                      onValueChange={(itemValue) => handleChange('type', itemValue)}
                      style={styles.input}
                    >
                      <Picker.Item label="Ingreso" value="income" />
                      <Picker.Item label="Egreso" value="expense" />
                    </Picker>

                    <TextInput
                      style={styles.input}
                      value={editingTransaction.amount.toString()}
                      onChangeText={(text) => handleChange('amount', text)}
                      keyboardType="numeric"
                    />
                    <TextInput
                      style={styles.input}
                      value={editingTransaction.date}
                      onChangeText={(text) => handleChange('date', text)}
                    />
                    <TextInput
                      style={styles.input}
                      value={editingTransaction.description}
                      onChangeText={(text) => handleChange('description', text)}
                    />
                    <TouchableOpacity
                      onPress={handleSaveClick}
                      style={styles.saveButton}
                    >
                      <Text style={styles.saveButtonText}>Guardar</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View>
                    <Text style={styles.transactionText}>
                      <Text style={styles.boldText}>Tipo:</Text> {item.type}
                    </Text>
                    <Text style={styles.transactionText}>
                      <Text style={styles.boldText}>Monto:</Text> L{item.amount}
                    </Text>
                    <Text style={styles.transactionText}>
                      <Text style={styles.boldText}>Fecha:</Text> {item.date}
                    </Text>
                    <Text style={styles.transactionText}>
                      <Text style={styles.boldText}>Descripción:</Text> {item.description}
                    </Text>
                    <View style={styles.buttonContainer}>
                      <TouchableOpacity
                        onPress={() => startEditing(item)}
                        style={styles.editButton}
                      >
                        <Text style={styles.buttonText}>Editar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDelete(item)}
                        style={styles.deleteButton}
                      >
                        <Text style={styles.buttonText}>Eliminar</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            )}
            keyExtractor={(item) => item.id.toString()}
          />

          <View style={styles.paginationContainer}>
            <TouchableOpacity
              onPress={goToPreviousPage}
              disabled={currentPage === 1}
              style={[
                styles.paginationButton,
                currentPage === 1 && styles.disabledButton,
              ]}
            >
              <Text style={styles.paginationText}>&lt;</Text>
            </TouchableOpacity>
            {pageNumbers.map((page) => (
              <TouchableOpacity
                key={page}
                onPress={() => goToPage(page)}
                style={[
                  styles.paginationButton,
                  currentPage === page && styles.activeButton,
                ]}
              >
                <Text
                  style={[
                    styles.paginationText,
                    currentPage === page && styles.activeText,
                  ]}
                >
                  {page}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              onPress={goToNextPage}
              disabled={currentPage === totalPages}
              style={[
                styles.paginationButton,
                currentPage === totalPages && styles.disabledButton,
              ]}
            >
              <Text style={styles.paginationText}>&gt;</Text>
            </TouchableOpacity>
          </View>

          <Modal
            visible={showConfirmation}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setShowConfirmation(false)}
          >
            <View style={styles.modalContainer}>
              <View style={styles.confirmationCard}>
                <Text style={styles.confirmationText}>
                  ¿Estás seguro de que quieres modificar esta transacción?
                </Text>
                <View style={styles.confirmationButtons}>
                  <TouchableOpacity
                    onPress={handleCancel}
                    style={styles.modalButtonCancel}
                  >
                    <Text style={styles.modalButtonText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={saveTransaction}
                    style={styles.modalButtonConfirm}
                  >
                    <Text style={styles.modalButtonText}>Modificar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          <Modal
            visible={showNoChangesModal}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setShowNoChangesModal(false)}
          >
            <View style={styles.modalContainer}>
              <View style={styles.confirmationCard}>
                <Text style={styles.confirmationText}>
                  No has modificado ningún campo. Por favor, realiza tu modificación.
                </Text>
                <View style={styles.confirmationButtons}>
                  <TouchableOpacity
                    onPress={handleCloseNoChangesModal}
                    style={styles.modalButtonConfirm}
                  >
                    <Text style={styles.modalButtonText}>Cerrar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          <Modal
            visible={showDeleteConfirmation}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setShowDeleteConfirmation(false)}
          >
            <View style={styles.modalContainer}>
              <View style={styles.confirmationCard}>
                <Text style={styles.confirmationText}>
                  ¿Estás seguro de que quieres eliminar esta transacción?
                </Text>
                <View style={styles.confirmationButtons}>
                  <TouchableOpacity
                    onPress={() => setShowDeleteConfirmation(false)}
                    style={styles.modalButtonCancel}
                  >
                    <Text style={styles.modalButtonText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={confirmDelete}
                    style={styles.modalButtonDelete}
                  >
                    <Text style={styles.modalButtonText}>Eliminar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        </>
      )}

      <Snackbar
        visible={showSuccessMessage}
        onDismiss={() => setShowSuccessMessage(false)}
        duration={3000}
        style={{ backgroundColor: '#4CAF50' }}
      >
        Transacción registrada correctamente
      </Snackbar>

      <BalanceCalculator
        visible={showBalanceModal}
        onDismiss={() => setShowBalanceModal(false)}
        transactions={transactions}
        onEdit={handleEditFromBalance} 
        onDelete={handleDelete}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    color: '#333',
    textAlign: 'center',
    marginBottom: 10,
    fontWeight: 'bold',
  },
  // Layout horizontal para pantallas grandes
  summaryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 8,
    backgroundColor: '#fff',
    borderRadius: 8,
    elevation: 3,
    marginBottom: 16,
  },
  // Layout vertical para celulares/tablets
  summaryContainerVertical: {
    flexDirection: 'column',
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#fff',
    borderRadius: 8,
    elevation: 3,
    marginBottom: 16,
  },
  verticalBlock: {
    width: '100%',
    alignItems: 'center',
    marginVertical: 8,
  },
  // Contenedor para checkboxes en fila
  checkboxRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    width: '100%',
  },
  leftCheckboxes: {
    justifyContent: 'center',
  },
  checkboxItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 2,
  },
  filterText: {
    fontSize: 14,
    color: '#555',
    marginLeft: 4,
  },
  centerCard: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  transactionCard: {
    padding: 16,
    marginBottom: 12,
    backgroundColor: 'white',
    borderRadius: 8,
    elevation: 3,
    width: '100%',
  },
  transactionText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
  },
  boldText: {
    fontWeight: 'bold',
  },
  input: {
    height: 40,
    borderColor: '#ccc',
    borderWidth: 1,
    marginBottom: 12,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    gap: 10,
  },
  editButton: {
    backgroundColor: '#107aff',
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
    flex: 1,
    marginRight: 5,
  },
  deleteButton: {
    backgroundColor: '#dc3545',
    padding: 10,
    borderRadius: 5,
    flex: 1,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  saveButton: {
    backgroundColor: '#28a745',
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
  },
  saveButtonText: {
    color: 'white',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#007AFF',
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    gap: 10,
    width: '100%',
  },
  paginationButton: {
    marginHorizontal: 5,
    padding: 10,
    borderRadius: 5,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ccc',
  },
  paginationText: {
    fontSize: 16,
    color: '#555',
  },
  activeButton: {
    backgroundColor: '#007bff',
    borderColor: '#007bff',
  },
  activeText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  disabledButton: {
    opacity: 0.5,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  confirmationCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 20,
    width: '80%',
    elevation: 5,
  },
  confirmationText: {
    fontSize: 18,
    color: '#333',
    textAlign: 'center',
    marginBottom: 20,
  },
  confirmationButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
  },
  modalButtonCancel: {
    backgroundColor: '#ff4444',
    padding: 10,
    borderRadius: 5,
    width: '45%',
    alignItems: 'center',
  },
  modalButtonConfirm: {
    backgroundColor: '#28a745',
    padding: 10,
    borderRadius: 5,
    width: '45%',
    alignItems: 'center',
  },
  modalButtonDelete: {
    backgroundColor: '#dc3545',
    padding: 10,
    borderRadius: 5,
    width: '45%',
    alignItems: 'center',
  },
  modalButtonText: {
    color: 'white',
    textAlign: 'center',
  },
});

export default TransactionsScreen;
