import React, { useState } from 'react';
import {
  View, StyleSheet, KeyboardAvoidingView, Platform,
  ScrollView, StatusBar, Text,
} from 'react-native';
import { TextInput, Button } from 'react-native-paper';
import { router } from 'expo-router';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { REACT_APP_API_URL } from '../config';
import { COLOR, SPACE, RADIUS, FONT_SIZE, FONT_WEIGHT } from '../theme';

export default function ChangePasswordScreen() {
  const { userName, roles, setFirstLoginFalse } = useAuth();
  const isAdmin = roles.includes('admin');

  const [newPassword, setNewPassword]     = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew]             = useState(false);
  const [showConfirm, setShowConfirm]     = useState(false);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState('');

  const validate = (): string => {
    if (!newPassword) return 'Ingresa la nueva contrasena';
    if (newPassword.length < 8) return 'La contrasena debe tener al menos 8 caracteres';
    if (newPassword !== confirmPassword) return 'Las contrasenas no coinciden';
    return '';
  };

  const handleSubmit = async () => {
    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    setLoading(true);
    setError('');
    try {
      await axios.put(`${REACT_APP_API_URL}/api/v2/users/change-password`, {
        username: userName,
        newPassword,
      });
      await setFirstLoginFalse();
      router.replace(isAdmin ? '/admin' : '/');
    } catch (e: any) {
      setError(e.response?.data?.error || 'Error al cambiar la contrasena');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="dark-content" backgroundColor={COLOR.brandTint} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>

          {/* Logo / icono */}
          <View style={styles.iconWrap}>
            <Text style={styles.iconEmoji}>🔐</Text>
          </View>

          <Text style={styles.title}>Primer acceso</Text>
          <Text style={styles.subtitle}>
            Por seguridad, debes establecer una nueva contrasena antes de continuar.
          </Text>

          <TextInput
            label="Nueva contrasena"
            value={newPassword}
            onChangeText={v => { setNewPassword(v); setError(''); }}
            mode="outlined"
            style={styles.input}
            secureTextEntry={!showNew}
            autoCapitalize="none"
            right={
              <TextInput.Icon
                icon={showNew ? 'eye-off' : 'eye'}
                onPress={() => setShowNew(v => !v)}
              />
            }
          />

          <TextInput
            label="Confirmar contrasena"
            value={confirmPassword}
            onChangeText={v => { setConfirmPassword(v); setError(''); }}
            mode="outlined"
            style={styles.input}
            secureTextEntry={!showConfirm}
            autoCapitalize="none"
            right={
              <TextInput.Icon
                icon={showConfirm ? 'eye-off' : 'eye'}
                onPress={() => setShowConfirm(v => !v)}
              />
            }
          />

          {!!error && <Text style={styles.errorText}>{error}</Text>}

          <Button
            mode="contained"
            onPress={handleSubmit}
            loading={loading}
            disabled={loading}
            buttonColor={COLOR.brand}
            textColor={COLOR.inkOnBrand}
            style={styles.btn}
            contentStyle={{ paddingVertical: 6 }}
          >
            Establecer contrasena
          </Button>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLOR.brandTint ?? '#FEF6D8',
    padding: SPACE.s4,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: COLOR.surface,
    borderRadius: RADIUS.r4,
    padding: SPACE.s6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    gap: SPACE.s2,
  },
  iconWrap: {
    alignItems: 'center',
    marginBottom: SPACE.s2,
  },
  iconEmoji: {
    fontSize: 48,
  },
  title: {
    fontSize: FONT_SIZE.h1,
    fontWeight: FONT_WEIGHT.bold as any,
    color: COLOR.ink,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FONT_SIZE.label,
    color: COLOR.ink2,
    textAlign: 'center',
    marginBottom: SPACE.s2,
    lineHeight: 20,
  },
  input: {
    marginBottom: SPACE.s1,
  },
  errorText: {
    color: COLOR.expense,
    fontSize: FONT_SIZE.caption,
    textAlign: 'center',
    marginTop: SPACE.s1,
  },
  btn: {
    borderRadius: RADIUS.r2,
    marginTop: SPACE.s2,
  },
});
