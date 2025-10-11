import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
  Alert,
} from 'react-native';
import { useAuth } from '../_layout';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';

// --- Interfaces ---
interface DashboardStats {
  total_formularios: number;
  formularios_hoy: number;
  formularios_semana: number;
  formularios_mes: number;
  cumplimiento_promedio: number;
  empresas_activas: number;
  usuarios_activos: number;
  
  // Nuevos campos para porcentajes reales
  porcentaje_cambio_diario: number;
  porcentaje_cambio_semanal: number;
  porcentaje_cambio_mensual: number;
  
  // Datos de comparación
  formularios_ayer: number;
  formularios_semana_anterior: number;
  formularios_mes_anterior: number;
  
  // Indicadores de tendencia
  tendencia_diaria: 'positiva' | 'negativa';
  tendencia_semanal: 'positiva' | 'negativa';
  tendencia_mensual: 'positiva' | 'negativa';
}

interface FormularioStats {
  fecha: string;
  total: number;
  cumple: number;
  no_cumple: number;
  no_aplica: number;
}

interface EmpresaStats {
  empresa_id: number;
  empresa_nombre: string;
  total_formularios: number;
  porcentaje_cumplimiento: number;
}

// --- Configuración ---
const API_BASE = 'https://operaciones.lavianda.com.co/api';
const { width } = Dimensions.get('window');

const COLORS = {
  primary: '#C62828',
  secondary: '#1976D2', 
  success: '#4CAF50',
  warning: '#FF9800',
  error: '#F44336',
  background: '#F5F5F5',
  card: '#FFFFFF',
  text: '#212121',
  textSecondary: '#757575',
  border: '#E0E0E0',
};

export default function DashboardScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [formularioStats, setFormularioStats] = useState<FormularioStats[]>([]);
  const [empresaStats, setEmpresaStats] = useState<EmpresaStats[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | '90d'>('30d');

  useEffect(() => {
    if (user?.token) {
      loadDashboardData();
    }
  }, [user?.token, selectedPeriod]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      console.log('🔍 Dashboard: Iniciando carga de datos...');
      console.log('🔑 Token presente:', user?.token ? 'SÍ' : 'NO');

      const headers = {
        'Authorization': `Bearer ${user?.token}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      };

      console.log('📡 Headers configurados para dashboard');

      // Cargar estadísticas principales
      try {
        console.log('📊 Solicitando estadísticas del dashboard...');
        const statsResponse = await axios.get(`${API_BASE}/dashboard/stats`, { 
          headers,
          timeout: 10000 
        });
        
        console.log('✅ Estadísticas recibidas:', statsResponse.data);
        setDashboardStats(statsResponse.data);
      } catch (statsError) {
        console.error('❌ Error al cargar estadísticas:', statsError);
        if (axios.isAxiosError(statsError)) {
          console.error('Status:', statsError.response?.status);
          console.error('Data:', statsError.response?.data);
        }
      }

      // Cargar estadísticas de formularios
      try {
        console.log('📈 Solicitando estadísticas de formularios...');
        const formStatsResponse = await axios.get(`${API_BASE}/dashboard/formularios-stats?period=${selectedPeriod}`, { 
          headers,
          timeout: 10000 
        });
        
        console.log('✅ Estadísticas de formularios recibidas:', formStatsResponse.data);
        setFormularioStats(Array.isArray(formStatsResponse.data) ? formStatsResponse.data : []);
      } catch (formError) {
        console.error('❌ Error al cargar estadísticas de formularios:', formError);
        setFormularioStats([]);
      }

      // Cargar estadísticas de empresas
      try {
        console.log('🏢 Solicitando estadísticas de empresas...');
        const empresasStatsResponse = await axios.get(`${API_BASE}/dashboard/empresas-stats`, { 
          headers,
          timeout: 10000 
        });
        
        console.log('✅ Estadísticas de empresas recibidas:', empresasStatsResponse.data);
        setEmpresaStats(Array.isArray(empresasStatsResponse.data) ? empresasStatsResponse.data : []);
      } catch (empresasError) {
        console.error('❌ Error al cargar estadísticas de empresas:', empresasError);
        setEmpresaStats([]);
      }

    } catch (error) {
      console.error('❌ Error general en loadDashboardData:', error);
      Alert.alert(
        'Error de Conexión',
        'No se pudieron cargar los datos del dashboard. Verifica tu conexión a internet.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
      console.log('🏁 Carga de dashboard completada');
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('es-CO').format(num);
  };

  const formatPercentage = (num: number) => {
    return `${num.toFixed(1)}%`;
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Cargando dashboard...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header Mejorado */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>📊 Dashboard Ejecutivo</Text>
            <Text style={styles.headerSubtitle}>Análisis en Tiempo Real</Text>
            <Text style={styles.headerDate}>
              {new Date().toLocaleDateString('es-CO', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={() => loadDashboardData()}
          >
            <Ionicons name="refresh" size={24} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Filtro de Período Mejorado */}
      <View style={styles.periodSelector}>
        <View style={styles.periodHeader}>
          <Ionicons name="calendar-outline" size={20} color={COLORS.primary} />
          <Text style={styles.sectionTitle}>Período de Análisis</Text>
        </View>
        <View style={styles.periodButtons}>
          {[
            { key: '7d', label: '7 días', icon: 'today-outline' },
            { key: '30d', label: '30 días', icon: 'calendar-outline' },
            { key: '90d', label: '90 días', icon: 'calendar-number-outline' },
          ].map((period) => (
            <TouchableOpacity
              key={period.key}
              style={[
                styles.periodButton,
                selectedPeriod === period.key && styles.periodButtonActive,
              ]}
              onPress={() => setSelectedPeriod(period.key as '7d' | '30d' | '90d')}
            >
              <Ionicons 
                name={period.icon as any} 
                size={16} 
                color={selectedPeriod === period.key ? 'white' : COLORS.primary} 
              />
              <Text style={[
                styles.periodButtonText,
                selectedPeriod === period.key && styles.periodButtonTextActive,
              ]}>
                {period.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Estadísticas Principales */}
      {dashboardStats && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="trending-up-outline" size={24} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Estadísticas Principales</Text>
          </View>
          
          {/* Primera Fila - 2 Columnas */}
          <View style={styles.statsRow}>
            <StatsCard
              title="Total Formularios"
              value={formatNumber(dashboardStats.total_formularios)}
              icon="document-text-outline"
              color={COLORS.primary}
              trend={`${dashboardStats.porcentaje_cambio_mensual >= 0 ? '+' : ''}${dashboardStats.porcentaje_cambio_mensual}%`}
              subtitle="vs mes anterior"
            />
            <StatsCard
              title="Formularios Hoy"
              value={formatNumber(dashboardStats.formularios_hoy)}
              icon="today-outline"
              color={COLORS.secondary}
              trend={`${dashboardStats.porcentaje_cambio_diario >= 0 ? '+' : ''}${dashboardStats.porcentaje_cambio_diario}%`}
              subtitle="vs ayer"
            />
          </View>

          {/* Segunda Fila - 2 Columnas */}
          <View style={styles.statsRow}>
            <StatsCard
              title="Esta Semana"
              value={formatNumber(dashboardStats.formularios_semana)}
              icon="calendar-outline"
              color={COLORS.success}
              trend={`${dashboardStats.porcentaje_cambio_semanal >= 0 ? '+' : ''}${dashboardStats.porcentaje_cambio_semanal}%`}
              subtitle="vs semana anterior"
            />
            <StatsCard
              title="Este Mes"
              value={formatNumber(dashboardStats.formularios_mes)}
              icon="calendar-number-outline"
              color={COLORS.warning}
              trend={`${dashboardStats.porcentaje_cambio_mensual >= 0 ? '+' : ''}${dashboardStats.porcentaje_cambio_mensual}%`}
              subtitle="vs mes anterior"
            />
          </View>

          {/* Tercera Fila - 2 Columnas */}
          <View style={styles.statsRow}>
            <StatsCard
              title="Cumplimiento"
              value={formatPercentage(dashboardStats.cumplimiento_promedio)}
              icon="checkmark-circle-outline"
              color={COLORS.success}
              trend={dashboardStats.tendencia_mensual === 'positiva' ? '+' + Math.abs(dashboardStats.porcentaje_cambio_mensual) + '%' : (dashboardStats.porcentaje_cambio_mensual === 0 ? 'estable' : dashboardStats.porcentaje_cambio_mensual + '%')}
              subtitle="promedio general"
              isPercentage={true}
            />
            <StatsCard
              title="Empresas Activas"
              value={formatNumber(dashboardStats.empresas_activas)}
              icon="business-outline"
              color={COLORS.secondary}
              trend="estable"
              subtitle="en el sistema"
            />
          </View>

          {/* Sección Explicativa de Porcentajes */}
          <View style={styles.explanationSection}>
            <View style={styles.sectionHeader}>
              <Ionicons name="information-circle-outline" size={24} color={COLORS.primary} />
              <Text style={styles.sectionTitle}>📈 Interpretación de Porcentajes</Text>
            </View>
            <View style={styles.explanationCard}>
              <Text style={styles.explanationTitle}>¿Qué significan los porcentajes?</Text>
              <View style={styles.explanationItem}>
                <Text style={styles.explanationLabel}>🟢 Porcentajes Positivos (+):</Text>
                <Text style={styles.explanationText}>Mejora respecto al período anterior</Text>
              </View>
              <View style={styles.explanationItem}>
                <Text style={styles.explanationLabel}>🔴 Porcentajes Negativos (-):</Text>
                <Text style={styles.explanationText}>Disminución respecto al período anterior</Text>
              </View>
              <View style={styles.explanationItem}>
                <Text style={styles.explanationLabel}>⚫ Estable:</Text>
                <Text style={styles.explanationText}>Sin cambios significativos</Text>
              </View>
              <View style={styles.explanationExample}>
                <Text style={styles.exampleTitle}>Ejemplo:</Text>
                <Text style={styles.exampleText}>
                  Si hoy tienes {dashboardStats?.formularios_hoy || 0} formularios y ayer tuviste {dashboardStats?.formularios_ayer || 0}, 
                  el cambio es de {dashboardStats?.porcentaje_cambio_diario >= 0 ? '+' : ''}{dashboardStats?.porcentaje_cambio_diario || 0}%
                </Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* Gráfico de Formularios por Fecha Mejorado */}
      {formularioStats.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="bar-chart-outline" size={24} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Tendencia de Formularios</Text>
          </View>
          <View style={styles.chartWrapper}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chartContainer}>
                {formularioStats.map((stat, index) => (
                  <View key={index} style={styles.chartBar}>
                    <View style={styles.barContainer}>
                      <View style={[styles.bar, styles.barCumple, { height: Math.max((stat.cumple / Math.max(...formularioStats.map(s => s.total))) * 100, 2) }]} />
                      <View style={[styles.bar, styles.barNoCumple, { height: Math.max((stat.no_cumple / Math.max(...formularioStats.map(s => s.total))) * 100, 2) }]} />
                      <View style={[styles.bar, styles.barNoAplica, { height: Math.max((stat.no_aplica / Math.max(...formularioStats.map(s => s.total))) * 100, 2) }]} />
                    </View>
                    <Text style={styles.chartLabel}>{new Date(stat.fecha).toLocaleDateString('es-CO', { month: 'short', day: 'numeric' })}</Text>
                    <Text style={styles.chartValue}>{stat.total}</Text>
                  </View>
                ))}
              </View>
            </ScrollView>
            <View style={styles.chartLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: COLORS.success }]} />
                <Text style={styles.legendText}>Cumple</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: COLORS.error }]} />
                <Text style={styles.legendText}>No Cumple</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: COLORS.warning }]} />
                <Text style={styles.legendText}>No Aplica</Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* Top Empresas */}
      {empresaStats.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="business-outline" size={24} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Top Empresas por Actividad</Text>
          </View>
          {empresaStats.slice(0, 5).map((empresa, index) => (
            <View key={empresa.empresa_id} style={styles.empresaItem}>
              <View style={styles.empresaRank}>
                <Text style={styles.rankNumber}>{index + 1}</Text>
              </View>
              <View style={styles.empresaInfo}>
                <Text style={styles.empresaNombre}>{empresa.empresa_nombre}</Text>
                <Text style={styles.empresaFormularios}>{empresa.total_formularios} formularios</Text>
              </View>
              <View style={styles.empresaCumplimiento}>
                <Text style={styles.cumplimientoText}>{empresa.porcentaje_cumplimiento.toFixed(1)}%</Text>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { 
                    width: `${empresa.porcentaje_cumplimiento}%`,
                    backgroundColor: empresa.porcentaje_cumplimiento >= 80 ? COLORS.success : 
                                   empresa.porcentaje_cumplimiento >= 60 ? COLORS.warning : COLORS.error
                  }]} />
                </View>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Última actualización: {new Date().toLocaleTimeString('es-CO')}</Text>
        <Text style={styles.footerText}>Dashboard v2.0</Text>
      </View>
    </ScrollView>
  );
}

// --- Componentes ---
interface StatsCardProps {
  title: string;
  value: string;
  icon: string;
  color: string;
  trend?: string;
  subtitle?: string;
  isPercentage?: boolean;
}

const StatsCard: React.FC<StatsCardProps> = ({ title, value, icon, color, trend, subtitle, isPercentage }) => (
  <View style={styles.statsCard}>
    <View style={styles.statsContent}>
      <View style={styles.statsHeader}>
        <Ionicons name={icon as any} size={24} color={color} />
        {trend && (
          <View style={[
            styles.trendBadge, 
            { backgroundColor: trend.includes('+') ? COLORS.success : trend === 'estable' ? COLORS.warning : COLORS.error }
          ]}>
            <Text style={styles.trendText}>{trend}</Text>
          </View>
        )}
      </View>
      <Text style={styles.statsTitle}>{title}</Text>
      <Text style={[styles.statsValue, { color }]}>{value}</Text>
      {subtitle && <Text style={styles.statsSubtitle}>{subtitle}</Text>}
    </View>
  </View>
);

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
  header: {
    backgroundColor: COLORS.primary,
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 4,
  },
  headerDate: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    textTransform: 'capitalize',
  },
  refreshButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
    padding: 10,
  },
  section: {
    backgroundColor: COLORS.card,
    margin: 15,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginLeft: 8,
  },
  periodSelector: {
    backgroundColor: COLORS.card,
    margin: 15,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  periodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  periodButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  periodButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  periodButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  periodButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
    marginLeft: 6,
  },
  periodButtonTextActive: {
    color: 'white',
  },
  
  // Estilos para filas de 2 columnas
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  statsCard: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    minHeight: 120,
  },
  statsContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  statsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  statsTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.textSecondary,
    marginBottom: 4,
    textAlign: 'center',
  },
  statsValue: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  statsSubtitle: {
    fontSize: 11,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  trendBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  trendText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
  },
  
  // Estilos para la sección explicativa
  explanationSection: {
    marginTop: 15,
  },
  explanationCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 20,
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  explanationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 15,
  },
  explanationItem: {
    flexDirection: 'column',
    marginBottom: 12,
  },
  explanationLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  explanationText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginLeft: 10,
  },
  explanationExample: {
    backgroundColor: COLORS.background,
    borderRadius: 8,
    padding: 12,
    marginTop: 10,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  exampleTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
    marginBottom: 6,
  },
  exampleText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  
  chartWrapper: {
    marginTop: 10,
  },
  chartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 10,
    height: 120,
  },
  chartBar: {
    alignItems: 'center',
    marginHorizontal: 8,
    minWidth: 40,
  },
  barContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 80,
    marginBottom: 8,
  },
  bar: {
    width: 8,
    marginHorizontal: 1,
    borderRadius: 2,
  },
  barCumple: {
    backgroundColor: COLORS.success,
  },
  barNoCumple: {
    backgroundColor: COLORS.error,
  },
  barNoAplica: {
    backgroundColor: COLORS.warning,
  },
  chartLabel: {
    fontSize: 10,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 2,
  },
  chartValue: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'center',
  },
  chartLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 10,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  empresaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  empresaRank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  rankNumber: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  empresaInfo: {
    flex: 1,
    marginRight: 15,
  },
  empresaNombre: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  empresaFormularios: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  empresaCumplimiento: {
    alignItems: 'flex-end',
    minWidth: 80,
  },
  cumplimientoText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 5,
  },
  progressBar: {
    width: 60,
    height: 6,
    backgroundColor: COLORS.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  footer: {
    padding: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 5,
  },
});
