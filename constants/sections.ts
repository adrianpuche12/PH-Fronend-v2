export type UserScreen = 'sales' | 'inventory' | 'salesHistory' | 'operaciones';

export interface SectionDef {
  key: string;
  label: string;
  icon: string;
  screen?: UserScreen;
  screenLabel?: string;
}

export const ALL_SECTIONS: SectionDef[] = [
  { key: 'POS',               label: 'Ventas',              icon: 'cart-outline',           screen: 'sales'        },
  { key: 'SALES_HISTORY',     label: 'Historial de ventas', icon: 'history',                screen: 'salesHistory', screenLabel: 'Mis ventas' },
  { key: 'INVENTORY',         label: 'Inventario',          icon: 'package-variant',        screen: 'inventory'    },
  { key: 'TRANSACTIONS',      label: 'Operaciones',         icon: 'clipboard-text-outline', screen: 'operaciones'  },
  { key: 'BANK_DEPOSITS',     label: 'Depósitos bancarios', icon: 'bank-outline',           screen: 'operaciones'  },
  { key: 'SALARY_PAYMENTS',   label: 'Pagos de salarios',   icon: 'account-cash-outline',   screen: 'operaciones'  },
  { key: 'SUPPLIER_PAYMENTS', label: 'Pagos a proveedores', icon: 'truck-delivery-outline', screen: 'operaciones'  },
  { key: 'FORMS',             label: 'Formularios',         icon: 'form-select',            screen: 'operaciones'  },
  { key: 'CATALOG',           label: 'Catálogo',            icon: 'tag-outline'             },
  { key: 'DASHBOARD',         label: 'Dashboard',           icon: 'view-dashboard-outline'  },
];

// Order of screens in the user sidebar
export const USER_SCREEN_ORDER: UserScreen[] = ['sales', 'inventory', 'salesHistory', 'operaciones'];
