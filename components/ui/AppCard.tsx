import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { COLOR, RADIUS, SHADOW, SPACE } from '../../theme';

interface Props {
  children: React.ReactNode;
  style?: ViewStyle;
  padding?: number;
  shadow?: 'none' | 'sm' | 'md';
}

const AppCard: React.FC<Props> = ({
  children, style, padding = SPACE.s4, shadow = 'sm',
}) => (
  <View style={[styles.card, SHADOW[shadow], { padding }, style]}>
    {children}
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLOR.surface,
    borderRadius: RADIUS.r3,
    borderWidth: 1,
    borderColor: COLOR.border,
  },
});

export default AppCard;
