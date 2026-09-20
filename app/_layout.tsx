import { Slot, useSegments, useRootNavigationState, router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
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
  useEffect(() => {
    if (Platform.OS === 'web') {
      const style = document.createElement('style');
      style.textContent = `
        * { scrollbar-width: none; }
        *::-webkit-scrollbar { display: none; }
        @keyframes onAutoFillStart { from {} to {} }
        @keyframes onAutoFillCancel { from {} to {} }
        input:-webkit-autofill {
          animation-name: onAutoFillStart;
          -webkit-text-fill-color: #1F1B16;
          -webkit-box-shadow: 0 0 0px 1000px #fff inset;
          transition: background-color 5000s ease-in-out 0s;
          caret-color: #1F1B16;
        }
        input:not(:-webkit-autofill) { animation-name: onAutoFillCancel; }
      `;
      // Detect browser autofill and fire input event so React updates state
      document.addEventListener('animationstart', (e: AnimationEvent) => {
        const target = e.target as HTMLInputElement;
        if (e.animationName === 'onAutoFillStart' && target?.tagName === 'INPUT') {
          target.dispatchEvent(new Event('input', { bubbles: true }));
          target.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, true);
      document.head.appendChild(style);
    }
  }, []);

  return (
    <PaperProvider theme={appTheme}>
      <AuthProvider>
        <RootLayoutNav />
      </AuthProvider>
    </PaperProvider>
  );
}