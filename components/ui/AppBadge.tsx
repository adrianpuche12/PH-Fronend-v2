import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { COLOR, RADIUS, SPACE, FONT_SIZE, FONT_WEIGHT } from '../../theme';

type Tone = 'brand' | 'income' | 'expense' | 'warn' | 'info' | 'neutral';

interface Props {
  label: string;
  tone?: Tone;
  style?: ViewStyle;
}

const TONE_STYLE: Record<Tone, { bg: string; text: string; border: string }> = {
  brand:   { bg: COLOR.brandTint,    text: COLOR.brandDeep,  border: COLOR.brandTint2 },
  income:  { bg: COLOR.incomeTint,   text: COLOR.income,     border: COLOR.incomeBorder },
  expense: { bg: COLOR.expenseTint,  text: COLOR.expense,    border: COLOR.expenseBorder },
  warn:    { bg: COLOR.warnTint,     text: COLOR.warn,       border: COLOR.warnBorder },
  info:    { bg: COLOR.infoTint,     text: COLOR.info,       border: COLOR.infoBorder },
  neutral: { bg: COLOR.surface2,     text: COLOR.ink2,       border: COLOR.border2 },
};

const AppBadge: React.FC<Props> = ({ label, tone = 'neutral', style }) => {
  const t = TONE_STYLE[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg, borderColor: t.border }, style]}>
      <Text style={[styles.label, { color: t.text }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    borderRadius: RADIUS.full,
    borderWidth: 1,
    paddingHorizontal: SPACE.s2 + 2,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: FONT_SIZE.caption,
    fontWeight: FONT_WEIGHT.semibold as any,
    letterSpacing: 0.3,
  },
});

export default AppBadge;
