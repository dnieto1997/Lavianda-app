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
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import DateTimePicker from "@react-native-community/datetimepicker";
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Path, SvgXml } from 'react-native-svg';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from './_layout';
import { subirFotoEvidencia, eliminarFotoEvidencia, obtenerUrlFoto } from '../services/evidenciasService';
import SimpleSignaturePad from '../components/SimpleSignaturePad';
import { useLocation } from '@/contexts/LocationContext';

const COLORS = {
  primary: '#1E3A8A',        // Azul corporativo más elegante
  secondary: '#3B82F6',      // Azul secundario
  success: '#10B981',        // Verde moderno
  warning: '#F59E0B',        // Amarillo profesional
  danger: '#EF4444',         // Rojo moderno
  background: '#F8FAFC',     // Gris muy claro
  surface: '#FFFFFF',        // Blanco puro
  surfaceSecondary: '#F1F5F9', // Gris claro para alternancia
  textPrimary: '#1F2937',    // Gris oscuro
  textSecondary: '#6B7280',  // Gris medio
  border: '#E5E7EB',         // Gris claro para bordes
  borderDark: '#D1D5DB',     // Gris más oscuro para bordes
};

const API_BASE = 'https://operaciones.lavianda.com.co/api';

type ValorAgregadoField = 'descripcion' | 'cantidad' | 'frecuencia';

interface InventarioItem {
  maquinaria_equipo: string;
  cantidad: string;
  descripcion_estado: string;
}
interface PersonalItem {
  lugar_servicio: string;
  trabajadores: string;
  cargo: string;
  salario: string;
  subsidio_transporte: string;
  horario: string;
  examenes: string;
  arl: string;
  dotacion: string;
  epp: string;
  observaciones: string;
}
interface TipoInsumoItem {
  nombre: string;   // nombre del insumo
  cantidad: string; // cantidad
  descripcion: string; // descripción opcional
}


interface FormularioData {
  // Datos generales (automáticos)
  consecutivo: string;
  empresa: string;
  nit_cedula: string;
  direccion: string;
  ciudad: string;
  persona_encargada: string;
  correo: string;
  telefono: string;

  // Datos del formulario (fecha y horas automáticas)
  fecha: string;
  hora_inicio: string;
  hora_fin: string;

  // Información del contrato (NUEVA SECCIÓN)
  fecha_inicio: string;        // DatePicker
  duracion: string;            // Ej: "6 meses"
  tipo_servicio: string;       // Texto libre
  polizas: string;             // Sí / No
  poliza_cual: string;         // Descripción
  condiciones_pago: string;    // Ej: "30 días"
  fecha_limite: string;        // DatePicker
  correo_factura: string;      // correo@empresa.com
  soportes: string;            // Documentos requeridos

  // Inventario
  inventario: InventarioItem[];
  personal: PersonalItem[];

  // Tipo de insumos con categorías dinámicas
  tipo_insumos: {
    [key: string]: {
      active: boolean;            // Checkbox activado
      items: TipoInsumoItem[];   // Lista de ítems
    };
  };

  // Valores agregados
  valores_agregados_na?: boolean;
  valores_agregados: {
    descripcion: string;
    cantidad: string;
    frecuencia: string;
  }[];

  // Observaciones
  observaciones_generales: string;

  // Firma digital
  firma_responsable?: string;
  nombre_firmante?: string;
  cedula_firmante?: string;

  // Timestamps
  created_at?: string;
  updated_at?: string;
}








export default function FormularioInicioServicio() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();
  const { width } = Dimensions.get('window');


  const [saving, setSaving] = useState(false);
    const { startTracking, startBackgroundTracking } = useLocation();
    const [showFechaInicio, setShowFechaInicio] = useState(false);
const [showFechaLimite, setShowFechaLimite] = useState(false);
  
  // Estados para firma digital
  const [modalFirmaVisible, setModalFirmaVisible] = useState(false);
  const [firmaBase64, setFirmaBase64] = useState<string>('');
  const signatureRef = useRef<any>(null);
  
  // Variables de modo
  const modo = params?.modo as string || 'crear';
  const formularioId = params?.formularioId as string;
  const esVisualizacion = modo === 'ver';
  const esModoCrear = modo === 'crear';
  const esModoEditar = modo === 'editar';
  const puedeEditar = esModoCrear || esModoEditar;

  const INSUMOS_CATEGORIAS = [
  "ASEO",
  "CAFETERIA",
  "JARDINERIA",
  "PISCINA",
  "ASEO_PERSONAL",
  "NA"
];
  
  // Datos iniciales automáticos con áreas predefinidas
  const [formData, setFormData] = useState<FormularioData>({
  consecutivo: '',
  empresa: '',
  nit_cedula: '',
  direccion: '',
  ciudad: '',
  persona_encargada: '',
  correo: '',
  telefono: '',

  // Fechas y horas automáticas
  fecha: new Date().toISOString().split('T')[0],
  hora_inicio: new Date().toTimeString().slice(0, 5),
  hora_fin: '',

  // Información del contrato
  fecha_inicio: '',
  duracion: '',
  tipo_servicio: '',
  polizas: '',
  poliza_cual: '',
  condiciones_pago: '',
  fecha_limite: '',
  correo_factura: '',
  soportes: '',

  // Inventario
  inventario: [
    { maquinaria_equipo: '', cantidad: '', descripcion_estado: '' }
  ],

  // Tipo de insumos
  tipo_insumos: INSUMOS_CATEGORIAS.reduce((acc, cat) => ({
    ...acc,
    [cat]: {
      active: false,
      items: [
        { nombre: "", cantidad: "", descripcion: "" }
      ]
    }
  }), {}),

  // Personal
  personal: [
    {
      lugar_servicio: '',
      trabajadores: '',
      cargo: '',
      salario: '',
      subsidio_transporte: '',
      horario: '',
      examenes: '',
      arl: '',
      dotacion: '',
      epp: '',
      observaciones: '',
    }
  ],

  // Valores agregados
  valores_agregados_na: false,
  valores_agregados: [
    { descripcion: '', cantidad: '', frecuencia: '' }
  ],

  // Observaciones
  observaciones_generales: '',

  // Firma digital (opcionales)
  firma_responsable: '',
  nombre_firmante: '',
  cedula_firmante: '',

  // Timestamps (opcionales)
  created_at: '',
  updated_at: '',
});





  // Función para obtener datos del registro y empresa
  const obtenerDatosEmpresa = async (registroId: string) => {
    console.log('🔍 Iniciando obtención de datos para registro:', registroId);
    
    try {
      // Primero intentar usar datos de params si están disponibles
      if (params?.empresa) {
        console.log('📋 Datos disponibles en params:', {
          empresa: params.empresa,
          nit: params.nit || 'No disponible'
        });
        
        setFormData(prev => ({
          ...prev,
          empresa: params.empresa as string,
          nit_cedula: params.nit as string || '',
          ciudad:params.ciudad as string ||''
        }));
        
        // Si no hay NIT en params, consultar API
        if (!params.nit) {
          console.log('🌐 NIT no disponible en params, consultando API...');
          await consultarDatosCompletos(registroId);
        }
        return;
      }

      // Si no hay datos en params, consultar API
      console.log('🌐 Datos no disponibles en params, consultando API...');
      await consultarDatosCompletos(registroId);
      
    } catch (error) {
      console.log('💥 Error general en obtenerDatosEmpresa:', error);
    }
  };

  // Función auxiliar para consultar datos completos de la API
  const consultarDatosCompletos = async (registroId: string) => {
    try {
      // Intentar obtener token del contexto de usuario PRIMERO
      let token = user?.token;
      console.log('🔑 Token del contexto:', token ? 'SÍ EXISTE' : 'NO EXISTE');
      
      // Si no hay token en el contexto, intentar AsyncStorage como fallback
      if (!token) {
        console.log('🔄 Intentando obtener token de AsyncStorage...');
        const storageToken = await AsyncStorage.getItem('authToken');
        token = storageToken || undefined;
        console.log('🔑 Token de AsyncStorage:', token ? 'SÍ EXISTE' : 'NO EXISTE');
      }
      
      if (token) {
        console.log('✅ Token válido encontrado, haciendo llamada a API...');
        try {
          const response = await axios.get(
            `${API_BASE}/registros-clientes/${registroId}`,
            {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
            }
          );
          
          console.log('📦 Respuesta completa de la API:', response.data);
          
          if (response.data?.registro) {
            const registro = response.data.registro;
            console.log('📋 Datos del registro:', registro);
            
            // Verificar si hay información de empresa en el registro
            if (registro.empresa) {
              console.log('🏢 Datos de empresa encontrados:', registro.empresa);
              
              setFormData(prev => ({
                ...prev,
                empresa: registro.empresa.nombre || '',
                nit_cedula: registro.empresa.identificacion || '',
                direccion: registro.empresa.direccion || '',
                ciudad:registro.empresa.ciudad||'',
                persona_encargada: registro.persona_encargada || '',
                correo: registro.correo || '',
                telefono: registro.telefono || '',
              }));
            } else {
              console.log('⚠️ No se encontraron datos de empresa en el registro');
              
              // Usar datos directos del registro si no hay empresa
              setFormData(prev => ({
                ...prev,
                empresa: registro.nombre_empresa || '',
                nit_cedula: registro.identificacion || '',
                direccion: registro.direccion || '',
                ciudad:registro.empresa.ciudad||'',
                persona_encargada: registro.persona_encargada || '',
                correo: registro.correo || '',
                telefono: registro.telefono || '',
              }));
            }
          } else {
            console.log('❌ No se encontraron datos en la respuesta');
          }
          
        } catch (error) {
          console.log('❌ Error en llamada a API:', error);
          if (axios.isAxiosError(error)) {
            console.log('📊 Status:', error.response?.status);
            console.log('📋 Data:', error.response?.data);
          }
        }
      } else {
        console.log('❌ No se pudo obtener token válido');
      }
    } catch (error) {
      console.log('💥 Error en consultarDatosCompletos:', error);
    }
  };

  // Función para generar consecutivo automático
  const generarConsecutivo = async () => {
    try {
      const storageToken = await AsyncStorage.getItem('authToken');
      const token = storageToken || undefined;
      
      if (!token) {
        console.log('⚠️ No hay token, generando consecutivo local');
        generarConsecutivoLocal();
        return;
      }

      console.log('🔄 Solicitando consecutivo al servidor...');
      const response = await axios.get(`${API_BASE}/formularios-inicio-servicio/siguiente-consecutivo`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('📋 Respuesta consecutivo:', response.data);

      if (response.data?.consecutivo) {
        console.log('✅ Consecutivo del servidor:', response.data.consecutivo);
        setFormData(prev => ({
          ...prev,
          consecutivo: response.data.consecutivo
        }));
      } else {
        console.log('⚠️ No se recibió consecutivo del servidor, generando local');
        generarConsecutivoLocal();
      }
    } catch (error) {
      console.log('❌ Error generando consecutivo del servidor:', error);
      generarConsecutivoLocal();
    }
  };

  // Función auxiliar para generar consecutivo local
  const generarConsecutivoLocal = () => {
    const fecha = new Date();
    const año = fecha.getFullYear();
    const mes = (fecha.getMonth() + 1).toString().padStart(2, '0');
    const dia = fecha.getDate().toString().padStart(2, '0');
    const numeroRandom = Math.floor(Math.random() * 9999) + 1; // 1-9999
    const consecutivo = `${año}${mes}${dia}${numeroRandom.toString().padStart(4, '0')}`;
    
    console.log('🔢 Consecutivo local generado:', consecutivo);
    
    setFormData(prev => ({
      ...prev,
      consecutivo: consecutivo
    }));
  };

  // Función para cargar formulario existente
  const cargarFormularioExistente = async (formularioId: string) => {
    console.log('📖 Cargando formulario existente con ID:', formularioId);
    
    try {
      // Intentar obtener token del contexto de usuario PRIMERO
      let token = user?.token;
      console.log('🔑 Token del contexto para cargar formulario:', token ? 'SÍ EXISTE' : 'NO EXISTE');
      
      // Si no hay token en el contexto, intentar AsyncStorage como fallback
      if (!token) {
        console.log('🔄 Intentando obtener token de AsyncStorage para cargar formulario...');
        const storageToken = await AsyncStorage.getItem('authToken');
        token = storageToken || undefined;
        console.log('🔑 Token de AsyncStorage para cargar formulario:', token ? 'SÍ EXISTE' : 'NO EXISTE');
      }
      
      if (token) {
        console.log('✅ Token válido encontrado, cargando formulario...');
        const response = await axios.get(
          `${API_BASE}/formularios-inicio-servicio/${formularioId}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          }
        );
        
        console.log('📦 Formulario cargado desde servidor:', response.data);
        
        if (response.data?.data) {
          const formulario = response.data.data;
          console.log('📋 Datos del formulario:', formulario);
          
          // Normalizar áreas con fotos
          const areasNormalizadas: any = {};
         
          
          // Cargar todos los datos del formulario
setFormData({
  consecutivo: formulario.consecutivo ?? '',
  empresa: formulario.empresa ?? '',
  nit_cedula: formulario.nit_cedula ?? '',
  direccion: formulario.direccion ?? '',
  persona_encargada: formulario.persona_encargada ?? '',
  correo: formulario.correo ?? '',
  telefono: formulario.telefono ?? '',
  ciudad: formulario.ciudad ?? '',

  // Fechas y horas automáticas
  fecha: formulario.fecha ?? '',
  hora_inicio: formulario.hora_inicio ?? '',
  hora_fin: formulario.hora_fin ?? '',

  // Información del contrato
  fecha_inicio: formulario.fecha_inicio ?? '',
  duracion: formulario.duracion ?? '',
  tipo_servicio: formulario.tipo_servicio ?? '',
  polizas: formulario.polizas ?? '',
  poliza_cual: formulario.poliza_cual ?? '',
  condiciones_pago: formulario.condiciones_pago ?? '',
  fecha_limite: formulario.fecha_limite ?? '',
  correo_factura: formulario.correo_factura ?? '',
  soportes: formulario.soportes ?? '',

  // INVENTARIO
  inventario:
    formulario.inventario?.length > 0
      ? formulario.inventario
      : [{ maquinaria_equipo: '', cantidad: '', descripcion_estado: '' }],


  personal:
    formulario.personal?.length > 0
      ? formulario.personal
      : [
          {
            lugar_servicio: '',
            trabajadores: '',
            cargo: '',
            salario: '',
            subsidio_transporte: '',
            horario: '',
            examenes: '',
            arl: '',
            dotacion: '',
            epp: '',
            observaciones: '',
          }
        ],

  // Tipo de insumos
  tipo_insumos: {
    ASEO: formulario.tipo_insumos?.ASEO ?? { active: false, items: [] },
    CAFETERIA: formulario.tipo_insumos?.CAFETERIA ?? { active: false, items: [] },
    JARDINERIA: formulario.tipo_insumos?.JARDINERIA ?? { active: false, items: [] },
    PISCINA: formulario.tipo_insumos?.PISCINA ?? { active: false, items: [] },
    ASEO_PERSONAL: formulario.tipo_insumos?.ASEO_PERSONAL ?? { active: false, items: [] },
    NA: formulario.tipo_insumos?.NA ?? { active: false, items: [] },
  },

  // Valores agregados
  valores_agregados:
    formulario.valores_agregados?.length > 0
      ? formulario.valores_agregados
      : [{ descripcion: '', cantidad: '', frecuencia: '' }],

  valores_agregados_na: formulario.valores_agregados_na ?? false,

  // Observaciones
  observaciones_generales: formulario.observaciones_generales ?? '',

  // Firma
  firma_responsable: formulario.firma_responsable ?? '',
  nombre_firmante: formulario.nombre_firmante ?? '',
  cedula_firmante: formulario.cedula_firmante ?? '',

  created_at: formulario.created_at ?? '',
  updated_at: formulario.updated_at ?? '',
});




           
          // Si hay firma guardada, también cargarla en el estado de firma
          if (formulario.firma_responsable) {
            console.log('✍️ Firma encontrada en el formulario');
            setFirmaBase64(formulario.firma_responsable);
          }
          
          console.log('✅ Formulario cargado exitosamente');
        } else {
          console.log('❌ No se encontraron datos del formulario');
          Alert.alert('Error', 'No se pudo cargar el formulario');
        }
        
      } else {
        console.log('❌ No se pudo obtener token para cargar formulario');
        Alert.alert('Error', 'No se encontró token de autenticación');
      }
      
    } catch (error) {
      console.log('💥 Error cargando formulario:', error);
      if (axios.isAxiosError(error)) {
        console.log('📊 Status de error:', error.response?.status);
        console.log('📋 Datos de error:', error.response?.data);
      }
      Alert.alert('Error', 'No se pudo cargar el formulario');
    }
  };

  useEffect(() => {
    console.log('🚀 Iniciando formulario con parámetros:', params);
    
    const modo = params?.modo as string;
    const formularioId = params?.formularioId as string;
    
    if ((modo === 'ver' || modo === 'editar') && formularioId) {
      // Modo ver/editar: cargar formulario existente
      console.log(`👁️ Modo ${modo.toUpperCase()} - Cargando formulario existente`);
      cargarFormularioExistente(formularioId);
    } else {
      // Modo crear: configurar nuevo formulario
      console.log('➕ Modo CREAR - Configurando nuevo formulario');
      
      // Generar consecutivo automáticamente
      generarConsecutivo();
      
      // Cargar datos si viene de un registro específico
      if (params?.registroId) {
        console.log('🔍 Intentando obtener NIT y más datos del registro:', params.registroId);
        obtenerDatosEmpresa(params.registroId as string);
      }
      
      // Configurar hora de fin automáticamente (1 hora después de inicio)
      const horaInicio = new Date();
      const horaFin = new Date(horaInicio.getTime() + 60 * 60 * 1000); // +1 hora
      setFormData(prev => ({
        ...prev,
        hora_fin: horaFin.toTimeString().slice(0, 5)
      }));
    }
  }, [params?.registroId, params?.modo, params?.formularioId]);

  // Función para exportar a PDF
  const exportarPDF = async () => {
  if (!formData.consecutivo) {
    Alert.alert("Error", "No se puede exportar un formulario sin datos");
    return;
  }

  try {
    Alert.alert(
      "Exportar PDF",
      "¿Desea exportar el formulario de Inicio de Servicio a PDF?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Exportar",
          onPress: async () => {
            try {
              console.log("📄 Exportando formulario:", formData.consecutivo);

              const htmlContent = `
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="utf-8">
                <title>Inicio de Servicio - ${formData.consecutivo}</title>
                <style>
                  body { font-family: Arial, sans-serif; margin: 20px; }
                  .header { text-align: center; margin-bottom: 30px; }
                  .title { font-size: 20px; font-weight: bold; }
                  .section { margin: 25px 0; }
                  .section-title { 
                    font-size: 16px; 
                    font-weight: bold; 
                    color: #680000; 
                    margin-bottom: 10px; 
                    border-bottom: 2px solid #680000;
                  }
                  .field { margin-bottom: 10px; }
                  .label { font-weight: bold; color: #222; }
                  .value { margin-top: 3px; padding: 7px; background: #f5f5f5; border-radius: 4px; }

                  table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                  th, td { border: 1px solid #ccc; padding: 8px; }
                  th { background: #eee; font-weight: bold; }
                </style>
              </head>
              <body>

                <div class="header">
                  <div class="title">FORMULARIO INICIO DE SERVICIO</div>
                  <div>Consecutivo: ${formData.consecutivo}</div>
                  <div>Fecha de creación: ${formData.fecha || ""}</div>
                </div>

                <!-- INFORMACIÓN GENERAL -->
                <div class="section">
                  <div class="section-title">INFORMACIÓN GENERAL</div>

                  <div class="field"><div class="label">Empresa:</div>
                    <div class="value">${formData.empresa || "No especificado"}</div>
                  </div>

                  <div class="field"><div class="label">NIT / Cédula:</div>
                    <div class="value">${formData.nit_cedula || "No especificado"}</div>
                  </div>

                  <div class="field"><div class="label">Ciudad:</div>
                    <div class="value">${formData.ciudad || "No especificado"}</div>
                  </div>

                  <div class="field"><div class="label">Dirección:</div>
                    <div class="value">${formData.direccion || "No especificado"}</div>
                  </div>

                  <div class="field"><div class="label">Persona Encargada:</div>
                    <div class="value">${formData.persona_encargada || "No especificado"}</div>
                  </div>

                  <div class="field"><div class="label">Correo:</div>
                    <div class="value">${formData.correo || "No especificado"}</div>
                  </div>

                  <div class="field"><div class="label">Teléfono:</div>
                    <div class="value">${formData.telefono || "No especificado"}</div>
                  </div>
                </div>

                <!-- DATOS DEL SERVICIO -->
                <div class="section">
                  <div class="section-title">DATOS DEL SERVICIO</div>

                  <div class="field"><div class="label">Fecha Inicio:</div>
                    <div class="value">${formData.fecha_inicio || "No especificado"}</div>
                  </div>

                  <div class="field"><div class="label">Hora de Inicio:</div>
                    <div class="value">${formData.hora_inicio || "No especificado"}</div>
                  </div>

                  <div class="field"><div class="label">Hora de Finalización:</div>
                    <div class="value">${formData.hora_fin || "No especificado"}</div>
                  </div>

                  <div class="field"><div class="label">Duración del Servicio:</div>
                    <div class="value">${formData.duracion || "No especificado"}</div>
                  </div>

                  <div class="field"><div class="label">Tipo de Servicio:</div>
                    <div class="value">${formData.tipo_servicio || "No especificado"}</div>
                  </div>

                  <div class="field"><div class="label">¿Requiere Pólizas?:</div>
                    <div class="value">${formData.polizas || "No especificado"}</div>
                  </div>

                  <div class="field"><div class="label">¿Cuál?:</div>
                    <div class="value">${formData.poliza_cual || "N/A"}</div>
                  </div>

                  <div class="field"><div class="label">Condiciones de Pago:</div>
                    <div class="value">${formData.condiciones_pago || "No especificado"}</div>
                  </div>

                  <div class="field"><div class="label">Fecha Límite:</div>
                    <div class="value">${formData.fecha_limite || "No especificado"}</div>
                  </div>

                  <div class="field"><div class="label">Correo de Facturación:</div>
                    <div class="value">${formData.correo_factura || "No especificado"}</div>
                  </div>
                </div>

                <!-- INVENTARIO -->
                <div class="section">
                  <div class="section-title">INVENTARIO</div>

                  <table>
                    <thead>
                      <tr>
                        <th>Maquinaria/Equipo</th>
                        <th>Cantidad</th>
                        <th>Descripción / Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${
                        formData.inventario
                          ?.map(
                            (item) => `
                        <tr>
                          <td>${item.maquinaria_equipo || "—"}</td>
                          <td>${item.cantidad || "—"}</td>
                          <td>${item.descripcion_estado || "—"}</td>
                        </tr>
                      `
                          )
                          .join("") || ""
                      }
                    </tbody>
                  </table>
                </div>

                <!-- INSUMOS -->
                <div class="section">
                  <div class="section-title">INSUMOS</div>

                  <table>
                    <thead>
                      <tr>
                        <th>Categoría</th>
                        <th>Insumo</th>
                        <th>Cantidad</th>
                        <th>Descripción</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${Object.entries(formData.tipo_insumos || {})
                        .map(([cat, data]) =>
                          data.items
                            .map(
                              (i) => `
                        <tr>
                          <td>${cat}</td>
                          <td>${i.nombre || "—"}</td>
                          <td>${i.cantidad || "—"}</td>
                          <td>${i.descripcion || "—"}</td>
                        </tr>`
                            )
                            .join("")
                        )
                        .join("")}
                    </tbody>
                  </table>
                </div>

                <!-- OBSERVACIONES -->
                <div class="section">
                  <div class="section-title">OBSERVACIONES GENERALES</div>
                  <div class="value">${formData.observaciones_generales || "Sin observaciones"}</div>
                </div>

                <!-- FIRMA -->
                ${
                  formData.firma_responsable
                    ? `
                <div class="section">
                  <div class="section-title">FIRMA DEL RESPONSABLE</div>

                  <div style="text-align:center; margin:20px 0;">
                    <img src="${formData.firma_responsable}" style="max-width:300px; border:1px solid #ccc; padding:10px;" />
                  </div>

                  <div class="field">
                    <div class="label">Nombre:</div>
                    <div class="value">${formData.nombre_firmante || "—"}</div>
                  </div>

                  <div class="field">
                    <div class="label">Cédula:</div>
                    <div class="value">${formData.cedula_firmante || "—"}</div>
                  </div>
                </div>`
                    : ""
                }

              </body>
              </html>
            `;

              // Generar PDF
              const { uri } = await Print.printToFileAsync({
                html: htmlContent,
                base64: false,
              });

              // Compartir en el dispositivo
              if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri, {
                  mimeType: "application/pdf",
                  dialogTitle: "Compartir PDF",
                });
              } else {
                Alert.alert("PDF Generado", uri);
              }
            } catch (e) {
              console.log("❌ Error PDF:", e);
              Alert.alert("Error", "No se pudo generar el PDF.");
            }
          },
        },
      ]
    );
  } catch (e) {
    console.log("❌ Error inesperado:", e);
  }
};




 const agregarItemPersonal = () => {
  setFormData(prev => ({
    ...prev,
    personal: [
      ...prev.personal,
      {
        lugar_servicio: '',
        trabajadores: '',
        cargo: '',
        salario: '',
        subsidio_transporte: '',
        horario: '',
        examenes: '',
        arl: '',
        dotacion: '',
        epp: '',
        observaciones: '',
      }
    ]
  }));
};

const eliminarItemPersonal = (index: number) => {
  setFormData(prev => ({
    ...prev,
    personal: prev.personal.filter((_, i) => i !== index)
  }));
};

const handlePersonalChange = (index: number, campo: any, valor: any) => {
  setFormData(prev => ({
    ...prev,
    personal: prev.personal.map((item, i) =>
      i === index ? { ...item, [campo]: valor } : item
    )
  }));
};






  const handleInventarioChange = (index: number, field: keyof InventarioItem, value: string) => {
    setFormData(prev => ({
      ...prev,
      inventario: prev.inventario.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      ),
    }));
  };

  const agregarItemInventario = () => {
    setFormData(prev => ({
      ...prev,
      inventario: [...prev.inventario, { maquinaria_equipo: '', cantidad: '', descripcion_estado: '' }]
    }));
  };

  const eliminarItemInventario = (index: number) => {
    if (formData.inventario.length > 1) {
      setFormData(prev => ({
        ...prev,
        inventario: prev.inventario.filter((_, i) => i !== index)
      }));
    }
  };

  // Función para iniciar el proceso de firma
  const iniciarProcesoDeFirma = () => {
    console.log('🖊️ === INICIANDO PROCESO DE FIRMA ===');
    console.log('📋 Empresa:', formData.empresa);
    
    if (!formData.empresa.trim()) {
      console.log('❌ Validación falló: empresa vacía');
      Alert.alert('Error', 'El campo empresa es obligatorio');
      return;
    }
    
    console.log('✅ Validación pasada, abriendo modal de firma');
    setModalFirmaVisible(true);
  };

  // Función para guardar la firma y proceder con el guardado del formulario
  const guardarFirma = (signature: string) => {
    console.log('✍️ === FIRMA CAPTURADA ===');
    console.log('📏 Longitud de la firma:', signature.length);
    console.log('🔤 Primeros 100 caracteres:', signature.substring(0, 100));
    
    setFirmaBase64(signature);
    setModalFirmaVisible(false);
  ;
    console.log('💾 Procediendo con el guardado del formulario...');
    // Ahora sí proceder con el guardado
    handleSubmit(signature);
  };

  // Función para limpiar la firma
  const limpiarFirma = () => {
    console.log('🧹 Limpiando firma...');
    signatureRef.current?.clear();
  };

  // Función para cancelar la firma
  const cancelarFirma = () => {
    console.log('❌ Cancelando proceso de firma');
    setModalFirmaVisible(false);
  };

  const handleSubmit = async (signatureData?: string) => {

    console.log('� === INICIO HANDLESUBMIT ===');
    console.log('�💾 Iniciando proceso de guardado...');
    console.log('📱 Estado actual del formulario:', formData);
    console.log(signatureData)
    
    setSaving(true);
    
    try {
      console.log('🔍 Paso 1: Verificando autenticación...');
      
      // Intentar obtener token del contexto primero
      let token = user?.token;
      console.log('🔑 Token del contexto:', token ? 'SÍ EXISTE' : 'NO EXISTE');
      
      // Si no hay token del contexto, intentar AsyncStorage
      if (!token) {
        console.log('🔄 Intentando obtener token de AsyncStorage...');
        const storageToken = await AsyncStorage.getItem('authToken');
        token = storageToken || undefined;
        console.log('🔑 Token de AsyncStorage:', token ? 'SÍ EXISTE' : 'NO EXISTE');
      }
      
      if (!token) {
        console.log('❌ No se encontró token válido');
        Alert.alert('Error', 'No se encontró token de autenticación');
        return;
      }

      console.log('🔍 Paso 2: Validando datos...');
      
      // Validaciones básicas
      if (!formData.empresa.trim()) {
        console.log('❌ Validación falló: empresa vacía');
        Alert.alert('Error', 'El campo empresa es obligatorio');
        return;
      }
      console.log('🔍 Paso 2: Validando datos...');

// Validaciones básicas
if (!formData.empresa.trim()) {
  Alert.alert("Error", "El campo Empresa es obligatorio");
  return;
}
if (!formData.nit_cedula.trim()) {
  Alert.alert("Error", "El campo NIT / Cédula es obligatorio");
  return;
}
if (!formData.direccion.trim()) {
  Alert.alert("Error", "El campo Dirección es obligatorio");
  return;
}
if (!formData.ciudad.trim()) {
  Alert.alert("Error", "El campo Ciudad es obligatorio");
  return;
}
if (!formData.persona_encargada.trim()) {
  Alert.alert("Error", "El campo Persona Encargada es obligatorio");
  return;
}
if (!formData.correo.trim()) {
  Alert.alert("Error", "El campo Correo es obligatorio");
  return;
}
if (!formData.telefono.trim()) {
  Alert.alert("Error", "El campo Teléfono es obligatorio");
  return;
}

      
      const dataToSend = {
        ...formData,
        registro_cliente_id: params?.registroId || null,
        firma_responsable: signatureData || firmaBase64,
      };

      console.log('📋 Datos completos a enviar:', JSON.stringify(dataToSend, null, 2));
      console.log('🌐 URL del endpoint:', `${API_BASE}/formularios-inicio-servicio`);
      console.log('🔑 Token a usar:', token.substring(0, 20) + '...');

      console.log('🔍 Paso 4: Enviando petición...');

      let response;
      
      // Decidir si crear (POST) o actualizar (PUT)
      if (modo === 'editar' && formularioId) {
        console.log('📝 Modo EDITAR: Actualizando formulario existente con ID:', formularioId);
        response = await axios.put(
          `${API_BASE}/formularios-inicio-servicio/${formularioId}`,
          dataToSend,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            timeout: 10000, // 10 segundos de timeout
          }
        );
      } else {
        console.log('✨ Modo CREAR: Creando nuevo formulario');
        response = await axios.post(
          `${API_BASE}/formularios-inicio-servicio`,
          dataToSend,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            timeout: 10000, // 10 segundos de timeout
          }
        );
      }

   
       try {
          console.log(`🔐 Iniciando tracking con token`);
          
          // ✅ Paso 1: Enviar punto de login
         await startTracking(token, 'Inicio_servicio');
       
          
          // ✅ Paso 2: Iniciar tracking en background REAL (producción)
          const sessionId = `session_${Date.now()}`;
          await startBackgroundTracking(token, sessionId);
          console.log('🎯 Tracking en background iniciado');

        } catch (trackingError) {
          console.error('⚠️ Error en tracking:', trackingError);
        }
        

      // Determinar el mensaje según el modo
      const mensaje = modo === 'editar' 
        ? 'Formulario de Inicio de Servicio actualizado correctamente'
        : 'Formulario de  Inicio de Servicio creado correctamente';
      
      console.log('🎉 Mostrando mensaje de éxito:', mensaje);
      
      // Mostrar mensaje de éxito
      Alert.alert(
        'Éxito', 
        mensaje,
        [{ 
          text: 'OK', 
          onPress: () => {
            console.log('👈 Regresando a pantalla anterior...');
                  router.push({
                pathname: '/registro-detalle',
                params: {
                  registroId: params.registroId,
                 
                },
              });
          }
        }]
      );

    } catch (error) {
      console.log('💥 === ERROR EN HANDLESUBMIT ===');
      console.log('❌ Error guardando formulario:', error);
      
      if (axios.isAxiosError(error)) {
        console.log('🌐 Es un error de Axios');
        console.log('📊 Status de error:', error.response?.status);
        console.log('📋 Datos de error:', JSON.stringify(error.response?.data, null, 2));
        console.log('🌐 URL:', error.config?.url);
        console.log('📝 Método:', error.config?.method);
        console.log('🔗 Headers enviados:', error.config?.headers);
        
        // Mostrar error específico del servidor
        const errorMessage = error.response?.data?.message || 
                           error.response?.data?.error || 
                           `Error del servidor (${error.response?.status})`;
        Alert.alert('Error', errorMessage);
      } else {
        if (error instanceof Error) {
          console.log('💥 Error no relacionado con Axios:', error.message);
        } else {
          console.log('💥 Error no relacionado con Axios:', error);
        }
        Alert.alert('Error', 'Error de conexión o configuración');
      }
    } finally {
      console.log('🏁 Finalizando handleSubmit...');
      setSaving(false);
    }
  };

  const toggleInsumo = (categoria: string) => {
  setFormData(prev => ({
    ...prev,
    tipo_insumos: {
      ...prev.tipo_insumos,
      [categoria]: {
        ...prev.tipo_insumos[categoria],
        active: !prev.tipo_insumos[categoria].active
      }
    }
  }));
};
const agregarInsumoItem = (categoria: string) => {
  setFormData(prev => ({
    ...prev,
    tipo_insumos: {
      ...prev.tipo_insumos,
      [categoria]: {
        ...prev.tipo_insumos[categoria],
        items: [
          ...prev.tipo_insumos[categoria].items,
          { nombre: "", cantidad: "", descripcion: "" }
        ]
      }
    }
  }));
};
const eliminarInsumoItem = (categoria: string, index: number) => {
  setFormData(prev => ({
    ...prev,
    tipo_insumos: {
      ...prev.tipo_insumos,
      [categoria]: {
        ...prev.tipo_insumos[categoria],
        items: prev.tipo_insumos[categoria].items.filter((_, i) => i !== index)
      }
    }
  }));
};
const handleInsumoItemChange = (categoria: string, index: number, campo: string, valor: string) => {
  setFormData(prev => ({
    ...prev,
    tipo_insumos: {
      ...prev.tipo_insumos,
      [categoria]: {
        ...prev.tipo_insumos[categoria],
        items: prev.tipo_insumos[categoria].items.map((item, i) =>
          i === index ? { ...item, [campo]: valor } : item
        )
      }
    }
  }));
};

const agregarValorAgregado = () => {
  setFormData(prev => ({
    ...prev,
    valores_agregados: [
      ...prev.valores_agregados,
      { descripcion: '', cantidad: '', frecuencia: '' }
    ]
  }));
};

const eliminarValorAgregado = (index: number) => {
  setFormData(prev => ({
    ...prev,
    valores_agregados: prev.valores_agregados.filter((_, i) => i !== index)
  }));
};

const handleValorAgregadoChange = (
  index: number,
  field: ValorAgregadoField,
  value: string
) => {
  const updated = [...formData.valores_agregados];
  updated[index][field] = value;
  setFormData(prev => ({ ...prev, valores_agregados: updated }));
};



  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity  style={styles.backButton}>
        
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {esVisualizacion ? 'Ver Inicio de Servicio' : 'Crear Planilla Inicio de Servicio'}
        </Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📋 Información General</Text>
          
          <View style={styles.row}>
            <View style={styles.halfInput}>
              <Text style={styles.label}>Consecutivo *</Text>
              <TextInput
                style={[styles.input, styles.readOnlyInput]}
                value={formData.consecutivo}
                editable={false}
                placeholder="Generado automáticamente"
                placeholderTextColor={COLORS.textSecondary}
              />
            </View>
            <View style={styles.halfInput}>
              <Text style={styles.label}>Fecha *</Text>
              <TextInput
                style={[styles.input, styles.readOnlyInput]}
                value={formData.fecha}
                editable={false}
                placeholder="Fecha actual"
                placeholderTextColor={COLORS.textSecondary}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Empresa *</Text>
            <TextInput
              style={[styles.input, esVisualizacion && styles.readOnlyInput]}
              value={formData.empresa}
              onChangeText={esVisualizacion ? undefined : (text) => setFormData(prev => ({ ...prev, empresa: text }))}
              placeholder="Nombre de la empresa"
              placeholderTextColor={COLORS.textSecondary}
              editable={!esVisualizacion}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>NIT/Cédula *</Text>
            <TextInput
              style={styles.input}
              value={formData.nit_cedula}
              onChangeText={(text) => setFormData(prev => ({ ...prev, nit_cedula: text }))}
              placeholder="Nit o documento de la empresa"
              placeholderTextColor={COLORS.textSecondary}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Dirección *</Text>
            <TextInput
              style={styles.input}
              value={formData.direccion}
              onChangeText={(text) => setFormData(prev => ({ ...prev, direccion: text }))}
              placeholder="Dirección de la empresa"
              placeholderTextColor={COLORS.textSecondary}
            />
          </View>

             <View style={styles.inputGroup}>
            <Text style={styles.label}>Ciudad *</Text>
            <TextInput
              style={styles.input}
              value={formData.ciudad}
              onChangeText={(text) => setFormData(prev => ({ ...prev, ciudad: text }))}
              placeholder="Ciudad de la empresa"
              placeholderTextColor={COLORS.textSecondary}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Persona Encargada *</Text>
            <TextInput
              style={styles.input}
              value={formData.persona_encargada}
              onChangeText={(text) => setFormData(prev => ({ ...prev, persona_encargada: text }))}
              placeholder="Nombre del encargado"
              placeholderTextColor={COLORS.textSecondary}
            />
          </View>

          <View style={styles.row}>
            <View style={styles.halfInput}>
              <Text style={styles.label}>Correo electronico *</Text>
              <TextInput
                style={styles.input}
                value={formData.correo}
                onChangeText={(text) => setFormData(prev => ({ ...prev, correo: text }))}
                placeholder="correo@empresa.com"
                placeholderTextColor={COLORS.textSecondary}
                keyboardType="email-address"
              />
            </View>
            <View style={styles.halfInput}>
              <Text style={styles.label}>Teléfono *</Text>
              <TextInput
                style={styles.input}
                value={formData.telefono}
                onChangeText={(text) => setFormData(prev => ({ ...prev, telefono: text }))}
                placeholder="300 123 4567"
                placeholderTextColor={COLORS.textSecondary}
                keyboardType="phone-pad"
              />
            </View>
          </View>
        </View>

 {/* Información del contrato */}

<View style={styles.section}>
  <Text style={styles.sectionTitle}>Información del contrato</Text>

  {/* FECHA DE INICIO */}
  <View style={styles.inputGroup}>
    <Text style={styles.label}>Fecha de inicio</Text>
    <TouchableOpacity onPress={() => setShowFechaInicio(true)}>
      <TextInput
        style={[styles.input, styles.readOnlyInput]}
        value={formData.fecha_inicio}
        editable={false}
        placeholder="Seleccionar fecha"
        placeholderTextColor={COLORS.textSecondary}
      />
    </TouchableOpacity>
  </View>

  {/* DURACIÓN */}
  <View style={styles.inputGroup}>
    <Text style={styles.label}>Duración del contrato</Text>
    <TextInput
      style={styles.input}
      value={formData.duracion}
      onChangeText={(text) => setFormData(prev => ({ ...prev, duracion: text }))}
      placeholder="Ej: 6 meses"
      placeholderTextColor={COLORS.textSecondary}
    />
  </View>

  {/* TIPO DE SERVICIO */}
  <View style={styles.inputGroup}>
    <Text style={styles.label}>Tipo de servicio</Text>
    <TextInput
      style={styles.input}
      value={formData.tipo_servicio}
      onChangeText={(text) => setFormData(prev => ({ ...prev, tipo_servicio: text }))}
      placeholder="Describir servicio"
      placeholderTextColor={COLORS.textSecondary}
    />
  </View>

  {/* PÓLIZAS */}
  <View style={styles.inputGroup}>
    <Text style={styles.label}>¿Pólizas?</Text>
    <TextInput
      style={styles.input}
      value={formData.polizas}
      onChangeText={(text) => setFormData(prev => ({ ...prev, polizas: text }))}
      placeholder="Sí / No"
      placeholderTextColor={COLORS.textSecondary}
    />
  </View>

  {/* CUÁL */}
  <View style={styles.inputGroup}>
    <Text style={styles.label}>¿Cuál?</Text>
    <TextInput
      style={styles.input}
      value={formData.poliza_cual}
      onChangeText={(text) => setFormData(prev => ({ ...prev, poliza_cual: text }))}
      placeholder="Especificar póliza"
      placeholderTextColor={COLORS.textSecondary}
    />
  </View>

  {/* CONDICIONES DE PAGO */}
  <View style={styles.inputGroup}>
    <Text style={styles.label}>Condiciones de pago</Text>
    <TextInput
      style={styles.input}
      value={formData.condiciones_pago}
      onChangeText={(text) => setFormData(prev => ({ ...prev, condiciones_pago: text }))}
      placeholder="Ej: 30 días"
      placeholderTextColor={COLORS.textSecondary}
    />
  </View>

  {/* FECHA LÍMITE */}
  <View style={styles.inputGroup}>
    <Text style={styles.label}>Fecha límite para radicar factura</Text>
    <TouchableOpacity onPress={() => setShowFechaLimite(true)}>
      <TextInput
        style={[styles.input, styles.readOnlyInput]}
        value={formData.fecha_limite}
        editable={false}
        placeholder="Seleccionar fecha"
        placeholderTextColor={COLORS.textSecondary}
      />
    </TouchableOpacity>
  </View>

  {/* CORREO FACTURA */}
  <View style={styles.inputGroup}>
    <Text style={styles.label}>Correo para enviar factura</Text>
    <TextInput
      style={styles.input}
      value={formData.correo_factura}
      onChangeText={(text) => setFormData(prev => ({ ...prev, correo_factura: text }))}
      placeholder="correo@empresa.com"
      placeholderTextColor={COLORS.textSecondary}
      keyboardType="email-address"
    />
  </View>

  {/* SOPORTES */}
  <View style={styles.inputGroup}>
    <Text style={styles.label}>Soportes de facturación</Text>
    <TextInput
      style={styles.input}
      value={formData.soportes}
      onChangeText={(text) => setFormData(prev => ({ ...prev, soportes: text }))}
      placeholder="Documentos requeridos"
      placeholderTextColor={COLORS.textSecondary}
    />
  </View>
</View>


<View style={styles.section}>
  <Text style={styles.sectionTitle}>PERSONAL REQUERIDO</Text>

  {!esVisualizacion && (
    <View style={styles.addButtonContainer}>
      <TouchableOpacity onPress={agregarItemPersonal} style={styles.addButton}>
        <Ionicons name="add-circle" size={20} color={COLORS.primary} />
        <Text style={styles.addButtonText}>Agregar</Text>
      </TouchableOpacity>
    </View>
  )}

  {formData.personal.map((item, index) => (
    <View key={index} style={styles.inventarioItem}>
      
      {/* Header */}
      <View style={styles.inventarioHeader}>
        <Text style={styles.inventarioTitle}>Item {index + 1}</Text>

        {formData.personal.length > 1 && (
          <TouchableOpacity
            onPress={() => eliminarItemPersonal(index)}
            style={styles.deleteButton}
          >
            <Ionicons name="trash-outline" size={16} color={COLORS.danger} />
          </TouchableOpacity>
        )}
      </View>

      {/* LUGAR */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Lugar donde se presta el servicio</Text>
        <TextInput
          style={styles.input}
          value={item.lugar_servicio}
          onChangeText={(text) => handlePersonalChange(index, 'lugar_servicio', text)}
          placeholder="Ciudad / Sede"
          placeholderTextColor={COLORS.textSecondary}
        />
      </View>

      {/* No. Trabajadores */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Número de trabajadores</Text>
        <TextInput
          style={styles.input}
          value={item.trabajadores}
          onChangeText={(text) => handlePersonalChange(index, 'trabajadores', text)}
          placeholder="0"
          placeholderTextColor={COLORS.textSecondary}
          keyboardType="numeric"
        />
      </View>

      {/* Cargo */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Cargo a desempeñar</Text>
        <TextInput
          style={styles.input}
          value={item.cargo}
          onChangeText={(text) => handlePersonalChange(index, 'cargo', text)}
          placeholder="Ej: Operario, Técnico, Supervisor"
          placeholderTextColor={COLORS.textSecondary}
        />
      </View>

      {/* Salario */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Salario (mínimo/especial)</Text>
        <TextInput
          style={styles.input}
          value={item.salario}
          onChangeText={(text) => handlePersonalChange(index, 'salario', text)}
          placeholder="Ej: 1.300.000"
          placeholderTextColor={COLORS.textSecondary}
          keyboardType="numeric"
        />
      </View>

      {/* Subsidio */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Subsidio de transporte (legal/adicional)</Text>
        <TextInput
          style={styles.input}
          value={item.subsidio_transporte}
          onChangeText={(text) => handlePersonalChange(index, 'subsidio_transporte', text)}
          placeholder="Ej: Sí / No / Valor"
          placeholderTextColor={COLORS.textSecondary}
        />
      </View>

      {/* Horario */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Horario</Text>
        <TextInput
          style={styles.input}
          value={item.horario}
          onChangeText={(text) => handlePersonalChange(index, 'horario', text)}
          placeholder="Ej: L-V 8am - 5pm"
          placeholderTextColor={COLORS.textSecondary}
        />
      </View>

      {/* Exámenes */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Exámenes especiales</Text>
        <TextInput
          style={styles.input}
          value={item.examenes}
          onChangeText={(text) => handlePersonalChange(index, 'examenes', text)}
          placeholder="Ej: Alturas, Manipulación, Etc"
          placeholderTextColor={COLORS.textSecondary}
        />
      </View>

      {/* ARL */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>ARL</Text>
        <TextInput
          style={styles.input}
          value={item.arl}
          onChangeText={(text) => handlePersonalChange(index, 'arl', text)}
          placeholder="Nivel de riesgo o empresa"
          placeholderTextColor={COLORS.textSecondary}
        />
      </View>

      {/* Dotación */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Dotación</Text>
        <TextInput
          style={styles.input}
          value={item.dotacion}
          onChangeText={(text) => handlePersonalChange(index, 'dotacion', text)}
          placeholder="Uniforme, botas, etc."
          placeholderTextColor={COLORS.textSecondary}
        />
      </View>

      {/* EPP */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>EPP</Text>
        <TextInput
          style={styles.input}
          value={item.epp}
          onChangeText={(text) => handlePersonalChange(index, 'epp', text)}
          placeholder="Elementos de protección personal"
          placeholderTextColor={COLORS.textSecondary}
        />
      </View>

      {/* Observaciones */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Observaciones</Text>
        <TextInput
          style={styles.input}
          value={item.observaciones}
          onChangeText={(text) => handlePersonalChange(index, 'observaciones', text)}
          placeholder="Detalles adicionales"
          placeholderTextColor={COLORS.textSecondary}
        />
      </View>

    </View>
  ))}
</View>

<View style={styles.section}>
  <Text style={styles.sectionTitle}>TIPO DE INSUMOS</Text>

 {INSUMOS_CATEGORIAS.map((categoria) => (
  <View key={categoria} style={styles.checkboxGroup}>

    {/* Checkbox principal */}
    <View style={styles.checkboxRow}>
      <TouchableOpacity
        style={styles.checkbox}
        onPress={() => toggleInsumo(categoria)}
      >
        <Ionicons
          name={formData.tipo_insumos[categoria].active ? "checkbox" : "square-outline"}
          size={22}
          color={COLORS.primary}
        />
      </TouchableOpacity>

      <Text style={styles.checkboxLabel}>
        {categoria.replace("_", " ")}
      </Text>
    </View>

    {/* 🔥 SI ES NA -> NO MOSTRAR ITEMS NI BOTÓN */}
    {categoria !== "NA" &&
      formData.tipo_insumos[categoria].active && (
        <View style={styles.insumoContainer}>

          {!esVisualizacion && (
            <TouchableOpacity
              onPress={() => agregarInsumoItem(categoria)}
              style={styles.addButtonMini}
            >
              <Ionicons name="add-circle" size={18} color={COLORS.primary} />
              <Text style={styles.addButtonText}>Agregar item</Text>
            </TouchableOpacity>
          )}

          {formData.tipo_insumos[categoria].items.map((item, index) => (
            <View key={index} style={styles.insumoItem}>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Insumo</Text>
                <TextInput
                  style={styles.input}
                  value={item.nombre}
                  onChangeText={(text) =>
                    handleInsumoItemChange(categoria, index, "nombre", text)
                  }
                  placeholder="Nombre del insumo"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Cantidad</Text>
                <TextInput
                  style={styles.input}
                  value={item.cantidad}
                  onChangeText={(text) =>
                    handleInsumoItemChange(categoria, index, "cantidad", text)
                  }
                  placeholder="0"
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Descripción</Text>
                <TextInput
                  style={styles.input}
                  value={item.descripcion}
                  onChangeText={(text) =>
                    handleInsumoItemChange(categoria, index, "descripcion", text)
                  }
                  placeholder="Detalles opcionales"
                />
              </View>

              {formData.tipo_insumos[categoria].items.length > 1 && (
                <TouchableOpacity
                  onPress={() => eliminarInsumoItem(categoria, index)}
                  style={styles.deleteButtonMini}
                >
                  <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
                </TouchableOpacity>
              )}

            </View>
          ))}
        </View>
      )}
  </View>
))}

</View>

        {/* Inventario de Maquinaria y Equipos */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>INVENTARIO DE MAQUINARIA Y/O EQUIPO</Text>
          {!esVisualizacion && (
            <View style={styles.addButtonContainer}>
              <TouchableOpacity onPress={agregarItemInventario} style={styles.addButton}>
                <Ionicons name="add-circle" size={20} color={COLORS.primary} />
                <Text style={styles.addButtonText}>Agregar</Text>
              </TouchableOpacity>
            </View>
          )}

          {formData.inventario.map((item, index) => (
            <View key={index} style={styles.inventarioItem}>
              <View style={styles.inventarioHeader}>
                <Text style={styles.inventarioTitle}>Item {index + 1}</Text>
                {formData.inventario.length > 1 && (
                  <TouchableOpacity
                    onPress={() => eliminarItemInventario(index)}
                    style={styles.deleteButton}
                  >
                    <Ionicons name="trash-outline" size={16} color={COLORS.danger} />
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Maquinaria/Equipo</Text>
                <TextInput
                  style={styles.input}
                  value={item.maquinaria_equipo}
                  onChangeText={(text) => handleInventarioChange(index, 'maquinaria_equipo', text)}
                  placeholder="Nombre del equipo o maquinaria"
                  placeholderTextColor={COLORS.textSecondary}
                />
              </View>

              <View style={styles.row}>
                <View style={styles.halfInput}>
                  <Text style={styles.label}>Cantidad</Text>
                  <TextInput
                    style={styles.input}
                    value={item.cantidad}
                    onChangeText={(text) => handleInventarioChange(index, 'cantidad', text)}
                    placeholder="0"
                    placeholderTextColor={COLORS.textSecondary}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.halfInput}>
                  <Text style={styles.label}>Estado</Text>
                  <TextInput
                    style={styles.input}
                    value={item.descripcion_estado}
                    onChangeText={(text) => handleInventarioChange(index, 'descripcion_estado', text)}
                    placeholder="Bueno, Regular, Malo"
                    placeholderTextColor={COLORS.textSecondary}
                  />
                </View>
              </View>
            </View>
          ))}
        </View>

   <View style={styles.section}>
  <Text style={styles.sectionTitle}>VALORES AGREGADOS</Text>

  {/* SI EL USUARIO MARCÓ “N/A” NO MOSTRAR ITEMS */}
  {formData.valores_agregados_na ? (
    <Text style={styles.naText}>No aplica</Text>
  ) : (
    <>
      {!esVisualizacion && (
        <View style={styles.addButtonContainer}>
          <TouchableOpacity onPress={agregarValorAgregado} style={styles.addButton}>
            <Ionicons name="add-circle" size={20} color={COLORS.primary} />
            <Text style={styles.addButtonText}>Agregar</Text>
          </TouchableOpacity>
        </View>
      )}

      {formData.valores_agregados.map((item, index) => (
        <View key={index} style={styles.valorAgregadoItem}>
          
          {/* HEADER ITEM */}
          <View style={styles.inventarioHeader}>
            <Text style={styles.inventarioTitle}>Item {index + 1}</Text>

            {formData.valores_agregados.length > 1 && (
              <TouchableOpacity
                onPress={() => eliminarValorAgregado(index)}
                style={styles.deleteButton}
              >
                <Ionicons name="trash-outline" size={16} color={COLORS.danger} />
              </TouchableOpacity>
            )}
          </View>

          {/* DESCRIPCIÓN */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Descripción</Text>
            <TextInput
              style={styles.input}
              value={item.descripcion}
              onChangeText={(text) =>
                handleValorAgregadoChange(index, "descripcion", text)
              }
              placeholder="Descripción del valor agregado"
              placeholderTextColor={COLORS.textSecondary}
            />
          </View>

          {/* CANTIDAD */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Cantidad</Text>
            <TextInput
              style={styles.input}
              value={item.cantidad}
              onChangeText={(text) =>
                handleValorAgregadoChange(index, "cantidad", text)
              }
              placeholder="0"
              placeholderTextColor={COLORS.textSecondary}
              keyboardType="numeric"
            />
          </View>

          {/* FRECUENCIA */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Frecuencia / # Veces</Text>
            <TextInput
              style={styles.input}
              value={item.frecuencia}
              onChangeText={(text) =>
                handleValorAgregadoChange(index, "frecuencia", text)
              }
              placeholder="Ej: 1 vez al mes"
              placeholderTextColor={COLORS.textSecondary}
            />
          </View>

        </View>
      ))}
    </>
  )}
</View>


 {/* Observaciones Generales */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📝 Observaciones Generales</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={formData.observaciones_generales}
            onChangeText={(text) => setFormData(prev => ({ ...prev, observaciones_generales: text }))}
            placeholder="Observaciones generales..."
            placeholderTextColor={COLORS.textSecondary}
            multiline
            numberOfLines={4}
            editable={puedeEditar}
          />
        </View>

{(formData.firma_responsable || firmaBase64) && (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>✍️ Firma Digital</Text>

    <View style={styles.firmaPreviewContainer}>
      {(() => {
        const data = formData.firma_responsable || firmaBase64;
        const base64 = data.split(",")[1];

        // ✅ Decodificar base64 a SVG string
        let decodedSvg = decodeURIComponent(escape(atob(base64)));

        // ✅ Asegurar viewBox correcto y más alto para que no recorte la firma
        if (!decodedSvg.includes("viewBox")) {
          decodedSvg = decodedSvg.replace("<svg", `<svg viewBox="0 0 344 300"`); // 👈 más alto
        }

        // ✅ Mover la firma hacia arriba dentro del SVG para quitar espacio vacío superior
        decodedSvg = decodedSvg.replace(
          "<path",
          `<path transform="translate(0, -60)"` // 👈 sube la firma 60px
        );

        return (
          <View style={styles.svgWrapper}>
            <SvgXml
              xml={decodedSvg}
              width="100%"  // 👈 ocupa todo el ancho
              height={220}  // 👈 firma grande y sin recorte
              preserveAspectRatio="xMidYMid meet"
            />
          </View>
        );
      })()}

      {/* INFO DEL FIRMANTE */}
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

        {formData.created_at && (
          <Text style={styles.firmaInfo}>
            <Text style={styles.firmaInfoLabel}>Fecha de firma: </Text>
            {new Date(formData.created_at).toLocaleDateString("es-CO", {
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        )}
      </View>
    </View>
  </View>
)}



       

        {/* Botones de acción */}
        {esVisualizacion ? (
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.actionButton, styles.exportButton]}
              onPress={exportarPDF}
            >
              <Ionicons name="document-outline" size={20} color={COLORS.surface} />
              <Text style={styles.actionButtonText}>Exportar PDF</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.actionButton, styles.editButton]}
              onPress={() => router.push({
                pathname: '/formulario-inicio-servicio',
                params: { 
                  ...params,
                  modo: 'editar'
                }
              })}
            >
              <Ionicons name="create-outline" size={20} color={COLORS.surface} />
              <Text style={styles.actionButtonText}>Editar</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.submitButton, saving && styles.submitButtonDisabled]}
            onPress={iniciarProcesoDeFirma}
            disabled={saving}
          >
            <Text style={styles.submitButtonText}>
              {saving ? 'Guardando...' : 'Firmar y Guardar Acta'}
            </Text>
          </TouchableOpacity>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Modal para capturar firma digital */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={modalFirmaVisible}
        onRequestClose={cancelarFirma}
      >
        <SafeAreaView style={styles.firmaModalContainer}>
          <View style={styles.firmaHeader}>
            <Text style={styles.firmaTitle}>Firma del Responsable</Text>
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
                  Alert.alert('Firma vacía', 'Por favor, firme antes de confirmar');
                  return;
                }
                const signatureData = signatureRef.current?.toDataURL();
                if (signatureData) {
                  guardarFirma(signatureData);
                }
              }}
            >
              <Ionicons name="checkmark-outline" size={20} color={COLORS.surface} />
              <Text style={styles.firmaButtonTextPrimary}>Confirmar</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

   {showFechaInicio && (
  <DateTimePicker
    value={new Date()}
    mode="date"
    display="default"
    onChange={(e, d) => {
      setShowFechaInicio(false);
      if (d) {
        setFormData(prev => ({ 
          ...prev, 
          fecha_inicio: d.toISOString().split("T")[0] 
        }));
      }
    }}
  />
)}

{showFechaLimite && (
  <DateTimePicker
    value={new Date()}
    mode="date"
    display="default"
    onChange={(e, d) => {
      setShowFechaLimite(false);
      if (d) {
        setFormData(prev => ({ 
          ...prev, 
          fecha_limite: d.toISOString().split("T")[0] 
        }));
      }
    }}
  />
)}

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
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: COLORS.primary,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.surface,
    textAlign: 'center',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 20,
    marginTop: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.primary,
    marginBottom: 16,
    flex: 1,
    marginRight: 10,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 16,
    fontStyle: 'italic',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.surface,
  },
  readOnlyInput: {
    backgroundColor: COLORS.surfaceSecondary,
    color: COLORS.textSecondary,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  areaItem: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  areaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  areaTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.textPrimary,
    flex: 1,
  },
  toggleContainer: {
    marginLeft: 12,
  },
  toggleButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  toggleButtonActive: {
    borderColor: COLORS.success,
  },
  toggleButtonInactive: {
    backgroundColor: COLORS.border,
    borderColor: COLORS.borderDark,
  },
  toggleButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  toggleButtonTextActive: {
    color: COLORS.surface,
  },
  toggleButtonTextInactive: {
    color: COLORS.textSecondary,
  },
  observacionesInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.surface,
    textAlignVertical: 'top',
  },
  addButtonContainer: {
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.primary,
    flexShrink: 0,
    minWidth: 100,
  },
  addButtonText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.primary,
  },
  inventarioItem: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  inventarioHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  inventarioTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
  },
  deleteButton: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: COLORS.surface,
  },
  submitButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  submitButtonDisabled: {
    backgroundColor: COLORS.textSecondary,
  },
  submitButtonText: {
    color: COLORS.surface,
    fontSize: 18,
    fontWeight: '600',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 24,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    gap: 8,
  },
  exportButton: {
    backgroundColor: COLORS.warning,
  },
  editButton: {
    backgroundColor: COLORS.primary,
  },
  actionButtonText: {
    color: COLORS.surface,
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.6,
  },
  bottomPadding: {
    height: 40,
  },
  // Estilos para fotos
  addPhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
    marginTop: 8,
  },
  addPhotoButtonText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.primary,
  },
  fotosContainer: {
    marginTop: 12,
  },
  fotosLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  fotosScroll: {
    flexDirection: 'row',
  },
  fotoItem: {
    position: 'relative',
    marginRight: 12,
  },
  fotoPreview: {
    width: 100,
    height: 100,
    borderRadius: 8,
    backgroundColor: COLORS.border,
  },
  fotoError: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceSecondary,
    borderWidth: 1,
    borderColor: COLORS.borderDark,
    borderStyle: 'dashed',
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
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  // Estilos para el modal de visualización de fotos
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackground: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    height: '80%',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: -50,
    right: 10,
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
  },
  fullSizeImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  modalHint: {
    position: 'absolute',
    bottom: -40,
    color: COLORS.surface,
    fontSize: 14,
    opacity: 0.8,
  },
  // Estilos para modal de firma
  firmaModalContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  firmaHeader: {
    padding: 20,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  firmaTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 4,
  },
  firmaSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  firmaCanvasContainer: {
    flex: 1,
    margin: 20,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  firmaButtonsContainer: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  firmaButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  firmaButtonPrimary: {
    backgroundColor: COLORS.primary,
  },
  firmaButtonSecondary: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  firmaButtonDanger: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.danger,
  },
  firmaButtonTextPrimary: {
    color: COLORS.surface,
    fontSize: 16,
    fontWeight: '600',
  },
  firmaButtonTextSecondary: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  firmaButtonTextDanger: {
    color: COLORS.danger,
    fontSize: 16,
    fontWeight: '600',
  },


firmaPreview: {
  width: 180,
  height: 140,
  backgroundColor: 'transparent',
},
  

  firmaInfo: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  firmaInfoLabel: {
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
    

  /* --- TARJETA DE CADA CATEGORÍA --- */
  checkboxGroup: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#fff",
    marginBottom: 15,
  },

  /* --- CHECKBOX PRINCIPAL --- */
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 5,
  },

  checkbox: {
    marginRight: 10,
  },

  checkboxLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textPrimary,
  },

  /* --- CONTENEDOR PARA ITEMS DE INSUMO --- */
  insumoContainer: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#eee",
    paddingTop: 12,
  },

  /* --- BOTÓN AGREGAR ITEM --- */
  addButtonMini: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },


  /* --- TARJETA DE CADA ITEM --- */
  insumoItem: {
    borderWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#f8f8f8",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },



  /* --- BOTÓN ELIMINAR ITEM --- */
  deleteButtonMini: {
    alignSelf: "flex-end",
    marginTop: 6,
  },
  naText: {
  fontSize: 14,
  fontStyle: 'italic',
  color: COLORS.textSecondary,
  marginTop: 8,
},

valorAgregadoItem: {
  borderWidth: 1,
  borderColor: COLORS.border,
  borderRadius: 8,
  padding: 10,
  marginBottom: 12,
  
},

firmaPreviewContainer: {
  backgroundColor: "#fff",
  padding: 5,
  borderRadius: 8,
  width: "100%",
  alignItems: "center",
  justifyContent: "flex-start",
},

svgWrapper: {
  width: "100%",
  height: 230,  // 👈 suficiente espacio para firma grande
  justifyContent: "flex-start",
  alignItems: "center",
  overflow: "visible",
},

firmaInfoContainer: {
  marginTop: 10,
  alignItems: "center",
},



});
