// --- START OF FILE app/(tabs)/index.tsx (Nueva Pantalla de Inicio) ---

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Image,
  ScrollView,
  SafeAreaView,
  Alert,
} from 'react-native';
import { useAuth } from '../_layout';
import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import { useLocation } from '../../contexts/LocationContext';

// --- Paleta de Colores ---
const COLORS = {
  primary: '#C62828',
  secondary: '#1976D2',
  background: '#f4f6f8',
  card: '#FFFFFF',
  textPrimary: '#212121',
  textSecondary: '#757575',
  admin: '#FF9800',
  employee: '#4CAF50',
};

// --- Componente de Tarjeta de Acción Reutilizable ---
const ActionCard = ({ title, icon, color, description, onPress }: any) => (
  <TouchableOpacity style={styles.card} onPress={onPress}>
    <View style={[styles.cardIconContainer, { backgroundColor: color }]}>
      <Ionicons name={icon} size={28} color="#fff" />
    </View>
    <View style={styles.cardTextContainer}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardDescription}>{description}</Text>
    </View>
    <Ionicons name="chevron-forward-outline" size={24} color={COLORS.textSecondary} />
  </TouchableOpacity>
);

export default function HomeScreen() {
  const { signOut, user } = useAuth();
  const { startTracking } = useLocation();
  const router = useRouter();

  const handleLogout = () => {
    Alert.alert(
      "Cerrar Sesión",
      "¿Estás seguro de que quieres cerrar tu sesión?",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Sí, Cerrar Sesión", style: "destructive", onPress: executeLogout },
      ]
    );
  };

  const executeLogout = async () => {
    if (user?.token) {
      try {
        await startTracking(user.token, 'logout');
      } catch (e) {
        console.warn("No se pudo registrar ubicación de logout", e);
      }
    }
    signOut();
  };

  if (!user?.userData) {
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  }

  const { name, role, profile_photo_url } = user.userData;
  const isAdmin = role === 'admin' || role === 'root';
  
  // Validar que name sea una cadena
  const displayName = typeof name === 'string' ? name : 'Usuario';

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        
        {/* --- Encabezado de Bienvenida --- */}
        <View style={styles.header}>
          <View>
            <Text style={styles.welcomeText}>¡Hola de nuevo!</Text>
            <Text style={styles.userName}>{displayName}</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/(tabs)/profile')}>
            <Image
              source={{ uri: profile_photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&color=FFFFFF&background=C62828&bold=true` }}
              style={styles.profileImage}
            />
          </TouchableOpacity>
        </View>

        {/* --- Tarjetas de Acciones Rápidas --- */}
        <View style={styles.actionsContainer}>
          <Text style={styles.sectionTitle}>Accesos Rápidos</Text>
          
          {/* Tarjetas para todos los usuarios */}
          <ActionCard
            title="Mi Perfil"
            description="Edita tus datos y foto"
            icon="person-outline"
            color={COLORS.secondary}
            onPress={() => router.push('/(tabs)/profile')}
          />
          

          {/* Panel de Administrador */}
          {isAdmin && (
            <>
              <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Panel de Administrador</Text>
              <ActionCard
                title="Mapa General"
                description="Visualiza a todos los usuarios"
                icon="map-outline"
                color={COLORS.admin}
                onPress={() => router.push('/(tabs)/admin-map')}
              />
              <ActionCard
                title="Gestión de Usuarios"
                description="Administra cuentas y permisos"
                icon="people-outline"
                color={COLORS.admin}
                onPress={() => router.push('/(tabs)/admin-users')}
              />
              <ActionCard
                title="Dashboard Ejecutivo"
                description="Estadísticas y métricas"
                icon="analytics-outline"
                color={COLORS.admin}
                onPress={() => router.push('/(tabs)/dashboard')}
              />
              <ActionCard
                title="Operaciones"
                description="Gestión de operaciones y formularios"
                icon="business-outline"
                color={COLORS.primary}
                onPress={() => router.push('/(tabs)/operaciones')}
              />
            </>
          )}
        </View>
        {/* --- Botón de Cerrar Sesión --- */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={22} color={COLORS.primary} />
          <Text style={styles.logoutButtonText}>Cerrar Sesión</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

// --- Hoja de Estilos Moderna ---
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  container: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
  },
  welcomeText: {
    fontSize: 18,
    color: COLORS.textSecondary,
  },
  userName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  profileImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  actionsContainer: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 15,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 15,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  cardIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  cardTextContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  cardDescription: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    marginTop: 20,
  },
  logoutButtonText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
});