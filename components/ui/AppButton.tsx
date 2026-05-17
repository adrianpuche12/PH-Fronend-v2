import React from 'react';
import {
  TouchableOpacity, Text, StyleSheet, ActivityIndicator,
  ViewStyle, TextStyle,
} from 'react-native';
import { COLOR, SPACE, RADIUS, FONT_SIZE, FONT_WEIGHT, CONTROL } from '../../theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size    = 'md' | 'sm';

interface Props {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  labelStyle?: TextStyle;
}

const AppButton: React.FC<Props> = ({
  label, onPress, variant = 'primary', size = 'md',
  loading = false, disabled = false, fullWidth = false,
  style, labelStyle,
}) => {
  const isDisabled = disabled || loading;
  const h = size === 'sm' ? CONTROL.buttonSmH : CONTROL.buttonH;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.75}
      style={[
        styles.base,
        styles[variant],
        { height: h },
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading
        ? <ActivityIndicator color={variant === 'primary' ? COLOR.inkOnBrand : COLOR.brand} size="small" />
        : <Text style={[styles.label, styles[`${variant}Label`], { fontSize: size === 'sm' ? FONT_SIZE.label : FONT_SIZE.body }, labelStyle]}>
            {label}
          </Text>
      }
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: RADIUS.r2,
    paddingHorizontal: SPACE.s5,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  fullWidth: { width: '100%' },
  disabled:  { opacity: 0.45 },

  // Variantes
  primary:   { backgroundColor: COLOR.brand, borderWidth: 0 },
  secondary: { backgroundColor: COLOR.surface, borderWidth: 1, borderColor: COLOR.border2 },
  ghost:     { backgroundColor: COLOR.transparent, borderWidth: 0 },
  danger:    { backgroundColor: COLOR.expense, borderWidth: 0 },

  // Labels
  label:          { fontWeight: FONT_WEIGHT.semibold as any },
  primaryLabel:   { color: COLOR.inkOnBrand },
  secondaryLabel: { color: COLOR.ink },
  ghostLabel:     { color: COLOR.ink2 },
  dangerLabel:    { color: COLOR.white },
});

export default AppButton;
