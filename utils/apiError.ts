export function getApiErrorMessage(err: unknown, defaultMessage: string): string {
  const e = err as any;
  if (e?.response?.status === 403) {
    const code: string = e.response?.data?.error ?? '';
    if (code === 'SECTION_FORBIDDEN') return 'No tenés permiso para esta sección. Contactá al encargado.';
    if (code === 'STORE_FORBIDDEN')   return 'No tenés acceso a los datos de este local.';
    if (code === 'ACCOUNT_SUSPENDED') return 'Tu cuenta fue suspendida. Contactá al encargado.';
  }
  return defaultMessage;
}
