import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, Switch,
  ScrollView, KeyboardAvoidingView, Platform, useWindowDimensions,
} from 'react-native';
import { TextInput, Button, ActivityIndicator } from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import axios from 'axios';
import { REACT_APP_API_URL } from '../config';
import { COLOR, SPACE, RADIUS, FONT_SIZE, FONT_WEIGHT, BREAKPOINT } from '../theme';
import { ALL_SECTIONS, SECTION_GROUPS } from '../constants/sections';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Store { id: number; name: string; active: boolean }

interface Props {
  visible: boolean;
  stores: Store[];
  onClose: () => void;
  onCreated: (fullName: string, username: string, tempPassword: string) => void;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const ROLES = [
  { value: 'ENCARGADO', label: 'Encargado', icon: 'account-tie-outline',   desc: 'Gestión diaria del local, ventas y operaciones' },
  { value: 'CONTADOR',  label: 'Contador',  icon: 'calculator-variant',     desc: 'Acceso a reportes financieros y operaciones'    },
  { value: 'SOCIO',     label: 'Socio',     icon: 'handshake-outline',      desc: 'Vista gerencial del negocio'                   },
  { value: 'EXTERNO',   label: 'Externo',   icon: 'account-arrow-right',    desc: 'Acceso limitado para personal externo'         },
];


const STEP_LABELS = ['Datos', 'Locales', 'Secciones', 'Confirmar'];
const TOTAL_STEPS = 4;

// ─── Sub-componentes ──────────────────────────────────────────────────────────

const StepIndicator = ({ current }: { current: number }) => (
  <View style={ind.row}>
    {STEP_LABELS.map((label, i) => {
      const stepNum = i + 1;
      const done    = stepNum < current;
      const active  = stepNum === current;
      return (
        <React.Fragment key={stepNum}>
          <View style={ind.step}>
            <View style={[ind.circle, done && ind.circleDone, active && ind.circleActive]}>
              {done
                ? <MaterialCommunityIcons name="check" size={14} color="#fff" />
                : <Text style={[ind.num, active && ind.numActive]}>{stepNum}</Text>
              }
            </View>
            <Text style={[ind.label, active && ind.labelActive]}>{label}</Text>
          </View>
          {i < TOTAL_STEPS - 1 && <View style={[ind.line, done && ind.lineDone]} />}
        </React.Fragment>
      );
    })}
  </View>
);

const CheckRow = ({
  label, icon, checked, onToggle,
}: { label: string; icon: string; checked: boolean; onToggle: () => void }) => (
  <TouchableOpacity style={[chk.row, checked && chk.rowActive]} onPress={onToggle} activeOpacity={0.8}>
    <View style={[chk.icon, checked && chk.iconActive]}>
      <MaterialCommunityIcons name={icon} size={18} color={checked ? COLOR.inkOnBrand : COLOR.ink2} />
    </View>
    <Text style={[chk.label, checked && chk.labelActive]}>{label}</Text>
    <View style={[chk.box, checked && chk.boxActive]}>
      {checked && <MaterialCommunityIcons name="check" size={14} color="#fff" />}
    </View>
  </TouchableOpacity>
);

// ─── UserCreationWizard ───────────────────────────────────────────────────────

export default function UserCreationWizard({ visible, stores, onClose, onCreated }: Props) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= BREAKPOINT.desktop;

  // ── Estado del formulario ─────────────────────────────────────────────────
  const [step, setStep] = useState(1);

  // Paso 1
  const [fullName,  setFullName]  = useState('');
  const [username,  setUsername]  = useState('');
  const [email,     setEmail]     = useState('');
  const [role,      setRole]      = useState('ENCARGADO');

  // Paso 2
  const [allStores,      setAllStores]      = useState(true);
  const [selectedStores, setSelectedStores] = useState<number[]>([]);

  // Paso 3
  const [allSections,      setAllSections]      = useState(true);
  const [selectedSections, setSelectedSections] = useState<string[]>([]);

  // Control
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const reset = () => {
    setStep(1);
    setFullName(''); setUsername(''); setEmail(''); setRole('ENCARGADO');
    setAllStores(true); setSelectedStores([]);
    setAllSections(true); setSelectedSections([]);
    setSaving(false); setError('');
  };

  const handleClose = () => { reset(); onClose(); };

  // ── Validación paso 1 ─────────────────────────────────────────────────────
  const validateStep1 = () => {
    if (!fullName.trim())  { setError('El nombre completo es obligatorio'); return false; }
    if (!username.trim())  { setError('El usuario es obligatorio'); return false; }
    if (!/^[a-z0-9._-]{3,30}$/.test(username.trim().toLowerCase())) {
      setError('El usuario solo puede tener letras, números, puntos y guiones (mín. 3 caracteres)'); return false;
    }
    if (!email.trim() || !email.includes('@')) { setError('El email no es válido'); return false; }
    setError(''); return true;
  };

  const handleNext = () => {
    if (step === 1 && !validateStep1()) return;
    setError('');
    setStep(s => s + 1);
  };

  const handleBack = () => { setError(''); setStep(s => s - 1); };

  const toggleStore = (id: number) =>
    setSelectedStores(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const toggleSection = (key: string) =>
    setSelectedSections(prev => prev.includes(key) ? prev.filter(x => x !== key) : [...prev, key]);

  // ── Crear usuario ─────────────────────────────────────────────────────────
  const handleConfirm = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await axios.post(`${REACT_APP_API_URL}/api/v2/users`, {
        fullName:    fullName.trim(),
        username:    username.trim().toLowerCase(),
        email:       email.trim().toLowerCase(),
        role,
        storeIds:    allStores ? [] : selectedStores,
        permissions: allSections ? [] : selectedSections,
      });
      handleClose();
      onCreated(res.data.fullName, res.data.username, res.data.tempPassword);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Error al crear el usuario');
    } finally {
      setSaving(false);
    }
  };

  // ── Resumen (paso 4) ──────────────────────────────────────────────────────
  const storesSummary = allStores
    ? 'Todos los locales'
    : stores.filter(s => selectedStores.includes(s.id)).map(s => s.name).join(', ') || 'Ninguno';

  const sectionsSummary = allSections
    ? 'Todas las secciones'
    : ALL_SECTIONS.filter(s => selectedSections.includes(s.key)).map(s => s.label).join(', ') || 'Ninguna';

  const roleLabel = ROLES.find(r => r.value === role)?.label ?? role;

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose} statusBarTranslucent>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[wiz.root, isDesktop && wiz.rootDesktop]}>

          {/* Encabezado */}
          <View style={wiz.header}>
            <TouchableOpacity onPress={handleClose} style={wiz.closeBtn} activeOpacity={0.7}>
              <MaterialCommunityIcons name="close" size={22} color={COLOR.ink} />
            </TouchableOpacity>
            <Text style={wiz.headerTitle}>Nuevo usuario</Text>
            <View style={{ width: 36 }} />
          </View>

          {/* Indicador de pasos */}
          <StepIndicator current={step} />

          {/* Contenido del paso */}
          <ScrollView
            style={wiz.body}
            contentContainerStyle={wiz.bodyContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >

            {/* ── Paso 1: Datos del usuario ─────────────────────────────── */}
            {step === 1 && (
              <View style={wiz.stepContent}>
                <Text style={wiz.stepTitle}>Datos del usuario</Text>
                <Text style={wiz.stepDesc}>Completá la información básica del nuevo usuario.</Text>

                <TextInput
                  label="Nombre completo"
                  value={fullName}
                  onChangeText={setFullName}
                  mode="outlined"
                  style={wiz.input}
                  autoCapitalize="words"
                  left={<TextInput.Icon icon="account" color={COLOR.brandDark} />}
                  outlineColor={COLOR.border2}
                  activeOutlineColor={COLOR.brand}
                />

                <TextInput
                  label="Usuario (login)"
                  value={username}
                  onChangeText={v => setUsername(v.toLowerCase())}
                  mode="outlined"
                  style={wiz.input}
                  autoCapitalize="none"
                  autoCorrect={false}
                  left={<TextInput.Icon icon="at" color={COLOR.brandDark} />}
                  outlineColor={COLOR.border2}
                  activeOutlineColor={COLOR.brand}
                />

                <TextInput
                  label="Email"
                  value={email}
                  onChangeText={setEmail}
                  mode="outlined"
                  style={wiz.input}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  left={<TextInput.Icon icon="email-outline" color={COLOR.brandDark} />}
                  outlineColor={COLOR.border2}
                  activeOutlineColor={COLOR.brand}
                />

                <Text style={wiz.fieldLabel}>Tipo de usuario</Text>
                <View style={wiz.roleGrid}>
                  {ROLES.map(r => {
                    const active = role === r.value;
                    return (
                      <TouchableOpacity
                        key={r.value}
                        style={[wiz.roleCard, active && wiz.roleCardActive]}
                        onPress={() => setRole(r.value)}
                        activeOpacity={0.8}
                      >
                        <View style={[wiz.roleCardIcon, active && wiz.roleCardIconActive]}>
                          <MaterialCommunityIcons name={r.icon as any} size={22} color={active ? COLOR.brandDeep : COLOR.ink2} />
                        </View>
                        <Text style={[wiz.roleCardLabel, active && wiz.roleCardLabelActive]}>{r.label}</Text>
                        <Text style={wiz.roleCardDesc}>{r.desc}</Text>
                        {active && (
                          <View style={wiz.roleCardCheck}>
                            <MaterialCommunityIcons name="check-circle" size={16} color={COLOR.brand} />
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={wiz.infoBox}>
                  <MaterialCommunityIcons name="key-outline" size={16} color={COLOR.brandDeep} />
                  <Text style={wiz.infoText}>
                    El sistema generará una contraseña temporal automáticamente. El usuario deberá cambiarla en su primer ingreso.
                  </Text>
                </View>
              </View>
            )}

            {/* ── Paso 2: Acceso a locales ──────────────────────────────── */}
            {step === 2 && (
              <View style={wiz.stepContent}>
                <Text style={wiz.stepTitle}>Acceso a locales</Text>
                <Text style={wiz.stepDesc}>¿A qué locales puede acceder este usuario?</Text>

                <TouchableOpacity
                  style={[wiz.toggleCard, allStores && wiz.toggleCardActive]}
                  onPress={() => setAllStores(true)}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons
                    name={allStores ? 'radiobox-marked' : 'radiobox-blank'}
                    size={20}
                    color={allStores ? COLOR.brand : COLOR.inkMute}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={wiz.toggleCardTitle}>Todos los locales</Text>
                    <Text style={wiz.toggleCardDesc}>Incluye los que se agreguen en el futuro</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[wiz.toggleCard, !allStores && wiz.toggleCardActive]}
                  onPress={() => setAllStores(false)}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons
                    name={!allStores ? 'radiobox-marked' : 'radiobox-blank'}
                    size={20}
                    color={!allStores ? COLOR.brand : COLOR.inkMute}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={wiz.toggleCardTitle}>Locales específicos</Text>
                    <Text style={wiz.toggleCardDesc}>Seleccioná uno o varios locales</Text>
                  </View>
                </TouchableOpacity>

                {!allStores && (
                  <View style={wiz.checkList}>
                    {stores.filter(s => s.active).map(store => (
                      <CheckRow
                        key={store.id}
                        label={store.name}
                        icon="store-outline"
                        checked={selectedStores.includes(store.id)}
                        onToggle={() => toggleStore(store.id)}
                      />
                    ))}
                    {stores.filter(s => s.active).length === 0 && (
                      <Text style={wiz.empty}>No hay locales activos registrados</Text>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* ── Paso 3: Secciones habilitadas ─────────────────────────── */}
            {step === 3 && (
              <View style={wiz.stepContent}>
                <Text style={wiz.stepTitle}>Secciones habilitadas</Text>
                <Text style={wiz.stepDesc}>¿Qué secciones puede ver y usar este usuario?</Text>

                <TouchableOpacity
                  style={[wiz.toggleCard, allSections && wiz.toggleCardActive]}
                  onPress={() => setAllSections(true)}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons
                    name={allSections ? 'radiobox-marked' : 'radiobox-blank'}
                    size={20}
                    color={allSections ? COLOR.brand : COLOR.inkMute}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={wiz.toggleCardTitle}>Todas las secciones</Text>
                    <Text style={wiz.toggleCardDesc}>Acceso completo al sistema</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[wiz.toggleCard, !allSections && wiz.toggleCardActive]}
                  onPress={() => setAllSections(false)}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons
                    name={!allSections ? 'radiobox-marked' : 'radiobox-blank'}
                    size={20}
                    color={!allSections ? COLOR.brand : COLOR.inkMute}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={wiz.toggleCardTitle}>Secciones específicas</Text>
                    <Text style={wiz.toggleCardDesc}>El usuario solo ve lo que marcás</Text>
                  </View>
                </TouchableOpacity>

                {!allSections && (
                  <View style={wiz.sectionList}>
                    {SECTION_GROUPS.map(group => (
                      <View key={group}>
                        <Text style={wiz.sectionGroupLabel}>{group}</Text>
                        {ALL_SECTIONS.filter(s => s.group === group).map(s => {
                          const isOn = selectedSections.includes(s.key);
                          return (
                            <TouchableOpacity
                              key={s.key}
                              style={[wiz.sectionRow, isOn && wiz.sectionRowOn]}
                              onPress={() => toggleSection(s.key)}
                              activeOpacity={0.8}
                            >
                              <View style={[wiz.sectionIcon, isOn && wiz.sectionIconOn]}>
                                <MaterialCommunityIcons name={s.icon as any} size={18} color={isOn ? COLOR.brandDeep : COLOR.inkMute} />
                              </View>
                              <View style={wiz.sectionInfo}>
                                <Text style={wiz.sectionName}>{s.label}</Text>
                                <Text style={wiz.sectionDesc}>{s.description}</Text>
                              </View>
                              <Switch
                                value={isOn}
                                onValueChange={() => toggleSection(s.key)}
                                trackColor={{ false: COLOR.border2, true: COLOR.brand }}
                                thumbColor={COLOR.surface}
                                ios_backgroundColor={COLOR.border2}
                              />
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* ── Paso 4: Confirmación ──────────────────────────────────── */}
            {step === 4 && (
              <View style={wiz.stepContent}>
                <Text style={wiz.stepTitle}>Confirmar creación</Text>
                <Text style={wiz.stepDesc}>Revisá los datos antes de crear el usuario.</Text>

                <View style={wiz.summaryCard}>
                  <SummaryRow icon="account" label="Nombre"   value={fullName} />
                  <SummaryRow icon="at"      label="Usuario"  value={username.toLowerCase()} />
                  <SummaryRow icon="email-outline" label="Email" value={email.toLowerCase()} />
                  <SummaryRow icon="briefcase-outline" label="Tipo" value={roleLabel} />
                  <SummaryRow icon="store-outline"     label="Locales" value={storesSummary} />
                  <SummaryRow icon="shield-outline"    label="Secciones" value={sectionsSummary} last />
                </View>

                <View style={wiz.infoBox}>
                  <MaterialCommunityIcons name="information-outline" size={16} color={COLOR.brandDeep} />
                  <Text style={wiz.infoText}>
                    Al confirmar se creará el usuario con una contraseña temporal. Copiá las credenciales y entregáselas manualmente.
                  </Text>
                </View>
              </View>
            )}

            {/* Error */}
            {!!error && (
              <View style={wiz.errorBox}>
                <MaterialCommunityIcons name="alert-circle-outline" size={16} color={COLOR.expense} />
                <Text style={wiz.errorText}>{error}</Text>
              </View>
            )}
          </ScrollView>

          {/* Navegación */}
          <View style={wiz.nav}>
            {step > 1 && (
              <TouchableOpacity style={wiz.backBtn} onPress={handleBack} activeOpacity={0.8}>
                <MaterialCommunityIcons name="chevron-left" size={20} color={COLOR.ink2} />
                <Text style={wiz.backBtnText}>Anterior</Text>
              </TouchableOpacity>
            )}
            <View style={{ flex: 1 }} />
            {step < TOTAL_STEPS ? (
              <Button
                mode="contained"
                onPress={handleNext}
                buttonColor={COLOR.brand}
                textColor={COLOR.inkOnBrand}
                style={wiz.nextBtn}
                contentStyle={{ paddingHorizontal: SPACE.s3 }}
              >
                Siguiente
              </Button>
            ) : (
              <Button
                mode="contained"
                onPress={handleConfirm}
                loading={saving}
                disabled={saving}
                buttonColor={COLOR.income}
                textColor="#fff"
                style={wiz.nextBtn}
                contentStyle={{ paddingHorizontal: SPACE.s3 }}
                icon="check"
              >
                Crear usuario
              </Button>
            )}
          </View>

        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── SummaryRow ───────────────────────────────────────────────────────────────

const SummaryRow = ({
  icon, label, value, last,
}: { icon: string; label: string; value: string; last?: boolean }) => (
  <View style={[sum.row, !last && sum.rowBorder]}>
    <MaterialCommunityIcons name={icon} size={16} color={COLOR.brandDeep} style={sum.icon} />
    <Text style={sum.label}>{label}</Text>
    <Text style={sum.value} numberOfLines={2}>{value}</Text>
  </View>
);

// ─── Estilos ──────────────────────────────────────────────────────────────────

const wiz = StyleSheet.create({
  root:        { flex: 1, backgroundColor: COLOR.bg },
  rootDesktop: { maxWidth: 600, alignSelf: 'center', width: '100%', elevation: 8, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 24 },

  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACE.s4, paddingTop: SPACE.s5, paddingBottom: SPACE.s3, backgroundColor: COLOR.surface, borderBottomWidth: 1, borderBottomColor: COLOR.border },
  headerTitle: { fontSize: FONT_SIZE.h2, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.ink },
  closeBtn:    { width: 36, height: 36, justifyContent: 'center', alignItems: 'center', borderRadius: RADIUS.full, backgroundColor: COLOR.bg },

  body:        { flex: 1 },
  bodyContent: { padding: SPACE.s4, paddingBottom: SPACE.s6 },

  stepContent: { gap: SPACE.s4 },
  stepTitle:   { fontSize: FONT_SIZE.h2, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.ink },
  stepDesc:    { fontSize: FONT_SIZE.body, color: COLOR.inkMute, marginTop: -SPACE.s2 },

  input:       { backgroundColor: COLOR.surface },
  fieldLabel:  { fontSize: FONT_SIZE.label, fontWeight: FONT_WEIGHT.semibold as any, color: COLOR.ink2, marginBottom: SPACE.s1 },

  roleGrid:           { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.s3 },
  roleCard:           { width: '47%', padding: SPACE.s3, borderRadius: RADIUS.r3, borderWidth: 1.5, borderColor: COLOR.border, backgroundColor: COLOR.surface, gap: SPACE.s2, position: 'relative' },
  roleCardActive:     { borderColor: COLOR.brand, backgroundColor: COLOR.brandTint },
  roleCardIcon:       { width: 40, height: 40, borderRadius: RADIUS.r2, backgroundColor: COLOR.bg, justifyContent: 'center', alignItems: 'center' },
  roleCardIconActive: { backgroundColor: 'rgba(245,196,48,.15)' },
  roleCardLabel:      { fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.ink },
  roleCardLabelActive:{ color: COLOR.brandDeep },
  roleCardDesc:       { fontSize: FONT_SIZE.caption, color: COLOR.inkMute, lineHeight: 16 },
  roleCardCheck:      { position: 'absolute', top: SPACE.s2, right: SPACE.s2 },

  toggleCard:      { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.s3, padding: SPACE.s4, borderRadius: RADIUS.r3, borderWidth: 1.5, borderColor: COLOR.border, backgroundColor: COLOR.surface },
  toggleCardActive:{ borderColor: COLOR.brand, backgroundColor: COLOR.brandTint },
  toggleCardTitle: { fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.ink },
  toggleCardDesc:  { fontSize: FONT_SIZE.caption, color: COLOR.inkMute, marginTop: 2 },

  checkList:   { gap: SPACE.s2 },
  empty:       { fontSize: FONT_SIZE.body, color: COLOR.inkMute, textAlign: 'center', paddingVertical: SPACE.s4 },

  sectionList:       { gap: 0 },
  sectionGroupLabel: { fontSize: 10.5, fontWeight: FONT_WEIGHT.bold as any, letterSpacing: 0.7, textTransform: 'uppercase', color: COLOR.inkMute, paddingTop: SPACE.s3, paddingBottom: SPACE.s1 } as any,
  sectionRow:        { flexDirection: 'row', alignItems: 'center', gap: SPACE.s3, paddingVertical: 10, paddingHorizontal: SPACE.s3, borderLeftWidth: 3, borderLeftColor: 'transparent', borderRadius: RADIUS.r2 },
  sectionRowOn:      { backgroundColor: COLOR.brandTint, borderLeftColor: COLOR.brand },
  sectionIcon:       { width: 36, height: 36, borderRadius: 9, backgroundColor: COLOR.bgAlt, alignItems: 'center', justifyContent: 'center' },
  sectionIconOn:     { backgroundColor: 'rgba(245,196,48,.15)' },
  sectionInfo:       { flex: 1 },
  sectionName:       { fontSize: FONT_SIZE.label, fontWeight: FONT_WEIGHT.semibold as any, color: COLOR.ink },
  sectionDesc:       { fontSize: FONT_SIZE.caption, color: COLOR.inkMute, marginTop: 2, lineHeight: 16 },

  summaryCard: { backgroundColor: COLOR.surface, borderRadius: RADIUS.r3, borderWidth: 1, borderColor: COLOR.border, overflow: 'hidden' },

  infoBox:     { flexDirection: 'row', gap: SPACE.s2, padding: SPACE.s3, backgroundColor: COLOR.brandTint, borderRadius: RADIUS.r2, alignItems: 'flex-start' },
  infoText:    { flex: 1, fontSize: FONT_SIZE.caption, color: COLOR.brandDeep, lineHeight: 18 },

  errorBox:    { flexDirection: 'row', gap: SPACE.s2, padding: SPACE.s3, backgroundColor: '#FEF2F2', borderRadius: RADIUS.r2, alignItems: 'flex-start' },
  errorText:   { flex: 1, fontSize: FONT_SIZE.caption, color: COLOR.expense, lineHeight: 18 },

  nav:         { flexDirection: 'row', alignItems: 'center', padding: SPACE.s4, borderTopWidth: 1, borderTopColor: COLOR.border, backgroundColor: COLOR.surface, gap: SPACE.s3 },
  backBtn:     { flexDirection: 'row', alignItems: 'center', gap: SPACE.s1, paddingVertical: SPACE.s2, paddingHorizontal: SPACE.s3 },
  backBtnText: { fontSize: FONT_SIZE.label, color: COLOR.ink2, fontWeight: FONT_WEIGHT.medium as any },
  nextBtn:     { borderRadius: RADIUS.full },
});

// Step indicator styles
const ind = StyleSheet.create({
  row:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACE.s4, paddingVertical: SPACE.s3, backgroundColor: COLOR.surface, borderBottomWidth: 1, borderBottomColor: COLOR.border },
  step:        { alignItems: 'center', gap: 4 },
  circle:      { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: COLOR.border2, backgroundColor: COLOR.bg, justifyContent: 'center', alignItems: 'center' },
  circleDone:  { borderColor: COLOR.income, backgroundColor: COLOR.income },
  circleActive:{ borderColor: COLOR.brand, backgroundColor: COLOR.brand },
  num:         { fontSize: 12, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.inkMute },
  numActive:   { color: COLOR.inkOnBrand },
  label:       { fontSize: 10, color: COLOR.inkMute, fontWeight: FONT_WEIGHT.medium as any },
  labelActive: { color: COLOR.brandDeep, fontWeight: FONT_WEIGHT.bold as any },
  line:        { flex: 1, height: 2, backgroundColor: COLOR.border, marginBottom: 14, marginHorizontal: 2 },
  lineDone:    { backgroundColor: COLOR.income },
});

// Checkbox row styles
const chk = StyleSheet.create({
  row:          { flexDirection: 'row', alignItems: 'center', gap: SPACE.s3, padding: SPACE.s3, borderRadius: RADIUS.r2, borderWidth: 1, borderColor: COLOR.border, backgroundColor: COLOR.surface },
  rowActive:    { borderColor: COLOR.brand, backgroundColor: COLOR.brandTint },
  icon:         { width: 36, height: 36, borderRadius: RADIUS.r2, backgroundColor: COLOR.bg, justifyContent: 'center', alignItems: 'center' },
  iconActive:   { backgroundColor: COLOR.brand },
  label:        { flex: 1, fontSize: FONT_SIZE.body, color: COLOR.ink2, fontWeight: FONT_WEIGHT.medium as any },
  labelActive:  { color: COLOR.ink, fontWeight: FONT_WEIGHT.bold as any },
  box:          { width: 22, height: 22, borderRadius: 4, borderWidth: 2, borderColor: COLOR.border2, justifyContent: 'center', alignItems: 'center' },
  boxActive:    { backgroundColor: COLOR.brand, borderColor: COLOR.brand },
});

// Summary row styles
const sum = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.s3, paddingHorizontal: SPACE.s4, paddingVertical: SPACE.s3 },
  rowBorder:{ borderBottomWidth: 1, borderBottomColor: COLOR.border },
  icon:     { marginTop: 2 },
  label:    { width: 80, fontSize: FONT_SIZE.caption, color: COLOR.inkMute, fontWeight: FONT_WEIGHT.medium as any, marginTop: 2 },
  value:    { flex: 1, fontSize: FONT_SIZE.body, color: COLOR.ink, fontWeight: FONT_WEIGHT.semibold as any },
});
