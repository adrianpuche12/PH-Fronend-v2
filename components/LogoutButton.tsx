import React from 'react';
import { IconButton } from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import { StyleSheet } from 'react-native';
import { COLOR, Z } from '../theme';

const LogoutButton = () => {
  const { logout } = useAuth();


  
  return (
    <IconButton
      icon="logout"
      size={24}
      onPress={logout}
      style={styles.logoutButton}
    />
  );
};

const styles = StyleSheet.create({
  logoutButton: {
    position: 'absolute',
    top: 3,
    right: 10,
    zIndex: Z.appBar,
    backgroundColor: COLOR.expenseTint,
    borderRadius: 20,
  },
});

export default LogoutButton;