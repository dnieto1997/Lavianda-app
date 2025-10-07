import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { useAuth } from './_layout';
import { SvgXml } from 'react-native-svg';

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

interface EvaluacionServicio {
  id: number;
  consecutivo: string;
  registro_cliente_id: number;
  tipo_servicio: string;
  cliente_zona: string;
  telefono: string;
  direccion: string;
  ciudad: string;
  periodo_evaluar: string;
  fecha_evaluacion: string;
  evaluador: string;
  supervisor_asignado?: string;
  calificacion: string;
  observaciones?: string;
  firma_cliente_base64?: string;
  estado: string;
  fecha_creacion: string;
  created_at: string;
  updated_at: string;
  usuario?: {
    id: number;
    name: string;
    email: string;
  };
}

export default function EvaluacionServicioDetalle() {
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const [evaluacion, setEvaluacion] = useState<EvaluacionServicio | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id && user?.token) {
      cargarEvaluacion();
    }
  }, [id, user]);

  const cargarEvaluacion = async () => {
    try {
      console.log('🔍 Cargando evaluación de servicio ID:', id);
      setLoading(true);

      const response = await axios.get(
        `${API_BASE}/formularios/evaluacion-servicio/${id}`,
        {
          headers: {
            Authorization: `Bearer ${user?.token}`,
          },
        }
      );

      console.log('✅ Respuesta exitosa:', response.data);
      setEvaluacion(response.data.evaluacion);
    } catch (error: any) {
      console.error('❌ Error al cargar evaluación:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCalificacionColor = (calificacion: string) => {
    switch (calificacion) {
      case 'excelente':
        return COLORS.success;
      case 'muy_bueno':
        return '#66BB6A';
      case 'bueno':
        return COLORS.warning;
      case 'regular':
        return '#FF7043';
      case 'malo':
        return COLORS.error;
      default:
        return COLORS.textSecondary;
    }
  };

  const getCalificacionTexto = (calificacion: string) => {
    switch (calificacion) {
      case 'excelente':
        return 'EXCELENTE';
      case 'muy_bueno':
        return 'MUY BUENO';
      case 'bueno':
        return 'BUENO';
      case 'regular':
        return 'REGULAR';
      case 'malo':
        return 'MALO';
      default:
        return calificacion.toUpperCase();
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Cargando evaluación...</Text>
      </View>
    );
  }

  if (!evaluacion) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Ionicons name="alert-circle" size={64} color={COLORS.error} />
        <Text style={styles.errorText}>No se pudo cargar la evaluación</Text>
        <TouchableOpacity style={styles.button} onPress={() => router.back()}>
          <Text style={styles.buttonText}>Volver</Text>
        </TouchableOpacity>
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
        <Text style={styles.headerTitle}>Evaluación #{evaluacion.consecutivo}</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Información General */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>INFORMACIÓN GENERAL</Text>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Consecutivo:</Text>
            <Text style={styles.infoValue}>#{evaluacion.consecutivo}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Estado:</Text>
            <View
              style={[
                styles.badge,
                {
                  backgroundColor:
                    evaluacion.estado === 'completado' ? COLORS.success : COLORS.warning,
                },
              ]}
            >
              <Text style={styles.badgeText}>{evaluacion.estado.toUpperCase()}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Fecha de Creación:</Text>
            <Text style={styles.infoValue}>
              {new Date(evaluacion.fecha_creacion).toLocaleString('es-CO')}
            </Text>
          </View>

          {evaluacion.usuario && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Creado por:</Text>
              <Text style={styles.infoValue}>{evaluacion.usuario.name}</Text>
            </View>
          )}
        </View>

        {/* Tipo de Servicio */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>TIPO DE SERVICIO</Text>
          <Text style={styles.infoValue}>{evaluacion.tipo_servicio.toUpperCase()}</Text>
        </View>

        {/* Datos del Cliente */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>DATOS DEL CLIENTE</Text>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Cliente/Zona:</Text>
            <Text style={styles.infoValue}>{evaluacion.cliente_zona}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Teléfono:</Text>
            <Text style={styles.infoValue}>{evaluacion.telefono}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Dirección:</Text>
            <Text style={styles.infoValue}>{evaluacion.direccion}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Ciudad:</Text>
            <Text style={styles.infoValue}>{evaluacion.ciudad}</Text>
          </View>
        </View>

        {/* Datos de la Evaluación */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>DATOS DE LA EVALUACIÓN</Text>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Período Evaluado:</Text>
            <Text style={styles.infoValue}>{evaluacion.periodo_evaluar}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Fecha de Evaluación:</Text>
            <Text style={styles.infoValue}>{evaluacion.fecha_evaluacion}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Evaluador:</Text>
            <Text style={styles.infoValue}>{evaluacion.evaluador}</Text>
          </View>

          {evaluacion.supervisor_asignado && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Supervisor Asignado:</Text>
              <Text style={styles.infoValue}>{evaluacion.supervisor_asignado}</Text>
            </View>
          )}
        </View>

        {/* Calificación */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>CALIFICACIÓN DEL SERVICIO</Text>
          <View
            style={[
              styles.calificacionBadge,
              { backgroundColor: getCalificacionColor(evaluacion.calificacion) },
            ]}
          >
            <Text style={styles.calificacionText}>
              {getCalificacionTexto(evaluacion.calificacion)}
            </Text>
          </View>
        </View>

        {/* Observaciones */}
        {evaluacion.observaciones && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>OBSERVACIONES</Text>
            <Text style={styles.observaciones}>{evaluacion.observaciones}</Text>
          </View>
        )}

        {/* Firma del Cliente */}
        {evaluacion.firma_cliente_base64 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>FIRMA DEL CLIENTE</Text>
            <View style={styles.firmaContainer}>
              <SvgXml
                xml={atob(evaluacion.firma_cliente_base64.split(',')[1])}
                width="100%"
                height={150}
              />
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
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
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    color: COLORS.textPrimary,
    flex: 2,
    textAlign: 'right',
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.card,
  },
  calificacionBadge: {
    padding: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calificacionText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.card,
  },
  observaciones: {
    fontSize: 14,
    color: COLORS.textPrimary,
    lineHeight: 20,
  },
  firmaContainer: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 10,
    backgroundColor: COLORS.background,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  errorText: {
    marginTop: 10,
    fontSize: 16,
    color: COLORS.error,
    textAlign: 'center',
  },
  button: {
    marginTop: 20,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: COLORS.card,
    fontSize: 16,
    fontWeight: '600',
  },
});
