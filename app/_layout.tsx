import { Slot, useSegments, useRootNavigationState, router } from 'expo-router';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { Provider as PaperProvider, MD3LightTheme } from 'react-native-paper';

const appTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary:              '#F5C430',
    onPrimary:            '#1F1B16',
    primaryContainer:     '#FEF6D8',
    onPrimaryContainer:   '#A68022',
    secondary:            '#4A4338',
    onSecondary:          '#FFFFFF',
    secondaryContainer:   '#F4F0E8',
    onSecondaryContainer: '#1F1B16',
    error:                '#C0392B',
    onError:              '#FFFFFF',
    errorContainer:       '#FBEAE8',
    onErrorContainer:     '#C0392B',
    surface:              '#FFFFFF',
    onSurface:            '#1F1B16',
    surfaceVariant:       '#F4F0E8',
    onSurfaceVariant:     '#4A4338',
    outline:              '#D7D1C5',
    background:           '#F8F6F2',
    onBackground:         '#1F1B16',
  },
};

type ValidSegment = 'login' | 'admin' | 'index' | '(tabs)' | '+not-found';

function RootLayoutNav() {
  const { isAuthenticated, roles } = useAuth();
  const segments = useSegments();
  const navigationState = useRootNavigationState();

  useEffect(() => {
    if (!navigationState?.key) return;

    const currentSegment = segments.length > 0 ? (segments[0] as ValidSegment) : '';

    const handleNavigation = () => {
      if (!isAuthenticated) {
        // Si no está autenticado, redirige al login
        if (currentSegment !== 'login') {
          router.replace('/login');
        }
      } else {
        const isAdmin = roles.includes('admin');
        if (isAdmin) {
          // El admin tiene acceso a todo el sistema, no se fuerza ninguna redirección
          if (currentSegment === 'login') {
            router.replace('/admin'); // Redirige al admin a su dashboard
          }
        } else {
          // Usuarios normales solo pueden acceder a '/' o rutas específicas
          const allowedSegments = ['index', '(tabs)']; // Rutas permitidas para usuarios normales
          if (!allowedSegments.includes(currentSegment)) {
            router.replace('/'); // Redirige a la ruta raíz
          }
        }
      }
    };

    handleNavigation();
  }, [isAuthenticated, navigationState?.key, segments, roles]);

  return <Slot />;
}

export default function RootLayout() {
  return (
    <PaperProvider theme={appTheme}>
      <AuthProvider>
        <RootLayoutNav />
      </AuthProvider>
    </PaperProvider>
  );
}