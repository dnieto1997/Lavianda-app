import React, { useState, useEffect, useRef } from "react";
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
  KeyboardAvoidingView
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";
import { Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as Print from "expo-print";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "./_layout";
import {
  subirFotoEvidencia,
  eliminarFotoEvidencia,
  obtenerUrlFoto,
} from "../services/evidenciasService";
import SimpleSignaturePad from "../components/SimpleSignaturePad";
import { useLocation } from "@/contexts/LocationContext";
import Svg, { SvgXml } from "react-native-svg";

const COLORS = {
  primary: "#1E3A8A", // Azul corporativo más elegante
  secondary: "#3B82F6", // Azul secundario
  success: "#10B981", // Verde moderno
  warning: "#F59E0B", // Amarillo profesional
  danger: "#EF4444", // Rojo moderno
  background: "#F8FAFC", // Gris muy claro
  surface: "#FFFFFF", // Blanco puro
  surfaceSecondary: "#F1F5F9", // Gris claro para alternancia
  textPrimary: "#1F2937", // Gris oscuro
  textSecondary: "#6B7280", // Gris medio
  border: "#E5E7EB", // Gris claro para bordes
  borderDark: "#D1D5DB", // Gris más oscuro para bordes
};

const API_BASE = "https://operaciones.lavianda.com.co/api";

interface CronogramaItem {
  horario: string;
  actividad: string;
  maquinaria: string[];
  insumos: string[];
  riesgos: string;
  epp: string;
  conductas: string;
}
 interface ActividadProgramadaAdicional {
  actividad: string;
  frecuencia: string;
}

interface FormularioData {
  // Datos generales (automáticos)
  consecutivo: string;
  empresa: string;
  nit_cedula: string;
  direccion: string;
  operario: string;
  horario: string;
  otros_horarios: string;
  telefono: string;
  areas_especificas: string;
  fecha: string;

  // Datos del formulario (fecha y horas automáticas)

  // Inventario
  cronograma: CronogramaItem[];

  // Actividades programadas adicionales
  actividadesAdicionales: ActividadProgramadaAdicional[];

  // Observaciones generales
  observaciones_generales: string;

  // Firma digital
  firma_responsable?: string;
  nombre_firmante?: string;
  cedula_firmante?: string;

  // Timestamps
  created_at?: string;
  updated_at?: string;
}

type FotoArea = {
  uri: string;
  url: string;
  ruta: string;
};



// Función auxiliar para normalizar URLs de fotos (fuera del componente para mejor performance)
const normalizarUrlFoto = (url: string): string => {
  if (!url) return "";

  // Si ya es una URL válida completa, devolverla
  if (url.startsWith("https://operaciones.lavianda.com.co/")) {
    return url;
  }

  // Limpiar URL malformada
  let urlLimpia = url
    .replace(/^http:\/\//, "https://") // Convertir http:// a https://
    .replace(/^http:/, "https://") // Corregir http: sin //
    .replace(/^https:([^\/])/, "https://$1") // Agregar // si falta después de https:
    .replace("operaciones.lavianda.com/", "operaciones.lavianda.com.co/"); // Corregir dominio

  // Si no tiene protocolo, agregarlo
  if (!urlLimpia.startsWith("http://") && !urlLimpia.startsWith("https://")) {
    urlLimpia = `https://operaciones.lavianda.com.co/storage/${urlLimpia}`;
  }

  console.log("🔧 URL normalizada:", { original: url, normalizada: urlLimpia });
  return urlLimpia;
};

export default function Cronograma() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();
  const [saving, setSaving] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string>("");
  const { startTracking, startBackgroundTracking } = useLocation();

  // Estados para firma digital
  const [modalFirmaVisible, setModalFirmaVisible] = useState(false);
  const [firmaBase64, setFirmaBase64] = useState<string>("");
  const signatureRef = useRef<any>(null);

  // Variables de modo
  const modo = (params?.modo as string) || "crear";
  const formularioId = params?.formularioId as string;
  const esVisualizacion = modo === "ver";
  const esModoCrear = modo === "crear";
  const esModoEditar = modo === "editar";
  const puedeEditar = esModoCrear || esModoEditar;

  // Datos iniciales automáticos con áreas predefinidas
  const [formData, setFormData] = useState<FormularioData>({
    consecutivo: "",
    empresa: "",
    nit_cedula: "",
    direccion: "",
    operario: "",
    otros_horarios: "",
    horario: "",
    telefono: "",
    areas_especificas: "",
    fecha: new Date().toISOString().split("T")[0],
    cronograma: [
      {
        horario: "",
        actividad: "",
        maquinaria: [],
        insumos: [],
        riesgos: "",
        epp: "",
        conductas: "",
      },
    ],
      actividadesAdicionales: [
    {
      actividad: '',
      frecuencia: '',
    },
  ],
    observaciones_generales: "",
  });

  // Función para obtener datos del registro y empresa
  const obtenerDatosEmpresa = async (registroId: string) => {
    console.log("🔍 Iniciando obtención de datos para registro:", registroId);

    try {
      // Primero intentar usar datos de params si están disponibles
      if (params?.empresa) {
        console.log("📋 Datos disponibles en params:", {
          empresa: params.empresa,
          nit: params.nit || "No disponible",
        });

        setFormData((prev) => ({
          ...prev,
          empresa: params.empresa as string,
          nit_cedula: (params.nit as string) || "",
        }));

        // Si no hay NIT en params, consultar API
        if (!params.nit) {
          console.log("🌐 NIT no disponible en params, consultando API...");
          await consultarDatosCompletos(registroId);
        }
        return;
      }

      // Si no hay datos en params, consultar API
      console.log("🌐 Datos no disponibles en params, consultando API...");
      await consultarDatosCompletos(registroId);
    } catch (error) {
      console.log("💥 Error general en obtenerDatosEmpresa:", error);
    }
  };

  // Función auxiliar para consultar datos completos de la API
  const consultarDatosCompletos = async (registroId: string) => {
    try {
      // Intentar obtener token del contexto de usuario PRIMERO
      let token = user?.token;
      console.log("🔑 Token del contexto:", token ? "SÍ EXISTE" : "NO EXISTE");

      // Si no hay token en el contexto, intentar AsyncStorage como fallback
      if (!token) {
        console.log("🔄 Intentando obtener token de AsyncStorage...");
        const storageToken = await AsyncStorage.getItem("authToken");
        token = storageToken || undefined;
        console.log(
          "🔑 Token de AsyncStorage:",
          token ? "SÍ EXISTE" : "NO EXISTE"
        );
      }

      if (token) {
        console.log("✅ Token válido encontrado, haciendo llamada a API...");
        try {
          const response = await axios.get(
            `${API_BASE}/registros-clientes/${registroId}`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
            }
          );

          console.log("📦 Respuesta completa de la API:", response.data);

          if (response.data?.registro) {
            const registro = response.data.registro;
            console.log("📋 Datos del registro:", registro);

            // Verificar si hay información de empresa en el registro
            if (registro.empresa) {
              console.log("🏢 Datos de empresa encontrados:", registro.empresa);

              setFormData((prev) => ({
                ...prev,
                empresa: registro.empresa.nombre || "",
                nit_cedula: registro.empresa.identificacion || "",
                direccion: registro.empresa.direccion || "",
                persona_encargada: registro.persona_encargada || "",
                correo: registro.correo || "",
                telefono: registro.telefono || "",
              }));
            } else {
              console.log(
                "⚠️ No se encontraron datos de empresa en el registro"
              );

              // Usar datos directos del registro si no hay empresa
              setFormData((prev) => ({
                ...prev,
                empresa: registro.nombre_empresa || "",
                nit_cedula: registro.identificacion || "",
                direccion: registro.direccion || "",
                persona_encargada: registro.persona_encargada || "",
                correo: registro.correo || "",
                telefono: registro.telefono || "",
              }));
            }
          } else {
            console.log("❌ No se encontraron datos en la respuesta");
          }
        } catch (error) {
          console.log("❌ Error en llamada a API:", error);
          if (axios.isAxiosError(error)) {
            console.log("📊 Status:", error.response?.status);
            console.log("📋 Data:", error.response?.data);
          }
        }
      } else {
        console.log("❌ No se pudo obtener token válido");
      }
    } catch (error) {
      console.log("💥 Error en consultarDatosCompletos:", error);
    }
  };

const agregarActividadAdicional = () => {
  setFormData((prev) => ({
    ...prev,
    actividadesAdicionales: [
      ...prev.actividadesAdicionales,
      {
        actividad: '',
        frecuencia: '',
      },
    ],
  }));
};
const eliminarActividadAdicional = (index: number) => {
  const nuevas = formData.actividadesAdicionales.filter((_, i) => i !== index);
  setFormData((prev) => ({
    ...prev,
    actividadesAdicionales: nuevas.length ? nuevas : [{ actividad: '', frecuencia: '' }],
  }));
};

const cambiarActividadAdicional = (
  index: number,
  campo: 'actividad' | 'frecuencia',
  valor: string
) => {
  const nuevas = [...formData.actividadesAdicionales];
  nuevas[index][campo] = valor;
  setFormData((prev) => ({
    ...prev,
    actividadesAdicionales: nuevas,
  }));
};


  // Función para generar consecutivo automático
  const generarConsecutivo = async () => {
    try {
      const storageToken = await AsyncStorage.getItem("authToken");
      const token = storageToken || undefined;

   

      console.log("🔄 Solicitando consecutivo al servidor...");
      const response = await axios.get(
        `${API_BASE}/formularios-cronograma/siguiente-consecutivo`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      console.log("📋 Respuesta consecutivo:", response.data);

      if (response.data?.consecutivo) {
        console.log("✅ Consecutivo del servidor:", response.data.consecutivo);
        setFormData((prev) => ({
          ...prev,
          consecutivo: response.data.consecutivo,
        }));
      } else {
        console.log(
          "⚠️ No se recibió consecutivo del servidor, generando local"
        );
       
      }
    } catch (error) {
      console.log("❌ Error generando consecutivo del servidor:", error);
      
    }
  };

  const agregarFilaCronograma = () => {
    setFormData((prev) => ({
      ...prev,
      cronograma: [
        ...prev.cronograma,
        {
          horario: "",
          actividad: "",
          maquinaria: [""],
          insumos: [""],
          riesgos: "",
          epp: "",
          conductas: "",
        },
      ],
    }));
  };

  const eliminarFilaCronograma = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      cronograma: prev.cronograma.filter((_, i) => i !== index),
    }));
  };

  const handleCronogramaChange = (
    index: number,
    field: keyof CronogramaItem,
    value: any
  ) => {
    setFormData((prev) => ({
      ...prev,
      cronograma: prev.cronograma.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      ),
    }));
  };
  const agregarMaquinaria = (filaIndex: number) => {
    const nuevo = [...formData.cronograma[filaIndex].maquinaria, ""];
    handleCronogramaChange(filaIndex, "maquinaria", nuevo);
  };

  const cambiarMaquinaria = (
    filaIndex: number,
    index: number,
    value: string
  ) => {
    const nuevo = [...formData.cronograma[filaIndex].maquinaria];
    nuevo[index] = value;
    handleCronogramaChange(filaIndex, "maquinaria", nuevo);
  };

  const agregarInsumo = (filaIndex: number) => {
    const nuevo = [...formData.cronograma[filaIndex].insumos, ""];
    handleCronogramaChange(filaIndex, "insumos", nuevo);
  };

  const cambiarInsumo = (filaIndex: number, index: number, value: string) => {
    const nuevo = [...formData.cronograma[filaIndex].insumos];
    nuevo[index] = value;
    handleCronogramaChange(filaIndex, "insumos", nuevo);
  };

  const eliminarMaquinaria = (filaIndex: number, itemIndex: number) => {
    const nueva = formData.cronograma[filaIndex].maquinaria.filter(
      (_, i) => i !== itemIndex
    );
    handleCronogramaChange(
      filaIndex,
      "maquinaria",
      nueva.length ? nueva : [""]
    );
  };

  const eliminarInsumo = (filaIndex: number, itemIndex: number) => {
    const nueva = formData.cronograma[filaIndex].insumos.filter(
      (_, i) => i !== itemIndex
    );
    handleCronogramaChange(filaIndex, "insumos", nueva.length ? nueva : [""]);
  };



  // Función para cargar formulario existente
const cargarFormularioExistente = async (formularioId: string) => {
  console.log("📖 Cargando cronograma con ID:", formularioId);

  try {
    let token = user?.token;

    if (!token) {
      const storageToken = await AsyncStorage.getItem("authToken");
      token = storageToken || undefined;
    }

    if (!token) {
      Alert.alert("Error", "No se encontró token de autenticación");
      return;
    }

    const response = await axios.get(
      `${API_BASE}/formularios/cronograma/${formularioId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.data?.data) {
      Alert.alert("Error", "No se pudo cargar el cronograma");
      return;
    }

    const formulario = response.data.data;

    console.log("📋 Cronograma recibido RAW:", formulario);

    /* ===========================
       NORMALIZAR CRONOGRAMA
    =========================== */
    let cronogramaNormalizado: any[] = [];

    if (Array.isArray(formulario.cronograma)) {
      cronogramaNormalizado = formulario.cronograma;
    } else if (typeof formulario.cronograma === "string") {
      try {
        cronogramaNormalizado = JSON.parse(formulario.cronograma);
      } catch (e) {
        console.error("❌ Error parseando cronograma:", e);
        cronogramaNormalizado = [];
      }
    }

    /* ===========================
       NORMALIZAR ACTIVIDADES ADICIONALES
    =========================== */
    let actividadesAdicionalesNormalizadas: any[] = [];

    if (Array.isArray(formulario.actividadesAdicionales)) {
      actividadesAdicionalesNormalizadas = formulario.actividadesAdicionales;
    } else if (typeof formulario.actividadesAdicionales === "string") {
      try {
        actividadesAdicionalesNormalizadas = JSON.parse(
          formulario.actividadesAdicionales
        );
      } catch (e) {
        console.error("❌ Error parseando actividades adicionales:", e);
        actividadesAdicionalesNormalizadas = [];
      }
    }

    /* ===========================
       SETEAR FORMULARIO
    =========================== */
    setFormData({
      consecutivo: formulario.consecutivo ?? "",
      empresa: formulario.empresa ?? "",
      nit_cedula: formulario.nit_cedula ?? "",
      direccion: formulario.direccion ?? "",
      operario: formulario.operario ?? "",
      telefono: formulario.telefono ?? "",

      horario: formulario.horario ?? "",
      otros_horarios: formulario.otros_horarios ?? "",

      areas_especificas: formulario.areas_especificas ?? "",
    fecha: formulario.fecha
  ? (() => {
      const fechaUTC = new Date(formulario.fecha);
      fechaUTC.setHours(fechaUTC.getHours() - 5);
      return fechaUTC.toISOString().split("T")[0];
    })()
  : (() => {
      const hoy = new Date();
      hoy.setHours(hoy.getHours() - 5);
      return hoy.toISOString().split("T")[0];
    })(),

      cronograma:
        cronogramaNormalizado.length > 0
          ? cronogramaNormalizado.map((item) => ({
              horario: item.horario ?? "",
              actividad: item.actividad ?? "",
              maquinaria: Array.isArray(item.maquinaria)
                ? item.maquinaria
                : [],
              insumos: Array.isArray(item.insumos) ? item.insumos : [],
              riesgos: item.riesgos ?? "",
              epp: item.epp ?? "",
              conductas: item.conductas ?? "",
            }))
          : [
              {
                horario: "",
                actividad: "",
                maquinaria: [],
                insumos: [],
                riesgos: "",
                epp: "",
                conductas: "",
              },
            ],

      actividadesAdicionales:
        actividadesAdicionalesNormalizadas.length > 0
          ? actividadesAdicionalesNormalizadas.map((item) => ({
              actividad: item.actividad ?? "",
              frecuencia: item.frecuencia ?? "",
            }))
          : [
              {
                actividad: "",
                frecuencia: "",
              },
            ],

      observaciones_generales: formulario.observaciones_generales ?? "",

      firma_responsable: formulario.firma_responsable ?? "",
      nombre_firmante: formulario.nombre_firmante ?? "",
      cedula_firmante: formulario.cedula_firmante ?? "",
    });
     if (formulario.firma_responsable) {
      setFirmaBase64(formulario.firma_responsable);
    }


    console.log("✅ Cronograma cargado y normalizado correctamente");
  } catch (error) {
    console.error("💥 Error cargando cronograma:", error);
    Alert.alert("Error", "No se pudo cargar el cronograma");
  }
};



  useEffect(() => {
    console.log("🚀 Iniciando formulario con parámetros:", params);

    const modo = params?.modo as string;
    const formularioId = params?.formularioId as string;

    if ((modo === "ver" || modo === "editar") && formularioId) {
      // Modo ver/editar: cargar formulario existente
      console.log(
        `👁️ Modo ${modo.toUpperCase()} - Cargando formulario existente`
      );
      cargarFormularioExistente(formularioId);
    } else {
      // Modo crear: configurar nuevo formulario
      console.log("➕ Modo CREAR - Configurando nuevo formulario");

      // Generar consecutivo automáticamente
      generarConsecutivo();


      if (params?.registroId) {
        console.log(
          "🔍 Intentando obtener NIT y más datos del registro:",
          params.registroId
        );
        obtenerDatosEmpresa(params.registroId as string);
      }

      // Configurar hora de fin automáticamente (1 hora después de inicio)
      const horaInicio = new Date();
      const horaFin = new Date(horaInicio.getTime() + 60 * 60 * 1000); // +1 hora
      setFormData((prev) => ({
        ...prev,
        hora_fin: horaFin.toTimeString().slice(0, 5),
      }));
    }
  }, [params?.registroId, params?.modo, params?.formularioId]);

 

const exportarPDF = async () => {
  if (!formData.consecutivo) {
    Alert.alert("Error", "No hay información para exportar");
    return;
  }

  try {
    Alert.alert(
      "Exportar PDF",
      "¿Desea exportar el cronograma a PDF?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Exportar",
          onPress: async () => {
            try {
              const cronogramaHTML = formData.cronograma
                .map(
                  (item, index) => `
                  <tr>
                    <td>${index + 1}</td>
                    <td>${item.horario || "-"}</td>
                    <td>${item.actividad || "-"}</td>
                    <td>${item.maquinaria?.join(", ") || "-"}</td>
                    <td>${item.insumos?.join(", ") || "-"}</td>
                    <td>${item.riesgos || "-"}</td>
                    <td>${item.epp || "-"}</td>
                    <td>${item.conductas || "-"}</td>
                  </tr>
                `
                )
                .join("");

              const actividadesAdicionalesHTML = formData.actividadesAdicionales
                ?.map(
                  (a, i) => `
                  <tr>
                    <td>${i + 1}</td>
                    <td>${a.actividad || "-"}</td>
                    <td>${a.frecuencia || "-"}</td>
                  </tr>
                `
                )
                .join("");

              const htmlContent = `
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="utf-8" />
                <title>Cronograma ${formData.consecutivo}</title>
                <style>
                  body { font-family: Arial, sans-serif; margin: 20px; }
                  h1 { text-align: center; }
                  .section { margin-top: 30px; }
                  table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                  th, td { border: 1px solid #ccc; padding: 8px; font-size: 12px; }
                  th { background: #f0f0f0; }
                </style>
              </head>
              <body>

                <h1>CRONOGRAMA DE ACTIVIDADES</h1>

                <p><strong>Consecutivo:</strong> ${formData.consecutivo}</p>
                <p><strong>Empresa:</strong> ${formData.empresa}</p>
                <p><strong>Operario:</strong> ${formData.operario || "-"}</p>
                <p><strong>Fecha:</strong> ${formData.fecha}</p>
                <p><strong>Dirección:</strong> ${formData.direccion || "-"}</p>

                <div class="section">
                  <h3>Cronograma</h3>
                  <table>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Horario</th>
                        <th>Actividad</th>
                        <th>Maquinaria / Equipos</th>
                        <th>Insumos</th>
                        <th>Riesgos</th>
                        <th>EPP</th>
                        <th>Conductas Seguras</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${cronogramaHTML}
                    </tbody>
                  </table>
                </div>

                ${
                  actividadesAdicionalesHTML
                    ? `
                <div class="section">
                  <h3>Actividades Adicionales</h3>
                  <table>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Actividad</th>
                        <th>Frecuencia</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${actividadesAdicionalesHTML}
                    </tbody>
                  </table>
                </div>
                `
                    : ""
                }

                <div class="section">
                  <h3>Observaciones Generales</h3>
                  <p>${formData.observaciones_generales || "Sin observaciones"}</p>
                </div>

              </body>
              </html>
              `;

              // WEB
              if (Platform.OS === "web") {
                await Print.printAsync({ html: htmlContent });
                Alert.alert(
                  "Éxito",
                  "Use la opción de imprimir del navegador para guardar el PDF"
                );
                return;
              }

              // MOBILE
              const { uri } = await Print.printToFileAsync({
                html: htmlContent,
              });

              const canShare = await Sharing.isAvailableAsync();
              if (canShare) {
                await Sharing.shareAsync(uri, {
                  mimeType: "application/pdf",
                  dialogTitle: "Compartir PDF",
                });
              } else {
                Alert.alert(
                  "PDF generado",
                  "El PDF se generó correctamente"
                );
              }
            } catch (err) {
              console.error("❌ Error PDF:", err);
              Alert.alert("Error", "No se pudo generar el PDF");
            }
          },
        },
      ]
    );
  } catch (error) {
    console.error("❌ Error exportar PDF:", error);
    Alert.alert("Error", "No se pudo exportar el cronograma");
  }
};





  // Función para cerrar modal
  const cerrarModal = () => {
    setModalVisible(false);
    setSelectedPhoto("");
  };

  // Función para iniciar el proceso de firma
  const iniciarProcesoDeFirma = () => {
    console.log("🖊️ === INICIANDO PROCESO DE FIRMA ===");
    console.log("📋 Empresa:", formData.empresa);

    if (!formData.empresa.trim()) {
      console.log("❌ Validación falló: empresa vacía");
      Alert.alert("Error", "El campo empresa es obligatorio");
      return;
    }

    console.log("✅ Validación pasada, abriendo modal de firma");
    setModalFirmaVisible(true);
  };

  // Función para guardar la firma y proceder con el guardado del formulario
  const guardarFirma = (signature: string) => {
    console.log("✍️ === FIRMA CAPTURADA ===");
    console.log("📏 Longitud de la firma:", signature.length);
    console.log("🔤 Primeros 100 caracteres:", signature.substring(0, 100));

    setFirmaBase64(signature);
    setModalFirmaVisible(false);
    console.log("💾 Procediendo con el guardado del formulario...");
    // Ahora sí proceder con el guardado
    handleSubmit(signature);
  };

  // Función para limpiar la firma
  const limpiarFirma = () => {
    console.log("🧹 Limpiando firma...");
    signatureRef.current?.clear();
  };

  // Función para cancelar la firma
  const cancelarFirma = () => {
    console.log("❌ Cancelando proceso de firma");
    setModalFirmaVisible(false);
  };

  const handleSubmit = async (signatureData?: string) => {
  setSaving(true);

  try {
    let token = user?.token;

    if (!token) {
      const storageToken = await AsyncStorage.getItem("authToken");
      token = storageToken || undefined;
    }

    if (!token) {
      Alert.alert("Error", "No se encontró token de autenticación");
      return;
    }

    if (!formData.empresa.trim()) {
      Alert.alert("Error", "El campo empresa es obligatorio");
      return;
    }

    /* ------------------------------
       LIMPIEZA DE DATOS
    ------------------------------ */

    const actividadesAdicionalesLimpias = formData.actividadesAdicionales
      .filter(
        (a) => a.actividad.trim() || a.frecuencia.trim()
      )
      .map((a) => ({
        actividad: a.actividad.trim(),
        frecuencia: a.frecuencia.trim(),
      }));

  const cronogramaLimpio = formData.cronograma.map(item => ({
  ...item,
  maquinaria: item.maquinaria.filter(m => m.trim()),
  insumos: item.insumos.filter(i => i.trim()),
}));

    const dataToSend = {
  ...formData,

  cronograma: JSON.stringify(cronogramaLimpio),
  actividadesAdicionales: JSON.stringify(actividadesAdicionalesLimpias),

  registro_cliente_id: params?.registroId || null,
  firma_responsable: signatureData || firmaBase64,
};

console.log("📤 Datos a enviar al servidor:", dataToSend);

    let response;

    if (modo === "editar" && formularioId) {
      response = await axios.put(
        `${API_BASE}/formularios/cronograma/${formularioId}`,
        dataToSend,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
    } else {
      response = await axios.post(
        `${API_BASE}/formularios/cronograma`,
        dataToSend,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      console.log("📋 Respuesta del servidor:", response);
    }

    try {
      await startTracking(token, "cronograma");
    } catch (e) {
      console.warn("Tracking falló:", e);
    }
 
    Alert.alert(
      "Éxito",
      modo === "editar"
        ? "Cronograma actualizado correctamente"
        : "Cronograma creado correctamente",
      [
        {
          text: "OK",
          onPress: () =>
            router.push({
              pathname: "/registro-detalle",
              params: { registroId: params.registroId },
            }),
        },
      ]
    );
  } catch (error) {
    if (axios.isAxiosError(error)) {
      Alert.alert(
        "Error",
        error.response?.data?.message ||
          error.response?.data?.error ||
          "Error del servidor"
      );
    } else {
      Alert.alert("Error", "Error de conexión");
    }
  } finally {
    setSaving(false);
  }
};


  return (
     <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
    <SafeAreaView style={styles.container}>
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
                placeholder="Generado automáticamente"
                placeholderTextColor={COLORS.textSecondary}
              />
            </View>
            <View style={styles.halfInput}>
              <Text style={styles.label}>Fecha</Text>
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
              onChangeText={
                esVisualizacion
                  ? undefined
                  : (text) =>
                      setFormData((prev) => ({ ...prev, empresa: text }))
              }
              placeholder="Nombre de la empresa"
              placeholderTextColor={COLORS.textSecondary}
              editable={!esVisualizacion}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>NIT / Cédula *</Text>
            <TextInput
              style={styles.input}
              value={formData.nit_cedula}
              onChangeText={(text) =>
                setFormData((prev) => ({ ...prev, nit_cedula: text }))
              }
              placeholder="Número de identificación"
              placeholderTextColor={COLORS.textSecondary}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Dirección *</Text>
            <TextInput
              style={styles.input}
              value={formData.direccion}
              onChangeText={(text) =>
                setFormData((prev) => ({ ...prev, direccion: text }))
              }
              placeholder="Dirección de la empresa"
              placeholderTextColor={COLORS.textSecondary}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nombre del Operario *</Text>
            <TextInput
              style={styles.input}
              value={formData.operario}
              onChangeText={(text) =>
                setFormData((prev) => ({ ...prev, operario: text }))
              }
              placeholder="Nombre del Operario"
              placeholderTextColor={COLORS.textSecondary}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Telefono</Text>
            <TextInput
              style={styles.input}
              value={formData.telefono}
              onChangeText={(text) =>
                setFormData((prev) => ({ ...prev, telefono: text }))
              }
              placeholder="Número de teléfono"
              placeholderTextColor={COLORS.textSecondary}
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Horarios *</Text>
            <TextInput
              style={styles.input}
              value={formData.horario}
              onChangeText={(text) =>
                setFormData((prev) => ({ ...prev, horario: text }))
              }
              placeholder="Horarios"
              placeholderTextColor={COLORS.textSecondary}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Otros Horarios *</Text>
            <TextInput
              style={styles.input}
              value={formData.otros_horarios}
              onChangeText={(text) =>
                setFormData((prev) => ({ ...prev, otros_horarios: text }))
              }
              placeholder="Otros Horarios"
              placeholderTextColor={COLORS.textSecondary}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Areas Especificas</Text>
            <TextInput
              style={styles.input}
              value={formData.areas_especificas}
              onChangeText={(text) =>
                setFormData((prev) => ({ ...prev, areas_especificas: text }))
              }
              placeholder="Areas Especificas"
              placeholderTextColor={COLORS.textSecondary}
            />
          </View>

          <View style={styles.section}>
               <Text style={styles.sectionTitle}>📅 Cronograma de Trabajo</Text>

            <View style={styles.sectionHeader}>
           
              {!esVisualizacion && (
                <TouchableOpacity
                  style={styles.addRowButton}
                  onPress={agregarFilaCronograma}
                >
                  <Ionicons name="add" size={18} color="#fff" />
                  <Text style={styles.addRowButtonText}>Agregar actividad</Text>
                </TouchableOpacity>
              )}
            </View>

            {formData.cronograma.map((fila, index) => (
              <View key={index} style={styles.cronogramaBlock}>
                {/* CABECERA */}
                <View style={styles.blockHeader}>
                  <Text style={styles.blockTitle}>Actividad #{index + 1}</Text>

                  {formData.cronograma.length > 1 && (
                    <TouchableOpacity
                      onPress={() => eliminarFilaCronograma(index)}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={20}
                        color={COLORS.danger}
                      />
                    </TouchableOpacity>
                  )}
                </View>

                {/* HORARIO / ACTIVIDAD */}
                <View style={styles.group}>
                  <Text style={styles.label}>Horario</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ej: 7:00 am - 8:00 am"
                    value={fila.horario}
                    onChangeText={(t) =>
                      handleCronogramaChange(index, "horario", t)
                    }
                  />
                </View>

                <View style={styles.group}>
                  <Text style={styles.label}>Actividad</Text>
                  <TextInput
                    style={[styles.input, styles.bigInput]}
                    multiline
                    placeholder="Descripción de la actividad"
                    value={fila.actividad}
                    onChangeText={(t) =>
                      handleCronogramaChange(index, "actividad", t)
                    }
                  />
                </View>

                {/* MAQUINARIA */}
                <View style={styles.group}>
                  <View style={styles.groupHeader}>
                    <Text style={styles.groupTitle}>
                      🔧 Maquinaria / Equipos
                    </Text>
                    <TouchableOpacity onPress={() => agregarMaquinaria(index)}>
                      <Ionicons
                        name="add-circle"
                        size={22}
                        color={COLORS.primary}
                      />
                    </TouchableOpacity>
                  </View>

                  {fila.maquinaria.map((m, i) => (
                    <View key={i} style={styles.inlineInput}>
                      <TextInput
                        style={[styles.input, styles.bigInput]}
                        multiline
                        placeholder={`Equipo ${i + 1}`}
                        value={m}
                        onChangeText={(t) => cambiarMaquinaria(index, i, t)}
                      />
                      <TouchableOpacity
                        onPress={() => eliminarMaquinaria(index, i)}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={18}
                          color={COLORS.danger}
                        />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>

                {/* INSUMOS */}
                <View style={styles.group}>
                  <View style={styles.groupHeader}>
                    <Text style={styles.groupTitle}>🧪 Insumos</Text>
                    <TouchableOpacity onPress={() => agregarInsumo(index)}>
                      <Ionicons
                        name="add-circle"
                        size={22}
                        color={COLORS.primary}
                      />
                    </TouchableOpacity>
                  </View>

                  {fila.insumos.map((ins, i) => (
                    <View key={i} style={styles.inlineInput}>
                      <TextInput
                        style={[styles.input, styles.bigInput]}
                        multiline
                        placeholder={`Insumo ${i + 1}`}
                        value={ins}
                        onChangeText={(t) => cambiarInsumo(index, i, t)}
                      />

                      <TouchableOpacity
                        onPress={() => eliminarInsumo(index, i)}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={18}
                          color={COLORS.danger}
                        />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>

                {/* RIESGOS */}
                <View style={styles.group}>
                  <Text style={styles.groupTitle}>⚠️ Riesgos</Text>
                  <TextInput
                    style={[styles.input, styles.autoGrow]}
                    multiline
                    placeholder="Ergonómicos, físicos, químicos..."
                    value={fila.riesgos}
                    onChangeText={(t) =>
                      handleCronogramaChange(index, "riesgos", t)
                    }
                  />
                </View>

                {/* EPP */}
                <View style={styles.group}>
                  <Text style={styles.groupTitle}>
                    🦺 Elementos de Protección Personal
                  </Text>
                  <TextInput
                    style={[styles.input, styles.autoGrow]}
                    multiline
                    placeholder="Guantes, tapabocas, botas..."
                    value={fila.epp}
                    onChangeText={(t) =>
                      handleCronogramaChange(index, "epp", t)
                    }
                  />
                </View>

                {/* CONDUCTAS */}
                <View style={styles.group}>
                  <Text style={styles.groupTitle}>✅ Conductas Seguras</Text>
                  <TextInput
                    style={[styles.input, styles.autoGrow]}
                    multiline
                    placeholder="Posturas adecuadas, lavado de manos..."
                    value={fila.conductas}
                    onChangeText={(t) =>
                      handleCronogramaChange(index, "conductas", t)
                    }
                  />
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Observaciones Generales */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notas</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={formData.observaciones_generales}
            onChangeText={(text) =>
              setFormData((prev) => ({
                ...prev,
                observaciones_generales: text,
              }))
            }
            placeholder="Notas u observaciones generales"
            placeholderTextColor={COLORS.textSecondary}
            multiline
            numberOfLines={4}
            editable={puedeEditar}
          />
        </View>

        <View style={styles.section}>
            <Text style={styles.sectionTitle}>
      📋 Actividades Programadas Adicionales en la Semana
    </Text>
  <View style={styles.sectionHeader}>
    

    {!esVisualizacion && (
      <TouchableOpacity
        style={styles.addRowButton}
        onPress={agregarActividadAdicional}
      >
        <Ionicons name="add" size={18} color="#fff" />
        <Text style={styles.addRowButtonText}>Agregar</Text>
      </TouchableOpacity>
    )}
  </View>

  {/* CABECERA TABLA */}


  {/* FILAS */}
{formData.actividadesAdicionales.map((item, index) => (
  <View key={index} style={styles.actividadItem}>

    <Text style={styles.label}>Actividad</Text>
    <TextInput
      style={styles.input}
      placeholder="Ej: Lavado de torres y paredes"
      value={item.actividad}
      onChangeText={(t) =>
        cambiarActividadAdicional(index, 'actividad', t)
      }
    />

    <Text style={[styles.label, { marginTop: 10 }]}>Frecuencia</Text>
    <TextInput
      style={styles.input}
      placeholder="Ej: 1 vez al mes"
      value={item.frecuencia}
      onChangeText={(t) =>
        cambiarActividadAdicional(index, 'frecuencia', t)
      }
    />

    {!esVisualizacion && (
      <TouchableOpacity
        onPress={() => eliminarActividadAdicional(index)}
        style={styles.deleteButton}
      >
        <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
      
      </TouchableOpacity>
    )}
  </View>
))}

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
                  decodedSvg = decodedSvg.replace(
                    "<svg",
                    `<svg viewBox="0 0 344 300"`
                  ); // 👈 más alto
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
                      width="100%" // 👈 ocupa todo el ancho
                      height={220} // 👈 firma grande y sin recorte
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
              <Ionicons
                name="document-outline"
                size={20}
                color={COLORS.surface}
              />
              <Text style={styles.actionButtonText}>Exportar PDF</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.editButton]}
              onPress={() =>
                router.push({
                  pathname: "/cronograma",
                  params: {
                    ...params,
                    modo: "editar",
                  },
                })
              }
            >
              <Ionicons
                name="create-outline"
                size={20}
                color={COLORS.surface}
              />
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
              {saving ? "Guardando..." : "Firmar y Guardar Cronograma"}
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
            <Text style={styles.firmaSubtitle}>
              Por favor, firme en el área a continuación
            </Text>
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
              <Ionicons
                name="refresh-outline"
                size={20}
                color={COLORS.primary}
              />
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
                  Alert.alert(
                    "Firma vacía",
                    "Por favor, firme antes de confirmar"
                  );
                  return;
                }
                const signatureData = signatureRef.current?.toDataURL();
                if (signatureData) {
                  guardarFirma(signatureData);
                }
              }}
            >
              <Ionicons
                name="checkmark-outline"
                size={20}
                color={COLORS.surface}
              />
              <Text style={styles.firmaButtonTextPrimary}>Confirmar</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Modal para visualizar foto en tamaño completo */}
     
    </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: COLORS.primary,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: COLORS.surface,
    textAlign: "center",
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },

  checkboxContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 12,
    gap: 16,
  },

  checkboxOption: {
    flexDirection: "row",
    alignItems: "center",
  },

  checkboxLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.textPrimary,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.primary,
    marginBottom: 16,
    flex: 1,
    marginRight: 10,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 16,
    fontStyle: "italic",
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    width: '90%',
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
    textAlignVertical: "top",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  areaTitle: {
    fontSize: 16,
    fontWeight: "500",
    color: COLORS.textPrimary,
    flex: 1,
    marginBottom: 8,
  },
  toggleContainer: {
    marginLeft: 12,
  },
  toggleButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 60,
    alignItems: "center",
    justifyContent: "center",
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
    fontWeight: "600",
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
    textAlignVertical: "top",
  },
  addButtonContainer: {
    alignItems: "flex-end",
    marginBottom: 16,
  },
  actividadItem: {
  width: '100%',
  marginBottom: 16,
},
  addButton: {
    flexDirection: "row",
    alignItems: "center",
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
    fontWeight: "500",
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  inventarioTitle: {
    fontSize: 16,
    fontWeight: "600",
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
    alignItems: "center",
    marginTop: 24,
    elevation: 3,
    shadowColor: "#000",
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
    fontWeight: "600",
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 24,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 12,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    gap: 8,
  },
  cronogramaCard: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  cronogramaHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },

  cronogramaTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.primary,
  },

  trashButton: {
    padding: 6,
    backgroundColor: COLORS.surface,
    borderRadius: 8,
  },

  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },

  subSection: {
    marginTop: 14,
  },

  subHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },

  subTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textPrimary,
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
    fontWeight: "600",
  },
  disabledButton: {
    opacity: 0.6,
  },
  bottomPadding: {
    height: 40,
  },
  // Estilos para fotos
  addPhotoButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surface,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderStyle: "dashed",
    marginTop: 8,
  },
  addPhotoButtonText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.primary,
  },
  fotosContainer: {
    marginTop: 12,
  },
  fotosLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  fotosScroll: {
    flexDirection: "row",
  },
  fotoItem: {
    position: "relative",
    marginRight: 12,
  },
  fotoPreview: {
    width: 100,
    height: 100,
    borderRadius: 8,
    backgroundColor: COLORS.border,
  },
  fotoError: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.surfaceSecondary,
    borderWidth: 1,
    borderColor: COLORS.borderDark,
    borderStyle: "dashed",
  },
  fotoErrorText: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  deleteFotoButton: {
    position: "absolute",
    top: -8,
    right: -8,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  // Estilos para el modal de visualización de fotos
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.95)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalBackground: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "90%",
    height: "80%",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  closeButton: {
    position: "absolute",
    top: -50,
    right: 10,
    zIndex: 10,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: 20,
  },
  fullSizeImage: {
    width: "100%",
    height: "100%",
    borderRadius: 8,
  },
  modalHint: {
    position: "absolute",
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  firmaTitle: {
    fontSize: 24,
    fontWeight: "700",
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
    overflow: "hidden",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  firmaButtonsContainer: {
    flexDirection: "row",
    padding: 20,
    gap: 12,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  firmaButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
    elevation: 2,
    shadowColor: "#000",
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
    fontWeight: "600",
  },
  firmaButtonTextSecondary: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: "600",
  },
  firmaButtonTextDanger: {
    color: COLORS.danger,
    fontSize: 16,
    fontWeight: "600",
  },
  // Estilos para vista previa de firma

  firmaPreview: {
    width: "100%",
    height: 200,
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
    fontWeight: "600",
    color: COLORS.textPrimary,
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
    height: 230, // 👈 suficiente espacio para firma grande
    justifyContent: "flex-start",
    alignItems: "center",
    overflow: "visible",
  },

  firmaInfoContainer: {
    alignItems: "center",
  },
  cronogramaBlock: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 20,
    marginBottom: 20,
  },

  blockHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },

  blockTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.primary,
  },

  group: {
    marginTop: 14,
  },

  groupHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },

  groupTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textPrimary,
  },

  inlineInput: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },

  autoGrow: {
    minHeight: 44,
    textAlignVertical: "top",
  },

  addRowButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },

  addRowButtonText: {
    color: "#fff",
    fontWeight: "600",
  },

  bigInput: {
    minHeight: 60,
    paddingVertical: 14,
    textAlignVertical: "top",
    fontSize: 15,
  },

  tableHeader: {
  flexDirection: 'row',
  paddingVertical: 8,
  borderBottomWidth: 1,
  borderBottomColor: COLORS.border,
  marginBottom: 8,
},

tableHeaderText: {
  fontWeight: '700',
  color: COLORS.textSecondary,
  fontSize: 14,
},

tableRow: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
  marginBottom: 10,
},

trashIcon: {
  padding: 6,
},

});
