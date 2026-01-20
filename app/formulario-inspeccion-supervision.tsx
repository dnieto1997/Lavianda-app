/**
 * 📋 FORMULARIO DE VISITA
 * 
 * Este formulario se puede llenar múltiples veces después del acta de inicio.
 * Permite registrar visitas con fotos y observaciones de las áreas.
 */

import React, { useState, useEffect, useRef } from 'react';
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
import axios from 'axios';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from './_layout';
import { subirFotoEvidencia, eliminarFotoEvidencia } from '../services/evidenciasService';
import SimpleSignaturePad from '../components/SimpleSignaturePad';
import { getSecureItem } from '../utils/secureStorage';
import { useLocation } from '@/contexts/LocationContext';


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
 

// ✅ LISTADO SIMPLE DE ÁREAS (FUNCIONA)
const AREAS_INSPECCION = [
  '1) Presentación personal del personal de aseo',
  '2) Uniforme en buen estado',
  '3) Carnetí vigente y visible sobre el Sistema de gestión integrado',
  '4) Comunicación con el personal sobre el Sistema de gestión integrado',
  '5) Tiene un lugar visible el carnet que lo identifica como miembro de la empresa',
  '6) Procesos y compromiso',
  '7) Alistamiento',
  '8) Relaciones interpersonales',
  '9) Uso adecuado de los elementos de protección individual (EPI)',
  '10) Limpieza de pisos',
  '11) Limpieza de escritorios',
  '12) Limpieza de sillas',
  '13) Limpieza y ventilación del baño',
  '14) Limpieza de estanterías',
  '15) Limpieza de áreas comunes',
  '16) Limpieza de equipos de oficina',
  '17) Limpieza de ventanas',
  '18) Limpieza de parqueadero',
  '19) Limpieza de ascensores',
  '20) Limpieza de espacios',
  '21) Limpieza cuarto de almacenamiento de los insumos',
  '22) Partes comunes',
  '23) Limpieza de marcos',
  '24) Limpieza de zócalos',
  '25) Limpieza de vidrios',
  '26) Limpieza de techos',
  '27) Uso correcto de sistemas preventivos',
  '28) Retiro periódico de polvo y desinfección del trabajador de trabajo',
  '29) Otros',
];

interface InspeccionData {
  consecutivo: string;
  fecha: string;
  empresa: string;
  direccion: string;
  ciudad: string;
  
  // Áreas de inspección
  areas: {
    [key: string]: {
      cumple: boolean;
      no_cumple: boolean;
      no_aplica: boolean;
      observaciones: string;
      fotos: {
        uri: string;
        url: string;
        ruta: string;
      }[];
    };
  };
  
  // Insumos
  insumos: {
    nombre: string;
    marca: string;
    cantidad: string;
    cumple: boolean;
    no_cumple: boolean;
    no_aplica: boolean;
  }[];
  
  // Observaciones generales y firma
  observaciones_generales: string;
  nombre_firmante: string;
  cedula_firmante: string;
  firma_supervisor?: string;
}

const normalizarUrlFoto = (url: string): string => {
  if (!url) return '';
  if (url.startsWith('https://operaciones.lavianda.com.co/')) return url;
  
  let urlLimpia = url
    .replace(/^http:\/\//, 'https://')
    .replace(/^http:/, 'https://')
    .replace(/^https:([^\/])/, 'https://$1')
    .replace('operaciones.lavianda.com/', 'operaciones.lavianda.com.co/');
  
  if (!urlLimpia.startsWith('http://') && !urlLimpia.startsWith('https://')) {
    urlLimpia = `https://operaciones.lavianda.com.co/storage/${urlLimpia}`;
  }
  
  return urlLimpia;
};

export default function FormularioInspeccionSupervision() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();
  const signatureRef = useRef<any>(null);
   const { startTracking } = useLocation();
  
  const [saving, setSaving] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string>('');
  const [modalFirmaVisible, setModalFirmaVisible] = useState(false);
  const [firmaBase64, setFirmaBase64] = useState<string>('');
  const [imageErrors, setImageErrors] = useState<{[key: string]: boolean}>({});
  
  // Estados del formulario
  const [formData, setFormData] = useState<InspeccionData>({
    consecutivo: '',
    fecha: new Date().toISOString().split('T')[0],
    empresa: '',
    direccion: '',
    ciudad: '',
    areas: {},
    insumos: [],
    observaciones_generales: '',
    nombre_firmante: user?.name || '',
    cedula_firmante: '',
    firma_supervisor: '',
  });

  // Inicializar áreas
  useEffect(() => {
    const areasIniciales: any = {};
    
    // Agregar todas las áreas de inspección
    AREAS_INSPECCION.forEach(area => {
      areasIniciales[area] = {
        cumple: false,
        no_cumple: false,
        no_aplica: false,
        observaciones: '',
        fotos: [],
      };
    });
    
    setFormData(prev => ({ ...prev, areas: areasIniciales }));
  }, []);

  // Cargar información de la empresa si viene del acta de inicio
  useEffect(() => {
    if (params.empresaNombre) {
      setFormData(prev => ({
        ...prev,
        empresa: params.empresaNombre as string,
        direccion: params.direccion as string || '',
        ciudad: params.ciudad as string || '',
      }));
    }
  }, [params]);

  // Generar consecutivo automático
  useEffect(() => {
    generarConsecutivo();
  }, []);

  const generarConsecutivo = async () => {
    try {
      console.log('🔄 Generando consecutivo para inspección...');
      const token = await getSecureItem('auth_token');
      
      if (!token) {
        console.error('❌ No hay token de autenticación');
        setFormData(prev => ({
          ...prev,
          consecutivo: `INS-${Date.now()}`,
        }));
        return;
      }

      const response = await axios.get(`${API_BASE}/formularios/inspeccion/siguiente-consecutivo`, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        timeout: 10000, // 10 segundos timeout
      });
      
      console.log('✅ Respuesta consecutivo:', response.data);
      
      if (response.data.success) {
        setFormData(prev => ({
          ...prev,
          consecutivo: response.data.data.consecutivo,
        }));
        console.log('✅ Consecutivo generado:', response.data.data.consecutivo);
      } else {
        throw new Error('Respuesta no exitosa del servidor');
      }
    } catch (error: any) {
      console.error('❌ Error generando consecutivo:', error);
      console.error('❌ Error details:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      
      // Generar consecutivo offline como fallback
      const fallbackConsecutivo = `INS-${Date.now()}`;
      setFormData(prev => ({
        ...prev,
        consecutivo: fallbackConsecutivo,
      }));
      console.log('⚠️ Usando consecutivo fallback:', fallbackConsecutivo);
      
      // Mostrar un mensaje al usuario (opcional)
      Alert.alert(
        'Aviso',
        'No se pudo generar el consecutivo automático. Se usará uno temporal.',
        [{ text: 'Continuar', style: 'default' }]
      );
    }
  };

  // Manejo de cambios en áreas
  const handleAreaChange = (area: string, field: 'cumple' | 'no_cumple' | 'no_aplica' | 'observaciones', value: any) => {
    setFormData(prev => ({
      ...prev,
      areas: {
        ...prev.areas,
        [area]: {
          ...prev.areas[area],
          [field]: value,
          // Si se activa uno, desactivar los otros
          ...(field === 'cumple' && value ? { no_cumple: false, no_aplica: false } : {}),
          ...(field === 'no_cumple' && value ? { cumple: false, no_aplica: false } : {}),
          ...(field === 'no_aplica' && value ? { cumple: false, no_cumple: false } : {}),
        },
      },
    }));
  };

  // Captura de fotos
  const mostrarOpcionesFoto = (area: string) => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancelar', 'Tomar Foto', 'Elegir de Galería'],
          cancelButtonIndex: 0,
        },
        buttonIndex => {
          if (buttonIndex === 1) tomarFoto(area);
          if (buttonIndex === 2) elegirFoto(area);
        }
      );
    } else {
      Alert.alert(
        'Agregar Foto',
        'Selecciona una opción',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Tomar Foto', onPress: () => tomarFoto(area) },
    
        ]
      );
    }
  };

  const tomarFoto = async (area: string) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permisos', 'Se necesitan permisos de cámara');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: 'images',
      quality: 0.8,
      base64: false,
    });

    if (!result.canceled && result.assets[0]) {
      await procesarYSubirFoto(area, result.assets[0].uri);
    }
  };

  const elegirFoto = async (area: string) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permisos', 'Se necesitan permisos de galería');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      quality: 0.8,
      base64: false,
    });

    if (!result.canceled && result.assets[0]) {
      await procesarYSubirFoto(area, result.assets[0].uri);
    }
  };

  const procesarYSubirFoto = async (area: string, uriLocal: string) => {
    try {
      const token = await getSecureItem('auth_token');
      if (!token) throw new Error('No hay token');

      // Convertir área a índice numérico para el upload
      const areaIndex = AREAS_INSPECCION.findIndex(a => a === area);
      const resultado = await subirFotoEvidencia(uriLocal, token, 'inspeccion', areaIndex);

      setFormData(prev => ({
        ...prev,
        areas: {
          ...prev.areas,
          [area]: {
            ...prev.areas[area],
            fotos: [
              ...prev.areas[area].fotos,
              {
                uri: uriLocal,
                url: resultado.url || '',
                ruta: resultado.ruta || '',
              },
            ],
          },
        },
      }));

      Alert.alert('Éxito', 'Foto subida correctamente');
    } catch (error: any) {
      console.error('Error subiendo foto:', error);
      Alert.alert('Error', error.message || 'No se pudo subir la foto');
    }
  };

  const eliminarFoto = async (area: string, index: number) => {
    Alert.alert(
      'Eliminar Foto',
      '¿Estás seguro de eliminar esta foto?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const foto = formData.areas[area].fotos[index];
              const token = await getSecureItem('auth_token');
              
              if (foto.ruta && token) {
                await eliminarFotoEvidencia(foto.ruta, token);
              }

              setFormData(prev => ({
                ...prev,
                areas: {
                  ...prev.areas,
                  [area]: {
                    ...prev.areas[area],
                    fotos: prev.areas[area].fotos.filter((_, i) => i !== index),
                  },
                },
              }));
            } catch (error) {
              console.error('Error eliminando foto:', error);
              Alert.alert('Error', 'No se pudo eliminar la foto');
            }
          },
        },
      ]
    );
  };

  // Agregar insumo
  const agregarInsumo = () => {
    setFormData(prev => ({
      ...prev,
      insumos: [
        ...prev.insumos,
        {
          nombre: '',
          marca: '',
          cantidad: '',
          cumple: false,
          no_cumple: false,
          no_aplica: false,
        },
      ],
    }));
  };

  const eliminarInsumo = (index: number) => {
    setFormData(prev => ({
      ...prev,
      insumos: prev.insumos.filter((_, i) => i !== index),
    }));
  };

  const handleInsumoChange = (index: number, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      insumos: prev.insumos.map((item, i) => {
        if (i === index) {
          const updated = { ...item, [field]: value };
          
          // Si se activa uno, desactivar los otros
          if (field === 'cumple' && value) {
            updated.no_cumple = false;
            updated.no_aplica = false;
          } else if (field === 'no_cumple' && value) {
            updated.cumple = false;
            updated.no_aplica = false;
          } else if (field === 'no_aplica' && value) {
            updated.cumple = false;
            updated.no_cumple = false;
          }
          
          return updated;
        }
        return item;
      }),
    }));
  };

  // Firma
  const iniciarProcesoDeFirma = () => {
    if (!formData.empresa.trim()) {
      Alert.alert('Error', 'Por favor ingresa el nombre de la empresa');
      return;
    }

    setModalFirmaVisible(true);
  };

  const limpiarFirma = () => {
    signatureRef.current?.clear();
  };

  const cancelarFirma = () => {
    setModalFirmaVisible(false);
    limpiarFirma();
  };

  const guardarFirmaYEnviarFormulario = (signatureData: string) => {
    setFirmaBase64(signatureData);
    setFormData(prev => ({
      ...prev,
      firma_supervisor: signatureData,
      nombre_firmante: user?.name || '',
      cedula_firmante: user?.cedula || '',
    }));
    setModalFirmaVisible(false);
    enviarFormulario(signatureData);
  };

  const enviarFormulario = async (firma: string) => {
    try {
      setSaving(true);
      const token = await getSecureItem('auth_token');

      // Transformar las áreas al formato esperado por el backend
      const areasArray = Object.keys(formData.areas).map(nombreArea => ({
        nombre: nombreArea,
        cumple: formData.areas[nombreArea].cumple,
        no_cumple: formData.areas[nombreArea].no_cumple,
        no_aplica: formData.areas[nombreArea].no_aplica,
        observaciones: formData.areas[nombreArea].observaciones,
        fotos: formData.areas[nombreArea].fotos,
      }));

      const payload = {
        registro_cliente_id: parseInt(params.registroId as string),
        consecutivo: formData.consecutivo,
        fecha_inspeccion: formData.fecha,
        areas_inspeccionadas: areasArray,
        observaciones_generales: formData.observaciones_generales,
        firma_supervisor: firma,
        nombre_firmante: user?.name,
        cedula_firmante: user?.cedula,
        latitud: null, // TODO: Obtener ubicación actual
        longitud: null, // TODO: Obtener ubicación actual
      };

      console.log('📤 Enviando formulario:', payload);

      const response = await axios.post(`${API_BASE}/formularios/inspeccion`, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.data.success) {
        Alert.alert(
          'Éxito',
          'Formulario de inspección guardado correctamente',
          [
            {
              text: 'Ver Detalles',
              onPress: () => router.push({
                pathname: '/formulario-inspeccion-supervision',
                params: {
                  id: response.data.data.id,
                  modo: 'visualizar',
                },
              }),
            },
            {
              text: 'Nueva Visita',
              onPress: () => router.replace('/formulario-inspeccion-supervision'),
            },
            {
              text: 'Volver',
              onPress: () => router.back(),
            },
          ]
        );
      }

       try {
      console.log('🔐 Iniciando tracking de formulario...');
      await startTracking(String(token), 'Formulario_Inpeccion');
      console.log('✅ Punto FORM_START enviado');

      const sessionId = `session_${Date.now()}`;
      //await startBackgroundTracking(String(token), sessionId);
      console.log('🎯 Tracking en background iniciado');
    } catch (trackingError) {
      console.warn('⚠️ Error al iniciar tracking:', trackingError);
    }
    } catch (error: any) {
      console.error('Error guardando formulario:', error);
      Alert.alert('Error', error.response?.data?.message || 'No se pudo guardar el formulario');
    } finally {
      setSaving(false);
    }
  };

  const abrirFotoEnModal = (url: string) => {
    setSelectedPhoto(url);
    setModalVisible(true);
  };

  const cerrarModal = () => {
    setModalVisible(false);
    setSelectedPhoto('');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.surface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Informe de Supervisión</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Información General */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📋 Información General</Text>
          
          <View style={styles.row}>
            <View style={styles.halfInput}>
              <Text style={styles.label}>Consecutivo</Text>
              <TextInput
                style={[styles.input, styles.readOnlyInput]}
                value={formData.consecutivo}
                editable={false}
              />
            </View>
            <View style={styles.halfInput}>
              <Text style={styles.label}>Fec1ha</Text>
              <TextInput
                style={[styles.input, styles.readOnlyInput]}
                value={formData.fecha}
                editable={false}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Empresa / Cliente *</Text>
            <TextInput
              style={styles.input}
              value={formData.empresa}
              onChangeText={(text) => setFormData(prev => ({ ...prev, empresa: text }))}
              placeholder="Nombre de la empresa"
              placeholderTextColor={COLORS.textSecondary}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Dirección *</Text>
            <TextInput
              style={styles.input}
              value={formData.direccion}
              onChangeText={(text) => setFormData(prev => ({ ...prev, direccion: text }))}
              placeholder="Dirección"
              placeholderTextColor={COLORS.textSecondary}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Ciudad *</Text>
            <TextInput
              style={styles.input}
              value={formData.ciudad}
              onChangeText={(text) => setFormData(prev => ({ ...prev, ciudad: text }))}
              placeholder="Ciudad"
              placeholderTextColor={COLORS.textSecondary}
            />
          </View>
        </View>

        {/* Áreas de Evaluación */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔍 ASPECTOS A EVALUAR</Text>
          <Text style={styles.sectionSubtitle}>
            Marque el estado de cada aspecto evaluado
          </Text>
          
          {AREAS_INSPECCION.map((area) => (
            <View key={area} style={styles.areaItem}>
              <Text style={styles.areaTitle}>{area}</Text>
              
              {/* Botones SI / NO / N/A */}
              <View style={styles.toggleGroup}>
                <TouchableOpacity
                  style={[
                    styles.toggleOption,
                    formData.areas[area]?.cumple && styles.toggleOptionActive,
                    formData.areas[area]?.cumple && { backgroundColor: COLORS.success },
                  ]}
                  onPress={() => handleAreaChange(area, 'cumple', !formData.areas[area]?.cumple)}
                >
                  <Text style={[
                    styles.toggleOptionText,
                    formData.areas[area]?.cumple && styles.toggleOptionTextActive
                  ]}>
                    ✓ CUMPLE
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.toggleOption,
                    formData.areas[area]?.no_cumple && styles.toggleOptionActive,
                    formData.areas[area]?.no_cumple && { backgroundColor: COLORS.danger },
                  ]}
                  onPress={() => handleAreaChange(area, 'no_cumple', !formData.areas[area]?.no_cumple)}
                >
                  <Text style={[
                    styles.toggleOptionText,
                    formData.areas[area]?.no_cumple && styles.toggleOptionTextActive
                  ]}>
                    ✗ NO CUMPLE
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.toggleOption,
                    formData.areas[area]?.no_aplica && styles.toggleOptionActive,
                    formData.areas[area]?.no_aplica && { backgroundColor: COLORS.textSecondary },
                  ]}
                  onPress={() => handleAreaChange(area, 'no_aplica', !formData.areas[area]?.no_aplica)}
                >
                  <Text style={[
                    styles.toggleOptionText,
                    formData.areas[area]?.no_aplica && styles.toggleOptionTextActive
                  ]}>
                    N/A
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Observaciones */}
              <TextInput
                style={styles.observacionesInput}
                value={formData.areas[area]?.observaciones || ''}
                onChangeText={(text) => handleAreaChange(area, 'observaciones', text)}
                placeholder="Observaciones (opcional)"
                placeholderTextColor={COLORS.textSecondary}
                multiline
                numberOfLines={2}
              />

              {/* Botón agregar foto */}
              <TouchableOpacity
                style={styles.addPhotoButton}
                onPress={() => mostrarOpcionesFoto(area)}
              >
                <Ionicons name="camera" size={20} color={COLORS.primary} />
                <Text style={styles.addPhotoButtonText}>Agregar foto evidencia</Text>
              </TouchableOpacity>

              {/* Fotos */}
              {formData.areas[area]?.fotos && formData.areas[area].fotos.length > 0 && (
                <View style={styles.fotosContainer}>
                  <Text style={styles.fotosLabel}>
                    📷 Fotos ({formData.areas[area].fotos.length})
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.fotosScroll}>
                    {formData.areas[area].fotos.map((foto, index) => {
                      const fotoUrl = normalizarUrlFoto(foto.url || foto.uri);
                      const imageKey = `${area}-${index}`;
                      const hasError = imageErrors[imageKey];
                      
                      return (
                        <View key={index} style={styles.fotoItem}>
                          <TouchableOpacity 
                            onPress={() => abrirFotoEnModal(fotoUrl)}
                            disabled={hasError}
                          >
                            {hasError ? (
                              <View style={[styles.fotoPreview, styles.fotoError]}>
                                <Ionicons name="image-outline" size={40} color={COLORS.textSecondary} />
                                <Text style={styles.fotoErrorText}>Error</Text>
                              </View>
                            ) : (
                              <Image 
                                source={{ uri: fotoUrl }} 
                                style={styles.fotoPreview}
                                onError={() => setImageErrors(prev => ({ ...prev, [imageKey]: true }))}
                              />
                            )}
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.deleteFotoButton}
                            onPress={() => eliminarFoto(area, index)}
                          >
                            <Ionicons name="close-circle" size={24} color={COLORS.danger} />
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </ScrollView>
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Insumos de Aseo */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🧴 INSUMOS DE ASEO, CAFETERÍA Y ALMACENAMIENTO</Text>
          <View style={styles.addButtonContainer}>
            <TouchableOpacity onPress={agregarInsumo} style={styles.addButton}>
              <Ionicons name="add-circle" size={20} color={COLORS.primary} />
              <Text style={styles.addButtonText}>Agregar Insumo</Text>
            </TouchableOpacity>
          </View>

          {formData.insumos.map((insumo, index) => (
            <View key={index} style={styles.insumoItem}>
              <View style={styles.insumoHeader}>
                <Text style={styles.insumoTitle}>Insumo {index + 1}</Text>
                <TouchableOpacity
                  onPress={() => eliminarInsumo(index)}
                  style={styles.deleteButton}
                >
                  <Ionicons name="trash-outline" size={16} color={COLORS.danger} />
                </TouchableOpacity>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Nombre del Insumo</Text>
                <TextInput
                  style={styles.input}
                  value={insumo.nombre}
                  onChangeText={(text) => handleInsumoChange(index, 'nombre', text)}
                  placeholder="Ej: Desinfectante"
                  placeholderTextColor={COLORS.textSecondary}
                />
              </View>

              <View style={styles.row}>
                <View style={styles.halfInput}>
                  <Text style={styles.label}>Marca</Text>
                  <TextInput
                    style={styles.input}
                    value={insumo.marca}
                    onChangeText={(text) => handleInsumoChange(index, 'marca', text)}
                    placeholder="Marca"
                    placeholderTextColor={COLORS.textSecondary}
                  />
                </View>
                <View style={styles.halfInput}>
                  <Text style={styles.label}>Cantidad</Text>
                  <TextInput
                    style={styles.input}
                    value={insumo.cantidad}
                    onChangeText={(text) => handleInsumoChange(index, 'cantidad', text)}
                    placeholder="0"
                    placeholderTextColor={COLORS.textSecondary}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.toggleGroup}>
                <TouchableOpacity
                  style={[
                    styles.toggleOption,
                    insumo.cumple && styles.toggleOptionActive,
                    insumo.cumple && { backgroundColor: COLORS.success },
                  ]}
                  onPress={() => handleInsumoChange(index, 'cumple', !insumo.cumple)}
                >
                  <Text style={[
                    styles.toggleOptionText,
                    insumo.cumple && styles.toggleOptionTextActive
                  ]}>
                    ✓ CUMPLE
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.toggleOption,
                    insumo.no_cumple && styles.toggleOptionActive,
                    insumo.no_cumple && { backgroundColor: COLORS.danger },
                  ]}
                  onPress={() => handleInsumoChange(index, 'no_cumple', !insumo.no_cumple)}
                >
                  <Text style={[
                    styles.toggleOptionText,
                    insumo.no_cumple && styles.toggleOptionTextActive
                  ]}>
                    ✗ NO CUMPLE
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.toggleOption,
                    insumo.no_aplica && styles.toggleOptionActive,
                    insumo.no_aplica && { backgroundColor: COLORS.textSecondary },
                  ]}
                  onPress={() => handleInsumoChange(index, 'no_aplica', !insumo.no_aplica)}
                >
                  <Text style={[
                    styles.toggleOptionText,
                    insumo.no_aplica && styles.toggleOptionTextActive
                  ]}>
                    N/A
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        {/* Observaciones Generales */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📝 Observaciones Generales</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={formData.observaciones_generales}
            onChangeText={(text) => setFormData(prev => ({ ...prev, observaciones_generales: text }))}
            placeholder="Observaciones generales de la visita..."
            placeholderTextColor={COLORS.textSecondary}
            multiline
            numberOfLines={4}
          />
        </View>

        {/* Firma */}
        {(formData.firma_supervisor || firmaBase64) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>✍️ Firma del Supervisor</Text>
            <View style={styles.firmaPreviewContainer}>
              <Image
                source={{ uri: formData.firma_supervisor || firmaBase64 }}
                style={styles.firmaPreview}
                resizeMode="contain"
              />
              <View style={styles.firmaInfoContainer}>
                {(formData.nombre_firmante || user?.name) && (
                  <Text style={styles.firmaInfo}>
                    <Text style={styles.firmaInfoLabel}>Firmante: </Text>
                    {formData.nombre_firmante || user?.name}
                  </Text>
                )}
                {(formData.cedula_firmante || user?.cedula) && (
                  <Text style={styles.firmaInfo}>
                    <Text style={styles.firmaInfoLabel}>Cédula: </Text>
                    {formData.cedula_firmante || user?.cedula}
                  </Text>
                )}
              </View>
            </View>
          </View>
        )}

        {/* Botón guardar */}
        <TouchableOpacity
          style={[styles.submitButton, saving && styles.submitButtonDisabled]}
          onPress={iniciarProcesoDeFirma}
          disabled={saving}
        >
          <Text style={styles.submitButtonText}>
            {saving ? 'Guardando...' : 'Firmar y Guardar Visita'}
          </Text>
        </TouchableOpacity>

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Modal Firma */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={modalFirmaVisible}
        onRequestClose={cancelarFirma}
      >
        <SafeAreaView style={styles.firmaModalContainer}>
          <View style={styles.firmaHeader}>
            <Text style={styles.firmaTitle}>Firma del Supervisor</Text>
            <Text style={styles.firmaSubtitle}>Por favor, firme en el área a continuación</Text>
          </View>

          <View style={styles.firmaCanvasContainer}>
            <SimpleSignaturePad
              ref={signatureRef}
              height={400}
              strokeColor="#000000"
              strokeWidth={3}
            />
          </View>

          <View style={styles.firmaButtonsContainer}>
            <TouchableOpacity
              style={[styles.firmaButton, styles.firmaButtonSecondary]}
              onPress={limpiarFirma}
            >
              <Ionicons name="refresh-outline" size={20} color={COLORS.primary} />
              <Text style={styles.firmaButtonTextSecondary}>Limpiar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.firmaButton, styles.firmaButtonDanger]}
              onPress={cancelarFirma}
            >
              <Ionicons name="close-outline" size={20} color={COLORS.danger} />
              <Text style={styles.firmaButtonTextDanger}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.firmaButton, styles.firmaButtonPrimary]}
              onPress={() => {
                if (signatureRef.current?.isEmpty()) {
                  Alert.alert('Error', 'Por favor firme antes de continuar');
                  return;
                }
                const signatureData = signatureRef.current?.toDataURL();
                if (signatureData) {
                  guardarFirmaYEnviarFormulario(signatureData);
                }
              }}
            >
              <Ionicons name="checkmark-outline" size={20} color={COLORS.surface} />
              <Text style={styles.firmaButtonTextPrimary}>Confirmar</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Modal Ver Foto */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={cerrarModal}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity 
            style={styles.modalBackground} 
            activeOpacity={1} 
            onPress={cerrarModal}
          >
            <View style={styles.modalContent}>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={cerrarModal}
              >
                <Ionicons name="close-circle" size={36} color={COLORS.surface} />
              </TouchableOpacity>
              
              <Image 
                source={{ uri: selectedPhoto }} 
                style={styles.fullSizeImage}
                resizeMode="contain"
              />
              
              <Text style={styles.modalHint}>
                Toca fuera de la imagen para cerrar
              </Text>
            </View>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.surface,
    flex: 1,
    textAlign: 'center',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: COLORS.surface,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.surface,
  },
  readOnlyInput: {
    backgroundColor: COLORS.surfaceSecondary,
    color: COLORS.textSecondary,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  areaItem: {
    marginBottom: 20,
    padding: 12,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  areaTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 12,
  },
  toggleGroup: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  toggleOption: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
  },
  toggleOptionActive: {
    borderColor: 'transparent',
  },
  toggleOptionText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  toggleOptionTextActive: {
    color: COLORS.surface,
  },
  observacionesInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.surface,
    marginBottom: 8,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  addPhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
    backgroundColor: COLORS.surface,
    gap: 8,
  },
  addPhotoButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  fotosContainer: {
    marginTop: 12,
  },
  fotosLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  fotosScroll: {
    marginHorizontal: -4,
  },
  fotoItem: {
    marginHorizontal: 4,
    position: 'relative',
  },
  fotoPreview: {
    width: 100,
    height: 100,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceSecondary,
  },
  fotoError: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  fotoErrorText: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  deleteFotoButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  addButtonContainer: {
    marginBottom: 16,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: COLORS.surface,
    borderWidth: 2,
    borderColor: COLORS.primary,
    gap: 8,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  insumoItem: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  insumoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  insumoTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.primary,
  },
  deleteButton: {
    padding: 8,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  firmaPreviewContainer: {
    alignItems: 'center',
    padding: 16,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 12,
  },
  firmaPreview: {
    width: '100%',
    height: 200,
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  firmaInfoContainer: {
    marginTop: 12,
    width: '100%',
  },
  firmaInfo: {
    fontSize: 14,
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  firmaInfoLabel: {
    fontWeight: '700',
  },
  submitButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    marginHorizontal: 16,
    marginTop: 24,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  submitButtonDisabled: {
    backgroundColor: COLORS.textSecondary,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.surface,
  },
  bottomPadding: {
    height: 32,
  },
  firmaModalContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  firmaHeader: {
    padding: 20,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  firmaTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.surface,
    marginBottom: 4,
  },
  firmaSubtitle: {
    fontSize: 14,
    color: COLORS.surface,
    opacity: 0.9,
  },
  firmaCanvasContainer: {
    flex: 1,
    margin: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  firmaButtonsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  firmaButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
  },
  firmaButtonPrimary: {
    backgroundColor: COLORS.success,
  },
  firmaButtonSecondary: {
    backgroundColor: COLORS.surface,
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  firmaButtonDanger: {
    backgroundColor: COLORS.surface,
    borderWidth: 2,
    borderColor: COLORS.danger,
  },
  firmaButtonTextPrimary: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.surface,
  },
  firmaButtonTextSecondary: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.primary,
  },
  firmaButtonTextDanger: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.danger,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
  },
  modalBackground: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 10,
  },
  fullSizeImage: {
    width: '100%',
    height: '80%',
  },
  modalHint: {
    position: 'absolute',
    bottom: 40,
    fontSize: 14,
    color: COLORS.surface,
    opacity: 0.7,
  },
});
