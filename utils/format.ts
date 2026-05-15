/**
 * Formato de moneda hondureña.
 * Convención: 'L 1,234.56' — espacio después de L, separador de miles con coma.
 */
export const formatHnl = (v: number): string =>
  `L ${Number(v).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;

/**
 * Formatea una fecha ISO a DD/MM/AAAA en locale es-HN.
 */
export const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('es-HN', { day: '2-digit', month: '2-digit', year: 'numeric' });

/**
 * Formatea una fecha ISO a HH:MM en locale es-HN.
 */
export const formatTime = (iso: string): string =>
  new Date(iso).toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit' });

/**
 * Fecha relativa simple: 'Hoy', 'Ayer', o la fecha formateada.
 */
export const formatDateRelative = (iso: string): string => {
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((today.getTime() - target.getTime()) / 86_400_000);
  if (diffDays === 0) return 'Hoy';
  if (diffDays === 1) return 'Ayer';
  if (diffDays < 7) return `hace ${diffDays} días`;
  return formatDate(iso);
};
