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
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import  { SvgXml } from 'react-native-svg';
import { useRouter, useLocalSearchParams } from 'expo-router';
import DateTimePicker from "@react-native-community/datetimepicker";
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { useAuth } from './_layout';
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


interface FormularioData {
  // Información general usada
  consecutivo: string;
  empresa: string;
  nit_cedula: string;
  centro_costos: string;
  ciudad: string;
  observaciones_generales:string
  
  tipo_novedad: string[];
  afecta_facturacion: "Sí" | "No";

  // Campos de detalle de novedad
  fecha_inicio: string;
  fecha_final: string;
  cantidad: string;
  cargo: string;
  fecha_inicial:string;

  funcionario_notifica: string;
  funcionario_autoriza: string;

  // Valores agregados ✅ se mantiene
  valores_agregados_na?: boolean;
  valores_agregados: {
    descripcion: string;
    cantidad: string;
    frecuencia: string;
  }[];

  // Firma opcional ✅ se mantiene
  firma_responsable?: string;
  nombre_firmante?: string;
  cedula_firmante?: string;
  created_at?: string;
}



export default function FormularioNovedadesServicio() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();


  const [saving, setSaving] = useState(false);
    const { startTracking, startBackgroundTracking } = useLocation();


const [showFechaFinal, setShowFechaFinal] = useState(false);
const [showFechaInicio, setShowFechaInicio] = useState(false);
const [showFechaInicial, setShowFechaInicial] = useState(false);

  
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


  
  // Datos iniciales automáticos con áreas predefinidas
const [formData, setFormData] = useState<FormularioData>({
  consecutivo: '',
  empresa: '',
  nit_cedula: '',
  centro_costos: '',
  ciudad: '',
  fecha_inicial:'',

  // Checkboxes
  tipo_novedad: [],
  afecta_facturacion: "No",

  // Detalle novedad
  fecha_inicio: '',
  fecha_final: '',
  cantidad: '',
  cargo: '',

  // Gestión de la novedad
  funcionario_notifica: '',
  funcionario_autoriza: '',

  // Valores agregados ✅ mantenidos
  valores_agregados_na: false,
  valores_agregados: [
    { descripcion: '', cantidad: '', frecuencia: '' }
  ],
  observaciones_generales:'',

  // Firma digital ✅ mantenidos porque sí los usas
  firma_responsable: '',
  nombre_firmante: '',
  cedula_firmante: '',
  created_at: new Date().toISOString(),
});




  // Función para obtener datos del registro y empresa
  const obtenerDatosEmpresa = async (registroId: string) => {
    console.log('🔍 Iniciando obtención de datos para registro:', registroId);
    
    try {
      // Primero intentar usar datos de params si están disponibles
      if (params?.empresa) {

        console.log(params)
        setFormData(prev => ({
          ...prev,
          empresa: params.empresa as string,
          nit_cedula: params.nit as string || '',
          centro_costos:params.centro_costo as string || '',
          ciudad:params.ciudad as string || ''
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
                centro_costos: registro.empresa.centro_costos || '',
                direccion: registro.empresa.direccion || '',
                persona_encargada: registro.persona_encargada || '',
                correo: registro.correo || '',
                telefono: registro.telefono || '',
                ciudad:registro.ciudad ||''
              }));
            } else {
              console.log('⚠️ No se encontraron datos de empresa en el registro');
              
              // Usar datos directos del registro si no hay empresa
              setFormData(prev => ({
                ...prev,
                empresa: registro.nombre_empresa || '',
                nit_cedula: registro.identificacion || '',
                direccion: registro.direccion || '',
                centro_costos: registro.empresa.centro_costos || '',
                persona_encargada: registro.persona_encargada || '',
                correo: registro.correo || '',
                telefono: registro.telefono || '',
                ciudad:registro.ciudad ||''
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
      const response = await axios.get(`${API_BASE}/formularios-novedades-servicio/siguiente-consecutivo`, {
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
          `${API_BASE}/formularios-novedades-servicio/${formularioId}`,
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
          
 
         
          
          // Cargar todos los datos del formulario
setFormData({
  consecutivo: formulario.consecutivo ?? '',
  empresa: formulario.empresa ?? '',
  nit_cedula: formulario.nit_cedula ?? '',
  centro_costos: formulario.centro_costos ?? '',
  ciudad: formulario.ciudad ?? '',

  // Checkboxes
  tipo_novedad: Array.isArray(formulario.tipo_novedad) ? formulario.tipo_novedad : [],
  afecta_facturacion: formulario.afecta_facturacion === 'Sí' ? 'Sí' : 'No',

  // Detalle novedad
    fecha_inicio: formatISOtoDate(formulario.fecha_inicio),
  fecha_inicial: formatISOtoDate(formulario.fecha_inicial),
  fecha_final: formatISOtoDate(formulario.fecha_final),

  cantidad: formulario.cantidad ?? '',
  cargo: formulario.cargo ?? '',

  // Gestión de la novedad
  funcionario_notifica: formulario.funcionario_notifica ?? '',
  funcionario_autoriza: formulario.funcionario_autoriza ?? '',

  // Valores agregados ✅ (los mantienes porque sí los usas)
  valores_agregados_na: formulario.valores_agregados_na ?? false,
  valores_agregados: Array.isArray(formulario.valores_agregados) && formulario.valores_agregados.length > 0
    ? formulario.valores_agregados
    : [{ descripcion: '', cantidad: '', frecuencia: '' }],

  // Observaciones
  observaciones_generales: formulario.observaciones_generales ?? '',

  // Firma digital ✅ (también los mantienes)
  firma_responsable: formulario.firma_responsable ?? '',
  nombre_firmante: formulario.nombre_firmante ?? '',
  cedula_firmante: formulario.cedula_firmante ?? '',
  created_at: formulario.created_at ?? new Date().toISOString(),
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



const exportarPDF = async () => {
  if (!formData.consecutivo) {
    Alert.alert("Error", "No se puede exportar un formulario sin datos");
    return;
  }

  try {
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Planilla Novedades de Servicio - ${formData.consecutivo}</title>
      <style>
        body { font-family: Helvetica, sans-serif; margin: 30px; font-size:14px; }
        .header { text-align: center; margin-bottom: 25px; }
        .title { font-size: 18px; font-weight: bold; margin-bottom:4px; }
        .section { margin-top: 22px; }
        .section-title {
          font-size: 15px;
          font-weight: bold;
          color: #680000;
          border-bottom: 2px solid #680000;
          padding-bottom: 4px;
          margin-bottom: 12px;
        }
        .field { margin-bottom: 10px; }
        .label { font-weight: 600; }
        .value { background:#f3f3f3; padding:6px 10px; border-radius:5px; margin-top:3px; }

        table { width:100%; border-collapse:collapse; margin-top:8px; }
        th, td { border:1px solid #ccc; padding:7px; }
        th { font-weight:bold; }
      </style>
    </head>
    <body>

      <div class="header">
        <div class="title">PLANILLA NOVEDADES DE SERVICIO</div>
        <div>Consecutivo: ${formData.consecutivo}</div>
      
      </div>

      <!-- INFORMACIÓN GENERAL -->
      <div class="section">
        <div class="section-title">📋 Información General</div>
        <div class="field"><span class="label">Cliente:</span>
          <div class="value">${formData.empresa || "-"}</div>
        </div>

        <div class="field"><span class="label">NIT / Cédula:</span>
          <div class="value">${formData.nit_cedula || "-"}</div>
        </div>

        <div class="field"><span class="label">Centro de Costos:</span>
          <div class="value">${formData.centro_costos || "-"}</div>
        </div>

        <div class="field"><span class="label">Fecha de Inicio:</span>
          <div class="value">${formData.fecha_inicio || "-"}</div>
        </div>

        <div class="field"><span class="label">Ciudad:</span>
          <div class="value">${formData.ciudad || "-"}</div>
        </div>
      </div>

      <!-- TIPO DE NOVEDAD -->
      <div class="section">
        <div class="section-title">📄 Tipo de Novedad</div>

        <div class="field"><span class="label">Novedades seleccionadas:</span>
          <div class="value">${formData.tipo_novedad.length > 0 ? formData.tipo_novedad.join(", ") : "-"}</div>
        </div>

        <div class="field"><span class="label">Fecha inicial:</span>
          <div class="value">${formData.fecha_inicial || "-"}</div>
        </div>

        <div class="field"><span class="label">Fecha final:</span>
          <div class="value">${formData.fecha_final || "-"}</div>
        </div>

        <div class="field"><span class="label">Cantidad:</span>
          <div class="value">${formData.cantidad || "-"}</div>
        </div>

        <div class="field"><span class="label">Cargo:</span>
          <div class="value">${formData.cargo || "-"}</div>
        </div>

        <div class="field"><span class="label">Afecta facturación:</span>
          <div class="value">${formData.afecta_facturacion || "-"}</div>
        </div>
      </div>

      <!-- VALORES AGREGADOS -->
      <div class="section">
        <div class="section-title">⭐ Valores Agregados</div>
        ${
          formData.valores_agregados_na
            ? `<div class="value">No aplica</div>`
            : `
          <table>
            <thead>
              <tr>
                <th>Descripción</th>
                <th>Cantidad</th>
                <th>Frecuencia / # Veces</th>
              </tr>
            </thead>
            <tbody>
              ${
                formData.valores_agregados.map(item => `
                  <tr>
                    <td>${item.descripcion || "-"}</td>
                    <td>${item.cantidad || "-"}</td>
                    <td>${item.frecuencia || "-"}</td>
                  </tr>
                `).join("")
              }
            </tbody>
          </table>
        `
        }
      </div>

      <!-- GESTIÓN DE NOVEDAD -->
      <div class="section">
        <div class="section-title">👤 Gestión de la Novedad</div>
        <div class="field"><span class="label">Funcionario que notifica:</span>
          <div class="value">${formData.funcionario_notifica || "-"}</div>
        </div>
        <div class="field"><span class="label">Funcionario que autoriza:</span>
          <div class="value">${formData.funcionario_autoriza || "-"}</div>
        </div>
      </div>

      <!-- OBSERVACIONES -->
      <div class="section">
        <div class="section-title">📝 Observaciones Generales</div>
        <div class="value">${formData.observaciones_generales || "Sin observaciones"}</div>
      </div>

      <!-- FIRMA DIGITAL -->
      ${
        formData.firma_responsable
          ? `
      <div class="section">
        <div class="section-title">✍ Firma del Responsable</div>
        <div style="text-align:center; margin:12px 0;">
          <img src="${formData.firma_responsable}" style="max-width:280px; border:1px solid #ccc; padding:8px; border-radius:6px;" />
        </div>
        <div class="field"><span class="label">Firmante:</span>
          <div class="value">${formData.nombre_firmante || "-"}</div>
        </div>
        <div class="field"><span class="label">Cédula:</span>
          <div class="value">${formData.cedula_firmante || "-"}</div>
        </div>
      
      </div>`
          : ""
      }
    </body>
    </html>
    `;

    // Generar el PDF
    const { uri } = await Print.printToFileAsync({ html });

    // Compartirlo
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: "Compartir PDF" });
    } else {
      Alert.alert("PDF generado", uri);
    }

  } catch (error) {
    console.log("❌ Error PDF:", error);
    Alert.alert("Error", "No se pudo generar el PDF.");
  }
};
  
  // Función para iniciar el proceso de firma
  const iniciarProcesoDeFirma = () => {
    console.log('🖊️ === INICIANDO PROCESO DE FIRMA ===');
    console.log('📋 Empresa:', formData.empresa);
    
 
    
    
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

       if (!formData.fecha_inicio) {
    Alert.alert("Error", "La fecha de inicio es obligatoria");
    return;
  }

  if (!formData.ciudad.trim()) {
    Alert.alert("Error", "La ciudad es obligatoria");
    return;
  }

   if (!formData.nit_cedula.trim()) {
    Alert.alert("Error", "El nit es obligatorio");
    return;
  }

  if (!formData.centro_costos.trim()) {
    Alert.alert("Error", "El Centro de Costos es obligatorio");
    return;
  }


      console.log('� Paso 3: Preparando datos para envío...');
      
      const dataToSend = {
        ...formData,
         fecha_inicio: formatISOtoDate(formData.fecha_inicio),
  fecha_final: formatISOtoDate(formData.fecha_final),
  fecha_inicial: formatISOtoDate(formData.fecha_inicial),
        registro_cliente_id: params?.registroId || null,
        firma_responsable: signatureData || firmaBase64,
      };

      console.log('📋 Datos completos a enviar:', JSON.stringify(dataToSend, null, 2));
      console.log('🌐 URL del endpoint:', `${API_BASE}/formularios-novedades-servicio`);
      console.log('🔑 Token a usar:', token.substring(0, 20) + '...');

      console.log('🔍 Paso 4: Enviando petición...');

      let response;
      
      // Decidir si crear (POST) o actualizar (PUT)
      if (modo === 'editar' && formularioId) {
        console.log('📝 Modo EDITAR: Actualizando formulario existente con ID:', formularioId);
        response = await axios.put(
          `${API_BASE}/formularios-novedades-servicio/${formularioId}`,
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
          `${API_BASE}/formularios-novedades-servicio`,
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
         await startTracking(token, 'Novedades_servicio');
       
          
          // ✅ Paso 2: Iniciar tracking en background REAL (producción)
          const sessionId = `session_${Date.now()}`;
          //await startBackgroundTracking(token, sessionId);
          console.log('🎯 Tracking en background iniciado');

        } catch (trackingError) {
          console.error('⚠️ Error en tracking:', trackingError);
        }
        

      // Determinar el mensaje según el modo
      const mensaje = modo === 'editar' 
        ? 'Formulario de Novedades de Servicio actualizado correctamente'
        : 'Formulario de  Novedades de Servicio creado correctamente';
      
      console.log('🎉 Mostrando mensaje de éxito:', mensaje);
      
      // Mostrar mensaje de éxito
      Alert.alert(
        'Éxito', 
        mensaje,
        [{ 
          text: 'OK', 
          onPress: () => {
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

const formatISOtoDate = (fecha: any) => {
  if (!fecha) return "";
  return fecha.split("T")[0]; // 2025-11-24
};


  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {esVisualizacion ? 'Ver Novedades de Servicio' : 'Crear Planilla Novedades de Servicio'}
        </Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
       <View style={styles.section}>
  <Text style={styles.sectionTitle}>📋 Información General</Text>

  {/* Consecutivo */}
  <View style={styles.inputGroup}>
    <Text style={styles.label}>Consecutivo *</Text>
    <TextInput
      style={[styles.input, styles.readOnlyInput]}
      value={formData.consecutivo}
      editable={false}
      placeholderTextColor={COLORS.textSecondary}
    />
  </View>

  {/* Fecha de novedad */}
 

  {/* Empresa */}
  <View style={styles.inputGroup}>
    <Text style={styles.label}>Cliente *</Text>
    <TextInput
      style={[styles.input, styles.readOnlyInput]}
      value={formData.empresa}
      editable={false}
      placeholder="Nombre de la empresa"
      placeholderTextColor={COLORS.textSecondary}
    />
  </View>


  {/* NIT / Cédula */}
  <View style={styles.inputGroup}>
    <Text style={styles.label}>NIT / Cédula *</Text>
    <TextInput
      style={[styles.input, styles.readOnlyInput]}
      value={formData.nit_cedula}
      editable={false}
      placeholder="Número de identificación"
      placeholderTextColor={COLORS.textSecondary}
    />
  </View>
    <View style={styles.inputGroup}>
    <Text style={styles.label}>Centro de Costos *</Text>
    <TextInput
        style={[styles.input, styles.readOnlyInput]}
      value={formData.centro_costos}
      onChangeText={(text) => setFormData(prev => ({ ...prev, centro_costos: text }))}
      placeholder="Centro de Costos"
      placeholderTextColor={COLORS.textSecondary}
      editable={false}
    
    />
  </View>

   <View style={styles.inputGroup}>
    <Text style={styles.label}>Fecha de inicio *</Text>
    <TouchableOpacity onPress={() => setShowFechaInicio(true)}>
      <TextInput
        style={[styles.input]}
        value={formData.fecha_inicio}
        editable={false}
        placeholder="Seleccionar fecha"
        placeholderTextColor={COLORS.textSecondary}
      />
    </TouchableOpacity>
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


 {/* Información del contrato */}

<View style={styles.section}>
  <Text style={styles.sectionTitle}>📄 Tipo de novedad</Text>

  {/* Multi Checkbox - uno debajo del otro */}
  <View style={styles.inputGroup}>
    {["Personal", "Insumos", "Maquinaria", "Valores agregados", "Otros"].map((item) => {
      const seleccionado = formData.tipo_novedad?.includes(item);
      return (
        <TouchableOpacity
          key={item}
          onPress={() => {
            setFormData(prev => ({
              ...prev,
              tipo_novedad: seleccionado
                ? prev.tipo_novedad.filter(i => i !== item)
                : [...(prev.tipo_novedad || []), item]
            }));
          }}
          style={styles.checkboxOption}
        >
          <Ionicons
            name={seleccionado ? "checkbox" : "square-outline"}
            size={22}
            color={COLORS.primary}
            style={{ marginRight: 8 }}
          />
          <Text style={styles.label}>{item}</Text>
        </TouchableOpacity>
      );
    })}
  </View>

  {/* Fecha inicial */}
  <View style={styles.inputGroup}>
    <Text style={styles.label}>Fecha inicial</Text>
    <TouchableOpacity onPress={() => setShowFechaInicial(true)}>
      <TextInput
        style={[styles.input, styles.readOnlyInput]}
        value={formData.fecha_inicial}
        editable={false}
        placeholder="Seleccionar fecha"
        placeholderTextColor={COLORS.textSecondary}
      />
    </TouchableOpacity>
  </View>

  {/* Fecha final */}
  <View style={styles.inputGroup}>
    <Text style={styles.label}>Fecha final</Text>
    <TouchableOpacity onPress={() => setShowFechaFinal(true)}>
      <TextInput
        style={[styles.input, styles.readOnlyInput]}
        value={formData.fecha_final}
        editable={false}
        placeholder="Seleccionar fecha"
        placeholderTextColor={COLORS.textSecondary}
      />
    </TouchableOpacity>
  </View>

  {/* Cantidad */}
  <View style={styles.inputGroup}>
    <Text style={styles.label}>Cantidad</Text>
    <TextInput
      style={styles.input}
      value={formData.cantidad}
      onChangeText={(text) => setFormData(prev => ({ ...prev, cantidad: text }))}
      placeholder="Ej: 10"
      placeholderTextColor={COLORS.textSecondary}
      keyboardType="numeric"
    />
  </View>

  {/* Cargo */}
  <View style={styles.inputGroup}>
    <Text style={styles.label}>Cargo</Text>
    <TextInput
      style={styles.input}
      value={formData.cargo}
      onChangeText={(text) => setFormData(prev => ({ ...prev, cargo: text }))}
      placeholder="Ej: Operador"
      placeholderTextColor={COLORS.textSecondary}
    />
  </View>

  {/* Afecta facturación exclusivo Sí/No */}
  <View style={styles.inputGroup}>
    <Text style={styles.label}>Afecta facturación</Text>
    <View>

      <TouchableOpacity
        onPress={() => setFormData(prev => ({ ...prev, afecta_facturacion: "Sí" }))}
        style={styles.checkboxOption}
      >
        <Ionicons
          name={formData.afecta_facturacion === "Sí" ? "checkbox" : "square-outline"}
          size={22}
          color={COLORS.primary}
          style={{ marginRight: 8 }}
        />
        <Text style={styles.label}>Sí</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => setFormData(prev => ({ ...prev, afecta_facturacion: "No" }))}
        style={styles.checkboxOption}
      >
        <Ionicons
          name={formData.afecta_facturacion === "No" ? "checkbox" : "square-outline"}
          size={22}
          color={COLORS.primary}
          style={{ marginRight: 8 }}
        />
        <Text style={styles.label}>No</Text>
      </TouchableOpacity>

    </View>
  </View>

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

<View style={styles.section}>
  <Text style={styles.sectionTitle}>👤 Gestión de la novedad</Text>

  {/* Funcionario que notifica */}
  <View style={styles.inputGroup}>
    <Text style={styles.label}>Funcionario que notifica la novedad</Text>
    <TextInput
      style={styles.input}
      value={formData.funcionario_notifica}
      onChangeText={(text) => setFormData(prev => ({ ...prev, funcionario_notifica: text }))}
      placeholder="Nombre completo"
      placeholderTextColor={COLORS.textSecondary}
    />
  </View>

  {/* Funcionario que autoriza */}
  <View style={styles.inputGroup}>
    <Text style={styles.label}>Funcionario que autoriza la novedad</Text>
    <TextInput
      style={styles.input}
      value={formData.funcionario_autoriza}
      onChangeText={(text) => setFormData(prev => ({ ...prev, funcionario_autoriza: text }))}
      placeholder="Nombre completo"
      placeholderTextColor={COLORS.textSecondary}
    />
  </View>

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

        {/* Sección de Firma (visible si existe firma guardada o recién capturada) */}
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
                pathname: '/formulario-novedades-servicio',
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

{showFechaFinal && (
  <DateTimePicker
    value={new Date()}
    mode="date"
    display="default"
    onChange={(e, d) => {
      setShowFechaFinal(false);
      if (d) {
        setFormData(prev => ({ 
          ...prev, 
          fecha_final: d.toISOString().split("T")[0] 
        }));
      }
    }}
  />
)}

{showFechaInicial && (
  <DateTimePicker
    value={new Date()}
    mode="date"
    display="default"
    onChange={(e, d) => {
      setShowFechaInicial(false);
      if (d) {
        setFormData(prev => ({ 
          ...prev, 
          fecha_inicial: d.toISOString().split("T")[0] 
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
  checkboxOption: {
  flexDirection: "row",
  alignItems: "center",
  paddingVertical: 6, // separación vertical
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
  checkboxContainer: {
  flexDirection: "row",
  alignItems: "center",
  marginRight: 16,
  marginBottom: 8
},
checkbox: {
  width: 22,
  height: 22,
  borderWidth: 2,
  borderColor: "#555",
  marginRight: 8,
  borderRadius: 4,
  justifyContent: "center",
  alignItems: "center",
  backgroundColor: "#FFF"
},
checkboxChecked: {
  backgroundColor: "#DDD"
},
check: {
  fontSize: 14,
  fontWeight: "bold",
  color: "#222"
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
    width: '100%',
    height: 250,
    backgroundColor: COLORS.background,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
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
