import React from 'react';
import { Modal, View, Text, StyleSheet } from 'react-native';
import { Button } from 'react-native-paper';
import { COLOR, SPACE, RADIUS, FONT_SIZE, FONT_WEIGHT } from '../theme';

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
  confirmColor = COLOR.expense,
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
            textColor={COLOR.white}
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
  overlay: { flex: 1, backgroundColor: COLOR.overlay, justifyContent: 'center', alignItems: 'center' },
  box:     { backgroundColor: COLOR.surface, borderRadius: RADIUS.r4, padding: SPACE.s5, width: '85%', maxWidth: 400, gap: SPACE.s3 },
  title:   { fontSize: FONT_SIZE.h2, fontWeight: FONT_WEIGHT.bold as any, color: COLOR.ink },
  message: { fontSize: FONT_SIZE.label, color: COLOR.ink2, fontWeight: FONT_WEIGHT.medium as any, lineHeight: 20 },
  actions: { flexDirection: 'row', gap: SPACE.s2, marginTop: SPACE.s1 },
  btn:     { flex: 1, borderRadius: RADIUS.r2 },
});

export default ConfirmDialog;
