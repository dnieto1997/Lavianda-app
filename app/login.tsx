// --- START OF FILE app/login.tsx ---

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  Image,
  ActivityIndicator,
} from 'react-native';
import axios from 'axios';
import { useAuth } from './_layout';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useLocation } from '../contexts/LocationContext'; // Asegúrate de que la ruta sea correcta

// --- Paleta de Colores ---
const COLORS = {
  primary: '#C62828',
  background: '#FFFFFF',
  card: '#FFFFFF',
  textPrimary: '#212121',
  textSecondary: '#757575',
  placeholder: '#BDBDBD',
  border: '#E0E0E0',
};

// --- Configuración de la API ---
const API_BASE = 'https://operaciones.lavianda.com.co/api';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const { startTracking, startBackgroundTracking } = useLocation();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Por favor, ingresa tu email y contraseña.');
      return;
    }
    setLoading(true);
    
    try {
      console.log('🔄 Intentando login con:', email);
      console.log('🌐 URL API Login:', `${API_BASE}/login`);
      
      const loginResponse = await axios.post(
        `${API_BASE}/login`,
        { 
          email: email, 
          password: password 
        },
        { 
          headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          timeout: 15000
        }
      );

      console.log('✅ Login exitoso:', loginResponse.data);
      
      if (loginResponse.data.success && loginResponse.data.access_token && loginResponse.data.user) {
        // 1. Obtenemos el token y los datos del usuario aquí
        const token = loginResponse.data.access_token;
        const user = loginResponse.data.user;
        
        // 2. Actualizamos el estado global de la app
        // Nota: signIn no es async, no necesita await
        signIn(user, token);
        
   
   
        
        console.log('✅ Usuario autenticado:', user.name, 'Rol:', user.role);

      } else {
        const errorMessage = loginResponse.data.message || 'Respuesta del servidor incompleta.';
        throw new Error(errorMessage);
      }
      
    } catch (error) {
      console.error('❌ Error completo en handleLogin:', error);
      
      if (axios.isAxiosError(error)) {
        console.error('❌ Status:', error.response?.status);
        console.error('❌ Data:', error.response?.data);
        
        const errorMessage = error.response?.data?.message || `Error del servidor (${error.response?.status})`;
        Alert.alert('Error de Login', errorMessage);
      } else {
        Alert.alert('Error', 'Problema de conexión. Verifica tu internet.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.header}>
          <Image
            source={require('../assets/logo_login.png')} // Asegúrate de tener esta imagen
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.headerTitle}>BIENVENIDO</Text>
        </View>
        <View style={styles.formBody}>
          <Text style={styles.label}>CORREO ELECTRÓNICO</Text>
          <TextInput
            style={styles.input}
            placeholder="ejemplo@correo.com"
            placeholderTextColor={COLORS.placeholder}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Text style={styles.label}>CONTRASEÑA</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Ingresa tu contraseña"
              placeholderTextColor={COLORS.placeholder}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!isPasswordVisible}
            />
            <TouchableOpacity onPress={() => setIsPasswordVisible(!isPasswordVisible)}>
              <Ionicons 
                name={isPasswordVisible ? 'eye-off' : 'eye'} 
                size={20} 
                color={COLORS.placeholder} 
              />
            </TouchableOpacity>
          </View>
          <View style={styles.optionsRow}>
            <Link href="/forgot-password" asChild>
              <TouchableOpacity>
                <Text style={styles.linkText}>¿Olvidaste tu contraseña?</Text>
              </TouchableOpacity>
            </Link>
          </View>
          <TouchableOpacity
            style={styles.button}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.card} />
            ) : (
              <Text style={styles.buttonText}>Iniciar Sesión</Text>
            )}
          </TouchableOpacity>

          <View style={styles.registerLink}>
            <Text style={styles.registerLinkText}>¿No tienes una cuenta? </Text>
            <Link href="/register" asChild>
              <TouchableOpacity>
                <Text style={styles.registerLinkButton}>Regístrate</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </View>
      <Text style={styles.footerText}>© 2025 My Office. Todos los derechos reservados.</Text>
    </View>
  );
}

// --- Hoja de Estilos ---
const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  card: { width: '90%', maxWidth: 400, backgroundColor: COLORS.card, borderRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 8 },
  header: { backgroundColor: COLORS.primary, paddingVertical: 30, paddingHorizontal: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20, alignItems: 'center' },
  logo: { width: 150, height: 60, marginBottom: 20 },
  headerTitle: { color: COLORS.card, fontSize: 28, fontWeight: 'bold' },
  formBody: { padding: 25 },
  label: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', marginBottom: 8 },
  input: { backgroundColor: '#F7F7F7', borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 15, fontSize: 16, color: COLORS.textPrimary, marginBottom: 20 },
  optionsRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 25 },
  linkText: { color: COLORS.textSecondary, fontSize: 14 },
  button: { backgroundColor: COLORS.primary, paddingVertical: 18, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: COLORS.card, fontSize: 18, fontWeight: 'bold' },
  footerText: { marginTop: 30, color: COLORS.textSecondary, fontSize: 12 },
  passwordContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F7F7F7', borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, marginBottom: 20, paddingHorizontal: 15 },
  passwordInput: { flex: 1, paddingVertical: 15, fontSize: 16, color: COLORS.textPrimary },
  registerLink: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 20 },
  registerLinkText: { color: COLORS.textSecondary, fontSize: 14 },
  registerLinkButton: { color: COLORS.primary, fontSize: 14, fontWeight: '600' },
});