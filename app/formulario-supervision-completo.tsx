/**
 * 📋 INFORME DE SUPERVISIÓN COMPLETO - 7 SECCIONES
 * 
 * Este formulario implementa el INFORME DE SUPERVISIÓN con 7 secciones:
 * 1. Datos Generales
 * 2. Inspección de Auxiliares (9 items)
 * 3. Calidad del Servicio (20 items)
 * 4. Insumos (evaluación + tabla de costos)
 * 5. Maquinaria (inventario + evaluación)
 * 6. Plan de Acción
 * 7. Observaciones Finales y Firma
 */

import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  StyleSheet,
  SafeAreaView,
  Image,
  Platform,
  Modal,
  ActionSheetIOS,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import axios, { AxiosError } from 'axios';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from './_layout';
import { subirFotoEvidencia, eliminarFotoEvidencia } from '../services/evidenciasService';
import SimpleSignaturePad from '../components/SimpleSignaturePad';
import { getSecureItem } from '../utils/secureStorage';

const COLORS = {
  primary: '#1E3A8A',
  secondary: '#3B82F6',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceSecondary: '#F1F5F9',
  textPrimary: '#1F2937',
  textSecondary: '#6B7280',
  border: '#E5E7EB',
  borderDark: '#D1D5DB',
};

const API_BASE = 'https://operaciones.lavianda.com.co/api';

// Interfaces de tipos
interface EvaluacionItem {
  evaluacion?: 'cumple' | 'no_cumple' | 'no_aplica';
  observaciones?: string;
}

interface CostoItem {
  item: string;
  costo_actual: string;
  costo_mes_anterior: string;
  diferencia: string;
  observaciones: string;
}

interface MaquinariaItem {
  maquina: string;
  estado: string;
  observaciones: string;
}

interface AccionItem {
  hallazgo: string;
  accion_correctiva: string;
  responsable: string;
  fecha_limite: string;
  estado: string;
}

// SECCIÓN 2: Inspección de Auxiliares (9 items)
const INSPECCION_AUXILIARES = [
  { id: 'presentacion_personal', nombre: 'Presentación Personal' },
  { id: 'uniforme_estado', nombre: 'Uniforme en Buen Estado' },
  { id: 'calzado_estado', nombre: 'Calzado en Buen Estado' },
  { id: 'conocimientos_sgi', nombre: 'Conocimientos del SGI' },
  { id: 'carnet_visible', nombre: 'Carnet Visible' },
  { id: 'iniciativa_compromiso', nombre: 'Iniciativa y Compromiso' },
  { id: 'puntualidad_cumplimiento', nombre: 'Puntualidad y Cumplimiento' },
  { id: 'relaciones_interpersonales', nombre: 'Relaciones Interpersonales' },
  { id: 'uso_epis', nombre: 'Uso de EPIs' }
];

// SECCIÓN 3: Calidad del Servicio (20 items)
const CALIDAD_SERVICIO = [
  { id: 'limpieza_pisos', nombre: 'Limpieza de Pisos' },
  { id: 'limpieza_alfombras', nombre: 'Limpieza de Alfombras o Tapetes' },
  { id: 'limpieza_escaleras', nombre: 'Limpieza de Escaleras' },
  { id: 'limpieza_banos', nombre: 'Limpieza de Baños' },
  { id: 'limpieza_cafeteria', nombre: 'Limpieza de Cafetería' },
  { id: 'limpieza_areas_perimetrales', nombre: 'Limpieza de Áreas Perimetrales' },
  { id: 'limpieza_equipos_oficina', nombre: 'Limpieza de Equipos de Oficina' },
  { id: 'limpieza_muebles_enseres', nombre: 'Limpieza de Muebles y Enseres' },
  { id: 'limpieza_parqueadero', nombre: 'Limpieza de Parqueadero' },
  { id: 'limpieza_sotano', nombre: 'Limpieza de Sótano' },
  { id: 'limpieza_depositos_basuras', nombre: 'Limpieza de Depósitos de Basuras' },
  { id: 'limpieza_cuarto_almacenamiento', nombre: 'Limpieza de Cuarto de Almacenamiento' },
  { id: 'plantas_ornamentales', nombre: 'Plantas Ornamentales' },
  { id: 'limpieza_lamparas', nombre: 'Limpieza de Lámparas' },
  { id: 'limpieza_rincones', nombre: 'Limpieza de Rincones' },
  { id: 'limpieza_vidrios', nombre: 'Limpieza de Vidrios' },
  { id: 'limpieza_fachadas', nombre: 'Limpieza de Fachadas' },
  { id: 'avisos_preventivos', nombre: 'Avisos Preventivos' },
  { id: 'cumple_cronograma', nombre: 'Cumple con el Cronograma' },
  { id: 'otros_calidad', nombre: 'Otros' }
];

// SECCIÓN 4: Insumos (4 items de evaluación)
const EVALUACION_INSUMOS = [
  { id: 'almacenamiento_insumos', nombre: 'Almacenamiento de Insumos' },
  { id: 'limpieza_area_trabajo', nombre: 'Limpieza del Área de Trabajo' },
  { id: 'implementos_limpios', nombre: 'Implementos Limpios y en Buen Estado' },
  { id: 'fichas_tecnicas', nombre: 'Fichas Técnicas' }
];

// SECCIÓN 5: Maquinaria (2 items de evaluación)
const EVALUACION_MAQUINARIA = [
  { id: 'manejo_maquinaria', nombre: 'Manejo de Maquinaria' },
  { id: 'limpieza_almacenamiento_equipos', nombre: 'Limpieza y Almacenamiento de Equipos' }
];

export default function FormularioSupervisionCompleto() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  
  // Estados principales
  const [consecutivo, setConsecutivo] = useState('');
  const [seccionActual, setSeccionActual] = useState(1);
  const [cargando, setCargando] = useState(false);

  // SECCIÓN 1: Datos Generales
  const [datosGenerales, setDatosGenerales] = useState({
    cliente: Array.isArray(params.empresaNombre) ? params.empresaNombre[0] : (params.empresaNombre || ''),
    direccion: '',
    supervisor_jefe: '',
    ciudad: '',
    fecha_supervision: new Date().toISOString().split('T')[0],
    numero_trabajadores: '',
    horario_laboral: '',
    otros_horarios: ''
  });

  // SECCIÓN 2: Inspección Auxiliares
  const [inspeccionAuxiliares, setInspeccionAuxiliares] = useState<Record<string, EvaluacionItem>>({});

  // SECCIÓN 3: Calidad del Servicio  
  const [calidadServicio, setCalidadServicio] = useState<Record<string, EvaluacionItem>>({});

  // SECCIÓN 4: Insumos
  const [evaluacionInsumos, setEvaluacionInsumos] = useState<Record<string, EvaluacionItem>>({});
  const [tablaCostos, setTablaCostos] = useState<CostoItem[]>([
    { item: '', costo_actual: '', costo_mes_anterior: '', diferencia: '', observaciones: '' }
  ]);

  // SECCIÓN 5: Maquinaria
  const [evaluacionMaquinaria, setEvaluacionMaquinaria] = useState<Record<string, EvaluacionItem>>({});
  const [inventarioMaquinaria, setInventarioMaquinaria] = useState<MaquinariaItem[]>([
    { maquina: '', estado: '', observaciones: '' }
  ]);

  // SECCIÓN 6: Plan de Acción
  const [planAccion, setPlanAccion] = useState<AccionItem[]>([
    { hallazgo: '', accion_correctiva: '', responsable: '', fecha_limite: '', estado: '' }
  ]);

  // SECCIÓN 7: Observaciones y Firma
  const [observacionesFinales, setObservacionesFinales] = useState<string>('');
  const [firmaSupervisor, setFirmaSupervisor] = useState<string>('');
  const [nombreSupervisor, setNombreSupervisor] = useState<string>('');
  const [cedulaSupervisor, setCedulaSupervisor] = useState<string>('');

  // Estados para fotos
  const [fotos, setFotos] = useState<Record<string, string[]>>({});
  const [modalFoto, setModalFoto] = useState({ visible: false, uri: '' });
  
  // Ref para la firma
  const signatureRef = useRef<any>(null);

  // Verificar autenticación y obtener consecutivo
  useEffect(() => {
    verificarAutenticacionYObtenerConsecutivo();
  }, []);

  const verificarAutenticacionYObtenerConsecutivo = async () => {
    try {
      console.log('🔍 Verificando token en storage híbrido...');
      const token = await getSecureItem('auth_token');
      console.log('🔑 Token encontrado:', token ? `${token.substring(0, 30)}... (${token.length} chars)` : 'null');
      
      if (!token) {
        console.warn('⚠️ No hay auth_token, redirigiendo al login');
        Alert.alert(
          'Sesión expirada',
          'Debes iniciar sesión nuevamente para crear informes de supervisión',
          [{ text: 'OK', onPress: () => router.replace('/login') }]
        );
        return;
      }
      
      console.log('🔑 Token encontrado, obteniendo consecutivo');
      // Si hay token, obtener consecutivo
      obtenerConsecutivo();
    } catch (error) {
      console.error('Error verificando autenticación:', error);
      Alert.alert('Error', 'Problema con la autenticación');
      router.replace('/login');
    }
  };

  const obtenerConsecutivo = async () => {
    try {
      const token = await getSecureItem('auth_token');
      console.log('🔑 Token para consecutivo:', token ? 'Existe' : 'No existe');
      
      if (!token) {
        console.warn('⚠️ No hay token, usando consecutivo por defecto');
        setConsecutivo('1');
        return;
      }

      const response = await axios.get(
        `${API_BASE}/formularios/inspeccion/siguiente-consecutivo`,
        { 
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          } 
        }
      );
      
      console.log('✅ Respuesta completa del servidor:', response.data);
      
      // El backend devuelve: { success: true, data: { consecutivo: "123" } }
      let consecutivoValue = 1;
      
      if (response.data.success && response.data.data?.consecutivo) {
        consecutivoValue = parseInt(response.data.data.consecutivo) || 1;
      } else if (response.data.consecutivo) {
        // Fallback por si cambia la estructura
        consecutivoValue = parseInt(response.data.consecutivo) || 1;
      }
      
      console.log('✅ Consecutivo obtenido:', consecutivoValue);
      setConsecutivo(consecutivoValue.toString());
    } catch (error) {
      console.error('❌ Error obteniendo consecutivo:', error);
      
      // Verificar si es error de autenticación
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        console.warn('🚨 Token inválido o expirado');
        Alert.alert(
          'Sesión expirada',
          'Tu sesión ha expirado. Serás redirigido al login.',
          [{ text: 'OK', onPress: () => router.replace('/login') }]
        );
        return;
      }
      
      // Para otros errores, usar consecutivo por defecto
      setConsecutivo('1');
    }
  };

  // Función para manejar evaluaciones (cumple/no_cumple/no_aplica)
  const actualizarEvaluacion = useCallback((seccion: string, item: string, campo: string, valor: any) => {
    if (seccion === 'auxiliares') {
      setInspeccionAuxiliares(prev => ({
        ...prev,
        [item]: { ...prev[item], [campo]: valor }
      }));
    } else if (seccion === 'calidad') {
      setCalidadServicio(prev => ({
        ...prev,
        [item]: { ...prev[item], [campo]: valor }
      }));
    } else if (seccion === 'insumos') {
      setEvaluacionInsumos(prev => ({
        ...prev,
        [item]: { ...prev[item], [campo]: valor }
      }));
    } else if (seccion === 'maquinaria') {
      setEvaluacionMaquinaria(prev => ({
        ...prev,
        [item]: { ...prev[item], [campo]: valor }
      }));
    }
  }, []); // Sin dependencias porque usa funciones de actualización con prev

  // Función para procesar foto - memoizada
  const procesarFoto = useCallback(async (itemId: string, usarCamara: boolean) => {
    try {
      // Obtener token del storage híbrido
      const token = await getSecureItem('auth_token');
      if (!token) {
        Alert.alert('Error', 'No se encontró token de autenticación. Por favor inicia sesión nuevamente.');
        return;
      }

      const permission = usarCamara 
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert('Error', 'Se necesitan permisos para acceder a la cámara/galería');
        return;
      }

      const result = usarCamara
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: 'images',
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.8,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: 'images',
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.8,
          });

      if (!result.canceled && result.assets[0]) {
        const uri = result.assets[0].uri;
        
        console.log('📸 Subiendo foto con token:', token.substring(0, 20) + '...');
        
        // Subir foto al servidor con parámetros correctos: (uri, token, area, formularioId)
        const resultadoUpload = await subirFotoEvidencia(
          uri,
          token,
          'supervision', // área
          undefined // formularioId (aún no existe hasta que se guarde el formulario)
        );
        
        if (!resultadoUpload.success) {
          Alert.alert('Error', resultadoUpload.error || 'No se pudo subir la foto al servidor');
          return;
        }
        
        const urlFoto = resultadoUpload.url || '';
        
        // Agregar a la lista de fotos del item
        setFotos(prev => ({
          ...prev,
          [itemId]: [...(prev[itemId] || []), urlFoto]
        }));

        Alert.alert('Éxito', 'Foto agregada correctamente');
      }
    } catch (error) {
      console.error('❌ Error procesando foto:', error);
      
      if (axios.isAxiosError(error)) {
        const statusCode = error.response?.status;
        if (statusCode === 401) {
          Alert.alert('Error de autenticación', 'Tu sesión ha expirado. Por favor inicia sesión nuevamente.');
        } else {
          Alert.alert('Error de red', 'No se pudo subir la foto al servidor');
        }
      } else {
        Alert.alert('Error', 'No se pudo procesar la foto');
      }
    }
  }, []);

  // Función para agregar/quitar fotos - memoizada
  const agregarFoto = useCallback(async (itemId: string) => {
    const options = ['Tomar foto', 'Seleccionar de galería', 'Cancelar'];
    
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: 2 },
        async (buttonIndex) => {
          if (buttonIndex < 2) {
            await procesarFoto(itemId, buttonIndex === 0);
          }
        }
      );
    } else {
      Alert.alert(
        'Seleccionar foto',
        '',
        [
          { text: 'Tomar foto', onPress: () => procesarFoto(itemId, true) },
          { text: 'Galería', onPress: () => procesarFoto(itemId, false) },
          { text: 'Cancelar', style: 'cancel' }
        ]
      );
    }
  }, [procesarFoto]);

  const eliminarFoto = useCallback(async (itemId: string, urlFoto: string) => {
    try {
      // Extraer el nombre del archivo de la URL para eliminarlo
      const fileName = urlFoto.split('/').pop() || '';
      await eliminarFotoEvidencia(fileName, urlFoto);
      setFotos(prev => ({
        ...prev,
        [itemId]: prev[itemId]?.filter((url: string) => url !== urlFoto) || []
      }));
      Alert.alert('Éxito', 'Foto eliminada correctamente');
    } catch (error) {
      console.error('Error eliminando foto:', error);
      
      if (axios.isAxiosError(error)) {
        Alert.alert('Error de red', 'No se pudo eliminar la foto del servidor');
      } else {
        Alert.alert('Error', 'No se pudo eliminar la foto');
      }
    }
  }, []);
  
  // Callback para ver foto - memoizado
  const verFoto = useCallback((url: string) => {
    setModalFoto({ visible: true, uri: url });
  }, []);

  // Componente para botones de evaluación
  const BotonesEvaluacion = ({ valor, onCambio }: { valor: string; onCambio: (valor: string) => void }) => (
    <View style={styles.botonesEvaluacion}>
      {['cumple', 'no_cumple', 'no_aplica'].map(opcion => (
        <TouchableOpacity
          key={opcion}
          style={[
            styles.botonEvaluacion,
            valor === opcion && styles.botonSeleccionado,
            opcion === 'cumple' && styles.botonCumple,
            opcion === 'no_cumple' && styles.botonNoCumple,
            opcion === 'no_aplica' && styles.botonNoAplica,
          ]}
          onPress={() => onCambio(opcion)}
        >
          <Text style={[
            styles.textoBotonEvaluacion,
            valor === opcion && styles.textoBotonSeleccionado
          ]}>
            {opcion === 'cumple' ? 'CUMPLE' :
             opcion === 'no_cumple' ? 'NO CUMPLE' : 'NO APLICA'}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  // Componente memoizado para item de evaluación (evita re-renders innecesarios)
  const ItemEvaluacion = memo(({ item, seccion, datos, onCambio, fotos, onAgregarFoto, onEliminarFoto, onVerFoto }: { 
    item: { id: string; nombre: string }; 
    seccion: string; 
    datos: Record<string, EvaluacionItem>; 
    onCambio: (itemId: string, campo: string, valor: any) => void;
    fotos: Record<string, string[]>;
    onAgregarFoto: (itemId: string) => void;
    onEliminarFoto: (itemId: string, url: string) => void;
    onVerFoto: (url: string) => void;
  }) => {
    const datosItem = datos[item.id] || {};
    
    const handleEvaluacionChange = useCallback((valor: string) => {
      onCambio(item.id, 'evaluacion', valor);
    }, [item.id, onCambio]);
    
    const handleObservacionesChange = useCallback((valor: string) => {
      onCambio(item.id, 'observaciones', valor);
    }, [item.id, onCambio]);
    
    const handleAgregarFoto = useCallback(() => {
      onAgregarFoto(item.id);
    }, [item.id, onAgregarFoto]);
    
    return (
      <View style={styles.itemEvaluacion}>
        <Text style={styles.nombreItem}>{item.nombre}</Text>
        
        <BotonesEvaluacion 
          valor={datosItem.evaluacion || ''}
          onCambio={handleEvaluacionChange}
        />

        <TextInput
          style={styles.inputObservacion}
          placeholder="Observaciones..."
          value={datosItem.observaciones || ''}
          onChangeText={handleObservacionesChange}
          multiline
        />

        <View style={styles.seccionFotos}>
          <TouchableOpacity 
            style={styles.botonAgregarFoto}
            onPress={handleAgregarFoto}
          >
            <Ionicons name="camera" size={24} color={COLORS.primary} />
            <Text style={styles.textoBotonFoto}>Agregar Foto</Text>
          </TouchableOpacity>

          <View style={styles.listaFotos}>
            {(fotos[item.id] || []).map((url: string, index: number) => (
              <View key={`${item.id}-${index}`} style={styles.contenedorFoto}>
                <TouchableOpacity onPress={() => onVerFoto(url)}>
                  <Image source={{ uri: url }} style={styles.miniatura} />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.botonEliminarFoto}
                  onPress={() => onEliminarFoto(item.id, url)}
                >
                  <Ionicons name="close-circle" size={20} color={COLORS.danger} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  });

  // Función para enviar formulario
  const enviarFormulario = async () => {
    try {
      setCargando(true);

      // Validar datos requeridos
      if (!datosGenerales.cliente || !datosGenerales.direccion || !nombreSupervisor) {
        Alert.alert('Error', 'Complete todos los campos obligatorios');
        return;
      }

      // Validar firma
      if (signatureRef.current?.isEmpty()) {
        Alert.alert('Error', 'Debe firmar el documento');
        return;
      }

      // Capturar firma
      const signatureData = signatureRef.current?.toDataURL();
      if (!signatureData) {
        Alert.alert('Error', 'No se pudo capturar la firma');
        return;
      }

      console.log('🔍 Paso 1: Obteniendo token...');
      const token = await getSecureItem('auth_token');
      
      if (!token) {
        Alert.alert('Error', 'No se encontró token de autenticación. Por favor inicia sesión nuevamente.');
        return;
      }
      
      console.log('🔑 Token encontrado');
      
      // Preparar array de áreas inspeccionadas (combinar todas las secciones)
      const areasInspeccionadas = [
        ...Object.keys(inspeccionAuxiliares).map(key => ({
          area: 'auxiliares',
          item: key,
          evaluacion: inspeccionAuxiliares[key]?.evaluacion,
          observaciones: inspeccionAuxiliares[key]?.observaciones,
          fotos: fotos[key] || []
        })),
        ...Object.keys(calidadServicio).map(key => ({
          area: 'calidad_servicio',
          item: key,
          evaluacion: calidadServicio[key]?.evaluacion,
          observaciones: calidadServicio[key]?.observaciones,
          fotos: fotos[key] || []
        })),
        ...Object.keys(evaluacionInsumos).map(key => ({
          area: 'insumos',
          item: key,
          evaluacion: evaluacionInsumos[key]?.evaluacion,
          observaciones: evaluacionInsumos[key]?.observaciones,
          fotos: fotos[key] || []
        })),
        ...Object.keys(evaluacionMaquinaria).map(key => ({
          area: 'maquinaria',
          item: key,
          evaluacion: evaluacionMaquinaria[key]?.evaluacion,
          observaciones: evaluacionMaquinaria[key]?.observaciones
        }))
      ];

      console.log('📋 Paso 2: Preparando datos...');
      
      const registroId = Array.isArray(params.registroId) ? params.registroId[0] : params.registroId;
      
      // Preparar payload según lo que espera el backend
      const payload = {
        registro_cliente_id: parseInt(registroId || '0'),
        consecutivo: consecutivo.toString(), // ✅ Como string
        fecha_inspeccion: datosGenerales.fecha_supervision || new Date().toISOString().split('T')[0],
        areas_inspeccionadas: areasInspeccionadas, // ✅ Array de áreas
        
        // Datos adicionales
        observaciones_generales: observacionesFinales,
        datos_generales: datosGenerales,
        tabla_costos: tablaCostos,
        inventario_maquinaria: inventarioMaquinaria,
        plan_accion: planAccion,
        
        // Firma
        firma_supervisor_base64: signatureData,
        nombre_supervisor: nombreSupervisor,
        cedula_supervisor: cedulaSupervisor,
        fecha_firma_supervisor: new Date().toISOString(),
      };

      console.log('📦 Datos a enviar:', {
        ...payload,
        firma_supervisor_base64: payload.firma_supervisor_base64.substring(0, 50) + '...',
        areas_count: areasInspeccionadas.length
      });
      
      console.log('🌐 Enviando a:', `${API_BASE}/formularios/inspeccion`);

      const response = await axios.post(
        `${API_BASE}/formularios/inspeccion`,
        payload,
        { 
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      console.log('✅ Respuesta del servidor:', response.data);

      Alert.alert(
        'Éxito',
        'Informe de supervisión guardado correctamente',
        [{ text: 'OK', onPress: () => router.back() }]
      );

    } catch (error) {
      console.error('❌ Error enviando formulario:', error);
      
      if (axios.isAxiosError(error)) {
        console.error('❌ Error response:', error.response?.data);
        
        let mensaje = 'No se pudo guardar el formulario';
        
        if (error.response?.status === 401) {
          mensaje = 'Sesión expirada. Inicia sesión nuevamente.';
          setTimeout(() => router.replace('/login'), 2000);
        } else if (error.response?.status === 422) {
          const errores = error.response.data?.errors;
          if (errores) {
            const listaErrores = Object.entries(errores)
              .map(([campo, msgs]: [string, any]) => `${campo}: ${msgs.join(', ')}`)
              .join('\n');
            mensaje = `Errores de validación:\n${listaErrores}`;
          } else {
            mensaje = 'Datos inválidos. Revisa todos los campos.';
          }
        } else if (error.response?.data?.message) {
          mensaje = error.response.data.message;
        }
        
        Alert.alert('Error', mensaje);
      } else {
        // Error que no es de axios
        Alert.alert('Error', 'No se pudo guardar el formulario');
      }
    } finally {
      setCargando(false);
    }
  };

  // Render de secciones
  const renderSeccion1 = () => (
    <View style={styles.seccion}>
      <Text style={styles.tituloSeccion}>📋 SECCIÓN 1: DATOS GENERALES</Text>
      
      <View style={styles.campo}>
        <Text style={styles.etiqueta}>Cliente *</Text>
        <TextInput
          style={styles.input}
          value={Array.isArray(datosGenerales.cliente) ? datosGenerales.cliente[0] : datosGenerales.cliente}
          onChangeText={(texto) => setDatosGenerales(prev => ({ ...prev, cliente: texto }))}
          placeholder="Nombre del cliente"
        />
      </View>

      <View style={styles.campo}>
        <Text style={styles.etiqueta}>Dirección *</Text>
        <TextInput
          style={styles.input}
          value={datosGenerales.direccion}
          onChangeText={(texto) => setDatosGenerales(prev => ({ ...prev, direccion: texto }))}
          placeholder="Dirección del cliente"
        />
      </View>

      <View style={styles.campo}>
        <Text style={styles.etiqueta}>Supervisor Jefe</Text>
        <TextInput
          style={styles.input}
          value={datosGenerales.supervisor_jefe}
          onChangeText={(texto) => setDatosGenerales(prev => ({ ...prev, supervisor_jefe: texto }))}
          placeholder="Nombre del supervisor jefe"
        />
      </View>

      <View style={styles.campo}>
        <Text style={styles.etiqueta}>Ciudad</Text>
        <TextInput
          style={styles.input}
          value={datosGenerales.ciudad}
          onChangeText={(texto) => setDatosGenerales(prev => ({ ...prev, ciudad: texto }))}
          placeholder="Ciudad"
        />
      </View>

      <View style={styles.campo}>
        <Text style={styles.etiqueta}>Fecha de Supervisión</Text>
        <TextInput
          style={styles.input}
          value={datosGenerales.fecha_supervision}
          onChangeText={(texto) => setDatosGenerales(prev => ({ ...prev, fecha_supervision: texto }))}
          placeholder="AAAA-MM-DD"
        />
      </View>

      <View style={styles.campo}>
        <Text style={styles.etiqueta}>Número de Trabajadores</Text>
        <TextInput
          style={styles.input}
          value={datosGenerales.numero_trabajadores}
          onChangeText={(texto) => setDatosGenerales(prev => ({ ...prev, numero_trabajadores: texto }))}
          placeholder="Cantidad de trabajadores"
          keyboardType="numeric"
        />
      </View>

      <View style={styles.campo}>
        <Text style={styles.etiqueta}>Horario Laboral</Text>
        <TextInput
          style={styles.input}
          value={datosGenerales.horario_laboral}
          onChangeText={(texto) => setDatosGenerales(prev => ({ ...prev, horario_laboral: texto }))}
          placeholder="Ej: 6:00 AM - 2:00 PM"
        />
      </View>

      <View style={styles.campo}>
        <Text style={styles.etiqueta}>Otros Horarios</Text>
        <TextInput
          style={styles.input}
          value={datosGenerales.otros_horarios}
          onChangeText={(texto) => setDatosGenerales(prev => ({ ...prev, otros_horarios: texto }))}
          placeholder="Horarios adicionales"
          multiline
        />
      </View>
    </View>
  );

  const renderSeccion2 = () => (
    <View style={styles.seccion}>
      <Text style={styles.tituloSeccion}>👥 SECCIÓN 2: INSPECCIÓN DE AUXILIARES</Text>
      <Text style={styles.subtituloSeccion}>Evaluación de 9 aspectos del personal</Text>
      
      {INSPECCION_AUXILIARES.map(item => (
        <ItemEvaluacion
          key={item.id}
          item={item}
          seccion="auxiliares"
          datos={inspeccionAuxiliares}
          onCambio={(itemId, campo, valor) => actualizarEvaluacion('auxiliares', itemId, campo, valor)}
          fotos={fotos}
          onAgregarFoto={agregarFoto}
          onEliminarFoto={eliminarFoto}
          onVerFoto={verFoto}
        />
      ))}
    </View>
  );

  const renderSeccion3 = () => (
    <View style={styles.seccion}>
      <Text style={styles.tituloSeccion}>🧹 SECCIÓN 3: CALIDAD DEL SERVICIO</Text>
      <Text style={styles.subtituloSeccion}>Evaluación de 20 aspectos de limpieza</Text>
      
      {CALIDAD_SERVICIO.map(item => (
        <ItemEvaluacion
          key={item.id}
          item={item}
          seccion="calidad"
          datos={calidadServicio}
          onCambio={(itemId, campo, valor) => actualizarEvaluacion('calidad', itemId, campo, valor)}
          fotos={fotos}
          onAgregarFoto={agregarFoto}
          onEliminarFoto={eliminarFoto}
          onVerFoto={verFoto}
        />
      ))}
    </View>
  );

  const renderSeccion4 = () => (
    <View style={styles.seccion}>
      <Text style={styles.tituloSeccion}>📦 SECCIÓN 4: INSUMOS Y COSTOS</Text>
      
      {/* Evaluación de insumos */}
      <Text style={styles.subtituloSeccion}>Evaluación de Insumos</Text>
      {EVALUACION_INSUMOS.map(item => (
        <ItemEvaluacion
          key={item.id}
          item={item}
          seccion="insumos"
          datos={evaluacionInsumos}
          onCambio={(itemId, campo, valor) => actualizarEvaluacion('insumos', itemId, campo, valor)}
          fotos={fotos}
          onAgregarFoto={agregarFoto}
          onEliminarFoto={eliminarFoto}
          onVerFoto={verFoto}
        />
      ))}

      {/* Tabla de costos */}
      <Text style={styles.subtituloSeccion}>Tabla de Costos</Text>
      {tablaCostos.map((fila, index) => (
        <View key={index} style={styles.filaCosto}>
          <TextInput
            style={[styles.input, styles.inputTabla]}
            placeholder="Item"
            value={fila.item}
            onChangeText={(texto) => {
              const nuevaTabla = [...tablaCostos];
              nuevaTabla[index].item = texto;
              setTablaCostos(nuevaTabla);
            }}
          />
          <TextInput
            style={[styles.input, styles.inputTabla]}
            placeholder="Costo Actual"
            value={fila.costo_actual}
            onChangeText={(texto) => {
              const nuevaTabla = [...tablaCostos];
              nuevaTabla[index].costo_actual = texto;
              setTablaCostos(nuevaTabla);
            }}
            keyboardType="numeric"
          />
          <TextInput
            style={[styles.input, styles.inputTabla]}
            placeholder="Costo Mes Anterior"
            value={fila.costo_mes_anterior}
            onChangeText={(texto) => {
              const nuevaTabla = [...tablaCostos];
              nuevaTabla[index].costo_mes_anterior = texto;
              setTablaCostos(nuevaTabla);
            }}
            keyboardType="numeric"
          />
          <TextInput
            style={[styles.input, styles.inputTabla]}
            placeholder="Observaciones"
            value={fila.observaciones}
            onChangeText={(texto) => {
              const nuevaTabla = [...tablaCostos];
              nuevaTabla[index].observaciones = texto;
              setTablaCostos(nuevaTabla);
            }}
          />
        </View>
      ))}
      
      <TouchableOpacity 
        style={styles.botonAgregar}
        onPress={() => setTablaCostos([...tablaCostos, { item: '', costo_actual: '', costo_mes_anterior: '', diferencia: '', observaciones: '' }])}
      >
        <Text style={styles.textoBotonAgregar}>+ Agregar Fila</Text>
      </TouchableOpacity>
    </View>
  );

  const renderSeccion5 = () => (
    <View style={styles.seccion}>
      <Text style={styles.tituloSeccion}>🔧 SECCIÓN 5: MAQUINARIA</Text>
      
      {/* Inventario de maquinaria */}
      <Text style={styles.subtituloSeccion}>Inventario de Maquinaria</Text>
      {inventarioMaquinaria.map((fila, index) => (
        <View key={index} style={styles.filaMaquinaria}>
          <TextInput
            style={[styles.input, styles.inputTabla]}
            placeholder="Máquina/Equipo"
            value={fila.maquina}
            onChangeText={(texto) => {
              const nuevoInventario = [...inventarioMaquinaria];
              nuevoInventario[index].maquina = texto;
              setInventarioMaquinaria(nuevoInventario);
            }}
          />
          <TextInput
            style={[styles.input, styles.inputTabla]}
            placeholder="Estado"
            value={fila.estado}
            onChangeText={(texto) => {
              const nuevoInventario = [...inventarioMaquinaria];
              nuevoInventario[index].estado = texto;
              setInventarioMaquinaria(nuevoInventario);
            }}
          />
          <TextInput
            style={[styles.input, styles.inputTabla]}
            placeholder="Observaciones"
            value={fila.observaciones}
            onChangeText={(texto) => {
              const nuevoInventario = [...inventarioMaquinaria];
              nuevoInventario[index].observaciones = texto;
              setInventarioMaquinaria(nuevoInventario);
            }}
          />
        </View>
      ))}
      
      <TouchableOpacity 
        style={styles.botonAgregar}
        onPress={() => setInventarioMaquinaria([...inventarioMaquinaria, { maquina: '', estado: '', observaciones: '' }])}
      >
        <Text style={styles.textoBotonAgregar}>+ Agregar Máquina</Text>
      </TouchableOpacity>

      {/* Evaluación de maquinaria */}
      <Text style={styles.subtituloSeccion}>Evaluación de Maquinaria</Text>
      {EVALUACION_MAQUINARIA.map(item => (
        <ItemEvaluacion
          key={item.id}
          item={item}
          seccion="maquinaria"
          datos={evaluacionMaquinaria}
          onCambio={(itemId, campo, valor) => actualizarEvaluacion('maquinaria', itemId, campo, valor)}
          fotos={fotos}
          onAgregarFoto={agregarFoto}
          onEliminarFoto={eliminarFoto}
          onVerFoto={verFoto}
        />
      ))}
    </View>
  );

  const renderSeccion6 = () => (
    <View style={styles.seccion}>
      <Text style={styles.tituloSeccion}>📋 SECCIÓN 6: PLAN DE ACCIÓN</Text>
      
      {planAccion.map((fila, index) => (
        <View key={index} style={styles.filaPlanAccion}>
          <TextInput
            style={[styles.input, styles.inputTabla]}
            placeholder="Hallazgo"
            value={fila.hallazgo}
            onChangeText={(texto) => {
              const nuevoPlan = [...planAccion];
              nuevoPlan[index].hallazgo = texto;
              setPlanAccion(nuevoPlan);
            }}
            multiline
          />
          <TextInput
            style={[styles.input, styles.inputTabla]}
            placeholder="Acción Correctiva"
            value={fila.accion_correctiva}
            onChangeText={(texto) => {
              const nuevoPlan = [...planAccion];
              nuevoPlan[index].accion_correctiva = texto;
              setPlanAccion(nuevoPlan);
            }}
            multiline
          />
          <TextInput
            style={[styles.input, styles.inputTabla]}
            placeholder="Responsable"
            value={fila.responsable}
            onChangeText={(texto) => {
              const nuevoPlan = [...planAccion];
              nuevoPlan[index].responsable = texto;
              setPlanAccion(nuevoPlan);
            }}
          />
          <TextInput
            style={[styles.input, styles.inputTabla]}
            placeholder="Fecha Límite (AAAA-MM-DD)"
            value={fila.fecha_limite}
            onChangeText={(texto) => {
              const nuevoPlan = [...planAccion];
              nuevoPlan[index].fecha_limite = texto;
              setPlanAccion(nuevoPlan);
            }}
          />
          <TextInput
            style={[styles.input, styles.inputTabla]}
            placeholder="Estado"
            value={fila.estado}
            onChangeText={(texto) => {
              const nuevoPlan = [...planAccion];
              nuevoPlan[index].estado = texto;
              setPlanAccion(nuevoPlan);
            }}
          />
        </View>
      ))}
      
      <TouchableOpacity 
        style={styles.botonAgregar}
        onPress={() => setPlanAccion([...planAccion, { hallazgo: '', accion_correctiva: '', responsable: '', fecha_limite: '', estado: '' }])}
      >
        <Text style={styles.textoBotonAgregar}>+ Agregar Acción</Text>
      </TouchableOpacity>
    </View>
  );

  const renderSeccion7 = () => (
    <View style={styles.seccion}>
      <Text style={styles.tituloSeccion}>✍️ SECCIÓN 7: OBSERVACIONES Y FIRMA</Text>
      
      <View style={styles.campo}>
        <Text style={styles.etiqueta}>Observaciones Finales</Text>
        <TextInput
          style={[styles.input, styles.inputMultilinea]}
          value={observacionesFinales}
          onChangeText={setObservacionesFinales}
          placeholder="Escriba sus observaciones finales..."
          multiline
          numberOfLines={4}
        />
      </View>

      <View style={styles.campo}>
        <Text style={styles.etiqueta}>Nombre del Supervisor *</Text>
        <TextInput
          style={styles.input}
          value={nombreSupervisor}
          onChangeText={setNombreSupervisor}
          placeholder="Nombre completo del supervisor"
        />
      </View>

      <View style={styles.campo}>
        <Text style={styles.etiqueta}>Cédula del Supervisor</Text>
        <TextInput
          style={styles.input}
          value={cedulaSupervisor}
          onChangeText={setCedulaSupervisor}
          placeholder="Número de cédula"
          keyboardType="numeric"
        />
      </View>

      <View style={styles.campo}>
        <Text style={styles.etiqueta}>Firma del Supervisor *</Text>
        <View style={styles.containerFirma}>
          <SimpleSignaturePad
            ref={signatureRef}
            height={200}
            strokeColor="#000000"
            strokeWidth={3}
          />
        </View>
        
        <TouchableOpacity 
          style={styles.botonLimpiarFirma}
          onPress={() => signatureRef.current?.clear()}
        >
          <Text style={styles.textoBotonLimpiar}>Limpiar Firma</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.botonAtras}>
          <Ionicons name="arrow-back" size={24} color={COLORS.surface} />
        </TouchableOpacity>
        <Text style={styles.tituloHeader}>INFORME DE SUPERVISIÓN</Text>
        
        {/* Mostrar botón de reconectar si no hay consecutivo válido */}
        {consecutivo === '1' && (
          <TouchableOpacity 
            onPress={() => router.replace('/login')} 
            style={styles.botonReconectar}
          >
            <Ionicons name="log-in" size={20} color={COLORS.warning} />
            <Text style={styles.textoReconectar}>Reconectar</Text>
          </TouchableOpacity>
        )}
        
        <View style={styles.infoConsecutivo}>
          <Text style={styles.textoConsecutivo}>N° {consecutivo}</Text>
        </View>
      </View>

      {/* Navegación entre secciones */}
      <View style={styles.navegadorSecciones}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {[1, 2, 3, 4, 5, 6, 7].map(num => (
            <TouchableOpacity
              key={num}
              style={[
                styles.botonSeccion,
                seccionActual === num && styles.botonSeccionActiva
              ]}
              onPress={() => setSeccionActual(num)}
            >
              <Text style={[
                styles.textoBotonSeccion,
                seccionActual === num && styles.textoBotonSeccionActiva
              ]}>
                {num}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView style={styles.contenido}>
        {seccionActual === 1 && renderSeccion1()}
        {seccionActual === 2 && renderSeccion2()}
        {seccionActual === 3 && renderSeccion3()}
        {seccionActual === 4 && renderSeccion4()}
        {seccionActual === 5 && renderSeccion5()}
        {seccionActual === 6 && renderSeccion6()}
        {seccionActual === 7 && renderSeccion7()}

        {/* Botones de navegación */}
        <View style={styles.botonesNavegacion}>
          {seccionActual > 1 && (
            <TouchableOpacity
              style={[styles.botonNavegacion, styles.botonAnterior]}
              onPress={() => setSeccionActual(seccionActual - 1)}
            >
              <Text style={styles.textoBotonNavegacion}>← Anterior</Text>
            </TouchableOpacity>
          )}
          
          {seccionActual < 7 ? (
            <TouchableOpacity
              style={[styles.botonNavegacion, styles.botonSiguiente]}
              onPress={() => setSeccionActual(seccionActual + 1)}
            >
              <Text style={styles.textoBotonNavegacion}>Siguiente →</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.botonNavegacion, styles.botonGuardar]}
              onPress={enviarFormulario}
              disabled={cargando}
            >
              <Text style={styles.textoBotonNavegacion}>
                {cargando ? 'Guardando...' : 'Guardar Informe'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Modal para ver foto completa */}
      <Modal visible={modalFoto.visible} transparent>
        <View style={styles.modalFoto}>
          <TouchableOpacity 
            style={styles.fondoModal}
            onPress={() => setModalFoto({ visible: false, uri: '' })}
          >
            <Image source={{ uri: modalFoto.uri }} style={styles.imagenCompleta} />
            <TouchableOpacity 
              style={styles.botonCerrarModal}
              onPress={() => setModalFoto({ visible: false, uri: '' })}
            >
              <Ionicons name="close" size={30} color={COLORS.surface} />
            </TouchableOpacity>
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  botonAtras: {
    padding: 8,
  },
  tituloHeader: {
    flex: 1,
    color: COLORS.surface,
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginRight: 40,
  },
  infoConsecutivo: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  textoConsecutivo: {
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  botonReconectar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 8,
  },
  textoReconectar: {
    color: COLORS.warning,
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  navegadorSecciones: {
    backgroundColor: COLORS.surface,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  botonSeccion: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 4,
  },
  botonSeccionActiva: {
    backgroundColor: COLORS.primary,
  },
  textoBotonSeccion: {
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  textoBotonSeccionActiva: {
    color: COLORS.surface,
  },
  contenido: {
    flex: 1,
    padding: 16,
  },
  seccion: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  tituloSeccion: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 8,
  },
  subtituloSeccion: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 16,
  },
  campo: {
    marginBottom: 16,
  },
  etiqueta: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  inputMultilinea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  inputTabla: {
    marginBottom: 8,
    fontSize: 14,
  },
  itemEvaluacion: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  nombreItem: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.textPrimary,
    marginBottom: 12,
  },
  botonesEvaluacion: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  botonEvaluacion: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 6,
    paddingVertical: 8,
    marginHorizontal: 2,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  botonSeleccionado: {
    borderWidth: 2,
  },
  botonCumple: {
    borderColor: COLORS.success,
  },
  botonNoCumple: {
    borderColor: COLORS.danger,
  },
  botonNoAplica: {
    borderColor: COLORS.warning,
  },
  textoBotonEvaluacion: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.textSecondary,
  },
  textoBotonSeleccionado: {
    color: COLORS.textPrimary,
    fontWeight: 'bold',
  },
  inputObservacion: {
    backgroundColor: COLORS.surface,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  seccionFotos: {
    marginTop: 8,
  },
  botonAgregarFoto: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.primary,
    marginBottom: 8,
  },
  textoBotonFoto: {
    marginLeft: 8,
    color: COLORS.primary,
    fontWeight: '500',
  },
  listaFotos: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  contenedorFoto: {
    position: 'relative',
  },
  miniatura: {
    width: 60,
    height: 60,
    borderRadius: 6,
  },
  botonEliminarFoto: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
  },
  filaCosto: {
    marginBottom: 16,
  },
  filaMaquinaria: {
    marginBottom: 16,
  },
  filaPlanAccion: {
    marginBottom: 16,
  },
  botonAgregar: {
    backgroundColor: COLORS.secondary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  textoBotonAgregar: {
    color: COLORS.surface,
    fontWeight: '500',
  },
  containerFirma: {
    height: 200,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    backgroundColor: COLORS.surface,
  },
  botonLimpiarFirma: {
    backgroundColor: COLORS.textSecondary,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  textoBotonLimpiar: {
    color: COLORS.surface,
    fontWeight: '500',
  },
  botonesNavegacion: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 20,
  },
  botonNavegacion: {
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    minWidth: 120,
    alignItems: 'center',
  },
  botonAnterior: {
    backgroundColor: COLORS.textSecondary,
  },
  botonSiguiente: {
    backgroundColor: COLORS.secondary,
  },
  botonGuardar: {
    backgroundColor: COLORS.success,
    flex: 1,
  },
  textoBotonNavegacion: {
    color: COLORS.surface,
    fontWeight: 'bold',
    fontSize: 16,
  },
  modalFoto: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fondoModal: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagenCompleta: {
    width: '90%',
    height: '70%',
    resizeMode: 'contain',
  },
  botonCerrarModal: {
    position: 'absolute',
    top: 50,
    right: 20,
  },
});