import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  TextInput,
  FlatList,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "./_layout";
import { Ionicons } from "@expo/vector-icons";
import axios from "axios";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";

// --- Configuración de la API ---
const API_BASE = "https://operaciones.lavianda.com.co/api";

// --- Paleta de Colores ---
const COLORS = {
  primary: "#C62828",
  background: "#FFFFFF",
  card: "#FFFFFF",
  textPrimary: "#212121",
  textSecondary: "#757575",
  success: "#4CAF50",
  warning: "#1E3A8A",
  error: "#F44336",
  danger: "#F44336",
  border: "#E0E0E0",
};

// --- Interfaces ---
interface RegistroDetalle {
  id: number;
  empresa_id: number;
  empresa: {
    id: number;
    nombre: string;
    centro_costo: string;
    identificacion?: string;
    direccion?: string;
    ciudad?: string;
    type?: string;
    contrato?: string;
  };
  supervisor_id?: number;
  supervisor?: {
    id: number;
    name: string;
  };
  fecha_creacion: string;
  creado_por: number;
  creador?: {
    id: number;
    name: string;
  };
  created_at: string;
  updated_at: string;
}

interface Formulario {
  id: number;
  registro_cliente_id: number;
  nombre_contrato?: string;
  supervisor_id?: number;
  supervisor?: {
    id: number;
    name: string;
  };
  creado_por: number;
  creador?: {
    id: number;
    name: string;
  };
  created_at: string;
  updated_at: string;
}

interface Inspeccion {
  id: number;
  registro_cliente_id: number;
  consecutivo?: string;
  user_id: number;
  usuario?: {
    id: number;
    name: string;
  };
  fecha_inspeccion: string;
  areas_inspeccionadas?: string;
  observaciones_generales?: string;
  estado?: string;
  created_at: string;
  updated_at: string;
}

interface EvaluacionServicio {
  id: number;
  registro_cliente_id: number;
  consecutivo?: string;

  // Campos reales del backend
  servicio_mantenimiento: boolean;
  servicio_otro: boolean;
  servicio_cual?: string;

  cliente_zona: string;
  telefono: string;
  direccion: string;
  ciudad: string;
  periodo_inicio?: string;
  periodo_fin?: string;
  fecha_evaluacion: string;
  nombre_evaluador: string;
  cargo_evaluador?: string;
  supervisor_asignado?: string;

  // Calificaciones
  calificacion_excelente?: number;
  calificacion_muy_bueno?: number;
  calificacion_bueno?: number;
  calificacion_regular?: number;
  calificacion_malo?: number;

  observaciones?: string;
  firma_cliente_base64?: string;
  nombre_firma?: string;
  fecha_firma?: string;
  estado?: string;
  usuario?: {
    id: number;
    name: string;
  };
  created_at: string;
  updated_at: string;
}

interface Empleado {
  id: number;
  name?: string;
}

interface Carpeta {
  id: number;
  nombre: string;
  carpeta_padre_id?: number;
  registro_cliente_id: number;
  ruta: string;
  created_at: string;
  updated_at: string;
  subcarpetas?: Carpeta[];
  documentos?: Documento[];
}

interface Documento {
  id: number;
  nombre: string;
  nombre_original: string;
  ruta: string;
  tipo: string;
  tamaño: number;
  carpeta_id?: number;
  registro_cliente_id: number;
  subido_por: number;
  uploaded_by: number;
  usuario?:
    | string
    | {
        id: number;
        name: string;
      };
  created_at: string;
  updated_at: string;
}

export default function RegistroDetalleScreen() {
  const { registroId } = useLocalSearchParams<{ registroId: string }>();
  const { user } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [registro, setRegistro] = useState<RegistroDetalle | null>(null);
  const [formularios, setFormularios] = useState<Formulario[]>([]);
  const [inspecciones, setInspecciones] = useState<Inspeccion[]>([]); // NUEVO
  const [evaluaciones, setEvaluaciones] = useState<EvaluacionServicio[]>([]);
  const [puedeCrearFormulario, setPuedeCrearFormulario] = useState(false);
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [formulariosInicioServicio, setFormulariosInicioServicio] = useState<
    any[]
  >([]);
  const [totalFormulariosInicioServicio, setTotalFormulariosInicioServicio] =
    useState(0);
  const [paginaInicioServicio, setPaginaInicioServicio] = useState(1);
  const [cargandoMasFormulariosIS, setCargandoMasFormulariosIS] =
    useState(false);
  const [novedadesServicio, setNovedadesServicio] = useState<any[]>([]);
  const [totalNovedadesServicio, setTotalNovedadesServicio] = useState(0);
  const [paginaNovedadesServicio, setPaginaNovedadesServicio] = useState(1);
  const [cargandoMasNovedades, setCargandoMasNovedades] = useState(false);

  // Estados para paginación y optimización
  const [formulariosPagina, setFormulariosPagina] = useState(1);
  const [evaluacionesPagina, setEvaluacionesPagina] = useState(1);
  const [cargandoMasFormularios, setCargandoMasFormularios] = useState(false);
  const [totalFormularios, setTotalFormularios] = useState(0);
  const [totalEvaluaciones, setTotalEvaluaciones] = useState(0);
  const ITEMS_POR_PAGINA = 10;
  const [puedeCrearInicioServicio, setPuedeCrearInicioServicio] =
    useState(false);
  const [puedeCrearNovedadesServicio, setPuedeCrearNovedadesServicio] =
    useState(false);
  const [puedeCrearInspecciones, setPuedeCrearInspecciones] = useState(false);
  const [puedeCrearEvaluacion, setPuedeCrearEvaluacion] = useState(false);
  const FORM_TABS = [
    { key: "actas", label: "Actas de Inicio" },
    { key: "inspecciones", label: "Inspecciones" },
    { key: "cronogramas", label: "Cronogramas de Trabajo" },
    { key: "evaluaciones", label: "Evaluaciones" },
    { key: "acta_reunion", label: "Acta de Reunión" },
    { key: "inicio_servicio", label: "Inicio de Servicio" },
    { key: "novedades", label: "Novedades de Servicio" },
  ];
  const [activeTab, setActiveTab] = useState(FORM_TABS[0].key);
  const [cronogramas, setCronogramas] = useState<any[]>([]);
  const [totalCronogramas, setTotalCronogramas] = useState(0);
  const [paginaCronogramas, setPaginaCronogramas] = useState(1);
  const [puedeCrearCronograma, setPuedeCrearCronograma] = useState(false);
  

  const getCalificacionTexto = (evaluacion: EvaluacionServicio): string => {
    if (evaluacion.calificacion_excelente) return "EXCELENTE";
    if (evaluacion.calificacion_muy_bueno) return "MUY BUENO";
    if (evaluacion.calificacion_bueno) return "BUENO";
    if (evaluacion.calificacion_regular) return "REGULAR";
    if (evaluacion.calificacion_malo) return "MALO";
    return "NO ESPECIFICADO";
  };



  // Debug: Monitorear cambios en evaluaciones
  React.useEffect(() => {
    console.log("🔄 Estado de evaluaciones actualizado:");
    console.log("📊 Cantidad en estado:", evaluaciones.length);
    console.log("📋 Evaluaciones:", evaluaciones);
  }, [evaluaciones]);

  // Función para cargar más formularios (paginación)
  const cargarMasFormularios = async () => {
    if (
      cargandoMasFormulariosIS ||
      formulariosInicioServicio.length >= totalFormulariosInicioServicio
    )
      return;

    setCargandoMasFormulariosIS(true);
    try {
      const response = await axios.get(
        `${API_BASE}/registros-clientes/${registroId}/inicio-servicio?pagina=${paginaInicioServicio + 1}&limite=${ITEMS_POR_PAGINA}`,
        { headers: { Authorization: `Bearer ${user?.token}`, 'Content-Type': 'application/json',
            'Accept': 'application/json' } }
      );
      setFormulariosInicioServicio((prev) => [
        ...prev,
        ...response.data.formularios,
      ]);
      setPaginaInicioServicio((prev) => prev + 1);
    } catch (error) {
      Alert.alert("Error", "No se pudieron cargar más formularios");
    } finally {
      setCargandoMasFormulariosIS(false);
    }
  };

  const [showCambiarSupervisorModal, setShowCambiarSupervisorModal] =
    useState(false);

  // Estados para sistema de documentos
  const [carpetas, setCarpetas] = useState<Carpeta[]>([]);
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [carpetaActual, setCarpetaActual] = useState<Carpeta | null>(null);
  const [rutaCarpetas, setRutaCarpetas] = useState<Carpeta[]>([]);
  const [showDocumentosModal, setShowDocumentosModal] = useState(false);
  const [showCrearCarpetaModal, setShowCrearCarpetaModal] = useState(false);
  const [nombreNuevaCarpeta, setNombreNuevaCarpeta] = useState("");
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [actasReunion, setActasReunion] = useState<any[]>([]);
const [totalActasReunion, setTotalActasReunion] = useState(0);
const [paginaActasReunion, setPaginaActasReunion] = useState(1);
const [puedeCrearActaReunion, setPuedeCrearActaReunion] = useState(false);
const [paginaActas, setPaginaActas] = useState(1);
const [paginaInspecciones, setPaginaInspecciones] = useState(1);
const [paginaEvaluaciones, setPaginaEvaluaciones] = useState(1);
const [paginaActaReunion, setPaginaActaReunion] = useState(1);

  const { signOut } = useAuth();

  // Verificar permisos de administrador
  const isAdmin =
    user?.userData?.role === "admin" || user?.userData?.role === "root";

  useEffect(() => {
    if (registroId) {
      loadRegistroDetalle();
    }
  }, [registroId]);

const loadRegistroDetalle = async () => {
  try {
    setLoading(true);

    const response = await axios.get(
      `${API_BASE}/registros-clientes/${registroId}`,
      {
        headers: {
          Authorization: `Bearer ${user?.token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      }
    );

    const data = response.data;
    console.log("📋 Datos del backend recibidos:", data);

    /* ===========================
       DATOS PRINCIPALES
       =========================== */
    setRegistro(data.registro);

    /* ===========================
       ACTAS DE INICIO  ✅
       =========================== */
    setFormularios(data.formularios || []);
    setTotalFormularios(data.formularios?.length || 0);

    /* ===========================
       CRONOGRAMAS
       =========================== */
    setCronogramas(data.cronogramas || []);
    setTotalCronogramas(data.cronogramas?.length || 0);

    /* ===========================
       ACTAS DE REUNIÓN
       =========================== */
    setActasReunion(data.actas_reunion || []);
    setTotalActasReunion(data.actas_reunion?.length || 0);

    /* ===========================
       INSPECCIONES
       =========================== */
    setInspecciones(data.inspecciones || []);

    /* ===========================
       INICIO SERVICIO
       =========================== */
    setFormulariosInicioServicio(
      data.formularioInicioServicio || []
    );
    setTotalFormulariosInicioServicio(
      data.formularioInicioServicio?.length || 0
    );

    /* ===========================
       NOVEDADES
       =========================== */
    setNovedadesServicio(
      data.formularioNovedadesServicio || []
    );
    setTotalNovedadesServicio(
      data.formularioNovedadesServicio?.length || 0
    );

    /* ===========================
       EVALUACIONES
       =========================== */
    setEvaluaciones(data.evaluaciones || []);
    setTotalEvaluaciones(data.evaluaciones?.length || 0);

    /* ===========================
       EMPLEADOS
       =========================== */
    setEmpleados(data.empleados || []);

    /* ===========================
       PERMISOS
       =========================== */
    setPuedeCrearFormulario(data.puede_crear_acta_inicio || false);
    setPuedeCrearInicioServicio(data.puede_crear_inicio_servicio || false);
    setPuedeCrearNovedadesServicio(data.puede_crear_novedades_servicio || false);
    setPuedeCrearInspecciones(data.puede_crear_inspecciones || false);
    setPuedeCrearEvaluacion(data.puede_crear_evaluacion || false);
    setPuedeCrearCronograma(data.puede_crear_cronograma || false);
    setPuedeCrearActaReunion(data.puede_crear_acta_reunion || false);

    /* ===========================
       PAGINACIÓN (reset correcto)
       =========================== */
    setPaginaActas(1);
    setPaginaCronogramas(1);
    setPaginaActasReunion(1);
    setPaginaInicioServicio(1);
    setPaginaNovedadesServicio(1);
    setEvaluacionesPagina(1);

  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      Alert.alert(
        "Sesión expirada",
        "Tu sesión ha vencido. Por favor inicia sesión nuevamente.",
        [
          {
            text: "OK",
            onPress: () => signOut(),
          },
        ]
      );
      return;
    }

    console.error("❌ Error cargando dashboard:", error);
  } finally {
    setLoading(false);
  }
};


  const paginar = <T,>(data: T[], pagina: number) => {
  return data.slice(0, pagina * ITEMS_POR_PAGINA);
};
useEffect(() => {
  setPaginaActas(1);
  setPaginaInspecciones(1);
  setPaginaCronogramas(1);
  setPaginaEvaluaciones(1);
  setPaginaActaReunion(1);
}, [activeTab]);

  const onRefresh = () => {
    setRefreshing(true);
    loadRegistroDetalle();
  };

  const crearFormulario = () => {
    if (!registro) return;

    console.log("Datos completos del registro:", registro);
    console.log("Empresa:", registro.empresa);
    console.log("Identificación empresa:", registro.empresa?.identificacion);

    router.push({
      pathname: "/formulario-acta-inicio",
      params: {
        registroId: registro.id.toString(),
        empresaId: registro.empresa_id.toString(),
        empresa: registro.empresa.nombre,
        nit: registro.empresa?.identificacion || "",
        modo: "crear",
      },
    });
  };

  const InicioServicio = () => {
    if (!registro) return;
    router.push({
      pathname: "/formulario-inicio-servicio",
      params: {
        registroId: registro.id.toString(),
        empresaId: registro.empresa_id.toString(),
        empresa: registro.empresa.nombre,
        nit: registro.empresa?.identificacion || "",
        ciudad: registro.empresa?.ciudad || "",
        modo: "crear",
      },
    });
  };

  const NovedadesServicio = () => {
    if (!registro) return;
    router.push({
      pathname: "/formulario-novedades-servicio",
      params: {
        registroId: registro.id.toString(),
        empresaId: registro.empresa_id.toString(),
        empresa: registro.empresa.nombre,
        nit: registro.empresa?.identificacion || "",
        centro_costo: registro.empresa?.centro_costo || "",
        ciudad: registro.empresa?.ciudad || "",
        modo: "crear",
      },
    });
  };

  const crearNuevaVisita = () => {
    if (!registro) return;

    console.log("🔍 Creando nueva visita para registro:", registro.id);

    router.push({
      pathname: "/formulario-supervision-completo",
      params: {
        registroId: registro.id.toString(),
        empresaId: registro.empresa_id.toString(),
        empresaNombre: registro.empresa.nombre,
        direccion: registro.empresa.direccion || "",
        ciudad: registro.empresa.ciudad || "",
      },
    });
  };

  const crearCronograma = () => {
    if (!registro) return;

    router.push({
      pathname: "/cronograma",
      params: {
        registroId: registro.id.toString(),
        empresaId: registro.empresa_id.toString(),
        empresa: registro.empresa.nombre,
        nit: registro.empresa?.identificacion || "",
        modo: "crear",
      },
    });
  };

   const crearActaReunion = () => {
    if (!registro) return;

    router.push({
      pathname: "/acta-reunion",
      params: {
        registroId: registro.id.toString(),
        empresaId: registro.empresa_id.toString(),
        empresa: registro.empresa.nombre,
        nit: registro.empresa?.identificacion || "",
        modo: "crear",
      },
    });
  };

  const abrirFormulario = (formularioId: number) => {
    router.push({
      pathname: "/formulario-acta-inicio",
      params: {
        registroId: registroId,
        formularioId: formularioId,
        modo: "ver",
      },
    });
  };

  const abrirFormularioInicioServicio = (formularioId: number) => {
    router.push({
      pathname: "/formulario-inicio-servicio",
      params: {
        registroId: registroId,
        formularioId: formularioId,
        modo: "ver",
      },
    });
  };

  const abrirFormularioNovedadesServicio = (formularioId: number) => {
    router.push({
      pathname: "/formulario-novedades-servicio",
      params: {
        registroId: registroId,
        formularioId: formularioId,
        modo: "ver",
      },
    });
  };

  const abrirInspeccion = (inspeccionId: number) => {
    router.push({
      pathname: "/formulario-supervision-completo",
      params: {
        registroId: registroId,
        formularioId: inspeccionId,
        modo: "ver",
      },
    });
  };

  const abrirCronograma = (inspeccionId: number) => {
    router.push({
      pathname: "/cronograma",
      params: {
        registroId: registroId,
        formularioId: inspeccionId,
        modo: "ver",
      },
    });
  };

   const abrirActareunion = (inspeccionId: number) => {
    router.push({
      pathname: "/acta-reunion",
      params: {
        registroId: registroId,
        formularioId: inspeccionId,
        modo: "ver",
      },
    });
  };


  const abrirEvaluacion = (evaluacionId: number) => {
    console.log("🔍 Navegando a evaluación de servicio:", evaluacionId);
    router.push({
      pathname: "/evaluacion-servicio-detalle",
      params: { id: evaluacionId.toString() },
    });
  };

  const crearNuevaEvaluacion = () => {
    router.push({
      pathname: "/formulario-evaluacion-servicio",
      params: {
        registroId: registro?.id.toString(),
        empresaId: registro?.empresa_id.toString(),
        empresaNombre: registro?.empresa.nombre,
        direccion: registro?.empresa.direccion || "",
        ciudad: registro?.empresa.ciudad || "",
      },
    });
  };

  const eliminarFormulario = (formularioId: number) => {
    Alert.alert(
      "Confirmar eliminación",
      "¿Estás seguro de que deseas eliminar este formulario?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              await axios.delete(
                `${API_BASE}/formularios-acta-inicio/${formularioId}`,
                {
                  headers: { Authorization: `Bearer ${user?.token}` },
                }
              );
              Alert.alert("Éxito", "Formulario eliminado correctamente");
              loadRegistroDetalle();
            } catch (error) {
              console.error("Error al eliminar formulario:", error);
              Alert.alert("Error", "No se pudo eliminar el formulario");
            }
          },
        },
      ]
    );
  };

  const eliminarFormularioInicioServicio = (formularioId: number) => {
    Alert.alert(
      "Confirmar eliminación",
      "¿Estás seguro de que deseas eliminar este formulario?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              await axios.delete(
                `${API_BASE}/formularios-inicio-servicio/${formularioId}`,
                {
                  headers: { Authorization: `Bearer ${user?.token}` },
                }
              );
              Alert.alert("Éxito", "Formulario eliminado correctamente");
              loadRegistroDetalle();
            } catch (error) {
              console.error("Error al eliminar formulario:", error);
              Alert.alert("Error", "No se pudo eliminar el formulario");
            }
          },
        },
      ]
    );
  };

  const eliminarFormularioNovedadesServicio = (formularioId: number) => {
    Alert.alert(
      "Confirmar eliminación",
      "¿Estás seguro de que deseas eliminar este formulario?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              await axios.delete(
                `${API_BASE}/formularios-novedades-servicio/${formularioId}`,
                {
                  headers: { Authorization: `Bearer ${user?.token}` },
                }
              );
              Alert.alert("Éxito", "Formulario eliminado correctamente");
              loadRegistroDetalle();
            } catch (error) {
              console.error("Error al eliminar formulario:", error);
              Alert.alert("Error", "No se pudo eliminar el formulario");
            }
          },
        },
      ]
    );
  };

  const eliminarInspeccion = async (id: number) => {
    Alert.alert("Eliminar Visita", "¿Estás seguro de eliminar esta visita?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          try {
            await axios.delete(`${API_BASE}/formularios/supervision/${id}`, {
              headers: { Authorization: `Bearer ${user?.token}` },
            });

            setInspecciones((prev) => prev.filter((item) => item.id !== id));
            Alert.alert("Éxito", "Visita eliminada correctamente");
          } catch (error) {
            console.error("Error al eliminar visita:", error);
            Alert.alert("Error", "No se pudo eliminar la visita");
          }
        },
      },
    ]);
  };

  const eliminarEvaluacion = async (id: number) => {
    Alert.alert(
      "Eliminar Evaluación",
      "¿Estás seguro de eliminar esta evaluación?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              await axios.delete(
                `${API_BASE}/formularios/evaluacion-servicio/${id}`,
                {
                  headers: { Authorization: `Bearer ${user?.token}` },
                }
              );

              setEvaluaciones((prev) => prev.filter((item) => item.id !== id));
              Alert.alert("Éxito", "Evaluación eliminada correctamente");
            } catch (error) {
              console.error("Error al eliminar evaluación:", error);
              Alert.alert("Error", "No se pudo eliminar la evaluación");
            }
          },
        },
      ]
    );
  };

  const cambiarSupervisor = async (supervisorId: number) => {
    try {
      await axios.put(
        `${API_BASE}/registros-clientes/${registroId}/supervisor`,
        {
          supervisor_id: supervisorId,
        },
        {
          headers: { Authorization: `Bearer ${user?.token}` },
        }
      );

      Alert.alert("Éxito", "Supervisor actualizado correctamente");
      setShowCambiarSupervisorModal(false);
      loadRegistroDetalle();
    } catch (error) {
      console.error("Error al cambiar supervisor:", error);
      Alert.alert("Error", "No se pudo cambiar el supervisor");
    }
  };

  // --- FUNCIONES PARA SISTEMA DE DOCUMENTOS ---

  const loadDocumentos = async (carpetaId?: number) => {
    try {
      setLoadingDocuments(true);
      const params = carpetaId ? `?carpeta_id=${carpetaId}` : "";

      const [carpetasResponse, documentosResponse] = await Promise.all([
        axios.get(
          `${API_BASE}/registros-clientes/${registroId}/carpetas${params}`,
          {
            headers: { Authorization: `Bearer ${user?.token}`, 'Content-Type': 'application/json',
            'Accept': 'application/json' },
          }
        ),
        axios.get(
          `${API_BASE}/registros-clientes/${registroId}/documentos${params}`,
          {
            headers: { Authorization: `Bearer ${user?.token}` },
          }
        ),
      ]);

      setCarpetas(carpetasResponse.data);
      setDocumentos(documentosResponse.data);
    } catch (error) {
      console.error("Error al cargar documentos:", error);
      Alert.alert("Error", "No se pudieron cargar los documentos");
    } finally {
      setLoadingDocuments(false);
    }
  };

  const crearCarpeta = async () => {
    if (!nombreNuevaCarpeta.trim()) {
      Alert.alert("Error", "Ingrese un nombre para la carpeta");
      return;
    }

    try {
      await axios.post(
        `${API_BASE}/registros-clientes/${registroId}/carpetas`,
        {
          nombre: nombreNuevaCarpeta.trim(),
          carpeta_padre_id: carpetaActual?.id || null,
        },
        {
          headers: { Authorization: `Bearer ${user?.token}` },
        }
      );

      Alert.alert("Éxito", "Carpeta creada correctamente");
      setNombreNuevaCarpeta("");
      setShowCrearCarpetaModal(false);
      loadDocumentos(carpetaActual?.id);
    } catch (error) {
      console.error("Error al crear carpeta:", error);
      Alert.alert("Error", "No se pudo crear la carpeta");
    }
  };

  const subirDocumento = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
        multiple: true,
      });

      if (!result.canceled && result.assets) {
        setUploadingDocument(true);

        for (const asset of result.assets) {
          const formData = new FormData();
          formData.append("documento", {
            uri: asset.uri,
            type: asset.mimeType || "application/octet-stream",
            name: asset.name,
          } as any);

          if (carpetaActual?.id) {
            formData.append("carpeta_id", carpetaActual.id.toString());
          }

          await axios.post(
            `${API_BASE}/registros-clientes/${registroId}/documentos`,
            formData,
            {
              headers: {
                Authorization: `Bearer ${user?.token}`,
                "Content-Type": "multipart/form-data",
              },
            }
          );
        }

        Alert.alert(
          "Éxito",
          `${result.assets.length} documento(s) subido(s) correctamente`
        );
        loadDocumentos(carpetaActual?.id);
      }
    } catch (error) {
      console.error("Error al subir documento:", error);
      Alert.alert("Error", "No se pudo subir el documento");
    } finally {
      setUploadingDocument(false);
    }
  };

  const navegarACarpeta = (carpeta: Carpeta) => {
    setCarpetaActual(carpeta);
    setRutaCarpetas([...rutaCarpetas, carpeta]);
    loadDocumentos(carpeta.id);
  };

  const navegarAtras = () => {
    const nuevaRuta = [...rutaCarpetas];
    nuevaRuta.pop();

    const carpetaPadre =
      nuevaRuta.length > 0 ? nuevaRuta[nuevaRuta.length - 1] : null;
    setCarpetaActual(carpetaPadre);
    setRutaCarpetas(nuevaRuta);
    loadDocumentos(carpetaPadre?.id);
  };

  const eliminarCarpeta = (carpeta: Carpeta) => {
    Alert.alert(
      "Confirmar eliminación",
      `¿Estás seguro de que deseas eliminar la carpeta "${carpeta.nombre}"? Esto eliminará también todo su contenido.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              await axios.delete(`${API_BASE}/carpetas/${carpeta.id}`, {
                headers: { Authorization: `Bearer ${user?.token}` },
              });
              Alert.alert("Éxito", "Carpeta eliminada correctamente");
              loadDocumentos(carpetaActual?.id);
            } catch (error) {
              console.error("Error al eliminar carpeta:", error);
              Alert.alert("Error", "No se pudo eliminar la carpeta");
            }
          },
        },
      ]
    );
  };

  const eliminarDocumento = (documento: Documento) => {
    Alert.alert(
      "Confirmar eliminación",
      `¿Estás seguro de que deseas eliminar el documento "${documento.nombre_original}"?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              await axios.delete(`${API_BASE}/documentos/${documento.id}`, {
                headers: { Authorization: `Bearer ${user?.token}` },
              });
              Alert.alert("Éxito", "Documento eliminado correctamente");
              loadDocumentos(carpetaActual?.id);
            } catch (error) {
              console.error("Error al eliminar documento:", error);
              Alert.alert("Error", "No se pudo eliminar el documento");
            }
          },
        },
      ]
    );
  };

  const descargarDocumento = async (documento: Documento) => {
    try {
      Alert.alert("Descargando...", "Por favor espere...");

      // Usar downloadAsync para descargar el archivo directamente
      const fileName = documento.nombre_original;
      // TODO: Fix FileSystem.documentDirectory import issue
      const fileUri = `/tmp/${fileName}`; // Temporary fix

      const downloadResult = await FileSystem.downloadAsync(
        `${API_BASE}/documentos/${documento.id}/descargar`,
        fileUri,
        {
          headers: {
            Authorization: `Bearer ${user?.token}`,
          },
        }
      );

      if (downloadResult.status === 200) {
        // Verificar si el archivo se descargó correctamente
        const fileInfo = await FileSystem.getInfoAsync(fileUri);
        if (fileInfo.exists) {
          // Compartir el archivo
          const Sharing = require("expo-sharing");
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(fileUri);
            Alert.alert("Éxito", "Documento descargado y compartido");
          } else {
            Alert.alert("Éxito", `Documento guardado en: ${fileName}`);
          }
        } else {
          Alert.alert("Error", "No se pudo guardar el archivo");
        }
      } else {
        Alert.alert("Error", `Error al descargar: ${downloadResult.status}`);
      }
    } catch (error: any) {
      console.error("Error al descargar documento:", error);
      if (error?.response?.status === 404) {
        Alert.alert("Error", "Documento no encontrado");
      } else if (error?.response?.status === 403) {
        Alert.alert(
          "Error",
          "No tienes permisos para descargar este documento"
        );
      } else {
        Alert.alert(
          "Error",
          "No se pudo descargar el documento. Verifique su conexión."
        );
      }
    }
  };

  const abrirDocumentos = () => {
    setShowDocumentosModal(true);
    loadDocumentos();
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Cargando...</Text>
      </View>
    );
  }

  if (!registro) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>No se pudo cargar la información</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header con información del registro */}
        <View style={styles.headerCard}>
          <View style={styles.headerRow}>
            <TouchableOpacity
              style={styles.backIcon}
              onPress={() => router.back()}
            >
              <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Registro #{registro.id}</Text>
            {isAdmin && (
              <TouchableOpacity
                style={styles.editIcon}
                onPress={() => setShowCambiarSupervisorModal(true)}
              >
                <Ionicons name="person-add" size={24} color={COLORS.primary} />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Empresa:</Text>
            <Text style={styles.infoValue}>{registro.empresa.nombre}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Centro de Costo:</Text>
            <Text style={styles.infoValue}>
              {registro.empresa.centro_costo}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Ciudad:</Text>
            <Text style={styles.infoValue}>{registro.empresa.ciudad}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Tipo:</Text>
            <Text style={styles.infoValue}>{registro.empresa.type}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Contrato:</Text>
            <Text style={styles.infoValue}>{registro.empresa.contrato}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Supervisor:</Text>
            <Text style={styles.infoValue}>
              {registro.supervisor?.name || "Sin asignar"}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Creado por:</Text>
            <Text style={styles.infoValue}>
              {registro.creador?.name || "Usuario desconocido"}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Fecha de creación:</Text>
            <Text style={styles.infoValue}>
              {new Date(registro.created_at).toLocaleDateString()}
            </Text>
          </View>
        </View>

        {/* Sección de documentos */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Documentos</Text>
            <TouchableOpacity
              style={styles.documentsButton}
              onPress={abrirDocumentos}
            >
              <Ionicons name="folder-outline" size={20} color={COLORS.card} />
              <Text style={styles.createButtonText}>Gestionar Documentos</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.sectionTitleForm}>Formularios</Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContainer}
        >
          {FORM_TABS.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.activeTab]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === tab.key && styles.activeTabText,
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Sección de formularios */}

       {activeTab === "actas" && (
  <View style={styles.section}>
    <View style={styles.sectionHeader}>
      {puedeCrearFormulario && (
        <TouchableOpacity
          style={styles.createButton}
          onPress={crearFormulario}
        >
          <Ionicons name="add" size={20} color={COLORS.card} />
          <Text style={styles.createButtonText}>
            Crear Acta de Inicio
          </Text>
        </TouchableOpacity>
      )}
    </View>

    {formularios.length === 0 ? (
      <View style={styles.emptyState}>
        <Ionicons
          name="document-outline"
          size={48}
          color={COLORS.textSecondary}
        />
        <Text style={styles.emptyStateText}>
          No hay Actas de Inicio creadas.
        </Text>
        {puedeCrearFormulario && (
          <Text style={styles.emptyStateText}>
            Presiona "Crear Acta de Inicio" para comenzar.
          </Text>
        )}
      </View>
    ) : (
      <>
        {/* LISTADO PAGINADO */}
        {paginar(formularios, paginaActas).map((formulario) => (
          <View key={formulario.id} style={styles.formularioCard}>
            <View style={styles.formularioHeader}>
              <Text style={styles.formularioTitle}>
                ACTA DE INICIO DEL SERVICIO DE ASEO INTEGRAL Y CAFETERIA
              </Text>
            </View>

            <View style={styles.formularioInfo}>
              <Text style={styles.formularioLabel}>Supervisor:</Text>
              <Text style={styles.formularioValue}>
                {formulario.supervisor?.name || "Sin asignar"}
              </Text>
            </View>

            <View style={styles.formularioInfo}>
              <Text style={styles.formularioLabel}>Creado por:</Text>
              <Text style={styles.formularioValue}>
                {formulario.creador?.name || "Usuario desconocido"}
              </Text>
            </View>

            <View style={styles.formularioInfo}>
              <Text style={styles.formularioLabel}>Fecha:</Text>
              <Text style={styles.formularioValue}>
                {new Date(formulario.created_at).toLocaleDateString()}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.openFormButton}
              onPress={() => abrirFormulario(formulario.id)}
            >
              <Text style={styles.openFormButtonText}>
                Abrir Formulario
              </Text>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={COLORS.primary}
              />
            </TouchableOpacity>
          </View>
        ))}

        {/* BOTÓN VER MÁS */}
        {formularios.length > paginaActas * ITEMS_POR_PAGINA && (
          <TouchableOpacity
            style={styles.verMasButton}
            onPress={() => setPaginaActas((p) => p + 1)}
          >
            <Text style={styles.verMasText}>
              Ver más ({paginaActas * ITEMS_POR_PAGINA} de {formularios.length})
            </Text>
            <Ionicons
              name="chevron-down"
              size={20}
              color={COLORS.card}
            />
          </TouchableOpacity>
        )}
      </>
    )}
  </View>
)}

     
    {activeTab === "inspecciones" && (
  <View style={styles.section}>
    {/* HEADER → BOTÓN CREAR (UNA SOLA VEZ) */}
    <View style={styles.sectionHeader}>
      {puedeCrearInspecciones && (
        <TouchableOpacity
          style={styles.createButton}
          onPress={crearNuevaVisita}
        >
          <Ionicons
            name="clipboard-outline"
            size={20}
            color={COLORS.card}
          />
          <Text style={styles.createButtonText}>
            Crear Informe de Supervisión
          </Text>
        </TouchableOpacity>
      )}
    </View>

    {/* ESTADO VACÍO */}
    {inspecciones.length === 0 ? (
      <View style={styles.emptyState}>
        <Ionicons
          name="clipboard-outline"
          size={48}
          color={COLORS.textSecondary}
        />
        <Text style={styles.emptyStateText}>
          No hay visitas / inspecciones creadas aún.
        </Text>
      </View>
    ) : (
      <>
        {/* LISTADO DE FORMULARIOS */}
        {paginar(inspecciones, paginaInspecciones).map((inspeccion) => (
          <View key={inspeccion.id} style={styles.formularioCard}>
            <View style={styles.formularioHeader}>
              <Text style={styles.formularioTitle}>
                INFORME DE SUPERVISIÓN
              </Text>
            </View>

            <View style={styles.formularioInfo}>
              <Text style={styles.formularioLabel}>Consecutivo:</Text>
              <Text style={styles.formularioValue}>
                {inspeccion.consecutivo || "Sin consecutivo"}
              </Text>
            </View>

            <View style={styles.formularioInfo}>
              <Text style={styles.formularioLabel}>Supervisor:</Text>
              <Text style={styles.formularioValue}>
                {inspeccion.usuario?.name || "Usuario desconocido"}
              </Text>
            </View>

            <View style={styles.formularioInfo}>
              <Text style={styles.formularioLabel}>
                Fecha inspección:
              </Text>
              <Text style={styles.formularioValue}>
                {inspeccion.fecha_inspeccion
                  ? new Date(inspeccion.fecha_inspeccion).toLocaleDateString()
                  : "Sin fecha"}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.openFormButton}
              onPress={() => abrirInspeccion(inspeccion.id)}
            >
              <Text style={styles.openFormButtonText}>
                Abrir Informe
              </Text>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={COLORS.primary}
              />
            </TouchableOpacity>
          </View>
        ))}

        {/* VER MÁS */}
        {inspecciones.length >
          paginaInspecciones * ITEMS_POR_PAGINA && (
          <TouchableOpacity
            style={styles.verMasButton}
            onPress={() =>
              setPaginaInspecciones((p) => p + 1)
            }
          >
            <Text style={styles.verMasText}>
              Ver más ({paginaInspecciones * ITEMS_POR_PAGINA} de{" "}
              {inspecciones.length})
            </Text>
            <Ionicons
              name="chevron-down"
              size={20}
              color={COLORS.primary}
            />
          </TouchableOpacity>
        )}
      </>
    )}
  </View>
)}


       {activeTab === "cronogramas" && (
  <View style={styles.section}>
    <View style={styles.sectionHeader}>
      {puedeCrearCronograma && (
        <TouchableOpacity
          style={styles.createButton}
          onPress={crearCronograma}
        >
          <Ionicons
            name="clipboard-outline"
            size={20}
            color={COLORS.card}
          />
          <Text style={styles.createButtonText}>
            Crear Cronograma de Trabajo
          </Text>
        </TouchableOpacity>
      )}
    </View>

    {cronogramas.length === 0 ? (
      <View style={styles.emptyState}>
        <Ionicons
          name="clipboard-outline"
          size={48}
          color={COLORS.textSecondary}
        />
        <Text style={styles.emptyStateText}>
          No hay cronogramas creados aún.
        </Text>
      </View>
    ) : (
      <>
        {/* LISTADO PAGINADO */}
        {paginar(cronogramas, paginaCronogramas).map((cronograma) => (
          <View key={cronograma.id} style={styles.formularioCard}>
            <View style={styles.formularioHeader}>
              <Text style={styles.formularioTitle}>
                CRONOGRAMA DE TRABAJO
              </Text>
            </View>

            <View style={styles.formularioInfo}>
              <Text style={styles.formularioLabel}>Consecutivo:</Text>
              <Text style={styles.formularioValue}>
                {cronograma.consecutivo || "Sin consecutivo"}
              </Text>
            </View>

            <View style={styles.formularioInfo}>
              <Text style={styles.formularioLabel}>Supervisor:</Text>
              <Text style={styles.formularioValue}>
                {cronograma.usuario?.name || "Usuario desconocido"}
              </Text>
            </View>

            <View style={styles.formularioInfo}>
              <Text style={styles.formularioLabel}>
                Fecha cronograma:
              </Text>
              <Text style={styles.formularioValue}>
                {cronograma.created_at
                  ? new Date(cronograma.created_at).toLocaleDateString()
                  : "Sin fecha"}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.openFormButton}
              onPress={() => abrirCronograma(cronograma.id)}
            >
              <Text style={styles.openFormButtonText}>
                Abrir Cronograma
              </Text>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={COLORS.primary}
              />
            </TouchableOpacity>
          </View>
        ))}

        {/* BOTÓN VER MÁS */}
        {cronogramas.length > paginaCronogramas * ITEMS_POR_PAGINA && (
          <TouchableOpacity
            style={styles.verMasButton}
            onPress={() => setPaginaCronogramas(p => p + 1)}
          >
            <Text style={styles.verMasText}>
              Ver más ({paginaCronogramas * ITEMS_POR_PAGINA} de {cronogramas.length})
            </Text>
            <Ionicons
              name="chevron-down"
              size={20}
              color={COLORS.card}
            />
          </TouchableOpacity>
        )}
      </>
    )}
  </View>
)}


         {activeTab === "acta_reunion" && (
  <View style={styles.section}>
    <View style={styles.sectionHeader}>
      {puedeCrearActaReunion && (
        <TouchableOpacity
          style={styles.createButton}
          onPress={crearActaReunion}
        >
          <Ionicons
            name="clipboard-outline"
            size={20}
            color={COLORS.card}
          />
          <Text style={styles.createButtonText}>
            Crear Acta de Reunión
          </Text>
        </TouchableOpacity>
      )}
    </View>

    {actasReunion.length === 0 ? (
      <View style={styles.emptyState}>
        <Ionicons
          name="clipboard-outline"
          size={48}
          color={COLORS.textSecondary}
        />
        <Text style={styles.emptyStateText}>
          No hay actas de reunión creadas aún.
        </Text>
      </View>
    ) : (
      <>
        {/* LISTADO PAGINADO */}
        {paginar(actasReunion, paginaActasReunion).map((acta) => (
          <View key={acta.id} style={styles.formularioCard}>
            <View style={styles.formularioHeader}>
              <Text style={styles.formularioTitle}>
                ACTA DE REUNIÓN
              </Text>
            </View>

            <View style={styles.formularioInfo}>
              <Text style={styles.formularioLabel}>Consecutivo:</Text>
              <Text style={styles.formularioValue}>
                {acta.consecutivo || "Sin consecutivo"}
              </Text>
            </View>

            <View style={styles.formularioInfo}>
              <Text style={styles.formularioLabel}>Supervisor:</Text>
              <Text style={styles.formularioValue}>
                {acta.supervisor?.name || "Usuario desconocido"}
              </Text>
            </View>

            <View style={styles.formularioInfo}>
              <Text style={styles.formularioLabel}>
                Fecha de Acta:
              </Text>
              <Text style={styles.formularioValue}>
                {acta.created_at
                  ? new Date(acta.created_at).toLocaleDateString()
                  : "Sin fecha"}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.openFormButton}
              onPress={() => abrirActareunion(acta.id)}
            >
              <Text style={styles.openFormButtonText}>
                Abrir Acta
              </Text>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={COLORS.primary}
              />
            </TouchableOpacity>
          </View>
        ))}

        {/* BOTÓN VER MÁS */}
        {actasReunion.length > paginaActasReunion * ITEMS_POR_PAGINA && (
          <TouchableOpacity
            style={styles.verMasButton}
            onPress={() => setPaginaActasReunion(p => p + 1)}
          >
            <Text style={styles.verMasText}>
              Ver más ({paginaActasReunion * ITEMS_POR_PAGINA} de {actasReunion.length})
            </Text>
            <Ionicons
              name="chevron-down"
              size={20}
              color={COLORS.card}
            />
          </TouchableOpacity>
        )}
      </>
    )}
  </View>
)}


       {activeTab === "evaluaciones" && (
  <View style={styles.section}>
    <View style={styles.sectionHeader}>
      {puedeCrearEvaluacion && (
        <TouchableOpacity
          style={styles.createButton}
          onPress={crearNuevaEvaluacion}
        >
          <Ionicons
            name="star-outline"
            size={20}
            color={COLORS.card}
          />
          <Text style={styles.createButtonText}>
            Crear Evaluación
          </Text>
        </TouchableOpacity>
      )}
    </View>

    {evaluaciones.length === 0 ? (
      <View style={styles.emptyState}>
        <Ionicons
          name="star-outline"
          size={48}
          color={COLORS.textSecondary}
        />
        <Text style={styles.emptyStateText}>
          No hay evaluaciones creadas aún.
        </Text>
        {puedeCrearEvaluacion && (
          <Text style={styles.emptyStateText}>
            Presiona "Crear Evaluación" para comenzar.
          </Text>
        )}
      </View>
    ) : (
      <>
        {/* LISTADO PAGINADO */}
        {paginar(evaluaciones, paginaEvaluaciones).map((evaluacion) => (
          <View key={evaluacion.id} style={styles.formularioCard}>
            <View style={styles.formularioHeader}>
              <Text style={styles.formularioTitle}>
                EVALUACIÓN DEL SERVICIO
              </Text>
            </View>

            <View style={styles.formularioInfo}>
              <Text style={styles.formularioLabel}>Consecutivo:</Text>
              <Text style={styles.formularioValue}>
                {evaluacion.consecutivo || "Sin consecutivo"}
              </Text>
            </View>

            <View style={styles.formularioInfo}>
              <Text style={styles.formularioLabel}>Cliente/Zona:</Text>
              <Text style={styles.formularioValue}>
                {evaluacion.cliente_zona || "No especificado"}
              </Text>
            </View>

            <View style={styles.formularioInfo}>
              <Text style={styles.formularioLabel}>Calificación:</Text>
              <Text style={styles.formularioValue}>
                {getCalificacionTexto(evaluacion)}
              </Text>
            </View>

            <View style={styles.formularioInfo}>
              <Text style={styles.formularioLabel}>
                Fecha evaluación:
              </Text>
              <Text style={styles.formularioValue}>
                {evaluacion.fecha_evaluacion || "Sin fecha"}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.openFormButton}
              onPress={() => abrirEvaluacion(evaluacion.id)}
            >
              <Text style={styles.openFormButtonText}>
                Abrir Evaluación
              </Text>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={COLORS.primary}
              />
            </TouchableOpacity>
          </View>
        ))}

        {/* BOTÓN VER MÁS */}
        {evaluaciones.length > paginaEvaluaciones * ITEMS_POR_PAGINA && (
          <TouchableOpacity
            style={styles.verMasButton}
            onPress={() => setPaginaEvaluaciones(p => p + 1)}
          >
            <Text style={styles.verMasText}>
              Ver más ({paginaEvaluaciones * ITEMS_POR_PAGINA} de {evaluaciones.length})
            </Text>
            <Ionicons
              name="chevron-down"
              size={20}
              color={COLORS.card}
            />
          </TouchableOpacity>
        )}
      </>
    )}
  </View>
)}



        
{activeTab === "inicio_servicio" && (
  <View style={styles.section}>
    <View style={styles.sectionHeader}>
      {puedeCrearInicioServicio && (
        <TouchableOpacity
          style={styles.createButton}
          onPress={InicioServicio}
        >
          <Ionicons name="add" size={20} color={COLORS.card} />
          <Text style={styles.createButtonText}>
            Crear Planilla Inicio de Servicio
          </Text>
        </TouchableOpacity>
      )}
    </View>

    {formulariosInicioServicio.length === 0 ? (
      <View style={styles.emptyState}>
        <Ionicons
          name="document-outline"
          size={48}
          color={COLORS.textSecondary}
        />
        <Text style={styles.emptyStateText}>
          {puedeCrearInicioServicio
            ? 'No hay planillas de inicio de servicio. Presiona "Crear Planilla Inicio de Servicio" para comenzar.'
            : "No hay formularios disponibles."}
        </Text>
      </View>
    ) : (
      <>
        {/* LISTADO PAGINADO */}
        {paginar(formulariosInicioServicio, paginaInicioServicio).map(
          (formulario) => (
            <View key={formulario.id} style={styles.formularioCard}>
              <View style={styles.formularioHeader}>
                <Text style={styles.formularioTitle}>
                  PLANILLA DE INICIO DE SERVICIO
                </Text>
              </View>

              <View style={styles.formularioInfo}>
                <Text style={styles.formularioLabel}>Supervisor:</Text>
                <Text style={styles.formularioValue}>
                  {formulario.supervisor?.name || "Sin asignar"}
                </Text>
              </View>

              <View style={styles.formularioInfo}>
                <Text style={styles.formularioLabel}>Creado por:</Text>
                <Text style={styles.formularioValue}>
                  {formulario.creador?.name || "Usuario desconocido"}
                </Text>
              </View>

              <View style={styles.formularioInfo}>
                <Text style={styles.formularioLabel}>Fecha:</Text>
                <Text style={styles.formularioValue}>
                  {new Date(formulario.created_at).toLocaleDateString()}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.openFormButton}
                onPress={() =>
                  abrirFormularioInicioServicio(formulario.id)
                }
              >
                <Text style={styles.openFormButtonText}>
                  Abrir Formulario
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={COLORS.primary}
                />
              </TouchableOpacity>
            </View>
          )
        )}

        {/* BOTÓN VER MÁS */}
        {formulariosInicioServicio.length >
          paginaInicioServicio * ITEMS_POR_PAGINA && (
          <TouchableOpacity
            style={styles.verMasButton}
            onPress={() =>
              setPaginaInicioServicio((p) => p + 1)
            }
          >
            <Text style={styles.verMasText}>
              Ver más (
              {paginaInicioServicio * ITEMS_POR_PAGINA} de{" "}
              {formulariosInicioServicio.length})
            </Text>
            <Ionicons
              name="chevron-down"
              size={20}
              color={COLORS.card}
            />
          </TouchableOpacity>
        )}
      </>
    )}
  </View>
)}


      {activeTab === "novedades" && (
  <View style={styles.section}>
    {/* BOTÓN CREAR NOVEDAD */}
    <View style={styles.sectionHeader}>
      {puedeCrearNovedadesServicio && (
        <TouchableOpacity
          style={styles.createButton}
          onPress={NovedadesServicio}
        >
          <Ionicons name="add" size={20} color={COLORS.card} />
          <Text style={styles.createButtonText}>
            Crear Planilla Novedades de Servicio
          </Text>
        </TouchableOpacity>
      )}
    </View>

    {/* ESTADO VACÍO */}
    {novedadesServicio.length === 0 ? (
      <View style={styles.emptyState}>
        <Ionicons
          name="document-outline"
          size={48}
          color={COLORS.textSecondary}
        />
        <Text style={styles.emptyStateText}>
          {puedeCrearNovedadesServicio
            ? 'No hay planillas de novedades de servicio. Presiona "Crear Planilla Novedades de Servicio" para comenzar.'
            : "No hay formularios disponibles."}
        </Text>
      </View>
    ) : (
      <>
        {/* LISTA PAGINADA */}
        {paginar(novedadesServicio, paginaNovedadesServicio).map(
          (novedad) => (
            <View key={novedad.id} style={styles.formularioCard}>
              <View style={styles.formularioHeader}>
                <Text style={styles.formularioTitle}>
                  PLANILLA DE NOVEDADES DE SERVICIO
                </Text>
              </View>

              <View style={styles.formularioInfo}>
                <Text style={styles.formularioLabel}>Supervisor:</Text>
                <Text style={styles.formularioValue}>
                  {novedad.supervisor?.name || "Sin asignar"}
                </Text>
              </View>

              <View style={styles.formularioInfo}>
                <Text style={styles.formularioLabel}>Creado por:</Text>
                <Text style={styles.formularioValue}>
                  {novedad.creador?.name || "Usuario desconocido"}
                </Text>
              </View>

              <View style={styles.formularioInfo}>
                <Text style={styles.formularioLabel}>Fecha creación:</Text>
                <Text style={styles.formularioValue}>
                  {new Date(novedad.created_at).toLocaleDateString()}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.openFormButton}
                onPress={() =>
                  abrirFormularioNovedadesServicio(novedad.id)
                }
              >
                <Text style={styles.openFormButtonText}>
                  Abrir Formulario
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={COLORS.primary}
                />
              </TouchableOpacity>
            </View>
          )
        )}

        {/* BOTÓN VER MÁS */}
        {novedadesServicio.length >
          paginaNovedadesServicio * ITEMS_POR_PAGINA && (
          <TouchableOpacity
            style={styles.verMasButton}
            onPress={() =>
              setPaginaNovedadesServicio((p) => p + 1)
            }
          >
            <Text style={styles.verMasText}>
              Ver más (
              {paginaNovedadesServicio * ITEMS_POR_PAGINA} de{" "}
              {novedadesServicio.length})
            </Text>
            <Ionicons
              name="chevron-down"
              size={20}
              color={COLORS.card}
            />
          </TouchableOpacity>
        )}
      </>
    )}
  </View>
)}

      </ScrollView>

      {/* Modal para cambiar supervisor */}
      <Modal
        visible={showCambiarSupervisorModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCambiarSupervisorModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Cambiar Supervisor</Text>

            <ScrollView style={styles.empleadosList}>
              {empleados.map((empleado) => (
                <TouchableOpacity
                  key={empleado.id}
                  style={styles.empleadoItem}
                  onPress={() => cambiarSupervisor(empleado.id)}
                >
                  <Text style={styles.empleadoName}>
                    {empleado.name || "Empleado sin nombre"}
                  </Text>
                  {registro?.supervisor_id === empleado.id && (
                    <Ionicons
                      name="checkmark"
                      size={20}
                      color={COLORS.success}
                    />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setShowCambiarSupervisorModal(false)}
            >
              <Text style={styles.modalCancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal de Documentos */}
      <Modal
        visible={showDocumentosModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.container}>
          <View style={styles.documentsModalHeader}>
            <TouchableOpacity onPress={() => setShowDocumentosModal(false)}>
              <Ionicons name="close" size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.documentsModalTitle}>
              Documentos - {registro?.empresa.nombre}
            </Text>
            <View style={styles.headerActions}>
              <TouchableOpacity
                onPress={() => setShowCrearCarpetaModal(true)}
                style={styles.headerButton}
              >
                <Ionicons
                  name="folder-outline"
                  size={20}
                  color={COLORS.primary}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={subirDocumento}
                style={styles.headerButton}
                disabled={uploadingDocument}
              >
                {uploadingDocument ? (
                  <ActivityIndicator size="small" color={COLORS.primary} />
                ) : (
                  <Ionicons
                    name="cloud-upload-outline"
                    size={20}
                    color={COLORS.primary}
                  />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Breadcrumb de navegación */}
          {rutaCarpetas.length > 0 && (
            <View style={styles.breadcrumb}>
              <TouchableOpacity
                onPress={() => {
                  setCarpetaActual(null);
                  setRutaCarpetas([]);
                  loadDocumentos();
                }}
              >
                <Text style={styles.breadcrumbItem}>📁 Raíz</Text>
              </TouchableOpacity>
              {rutaCarpetas.map((carpeta, index) => (
                <View key={carpeta.id} style={styles.breadcrumbContainer}>
                  <Text style={styles.breadcrumbSeparator}> {">"} </Text>
                  <TouchableOpacity
                    onPress={() => {
                      const nuevaRuta = rutaCarpetas.slice(0, index + 1);
                      setCarpetaActual(carpeta);
                      setRutaCarpetas(nuevaRuta);
                      loadDocumentos(carpeta.id);
                    }}
                  >
                    <Text style={styles.breadcrumbItem}>
                      📁 {carpeta.nombre}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Botón de volver atrás */}
          {carpetaActual && (
            <TouchableOpacity
              style={styles.backToParent}
              onPress={navegarAtras}
            >
              <Ionicons name="arrow-back" size={20} color={COLORS.primary} />
              <Text style={styles.backToParentText}>Volver atrás</Text>
            </TouchableOpacity>
          )}

          {loadingDocuments ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.loadingText}>Cargando documentos...</Text>
            </View>
          ) : (
            <ScrollView style={styles.documentsContent}>
              {/* Lista de carpetas */}
              {carpetas.map((carpeta) => (
                <TouchableOpacity
                  key={carpeta.id}
                  style={styles.documentItem}
                  onPress={() => navegarACarpeta(carpeta)}
                >
                  <View style={styles.documentInfo}>
                    <Ionicons name="folder" size={32} color={COLORS.warning} />
                    <View style={styles.documentDetails}>
                      <Text style={styles.documentName}>{carpeta.nombre}</Text>
                      <Text style={styles.documentDate}>
                        Creada:{" "}
                        {new Date(carpeta.created_at).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>
                  {(user?.userData?.role === "admin" ||
                    user?.userData?.role === "root") && (
                    <TouchableOpacity
                      onPress={() => eliminarCarpeta(carpeta)}
                      style={styles.deleteDocumentButton}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={20}
                        color={COLORS.error}
                      />
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              ))}

              {/* Lista de documentos */}
              {documentos.map((documento) => {
                // Debug: verificar rol del usuario
                console.log("🔍 Debug permisos documento:", {
                  documentoId: documento.id,
                  userRole: user?.userData?.role,
                  canDelete:
                    user?.userData?.role === "admin" ||
                    user?.userData?.role === "root",
                });

                return (
                  <View key={documento.id} style={styles.documentItem}>
                    <View style={styles.documentInfo}>
                      <Ionicons
                        name={
                          documento.tipo && documento.tipo.includes("image")
                            ? "image"
                            : documento.tipo && documento.tipo.includes("pdf")
                              ? "document"
                              : documento.tipo &&
                                  documento.tipo.includes("video")
                                ? "videocam"
                                : "document-text"
                        }
                        size={32}
                        color={COLORS.primary}
                      />
                      <View style={styles.documentDetails}>
                        <Text style={styles.documentName}>
                          {documento.nombre_original || "Documento sin nombre"}
                        </Text>
                        <Text style={styles.documentDate}>
                          {documento.tamaño
                            ? formatFileSize(documento.tamaño)
                            : "0 KB"}{" "}
                          •{" "}
                          {new Date(documento.created_at).toLocaleDateString()}
                        </Text>
                        <Text style={styles.documentUser}>
                          Subido por:{" "}
                          {typeof documento.usuario === "string"
                            ? documento.usuario
                            : documento.usuario?.name || "Usuario desconocido"}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.documentActions}>
                      <TouchableOpacity
                        onPress={() => descargarDocumento(documento)}
                        style={styles.downloadButton}
                      >
                        <Ionicons
                          name="download"
                          size={20}
                          color={COLORS.primary}
                        />
                      </TouchableOpacity>
                      {(user?.userData?.role === "admin" ||
                        user?.userData?.role === "root") && (
                        <TouchableOpacity
                          onPress={() => eliminarDocumento(documento)}
                          style={styles.deleteDocumentButton}
                        >
                          <Ionicons
                            name="trash"
                            size={20}
                            color={COLORS.danger}
                          />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })}

              {carpetas.length === 0 && documentos.length === 0 && (
                <View style={styles.emptyDocuments}>
                  <Ionicons
                    name="folder-open-outline"
                    size={64}
                    color={COLORS.textSecondary}
                  />
                  <Text style={styles.emptyDocumentsText}>
                    {carpetaActual
                      ? "Esta carpeta está vacía"
                      : "No hay documentos"}
                  </Text>
                  <Text style={styles.emptyDocumentsSubtext}>
                    Presiona + para crear una carpeta o ☁️ para subir documentos
                  </Text>
                </View>
              )}
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* Modal Crear Carpeta */}
      <Modal
        visible={showCrearCarpetaModal}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.createFolderModalOverlay}>
          <View style={styles.createFolderModalContent}>
            <Text style={styles.modalTitle}>Nueva Carpeta</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Nombre de la carpeta"
              value={nombreNuevaCarpeta}
              onChangeText={setNombreNuevaCarpeta}
              autoFocus={true}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setShowCrearCarpetaModal(false);
                  setNombreNuevaCarpeta("");
                }}
              >
                <Text style={styles.modalCancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmButton}
                onPress={crearCarpeta}
              >
                <Text style={styles.modalConfirmButtonText}>Crear</Text>
              </TouchableOpacity>
            </View>
          </View>
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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.background,
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: COLORS.error,
    textAlign: "center",
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  backButtonText: {
    color: COLORS.card,
    fontSize: 16,
    fontWeight: "600",
  },
  scrollView: {
    flex: 1,
    marginBottom: 12,
  },
  headerCard: {
    backgroundColor: COLORS.card,
    margin: 16,
    padding: 20,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  backIcon: {
    marginRight: 12,
  },
  headerTitle: {
    flex: 1,
    fontSize: 24,
    fontWeight: "bold",
    color: COLORS.textPrimary,
  },
  editIcon: {
    marginLeft: 12,
  },
  infoRow: {
    flexDirection: "row",
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textSecondary,
    width: 120,
  },
  infoValue: {
    flex: 1,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  section: {
    backgroundColor: COLORS.card,
    margin: 16,
    top: 0,
    padding: 20,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: COLORS.textPrimary,
  },
  sectionTitleForm: {
    fontSize: 28,
    fontWeight: "bold",
    color: COLORS.textPrimary,
    textAlign: "center",
  },
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  documentsButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.warning,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  createButtonText: {
    color: COLORS.card,
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 4,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginTop: 16,
    lineHeight: 24,
  },
  formularioCard: {
    backgroundColor: COLORS.background,
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  formularioHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  formularioTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.textPrimary,
  },
  deleteButton: {
    padding: 4,
  },
  formularioInfo: {
    flexDirection: "row",
    marginBottom: 8,
  },
  formularioLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.textSecondary,
    width: 100,
  },
  formularioValue: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  estadoBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  estadoText: {
    color: COLORS.card,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  tabsContainer: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  activeTab: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },

  tabText: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.textPrimary,
  },

  activeTabText: {
    color: COLORS.card,
    fontWeight: "700",
  },

  openFormButton: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: COLORS.card,
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  openFormButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: COLORS.card,
    width: "80%",
    maxHeight: "70%",
    borderRadius: 12,
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: COLORS.textPrimary,
    textAlign: "center",
    marginBottom: 20,
  },
  empleadosList: {
    maxHeight: 300,
  },
  empleadoItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  empleadoName: {
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  modalCancelButton: {
    backgroundColor: COLORS.textSecondary,
    padding: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  modalCancelButtonText: {
    color: COLORS.card,
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },

  // --- Estilos para Sistema de Documentos ---
  documentsModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    paddingTop: 60,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  documentsModalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.textPrimary,
    flex: 1,
    textAlign: "center",
  },
  headerActions: {
    flexDirection: "row",
    gap: 12,
  },
  headerButton: {
    backgroundColor: COLORS.background,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  breadcrumb: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    flexWrap: "wrap",
  },
  breadcrumbContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  breadcrumbItem: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: "500",
  },
  breadcrumbSeparator: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginHorizontal: 4,
  },
  backToParent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backToParentText: {
    marginLeft: 8,
    fontSize: 16,
    color: COLORS.primary,
    fontWeight: "500",
  },
  documentsContent: {
    flex: 1,
    padding: 16,
  },
  documentItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: COLORS.card,
    padding: 16,
    marginBottom: 12,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  documentInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  documentDetails: {
    marginLeft: 12,
    flex: 1,
  },
  documentName: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textPrimary,
  },
  documentDate: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  documentUser: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
    fontStyle: "italic",
  },
  deleteDocumentButton: {
    padding: 8,
    backgroundColor: COLORS.background,
    borderRadius: 6,
  },
  emptyDocuments: {
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyDocumentsText: {
    fontSize: 18,
    color: COLORS.textSecondary,
    marginTop: 16,
    fontWeight: "600",
  },
  emptyDocumentsSubtext: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 8,
    textAlign: "center",
  },
  createFolderModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  createFolderModalContent: {
    backgroundColor: COLORS.card,
    margin: 20,
    borderRadius: 12,
    padding: 24,
    minWidth: 300,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginTop: 16,
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  modalConfirmButton: {
    flex: 1,
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  modalConfirmButtonText: {
    color: COLORS.card,
    fontWeight: "600",
    fontSize: 16,
  },
  // Estilos para botón de visita
  visitaButtonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F9F9F9",
    padding: 14,
    borderRadius: 16,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },

  crearVisitaButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },

  visitaButton: {
    backgroundColor: "#4CAF50",
  },

  evaluacionButton: {
    backgroundColor: "#9C27B0",
  },

  crearVisitaButtonText: {
    color: "white",
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  visitaHint: {
    fontSize: 12,
    color: "#2E7D32",
    textAlign: "center",
    marginTop: 8,
    fontStyle: "italic",
  },
  documentActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  downloadButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  hintsContainer: {
    gap: 5,
    marginBottom: 10,
  },
  verMasButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#167cfc",
    borderWidth: 1,
    borderColor: "white",
    borderRadius: 8,
    padding: 12,
    marginTop: 10,
    marginBottom: 20,
    gap: 8,
  },
  verMasText: {
    color: "white",
    fontSize: 14,
    fontWeight: "bold",
  },
});
