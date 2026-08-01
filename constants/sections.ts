export type UserScreen = 'sales' | 'inventory' | 'salesHistory' | 'operaciones';
export type SectionGroup = 'General' | 'Ventas' | 'Inventario' | 'Operaciones';

export interface SectionDef {
  key: string;
  label: string;
  icon: string;
  screen?: UserScreen;
  screenLabel?: string;
  description: string;
  group: SectionGroup;
}

export const SECTION_GROUPS: SectionGroup[] = ['General', 'Ventas', 'Inventario', 'Operaciones'];

export const ALL_SECTIONS: SectionDef[] = [
  { key: 'DASHBOARD',         label: 'Dashboard',          icon: 'view-dashboard-outline', group: 'General',     description: 'Métricas y resumen del negocio en tiempo real'        },
  { key: 'POS',               label: 'Ventas',              icon: 'cart-outline',           group: 'Ventas',      screen: 'sales',        description: 'Registrar ventas, cobrar a clientes y gestionar turnos' },
  { key: 'SALES_HISTORY',     label: 'Historial de ventas', icon: 'history',                group: 'Ventas',      screen: 'salesHistory', screenLabel: 'Mis ventas', description: 'Ver todas las ventas registradas en el local' },
  { key: 'INVENTORY',         label: 'Inventario',          icon: 'package-variant',        group: 'Inventario',  screen: 'inventory',    description: 'Consultar y controlar el stock de productos'           },
  { key: 'CATALOG',           label: 'Catálogo',            icon: 'tag-outline',            group: 'Inventario',  description: 'Gestionar el catálogo de productos y categorías'      },
  { key: 'TRANSACTIONS',      label: 'Operaciones',         icon: 'clipboard-text-outline', group: 'Operaciones', screen: 'operaciones',  description: 'Registrar movimientos de caja, ingresos y egresos'    },
  { key: 'BANK_DEPOSITS',     label: 'Depósitos bancarios', icon: 'bank-outline',           group: 'Operaciones', screen: 'operaciones',  description: 'Registrar depósitos realizados en cuenta bancaria'    },
  { key: 'SALARY_PAYMENTS',   label: 'Pagos de salarios',   icon: 'account-cash-outline',   group: 'Operaciones', screen: 'operaciones',  description: 'Gestionar y registrar pagos del personal del local'   },
  { key: 'SUPPLIER_PAYMENTS', label: 'Pagos a proveedores', icon: 'truck-delivery-outline', group: 'Operaciones', screen: 'operaciones',  description: 'Registrar pagos realizados a proveedores externos'    },
  { key: 'FORMS',             label: 'Formularios',         icon: 'form-select',            group: 'Operaciones', screen: 'operaciones',  description: 'Acceso a formularios personalizados y reportes'       },
];

// Order of screens in the user sidebar
export const USER_SCREEN_ORDER: UserScreen[] = ['sales', 'inventory', 'salesHistory', 'operaciones'];

// Sections that map to a real user screen — safe to assign as user permissions
export const ASSIGNABLE_SECTIONS = ALL_SECTIONS.filter(s => s.screen !== undefined);
