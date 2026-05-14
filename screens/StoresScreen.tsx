import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Button, TextInput, Snackbar, IconButton } from 'react-native-paper';
import axios from 'axios';
import { REACT_APP_API_URL } from '../config';
import ConfirmDialog from '../components/ConfirmDialog';

interface Store {
  id: number;
  name: string;
  address: string | null;
  phone: string | null;
  active: boolean;
}

interface StoreForm {
  name: string;
  address: string;
  phone: string;
}

const EMPTY_FORM: StoreForm = { name: '', address: '', phone: '' };

const StoresScreen = () => {
  const [stores, setStores]             = useState<Store[]>([]);
  const [loading, setLoading]           = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [form, setForm]                 = useState<StoreForm>(EMPTY_FORM);
  const [saving, setSaving]             = useState(false);
  const [snackbar, setSnackbar]         = useState('');
  const [confirmDlg, setConfirmDlg]     = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);
  const askConfirm = (title: string, message: string, onConfirm: () => void) =>
    setConfirmDlg({ title, message, onConfirm });

  const API = `${REACT_APP_API_URL}/api/v2/stores`;

  const loadStores = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get<Store[]>(API);
      setStores(res.data);
    } catch {
      setSnackbar('Error al cargar los locales');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadStores(); }, [loadStores]);

  const openCreate = () => {
    setEditingStore(null);
    setForm(EMPTY_FORM);
    setModalVisible(true);
  };

  const openEdit = (store: Store) => {
    setEditingStore(store);
    setForm({ name: store.name, address: store.address ?? '', phone: store.phone ?? '' });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setSnackbar('El nombre es obligatorio'); return; }
    setSaving(true);
    try {
      if (editingStore) {
        await axios.put(`${API}/${editingStore.id}`, form);
        setSnackbar('Local actualizado');
      } else {
        await axios.post(API, form);
        setSnackbar('Local creado');
      }
      setModalVisible(false);
      loadStores();
    } catch {
      setSnackbar('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = (store: Store) => {
    const accion = store.active ? 'desactivar' : 'activar';
    askConfirm(
      `${store.active ? 'Desactivar' : 'Activar'} local`,
      `¿Querés ${accion} el local "${store.name}"?`,
      async () => {
        try {
          await axios.put(`${API}/${store.id}/toggle`);
          setSnackbar(`Local ${store.active ? 'desactivado' : 'activado'}`);
          loadStores();
        } catch { setSnackbar('Error al cambiar estado'); }
        finally { setConfirmDlg(null); }
      }
    );
  };

  const handleDelete = (store: Store) => {
    askConfirm(
      'Eliminar local',
      `¿Eliminar "${store.name}"? Esta acción no se puede deshacer.`,
      async () => {
        try {
          await axios.delete(`${API}/${store.id}`);
          setSnackbar('Local eliminado');
          loadStores();
        } catch (e: any) {
          setSnackbar(e.response?.data?.error || 'No se puede eliminar — tiene historial de operaciones');
        } finally { setConfirmDlg(null); }
      }
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Locales</Text>
        <Button mode="contained" onPress={openCreate} buttonColor="#ffd43b" textColor="#161616">
          + Nuevo Local
        </Button>
      </View>

      {/* Lista */}
      {loading ? (
        <ActivityIndicator size="large" color="#ffd43b" style={styles.loader} />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {stores.length === 0 ? (
            <Text style={styles.empty}>No hay locales registrados.</Text>
          ) : (
            stores.map(store => (
              <View key={store.id} style={styles.card}>
                <View style={styles.cardInfo}>
                  <View style={styles.cardRow}>
                    <Text style={styles.storeName}>{store.name}</Text>
                    <View style={[styles.badge, store.active ? styles.badgeActive : styles.badgeInactive]}>
                      <Text style={[styles.badgeText, { color: store.active ? '#168542' : '#d32121' }]}>
                        {store.active ? 'Activo' : 'Inactivo'}
                      </Text>
                    </View>
                  </View>
                  {store.address ? <Text style={styles.storeDetail}>📍 {store.address}</Text> : null}
                  {store.phone   ? <Text style={styles.storeDetail}>📞 {store.phone}</Text> : null}
                </View>

                <View style={styles.cardActions}>
                  {/* Editar */}
                  <IconButton
                    icon="pencil"
                    size={22}
                    iconColor="#2f3944"
                    onPress={() => openEdit(store)}
                  />
                  {/* Activar / Desactivar */}
                  <IconButton
                    icon={store.active ? 'toggle-switch' : 'toggle-switch-off'}
                    size={22}
                    iconColor={store.active ? '#168542' : '#b8c0cc'}
                    onPress={() => handleToggle(store)}
                  />
                  {/* Eliminar */}
                  <IconButton
                    icon="trash-can"
                    size={22}
                    iconColor="#d32121"
                    onPress={() => handleDelete(store)}
                  />
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* Modal crear/editar */}
      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>{editingStore ? 'Editar Local' : 'Nuevo Local'}</Text>

            <TextInput label="Nombre *" value={form.name} onChangeText={v => setForm({ ...form, name: v })} style={styles.input} mode="outlined" />
            <TextInput label="Dirección" value={form.address} onChangeText={v => setForm({ ...form, address: v })} style={styles.input} mode="outlined" />
            <TextInput label="Teléfono" value={form.phone} onChangeText={v => setForm({ ...form, phone: v })} style={styles.input} mode="outlined" keyboardType="phone-pad" />

            <View style={styles.modalActions}>
              <Button mode="outlined" onPress={() => setModalVisible(false)} style={{ flex: 1 }}>Cancelar</Button>
              <Button mode="contained" onPress={handleSave} loading={saving} buttonColor="#ffd43b" textColor="#161616" style={{ flex: 1 }}>Guardar</Button>
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

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#f4f6f8' },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e8ecf2' },
  title:        { fontSize: 22, fontWeight: '900', color: '#161616' },
  loader:       { marginTop: 40 },
  list:         { padding: 16, gap: 12 },
  empty:        { textAlign: 'center', marginTop: 40, color: '#6b7581', fontSize: 15 },
  card:         { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#e8ecf2', elevation: 2 },
  cardInfo:     { flex: 1 },
  cardRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  storeName:    { fontSize: 16, fontWeight: '900', color: '#161616' },
  storeDetail:  { fontSize: 13, color: '#6b7581', marginTop: 2 },
  badge:        { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  badgeActive:  { backgroundColor: '#e9f8ef' },
  badgeInactive:{ backgroundColor: '#ffecec' },
  badgeText:    { fontSize: 12, fontWeight: '800' },
  cardActions:  { flexDirection: 'row', alignItems: 'center' },
  overlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modal:        { backgroundColor: '#fff', borderRadius: 18, padding: 24, width: '90%', maxWidth: 440 },
  modalTitle:   { fontSize: 20, fontWeight: '900', color: '#161616', marginBottom: 16 },
  input:        { marginBottom: 12 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
});

export default StoresScreen;
