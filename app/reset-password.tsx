import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import axios from 'axios';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

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
// ¡¡¡CAMBIA ESTA IP POR LA TUYA!!!
const API_URL = 'https://operaciones.lavianda.com.co/api';

export default function ResetPasswordScreen() {
  const [token, setToken] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [passwordConfirmation, setPasswordConfirmation] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const router = useRouter();

  const handleResetPassword = async () => {
    if (!token || !email || !password || !passwordConfirmation) {
      Alert.alert('Error', 'Por favor, completa todos los campos.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Error', 'La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (password !== passwordConfirmation) {
      Alert.alert('Error', 'Las contraseñas no coinciden.');
      return;
    }
    setLoading(true);
    try {
      await axios.post(`${API_URL}/reset-password`, {
        token,
        email,
        password,
        password_confirmation: passwordConfirmation,
      });
      Alert.alert(
        '¡Éxito!',
        'Tu contraseña ha sido restablecida. Ahora puedes iniciar sesión.',
        [{ text: 'Ir a Login', onPress: () => router.replace('/login') }]
      );
    } catch (error) {
      const errorMessage = (error as any).response?.data?.message || 'No se pudo restablecer la contraseña. El token puede ser inválido o el correo incorrecto.';
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View style={styles.content}>
          <Ionicons name="construct" size={60} color={COLORS.primary} style={styles.headerIcon} />
          <Text style={styles.title}>Crear Nueva Contraseña</Text>
          <Text style={styles.instructions}>
            Ingresa el token que recibiste, tu correo y tu nueva contraseña.
          </Text>

          <Text style={styles.label}>TOKEN DEL CORREO</Text>
          <TextInput style={styles.input} placeholder="Pega el token aquí" value={token} onChangeText={setToken} />

          <Text style={styles.label}>CORREO ELECTRÓNICO</Text>
          <TextInput style={styles.input} placeholder="tu-correo@ejemplo.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />

          <Text style={styles.label}>NUEVA CONTRASEÑA</Text>
          <TextInput style={styles.input} placeholder="Mínimo 8 caracteres" value={password} onChangeText={setPassword} secureTextEntry />

          <Text style={styles.label}>CONFIRMAR NUEVA CONTRASEÑA</Text>
          <TextInput style={styles.input} placeholder="Repite la nueva contraseña" value={passwordConfirmation} onChangeText={setPasswordConfirmation} secureTextEntry />

          <TouchableOpacity style={styles.button} onPress={handleResetPassword} disabled={loading}>
            {loading ? <ActivityIndicator color={COLORS.card} /> : <Text style={styles.buttonText}>Restablecer Contraseña</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { flex: 1, justifyContent: 'center', padding: 25 },
  headerIcon: { alignSelf: 'center', marginBottom: 20 },
  title: { fontSize: 28, fontWeight: 'bold', color: COLORS.textPrimary, textAlign: 'center', marginBottom: 15 },
  instructions: { fontSize: 16, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 30, lineHeight: 24 },
  label: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', marginBottom: 8 },
  input: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 15, fontSize: 16, color: COLORS.textPrimary, marginBottom: 20 },
  button: { backgroundColor: COLORS.primary, paddingVertical: 18, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  buttonText: { color: COLORS.card, fontSize: 18, fontWeight: 'bold' }
});