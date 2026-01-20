import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Image,
  Dimensions 
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { useAuth } from './_layout';
import { SvgXml } from 'react-native-svg';

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

interface AreaInspeccionada {
  area: string;
  item: string;
  evaluacion: 'cumple' | 'no_cumple' | 'no_aplica';
  observaciones?: string;
  fotos: string[];
}

interface Inspeccion {
  id: number;
  registro_cliente_id: number;
  consecutivo: string;
  user_id: number;
  fecha_inspeccion: string;
  areas_inspeccionadas: AreaInspeccionada[];
  observaciones_generales: string;
  estado: string;
  latitud: string | null;
  longitud: string | null;
  created_at: string;
  updated_at: string;
  firma_supervisor_base64?: string;
  nombre_supervisor?: string;
  cedula_supervisor?: string;
  fecha_firma_supervisor?: string;
  usuario?: {
    id: number;
    name: string;
    email: string;
  };
  registro_cliente?: {
    id: number;
    empresa_nombre: string;
    sede_nombre: string;
  };
}

export default function InspeccionDetalle() {
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const [inspeccion, setInspeccion] = useState<Inspeccion | null>(null);
  const [loading, setLoading] = useState(true);
  const screenWidth = Dimensions.get('window').width;
  const firmaWidth = screenWidth - 64; // 16px padding a cada lado
const firmaHeight = (firmaWidth * 150) / 300; // mantiene proporción original

  useEffect(() => {
   
    
    if (id && user?.token) {
      console.log('✅ Condiciones cumplidas, cargando inspección...');
      cargarInspeccion();
    } else {
      console.log('⚠️ Esperando condiciones:', {
        tieneId: !!id,
        tieneUser: !!user,
        tieneToken: !!user?.token
      });
    }
  }, [id, user]);

  const cargarInspeccion = async () => {
    if (!user?.token) {
      console.error('❌ No hay token disponible');
      Alert.alert('Error', 'No se encontró el token de autenticación');
      router.back();
      return;
    }

    try {
      setLoading(true);
      
      console.log('🔍 Cargando inspección ID:', id);

      const url = `${API_BASE}/formularios/inspeccion/${id}`;

      
      const response = await axios.get(url, {
        headers: { 
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 10000 // 10 segundos de timeout
      });

      console.log('✅ Respuesta exitosa:', response.data);

      if (response.data.success) {
        const inspeccionData = response.data.inspeccion;
        
        // Parsear areas_inspeccionadas si es string
        if (inspeccionData.areas_inspeccionadas && typeof inspeccionData.areas_inspeccionadas === 'string') {
          try {
            inspeccionData.areas_inspeccionadas = JSON.parse(inspeccionData.areas_inspeccionadas);
            console.log('✅ Areas inspeccionadas parseadas:', inspeccionData.areas_inspeccionadas.length, 'items');
          } catch (e) {
            console.error('❌ Error al parsear areas_inspeccionadas:', e);
            inspeccionData.areas_inspeccionadas = [];
          }
        }
        
        setInspeccion(inspeccionData);
      } else {
        throw new Error('Respuesta no exitosa del servidor');
      }
    } catch (error: any) {
      console.error('❌ Error al cargar inspección:', error);
      console.error('❌ Detalles del error:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        code: error.code
      });
      
      let errorMessage = 'No se pudo cargar la inspección';
      
      if (error.code === 'ECONNABORTED') {
        errorMessage = 'La petición tardó demasiado. Verifica tu conexión.';
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      Alert.alert('Error', errorMessage);
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const getEvaluacionColor = (evaluacion: string) => {
    switch (evaluacion) {
      case 'cumple':
        return COLORS.success;
      case 'no_cumple':
        return COLORS.error;
      case 'no_aplica':
        return COLORS.textSecondary;
      default:
        return COLORS.textSecondary;
    }
  };

  const getEvaluacionTexto = (evaluacion: string) => {
    switch (evaluacion) {
      case 'cumple':
        return 'SÍ CUMPLE';
      case 'no_cumple':
        return 'NO CUMPLE';
      case 'no_aplica':
        return 'N/A';
      default:
        return 'SIN EVALUAR';
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Cargando Informe de Supervision...</Text>
       
      </View>
    );
  }

  if (!inspeccion) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>No se pudo cargar la inspección</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backIcon}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Informe de Supervision</Text>
      </View>

      {/* Información General */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>INFORME DE SUPERVISIÓN </Text>
        
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Consecutivo:</Text>
          <Text style={styles.infoValue}>{inspeccion.consecutivo || 'Sin consecutivo'}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Inspector:</Text>
          <Text style={styles.infoValue}>{inspeccion.usuario?.name || 'Usuario desconocido'}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Fecha:</Text>
          <Text style={styles.infoValue}>
            {new Date(inspeccion.fecha_inspeccion).toLocaleDateString('es-CO', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Empresa:</Text>
          <Text style={styles.infoValue}>
            {inspeccion.registro_cliente?.empresa_nombre || 'Sin empresa'}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Sede:</Text>
          <Text style={styles.infoValue}>
            {inspeccion.registro_cliente?.sede_nombre || 'Sin sede'}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Estado:</Text>
          <View style={[styles.estadoBadge, { 
            backgroundColor: inspeccion.estado === 'completado' ? COLORS.success : COLORS.warning 
          }]}>
            <Text style={styles.estadoText}>{inspeccion.estado || 'pendiente'}</Text>
          </View>
        </View>
      </View>

      {/* Áreas Inspeccionadas */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>ÁREAS INSPECCIONADAS</Text>
        <Text style={styles.subtitle}>{inspeccion.areas_inspeccionadas?.length || 0} evaluaciones</Text>

        {inspeccion.areas_inspeccionadas && inspeccion.areas_inspeccionadas.map((area, index) => (
          <View key={index} style={styles.areaCard}>
            <View style={styles.areaHeader}>
              <Text style={styles.areaNumero}>{index + 1}</Text>
              <Text style={styles.areaNombre}>{area.item || area.area}</Text>
            </View>

            <View style={styles.evaluacionRow}>
              <Text style={styles.evaluacionLabel}>Evaluación:</Text>
              <View style={[styles.evaluacionBadge, { backgroundColor: getEvaluacionColor(area.evaluacion) }]}>
                <Text style={styles.evaluacionTexto}>{getEvaluacionTexto(area.evaluacion)}</Text>
              </View>
            </View>

            {area.observaciones && area.observaciones.trim() !== '' && (
              <View style={styles.observacionesContainer}>
                <Text style={styles.observacionesLabel}>Observaciones:</Text>
                <Text style={styles.observacionesTexto}>{area.observaciones}</Text>
              </View>
            )}

            {area.fotos && area.fotos.length > 0 && (
              <View style={styles.fotosContainer}>
                <Text style={styles.fotosLabel}>Evidencias fotográficas ({area.fotos.length}):</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.fotosScroll}>
                  {area.fotos.map((foto, fotoIndex) => (
                    <TouchableOpacity
                      key={fotoIndex}
                      style={styles.fotoThumbnail}
                      onPress={() => Alert.alert('Foto', 'Vista ampliada en desarrollo')}
                    >
                      <Image
                        source={{ uri: foto }}
                        style={styles.fotoImage}
                        resizeMode="cover"
                      />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>
        ))}
      </View>

      {/* Observaciones Generales */}
      {inspeccion.observaciones_generales && inspeccion.observaciones_generales.trim() !== '' && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>OBSERVACIONES GENERALES</Text>
          <Text style={styles.observacionesGeneralesTexto}>
            {inspeccion.observaciones_generales}
          </Text>
        </View>
      )}

      {/* Firma del Supervisor */}
      {inspeccion.firma_supervisor_base64 && (
  <View style={styles.card}>
    <Text style={styles.cardTitle}>FIRMA DEL SUPERVISOR</Text>

    {inspeccion.nombre_supervisor && (
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Nombre:</Text>
        <Text style={styles.infoValue}>{inspeccion.nombre_supervisor}</Text>
      </View>
    )}

    {inspeccion.cedula_supervisor && (
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Cédula:</Text>
        <Text style={styles.infoValue}>{inspeccion.cedula_supervisor}</Text>
      </View>
    )}

    {inspeccion.fecha_firma_supervisor && (
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Fecha de firma:</Text>
        <Text style={styles.infoValue}>
          {new Date(inspeccion.fecha_firma_supervisor).toLocaleString('es-CO')}
        </Text>
      </View>
    )}

    <View style={styles.firmaContainer}>
      {(() => {
        const paddingHorizontal = 32; // padding total del card
        const firmaWidth = screenWidth - paddingHorizontal;
        const firmaHeight = (firmaWidth * 150) / 250; // proporción 2:1 (original)
        return (
          <SvgXml
            xml={atob(inspeccion.firma_supervisor_base64.split(',')[1])}
            width={firmaWidth}
            height={firmaHeight}
          />
        );
      })()}
    </View>
  </View>
)}

      {/* Ubicación */}
      {(inspeccion.latitud || inspeccion.longitud) && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>UBICACIÓN</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Latitud:</Text>
            <Text style={styles.infoValue}>{inspeccion.latitud || 'N/A'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Longitud:</Text>
            <Text style={styles.infoValue}>{inspeccion.longitud || 'N/A'}</Text>
          </View>
        </View>
      )}

      {/* Metadatos */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>INFORMACIÓN DEL REGISTRO</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Creado:</Text>
          <Text style={styles.infoValue}>
            {new Date(inspeccion.created_at).toLocaleString('es-CO')}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Actualizado:</Text>
          <Text style={styles.infoValue}>
            {new Date(inspeccion.updated_at).toLocaleString('es-CO')}
          </Text>
        </View>
      </View>

      {/* Espaciado inferior */}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  loadingSubtext: {
    marginTop: 8,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: COLORS.error,
    textAlign: 'center',
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  backButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    backgroundColor: COLORS.primary,
    padding: 16,
    paddingTop: 60,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  backIcon: {
    marginRight: 16,
    color: "white",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: "white",
    flex: 1,
    textAlign: 'center',
  },
  card: {
    backgroundColor: COLORS.card,
    margin: 16,
    marginBottom: 0,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
    width: 120,
  },
  infoValue: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  estadoBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  estadoText: {
    color: COLORS.card,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  areaCard: {
    backgroundColor: COLORS.background,
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  areaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  areaNumero: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginRight: 12,
    width: 30,
    textAlign: 'center',
  },
  areaNombre: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  evaluacionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  evaluacionLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textSecondary,
    marginRight: 12,
  },
  evaluacionBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  evaluacionTexto: {
    color: COLORS.card,
    fontSize: 12,
    fontWeight: '600',
  },
  observacionesContainer: {
    marginTop: 8,
  },
  observacionesLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  observacionesTexto: {
    fontSize: 14,
    color: COLORS.textPrimary,
    lineHeight: 20,
  },
  observacionesGeneralesTexto: {
    fontSize: 14,
    color: COLORS.textPrimary,
    lineHeight: 22,
  },
  fotosContainer: {
    marginTop: 12,
  },
  fotosLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  fotosScroll: {
    marginTop: 4,
  },
  fotoThumbnail: {
    width: 100,
    height: 100,
    marginRight: 8,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  fotoImage: {
    width: '100%',
    height: '100%',
  },
  firmaContainer: {
  marginTop: 16,
  padding: 16,
  backgroundColor: COLORS.background,
  borderRadius: 8,
  borderWidth: 1,
  borderColor: COLORS.border,
  alignItems: 'center',
},
  firmaImage: {
    width: '100%',
    height: 300,
    maxWidth: 400,
  },
  debugText: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 8,
    fontFamily: 'monospace',
  },
});
