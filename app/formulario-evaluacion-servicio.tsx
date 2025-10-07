import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { useAuth } from './_layout';
import SignatureScreen from 'react-native-signature-canvas';

const API_BASE = 'https://operaciones.lavianda.com.co/api';

const COLORS = {
  primary: '#2196F3',
  success: '#4CAF50',
  warning: '#FF9800',
  error: '#F44336',
  background: '#F5F5F5',
  card: '#FFFFFF',
  textPrimary: '#212121',
  textSecondary: '#757575',
  border: '#E0E0E0',
};

type CalificacionType = 'excelente' | 'muy_bueno' | 'bueno' | 'regular' | 'malo' | null;
type TipoServicioType = 'mantenimiento' | 'otro' | null;

export default function FormularioEvaluacionServicio() {
  const { registroId } = useLocalSearchParams();
  const { user } = useAuth();

  // Estados del formulario
  const [loading, setLoading] = useState(false);
  const [tipoServicio, setTipoServicio] = useState<TipoServicioType>(null);
  const [otroServicio, setOtroServicio] = useState('');
  const [clienteZona, setClienteZona] = useState('');
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [periodoEvaluar, setPeriodoEvaluar] = useState('');
  const [fechaEvaluacion, setFechaEvaluacion] = useState('');
  const [evaluador, setEvaluador] = useState('');
  const [supervisorAsignado, setSupervisorAsignado] = useState('');
  const [calificacion, setCalificacion] = useState<CalificacionType>(null);
  const [observaciones, setObservaciones] = useState('');
  
  // Firma
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [firmaClienteBase64, setFirmaClienteBase64] = useState('');
  const signatureRef = useRef<any>(null);

  const handleOK = (signature: string) => {
    setFirmaClienteBase64(signature);
    setShowSignaturePad(false);
    Alert.alert('Éxito', 'Firma capturada correctamente');
  };

  const handleClear = () => {
    signatureRef.current?.clearSignature();
  };

  const validarFormulario = (): boolean => {
    if (!tipoServicio) {
      Alert.alert('Error', 'Por favor selecciona el tipo de servicio');
      return false;
    }
    if (tipoServicio === 'otro' && !otroServicio.trim()) {
      Alert.alert('Error', 'Por favor especifica el tipo de servicio');
      return false;
    }
    if (!clienteZona.trim()) {
      Alert.alert('Error', 'Por favor ingresa el cliente/zona');
      return false;
    }
    if (!telefono.trim()) {
      Alert.alert('Error', 'Por favor ingresa el teléfono');
      return false;
    }
    if (!direccion.trim()) {
      Alert.alert('Error', 'Por favor ingresa la dirección');
      return false;
    }
    if (!ciudad.trim()) {
      Alert.alert('Error', 'Por favor ingresa la ciudad');
      return false;
    }
    if (!periodoEvaluar.trim()) {
      Alert.alert('Error', 'Por favor ingresa el período a evaluar');
      return false;
    }
    if (!evaluador.trim()) {
      Alert.alert('Error', 'Por favor ingresa el nombre del evaluador');
      return false;
    }
    if (!calificacion) {
      Alert.alert('Error', 'Por favor selecciona una calificación');
      return false;
    }
    if (!firmaClienteBase64) {
      Alert.alert('Error', 'Por favor capture la firma del cliente');
      return false;
    }
    return true;
  };

  const enviarFormulario = async () => {
    if (!validarFormulario()) return;

    setLoading(true);
    try {
      // Generar fecha automática en formato YYYY-MM-DD
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const fechaActual = `${year}-${month}-${day}`;
      
      const data = {
        registro_cliente_id: registroId,
        tipo_servicio: tipoServicio === 'otro' ? otroServicio : tipoServicio,
        cliente_zona: clienteZona,
        telefono,
        direccion,
        ciudad,
        periodo_evaluar: periodoEvaluar,
        fecha_evaluacion: fechaActual, // Fecha automática
        evaluador,
        supervisor_asignado: supervisorAsignado,
        calificacion,
        observaciones,
        firma_cliente_base64: firmaClienteBase64,
      };

      console.log('🔍 Enviando evaluación de servicio:');
      console.log('📋 registroId:', registroId);
      console.log('📋 fechaActual:', fechaActual);
      console.log('📋 Data completa:', JSON.stringify(data, null, 2));

      const response = await axios.post(
        `${API_BASE}/formularios/evaluacion-servicio`,
        data,
        {
          headers: {
            Authorization: `Bearer ${user?.token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('✅ Respuesta del servidor:', response.data);

      Alert.alert(
        'Éxito',
        'Evaluación del servicio creada correctamente',
        [
          {
            text: 'Ver Detalle',
            onPress: () => {
              router.replace({
                pathname: '/evaluacion-servicio-detalle',
                params: { id: response.data.evaluacion.id },
              });
            },
          },
          {
            text: 'Volver al Registro',
            onPress: () => {
              router.back();
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('❌ Error al crear evaluación:', error);
      console.error('❌ Detalles del error:', error.response?.data);
      console.error('❌ Status del error:', error.response?.status);
      console.error('❌ Error completo:', JSON.stringify(error.response, null, 2));
      
      let errorMessage = 'No se pudo crear la evaluación del servicio';
      
      if (error.response?.data?.errors) {
        // Si hay errores de validación específicos
        const errors = error.response.data.errors;
        const errorList = Object.keys(errors).map(key => `${key}: ${errors[key][0]}`).join('\n');
        errorMessage = `Errores de validación:\n${errorList}`;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (showSignaturePad) {
    return (
      <View style={styles.signatureContainer}>
        <View style={styles.signatureHeader}>
          <Text style={styles.signatureTitle}>Firma del Cliente</Text>
          <TouchableOpacity
            onPress={() => setShowSignaturePad(false)}
            style={styles.closeButton}
          >
            <Ionicons name="close" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
        </View>
        <SignatureScreen
          ref={signatureRef}
          onOK={handleOK}
          onClear={handleClear}
          descriptionText="Firme aquí"
          clearText="Limpiar"
          confirmText="Confirmar"
          webStyle={`
            .m-signature-pad {
              box-shadow: none;
              border: 2px solid ${COLORS.border};
              border-radius: 8px;
            }
            .m-signature-pad--body {
              border: none;
            }
            .m-signature-pad--footer {
              display: none;
            }
          `}
        />
        <View style={styles.signatureActions}>
          <TouchableOpacity
            style={[styles.button, styles.buttonSecondary]}
            onPress={handleClear}
          >
            <Text style={styles.buttonSecondaryText}>Limpiar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.buttonPrimary]}
            onPress={() => signatureRef.current?.readSignature()}
          >
            <Text style={styles.buttonText}>Confirmar Firma</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.card} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Evaluación del Servicio</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Tipo de Servicio */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>SERVICIOS GENERALES Y ESPECIALES</Text>
          <Text style={styles.label}>Tipo de Servicio *</Text>
          <View style={styles.checkboxGroup}>
            <TouchableOpacity
              style={styles.checkboxItem}
              onPress={() => setTipoServicio('mantenimiento')}
            >
              <View style={styles.checkbox}>
                {tipoServicio === 'mantenimiento' && (
                  <Ionicons name="checkmark" size={18} color={COLORS.primary} />
                )}
              </View>
              <Text style={styles.checkboxLabel}>MANTENIMIENTO</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.checkboxItem}
              onPress={() => setTipoServicio('otro')}
            >
              <View style={styles.checkbox}>
                {tipoServicio === 'otro' && (
                  <Ionicons name="checkmark" size={18} color={COLORS.primary} />
                )}
              </View>
              <Text style={styles.checkboxLabel}>OTRO</Text>
            </TouchableOpacity>
          </View>

          {tipoServicio === 'otro' && (
            <TextInput
              style={styles.input}
              placeholder="Especifique el servicio"
              value={otroServicio}
              onChangeText={setOtroServicio}
            />
          )}
        </View>

        {/* Datos del Cliente */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>DATOS DEL CLIENTE</Text>
          
          <Text style={styles.label}>Cliente/Zona *</Text>
          <TextInput
            style={styles.input}
            placeholder="Nombre del cliente o zona"
            value={clienteZona}
            onChangeText={setClienteZona}
          />

          <Text style={styles.label}>Teléfono *</Text>
          <TextInput
            style={styles.input}
            placeholder="Número de teléfono"
            value={telefono}
            onChangeText={setTelefono}
            keyboardType="phone-pad"
          />

          <Text style={styles.label}>Dirección *</Text>
          <TextInput
            style={styles.input}
            placeholder="Dirección completa"
            value={direccion}
            onChangeText={setDireccion}
          />

          <Text style={styles.label}>Ciudad *</Text>
          <TextInput
            style={styles.input}
            placeholder="Ciudad"
            value={ciudad}
            onChangeText={setCiudad}
          />
        </View>

        {/* Datos de la Evaluación */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>DATOS DE LA EVALUACIÓN</Text>
          
          <Text style={styles.label}>Período a Evaluar *</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej: Enero - Marzo 2025"
            value={periodoEvaluar}
            onChangeText={setPeriodoEvaluar}
          />

          <Text style={styles.label}>Evaluador *</Text>
          <TextInput
            style={styles.input}
            placeholder="Nombre del evaluador"
            value={evaluador}
            onChangeText={setEvaluador}
          />

          <Text style={styles.label}>Supervisor Asignado</Text>
          <TextInput
            style={styles.input}
            placeholder="Nombre del supervisor"
            value={supervisorAsignado}
            onChangeText={setSupervisorAsignado}
          />
        </View>

        {/* Calificación */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>CALIFICACIÓN DEL SERVICIO *</Text>
          <Text style={styles.subtitle}>
            En una escala de 1 a 5, ¿cómo califica nuestro servicio?
          </Text>

          <View style={styles.calificacionGrid}>
            {[
              { value: 'excelente', label: 'EXCELENTE', number: '5', color: COLORS.success },
              { value: 'muy_bueno', label: 'MUY BUENO', number: '4', color: '#66BB6A' },
              { value: 'bueno', label: 'BUENO', number: '3', color: COLORS.warning },
              { value: 'regular', label: 'REGULAR', number: '2', color: '#FF7043' },
              { value: 'malo', label: 'MALO', number: '1', color: COLORS.error },
            ].map((item) => (
              <TouchableOpacity
                key={item.value}
                style={[
                  styles.calificacionItem,
                  calificacion === item.value && {
                    backgroundColor: item.color,
                    borderColor: item.color,
                  },
                ]}
                onPress={() => setCalificacion(item.value as CalificacionType)}
              >
                {item.number && (
                  <Text
                    style={[
                      styles.calificacionNumber,
                      calificacion === item.value && styles.calificacionNumberActive,
                    ]}
                  >
                    {item.number}
                  </Text>
                )}
                <Text
                  style={[
                    styles.calificacionLabel,
                    calificacion === item.value && styles.calificacionLabelActive,
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Observaciones */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>OBSERVACIONES</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Observaciones adicionales..."
            value={observaciones}
            onChangeText={setObservaciones}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Firma del Cliente */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>FIRMA DEL CLIENTE *</Text>
          {firmaClienteBase64 ? (
            <View style={styles.firmaPreview}>
              <Text style={styles.firmaSuccess}>✓ Firma capturada</Text>
              <TouchableOpacity
                style={[styles.button, styles.buttonSecondary]}
                onPress={() => setShowSignaturePad(true)}
              >
                <Ionicons name="create-outline" size={20} color={COLORS.primary} />
                <Text style={styles.buttonSecondaryText}>Cambiar Firma</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.button, styles.buttonPrimary]}
              onPress={() => setShowSignaturePad(true)}
            >
              <Ionicons name="create-outline" size={20} color={COLORS.card} />
              <Text style={styles.buttonText}>Capturar Firma</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Botón Enviar */}
        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={enviarFormulario}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={COLORS.card} />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={24} color={COLORS.card} />
              <Text style={styles.submitButtonText}>Enviar Evaluación</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.primary,
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
    paddingBottom: 15,
    paddingHorizontal: 15,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.card,
  },
  headerRight: {
    width: 34,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 15,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 15,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 15,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 8,
    marginTop: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    backgroundColor: COLORS.card,
    color: COLORS.textPrimary,
  },
  textArea: {
    minHeight: 100,
  },
  checkboxGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 15,
  },
  checkboxItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 15,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderRadius: 4,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxLabel: {
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  calificacionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 10,
  },
  calificacionItem: {
    width: '30%',
    minWidth: 100,
    maxWidth: 150,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calificacionNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 5,
  },
  calificacionNumberActive: {
    color: COLORS.card,
  },
  calificacionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  calificacionLabelActive: {
    color: COLORS.card,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  buttonPrimary: {
    backgroundColor: COLORS.primary,
  },
  buttonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  buttonText: {
    color: COLORS.card,
    fontSize: 14,
    fontWeight: '600',
  },
  buttonSecondaryText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  firmaPreview: {
    gap: 10,
  },
  firmaSuccess: {
    fontSize: 16,
    color: COLORS.success,
    textAlign: 'center',
    marginBottom: 10,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.success,
    padding: 16,
    borderRadius: 8,
    marginTop: 10,
    marginBottom: 30,
    gap: 10,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: COLORS.card,
    fontSize: 16,
    fontWeight: 'bold',
  },
  signatureContainer: {
    flex: 1,
    backgroundColor: COLORS.card,
  },
  signatureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  signatureTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  closeButton: {
    padding: 5,
  },
  signatureActions: {
    flexDirection: 'row',
    padding: 15,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
});
