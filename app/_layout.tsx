import { Slot, useSegments, useRootNavigationState, router } from 'expo-router';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from '../context/AuthContext';

type ValidSegment = 'login' | 'change-password' | 'admin' | 'index' | '(tabs)' | '+not-found';

function RootLayoutNav() {
  const { isAuthenticated, roles, firstLogin } = useAuth();
  const segments = useSegments();
  const navigationState = useRootNavigationState();

  useEffect(() => {
    if (!navigationState?.key) return;

    const currentSegment = segments.length > 0 ? (segments[0] as ValidSegment) : '';

    const handleNavigation = () => {
      if (!isAuthenticated) {
        if (currentSegment !== 'login') {
          router.replace('/login');
        }
        return;
      }

      // Primer login: forzar cambio de contraseña antes de entrar
      if (firstLogin) {
        if (currentSegment !== 'change-password') {
          router.replace('/change-password');
        }
        return;
      }

      const isAdmin = roles.includes('admin');
      if (isAdmin) {
        if (currentSegment === 'login' || currentSegment === 'change-password') {
          router.replace('/admin');
        }
      } else {
        const allowedSegments = ['index', '(tabs)'];
        if (!allowedSegments.includes(currentSegment)) {
          router.replace('/');
        }
      }
    };

    handleNavigation();
  }, [isAuthenticated, firstLogin, navigationState?.key, segments, roles]);

  return <Slot />;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}