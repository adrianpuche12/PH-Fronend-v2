import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Menu, Button } from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { COLOR, RADIUS, FONT_SIZE, FONT_WEIGHT } from '../theme';

interface StoreItem {
  id: number;
  name: string;
}

interface Props {
  stores: StoreItem[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  includeAll?: boolean;
  allLabel?: string;
  disabled?: boolean;
}

export default function StoreDropdown({
  stores,
  selectedId,
  onSelect,
  includeAll = false,
  allLabel = 'Todos los locales',
  disabled = false,
}: Props) {
  const [visible, setVisible] = useState(false);

  const selectedName =
    selectedId === null
      ? allLabel
      : (stores.find(s => s.id === selectedId)?.name ?? 'Local');

  return (
    <Menu
      visible={visible}
      onDismiss={() => setVisible(false)}
      anchor={
        <Button
          mode="outlined"
          onPress={() => setVisible(true)}
          disabled={disabled}
          icon={() => (
            <MaterialCommunityIcons
              name={visible ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={COLOR.brand}
            />
          )}
          contentStyle={styles.buttonContent}
          labelStyle={styles.buttonLabel}
          style={styles.button}
          textColor={COLOR.brand}
        >
          {selectedName}
        </Button>
      }
    >
      {includeAll && (
        <Menu.Item
          title={allLabel}
          leadingIcon={selectedId === null ? 'check' : undefined}
          onPress={() => { onSelect(null); setVisible(false); }}
          titleStyle={selectedId === null ? styles.activeItem : undefined}
        />
      )}
      {stores.map(s => (
        <Menu.Item
          key={s.id}
          title={s.name}
          leadingIcon={selectedId === s.id ? 'check' : undefined}
          onPress={() => { onSelect(s.id); setVisible(false); }}
          titleStyle={selectedId === s.id ? styles.activeItem : undefined}
        />
      ))}
    </Menu>
  );
}

const styles = StyleSheet.create({
  button: {
    borderColor: COLOR.brand,
    borderRadius: RADIUS.r2,
    minWidth: 150,
  },
  buttonContent: {
    flexDirection: 'row-reverse',
    paddingHorizontal: 4,
  },
  buttonLabel: {
    fontSize: FONT_SIZE.label,
    fontWeight: FONT_WEIGHT.semibold as any,
  },
  activeItem: {
    color: COLOR.brand,
    fontWeight: FONT_WEIGHT.bold as any,
  },
});
