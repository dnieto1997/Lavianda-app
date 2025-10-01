import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import axios from 'axios';
import { useAuth } from './_layout';
import { Link, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

// --- Paleta de Colores ---
const COLORS = {
  primary: '#C62828',
  background: '#E3F2FD',
  card: '#FFFFFF',
  textPrimary: '#212121',
  textSecondary: '#757575',
  placeholder: '#BDBDBD',
  border: '#E0E0E0',
  success: '#4CAF50',
};

// --- Configuración de la API ---
const API_BASE = 'https://operaciones.lavianda.com.co/api';

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const router = useRouter();

  const handleRegister = async () => {
    if (!name || !email || !password || !passwordConfirmation) {
      Alert.alert('Error', 'Por favor, completa todos los campos.');
      return;
    }

    if (password !== passwordConfirmation) {
      Alert.alert('Error', 'Las contraseñas no coinciden.');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setLoading(true);
    
    try {
      console.log('📝 Iniciando registro de usuario...');
      
      const registerResponse = await axios.post(
        `${API_BASE}/register`,
        {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password: password,
          password_confirmation: passwordConfirmation,
          role: 'empleado' // Por defecto, los usuarios registrados serán empleados
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          timeout: 15000
        }
      );

      console.log('✅ Registro exitoso:', registerResponse.data);
      
      if (registerResponse.data.success && registerResponse.data.access_token && registerResponse.data.user) {
        const token = registerResponse.data.access_token;
        const user = registerResponse.data.user;
        
        // Actualizar el estado global de la app
        signIn(user, token);
        
        Alert.alert(
          'Registro Exitoso',
          'Tu cuenta ha sido creada exitosamente. Ahora puedes usar la aplicación.',
          [{ text: 'OK', onPress: () => router.replace('/(tabs)') }]
        );
        
        console.log('✅ Usuario registrado:', user.name, 'Rol:', user.role);

      } else {
        const errorMessage = registerResponse.data.message || 'Respuesta del servidor incompleta.';
        throw new Error(errorMessage);
      }

    } catch (error: any) {
      console.error('❌ Error en registro:', error);

      let errorMessage = 'Error desconocido al registrar usuario.';
      
      if (error.response?.status === 422) {
        // Errores de validación
        const errors = error.response.data.errors;
        if (errors) {
          const errorMessages = Object.values(errors).flat().join('\n');
          errorMessage = errorMessages;
        } else {
          errorMessage = error.response.data.message || 'Error de validación';
        }
      } else if (error.response?.status === 500) {
        errorMessage = 'Error interno del servidor. Por favor, intenta más tarde.';
      } else if (error.code === 'ECONNABORTED') {
        errorMessage = 'La conexión ha tardado demasiado. Verifica tu conexión a internet.';
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }

      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.card}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color={COLORS.card} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Crear Cuenta</Text>
          </View>
          
          <View style={styles.formBody}>
            <Text style={styles.subtitle}>
              Completa los datos para crear tu cuenta nueva
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nombre Completo</Text>
              <TextInput
                style={styles.input}
                placeholder="Ingresa tu nombre completo"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Correo Electrónico</Text>
              <TextInput
                style={styles.input}
                placeholder="Ingresa tu email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Contraseña</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!isPasswordVisible}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setIsPasswordVisible(!isPasswordVisible)}>
                  <Ionicons 
                    name={isPasswordVisible ? 'eye-off' : 'eye'} 
                    size={20} 
                    color={COLORS.placeholder} 
                  />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Confirmar Contraseña</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Repite tu contraseña"
                  value={passwordConfirmation}
                  onChangeText={setPasswordConfirmation}
                  secureTextEntry={!isConfirmPasswordVisible}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setIsConfirmPasswordVisible(!isConfirmPasswordVisible)}>
                  <Ionicons 
                    name={isConfirmPasswordVisible ? 'eye-off' : 'eye'} 
                    size={20} 
                    color={COLORS.placeholder} 
                  />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleRegister}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.card} />
              ) : (
                <Text style={styles.buttonText}>Crear Cuenta</Text>
              )}
            </TouchableOpacity>

            <View style={styles.loginLink}>
              <Text style={styles.loginLinkText}>¿Ya tienes una cuenta? </Text>
              <Link href="/login" asChild>
                <TouchableOpacity>
                  <Text style={styles.loginLinkButton}>Iniciar Sesión</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

// --- Hoja de Estilos ---
const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: COLORS.background 
  },
  content: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    paddingVertical: 40,
    paddingHorizontal: 20
  },
  card: { 
    width: '100%', 
    maxWidth: 400, 
    backgroundColor: COLORS.card, 
    borderRadius: 20, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.1, 
    shadowRadius: 10, 
    elevation: 8 
  },
  header: { 
    backgroundColor: COLORS.primary, 
    paddingVertical: 20, 
    paddingHorizontal: 20, 
    borderTopLeftRadius: 20, 
    borderTopRightRadius: 20, 
    flexDirection: 'row',
    alignItems: 'center'
  },
  backButton: {
    marginRight: 15,
  },
  headerTitle: { 
    color: COLORS.card, 
    fontSize: 24, 
    fontWeight: 'bold' 
  },
  formBody: { 
    padding: 25 
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 22,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: { 
    color: COLORS.textSecondary, 
    fontSize: 12, 
    fontWeight: '600', 
    textTransform: 'uppercase', 
    marginBottom: 8 
  },
  input: { 
    backgroundColor: '#F7F7F7', 
    borderWidth: 1, 
    borderColor: COLORS.border, 
    borderRadius: 10, 
    padding: 15, 
    fontSize: 16, 
    color: COLORS.textPrimary 
  },
  passwordContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#F7F7F7', 
    borderWidth: 1, 
    borderColor: COLORS.border, 
    borderRadius: 10, 
    paddingHorizontal: 15 
  },
  passwordInput: { 
    flex: 1, 
    paddingVertical: 15, 
    fontSize: 16, 
    color: COLORS.textPrimary 
  },
  button: { 
    backgroundColor: COLORS.primary, 
    paddingVertical: 18, 
    borderRadius: 10, 
    alignItems: 'center', 
    justifyContent: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: { 
    color: COLORS.card, 
    fontSize: 18, 
    fontWeight: 'bold' 
  },
  loginLink: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  loginLinkText: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  loginLinkButton: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '600',
  },
});
