import React from 'react';
import { Modal, View, Text, StyleSheet } from 'react-native';
import { Button } from 'react-native-paper';

interface Props {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmColor?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Modal de confirmación reutilizable para acciones destructivas.
 * Reemplaza window.confirm() que no funciona en React Native mobile.
 */
const ConfirmDialog: React.FC<Props> = ({
  visible, title, message,
  confirmLabel = 'Confirmar',
  confirmColor = '#d32121',
  onConfirm, onCancel,
}) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
    <View style={styles.overlay}>
      <View style={styles.box}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
        <View style={styles.actions}>
          <Button mode="outlined" onPress={onCancel} style={styles.btn}>
            Cancelar
          </Button>
          <Button
            mode="contained"
            onPress={onConfirm}
            buttonColor={confirmColor}
            textColor="#fff"
            style={styles.btn}
          >
            {confirmLabel}
          </Button>
        </View>
      </View>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  box:     { backgroundColor: '#fff', borderRadius: 18, padding: 24, width: '85%', maxWidth: 400, gap: 12 },
  title:   { fontSize: 18, fontWeight: '900', color: '#161616' },
  message: { fontSize: 14, color: '#53606d', fontWeight: '600', lineHeight: 20 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  btn:     { flex: 1, borderRadius: 10 },
});

export default ConfirmDialog;
