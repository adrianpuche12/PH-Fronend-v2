import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { COLOR, SPACE } from '../../theme';

interface Props {
  spacing?: number;
  style?: ViewStyle;
}

const AppDivider: React.FC<Props> = ({ spacing = SPACE.s3, style }) => (
  <View style={[styles.divider, { marginVertical: spacing }, style]} />
);

const styles = StyleSheet.create({
  divider: { height: 1, backgroundColor: COLOR.border },
});

export default AppDivider;
