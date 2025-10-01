import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { useAuth } from '../app/_layout';

const COLORS = {
  primary: '#C62828',
  background: '#FFFFFF',
  textPrimary: '#212121',
  textSecondary: '#757575',
};

export default function TopTabBar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const userRole = user?.userData?.role || 'empleado';
  const isAdmin = userRole === 'root' || userRole === 'admin';

  const tabs = [
    { name: 'index', title: 'Home', icon: 'home', route: '/' },
    { name: 'operaciones', title: 'Operaciones', icon: 'business', route: '/operaciones' },
    { name: 'tracking', title: 'Tracking', icon: 'location-sharp', route: '/tracking' },
    ...(isAdmin ? [
      { name: 'dashboard', title: 'Dashboard', icon: 'analytics', route: '/dashboard' },
      { name: 'admin-map', title: 'Mapa', icon: 'map', route: '/admin-map' },
      { name: 'admin-users', title: 'Usuarios', icon: 'people', route: '/admin-users' }
    ] : []),
    { name: 'profile', title: 'Perfil', icon: 'person', route: '/profile' },
  ];

  return (
    <View style={styles.container}>
      {tabs.map((tab) => {
        const isActive = pathname === tab.route || 
          (tab.route === '/' && pathname === '/index') ||
          pathname.includes(tab.name);
        
        return (
          <TouchableOpacity
            key={tab.name}
            style={[styles.tab, isActive && styles.activeTab]}
            onPress={() => router.push(tab.route as any)}
          >
            <Ionicons 
              name={tab.icon as any} 
              size={20} 
              color={isActive ? COLORS.primary : COLORS.textSecondary} 
            />
            <Text style={[
              styles.tabText, 
              isActive && styles.activeTabText
            ]}>
              {tab.title}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    paddingTop: 50, // Para el notch del iPhone
    paddingBottom: 8,
    paddingHorizontal: 5,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    marginHorizontal: 2,
  },
  activeTab: {
    backgroundColor: `${COLORS.primary}15`,
  },
  tabText: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 2,
    fontWeight: '500',
  },
  activeTabText: {
    color: COLORS.primary,
    fontWeight: '600',
  },
});
