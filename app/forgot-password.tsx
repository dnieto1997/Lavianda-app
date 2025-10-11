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
} from 'react-native';
import axios from 'axios';
import { useRouter, Link } from 'expo-router';
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
// ¡¡¡CAMBIA ESTA IP POR LA TUYA!!!
const API_URL = 'https://operaciones.lavianda.com.co/api';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [sent, setSent] = useState<boolean>(false);
  const router = useRouter();

  const handleSendLink = async () => {
    if (!email) {
      Alert.alert('Error', 'Por favor, ingresa tu correo electrónico.');
      return;
    }
    setLoading(true);
    try {
      await axios.post(`${API_URL}/forgot-password`, { email });
      setSent(true);
    } catch (error) {
      Alert.alert(
        'Error',
        'No se pudo enviar el enlace. Verifica que el correo sea correcto y esté registrado.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Link href="/login" asChild>
            <TouchableOpacity style={styles.backButton}>
                <Ionicons name="arrow-back" size={28} color={COLORS.textPrimary} />
            </TouchableOpacity>
        </Link>
        
        <Ionicons name="key" size={60} color={COLORS.primary} style={styles.headerIcon} />
        <Text style={styles.title}>¿Olvidaste tu contraseña?</Text>
        
        {sent ? (
          <View style={styles.successContainer}>
            <Ionicons name="checkmark-circle" size={50} color={COLORS.success} />
            <Text style={styles.successText}>
              Si el correo <Text style={{fontWeight: 'bold'}}>{email}</Text> está registrado, recibirás un token para restablecer tu contraseña.
            </Text>
            <Link href="/reset-password" asChild>
                <TouchableOpacity style={styles.button}>
                    <Text style={styles.buttonText}>Ya tengo el token</Text>
                </TouchableOpacity>
            </Link>
          </View>
        ) : (
          <>
            <Text style={styles.instructions}>
              Ingresa tu correo y te enviaremos un token para que puedas crear una nueva contraseña.
            </Text>
            <Text style={styles.label}>CORREO ELECTRÓNICO</Text>
            <TextInput
              style={styles.input}
              placeholder="tu-correo@ejemplo.com"
              placeholderTextColor={COLORS.placeholder}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TouchableOpacity style={styles.button} onPress={handleSendLink} disabled={loading}>
              {loading ? <ActivityIndicator color={COLORS.card} /> : <Text style={styles.buttonText}>Enviar Token</Text>}
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { flex: 1, justifyContent: 'center', padding: 25 },
  backButton: { position: 'absolute', top: 20, left: 20, zIndex: 1 },
  headerIcon: { alignSelf: 'center', marginBottom: 20 },
  title: { fontSize: 28, fontWeight: 'bold', color: COLORS.textPrimary, textAlign: 'center', marginBottom: 15 },
  instructions: { fontSize: 16, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 30, lineHeight: 24 },
  label: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', marginBottom: 8 },
  input: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 15, fontSize: 16, color: COLORS.textPrimary, marginBottom: 20 },
  button: { backgroundColor: COLORS.primary, paddingVertical: 18, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  buttonText: { color: COLORS.card, fontSize: 18, fontWeight: 'bold' },
  successContainer: { alignItems: 'center', marginTop: 20 },
  successText: { fontSize: 16, textAlign: 'center', marginVertical: 20, lineHeight: 24, color: COLORS.textSecondary }
});