import { COLOR } from '../theme';

interface Stockable {
  quantity: number;
  lowStock: boolean;
}

/**
 * Color semántico del stock de un producto.
 * Rojo = sin stock, naranja = stock bajo, verde = OK.
 */
export const stockColor = (item: Stockable): string => {
  if (item.quantity === 0) return COLOR.expense;
  if (item.lowStock)       return COLOR.warn;
  return COLOR.income;
};

/**
 * Label accesible del estado de stock.
 */
export const stockLabel = (item: Stockable): string => {
  if (item.quantity === 0) return 'Sin stock';
  if (item.lowStock)       return 'Stock bajo';
  return 'Stock OK';
};
