/**
 * DateRangePicker — selector de rango de fechas reutilizable.
 *
 * Props:
 *  from      — 'yyyy-MM-dd' o '' (vacío = sin filtro)
 *  to        — 'yyyy-MM-dd' o ''
 *  onChange  — callback(from, to) cuando el usuario confirma
 *  label     — etiqueta del input (default: 'Rango de fechas')
 *  error     — true para mostrar borde de error
 *  errorText — texto de error a mostrar debajo del input
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { TextInput } from 'react-native-paper';
import { DatePickerModal } from 'react-native-paper-dates';
import { format } from 'date-fns';
import { COLOR, FONT_SIZE } from '../theme';

interface DateRangePickerProps {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
  label?: string;
  error?: boolean;
  errorText?: string;
}

export default function DateRangePicker({
  from,
  to,
  onChange,
  label,
  error,
  errorText,
}: DateRangePickerProps) {
  const [visible, setVisible] = useState(false);

  const displayValue =
    from && to
      ? `${from}  →  ${to}`
      : from
      ? `Desde ${from}`
      : '';

  const startDate = from ? new Date(from + 'T12:00:00') : undefined;
  const endDate   = to   ? new Date(to   + 'T12:00:00') : undefined;

  const handleConfirm = ({
    startDate: s,
    endDate:   e,
  }: {
    startDate: Date | undefined;
    endDate:   Date | undefined;
  }) => {
    setVisible(false);
    onChange(
      s ? format(s, 'yyyy-MM-dd') : '',
      e ? format(e, 'yyyy-MM-dd') : '',
    );
  };

  return (
    <View>
      <TouchableOpacity onPress={() => setVisible(true)} activeOpacity={0.7}>
        <TextInput
          label={label ?? 'Rango de fechas'}
          value={displayValue}
          mode="outlined"
          editable={false}
          pointerEvents="none"
          error={error}
          left={<TextInput.Icon icon="calendar-range" color={COLOR.brandDark} />}
          right={
            displayValue
              ? <TextInput.Icon icon="close-circle" onPress={() => onChange('', '')} color={COLOR.inkMute} />
              : undefined
          }
          outlineColor={COLOR.border2}
          activeOutlineColor={COLOR.brand}
          theme={{ colors: { primary: COLOR.brand } }}
          style={styles.input}
        />
      </TouchableOpacity>

      {error && errorText ? (
        <Text style={styles.errorText}>{errorText}</Text>
      ) : null}

      <DatePickerModal
        locale="es"
        mode="range"
        visible={visible}
        onDismiss={() => setVisible(false)}
        startDate={startDate}
        endDate={endDate}
        onConfirm={handleConfirm}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  input:     { backgroundColor: COLOR.surface },
  errorText: { fontSize: FONT_SIZE.caption, color: COLOR.expense, marginTop: 4, marginLeft: 4 },
});
