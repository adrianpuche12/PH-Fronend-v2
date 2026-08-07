import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Modal, useWindowDimensions,
} from 'react-native';
import { Button, TextInput, Snackbar, IconButton } from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import axios from 'axios';
import { REACT_APP_API_URL } from '../config';
import ConfirmDialog from '../components/ConfirmDialog';
import { COLOR, SPACE, RADIUS, FONT_SIZE, FONT_WEIGHT, SHADOW, BREAKPOINT } from '../theme';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Store { id: number; name: string; active: boolean; }

interface AppUser {
  id: number;
  fullName: string;
  username: string;
  status: string;
  storeId: number;
  storeName: string;
  createdAt: string;
}

interface UserForm {
  fullName: string;
  username: string;
  password: string;
  storeId: string;
}

const EMPTY_FORM: UserForm = { fullName: '', username: '', password: '', storeId: '' };

const statusLabel = (s: string) => s === 'ACTIVE' ? 'Activo' : 'Suspendido';
const statusColor = (s: string) => s === 'ACTIVE' ? '#168542' : '#d32121';

// ─── UsersScreen ──────────────────────────────────────────────────────────────

export default function UsersScreen() {
  const API = REACT_APP_API_URL;
  const { width } = useWindowDimensions();
  const isDesktop = width >= BREAKPOINT.desktop;

  const [users, setUsers]           = useState<AppUser[]>([]);
  const [stores, setStores]         = useState<Store[]>([]);
  const [loading, setLoading]       = useState(false);
  const [snackbar, setSnackbar]     = useState('');

  // Modal crear usuario
  const [createModal, setCreateModal] = useState(false);
  const [form, setForm]               = useState<UserForm>(EMPTY_FORM);
  const [saving, setSaving]           = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [createModalError, setCreateModalError] = useState('');
  const [createFieldErrors, setCreateFieldErrors] = useState<{fullName?:boolean; username?:boolean; password?:boolean; storeId?:boolean}>({});

  // Modal reasignar local
  const [reassignModal, setReassignModal]     = useState<AppUser | null>(null);
  const [reassignStoreId, setReassignStoreId] = useState('');
  const [reassigning, setReassigning]         = useState(false);
  const [reassignError, setReassignError]     = useState('');
  const [reassignStoreError, setReassignStoreError] = useState(false);

  // Modal reset password
  const [resetModal, setResetModal]     = useState<AppUser | null>(null);
  const [newPassword, setNewPassword]   = useState('');
  const [resetting, setResetting]       = useState(false);
  const [showNewPwd, setShowNewPwd]     = useState(false);
  const [resetError, setResetError]     = useState('');
  const [resetPwdError, setResetPwdError] = useState(false);

  // ConfirmDialog
  const [confirmDlg, setConfirmDlg] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);
  const askConfirm = (title: string, message: string, onConfirm: () => void) =>
    setConfirmDlg({ title, message, onConfirm });

  // ── Cargar datos ───────────────────────────────────────────────────────────

  const loadAll = useCallback(async () => {
    setLoading(true);
    // Carga independiente: si usuarios falla, locales igual se cargan para el formulario
    const [usersRes, storesRes] = await Promise.allSettled([
      axios.get<AppUser[]>(`${API}/api/v2/users`),
      axios.get<Store[]>(`${API}/api/v2/stores/active`),
    ]);
    if (usersRes.status === 'fulfilled')  setUsers(usersRes.value.data);
    else setSnackbar('Error al cargar usuarios');
    if (storesRes.status === 'fulfilled') setStores(storesRes.value.data);
    else setSnackbar('Error al cargar locales');
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Crear usuario ──────────────────────────────────────────────────────────

  const handleCreate = async () => {
    const errs: {fullName?:boolean; username?:boolean; password?:boolean; storeId?:boolean} = {};
    if (!form.fullName.trim())  errs.fullName = true;
    if (!form.username.trim())  errs.username = true;
    if (!form.password)         errs.password = true;
    if (!form.storeId)          errs.storeId  = true;
    if (Object.keys(errs).length > 0) {
      setCreateFieldErrors(errs);
      const missing = [
        errs.fullName && 'nombre completo',
        errs.username && 'username',
        errs.password && 'contraseña',
        errs.storeId  && 'local',
      ].filter(Boolean);
      setCreateModalError(`Completá los siguientes campos: ${missing.join(', ')}.`);
      return;
    }
    setCreateFieldErrors({});
    setCreateModalError('');
    setSaving(true);
    try {
      await axios.post(`${API}/api/v2/users`, {
        fullName: form.fullName.trim(),
        username: form.username.trim().toLowerCase(),
        password: form.password,
        storeId:  Number(form.storeId),
      });
      setSnackbar('Usuario creado correctamente');
      setCreateModal(false);
      setForm(EMPTY_FORM);
      loadAll();
    } catch (e: any) {
      setCreateModalError(e.response?.data?.error || 'No se pudo crear el usuario. Intentá de nuevo.');
    } finally { setSaving(false); }
  };

  // ── Suspender / Activar ────────────────────────────────────────────────────

  const handleSuspend = (user: AppUser) => {
    askConfirm(
      'Suspender usuario',
      `¿Suspender a "${user.fullName}"? No podrá iniciar sesión hasta que se reactive.`,
      async () => {
        try {
          await axios.put(`${API}/api/v2/users/${user.id}/suspend`);
          setSnackbar(`${user.fullName} suspendido`);
          loadAll();
        } catch (e: any) { setSnackbar(e.response?.data?.error || 'Error'); }
        finally { setConfirmDlg(null); }
      }
    );
  };

  const handleActivate = (user: AppUser) => {
    askConfirm(
      'Activar usuario',
      `¿Reactivar el acceso de "${user.fullName}"?`,
      async () => {
        try {
          await axios.put(`${API}/api/v2/users/${user.id}/activate`);
          setSnackbar(`${user.fullName} activado`);
          loadAll();
        } catch (e: any) { setSnackbar(e.response?.data?.error || 'Error'); }
        finally { setConfirmDlg(null); }
      }
    );
  };

  // ── Reasignar local ────────────────────────────────────────────────────────

  const handleReassign = async () => {
    if (!reassignStoreId) {
      setReassignStoreError(true);
      setReassignError('Seleccioná un local para reasignar al usuario.');
      return;
    }
    setReassignStoreError(false);
    setReassignError('');
    setReassigning(true);
    try {
      await axios.put(`${API}/api/v2/users/${reassignModal!.id}/reassign`, { storeId: Number(reassignStoreId) });
      setSnackbar('Local reasignado correctamente');
      setReassignModal(null);
      setReassignStoreId('');
      loadAll();
    } catch (e: any) { setReassignError(e.response?.data?.error || 'No se pudo reasignar el local. Intentá de nuevo.'); }
    finally { setReassigning(false); }
  };

  // ── Reset password ─────────────────────────────────────────────────────────

  const handleResetPassword = async () => {
    if (!newPassword.trim()) {
      setResetPwdError(true);
      setResetError('La nueva contraseña es obligatoria.');
      return;
    }
    setResetPwdError(false);
    setResetError('');
    setResetting(true);
    try {
      await axios.put(`${API}/api/v2/users/${resetModal!.id}/reset-password`, { password: newPassword });
      setSnackbar('Contraseña actualizada correctamente');
      setResetModal(null);
      setNewPassword('');
      loadAll();
    } catch (e: any) { setResetError(e.response?.data?.error || 'No se pudo cambiar la contraseña. Intentá de nuevo.'); }
    finally { setResetting(false); }
  };

  // ── Eliminar ───────────────────────────────────────────────────────────────

  const handleDelete = (user: AppUser) => {
    askConfirm(
      'Eliminar usuario',
      `¿Eliminar permanentemente a "${user.fullName}"? No podrá volver a iniciar sesión.`,
      async () => {
        try {
          await axios.delete(`${API}/api/v2/users/${user.id}`);
          setSnackbar('Usuario eliminado');
          loadAll();
        } catch (e: any) { setSnackbar(e.response?.data?.error || 'Error al eliminar'); }
        finally { setConfirmDlg(null); }
      }
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={styles.root}>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>👥 Usuarios</Text>
        <Button mode="contained" onPress={() => setCreateModal(true)} buttonColor={COLOR.brand} textColor={COLOR.inkOnBrand} style={{ borderRadius: 10 }}>
          + Nuevo usuario
        </Button>
      </View>

      {/* Tabla */}
      {loading ? (
        <ActivityIndicator size="large" color={COLOR.brand} style={{ marginTop: 40 }} />
      ) : users.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>👤</Text>
          <Text style={styles.emptyText}>No hay usuarios creados aún.</Text>
          <Text style={styles.emptySub}>Creá el primer usuario con el botón de arriba.</Text>
        </View>
      ) : (
        <ScrollView>
          {/* Header tabla */}
          {isDesktop && (
            <View style={[styles.row, styles.rowHeader]}>
              <Text style={[styles.cell, styles.cellName, styles.colHeader]}>Nombre</Text>
              <Text style={[styles.cell, styles.cellUser, styles.colHeader]}>Usuario</Text>
              <Text style={[styles.cell, styles.cellStore, styles.colHeader]}>Local</Text>
              <Text style={[styles.cell, styles.cellStatus, styles.colHeader]}>Estado</Text>
              <Text style={[styles.cell, styles.cellActions, styles.colHeader]}>Acciones</Text>
            </View>
          )}

          {users.map(user => (
            isDesktop ? (
              /* ── Desktop: tabla ── */
              <View key={user.id} style={[styles.row, user.status === 'SUSPENDED' && styles.rowSuspended]}>
                <View style={[styles.cell, styles.cellName]}>
                  <Text style={styles.userName}>{user.fullName}</Text>
                </View>
                <Text style={[styles.cell, styles.cellUser, styles.metaText]}>@{user.username}</Text>
                <Text style={[styles.cell, styles.cellStore, styles.metaText]}>{user.storeName}</Text>
                <View style={[styles.cell, styles.cellStatus]}>
                  <View style={[styles.statusBadge, { backgroundColor: statusColor(user.status) + '18', borderColor: statusColor(user.status) + '44' }]}>
                    <Text style={[styles.statusText, { color: statusColor(user.status) }]}>{statusLabel(user.status)}</Text>
                  </View>
                </View>
                <View style={[styles.cell, styles.cellActions]}>
                  {user.status === 'ACTIVE'
                    ? <IconButton icon="pause-circle" size={20} iconColor={COLOR.warn} onPress={() => handleSuspend(user)} style={{ margin: 0 }} />
                    : <IconButton icon="play-circle" size={20} iconColor={COLOR.income} onPress={() => handleActivate(user)} style={{ margin: 0 }} />
                  }
                  <IconButton icon="store-edit" size={20} iconColor={COLOR.info} onPress={() => { setReassignModal(user); setReassignStoreId(String(user.storeId)); }} style={{ margin: 0 }} />
                  <IconButton icon="lock-reset" size={20} iconColor={COLOR.ink2} onPress={() => { setResetModal(user); setNewPassword(''); }} style={{ margin: 0 }} />
                  <IconButton icon="delete" size={20} iconColor={COLOR.expense} onPress={() => handleDelete(user)} style={{ margin: 0 }} />
                </View>
              </View>
            ) : (
              /* ── Mobile: card ── */
              <View key={user.id} style={[styles.mobileCard, user.status === 'SUSPENDED' && styles.rowSuspended]}>
                {/* Fila 1: nombre + estado */}
                <View style={styles.mobileCardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.userName} numberOfLines={1}>{user.fullName}</Text>
                    <Text style={styles.userMeta}>@{user.username} · {user.storeName}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusColor(user.status) + '18', borderColor: statusColor(user.status) + '44' }]}>
                    <Text style={[styles.statusText, { color: statusColor(user.status) }]}>{statusLabel(user.status)}</Text>
                  </View>
                </View>
                {/* Fila 2: acciones */}
                <View style={styles.mobileCardActions}>
                  {user.status === 'ACTIVE'
                    ? <IconButton icon="pause-circle" size={22} iconColor={COLOR.warn} onPress={() => handleSuspend(user)} style={{ margin: 0 }} />
                    : <IconButton icon="play-circle" size={22} iconColor={COLOR.income} onPress={() => handleActivate(user)} style={{ margin: 0 }} />
                  }
                  <IconButton icon="store-edit" size={22} iconColor={COLOR.info} onPress={() => { setReassignModal(user); setReassignStoreId(String(user.storeId)); }} style={{ margin: 0 }} />
                  <IconButton icon="lock-reset" size={22} iconColor={COLOR.ink2} onPress={() => { setResetModal(user); setNewPassword(''); }} style={{ margin: 0 }} />
                  <IconButton icon="delete" size={22} iconColor={COLOR.expense} onPress={() => handleDelete(user)} style={{ margin: 0 }} />
                </View>
              </View>
            )
          ))}
        </ScrollView>
      )}

      {/* ── Modal crear usuario ── */}
      <Modal visible={createModal} transparent animationType="fade" onRequestClose={() => setCreateModal(false)}>
        <View style={styles.overlay}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 16 }}>
            <View style={[styles.modal, { width: '100%', maxWidth: 440 }]}>
              <Text style={styles.modalTitle}>Nuevo usuario</Text>

              <TextInput
                label="Nombre completo *" value={form.fullName}
                onChangeText={v => { setForm({ ...form, fullName: v }); if (v.trim()) setCreateFieldErrors(p => ({ ...p, fullName: false })); }}
                mode="outlined" style={styles.input} autoComplete="off"
                error={!!createFieldErrors.fullName}
                outlineColor={createFieldErrors.fullName ? COLOR.expense : undefined}
                activeOutlineColor={createFieldErrors.fullName ? COLOR.expense : COLOR.brand}
              />
              {createFieldErrors.fullName && <Text style={styles.fieldErrorText}>El nombre completo es obligatorio</Text>}

              <TextInput
                label="Username *" value={form.username}
                onChangeText={v => { setForm({ ...form, username: v.toLowerCase().replace(/\s+/g, '.') }); if (v.trim()) setCreateFieldErrors(p => ({ ...p, username: false })); }}
                mode="outlined" style={styles.input} autoCapitalize="none" autoComplete="off"
                error={!!createFieldErrors.username}
                outlineColor={createFieldErrors.username ? COLOR.expense : undefined}
                activeOutlineColor={createFieldErrors.username ? COLOR.expense : COLOR.brand}
              />
              {createFieldErrors.username && <Text style={styles.fieldErrorText}>El username es obligatorio</Text>}

              <TextInput
                label="Contraseña *" value={form.password}
                onChangeText={v => { setForm({ ...form, password: v }); if (v) setCreateFieldErrors(p => ({ ...p, password: false })); }}
                mode="outlined" style={styles.input}
                secureTextEntry={!showPassword}
                autoComplete="new-password"
                error={!!createFieldErrors.password}
                outlineColor={createFieldErrors.password ? COLOR.expense : undefined}
                activeOutlineColor={createFieldErrors.password ? COLOR.expense : COLOR.brand}
                right={<TextInput.Icon icon={showPassword ? 'eye-off' : 'eye'} onPress={() => setShowPassword(v => !v)} />}
              />
              {createFieldErrors.password && <Text style={styles.fieldErrorText}>La contraseña es obligatoria</Text>}

              {/* Selector de local */}
              <Text style={[styles.fieldLabel, createFieldErrors.storeId && { color: COLOR.expense }]}>Local *</Text>
              <View style={[styles.storeSelector, createFieldErrors.storeId && { borderColor: COLOR.expense, borderWidth: 1, borderRadius: 8, padding: 4 }]}>
                {stores.map(s => (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.storeChip, form.storeId === String(s.id) && styles.storeChipActive]}
                    onPress={() => { setForm({ ...form, storeId: String(s.id) }); setCreateFieldErrors(p => ({ ...p, storeId: false })); setCreateModalError(''); }}
                  >
                    <Text style={[styles.storeChipText, form.storeId === String(s.id) && styles.storeChipTextActive]}>
                      {s.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {createFieldErrors.storeId && <Text style={styles.fieldErrorText}>Seleccioná un local</Text>}

              <Text style={styles.roleNote}>El usuario recibirá el rol <Text style={{ fontWeight: '900' }}>user</Text> automáticamente.</Text>

              {!!createModalError && (
                <View style={styles.modalErrorBanner}>
                  <MaterialCommunityIcons name="alert-circle-outline" size={18} color={COLOR.expense} />
                  <Text style={styles.modalErrorText}>{createModalError}</Text>
                </View>
              )}

              <View style={styles.modalActions}>
                <Button mode="outlined" onPress={() => { setCreateModal(false); setForm(EMPTY_FORM); setCreateFieldErrors({}); setCreateModalError(''); }} style={{ flex: 1 }}>Cancelar</Button>
                <Button mode="contained" onPress={handleCreate} loading={saving} buttonColor={COLOR.brand} textColor={COLOR.inkOnBrand} style={{ flex: 1 }}>Crear usuario</Button>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ── Modal reasignar local ── */}
      <Modal visible={!!reassignModal} transparent animationType="fade" onRequestClose={() => { setReassignModal(null); setReassignError(''); setReassignStoreError(false); }}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Reasignar local</Text>
            <Text style={styles.modalSub}>{reassignModal?.fullName}</Text>
            <Text style={[styles.fieldLabel, reassignStoreError && { color: COLOR.expense }]}>Seleccioná el nuevo local:</Text>
            <View style={[styles.storeSelector, reassignStoreError && { borderColor: COLOR.expense, borderWidth: 1, borderRadius: 8, padding: 4 }]}>
              {stores.map(s => (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.storeChip, reassignStoreId === String(s.id) && styles.storeChipActive]}
                  onPress={() => { setReassignStoreId(String(s.id)); setReassignStoreError(false); setReassignError(''); }}
                >
                  <Text style={[styles.storeChipText, reassignStoreId === String(s.id) && styles.storeChipTextActive]}>
                    {s.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {reassignStoreError && <Text style={styles.fieldErrorText}>Seleccioná un local</Text>}
            {!!reassignError && (
              <View style={styles.modalErrorBanner}>
                <MaterialCommunityIcons name="alert-circle-outline" size={18} color={COLOR.expense} />
                <Text style={styles.modalErrorText}>{reassignError}</Text>
              </View>
            )}
            <View style={styles.modalActions}>
              <Button mode="outlined" onPress={() => { setReassignModal(null); setReassignError(''); setReassignStoreError(false); }} style={{ flex: 1 }}>Cancelar</Button>
              <Button mode="contained" onPress={handleReassign} loading={reassigning} buttonColor={COLOR.info} textColor={COLOR.white} style={{ flex: 1 }}>Reasignar</Button>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Modal reset password ── */}
      <Modal visible={!!resetModal} transparent animationType="fade" onRequestClose={() => { setResetModal(null); setNewPassword(''); setResetError(''); setResetPwdError(false); }}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Cambiar contraseña</Text>
            <Text style={styles.modalSub}>{resetModal?.fullName} (@{resetModal?.username})</Text>
            <TextInput
              label="Nueva contraseña *" value={newPassword}
              onChangeText={v => { setNewPassword(v); if (v.trim()) { setResetPwdError(false); setResetError(''); } }}
              mode="outlined" style={[styles.input, { marginTop: 12 }]}
              secureTextEntry={!showNewPwd}
              error={resetPwdError}
              outlineColor={resetPwdError ? COLOR.expense : undefined}
              activeOutlineColor={resetPwdError ? COLOR.expense : COLOR.brand}
              right={<TextInput.Icon icon={showNewPwd ? 'eye-off' : 'eye'} onPress={() => setShowNewPwd(v => !v)} />}
            />
            {resetPwdError && <Text style={styles.fieldErrorText}>La contraseña es obligatoria</Text>}
            {!!resetError && (
              <View style={styles.modalErrorBanner}>
                <MaterialCommunityIcons name="alert-circle-outline" size={18} color={COLOR.expense} />
                <Text style={styles.modalErrorText}>{resetError}</Text>
              </View>
            )}
            <View style={styles.modalActions}>
              <Button mode="outlined" onPress={() => { setResetModal(null); setNewPassword(''); setResetError(''); setResetPwdError(false); }} style={{ flex: 1 }}>Cancelar</Button>
              <Button mode="contained" onPress={handleResetPassword} loading={resetting} buttonColor={COLOR.brand} textColor={COLOR.inkOnBrand} style={{ flex: 1 }}>Guardar</Button>
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
      <Snackbar visible={!!snackbar} onDismiss={() => setSnackbar('')} duration={3000}>{snackbar}</Snackbar>
    </View>
  );
}

// ─── Estilos ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:           { flex: 1, backgroundColor: COLOR.bg },

  header:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: SPACE.s2, padding: SPACE.s4, backgroundColor: COLOR.surface, borderBottomWidth: 1, borderBottomColor: COLOR.border },
  headerTitle:    { fontSize: FONT_SIZE.h1, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.ink },

  empty:          { flex: 1, justifyContent: 'center', alignItems: 'center', gap: SPACE.s2, padding: SPACE.s8 },
  emptyIcon:      { fontSize: 40 },
  emptyText:      { fontSize: FONT_SIZE.h3, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.ink },
  emptySub:       { fontSize: FONT_SIZE.label, color: COLOR.inkMute },

  rowHeader:      { backgroundColor: COLOR.surface2, borderBottomWidth: 2, borderBottomColor: COLOR.border },
  row:            { flexDirection: 'row', alignItems: 'center', backgroundColor: COLOR.surface, borderBottomWidth: 1, borderBottomColor: COLOR.border, paddingHorizontal: SPACE.s1, minHeight: 56 },
  rowSuspended:   { opacity: 0.6, backgroundColor: COLOR.bgAlt },
  cell:           { paddingHorizontal: SPACE.s2, paddingVertical: SPACE.s2 },
  cellName:       { flex: 1 },
  cellUser:       { width: 140 },
  cellStore:      { width: 110 },
  cellStatus:     { width: 110 },
  cellActions:    { flexDirection: 'row', alignItems: 'center', width: 160 },
  colHeader:      { fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.inkMute } as any,

  userName:       { fontSize: FONT_SIZE.label, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.ink },
  userMeta:       { fontSize: FONT_SIZE.caption, color: COLOR.inkMute, fontWeight: FONT_WEIGHT.medium as any, marginTop: 2 },
  metaText:       { fontSize: FONT_SIZE.label, color: COLOR.ink2, fontWeight: FONT_WEIGHT.medium as any },

  statusBadge:    { borderRadius: RADIUS.r1, paddingHorizontal: SPACE.s2, paddingVertical: 4, borderWidth: 1, alignSelf: 'flex-start' },
  statusText:     { fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold as any },

  overlay:        { flex: 1, backgroundColor: COLOR.overlay, justifyContent: 'center', alignItems: 'center' },
  modal:          { backgroundColor: COLOR.surface, borderRadius: RADIUS.r4, padding: SPACE.s5, width: '92%', maxWidth: 440, gap: SPACE.s1 },
  modalTitle:     { fontSize: FONT_SIZE.h1, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.ink, marginBottom: SPACE.s1 },
  modalSub:       { fontSize: FONT_SIZE.label, color: COLOR.ink2, fontWeight: FONT_WEIGHT.semibold as any, marginBottom: SPACE.s2 },
  modalActions:     { flexDirection: 'row', gap: SPACE.s2, marginTop: SPACE.s3 },
  modalErrorBanner: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s2, backgroundColor: '#FEE2E2', borderRadius: RADIUS.r2, padding: SPACE.s3, marginTop: SPACE.s2, borderLeftWidth: 3, borderLeftColor: COLOR.expense },
  modalErrorText:   { flex: 1, fontSize: FONT_SIZE.label, color: '#991B1B', fontWeight: FONT_WEIGHT.semibold as any },
  fieldErrorText:   { fontSize: FONT_SIZE.caption, color: COLOR.expense, marginTop: -SPACE.s2, marginBottom: SPACE.s2, marginLeft: 4 },
  input:          { marginBottom: SPACE.s2 },
  fieldLabel:     { fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.inkMute, marginBottom: SPACE.s2, marginTop: SPACE.s1 },

  storeSelector:  { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.s2, marginBottom: SPACE.s3 },
  storeChip:      { paddingHorizontal: SPACE.s4, paddingVertical: SPACE.s2, borderRadius: RADIUS.full, backgroundColor: COLOR.bg, borderWidth: 1, borderColor: COLOR.border },
  storeChipActive:{ backgroundColor: COLOR.brand, borderColor: COLOR.brandDark },
  storeChipText:  { fontSize: FONT_SIZE.label, fontWeight: FONT_WEIGHT.semibold as any, color: COLOR.ink2 },
  storeChipTextActive: { color: COLOR.ink, fontWeight: FONT_WEIGHT.bold as any },

  roleNote:       { fontSize: FONT_SIZE.caption, color: COLOR.inkMute, backgroundColor: COLOR.bgAlt, borderRadius: RADIUS.r2, padding: SPACE.s2, marginBottom: SPACE.s1 },

  mobileCard:       { backgroundColor: COLOR.surface, borderBottomWidth: 1, borderBottomColor: COLOR.border, paddingHorizontal: SPACE.s4, paddingVertical: SPACE.s3, gap: SPACE.s2 },
  mobileCardTop:    { flexDirection: 'row', alignItems: 'center', gap: SPACE.s3 },
  mobileCardActions:{ flexDirection: 'row', alignItems: 'center' },
});
