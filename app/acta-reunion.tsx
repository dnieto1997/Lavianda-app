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
  KeyboardAvoidingView,
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

interface Participante {
  cedula: string;
  nombre: string;
  cargo: string;
  proceso: string;
  firma?: string; // base64
}

interface Acuerdo {
  actividad: string;
  responsable: string;
  fecha_prevista: string;
}

interface Seguimientos {
  actividad: string;
  responsable: string;
  fecha_prevista: string;
  estado_observacion: string;
}
interface FormularioData {
  // Datos generales (automáticos)
  consecutivo: string;
  empresa: string;
  nit_cedula: string;
  fecha: string;
  hora_inicio?: string;
  hora_fin?: string;
  citado_por?: string;
  reunion?: string;
  encargado?: string;
  lugar?: string;

  // Datos del formulario (fecha y horas automáticas)

  // Inventario
  participantes: Participante[];
  orden_dia?: string;
  temas?: string;
  acuerdos: Acuerdo[];
  seguimientos_acuerdos: Seguimientos[];

  // Observaciones generales

 elaborado?: string;
 aprobado?: string;
 fecha_aprobacion?: string;

  // Firma digital
  firma_responsable?: string;
  nombre_firmante?: string;
  cedula_firmante?: string;

  // Timestamps
  created_at?: string;
  updated_at?: string;
}

export default function ActaReunion() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();
  const [saving, setSaving] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string>("");
  const { startTracking, startBackgroundTracking } = useLocation();
  const [modalFirmaVisible, setModalFirmaVisible] = useState(false);
  const [firmaBase64, setFirmaBase64] = useState<string>("");

  const [modalFirmaParticipanteVisible, setModalFirmaParticipanteVisible] =
    useState(false);

  const [participanteFirmandoIndex, setParticipanteFirmandoIndex] = useState<
    number | null
  >(null);

  const signatureParticipanteRef = useRef<any>(null);

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
    citado_por: "",
    hora_fin: "",
    hora_inicio: "",
    encargado: "",
    lugar: "",
    reunion: "",
    fecha: (() => {
      const hoy = new Date();
      hoy.setHours(hoy.getHours() - 5);
      return hoy.toISOString().split("T")[0];
    })(),
    participantes: [
      { cedula: "", nombre: "", cargo: "", proceso: "", firma: "" },
    ],
    orden_dia: "",
    temas: "",
    acuerdos: [
      {
        actividad: "",
        responsable: "",
        fecha_prevista: "",
      },
    ],
    seguimientos_acuerdos: [
      {
        actividad: "",
        responsable: "",
        fecha_prevista: "",
        estado_observacion: "",
      },
    ],
    fecha_aprobacion: "",
    elaborado: "",
    aprobado: "",
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

  const agregarSeguimiento = () => {
    setFormData({
      ...formData,
      seguimientos_acuerdos: [
        ...formData.seguimientos_acuerdos,
        {
          actividad: "",
          responsable: "",
          fecha_prevista: "",
          estado_observacion: "",
        },
      ],
    });
  };

  const eliminarSeguimiento = (index: number) => {
    const copia = [...formData.seguimientos_acuerdos];
    copia.splice(index, 1);

    setFormData({
      ...formData,
      seguimientos_acuerdos: copia.length
        ? copia
        : [
            {
              actividad: "",
              responsable: "",
              fecha_prevista: "",
              estado_observacion: "",
            },
          ],
    });
  };

  // Función para generar consecutivo automático
  const generarConsecutivo = async () => {
    try {
      const storageToken = await AsyncStorage.getItem("authToken");
      const token = storageToken || undefined;

      console.log("🔄 Solicitando consecutivo al servidor...");
      const response = await axios.get(
        `${API_BASE}/formularios-actareunion/siguiente-consecutivo`,
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

  const agregarParticipante = () => {
    setFormData((prev) => ({
      ...prev,
      participantes: [
        ...prev.participantes,
        { cedula: "", nombre: "", cargo: "", proceso: "", firma: "" },
      ],
    }));
  };

  const eliminarParticipante = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      participantes:
        prev.participantes.length > 1
          ? prev.participantes.filter((_, i) => i !== index)
          : prev.participantes,
    }));
  };

  const cambiarParticipante = (
    index: number,
    campo: keyof Participante,
    valor: string
  ) => {
    const copia = [...formData.participantes];
    copia[index][campo] = valor;
    setFormData((prev) => ({ ...prev, participantes: copia }));
  };
  const abrirFirmaParticipante = (index: number) => {
    setParticipanteFirmandoIndex(index);
    setModalFirmaParticipanteVisible(true);
  };
  const guardarFirmaParticipante = (signature: string) => {
    if (participanteFirmandoIndex === null) return;

    const copia = [...formData.participantes];
    copia[participanteFirmandoIndex].firma = signature;

    setFormData({
      ...formData,
      participantes: copia,
    });

    setModalFirmaParticipanteVisible(false);
    setParticipanteFirmandoIndex(null);

    Alert.alert("Firma guardada", "La firma del participante fue guardada");
  };

  const limpiarFirmaParticipante = () => {
    signatureParticipanteRef.current?.clear();
  };
  const cancelarFirmaParticipante = () => {
    setModalFirmaParticipanteVisible(false);
    setParticipanteFirmandoIndex(null);
  };

  // Función para cargar formulario existente
 const cargarFormularioExistente = async (formularioId: string) => {
  console.log("📖 Cargando acta de reunión con ID:", formularioId);

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
      `${API_BASE}/formularios/acta-reunion/${formularioId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.data?.data) {
      Alert.alert("Error", "No se pudo cargar el acta de reunión");
      return;
    }

    const formulario = response.data.data;

    console.log("📋 Acta de reunión recibida RAW:", formulario);

    /* ===========================
       NORMALIZAR JSON
       =========================== */
    const normalizarArray = (campo: any): any[] => {
      if (Array.isArray(campo)) return campo;

      if (typeof campo === "string") {
        try {
          const parsed = JSON.parse(campo);
          return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
          console.error("❌ Error parseando JSON:", e);
          return [];
        }
      }

      return [];
    };

    const participantesNormalizados = normalizarArray(formulario.participantes);
    const acuerdosNormalizados = normalizarArray(formulario.acuerdos);
    const seguimientosNormalizados = normalizarArray(
      formulario.seguimientos_acuerdos
    );

    /* ===========================
       CARGAR FORM
       =========================== */
    setFormData({
      consecutivo: formulario.consecutivo ?? "",
      empresa: formulario.empresa ?? "",
      nit_cedula: formulario.nit_cedula ?? "",

      fecha: formulario.fecha
        ? formulario.fecha.split("T")[0]
        : new Date().toISOString().split("T")[0],

      hora_inicio: formulario.hora_inicio ?? "",
      hora_fin: formulario.hora_fin ?? "",
      citado_por: formulario.citado_por ?? "",
      reunion: formulario.reunion ?? "",
      encargado: formulario.encargado ?? "",
      lugar: formulario.lugar ?? "",

      participantes: participantesNormalizados,
      orden_dia: formulario.orden_dia?? "",
      temas: formulario.temas?? "",
      acuerdos: acuerdosNormalizados,
      seguimientos_acuerdos: seguimientosNormalizados,

      elaborado: formulario.elaborado ?? "",
      aprobado: formulario.aprobado ?? "",
      fecha_aprobacion: formulario.fecha_aprobacion
        ? formulario.fecha_aprobacion.split("T")[0]
        : "",

      firma_responsable: formulario.firma_responsable ?? "",
      nombre_firmante: formulario.nombre_firmante ?? "",
      cedula_firmante: formulario.cedula_firmante ?? "",
    });

    if (formulario.firma_responsable) {
      setFirmaBase64(formulario.firma_responsable);
    }

    console.log("✅ Acta de reunión cargada y normalizada correctamente");
  } catch (error) {
    console.error("💥 Error cargando acta de reunión:", error);
    Alert.alert("Error", "No se pudo cargar el acta de reunión");
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
    }
  }, [params?.registroId, params?.modo, params?.formularioId]);

  const agregarAcuerdo = () => {
    setFormData({
      ...formData,
      acuerdos: [
        ...formData.acuerdos,
        {
          actividad: "",
          responsable: "",
          fecha_prevista: "",
        },
      ],
    });
  };

  const eliminarAcuerdo = (index: number) => {
    const copia = [...formData.acuerdos];
    copia.splice(index, 1);

    setFormData({
      ...formData,
      acuerdos: copia.length
        ? copia
        : [
            {
              actividad: "",
              responsable: "",
              fecha_prevista: "",
            },
          ],
    });
  };

  const exportarPDF = async () => {
  try {
    const participantesHTML = formData.participantes
      .map(
        (p, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${p.nombre}</td>
          <td>${p.cargo}</td>
          <td>${p.proceso}</td>
          <td>${p.cedula}</td>
          <td>
            ${
              p.firma
                ? `<img src="${p.firma}" style="width:150px;height:80px;" />`
                : "Sin firma"
            }
          </td>
        </tr>
      `
      )
      .join("");

    const acuerdosHTML = formData.acuerdos
      .map(
        (a, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${a.actividad}</td>
          <td>${a.responsable}</td>
          <td>${a.fecha_prevista}</td>
        </tr>
      `
      )
      .join("");

    const seguimientosHTML = formData.seguimientos_acuerdos
      .map(
        (s, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${s.actividad}</td>
          <td>${s.responsable}</td>
          <td>${s.fecha_prevista}</td>
          <td>${s.estado_observacion}</td>
        </tr>
      `
      )
      .join("");

    const html = `
    <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: Arial; font-size: 12px; }
        h2 { text-align: center; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { border: 1px solid #999; padding: 6px; }
        th { background: #f0f0f0; }
      </style>
    </head>
    <body>

      <h2>ACTA DE REUNIÓN</h2>

      <p><b>Empresa:</b> ${formData.empresa}</p>
      <p><b>Fecha:</b> ${formData.fecha}</p>
      <p><b>Reunión:</b> ${formData.reunion}</p>
      <p><b>Citada por:</b> ${formData.citado_por}</p>
      <p><b>Lugar:</b> ${formData.lugar}</p>
      <p><b>Hora inicio:</b> ${formData.hora_inicio}</p>
      <p><b>Hora fin:</b> ${formData.hora_fin}</p>

      <h3>Orden del día</h3>
      <p>${formData.orden_dia || "-"}</p>

      <h3>Temas tratados</h3>
      <p>${formData.temas || "-"}</p>

      <h3>Participantes</h3>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Nombre</th>
            <th>Cargo</th>
            <th>Proceso</th>
            <th>Cédula</th>
            <th>Firma</th>
          </tr>
        </thead>
        <tbody>${participantesHTML}</tbody>
      </table>

      <h3>Acuerdos</h3>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Actividad</th>
            <th>Responsable</th>
            <th>Fecha</th>
          </tr>
        </thead>
        <tbody>${acuerdosHTML}</tbody>
      </table>

      <h3>Seguimiento acuerdos</h3>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Actividad</th>
            <th>Responsable</th>
            <th>Fecha</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>${seguimientosHTML}</tbody>
      </table>

      <h3>Firma responsable</h3>
      ${
        formData.firma_responsable
          ? `<img src="${formData.firma_responsable}" style="width:250px;height:120px;" />`
          : "Sin firma"
      }

      <p><b>Nombre:</b> ${formData.nombre_firmante || ""}</p>
      <p><b>Cédula:</b> ${formData.cedula_firmante || ""}</p>

    </body>
    </html>
    `;

    if (Platform.OS === "web") {
      await Print.printAsync({ html });
    } else {
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri);
    }
  } catch (e) {
    console.error(e);
    Alert.alert("Error", "No se pudo generar el PDF");
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

        const dataToSend = {
      ...formData,

      // IDs
      registro_cliente_id: params?.registroId || null,

      // Firma
      firma_responsable: signatureData || firmaBase64,

      // 👇 JSON como TEXTO para la BD
      participantes: JSON.stringify(formData.participantes),
      acuerdos: JSON.stringify(formData.acuerdos),
      seguimientos_acuerdos: JSON.stringify(formData.seguimientos_acuerdos),
    };

      console.log("📤 Datos a enviar al servidor:", dataToSend);

      let response;

      if (modo === "editar" && formularioId) {
        response = await axios.put(
          `${API_BASE}/formularios/acta-reunion/${formularioId}`,
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
          `${API_BASE}/formularios/acta-reunion`,
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
      await startTracking(token, "acta_reunion");
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

  const RenderFirmaSVG = ({ data }: { data?: string }) => {
  if (!data) return null;

  try {
    const base64 = data.split(",")[1];

    let decodedSvg = decodeURIComponent(escape(atob(base64)));

    if (!decodedSvg.includes("viewBox")) {
      decodedSvg = decodedSvg.replace(
        "<svg",
        `<svg viewBox="0 0 344 300"`
      );
    }

    decodedSvg = decodedSvg.replace(
      "<path",
      `<path transform="translate(0, -60)"`
    );

    return (
      <View style={styles.svgWrapper}>
        <SvgXml
          xml={decodedSvg}
          width="100%"
          height={220}
          preserveAspectRatio="xMidYMid meet"
        />
      </View>
    );
  } catch (e) {
    console.error("❌ Error renderizando firma:", e);
    return null;
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
              <Text style={styles.label}>Comite o Reunion *</Text>
              <TextInput
                style={styles.input}
                value={formData.reunion}
                onChangeText={(text) =>
                  setFormData((prev) => ({ ...prev, reunion: text }))
                }
                placeholder="Comite o Reunion"
                placeholderTextColor={COLORS.textSecondary}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Citada Por *</Text>
              <TextInput
                style={styles.input}
                value={formData.citado_por}
                onChangeText={(text) =>
                  setFormData((prev) => ({ ...prev, citado_por: text }))
                }
                placeholder="Citada Por"
                placeholderTextColor={COLORS.textSecondary}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Encargado del Acta *</Text>
              <TextInput
                style={styles.input}
                value={formData.encargado}
                onChangeText={(text) =>
                  setFormData((prev) => ({ ...prev, encargado: text }))
                }
                placeholder="Encargado del Acta"
                placeholderTextColor={COLORS.textSecondary}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Lugar *</Text>
              <TextInput
                style={styles.input}
                value={formData.lugar}
                onChangeText={(text) =>
                  setFormData((prev) => ({ ...prev, lugar: text }))
                }
                placeholder="Lugar"
                placeholderTextColor={COLORS.textSecondary}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Hora de Inicio *</Text>
              <TextInput
                style={styles.input}
                value={formData.hora_inicio}
                onChangeText={(text) =>
                  setFormData((prev) => ({ ...prev, hora_inicio: text }))
                }
                placeholder="Hora de Inicio"
                placeholderTextColor={COLORS.textSecondary}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Hora Fin *</Text>
              <TextInput
                style={styles.input}
                value={formData.hora_fin}
                onChangeText={(text) =>
                  setFormData((prev) => ({ ...prev, hora_fin: text }))
                }
                placeholder="Hora Fin"
                placeholderTextColor={COLORS.textSecondary}
              />
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>👥 Participantes</Text>

                {!esVisualizacion && (
                  <TouchableOpacity
                    style={styles.addButton}
                    onPress={agregarParticipante}
                  >
                    <Ionicons name="add" size={20} color="black" />
                    <Text style={styles.addButtonText}>Agregar</Text>
                  </TouchableOpacity>
                )}
              </View>

              {formData.participantes.map((p, index) => (
                <View key={index} style={styles.participanteContainer}>
                  {/* HEADER */}
                  <View style={styles.participanteHeader}>
                    <Text style={styles.participanteTitle}>
                      Participante #{index + 1}
                    </Text>

                    {!esVisualizacion && (
                      <TouchableOpacity
                        onPress={() => eliminarParticipante(index)}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={20}
                          color={COLORS.danger}
                        />
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* INPUTS */}
                  <TextInput
                    placeholder="No. Cédula"
                    value={p.cedula}
                    onChangeText={(t) =>
                      cambiarParticipante(index, "cedula", t)
                    }
                    style={styles.input2}
                  />

                  <TextInput
                    placeholder="Nombres y Apellidos"
                    value={p.nombre}
                    onChangeText={(t) =>
                      cambiarParticipante(index, "nombre", t)
                    }
                    style={styles.input2}
                  />

                  <TextInput
                    placeholder="Cargo"
                    value={p.cargo}
                    onChangeText={(t) => cambiarParticipante(index, "cargo", t)}
                    style={styles.input2}
                  />

                  <TextInput
                    placeholder="Proceso"
                    value={p.proceso}
                    onChangeText={(t) =>
                      cambiarParticipante(index, "proceso", t)
                    }
                    style={styles.input2}
                  />

                  {/* FIRMA */}
                  <TouchableOpacity
                    style={[
                      styles.firmaButton2,
                      p.firma
                        ? styles.firmaButtonOk
                        : styles.firmaButtonPending,
                    ]}
                    onPress={() => abrirFirmaParticipante(index)}
                  >
                    <Ionicons
                      name={
                        p.firma ? "checkmark-circle-outline" : "create-outline"
                      }
                      size={20}
                      color={p.firma ? COLORS.success : COLORS.primary}
                    />
                    <Text style={styles.firmaButtonText}>
                      {p.firma ? "Firma guardada (Editar)" : "Agregar firma"}
                    </Text>
                  </TouchableOpacity>
                  {p.firma && (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>
      ✍️ Firma de {p.nombre}
    </Text>

    <View style={styles.firmaPreviewContainer}>
      <RenderFirmaSVG data={p.firma} />
    </View>
  </View>
)}

                  {/* SEPARADOR */}
                  <View style={styles.participanteDivider} />
                </View>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Orden del dia</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.orden_dia}
              onChangeText={(text) =>
                setFormData((prev) => ({
                  ...prev,
                  orden_dia: text,
                }))
              }
              placeholder="Orden del día"
              placeholderTextColor={COLORS.textSecondary}
              multiline
              numberOfLines={6}
              editable={puedeEditar}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Temas Tratados</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.temas}
              onChangeText={(text) =>
                setFormData((prev) => ({
                  ...prev,
                  temas: text,
                }))
              }
              placeholder="Temas tratados"
              placeholderTextColor={COLORS.textSecondary}
              multiline
              numberOfLines={6}
              editable={puedeEditar}
            />
          </View>

          <View style={styles.section}>
            {/* HEADER */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                📌 Acuerdos y/o Compromisos
              </Text>

              <TouchableOpacity
                style={styles.addButton}
                onPress={agregarAcuerdo}
              >
                <Ionicons name="add-outline" size={20} color="black" />
                <Text style={styles.addButtonText}>Agregar</Text>
              </TouchableOpacity>
            </View>

            {/* LISTA */}
            {formData.acuerdos.map((item, index) => (
              <View key={index} style={styles.rowBlock}>
                <View style={styles.rowHeader}>
                  <Text style={styles.rowTitle}>Acuerdo #{index + 1}</Text>

                  <TouchableOpacity onPress={() => eliminarAcuerdo(index)}>
                    <Ionicons
                      name="trash-outline"
                      size={20}
                      color={COLORS.danger}
                    />
                  </TouchableOpacity>
                </View>

                <TextInput
                  placeholder="Actividad / Compromiso"
                  value={item.actividad}
                  onChangeText={(t) => {
                    const copia = [...formData.acuerdos];
                    copia[index].actividad = t;
                    setFormData({ ...formData, acuerdos: copia });
                  }}
                  style={styles.input2}
                />

                <TextInput
                  placeholder="Responsable"
                  value={item.responsable}
                  onChangeText={(t) => {
                    const copia = [...formData.acuerdos];
                    copia[index].responsable = t;
                    setFormData({ ...formData, acuerdos: copia });
                  }}
                  style={styles.input2}
                />

                <TextInput
                  placeholder="Fecha prevista (YYYY-MM-DD)"
                  value={item.fecha_prevista}
                  onChangeText={(t) => {
                    const copia = [...formData.acuerdos];
                    copia[index].fecha_prevista = t;
                    setFormData({ ...formData, acuerdos: copia });
                  }}
                  style={styles.input2}
                />
              </View>
            ))}
          </View>

          <View style={styles.section}>
            {/* HEADER */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                📊 Seguimiento acuerdos mes anterior
              </Text>

              <TouchableOpacity
                style={styles.addButton}
                onPress={agregarSeguimiento}
              >
                <Ionicons name="add-outline" size={20} color="black" />
                <Text style={styles.addButtonText}>Agregar</Text>
              </TouchableOpacity>
            </View>

            {/* FILAS */}
            {formData.seguimientos_acuerdos.map((item, index) => (
              <View key={index} style={styles.rowBlock}>
                <View style={styles.rowHeader}>
                  <Text style={styles.rowTitle}>Seguimiento #{index + 1}</Text>

                  <TouchableOpacity onPress={() => eliminarSeguimiento(index)}>
                    <Ionicons
                      name="trash-outline"
                      size={20}
                      color={COLORS.danger}
                    />
                  </TouchableOpacity>
                </View>

                <TextInput
                  placeholder="Actividad"
                  value={item.actividad}
                  onChangeText={(t) => {
                    const copia = [...formData.seguimientos_acuerdos];
                    copia[index].actividad = t;
                    setFormData({ ...formData, seguimientos_acuerdos: copia });
                  }}
                  style={styles.input2}
                />

                <TextInput
                  placeholder="Responsable"
                  value={item.responsable}
                  onChangeText={(t) => {
                    const copia = [...formData.seguimientos_acuerdos];
                    copia[index].responsable = t;
                    setFormData({ ...formData, seguimientos_acuerdos: copia });
                  }}
                  style={styles.input2}
                />

                <TextInput
                  placeholder="Fecha prevista (YYYY-MM-DD)"
                  value={item.fecha_prevista}
                  onChangeText={(t) => {
                    const copia = [...formData.seguimientos_acuerdos];
                    copia[index].fecha_prevista = t;
                    setFormData({ ...formData, seguimientos_acuerdos: copia });
                  }}
                  style={styles.input2}
                />

                <TextInput
                  placeholder="Estado / Observación"
                  value={item.estado_observacion}
                  onChangeText={(t) => {
                    const copia = [...formData.seguimientos_acuerdos];
                    copia[index].estado_observacion = t;
                    setFormData({ ...formData, seguimientos_acuerdos: copia });
                  }}
                  style={[styles.input2, { minHeight: 60 }]}
                  multiline
                />
              </View>
            ))}
          </View>
             

               <View style={styles.section}>
                <Text style={styles.sectionTitle}>Responsables y Aprobación</Text>

           <View style={styles.inputGroup}>
              <Text style={styles.label}>Elaborado Por</Text>
              <TextInput
                style={styles.input}
                value={formData.elaborado}
                onChangeText={(text) =>
                  setFormData((prev) => ({ ...prev, elaborado: text }))
                }
                placeholder="Elaborado Por"
                placeholderTextColor={COLORS.textSecondary}
              />
            </View>


             <View style={styles.inputGroup}>
              <Text style={styles.label}>Aprobado Por</Text>
              <TextInput
                style={styles.input}
                value={formData.aprobado}
                onChangeText={(text) =>
                  setFormData((prev) => ({ ...prev, aprobado: text }))
                }
                placeholder="Aprobado Por"
                placeholderTextColor={COLORS.textSecondary}
              />
            </View>

             <View style={styles.inputGroup}>
              <Text style={styles.label}>Fecha Aprobacion</Text>
              <TextInput
                style={styles.input}
                value={formData.fecha_aprobacion}
                onChangeText={(text) =>
                  setFormData((prev) => ({ ...prev, fecha_aprobacion: text }))
                }
                placeholder="Fecha Aprobacion (YYYY-MM-DD)"
                placeholderTextColor={COLORS.textSecondary}
              />
            </View>
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
                      <Text style={styles.firmaInfoLabel}>
                        Fecha de firma:{" "}
                      </Text>
                      {new Date(formData.created_at).toLocaleDateString(
                        "es-CO",
                        {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        }
                      )}
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
                    pathname: "/acta-reunion",
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
              style={[
                styles.submitButton,
                saving && styles.submitButtonDisabled,
              ]}
              onPress={iniciarProcesoDeFirma}
              disabled={saving}
            >
              <Text style={styles.submitButtonText}>
                {saving ? "Guardando..." : "Firmar y Guardar Acta"}
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
              <Text style={styles.firmaTitle}>Firma</Text>
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
                <Ionicons
                  name="close-outline"
                  size={20}
                  color={COLORS.danger}
                />
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

        <Modal
          animationType="slide"
          transparent={false}
          visible={modalFirmaParticipanteVisible}
          onRequestClose={cancelarFirmaParticipante}
        >
          <SafeAreaView style={styles.firmaModalContainer}>
            <View style={styles.firmaHeader}>
              <Text style={styles.firmaTitle}>Firma del participante</Text>
              <Text style={styles.firmaSubtitle}>
                Por favor, firme en el área a continuación
              </Text>
            </View>

            <View style={styles.firmaCanvasContainer}>
              <SimpleSignaturePad
                ref={signatureParticipanteRef}
                height={400}
                strokeColor="#000000"
                strokeWidth={3}
              />
            </View>

            <View style={styles.firmaButtonsContainer}>
              <TouchableOpacity
                style={[styles.firmaButton, styles.firmaButtonSecondary]}
                onPress={limpiarFirmaParticipante}
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
                onPress={cancelarFirmaParticipante}
              >
                <Ionicons
                  name="close-outline"
                  size={20}
                  color={COLORS.danger}
                />
                <Text style={styles.firmaButtonTextDanger}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.firmaButton, styles.firmaButtonPrimary]}
                onPress={() => {
                  if (signatureParticipanteRef.current?.isEmpty()) {
                    Alert.alert(
                      "Firma vacía",
                      "Por favor, firme antes de confirmar"
                    );
                    return;
                  }

                  const signatureData =
                    signatureParticipanteRef.current?.toDataURL();

                  if (signatureData) {
                    guardarFirmaParticipante(signatureData);
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
    width: "90%",
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
    height: 150,
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
    width: "100%",
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
  participanteCard: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  firmaBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginTop: 12,
  },

  firmaPendiente: {
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.surface,
  },

  firmaOk: {
    borderWidth: 1,
    borderColor: COLORS.success,
    backgroundColor: "#ECFDF5",
  },

  firmaText: {
    fontSize: 14,
    fontWeight: "600",
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
    flexDirection: "row",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: 8,
  },

  tableHeaderText: {
    fontWeight: "700",
    color: COLORS.textSecondary,
    fontSize: 14,
  },

  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },

  trashIcon: {
    padding: 6,
  },

  participanteContainer: {
    marginBottom: 24,
  },

  participanteHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },

  participanteTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.primary,
  },

  input2: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 16, // 👈 más alto
    fontSize: 16,
    backgroundColor: COLORS.surface,
    marginBottom: 14, // 👈 separación entre inputs
  },

  firmaButton2: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 6,
  },

  firmaButtonPending: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.surface,
  },

  firmaButtonOk: {
    borderColor: COLORS.success,
    backgroundColor: "#ECFDF5",
  },

  firmaButtonText: {
    fontSize: 15,
    fontWeight: "600",
  },

  participanteDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginTop: 24,
  },

  rowBlock: {
    marginBottom: 16,
  },

  rowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },

  rowTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.primary,
  },
});
