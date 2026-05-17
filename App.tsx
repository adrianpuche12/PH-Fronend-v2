import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { Provider as PaperProvider, MD3LightTheme } from 'react-native-paper';
import { registerTranslation } from 'react-native-paper-dates';
import FormScreen from './screens/FormScreen';
import StackNavigator from './navigation/StackNavigator';
import { PAPER_THEME } from './theme';

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

registerTranslation('es', {
  save:                    'Confirmar',
  selectSingle:            'Seleccionar fecha',
  selectMultiple:          'Seleccionar fechas',
  selectRange:             'Seleccionar rango',
  notAccordingToDateFormat: (inputFormat) => `Formato esperado: ${inputFormat}`,
  mustBeHigherThan:        (date) => `Debe ser posterior a ${date}`,
  mustBeLowerThan:         (date) => `Debe ser anterior a ${date}`,
  mustBeBetween:           (startDate, endDate) => `Debe estar entre ${startDate} y ${endDate}`,
  dateIsDisabled:          'Fecha no disponible',
  previous:                'Anterior',
  next:                    'Siguiente',
  typeInDate:              'Escribir fecha',
  pickDateFromCalendar:    'Elegir del calendario',
  close:                   'Cerrar',
  hour:                    'Hora',
  minute:                  'Minuto',
});

const Stack = createStackNavigator();

export default function App() {
  return (
    <PaperProvider theme={appTheme}>
      <NavigationContainer>
        <StackNavigator/>
      </NavigationContainer>
    </PaperProvider>
  );
}

