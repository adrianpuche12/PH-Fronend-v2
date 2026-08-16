import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { RadioButton, Text, ActivityIndicator } from 'react-native-paper';
import axios from 'axios';
import { REACT_APP_API_URL } from '../config';
import { COLOR, SPACE, FONT_SIZE, FONT_WEIGHT } from '../theme';
import { useAuth } from '../context/AuthContext';

interface Store {
  id: number;
  name: string;
}

interface StoreSelectorProps {
  selectedStore: number;
  onStoreChange: (storeId: number) => void;
  style?: any;
}

const StoreSelector: React.FC<StoreSelectorProps> = ({ selectedStore, onStoreChange, style }) => {
  const { storeId: assignedStoreId } = useAuth();
  const [stores, setStores]     = useState<Store[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    axios.get<Store[]>(`${REACT_APP_API_URL}/api/v2/stores/active`)
      .then(res => {
        setStores(res.data);
        if (assignedStoreId) {
          onStoreChange(assignedStoreId);
        } else if (!selectedStore && res.data.length > 0) {
          // Auto-seleccionar el primero si no hay ninguno seleccionado
          onStoreChange(res.data[0].id);
        }
      })
      .catch(() => setStores([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <ActivityIndicator size="small" color={COLOR.brand} style={{ marginVertical: SPACE.s3 }} />;
  }

  if (stores.length === 0) {
    return <Text style={styles.empty}>No hay locales activos disponibles.</Text>;
  }

  // Empleado con un único local asignado (AppUser.store en el backend): no tiene sentido
  // mostrarle una lista para elegir entre locales que no le corresponden.
  if (assignedStoreId) {
    const assignedStore = stores.find(s => s.id === assignedStoreId);
    return (
      <View style={[styles.container, style]}>
        <Text style={styles.label}>Local</Text>
        <Text style={styles.fixedStore}>{assignedStore?.name ?? '—'}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.label}>Seleccionar local:</Text>
      <RadioButton.Group
        onValueChange={(value) => onStoreChange(Number(value))}
        value={selectedStore.toString()}
      >
        {stores.map(store => (
          <RadioButton.Item
            key={store.id}
            label={store.name}
            value={store.id.toString()}
            style={styles.radioItem}
            labelStyle={styles.radioLabel}
            color={COLOR.brandDark}
          />
        ))}
      </RadioButton.Group>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: SPACE.s2,
  },
  label: {
    fontSize: FONT_SIZE.label,
    fontWeight: FONT_WEIGHT.semibold as any,
    color: COLOR.ink2,
    marginBottom: SPACE.s2,
  },
  radioItem: {
    borderBottomWidth: 1,
    borderBottomColor: COLOR.border,
    paddingVertical: SPACE.s2,
  },
  radioLabel: {
    fontSize: FONT_SIZE.body,
    color: COLOR.ink,
  },
  fixedStore: {
    fontSize: FONT_SIZE.body,
    fontWeight: FONT_WEIGHT.semibold as any,
    color: COLOR.ink,
    paddingVertical: SPACE.s2,
  },
  empty: {
    fontSize: FONT_SIZE.label,
    color: COLOR.inkMute,
    marginVertical: SPACE.s3,
    textAlign: 'center',
  },
});

export default StoreSelector;
