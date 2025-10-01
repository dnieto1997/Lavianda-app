import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  ScrollView,
  RefreshControl,
  Share,
  Platform,
} from 'react-native';
import { useAuth } from '../_layout';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { router } from 'expo-router';
import { generatePDF, validatePDFData } from '../../services/pdfService';

// --- Configuración de la API ---
const API_BASE = 'https://operaciones.lavianda.com.co/api';

// --- Paleta de Colores ---
const COLORS = {
  primary: '#C62828',
  background: '#E3F2FD',
  card: '#FFFFFF',
  textPrimary: '#212121',
  textSecondary: '#757575',
  success: '#4CAF50',
  warning: '#FF9800',
  error: '#F44336',
  border: '#E0E0E0',
};

// --- Interfaces ---
interface Empresa {
  id: number;
  nombre: string;
  centro_costo: string;
  identificacion?: string; // NIT o cédula
  created_at: string;
  updated_at: string;
}

interface RegistroCliente {
  id: number;
  empresa_id: number;
  empresa_nombre: string;
  supervisor?: string;
  supervisor_email?: string;
  fecha_creacion: string;
  creado_por: string;
  creado_por_email?: string;
  created_at: string;
  updated_at: string;
  formularios_count?: number; // Número de formularios asociados
  ultimo_formulario?: string; // Fecha del último formulario
}

interface FormularioData {
  id: number;
  registro_cliente_id: number;
  empresa_nombre: string;
  usuario_nombre: string;
  fecha_creacion: string;
  ubicacion?: string;
  observaciones?: string;
  estado?: string;
  [key: string]: any; // Campos dinámicos del formulario
}

export default function OperacionesScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Estados para empresas
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [showEmpresaModal, setShowEmpresaModal] = useState(false);
  const [editingEmpresa, setEditingEmpresa] = useState<Empresa | null>(null);
  const [empresaForm, setEmpresaForm] = useState({
    nombre: '',
    centro_costo: '',
    identificacion: '',
  });

  // Estados para registros de clientes
  const [registrosClientes, setRegistrosClientes] = useState<RegistroCliente[]>([]);
  const [showRegistroModal, setShowRegistroModal] = useState(false);
  const [empresaSeleccionada, setEmpresaSeleccionada] = useState<Empresa | null>(null);
  const [showEmpresaSelector, setShowEmpresaSelector] = useState(false);

  // Estados para formularios
  const [formularios, setFormularios] = useState<FormularioData[]>([]);
  const [showFormulariosModal, setShowFormulariosModal] = useState(false);
  const [registroSeleccionado, setRegistroSeleccionado] = useState<RegistroCliente | null>(null);

  // Estados de carga
  const [savingEmpresa, setSavingEmpresa] = useState(false);
  const [savingRegistro, setSavingRegistro] = useState(false);
  const [loadingFormularios, setLoadingFormularios] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);

  // Verificar permisos de administrador
  const isAdmin = user?.userData?.role === 'admin' || user?.userData?.role === 'root';

  useEffect(() => {
    loadData();
  }, []);

  // --- FUNCIONES DE CARGA ---
  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadEmpresas(),
        loadRegistrosClientes()
        // Removemos loadFormularios() de aquí porque se carga según demanda
      ]);
    } catch (error) {
      console.error('Error al cargar datos:', error);
      Alert.alert('Error', 'No se pudieron cargar los datos');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadEmpresas = async () => {
    try {
      const response = await axios.get(`${API_BASE}/empresas`, {
        headers: { 'Authorization': `Bearer ${user?.token}` }
      });
      setEmpresas(response.data);
    } catch (error) {
      console.error('Error al cargar empresas:', error);
    }
  };

  const loadRegistrosClientes = async () => {
    try {
      const response = await axios.get(`${API_BASE}/registros-clientes`, {
        headers: { 'Authorization': `Bearer ${user?.token}` }
      });
      
      // Si el usuario es admin o root, mostrar todos los registros
      if (isAdmin) {
        setRegistrosClientes(response.data);
      } else {
        // Si es empleado/supervisor, filtrar solo los registros asignados
        const registrosFiltrados = response.data.filter((registro: RegistroCliente) => {
          const supervisorRegistro = typeof registro.supervisor === 'string' ? registro.supervisor.toLowerCase().trim() : '';
          const supervisorEmailRegistro = typeof registro.supervisor_email === 'string' ? registro.supervisor_email.toLowerCase().trim() : '';
          const creadoPorRegistro = typeof registro.creado_por === 'string' ? registro.creado_por.toLowerCase().trim() : '';
          const creadoPorEmailRegistro = typeof registro.creado_por_email === 'string' ? registro.creado_por_email.toLowerCase().trim() : '';
          const nombreUsuario = user?.userData?.name ? user.userData.name.toLowerCase().trim() : '';
          const emailUsuario = user?.userData?.email ? user.userData.email.toLowerCase().trim() : '';
          
          // El registro es accesible si:
          // 1. El usuario es el supervisor asignado (por nombre o email)
          // 2. El usuario es quien creó el registro (por nombre o email)
          const match = supervisorRegistro === nombreUsuario || 
                 supervisorEmailRegistro === emailUsuario ||
                 creadoPorRegistro === nombreUsuario ||
                 creadoPorEmailRegistro === emailUsuario;
                 creadoPorRegistro === emailUsuario;
                 
          // Log detallado para cada registro
          console.log(`� Analizando registro ${registro.id}:`, {
            empresa: registro.empresa_nombre,
            supervisor_original: registro.supervisor,
            supervisor_procesado: supervisorRegistro,
            creado_por_original: registro.creado_por,
            creado_por_procesado: creadoPorRegistro,
            nombre_usuario: nombreUsuario,
            email_usuario: emailUsuario,
            match_supervisor_nombre: supervisorRegistro === nombreUsuario,
            match_creado_por_nombre: creadoPorRegistro === nombreUsuario,
            match_supervisor_email: supervisorRegistro === emailUsuario,
            match_creado_por_email: creadoPorRegistro === emailUsuario,
            RESULTADO: match ? '✅ INCLUIDO' : '❌ EXCLUIDO'
          });
          
          return match;
        });
        
        // Debug: Mostrar todos los registros recibidos
        console.log('🔍 Todos los registros recibidos:', response.data.length);
        response.data.forEach((registro: RegistroCliente, index: number) => {
          console.log(`📋 Registro ${index + 1}:`, {
            id: registro.id,
            empresa: registro.empresa_nombre,
            supervisor: registro.supervisor,
            supervisor_tipo: typeof registro.supervisor,
            creado_por: registro.creado_por,
            creado_por_tipo: typeof registro.creado_por,
          });
        });
        
        console.log('👤 Datos del usuario actual:', {
          name: user?.userData?.name,
          name_tipo: typeof user?.userData?.name,
          email: user?.userData?.email,
          email_tipo: typeof user?.userData?.email,
          role: user?.userData?.role,
        });
        
        console.log('📊 Registros filtrados para usuario:', {
          usuario: user?.userData?.name,
          totalRegistros: response.data.length,
          registrosAsignados: registrosFiltrados.length
        });
        
        setRegistrosClientes(registrosFiltrados);
      }
    } catch (error) {
      console.error('Error al cargar registros de clientes:', error);
    }
  };

  const loadFormularios = async () => {
    try {
      // Usar el endpoint correcto que acabamos de crear
      const response = await axios.get(`${API_BASE}/formularios-acta-inicio`, {
        headers: { 'Authorization': `Bearer ${user?.token}` }
      });
      setFormularios(response.data);
    } catch (error) {
      console.error('Error al cargar formularios:', error);
      // Si el endpoint falla, inicializamos con array vacío
      setFormularios([]);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // --- FUNCIONES CRUD EMPRESAS ---
  const openEmpresaModal = (empresa?: Empresa) => {
    if (empresa) {
      setEditingEmpresa(empresa);
      setEmpresaForm({
        nombre: empresa.nombre,
        centro_costo: empresa.centro_costo,
        identificacion: empresa.identificacion || '',
      });
    } else {
      setEditingEmpresa(null);
      setEmpresaForm({
        nombre: '',
        centro_costo: '',
        identificacion: '',
      });
    }
    setShowEmpresaModal(true);
  };

  const closeEmpresaModal = () => {
    setShowEmpresaModal(false);
    setEditingEmpresa(null);
    setSavingEmpresa(false);
  };

  const saveEmpresa = async () => {
    if (!empresaForm.nombre.trim() || !empresaForm.centro_costo.trim()) {
      Alert.alert('Error', 'Todos los campos son obligatorios');
      return;
    }

    setSavingEmpresa(true);
    try {
      const url = editingEmpresa 
        ? `${API_BASE}/empresas/${editingEmpresa.id}`
        : `${API_BASE}/empresas`;
      
      const method = editingEmpresa ? 'put' : 'post';
      
      const response = await axios[method](url, empresaForm, {
        headers: { 'Authorization': `Bearer ${user?.token}` }
      });

      Alert.alert(
        'Éxito', 
        `Empresa ${editingEmpresa ? 'actualizada' : 'creada'} correctamente`
      );
      
      closeEmpresaModal();
      // Esperar un momento antes de recargar para asegurar que el backend procese
      setTimeout(() => {
        loadEmpresas();
      }, 100);
    } catch (error: any) {
      console.error('Error al guardar empresa:', error);
      const errorMessage = error.response?.data?.message || 'No se pudo guardar la empresa';
      Alert.alert('Error', errorMessage);
    } finally {
      setSavingEmpresa(false);
    }
  };

  const deleteEmpresa = (empresa: Empresa) => {
    Alert.alert(
      'Confirmar eliminación',
      `¿Estás seguro de que deseas eliminar la empresa "${empresa.nombre}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await axios.delete(`${API_BASE}/empresas/${empresa.id}`, {
                headers: { 'Authorization': `Bearer ${user?.token}` }
              });
              Alert.alert('Éxito', 'Empresa eliminada correctamente');
              // Esperar un momento antes de recargar
              setTimeout(() => {
                loadEmpresas();
              }, 100);
            } catch (error: any) {
              console.error('Error al eliminar empresa:', error);
              let errorMessage = 'No se pudo eliminar la empresa';
              
              if (error.response?.status === 422) {
                errorMessage = 'No se puede eliminar esta empresa porque está siendo utilizada en registros de clientes. Elimina primero los registros asociados.';
              } else if (error.response?.status === 404) {
                errorMessage = 'La empresa no existe o ya fue eliminada.';
              } else if (error.response?.status === 403) {
                errorMessage = 'No tienes permisos para eliminar esta empresa.';
              } else if (error.response?.data?.message) {
                errorMessage = error.response.data.message;
              }
              
              Alert.alert('Error', errorMessage);
            }
          }
        }
      ]
    );
  };

  // --- FUNCIONES REGISTRO CLIENTE ---
  const openRegistroModal = () => {
    setShowEmpresaSelector(true);
  };

  const seleccionarEmpresa = (empresa: Empresa) => {
    setEmpresaSeleccionada(empresa);
    setShowEmpresaSelector(false);
    setShowRegistroModal(true);
  };

  const guardarRegistroCliente = async () => {
    if (!empresaSeleccionada) {
      Alert.alert('Error', 'Debe seleccionar una empresa/cliente');
      return;
    }

    setSavingRegistro(true);
    try {
      await axios.post(`${API_BASE}/registros-clientes`, {
        empresa_id: empresaSeleccionada.id,
      }, {
        headers: { 'Authorization': `Bearer ${user?.token}` }
      });

      Alert.alert('Éxito', 'Registro de cliente creado correctamente');
      setShowRegistroModal(false);
      setEmpresaSeleccionada(null);
      loadRegistrosClientes();
    } catch (error) {
      console.error('Error al crear registro:', error);
      Alert.alert('Error', 'No se pudo crear el registro de cliente');
    } finally {
      setSavingRegistro(false);
    }
  };

  // --- FUNCIONES DE UTILIDAD ---
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // --- Función para navegar al detalle del registro ---
  // --- Función para navegar al detalle del registro ---
  const goToRegistroDetalle = (registro: RegistroCliente) => {
    console.log('🚀 Navegando a registro detalle:', registro.id);
    try {
      router.push({
        pathname: '/registro-detalle',
        params: {
          registroId: registro.id.toString(),
          empresaNombre: registro.empresa_nombre,
        },
      });
    } catch (error) {
      console.error('❌ Error en navegación a registro detalle:', error);
      Alert.alert('Error', 'No se pudo abrir el detalle del registro');
    }
  };

  // --- FUNCIONES PARA FORMULARIOS ---
  const crearFormularioActa = (registro: RegistroCliente) => {
    console.log('📋 Creando formulario para registro:', registro.id);
    try {
      router.push({
        pathname: '/formulario-acta-inicio',
        params: {
          registroId: registro.id.toString(),
          empresaId: registro.empresa_id.toString(),
          empresaNombre: registro.empresa_nombre,
        },
      });
    } catch (error) {
      console.error('❌ Error en navegación a formulario:', error);
      Alert.alert('Error', 'No se pudo abrir el formulario');
    }
  };

  const verFormulariosRegistro = async (registro: RegistroCliente) => {
    setRegistroSeleccionado(registro);
    setLoadingFormularios(true);
    setShowFormulariosModal(true);

    try {
      // Usar el endpoint correcto con filtro por registro_id
      const response = await axios.get(`${API_BASE}/formularios-acta-inicio?registro_id=${registro.id}`, {
        headers: { 'Authorization': `Bearer ${user?.token}` }
      });
      
      setFormularios(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error al cargar formularios del registro:', error);
      Alert.alert('Error', 'No se pudieron cargar los formularios');
      setFormularios([]);
    } finally {
      setLoadingFormularios(false);
    }
  };

  // --- FUNCIONES PARA PDF ---
  const generarPDFFormulario = async (formulario: FormularioData) => {
    try {
      setGeneratingPDF(true);
      
      // Validar datos antes de generar PDF
      const validation = validatePDFData(formulario);
      if (!validation.isValid) {
        Alert.alert('Error', `Datos incompletos: ${validation.errors.join(', ')}`);
        return;
      }

      await generatePDF(formulario, {
        title: `Formulario de Acta de Inicio - ${formulario.empresa_nombre}`,
        companyName: 'La Vianda - Operaciones',
        includeHeader: true,
        includeFooter: true,
      });

      Alert.alert('Éxito', 'PDF generado correctamente');
    } catch (error) {
      console.error('Error al generar PDF:', error);
      Alert.alert('Error', 'No se pudo generar el PDF');
    } finally {
      setGeneratingPDF(false);
    }
  };

  const compartirDatosRegistro = async (registro: RegistroCliente) => {
    try {
      const message = `
📋 Registro de Cliente - La Vianda

🏢 Empresa: ${typeof registro.empresa_nombre === 'string' ? registro.empresa_nombre : 'Sin nombre'}
🆔 ID Registro: ${registro.id}
👤 Supervisor: ${typeof registro.supervisor === 'string' ? registro.supervisor : 'Sin asignar'}
📅 Fecha: ${formatDate(registro.fecha_creacion)}
👥 Creado por: ${typeof registro.creado_por === 'string' ? registro.creado_por : 'Desconocido'}

Formularios: ${registro.formularios_count || 0}
${registro.ultimo_formulario ? `Último formulario: ${formatDate(registro.ultimo_formulario)}` : ''}
      `.trim();

      if (Platform.OS === 'web') {
        // En web, copiar al portapapeles
        await navigator.clipboard.writeText(message);
        Alert.alert('Éxito', 'Datos copiados al portapapeles');
      } else {
        // En móvil, usar Share API
        await Share.share({
          message: message,
          title: 'Datos del Registro - La Vianda',
        });
      }
    } catch (error) {
      console.error('Error al compartir:', error);
      Alert.alert('Error', 'No se pudieron compartir los datos');
    }
  };

  // --- COMPONENTES DE RENDERIZADO ---
  const renderEmpresaCard = ({ item }: { item: Empresa }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.empresaInfo}>
          <Text style={styles.empresaNombre}>
            {typeof item.nombre === 'string' ? item.nombre : 'Empresa sin nombre'}
          </Text>
          <Text style={styles.empresaCentro}>
            Centro de costo: {typeof item.centro_costo === 'string' ? item.centro_costo : 'Sin centro'}
          </Text>
          {item.identificacion && (
            <Text style={styles.empresaIdentificacion}>
              NIT/Cédula: {typeof item.identificacion === 'string' ? item.identificacion : 'Sin identificación'}
            </Text>
          )}
          <Text style={styles.empresaId}>ID: {item.id}</Text>
        </View>
        {isAdmin && (
          <View style={styles.cardActions}>
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: COLORS.warning }]}
              onPress={() => openEmpresaModal(item)}
            >
              <Ionicons name="pencil" size={16} color="white" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: COLORS.error }]}
              onPress={() => deleteEmpresa(item)}
            >
              <Ionicons name="trash" size={16} color="white" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );

  const renderRegistroCard = ({ item }: { item: RegistroCliente }) => (
    <View style={styles.registroCard}>
      <View style={styles.registroInfo}>
        <Text style={styles.registroEmpresa}>
          {typeof item.empresa_nombre === 'string' ? item.empresa_nombre : 'Empresa sin nombre'}
        </Text>
        <Text style={styles.registroId}>ID: {item.id}</Text>
        <Text style={styles.registroSupervisor}>
          Supervisor: {typeof item.supervisor === 'string' ? item.supervisor : 'Sin asignar'}
        </Text>
        <Text style={styles.registroFecha}>
          Creado: {formatDate(item.fecha_creacion)}
        </Text>
        <Text style={styles.registroCreador}>
          Por: {typeof item.creado_por === 'string' ? item.creado_por : 'Desconocido'}
        </Text>
        {item.formularios_count !== undefined && (
          <Text style={styles.registroFormularios}>
            📋 Formularios: {item.formularios_count}
          </Text>
        )}
        {item.ultimo_formulario && (
          <Text style={styles.registroUltimo}>
            📅 Último: {formatDate(item.ultimo_formulario)}
          </Text>
        )}
      </View>
      
      <View style={styles.registroActions}>
        {/* Botón principal - Entrar */}
        <TouchableOpacity 
          style={styles.entrarButton}
          onPress={() => goToRegistroDetalle(item)}
        >
          <Ionicons name="enter-outline" size={16} color="white" />
          <Text style={styles.entrarButtonText}>ENTRAR</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading && empresas.length === 0 && registrosClientes.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Operaciones</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Cargando datos...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Operaciones</Text>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
          <Ionicons name="refresh" size={20} color="white" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Sección Empresas/Clientes - Solo Admin */}
        {isAdmin && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Empresas/Clientes</Text>
              <TouchableOpacity 
                style={styles.createButton}
                onPress={() => openEmpresaModal()}
              >
                <Ionicons name="add" size={18} color="white" />
                <Text style={styles.createButtonText}>CREAR EMPRESA/CLIENTE</Text>
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={empresas}
              keyExtractor={(item) => `empresa-${item.id}`}
              renderItem={renderEmpresaCard}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
            />
          </View>
        )}

        {/* Sección Registros de Clientes */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Registros de Clientes</Text>
            {/* Solo mostrar botón crear registro a administradores */}
            {isAdmin && (
              <TouchableOpacity 
                style={styles.createButton}
                onPress={openRegistroModal}
              >
                <Ionicons name="document-text" size={18} color="white" />
                <Text style={styles.createButtonText}>CREAR REGISTRO CLIENTE</Text>
              </TouchableOpacity>
            )}
          </View>
          
          <FlatList
            data={registrosClientes}
            keyExtractor={(item) => `registro-${item.id}`}
            renderItem={renderRegistroCard}
            scrollEnabled={false}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="document-outline" size={64} color={COLORS.textSecondary} />
                <Text style={styles.emptyText}>
                  {isAdmin ? 'No hay registros de clientes' : 'No tienes registros asignados'}
                </Text>
              </View>
            }
          />
        </View>
      </ScrollView>

      {/* Modal Crear/Editar Empresa */}
      <Modal
        visible={showEmpresaModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={closeEmpresaModal} disabled={savingEmpresa}>
              <Ionicons name="close" size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {editingEmpresa ? 'Editar Empresa' : 'Nueva Empresa/Cliente'}
            </Text>
            <TouchableOpacity 
              onPress={saveEmpresa} 
              disabled={savingEmpresa}
              style={[styles.saveButton, savingEmpresa && styles.saveButtonDisabled]}
            >
              {savingEmpresa ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text style={styles.saveButtonText}>Guardar</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Nombre *</Text>
              <TextInput
                style={styles.textInput}
                value={empresaForm.nombre}
                onChangeText={(text) => setEmpresaForm({...empresaForm, nombre: text})}
                placeholder="Ingrese el nombre de la empresa/cliente"
                editable={!savingEmpresa}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Centro de Costo *</Text>
              <TextInput
                style={styles.textInput}
                value={empresaForm.centro_costo}
                onChangeText={(text) => setEmpresaForm({...empresaForm, centro_costo: text})}
                placeholder="Ingrese el centro de costo"
                editable={!savingEmpresa}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Identificación (NIT/Cédula)</Text>
              <TextInput
                style={styles.textInput}
                value={empresaForm.identificacion}
                onChangeText={(text) => setEmpresaForm({...empresaForm, identificacion: text})}
                placeholder="Ingrese el NIT de la empresa o número de cédula"
                editable={!savingEmpresa}
              />
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Modal Selector de Empresa */}
      <Modal
        visible={showEmpresaSelector}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowEmpresaSelector(false)}>
              <Ionicons name="close" size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Seleccionar Empresa/Cliente</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={styles.modalContent}>
            {empresas.map((empresa) => (
              <TouchableOpacity
                key={empresa.id}
                style={styles.empresaSelectorItem}
                onPress={() => seleccionarEmpresa(empresa)}
              >
                <View>
                  <Text style={styles.empresaSelectorNombre}>
                    {typeof empresa.nombre === 'string' ? empresa.nombre : 'Empresa sin nombre'}
                  </Text>
                  <Text style={styles.empresaSelectorInfo}>
                    Centro de costo: {typeof empresa.centro_costo === 'string' ? empresa.centro_costo : 'Sin centro'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* Modal Confirmación Registro */}
      <Modal
        visible={showRegistroModal}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModalContent}>
            <Text style={styles.confirmTitle}>Crear Registro de Cliente</Text>
            <Text style={styles.confirmText}>
              ¿Deseas crear un registro para la empresa/cliente:
            </Text>
            <Text style={styles.confirmEmpresa}>
              {typeof empresaSeleccionada?.nombre === 'string' ? empresaSeleccionada.nombre : 'Empresa sin nombre'}
            </Text>
            
            <View style={styles.confirmButtons}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => {
                  setShowRegistroModal(false);
                  setEmpresaSeleccionada(null);
                }}
                disabled={savingRegistro}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.confirmButton, savingRegistro && styles.confirmButtonDisabled]}
                onPress={guardarRegistroCliente}
                disabled={savingRegistro}
              >
                {savingRegistro ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.confirmButtonText}>GUARDAR DATOS</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Formularios del Registro */}
      <Modal
        visible={showFormulariosModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowFormulariosModal(false)}>
              <Ionicons name="close" size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              Formularios - {registroSeleccionado?.empresa_nombre}
            </Text>
            <TouchableOpacity 
              onPress={() => {
                setShowFormulariosModal(false);
                if (registroSeleccionado) {
                  crearFormularioActa(registroSeleccionado);
                }
              }}
              style={styles.addFormularioButton}
            >
              <Ionicons name="add" size={20} color="white" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {loadingFormularios ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.loadingText}>Cargando formularios...</Text>
              </View>
            ) : formularios.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="document-outline" size={64} color={COLORS.textSecondary} />
                <Text style={styles.emptyText}>No hay formularios creados</Text>
                <TouchableOpacity 
                  style={styles.createFirstFormButton}
                  onPress={() => {
                    setShowFormulariosModal(false);
                    if (registroSeleccionado) {
                      crearFormularioActa(registroSeleccionado);
                    }
                  }}
                >
                  <Ionicons name="document-text-outline" size={20} color="white" />
                  <Text style={styles.createFirstFormButtonText}>CREAR PRIMER FORMULARIO</Text>
                </TouchableOpacity>
              </View>
            ) : (
              formularios.map((formulario, index) => (
                <View key={formulario.id} style={styles.formularioItem}>
                  <View style={styles.formularioHeader}>
                    <View style={styles.formularioInfo}>
                      <Text style={styles.formularioTitle}>
                        📋 Formulario #{formulario.id}
                      </Text>
                      <Text style={styles.formularioDate}>
                        {formatDate(formulario.fecha_creacion)}
                      </Text>
                      <Text style={styles.formularioUser}>
                        👤 {typeof formulario.usuario_nombre === 'string' ? formulario.usuario_nombre : 'Usuario'}
                      </Text>
                      {formulario.ubicacion && (
                        <Text style={styles.formularioLocation}>
                          📍 {typeof formulario.ubicacion === 'string' ? formulario.ubicacion : 'Ubicación'}
                        </Text>
                      )}
                    </View>
                    
                    <View style={styles.formularioActions}>
                      <TouchableOpacity 
                        style={[styles.formularioActionBtn, { backgroundColor: COLORS.primary }]}
                        onPress={() => generarPDFFormulario(formulario)}
                        disabled={generatingPDF}
                      >
                        {generatingPDF ? (
                          <ActivityIndicator size="small" color="white" />
                        ) : (
                          <Ionicons name="download-outline" size={16} color="white" />
                        )}
                      </TouchableOpacity>
                      
                      <TouchableOpacity 
                        style={[styles.formularioActionBtn, { backgroundColor: COLORS.warning }]}
                        onPress={() => {
                          // Navegar a editar formulario
                          router.push({
                            pathname: '/formulario-acta-inicio',
                            params: {
                              formularioId: formulario.id.toString(),
                              registroId: formulario.registro_cliente_id.toString(),
                              empresaNombre: formulario.empresa_nombre,
                              mode: 'edit',
                            },
                          });
                        }}
                      >
                        <Ionicons name="pencil-outline" size={16} color="white" />
                      </TouchableOpacity>
                    </View>
                  </View>
                  
                  {formulario.observaciones && (
                    <View style={styles.formularioObservaciones}>
                      <Text style={styles.observacionesLabel}>💬 Observaciones:</Text>
                      <Text style={styles.observacionesText}>
                        {typeof formulario.observaciones === 'string' ? formulario.observaciones : 'Sin observaciones'}
                      </Text>
                    </View>
                  )}
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    backgroundColor: COLORS.primary,
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  refreshButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  createButton: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  createButtonText: {
    color: 'white',
    fontWeight: '600',
    marginLeft: 6,
    fontSize: 12,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  empresaInfo: {
    flex: 1,
  },
  empresaNombre: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  empresaCentro: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  empresaIdentificacion: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 2,
    fontWeight: '500',
  },
  empresaId: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    borderRadius: 6,
    padding: 8,
    backgroundColor: 'rgba(198, 40, 40, 0.1)',
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  registroCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    flexDirection: 'row',
    padding: 16,
  },
  registroInfo: {
    flex: 1,
  },
  registroEmpresa: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  registroId: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  registroSupervisor: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  registroFecha: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  registroCreador: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  registroActions: {
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 120,
  },
  entrarButton: {
    backgroundColor: COLORS.success,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    marginBottom: 8,
  },
  entrarButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 12,
    marginLeft: 4,
  },
  formularioButton: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    marginBottom: 8,
  },
  formularioButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 10,
    marginLeft: 4,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  registroFormularios: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  registroUltimo: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginTop: 16,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: COLORS.card,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  saveButtonDisabled: {
    backgroundColor: COLORS.textSecondary,
  },
  saveButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  empresaSelectorItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    padding: 16,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  empresaSelectorNombre: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  empresaSelectorInfo: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmModalContent: {
    backgroundColor: COLORS.card,
    margin: 20,
    borderRadius: 12,
    padding: 24,
    minWidth: 300,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 12,
    textAlign: 'center',
  },
  confirmText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 8,
    textAlign: 'center',
  },
  confirmEmpresa: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
    marginBottom: 20,
    textAlign: 'center',
  },
  confirmButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: COLORS.textSecondary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  confirmButton: {
    flex: 1,
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    backgroundColor: COLORS.textSecondary,
  },
  confirmButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  
  // --- Estilos para el modal de formularios ---
  addFormularioButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 15,
    padding: 6,
  },
  createFirstFormButton: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  createFirstFormButtonText: {
    color: 'white',
    fontWeight: '600',
    marginLeft: 8,
  },
  formularioItem: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    marginBottom: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  formularioHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  formularioInfo: {
    flex: 1,
    marginRight: 15,
  },
  formularioTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  formularioDate: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  formularioUser: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  formularioLocation: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },
  formularioActions: {
    flexDirection: 'row',
    gap: 8,
  },
  formularioActionBtn: {
    borderRadius: 6,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formularioObservaciones: {
    backgroundColor: COLORS.background,
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  observacionesLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  observacionesText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  
  // --- Estilos para control de acceso ---
  registroCardRestringido: {
    opacity: 0.7,
    borderColor: COLORS.error,
    borderWidth: 1,
  },
  registroHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  accessIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  restrictedText: {
    fontSize: 10,
    color: COLORS.error,
    fontWeight: '600',
    marginLeft: 4,
  },
  entrarButtonDisabled: {
    backgroundColor: COLORS.textSecondary,
    opacity: 0.8,
  },
});
