import React, { useState, useRef, useCallback, useEffect } from 'react';
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
import { SimpleSignaturePad } from '../components/SimpleSignaturePad';
import { SafeAreaView } from 'react-native-safe-area-context';

const API_BASE = 'https://operaciones.lavianda.com.co/api';

const COLORS = {
  primary: '#1E3A8A',
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
type ServicioType = 'generales' | 'mantenimiento' | 'otro';

export default function FormularioEvaluacionServicio() {
  const { registroId,empresaId,empresaNombre, ciudad: CiudadParamas } = useLocalSearchParams();
  const { user } = useAuth();

  // Estados del formulario
  const [loading, setLoading] = useState(false);
 const [serviciosSeleccionados, setServiciosSeleccionados] = useState<ServicioType[]>([]);
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
  const observacionesRef = useRef<TextInput>(null);

  // Handler optimizado para observaciones
  const handleObservacionesChange = useCallback((text: string) => {
    setObservaciones(text);
  }, []);


  
  useEffect(() => {
  if (empresaNombre ) {
    setClienteZona(empresaNombre as string);
  }
}, [empresaNombre]);
  const handleOK = (signature: string) => {
    if (!signature || signature.trim() === '') {
      Alert.alert('Error', 'No se pudo capturar la firma. Intente nuevamente.');
      return;
    }
    
    const sizeInBytes = signature.length;
    const sizeInKB = sizeInBytes / 1024;
    
    console.log('📏 Formato de firma:', signature.includes('svg+xml') ? 'SVG' : 'PNG');
    console.log('📏 Tamaño de la firma:', sizeInKB.toFixed(2), 'KB');
    
    // SVG es mucho más pequeño, aumentamos el límite
    if (sizeInKB > 100) {
      Alert.alert(
        'Firma muy grande', 
        `La firma (${sizeInKB.toFixed(0)}KB) es demasiado grande.\n\nPor favor dibuje una firma más simple.`,
        [{ text: 'OK', onPress: () => handleClear() }]
      );
      return;
    }
    
    // Si es aceptable, guardar
    setFirmaClienteBase64(signature);
    setShowSignaturePad(false);
    Alert.alert('Éxito', `Firma capturada correctamente (${sizeInKB.toFixed(1)}KB)`);
  };

  const handleClear = () => {
    signatureRef.current?.clear();
  };

const validarFormulario = (): boolean => {
  if (serviciosSeleccionados.length === 0) {
    Alert.alert('Error', 'Por favor selecciona al menos un tipo de servicio');
    return false;
  }

  if (
    serviciosSeleccionados.includes('otro') &&
    !otroServicio.trim()
  ) {
    Alert.alert('Error', 'Por favor especifica el servicio seleccionado en "Otro"');
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

  // Validar tamaño de la firma
  const firmaSizeKB = firmaClienteBase64.length / 1024;
  console.log('📏 Tamaño de firma a enviar:', firmaSizeKB.toFixed(2), 'KB');

  if (firmaSizeKB > 100) {
    Alert.alert(
      'Error',
      'La firma es demasiado grande. Por favor capture una firma más simple.'
    );
    return false;
  }

  return true;
};


const toggleServicio = (servicio: ServicioType) => {
  setServiciosSeleccionados(prev =>
    prev.includes(servicio)
      ? prev.filter(s => s !== servicio)
      : [...prev, servicio]
  );
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
  registro_cliente_id: parseInt(registroId as string),
  fecha_evaluacion: fechaActual,

  cliente_zona: clienteZona.trim(),
  direccion: direccion.trim(),
  telefono: telefono.trim(),
  ciudad: ciudad.trim(),

  periodo_inicio: null,
  periodo_fin: null,

  nombre_evaluador: evaluador.trim(),
  cargo_evaluador: 'Cliente',

  supervisor_asignado: supervisorAsignado || null,

  // ✅ LO QUE REALMENTE USA EL BACKEND
  servicio_generales: serviciosSeleccionados.includes('generales'),
  servicio_mantenimiento: serviciosSeleccionados.includes('mantenimiento'),
  servicio_otro: serviciosSeleccionados.includes('otro'),

  // ✅ SOLO SI ES OTRO
  servicio_cual: serviciosSeleccionados.includes('otro')
    ? otroServicio.trim()
    : null,

  // Calificación
  calificacion_excelente: calificacion === 'excelente' ? 5 : null,
  calificacion_muy_bueno: calificacion === 'muy_bueno' ? 4 : null,
  calificacion_bueno: calificacion === 'bueno' ? 3 : null,
  calificacion_regular: calificacion === 'regular' ? 2 : null,
  calificacion_malo: calificacion === 'malo' ? 1 : null,

  observaciones,
  firma_cliente_base64: firmaClienteBase64,
  nombre_firma: clienteZona,
  cedula_firma: null,
  fecha_firma: fechaActual,
};


      console.log('🔍 Enviando evaluación de servicio:');
      console.log('📋 registroId:', registroId);
      console.log('📋 fechaActual:', fechaActual);
      console.log('📋 Data a enviar:', {
        registro_cliente_id: data.registro_cliente_id,
        fecha_evaluacion: data.fecha_evaluacion,
        cliente_zona: data.cliente_zona,
        tipo_servicio: `${data.servicio_mantenimiento ? 'mantenimiento' : ''}${data.servicio_otro ? 'otro' : ''}`,
        calificacion_seleccionada: calificacion,
        firma_size_kb: (firmaClienteBase64.length / 1024).toFixed(2)
      });

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
                params: { id: response.data.data.id },
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
      console.error('❌ Error al crear evaluación:', error.message);
      console.error('❌ Status del error:', error.response?.status);
      console.error('❌ Detalles del error:', error.response?.data);
      
      let errorMessage = 'No se pudo crear la evaluación del servicio';
      
      if (error.response?.status === 422 && error.response?.data?.errors) {
        // Si hay errores de validación específicos
        const errors = error.response.data.errors;
        const errorList = Object.keys(errors).map(key => `${key}: ${errors[key][0]}`).join('\n');
        errorMessage = `Errores de validación:\n${errorList}`;
      } else if (error.response?.status === 500) {
        errorMessage = 'Error interno del servidor. Verifique los datos e intente nuevamente.';
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

if (showSignaturePad) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.signatureContainer}>
        {/* Header con botón cerrar */}
        <View style={styles.signatureHeader}>
          <Text style={styles.signatureTitle}>Firma del Cliente</Text>
          <TouchableOpacity
            onPress={() => setShowSignaturePad(false)}
            style={styles.closeButton}
          >
            <Ionicons name="close" size={26} color={COLORS.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Pad de firma */}
        <View style={styles.signaturePadContainer}>
          <SimpleSignaturePad
            ref={signatureRef}
            height={300}
            strokeColor="#000"
            strokeWidth={3}
          />
        </View>

        {/* Botones de acción */}
        <View style={styles.signatureActions}>
   

          <TouchableOpacity
            style={[styles.button, styles.buttonPrimary]}
            onPress={() => {
              if (signatureRef.current?.isEmpty()) {
                Alert.alert('Error', 'Por favor firme antes de continuar');
                return;
              }
              const signatureData = signatureRef.current?.toDataURL();
              if (signatureData) {
                handleOK(signatureData);
              }
            }}
          >
            <Text style={styles.buttonText}>Confirmar Firma</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
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
  value={CiudadParamas as string ? CiudadParamas as string : ciudad}
  onChangeText={setCiudad}
/>
        </View>

 <View style={styles.card}>
  <Text style={styles.cardTitle}>SELECCIONE SERVICIO A EVALUAR</Text>

  <View style={styles.checkboxGroup}>

    {/* SERVICIOS GENERALES Y ESPECIALES */}
    <TouchableOpacity
      style={styles.checkboxItem}
      onPress={() => toggleServicio('generales')}
    >
      <View style={styles.checkbox}>
        {serviciosSeleccionados.includes('generales') && (
          <Ionicons name="checkmark" size={18} color={COLORS.primary} />
        )}
      </View>
      <Text style={styles.checkboxLabel}>
        SERVICIOS GENERALES Y ESPECIALES
      </Text>
    </TouchableOpacity>

    {/* MANTENIMIENTO */}
    <TouchableOpacity
      style={styles.checkboxItem}
      onPress={() => toggleServicio('mantenimiento')}
    >
      <View style={styles.checkbox}>
        {serviciosSeleccionados.includes('mantenimiento') && (
          <Ionicons name="checkmark" size={18} color={COLORS.primary} />
        )}
      </View>
      <Text style={styles.checkboxLabel}>MANTENIMIENTO</Text>
    </TouchableOpacity>

    {/* OTRO */}
    <TouchableOpacity
      style={styles.checkboxItem}
      onPress={() => toggleServicio('otro')}
    >
      <View style={styles.checkbox}>
        {serviciosSeleccionados.includes('otro') && (
          <Ionicons name="checkmark" size={18} color={COLORS.primary} />
        )}
      </View>
      <Text style={styles.checkboxLabel}>OTRO</Text>
    </TouchableOpacity>

  </View>

  {/* CAMPO ¿CUÁL? */}
  {serviciosSeleccionados.includes('otro') && (
    <>
      <Text style={styles.label}>¿Cuál?</Text>
      <TextInput
        style={styles.input}
        placeholder="Especifique el servicio"
        value={otroServicio}
        onChangeText={setOtroServicio}
      />
    </>
  )}
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
            ref={observacionesRef}
            key="observaciones-field"
            style={[styles.input, styles.textArea]}
            placeholder="Observaciones adicionales..."
            value={observaciones}
            onChangeText={handleObservacionesChange}
            multiline={true}
            numberOfLines={4}
            textAlignVertical="top"
            blurOnSubmit={false}
            scrollEnabled={true}
            autoCorrect={false}
            keyboardType="default"
            returnKeyType="default"
            enablesReturnKeyAutomatically={false}
            autoComplete="off"
            autoCapitalize="sentences"
            clearButtonMode="never"
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
   safeArea: {
    flex: 1,
    backgroundColor: '#fff', // 👈 importante para notch en iPhone
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
  signaturePadContainer: {
    flex: 1,
    margin: 15,
    backgroundColor: COLORS.background,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  signatureActions: {
    flexDirection: 'row',
    padding: 15,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
});
