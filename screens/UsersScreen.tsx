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
import UserCreationWizard from '../components/UserCreationWizard';
import { COLOR, SPACE, RADIUS, FONT_SIZE, FONT_WEIGHT, SHADOW, BREAKPOINT } from '../theme';
import { ALL_SECTIONS, SECTION_GROUPS } from '../constants/sections';

// ─── Toggle visual (sin Switch nativo — no respeta trackColor en web) ────────

const ToggleSwitch = ({ value }: { value: boolean }) => (
  <View style={{ width: 44, height: 24, borderRadius: 12, backgroundColor: value ? COLOR.brandDark : COLOR.border2, padding: 2, justifyContent: 'center' }}>
    <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: COLOR.surface, alignSelf: value ? 'flex-end' : 'flex-start', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.18, shadowRadius: 2, elevation: 2 }} />
  </View>
);

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Store { id: number; name: string; active: boolean; }

interface AppUser {
  id: number;
  fullName: string;
  username: string;
  email: string;
  role: string;
  status: string;
  storeId: number | null;
  storeName: string | null;
  storeIds: number[];
  permissions: string[];
  firstLogin: boolean;
  createdAt: string;
}


const ROLES = ['ENCARGADO', 'CONTADOR', 'SOCIO'];
const ALL_SECTION_KEYS = ALL_SECTIONS.map(s => s.key);

const roleLabel = (r: string) => ({
  ENCARGADO: 'Encargado',
  CONTADOR:  'Contador',
  SOCIO:     'Socio',
}[r] ?? r);

const statusLabel = (s: string) => s === 'ACTIVE' ? 'Activo' : 'Suspendido';
const statusColor = (s: string) => s === 'ACTIVE' ? COLOR.income : COLOR.expense;

// ─── UsersScreen ──────────────────────────────────────────────────────────────

export default function UsersScreen() {
  const API = REACT_APP_API_URL;
  const { width } = useWindowDimensions();
  const isDesktop = width >= BREAKPOINT.desktop;

  const [users, setUsers]       = useState<AppUser[]>([]);
  const [stores, setStores]     = useState<Store[]>([]);
  const [loading, setLoading]   = useState(false);
  const [snackbar, setSnackbar] = useState('');

  // Wizard de creación de usuario
  const [createModal, setCreateModal] = useState(false);

  // Modal reasignar local
  const [reassignModal, setReassignModal]     = useState<AppUser | null>(null);
  const [reassignStoreId, setReassignStoreId] = useState('');
  const [reassigning, setReassigning]         = useState(false);

  // Modal reset password
  const [resetModal, setResetModal] = useState<AppUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetting, setResetting]     = useState(false);
  const [showNewPwd, setShowNewPwd]   = useState(false);

  // Modal permisos
  const [permModal, setPermModal]         = useState<AppUser | null>(null);
  const [permSelected, setPermSelected]   = useState<string[]>([]);
  const [savingPerm, setSavingPerm]       = useState(false);

  // Modal acceso multi-tienda
  const [storeModal, setStoreModal]         = useState<AppUser | null>(null);
  const [storeSelected, setStoreSelected]   = useState<number[]>([]);
  const [savingStore, setSavingStore]       = useState(false);

  // Modal contraseña temporal
  const [tempPwdModal, setTempPwdModal] = useState<{ fullName: string; username: string; password: string } | null>(null);
  const [tempPwdCopied, setTempPwdCopied] = useState(false);

  // ConfirmDialog
  const [confirmDlg, setConfirmDlg] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const askConfirm = (title: string, message: string, onConfirm: () => void) =>
    setConfirmDlg({ title, message, onConfirm });

  // ── Cargar datos ───────────────────────────────────────────────────────────

  const loadAll = useCallback(async () => {
    setLoading(true);
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

  // ── Suspender / Activar ────────────────────────────────────────────────────

  const handleSuspend = (user: AppUser) => {
    askConfirm(
      'Suspender usuario',
      `Suspender a "${user.fullName}"? No podra iniciar sesion hasta que se reactive.`,
      async () => {
        setConfirmLoading(true);
        try {
          await axios.put(`${API}/api/v2/users/${user.id}/suspend`);
          setSnackbar(`${user.fullName} suspendido`);
        } catch (e: any) { setSnackbar(e.response?.data?.error || 'Error'); }
        finally { setConfirmLoading(false); setConfirmDlg(null); loadAll(); }
      }
    );
  };

  const handleActivate = (user: AppUser) => {
    askConfirm(
      'Activar usuario',
      `Reactivar el acceso de "${user.fullName}"?`,
      async () => {
        setConfirmLoading(true);
        try {
          await axios.put(`${API}/api/v2/users/${user.id}/activate`);
          setSnackbar(`${user.fullName} activado`);
        } catch (e: any) { setSnackbar(e.response?.data?.error || 'Error'); }
        finally { setConfirmLoading(false); setConfirmDlg(null); loadAll(); }
      }
    );
  };

  // ── Reasignar local ────────────────────────────────────────────────────────

  const handleReassign = async () => {
    if (!reassignModal || !reassignStoreId) { setSnackbar('Selecciona un local'); return; }
    setReassigning(true);
    try {
      await axios.put(`${API}/api/v2/users/${reassignModal.id}/reassign`, { storeId: Number(reassignStoreId) });
      setSnackbar('Local reasignado correctamente');
      setReassignModal(null);
      setReassignStoreId('');
      loadAll();
    } catch (e: any) { setSnackbar(e.response?.data?.error || 'Error'); }
    finally { setReassigning(false); }
  };

  // ── Reset password ─────────────────────────────────────────────────────────

  const handleResetPassword = async () => {
    if (!resetModal || !newPassword) { setSnackbar('Ingresa la nueva contrasena'); return; }
    setResetting(true);
    try {
      await axios.put(`${API}/api/v2/users/${resetModal.id}/reset-password`, { password: newPassword });
      setSnackbar('Contrasena actualizada correctamente');
      setResetModal(null);
      setNewPassword('');
    } catch (e: any) { setSnackbar(e.response?.data?.error || 'Error'); }
    finally { setResetting(false); }
  };

  // ── Permisos ───────────────────────────────────────────────────────────────

  const openPermModal = (user: AppUser) => {
    setPermModal(user);
    // permissions vacío = acceso completo → mostrar todos ON para que el admin pueda desactivar
    const perms = user.permissions ?? [];
    setPermSelected(perms.length === 0 ? [...ALL_SECTION_KEYS] : perms);
  };

  const togglePerm = (key: string) => {
    setPermSelected(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const handleSavePermissions = async () => {
    if (!permModal) return;
    setSavingPerm(true);
    // Si todas las secciones están activas → enviar [] (backend: sin restricciones = acceso completo)
    const toSend = permSelected.length === ALL_SECTION_KEYS.length ? [] : permSelected;
    try {
      await axios.put(`${API}/api/v2/users/${permModal.id}/permissions`, { permissions: toSend });
      setSnackbar('Permisos actualizados');
      setPermModal(null);
      loadAll();
    } catch (e: any) { setSnackbar(e.response?.data?.error || 'Error'); }
    finally { setSavingPerm(false); }
  };

  // ── Acceso multi-tienda ────────────────────────────────────────────────────

  const openStoreModal = (user: AppUser) => {
    setStoreModal(user);
    setStoreSelected(user.storeIds ?? []);
  };

  const toggleStore = (id: number) => {
    setStoreSelected(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const handleSaveStoreAccess = async () => {
    if (!storeModal) return;
    setSavingStore(true);
    try {
      await axios.put(`${API}/api/v2/users/${storeModal.id}/store-access`, { storeIds: storeSelected });
      setSnackbar('Acceso a locales actualizado');
      setStoreModal(null);
      loadAll();
    } catch (e: any) { setSnackbar(e.response?.data?.error || 'Error'); }
    finally { setSavingStore(false); }
  };

  // ── Eliminar ───────────────────────────────────────────────────────────────

  const handleDelete = (user: AppUser) => {
    askConfirm(
      'Eliminar usuario',
      `Eliminar permanentemente a "${user.fullName}"? Esta accion no se puede deshacer.`,
      async () => {
        setConfirmLoading(true);
        try {
          await axios.delete(`${API}/api/v2/users/${user.id}`);
          setSnackbar('Usuario eliminado');
        } catch (e: any) { setSnackbar(e.response?.data?.error || 'Error al eliminar'); }
        finally { setConfirmLoading(false); setConfirmDlg(null); loadAll(); }
      }
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={styles.root}>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Usuarios</Text>
        <Button mode="contained" onPress={() => setCreateModal(true)} buttonColor={COLOR.brand} textColor={COLOR.inkOnBrand} style={{ borderRadius: 10 }}>
          + Nuevo usuario
        </Button>
      </View>

      {/* Tabla */}
      {loading ? (
        <ActivityIndicator size="large" color={COLOR.brand} style={{ marginTop: 40 }} />
      ) : users.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No hay usuarios creados aun.</Text>
          <Text style={styles.emptySub}>Crea el primer usuario con el boton de arriba.</Text>
        </View>
      ) : (
        <ScrollView>
          {isDesktop && (
            <View style={[styles.row, styles.rowHeader]}>
              <Text style={[styles.cell, styles.cellName,    styles.colHeader]}>Nombre</Text>
              <Text style={[styles.cell, styles.cellUser,    styles.colHeader]}>Usuario</Text>
              <Text style={[styles.cell, styles.cellRole,    styles.colHeader]}>Rol</Text>
              <Text style={[styles.cell, styles.cellStore,   styles.colHeader]}>Local</Text>
              <Text style={[styles.cell, styles.cellStatus,  styles.colHeader]}>Estado</Text>
              <Text style={[styles.cell, styles.cellActions, styles.colHeader]}>Acciones</Text>
            </View>
          )}

          {users.map(user => (
            isDesktop ? (
              <View key={user.id} style={[styles.row, user.status === 'SUSPENDED' && styles.rowSuspended]}>
                <View style={[styles.cell, styles.cellName]}>
                  <Text style={styles.userName}>{user.fullName}</Text>
                  {user.firstLogin && (
                    <Text style={styles.firstLoginBadge}>Primer acceso pendiente</Text>
                  )}
                </View>
                <Text style={[styles.cell, styles.cellUser, styles.metaText]}>@{user.username}</Text>
                <Text style={[styles.cell, styles.cellRole, styles.metaText]}>{roleLabel(user.role)}</Text>
                <Text style={[styles.cell, styles.cellStore, styles.metaText]}>{user.storeName ?? '—'}</Text>
                <View style={[styles.cell, styles.cellStatus]}>
                  <View style={[styles.statusBadge, { backgroundColor: statusColor(user.status) + '18', borderColor: statusColor(user.status) + '44' }]}>
                    <Text style={[styles.statusText, { color: statusColor(user.status) }]}>{statusLabel(user.status)}</Text>
                  </View>
                </View>
                <View style={[styles.cell, styles.cellActions]}>
                  {user.status === 'ACTIVE'
                    ? <IconButton icon="pause-circle"  size={20} iconColor={COLOR.warn}    onPress={() => handleSuspend(user)}           style={{ margin: 0 }} />
                    : <IconButton icon="play-circle"   size={20} iconColor={COLOR.income}  onPress={() => handleActivate(user)}          style={{ margin: 0 }} />
                  }
                  <IconButton icon="shield-account"  size={20} iconColor={COLOR.info}    onPress={() => openPermModal(user)}           style={{ margin: 0 }} />
                  <IconButton icon="store-plus"      size={20} iconColor={COLOR.info}    onPress={() => openStoreModal(user)}          style={{ margin: 0 }} />
                  <IconButton icon="store-edit"      size={20} iconColor={COLOR.ink2}    onPress={() => { setReassignModal(user); setReassignStoreId(String(user.storeId ?? '')); }} style={{ margin: 0 }} />
                  <IconButton icon="lock-reset"      size={20} iconColor={COLOR.ink2}    onPress={() => { setResetModal(user); setNewPassword(''); }} style={{ margin: 0 }} />
                  <IconButton icon="delete"           size={20} iconColor={COLOR.expense} onPress={() => handleDelete(user)}            style={{ margin: 0 }} />
                </View>
              </View>
            ) : (
              <View key={user.id} style={[styles.mobileCard, user.status === 'SUSPENDED' && styles.rowSuspended]}>
                <View style={styles.mobileCardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.userName} numberOfLines={1}>{user.fullName}</Text>
                    <Text style={styles.userMeta}>@{user.username} · {roleLabel(user.role)} · {user.storeName ?? 'Sin local'}</Text>
                    {user.firstLogin && (
                      <Text style={styles.firstLoginBadge}>Primer acceso pendiente</Text>
                    )}
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusColor(user.status) + '18', borderColor: statusColor(user.status) + '44' }]}>
                    <Text style={[styles.statusText, { color: statusColor(user.status) }]}>{statusLabel(user.status)}</Text>
                  </View>
                </View>
                <View style={styles.mobileCardActions}>
                  {user.status === 'ACTIVE'
                    ? <IconButton icon="pause-circle"  size={22} iconColor={COLOR.warn}    onPress={() => handleSuspend(user)}           style={{ margin: 0 }} />
                    : <IconButton icon="play-circle"   size={22} iconColor={COLOR.income}  onPress={() => handleActivate(user)}          style={{ margin: 0 }} />
                  }
                  <IconButton icon="shield-account"  size={22} iconColor={COLOR.info}    onPress={() => openPermModal(user)}           style={{ margin: 0 }} />
                  <IconButton icon="store-plus"      size={22} iconColor={COLOR.info}    onPress={() => openStoreModal(user)}          style={{ margin: 0 }} />
                  <IconButton icon="store-edit"      size={22} iconColor={COLOR.ink2}    onPress={() => { setReassignModal(user); setReassignStoreId(String(user.storeId ?? '')); }} style={{ margin: 0 }} />
                  <IconButton icon="lock-reset"      size={22} iconColor={COLOR.ink2}    onPress={() => { setResetModal(user); setNewPassword(''); }} style={{ margin: 0 }} />
                  <IconButton icon="delete"           size={22} iconColor={COLOR.expense} onPress={() => handleDelete(user)}            style={{ margin: 0 }} />
                </View>
              </View>
            )
          ))}
        </ScrollView>
      )}

      {/* ── Wizard de creación de usuario ── */}
      <UserCreationWizard
        visible={createModal}
        stores={stores}
        onClose={() => setCreateModal(false)}
        onCreated={(fullName, username, tempPassword) => {
          loadAll();
          setTempPwdModal({ fullName, username, password: tempPassword });
        }}
      />

      {/* ── Modal reasignar local ── */}
      <Modal visible={!!reassignModal} transparent animationType="fade" onRequestClose={() => setReassignModal(null)}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Reasignar local</Text>
            <Text style={styles.modalSub}>{reassignModal?.fullName}</Text>
            <Text style={styles.fieldLabel}>Selecciona el nuevo local:</Text>
            <View style={styles.storeSelector}>
              {stores.map(s => (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.storeChip, reassignStoreId === String(s.id) && styles.storeChipActive]}
                  onPress={() => setReassignStoreId(String(s.id))}
                >
                  <Text style={[styles.storeChipText, reassignStoreId === String(s.id) && styles.storeChipTextActive]}>
                    {s.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalActions}>
              <Button mode="outlined" onPress={() => setReassignModal(null)} style={{ flex: 1 }}>Cancelar</Button>
              <Button mode="contained" onPress={handleReassign} loading={reassigning} buttonColor={COLOR.info} textColor={COLOR.white} style={{ flex: 1 }}>Reasignar</Button>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Modal reset password ── */}
      <Modal visible={!!resetModal} transparent animationType="fade" onRequestClose={() => setResetModal(null)}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Cambiar contrasena</Text>
            <Text style={styles.modalSub}>{resetModal?.fullName} (@{resetModal?.username})</Text>
            <TextInput
              label="Nueva contrasena *" value={newPassword}
              onChangeText={setNewPassword}
              mode="outlined" style={[styles.input, { marginTop: 12 }]}
              secureTextEntry={!showNewPwd}
              right={<TextInput.Icon icon={showNewPwd ? 'eye-off' : 'eye'} onPress={() => setShowNewPwd(v => !v)} />}
            />
            <View style={styles.modalActions}>
              <Button mode="outlined" onPress={() => setResetModal(null)} style={{ flex: 1 }}>Cancelar</Button>
              <Button mode="contained" onPress={handleResetPassword} loading={resetting} buttonColor={COLOR.brand} textColor={COLOR.inkOnBrand} style={{ flex: 1 }}>Guardar</Button>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Modal permisos ── */}
      <Modal visible={!!permModal} transparent animationType="fade" onRequestClose={() => setPermModal(null)}>
        <View style={styles.overlay}>
          <View style={styles.permModalOuter}>
            {/* Header */}
            <View style={styles.permHeader}>
              <Text style={styles.modalTitle}>Permisos de acceso</Text>
              <View style={styles.permUserBadge}>
                <View style={styles.permUserDot} />
                <Text style={styles.permUserName}>{permModal?.fullName}</Text>
              </View>
            </View>

            {/* Nota informativa */}
            <View style={styles.permInfoNote}>
              <MaterialCommunityIcons name="information-outline" size={14} color={COLOR.inkMute} />
              <Text style={styles.permInfoText}>
                Desactivá las secciones que no querés habilitar. Si todas están activas, el usuario tiene{' '}
                <Text style={{ fontWeight: FONT_WEIGHT.bold as any }}>acceso completo</Text>.
              </Text>
            </View>

            {/* Filas de toggle agrupadas */}
            <ScrollView style={styles.permScroll} showsVerticalScrollIndicator={false}>
              {SECTION_GROUPS.map(group => (
                <View key={group}>
                  <Text style={styles.permGroupLabel}>{group}</Text>
                  {ALL_SECTIONS.filter(s => s.group === group).map(s => {
                    const isOn = permSelected.includes(s.key);
                    return (
                      <TouchableOpacity
                        key={s.key}
                        style={[styles.permRow, isOn && styles.permRowOn]}
                        onPress={() => togglePerm(s.key)}
                        activeOpacity={0.8}
                      >
                        <View style={[styles.permIcon, isOn && styles.permIconOn]}>
                          <MaterialCommunityIcons
                            name={s.icon as any}
                            size={18}
                            color={isOn ? COLOR.brandDeep : COLOR.inkMute}
                          />
                        </View>
                        <View style={styles.permInfo}>
                          <Text style={styles.permName}>{s.label}</Text>
                          <Text style={styles.permDesc}>{s.description}</Text>
                        </View>
                        <ToggleSwitch value={isOn} />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </ScrollView>

            {/* Acciones */}
            <View style={[styles.modalActions, { paddingHorizontal: SPACE.s5, paddingBottom: SPACE.s5 }]}>
              <Button mode="outlined" onPress={() => setPermModal(null)} style={{ flex: 1 }}>Cancelar</Button>
              <Button mode="contained" onPress={handleSavePermissions} loading={savingPerm} buttonColor={COLOR.brand} textColor={COLOR.inkOnBrand} style={{ flex: 1 }}>Guardar</Button>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Modal acceso multi-tienda ── */}
      <Modal visible={!!storeModal} transparent animationType="fade" onRequestClose={() => setStoreModal(null)}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Locales accesibles</Text>
            <Text style={styles.modalSub}>{storeModal?.fullName}</Text>
            <Text style={styles.fieldLabel}>
              Locales que puede operar (sin seleccion = todos los locales):
            </Text>
            <View style={styles.storeSelector}>
              {stores.map(s => (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.storeChip, storeSelected.includes(s.id) && styles.storeChipActive]}
                  onPress={() => toggleStore(s.id)}
                >
                  <Text style={[styles.storeChipText, storeSelected.includes(s.id) && styles.storeChipTextActive]}>
                    {s.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {storeSelected.length === 0 && (
              <Text style={styles.roleNote}>Sin restricciones — el usuario puede operar en todos los locales.</Text>
            )}
            <View style={styles.modalActions}>
              <Button mode="outlined" onPress={() => setStoreModal(null)} style={{ flex: 1 }}>Cancelar</Button>
              <Button mode="contained" onPress={handleSaveStoreAccess} loading={savingStore} buttonColor={COLOR.brand} textColor={COLOR.inkOnBrand} style={{ flex: 1 }}>Guardar</Button>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Modal contraseña temporal ── */}
      <Modal visible={!!tempPwdModal} transparent animationType="fade" onRequestClose={() => { setTempPwdModal(null); setTempPwdCopied(false); }}>
        <View style={styles.overlay}>
          <View style={[styles.modal, { alignItems: 'center' }]}>
            <Text style={{ fontSize: 36, marginBottom: SPACE.s2 }}>🔑</Text>
            <Text style={styles.modalTitle}>Usuario creado</Text>
            <Text style={styles.modalSub}>{tempPwdModal?.fullName}</Text>

            <View style={{ backgroundColor: COLOR.brandTint, borderRadius: RADIUS.r2, padding: SPACE.s3, width: '100%', alignItems: 'center', borderWidth: 1, borderColor: COLOR.brandDark, marginTop: SPACE.s2, marginBottom: SPACE.s3 }}>
              <Text style={{ fontSize: FONT_SIZE.caption, color: COLOR.inkMute, marginBottom: 2 }}>Usuario para iniciar sesión</Text>
              <Text selectable style={{ fontSize: FONT_SIZE.h2, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.ink, letterSpacing: 1 }}>
                {tempPwdModal?.username}
              </Text>
            </View>

            <Text style={[styles.fieldLabel, { textAlign: 'center' }]}>
              Contraseña temporal — enviala por WhatsApp al usuario
            </Text>

            <View style={{ backgroundColor: COLOR.bg, borderRadius: RADIUS.r2, padding: SPACE.s3, width: '100%', alignItems: 'center', borderWidth: 1, borderColor: COLOR.border, marginBottom: SPACE.s3 }}>
              <Text selectable style={{ fontSize: FONT_SIZE.h2, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.ink, letterSpacing: 2 }}>
                {tempPwdModal?.password}
              </Text>
            </View>

            <Button
              mode={tempPwdCopied ? 'outlined' : 'contained'}
              buttonColor={tempPwdCopied ? undefined : COLOR.brand}
              textColor={tempPwdCopied ? COLOR.income : COLOR.inkOnBrand}
              style={{ width: '100%', borderRadius: RADIUS.r2, marginBottom: SPACE.s2 }}
              onPress={async () => {
                if (tempPwdModal?.password) {
                  try {
                    await navigator.clipboard.writeText(`Usuario: ${tempPwdModal.username}\nContraseña: ${tempPwdModal.password}`);
                  } catch {
                    // clipboard no disponible en mobile: el usuario puede seleccionar el texto
                  }
                  setTempPwdCopied(true);
                }
              }}
            >
              {tempPwdCopied ? 'Copiado!' : 'Copiar usuario y contraseña'}
            </Button>

            <Button mode="outlined" style={{ width: '100%', borderRadius: RADIUS.r2 }} onPress={() => { setTempPwdModal(null); setTempPwdCopied(false); }}>
              Listo
            </Button>
          </View>
        </View>
      </Modal>

      <ConfirmDialog
        visible={!!confirmDlg}
        title={confirmDlg?.title ?? ''}
        message={confirmDlg?.message ?? ''}
        confirmLabel="Si, confirmar"
        loading={confirmLoading}
        onConfirm={() => confirmDlg?.onConfirm()}
        onCancel={() => { if (!confirmLoading) setConfirmDlg(null); }}
      />
      <Snackbar visible={!!snackbar} onDismiss={() => setSnackbar('')} duration={3000}>{snackbar}</Snackbar>
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:           { flex: 1, backgroundColor: COLOR.bg },

  header:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: SPACE.s2, padding: SPACE.s4, backgroundColor: COLOR.surface, borderBottomWidth: 1, borderBottomColor: COLOR.border },
  headerTitle:    { fontSize: FONT_SIZE.h1, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.ink },

  empty:          { flex: 1, justifyContent: 'center', alignItems: 'center', gap: SPACE.s2, padding: SPACE.s8 },
  emptyText:      { fontSize: FONT_SIZE.h3, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.ink },
  emptySub:       { fontSize: FONT_SIZE.label, color: COLOR.inkMute },

  rowHeader:      { backgroundColor: COLOR.surface2, borderBottomWidth: 2, borderBottomColor: COLOR.border },
  row:            { flexDirection: 'row', alignItems: 'center', backgroundColor: COLOR.surface, borderBottomWidth: 1, borderBottomColor: COLOR.border, paddingHorizontal: SPACE.s1, minHeight: 56 },
  rowSuspended:   { opacity: 0.6, backgroundColor: COLOR.bgAlt },
  cell:           { paddingHorizontal: SPACE.s2, paddingVertical: SPACE.s2 },
  cellName:       { flex: 1 },
  cellUser:       { width: 130 },
  cellRole:       { width: 100 },
  cellStore:      { width: 100 },
  cellStatus:     { width: 100 },
  cellActions:    { flexDirection: 'row', alignItems: 'center', width: 200 },
  colHeader:      { fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.inkMute } as any,

  userName:       { fontSize: FONT_SIZE.label, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.ink },
  userMeta:       { fontSize: FONT_SIZE.caption, color: COLOR.inkMute, fontWeight: FONT_WEIGHT.medium as any, marginTop: 2 },
  metaText:       { fontSize: FONT_SIZE.label, color: COLOR.ink2, fontWeight: FONT_WEIGHT.medium as any },

  firstLoginBadge: { fontSize: FONT_SIZE.caption - 1, color: COLOR.warn, fontWeight: FONT_WEIGHT.semibold as any, marginTop: 2 },

  statusBadge:    { borderRadius: RADIUS.r1, paddingHorizontal: SPACE.s2, paddingVertical: 4, borderWidth: 1, alignSelf: 'flex-start' },
  statusText:     { fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold as any },

  overlay:        { flex: 1, backgroundColor: COLOR.overlay, justifyContent: 'center', alignItems: 'center' },
  modal:          { backgroundColor: COLOR.surface, borderRadius: RADIUS.r4, padding: SPACE.s5, width: '92%', maxWidth: 460, gap: SPACE.s1 },
  modalTitle:     { fontSize: FONT_SIZE.h1, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.ink, marginBottom: SPACE.s1 },
  modalSub:       { fontSize: FONT_SIZE.label, color: COLOR.ink2, fontWeight: FONT_WEIGHT.semibold as any, marginBottom: SPACE.s2 },
  modalActions:   { flexDirection: 'row', gap: SPACE.s2, marginTop: SPACE.s3 },
  input:          { marginBottom: SPACE.s2 },
  fieldLabel:     { fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.inkMute, marginBottom: SPACE.s2, marginTop: SPACE.s1 },

  storeSelector:  { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.s2, marginBottom: SPACE.s3 },
  storeChip:      { paddingHorizontal: SPACE.s4, paddingVertical: SPACE.s2, borderRadius: RADIUS.full, backgroundColor: COLOR.bg, borderWidth: 1, borderColor: COLOR.border },
  storeChipActive:{ backgroundColor: COLOR.brand, borderColor: COLOR.brandDark },
  storeChipText:  { fontSize: FONT_SIZE.label, fontWeight: FONT_WEIGHT.semibold as any, color: COLOR.ink2 },
  storeChipTextActive: { color: COLOR.ink, fontWeight: FONT_WEIGHT.bold as any },

  roleNote:       { fontSize: FONT_SIZE.caption, color: COLOR.inkMute, backgroundColor: COLOR.bgAlt, borderRadius: RADIUS.r2, padding: SPACE.s2, marginBottom: SPACE.s1 },

  // ── Modal permisos (sin padding externo) ──
  permModalOuter:  { backgroundColor: COLOR.surface, borderRadius: RADIUS.r4, width: '92%', maxWidth: 480, overflow: 'hidden' },
  permHeader:      { padding: SPACE.s5, borderBottomWidth: 1, borderBottomColor: COLOR.border },
  permUserBadge:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, backgroundColor: COLOR.brandTint, borderRadius: RADIUS.full, paddingVertical: 4, paddingHorizontal: SPACE.s3, alignSelf: 'flex-start', borderWidth: 1, borderColor: COLOR.border2 },
  permUserDot:     { width: 8, height: 8, borderRadius: 4, backgroundColor: COLOR.brand },
  permUserName:    { fontSize: FONT_SIZE.label, fontWeight: FONT_WEIGHT.semibold as any, color: COLOR.brandDeep },
  permInfoNote:    { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.s2, margin: SPACE.s3, backgroundColor: COLOR.bg, borderRadius: RADIUS.r2, padding: SPACE.s3, borderWidth: 1, borderColor: COLOR.border },
  permInfoText:    { flex: 1, fontSize: FONT_SIZE.caption, color: COLOR.inkMute, lineHeight: 18 },
  permScroll:      { maxHeight: 360 },
  permGroupLabel:  { fontSize: 10.5, fontWeight: FONT_WEIGHT.bold as any, letterSpacing: 0.7, textTransform: 'uppercase', color: COLOR.inkMute, paddingHorizontal: SPACE.s5, paddingTop: SPACE.s3, paddingBottom: SPACE.s1 } as any,
  permRow:         { flexDirection: 'row', alignItems: 'center', gap: SPACE.s3, paddingVertical: 11, paddingHorizontal: SPACE.s5, borderLeftWidth: 3, borderLeftColor: 'transparent' },
  permRowOn:       { backgroundColor: COLOR.brandTint, borderLeftColor: COLOR.brand },
  permIcon:        { width: 36, height: 36, borderRadius: 9, backgroundColor: COLOR.bgAlt, alignItems: 'center', justifyContent: 'center' },
  permIconOn:      { backgroundColor: 'rgba(245,196,48,.15)' },
  permInfo:        { flex: 1 },
  permName:        { fontSize: FONT_SIZE.label, fontWeight: FONT_WEIGHT.semibold as any, color: COLOR.ink },
  permDesc:        { fontSize: FONT_SIZE.caption, color: COLOR.inkMute, marginTop: 2, lineHeight: 16 },

  mobileCard:       { backgroundColor: COLOR.surface, borderBottomWidth: 1, borderBottomColor: COLOR.border, paddingHorizontal: SPACE.s4, paddingVertical: SPACE.s3, gap: SPACE.s2 },
  mobileCardTop:    { flexDirection: 'row', alignItems: 'center', gap: SPACE.s3 },
  mobileCardActions:{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
});
