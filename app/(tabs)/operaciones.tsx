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
  ciudad:string;
  type:string;
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
    type:'',
    ciudad:''
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
   const [tabActual, setTabActual] = useState<'empresas' | 'registros'>('registros');

  // Estados de carga
  const [savingEmpresa, setSavingEmpresa] = useState(false);
  const [savingRegistro, setSavingRegistro] = useState(false);
  const [loadingFormularios, setLoadingFormularios] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [busquedaEmpresa, setBusquedaEmpresa] = useState('');
const [busquedaRegistro, setBusquedaRegistro] = useState('');
const itemsPorPagina = 20;
const [paginaEmpresa, setPaginaEmpresa] = useState(1);
const [paginaRegistro, setPaginaRegistro] = useState(1);
const [refreshingEmpresa, setRefreshingEmpresa] = useState(false);
const [refreshingRegistro, setRefreshingRegistro] = useState(false);


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

  const refreshEmpresas = async () => {
  setRefreshingEmpresa(true);
  await onRefresh();  // tu función que recarga todo
  setRefreshingEmpresa(false);
};

const refreshRegistros = async () => {
  setRefreshingRegistro(true);
  await onRefresh();
  setRefreshingRegistro(false);
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
        type:empresa.type,
        ciudad:empresa.ciudad
      });
    } else {
      setEditingEmpresa(null);
      setEmpresaForm({
        nombre: '',
        centro_costo: '',
        identificacion: '',
        ciudad:'',
        type:''
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
         console.log(empresaForm)
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

  const ITEMS = 10;





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



  // Función para crear inspección de supervisión
  const crearInspeccionSupervision = (registro: RegistroCliente) => {
    console.log('🔍 Creando inspección para registro:', registro.id);
    try {
      router.push({
        pathname: '/formulario-inspeccion-supervision',
        params: {
          registroId: registro.id.toString(),
          empresaId: registro.empresa_id.toString(),
          empresaNombre: registro.empresa_nombre,
        },
      });
    } catch (error) {
      console.error('❌ Error en navegación a inspección:', error);
      Alert.alert('Error', 'No se pudo abrir el formulario de inspección');
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
  <View style={styles.cardMejorado}>
    <View style={styles.cardHeaderMejorado}>

      {/* Información */}
      <View style={{ flex: 1 }}>
        <Text style={styles.cardTitulo}>{item.nombre ?? 'Empresa sin nombre'}</Text>

        <View style={styles.cardFila}>
          <Ionicons name="briefcase-outline" size={14} />
          <Text style={styles.cardSub}>Centro de costo: {item.centro_costo ?? 'Sin centro'}</Text>
        </View>

        {item.identificacion && (
          <View style={styles.cardFila}>
            <Ionicons name="id-card-outline" size={14} />
            <Text style={styles.cardSub}>NIT/Cédula: {item.identificacion}</Text>
          </View>
        )}

        <View style={styles.cardFila}>
          <Ionicons name="information-circle-outline" size={14} />
          <Text style={styles.cardId}>ID: {item.id}</Text>
        </View>
      </View>

      {/* Acciones de Admin */}
      {isAdmin && (
        <View style={styles.cardAcciones}>
          <TouchableOpacity
            style={[styles.botonIcono, { backgroundColor: "#167cfc"}]}
            onPress={() => openEmpresaModal(item)}
          >
            <Ionicons name="pencil-outline" size={18} color="white" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.botonIcono, { backgroundColor: COLORS.error }]}
            onPress={() => deleteEmpresa(item)}
          >
            <Ionicons name="trash-outline" size={18} color="white" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  </View>
);


  const renderRegistroCard = ({ item }: { item: RegistroCliente }) => (
  <View style={styles.cardMejorado}>
    <View style={styles.cardHeaderMejorado}>

      <View style={{ flex: 1 }}>
        <Text style={styles.cardTitulo}>{item.empresa_nombre ?? 'Empresa sin nombre'}</Text>

        <View style={styles.cardFila}>
          <Ionicons name="person-circle-outline" size={15} />
          <Text style={styles.cardSub}>Supervisor: {item.supervisor ?? 'Sin asignar'}</Text>
        </View>

        <View style={styles.cardFila}>
          <Ionicons name="calendar-outline" size={15} />
          <Text style={styles.cardSub}>Creado: {formatDate(item.fecha_creacion)}</Text>
        </View>

        <View style={styles.cardFila}>
          <Ionicons name="create-outline" size={15} />
          <Text style={styles.cardSub}>Por: {item.creado_por ?? 'Desconocido'}</Text>
        </View>

       {/*  <View style={styles.cardFila}>
          <Ionicons name="clipboard-outline" size={15} />
          <Text style={styles.cardId}>Formularios: {item.formularios_count ?? 0}</Text>
        </View> */}

        {item.ultimo_formulario && (
          <View style={styles.cardFila}>
            <Ionicons name="time-outline" size={15} />
            <Text style={styles.cardId}>Último: {formatDate(item.ultimo_formulario)}</Text>
          </View>
        )}
      </View>

      <View style={styles.cardAcciones}>
        <TouchableOpacity
          style={styles.botonEntrar}
          onPress={() => goToRegistroDetalle(item)}
        >
          <Ionicons name="enter-outline" size={18} color="white" />
          <Text style={styles.textoEntrar}>ENTRAR</Text>
        </TouchableOpacity>
      </View>

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



const empresasFiltradas = empresas.filter(e =>
  e.nombre?.toLowerCase().includes(busquedaEmpresa.toLowerCase())
);

const totalPaginasEmpresa = Math.ceil(empresasFiltradas.length / ITEMS);

const empresasPagina = empresasFiltradas.slice(
  (paginaEmpresa - 1) * ITEMS,
  paginaEmpresa * ITEMS
);

const registrosFiltrados = registrosClientes.filter(r =>
  r.empresa_nombre?.toLowerCase().includes(busquedaRegistro.toLowerCase()) ||
  r.supervisor?.toLowerCase().includes(busquedaRegistro.toLowerCase()) ||
  r.creado_por?.toLowerCase().includes(busquedaRegistro.toLowerCase())
);

const totalPaginasRegistro = Math.ceil(registrosFiltrados.length / ITEMS);

const registrosMostrados = registrosFiltrados.slice(
  (paginaRegistro - 1) * ITEMS,
  paginaRegistro * ITEMS
);




  return (
    <View style={styles.container}>
      {/* Header */}
     <View style={styles.header}>
  <Text style={styles.title}>Operaciones</Text>
  <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
    <Ionicons name="refresh" size={20} color="white" />
  </TouchableOpacity>
</View>

{/* 🔴 TABS ROJOS NATIVOS */}
<View style={styles.tabsContainer}>
  {/* ➤ TAB EMPRESAS solo si es admin */}
  {isAdmin && (
    <TouchableOpacity
      style={[styles.tabButton, tabActual === 'empresas' && styles.tabActivo]}
      onPress={() => setTabActual('empresas')}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Ionicons name="business" size={18} color="white" />
        <Text style={styles.tabText}>Empresas / Clientes</Text>
      </View>
    </TouchableOpacity>
  )}

  {/* ➤ TAB REGISTROS para todos */}
  <TouchableOpacity
    style={[styles.tabButton, tabActual === 'registros' && styles.tabActivo]}
    onPress={() => setTabActual('registros')}
  >
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Ionicons name="document-text" size={18} color="white" />
      <Text style={styles.tabText}>Registros de Clientes</Text>
    </View>
  </TouchableOpacity>
</View>
{/* --- CONTENIDO TAB EMPRESAS (solo admins pueden verlo) --- */}
{tabActual === 'empresas' && isAdmin && (
  <View style={[styles.section, { marginHorizontal: 14, marginTop: 10, marginBottom: 20, flex: 1 }]}>
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>Empresas / Clientes</Text>
    </View>

    <TextInput
      placeholder="Buscar empresa..."
      value={busquedaEmpresa}
      onChangeText={text => {
        setBusquedaEmpresa(text);
        setPaginaEmpresa(1);
      }}
      style={[styles.buscador, { marginBottom: 12, marginTop: 6, paddingHorizontal: 12 }]}
    />

    <Text style={styles.countText}>{empresasFiltradas.length} empresas encontradas</Text>

    <TouchableOpacity style={styles.createButton} onPress={() => openEmpresaModal()}>
      <Ionicons name="business" size={18} color="white" />
      <Text style={styles.createButtonText}>CREAR EMPRESA</Text>
    </TouchableOpacity>

    <FlatList
      data={empresasPagina}
      keyExtractor={item => `empresa-${item.id}`}
      renderItem={renderEmpresaCard}
      showsVerticalScrollIndicator={false}
      removeClippedSubviews
      contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 8, paddingBottom: 20, gap: 12 }}
    />

    <View style={styles.paginacionContainer}>
      <TouchableOpacity
        disabled={paginaEmpresa === 1}
        onPress={() => setPaginaEmpresa(paginaEmpresa - 1)}
        style={[styles.btnPage, paginaEmpresa === 1 && styles.btnDisabled]}
      >
        <Text style={styles.txtPage}>◀</Text>
      </TouchableOpacity>
      <Text style={styles.pageInfo}>Página {paginaEmpresa} de {totalPaginasEmpresa}</Text>
      <TouchableOpacity
        disabled={paginaEmpresa === totalPaginasEmpresa}
        onPress={() => setPaginaEmpresa(paginaEmpresa + 1)}
        style={[styles.btnPage, paginaEmpresa === totalPaginasEmpresa && styles.btnDisabled]}
      >
        <Text style={styles.txtPage}>▶</Text>
      </TouchableOpacity>
    </View>
  </View>
)}



{/* --- CONTENIDO TAB REGISTROS (lo ven todos, creación solo admins) --- */}
{tabActual === 'registros' && (
  <View style={[styles.section, { marginHorizontal: 14, marginTop: 10, marginBottom: 20,flex:1 }]}>
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>Registros de Clientes</Text>
    </View>

    <TextInput
      placeholder="Buscar registro..."
      value={busquedaRegistro}
      onChangeText={text => {
        setBusquedaRegistro(text);
        setTabActual('registros');
        setPaginaRegistro(1);
      }}
      style={[styles.buscador, { marginBottom: 10, marginTop: 4, paddingHorizontal: 12 }]}
    />

    <Text style={styles.countText}>{registrosFiltrados.length} registros encontrados</Text>

    {/* ➤ Botón crear solo admins */}
    {isAdmin && (
      <TouchableOpacity style={styles.createButton} onPress={openRegistroModal}>
        <Ionicons name="document-text" size={16} color="white" />
        <Text style={styles.createButtonText}>CREAR REGISTRO CLIENTE</Text>
      </TouchableOpacity>
    )}

    <FlatList
      data={registrosMostrados}
      keyExtractor={item => `registro-${item.id}`}
      renderItem={renderRegistroCard}
      onEndReachedThreshold={0.5}
      removeClippedSubviews
      showsVerticalScrollIndicator={false}
      refreshing={refreshingRegistro}
      onRefresh={refreshRegistros}
      ListEmptyComponent={
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No hay registros encontrados</Text>
        </View>
      }
      contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 8, paddingBottom: 20, gap: 12 }}
      ListFooterComponent={<View style={{ height: 160 }} />}
    />

    <View style={styles.paginacionContainer}>
      <TouchableOpacity
        disabled={paginaRegistro === 1}
        onPress={() => setPaginaRegistro(paginaRegistro - 1)}
        style={[styles.btnPage, paginaRegistro === 1 && styles.btnDisabled]}
      >
        <Text style={styles.txtPage}>◀</Text>
      </TouchableOpacity>
      <Text style={styles.pageInfo}>Página {paginaRegistro} de {totalPaginasRegistro}</Text>
      <TouchableOpacity
        disabled={paginaRegistro === totalPaginasRegistro}
        onPress={() => setPaginaRegistro(paginaRegistro + 1)}
        style={[styles.btnPage, paginaRegistro === totalPaginasRegistro && styles.btnDisabled]}
      >
        <Text style={styles.txtPage}>▶</Text>
      </TouchableOpacity>
    </View>
  </View>
)}



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

             <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Ciudad</Text>
              <TextInput
                style={styles.textInput}
                value={empresaForm.ciudad}
                onChangeText={(text) => setEmpresaForm({...empresaForm, ciudad: text})}
                placeholder="Ingrese Ciudad"
                editable={!savingEmpresa}
              />
            </View>

               <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Tipo de Cliente</Text>
              <TextInput
                style={styles.textInput}
                value={empresaForm.type}
                onChangeText={(text) => setEmpresaForm({...empresaForm, type: text})}
                placeholder="Ingrese Tipo de Cliente"
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
                <Text style={styles.emptyText}>No hay actas de inicio creadas</Text>
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
                  <Text style={styles.createFirstFormButtonText}>CREAR ACTA DE INICIO</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {/* Botón para crear visitas - Solo si hay actas de inicio */}
                <View style={styles.inspeccionButtonContainer}>
                  <TouchableOpacity 
                    style={styles.crearInspeccionButton}
                    onPress={() => {
                      setShowFormulariosModal(false);
                      if (registroSeleccionado) {
                        crearInspeccionSupervision(registroSeleccionado);
                      }
                    }}
                  >
                    <Ionicons name="clipboard-outline" size={24} color="white" />
                    <Text style={styles.crearInspeccionButtonText}>
                      CREAR VISITA
                    </Text>
                  </TouchableOpacity>
                  <Text style={styles.inspeccionHint}>
                    💡 Puedes crear cuantas visitas necesites
                  </Text>
                </View>

                {/* Lista de actas de inicio */}
                {formularios.map((formulario, index) => (
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
              ))}
              </>
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
  marginBottom: 12,
},

sectionTitle: {
  fontSize: 20,
  fontWeight: 'bold',
  color: COLORS.textPrimary,
},
 createButton: {
  backgroundColor: "#7ed957",
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  alignSelf: 'flex-start', // evita que ocupe todo el ancho
  paddingHorizontal: 10,
  paddingVertical: 6,
  borderRadius: 6,
  gap: 4,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.1,
  shadowRadius: 2,
  elevation: 2,
},

paginacionContainer: {
  flexDirection: 'row',
  justifyContent: 'center',
  alignItems: 'center',
  marginTop: 6,
  marginBottom: 2,
  paddingVertical: 0,  // 👈 sin espacio extra
  height: 20,          // 👈 compacto
},
btnPage: {
  width: 28,
  height: 24,          // 👈 mismo alto del contenedor
  justifyContent: 'center',
  alignItems: 'center',
  borderRadius: 6,
  marginHorizontal: 6,
  backgroundColor: '#d32f2f',
},

txtPage: {
  fontSize: 14,        // tamaño normal de flechas
  fontWeight: 'bold',
  color: 'white',
},

pageInfo: {
  fontSize: 14,
  fontWeight: '600',
},
btnDisabled: {
  opacity: 0.4
}
,

createButtonText: {
  color: 'white',
  fontWeight: '600',
  fontSize: 11,
},

tabsContainer: {
  flexDirection: 'row',
  backgroundColor: COLORS.primary,
  paddingVertical: 10,
  justifyContent: 'space-around',
  alignItems: 'center'
},
tabButton: {
  paddingVertical: 8,
  paddingHorizontal: 12
},
tabText: {
  color: 'white',
  fontWeight: 'bold',
  fontSize: 15
},
tabActivo: {
  borderBottomWidth: 3,
  borderBottomColor: 'white'
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
  buscador: {
  backgroundColor: 'white',
  paddingVertical: 10,
  paddingHorizontal: 16,
  borderRadius: 12,
  fontSize: 15,
  borderWidth: 2,
  borderColor: '#ff3b3b',
  elevation: 3,
  shadowOpacity: 0.07,
  shadowRadius: 4,
  shadowOffset: { width: 0, height: 2 },
  marginBottom: 14,
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
  cardMejorado: {
  backgroundColor: 'white',
  borderRadius: 16,
  padding: 14,
  marginBottom: 12,
  elevation: 3,
  shadowOpacity: 0.08,
  shadowRadius: 6,
  shadowOffset: { width: 0, height: 3 },
  borderLeftWidth: 5,
  borderLeftColor: '#c00',
},

cardHeaderMejorado: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 10,
},

cardTitulo: {
  fontSize: 17,
  fontWeight: 'bold',
  color: '#000',
  marginBottom: 6,
},

cardSub: {
  fontSize: 14,
  color: '#444',
},

cardId: {
  fontSize: 13,
  color: '#888',
  fontWeight: '600'
},
countText: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
    color: "#222",
    marginHorizontal: 4
  },


cardFila: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 5,
  marginTop: 3
},

cardAcciones: {
  flexDirection: 'column',
  gap: 6,
  justifyContent: 'center'
},

botonIcono: {
  width: 38,
  height: 38,
  borderRadius: 10,
  justifyContent: 'center',
  alignItems: 'center'
},

botonEntrar: {
  backgroundColor: '#167cfc',
  paddingVertical: 10,
  paddingHorizontal: 14,
  borderRadius: 12,
  flexDirection: 'row',
  gap: 6,
  elevation: 2,
  alignItems: 'center'
},

textoEntrar: {
  color: 'white',
  fontWeight: '800',
  fontSize: 13,
  letterSpacing: 0.6
},

searchContainer: {
  flexDirection: 'row',
  backgroundColor: 'white',
  borderWidth: 1,
  borderColor: '#ddd',
  borderRadius: 12,
  paddingHorizontal: 10,
  paddingVertical: 7,
  alignItems: 'center',
  gap: 6,
  marginBottom: 14
},

searchInput: {
  flex: 1,
  fontSize: 15,
  paddingVertical: 6,
  color: '#000'
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
  
  // --- Estilos para botón de inspección ---
  inspeccionButtonContainer: {
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#4CAF50',
    borderStyle: 'dashed',
  },
  crearInspeccionButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  crearInspeccionButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  inspeccionHint: {
    fontSize: 12,
    color: '#2E7D32',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
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
