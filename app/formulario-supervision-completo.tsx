/**
 * 📋 INFORME DE SUPERVISIÓN SIMPLIFICADO
 * Estructura idéntica al formulario de acta de inicio que funciona correctamente
 */

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
  ActivityIndicator,
  Image,
  Platform,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import axios from "axios";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "./_layout";
import {
  subirFotoEvidencia,
  eliminarFotoEvidencia,
} from "../services/evidenciasService";
import SimpleSignaturePad from "../components/SimpleSignaturePad";
import { getSecureItem } from "../utils/secureStorage";
import { useLocation } from "@/contexts/LocationContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Sharing from "expo-sharing";
import * as Print from "expo-print";
import { SvgXml } from "react-native-svg";

const API_BASE = "https://operaciones.lavianda.com.co/api";

const COLORS = {
  primary: "#1E3A8A",
  secondary: "#3B82F6",
  success: "#10B981",
  warning: "#F59E0B",
  danger: "#EF4444",
  background: "#F8FAFC",
  surface: "#FFFFFF",
  textPrimary: "#1F2937",
  textSecondary: "#6B7280",
  border: "#E5E7EB",
};

// Áreas de inspección (igual estructura que acta de inicio)
const AREAS_SECCIONES = {
  AUXILIARES_TRABAJADOR: [
    "Presentación personal en general",
    "Uniforme en buen estado",
    "Calzado en buen estado",
    "Conocimiento del Sistema de Gestión Integrado",
    "Carnet visible de identificación",
    "Iniciativa y compromiso",
    "Puntualidad y cumplimiento",
    "Relaciones interpersonales",
    "Uso, almacenamiento y cuidado de EPP",
  ],

  CALIDAD_SERVICIO: [
    "Limpieza de pisos",
    "Limpieza de alfombras",
    "Limpieza de escaleras",
    "Limpieza y desinfección de baños",
    "Limpieza de cafetería",
    "Limpieza de áreas perimetrales",
    "Limpieza de equipos de oficina",
    "Limpieza de muebles y enseres",
    "Limpieza de parqueadero",
    "Limpieza de sótano",
    "Limpieza shut o depósitos de basuras",
    "Limpieza cuarto de almacenamiento de insumos",
    "Plantas ornamentales",
    "Limpieza de lámparas",
    "Limpieza de rincones",
    "Limpieza de vidrios",
    "Limpieza de fachadas",
    "Uso adecuado de avisos preventivos",
    "Cumple con el cronograma de trabajo",
    "Otros",
  ],

  INSUMOS_ASEO: [
    "Almacenamiento y control de insumos",
    "Estado de limpieza y orden del área de trabajo",
    "Implementos de aseo limpios y en buen estado",
    "Fichas técnicas y hojas de seguridad disponibles",
  ],
};

const INSPECCION_MAQUINARIA_DESCRIPCIONES = [
  "Mantenimiento de maquinaria, herramientas y equipos",
  "Limpieza y almacenamiento de maquinaria, herramientas y equipos",
];

interface InspeccionMaquinariaItem {
  descripcion: string;
  cumple: boolean | null; // true = cumple, false = no cumple, null = N/A
}

interface TipoCobro {
  tipo: string;
  cobrable: string;
  noCobrable: string;
}

interface PlanAccionItem {
  acto_condicion: string;
  accion_tomada: string;
  responsable: string;
  fecha_programada: string;
  fecha_ejecucion: string;
}

export interface AreaData {
  cumple: boolean | null;
  observaciones: string;
  fotos: string[];
}

export interface InventarioItem {
  item: string;
  marca: string;
  cantidad: string;
  cumple: boolean | null;
}

interface FormData {
  cliente: string;
  direccion: string;
  ciudad: string;
  trabajadores: string;
  horario_laboral: string;
  otros_horarios: string;
  supervisor: string;
  fecha: string;
  areas: Record<string, AreaData>;
  inventario: InventarioItem[];
  inspeccion_maquinaria: InspeccionMaquinariaItem[];
  plan_accion: PlanAccionItem[];
  observaciones_generales: string;
  firma_supervisor: string;
  tipo_cobro: TipoCobro[];
}

export default function FormularioSupervisionSimple() {
  const router = useRouter();

  const { user } = useAuth() as { user: any | null };
  const params = useLocalSearchParams();
  const signatureRef = useRef<any>(null);
  const { startTracking } = useLocation();
  const insets = useSafeAreaInsets();
  const TODAS_LAS_AREAS = Object.values(AREAS_SECCIONES).flat();
  const [firmaBase64, setFirmaBase64] = useState<string>("");
  const modo = (params?.modo as string) || "crear";
  const formularioId = params?.formularioId as string;
  const esVisualizacion = modo === "ver";
  const esModoCrear = modo === "crear";
  const esModoEditar = modo === "editar";
  const puedeEditar = esModoCrear || esModoEditar;
  const [saving, setSaving] = useState(false);

  const [modalFirmaVisible, setModalFirmaVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  

  const [formData, setFormData] = useState<FormData>({
    cliente: Array.isArray(params.empresaNombre)
      ? params.empresaNombre[0]
      : params.empresaNombre || "",
    direccion: "",
    ciudad: "",
    trabajadores: "",
    horario_laboral: "",
    otros_horarios: "",
    supervisor: user?.name || "",
    fecha: new Date().toISOString().split("T")[0],

    areas: TODAS_LAS_AREAS.reduce(
      (acc, area) => ({
        ...acc,
        [area]: {
          cumple: null,
          observaciones: "",
          fotos: [],
        },
      }),
      {} as Record<string, AreaData>
    ),

    inventario: [
      {
        item: "",
        marca: "",
        cantidad: "",
        cumple: null,
      },
    ],

    tipo_cobro: [
      {
        tipo: "",
        cobrable: "",
        noCobrable: "",
      },
    ],

    inspeccion_maquinaria: [
      {
        descripcion: "Mantenimiento de maquinaria, herramientas y equipos",
        cumple: null,
      },
      {
        descripcion:
          "Limpieza y almacenamiento de maquinaria, herramientas y equipos",
        cumple: null,
      },
    ],

    plan_accion: [
      {
        acto_condicion: "",
        accion_tomada: "",
        responsable: "",
        fecha_programada: "",
        fecha_ejecucion: "",
      },
    ],

    observaciones_generales: "",
    firma_supervisor: "",
  });

  // Función para cambiar áreas (igual que handleAreaChange en acta)
  const handleAreaChange = (
    area: string,
    field: "cumple" | "observaciones",
    value: boolean | string | null
  ) => {
    setFormData((prev) => ({
      ...prev,
      areas: {
        ...prev.areas,
        [area]: {
          ...prev.areas[area],
          [field]: value,
        },
      },
    }));
  };

  const limpiarFirma = () => {
    //console.log('🧹 Limpiando firma...');
    signatureRef.current?.clear();
  };

  // Función para cancelar la firma
  const cancelarFirma = () => {
    //console.log('❌ Cancelando proceso de firma');
    setModalFirmaVisible(false);
  };

  // Función para manejar fotos
  const agregarFoto = async (area: string) => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permisos", "Se necesitan permisos de cámara");
        return;
      }

      Alert.alert("Agregar Foto", "Selecciona una opción", [
        { text: "Tomar foto", onPress: () => tomarFoto(area) },
        { text: "Cancelar", style: "cancel" },
      ]);
    } catch (error) {
      console.error("Error agregando foto:", error);
    }
  };

  const tomarFoto = async (area: string) => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.7,
      });

      if (!result.canceled && result.assets[0]) {
        await procesarFoto(area, result.assets[0].uri);
      }
    } catch (error) {
      console.error("Error tomando foto:", error);
    }
  };

  const procesarFoto = async (area: string, uri: string) => {
    try {
      setLoading(true);

      const token = user.token;
      //console.log('Token obtenido para subir foto:', token);

      if (!token) {
        Alert.alert("Error", "No se encontró token de autenticación");
        return;
      }

      const resultado = await subirFotoEvidencia(uri, user.token);
      const urlFoto =
        typeof resultado === "string"
          ? resultado
          : resultado.url || resultado.ruta || "";

      if (!urlFoto) {
        Alert.alert("Error", "No se pudo obtener la URL de la foto");
        return;
      }

      setFormData((prev) => ({
        ...prev,
        areas: {
          ...prev.areas,
          [area]: {
            ...prev.areas[area],
            fotos: [...(prev.areas[area].fotos || []), urlFoto],
          },
        },
      }));

      Alert.alert("Éxito", "Foto agregada correctamente");
    } catch (error) {
      console.error("Error procesando foto:", error);
      Alert.alert("Error", "No se pudo subir la foto");
    } finally {
      setLoading(false);
    }
  };

  const eliminarFoto = async (area: string, url: string) => {
    try {
      const fileName = url.split("/").pop() || "";
      await eliminarFotoEvidencia(fileName, url);

      setFormData((prev) => ({
        ...prev,
        areas: {
          ...prev.areas,
          [area]: {
            ...prev.areas[area],
            fotos: prev.areas[area].fotos.filter((f) => f !== url),
          },
        },
      }));

      Alert.alert("Éxito", "Foto eliminada");
    } catch (error) {
      console.error("Error eliminando foto:", error);
      Alert.alert("Error", "No se pudo eliminar la foto");
    }
  };

  // Manejo de inventario
  const agregarItemInventario = () => {
    setFormData((prev) => ({
      ...prev,
      inventario: [
        ...prev.inventario,
        {
          item: "",
          marca: "",
          cantidad: "",
          cumple: null, // 👈 por defecto NO APLICA
        },
      ],
    }));
  };

  const actualizarInventario = (
    index: number,
    field: "item" | "marca" | "cantidad" | "cumple",
    value: string | boolean | null
  ) => {
    setFormData((prev) => {
      const nuevoInventario = [...prev.inventario];

      nuevoInventario[index] = {
        ...nuevoInventario[index],
        [field]: value,
      };

      return {
        ...prev,
        inventario: nuevoInventario,
      };
    });
  };

  const eliminarItemInventario = (index: number) => {
    if (formData.inventario.length <= 1) return;

    setFormData((prev) => ({
      ...prev,
      inventario: prev.inventario.filter((_, i) => i !== index),
    }));
  };

  const agregarPlanAccion = () => {
    setFormData({
      ...formData,
      plan_accion: [
        ...formData.plan_accion,
        {
          acto_condicion: "",
          accion_tomada: "",
          responsable: "",
          fecha_programada: "",
          fecha_ejecucion: "",
        },
      ],
    });
  };

  const eliminarPlanAccion = (index: number) => {
    const copia = [...formData.plan_accion];
    copia.splice(index, 1);
    setFormData({ ...formData, plan_accion: copia });
  };

  const actualizarPlanAccion = (
    index: number,
    campo: keyof PlanAccionItem,
    valor: string
  ) => {
    const copia = [...formData.plan_accion];
    copia[index][campo] = valor;
    setFormData({ ...formData, plan_accion: copia });
  };

  const mapCheckboxToEnum = (
    value: boolean | null
  ): "cumple" | "no_cumple" | "no_aplica" | null => {
    if (value === true) return "cumple";
    if (value === false) return "no_cumple";
    if (value === null) return "no_aplica";
    return null;
  };

  const obtenerDatosEmpresa = async (registroId: string) => {
    try {
      setFormData((prev) => ({
        ...prev,
        empresa: params.empresa as string,
        nit_cedula: (params.nit as string) || "",
        ciudad: (params.ciudad as string) || "",
      }));

      return;
    } catch (error) {}
  };

  const mapEnumToCheckbox = (
    value: "cumple" | "no_cumple" | "no_aplica" | null
  ): boolean | null => {
    if (value === "cumple") return true;
    if (value === "no_cumple") return false;
    return null;
  };

  const parseJsonSafe = (value: any) => {
  if (!value) return [];

  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;

    // caso doble JSON: "\"[{...}]\""
    if (typeof parsed === "string") {
      return JSON.parse(parsed);
    }

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};


 const cargarFormularioExistente = async (formularioId: string) => {
  try {
    let token = user?.token;
    if (!token) {
      const storageToken = await AsyncStorage.getItem("authToken");
      token = storageToken || undefined;
    }

    if (!token) {
      Alert.alert("Error", "No se encontró token");
      return;
    }

    const response = await axios.get(
      `${API_BASE}/formularios/inspeccion/${formularioId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      }
    );

    const formulario = response.data?.inspeccion;
    if (!formulario) {
      Alert.alert("Error", "Formulario no encontrado");
      return;
    }

    /* -------------------------------------------------
       PARSEO SEGURO DESDE BD 🔥
    ------------------------------------------------- */
    const areasFromDB = parseJsonSafe(formulario.areas_inspeccionadas);
    const inventarioFromDB = parseJsonSafe(formulario.inventario);
    const tipoCobroFromDB = parseJsonSafe(formulario.tabla_costos);
    const inventarioMaquinariaFromDB = parseJsonSafe(formulario.inventario_maquinaria);
    const planAccionFromDB = parseJsonSafe(formulario.plan_accion);

    /* -------------------------------------------------
       MAPEAR ÁREAS (Record)
    ------------------------------------------------- */
    const areasMapped: Record<string, any> = {};

    areasFromDB.forEach((a: any) => {
      areasMapped[a.area] = {
        cumple: mapEnumToCheckbox(a.cumple),
        observaciones: a.observaciones || "",
        fotos: Array.isArray(a.fotos) ? a.fotos : [],
      };
    });

    /* -------------------------------------------------
       MAPEAR INVENTARIO ✅ (ARRAY)
    ------------------------------------------------- */
    const inventarioMapped = inventarioFromDB.length
      ? inventarioFromDB.map((i: any) => ({
          item: i.item || "",
          marca: i.marca || "",
          cantidad: i.cantidad || "",
          cumple: mapEnumToCheckbox(i.cumple),
        }))
      : [
          {
            item: "",
            marca: "",
            cantidad: "",
            cumple: null,
          },
        ];

    /* -------------------------------------------------
       SET FORM DATA
    ------------------------------------------------- */
    setFormData({
      cliente: formulario.cliente ?? "",
      direccion: formulario.direccion ?? "",
      ciudad: formulario.ciudad ?? "",
      trabajadores: String(formulario.numero_trabajadores ?? ""),
      horario_laboral: formulario.horario_laboral ?? "",
      otros_horarios: formulario.otros_horarios ?? "",
      supervisor: formulario.nombre_supervisor ?? "",
      fecha: formulario.fecha_inspeccion
        ? formulario.fecha_inspeccion.split("T")[0]
        : new Date().toISOString().split("T")[0],

      areas: areasMapped,
      inventario: inventarioMapped,

      tipo_cobro: tipoCobroFromDB.length
        ? tipoCobroFromDB
        : [{ tipo: "", cobrable: "", noCobrable: "" }],

      inspeccion_maquinaria: inventarioMaquinariaFromDB.length
        ? inventarioMaquinariaFromDB.map((i: any) => ({
            descripcion: i.descripcion,
            cumple: mapEnumToCheckbox(i.cumple),
          }))
        : [
            {
              descripcion:
                "Mantenimiento de maquinaria, herramientas y equipos",
              cumple: null,
            },
            {
              descripcion:
                "Limpieza y almacenamiento de maquinaria, herramientas y equipos",
              cumple: null,
            },
          ],

      plan_accion: planAccionFromDB.length
        ? planAccionFromDB
        : [
            {
              acto_condicion: "",
              accion_tomada: "",
              responsable: "",
              fecha_programada: "",
              fecha_ejecucion: "",
            },
          ],

      observaciones_generales: formulario.observaciones_generales ?? "",
      firma_supervisor: formulario.firma_supervisor_base64 ?? "",
    });

    if (formulario.firma_supervisor_base64) {
      setFirmaBase64(formulario.firma_supervisor_base64);
    }
  } catch (error) {
    console.error("❌ Error cargando formulario:", error);
    Alert.alert("Error", "No se pudo cargar el formulario");
  }
};


  useEffect(() => {
    //console.log('🚀 Iniciando formulario con parámetros:', params);

    const modo = params?.modo as string;
    const formularioId = params?.formularioId as string;

    if ((modo === "ver" || modo === "editar") && formularioId) {
      // Modo ver/editar: cargar formulario existente
      //console.log(`👁️ Modo ${modo.toUpperCase()} - Cargando formulario existente`);
      cargarFormularioExistente(formularioId);
    } else {
      // Modo crear: configurar nuevo formulario
      //console.log('➕ Modo CREAR - Configurando nuevo formulario');

      // Cargar datos si viene de un registro específico
      if (params.registroId) {
        //console.log('🔍 Intentando obtener NIT y más datos del registro:', params.registroId);
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

  const enumToText = (value: boolean | null) => {
    if (value === true) return "Cumple";
    if (value === false) return "No cumple";
    return "No aplica";
  };

  const exportarPDF = async () => {
    if (!formData.cliente) {
      Alert.alert("Error", "No hay datos para exportar");
      return;
    }

    try {
      /* -------------------------------------------------
       AREAS INSPECCIONADAS
    ------------------------------------------------- */
      const areasHTML = Object.keys(formData.areas)
        .map(
          (area) => `
      <tr>
        <td>${area}</td>
        <td>${enumToText(formData.areas[area].cumple)}</td>
        <td>${formData.areas[area].observaciones || "-"}</td>
      </tr>
    `
        )
        .join("");

      /* -------------------------------------------------
       INVENTARIO
    ------------------------------------------------- */
      const inventarioHTML = formData.inventario.length
        ? `
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Marca</th>
            <th>Cantidad</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          ${formData.inventario
            .map(
              (i) => `
            <tr>
              <td>${i.item}</td>
              <td>${i.marca}</td>
              <td>${i.cantidad}</td>
              <td>${enumToText(i.cumple)}</td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
    `
        : `<div class="value">Sin inventario</div>`;

      /* -------------------------------------------------
       PLAN DE ACCIÓN
    ------------------------------------------------- */
      const planAccionHTML = formData.plan_accion.length
        ? `
      <table>
        <thead>
          <tr>
            <th>Acto / Condición</th>
            <th>Acción</th>
            <th>Responsable</th>
            <th>Fecha Programada</th>
            <th>Fecha Ejecución</th>
          </tr>
        </thead>
        <tbody>
          ${formData.plan_accion
            .map(
              (p) => `
            <tr>
              <td>${p.acto_condicion}</td>
              <td>${p.accion_tomada}</td>
              <td>${p.responsable}</td>
              <td>${p.fecha_programada}</td>
              <td>${p.fecha_ejecucion}</td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
    `
        : `<div class="value">Sin plan de acción</div>`;

      /* -------------------------------------------------
       FOTOS
    ------------------------------------------------- */
      const fotosHTML = Object.values(formData.areas)
        .flatMap((a) => a.fotos || [])
        .map(
          (foto) => `
        <img src="${foto}" style="max-width:200px;margin:6px;border:1px solid #ccc;" />
      `
        )
        .join("");

      /* -------------------------------------------------
       HTML FINAL
    ------------------------------------------------- */
      const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Helvetica; font-size: 13px; margin: 30px; }
        h2 { color: #680000; border-bottom: 2px solid #680000; }
        table { width:100%; border-collapse:collapse; margin-top:10px; }
        th, td { border:1px solid #ccc; padding:6px; }
        th { background:#f2f2f2; }
        .value { background:#f7f7f7; padding:6px; margin-bottom:6px; }
      </style>
    </head>
    <body>

      <h2>📋 Informe de Supervisión</h2>

      <div class="value"><b>Cliente:</b> ${formData.cliente}</div>
      <div class="value"><b>Dirección:</b> ${formData.direccion}</div>
      <div class="value"><b>Ciudad:</b> ${formData.ciudad}</div>
      <div class="value"><b>Supervisor:</b> ${formData.supervisor}</div>
      <div class="value"><b>Fecha:</b> ${formData.fecha}</div>
      <div class="value"><b>N° Trabajadores:</b> ${formData.trabajadores}</div>

      <h2>✅ Áreas Inspeccionadas</h2>
      <table>
        <thead>
          <tr>
            <th>Área</th>
            <th>Resultado</th>
            <th>Observaciones</th>
          </tr>
        </thead>
        <tbody>
          ${areasHTML}
        </tbody>
      </table>

      <h2>📦 Inventario</h2>
      ${inventarioHTML}

      <h2>🛠 Plan de Acción</h2>
      ${planAccionHTML}

      ${fotosHTML ? `<h2>📸 Evidencias Fotográficas</h2>${fotosHTML}` : ""}

      ${
        formData.firma_supervisor
          ? `
          <h2>✍ Firma Supervisor</h2>
          <img src="${formData.firma_supervisor}" style="max-width:280px;border:1px solid #ccc;padding:8px;" />
        `
          : ""
      }

    </body>
    </html>
    `;

      const { uri } = await Print.printToFileAsync({ html });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: "application/pdf" });
      } else {
        Alert.alert("PDF generado", uri);
      }
    } catch (error) {
      console.error("❌ Error PDF:", error);
      Alert.alert("Error", "No se pudo generar el PDF");
    }
  };
  const guardarFirma = (signature: string) => {
    //console.log('✍️ Firma capturada');

    setFirmaBase64(signature);
    setModalFirmaVisible(false);

    // 👉 enviar formulario de supervisión
    enviarFormularioSupervision(signature);
  };

  const enviarFormularioSupervision = async (signatureData: string) => {
    setSaving(true);

    try {
      /* -------------------------------------------------
       TOKEN
    ------------------------------------------------- */
      let token = user?.token;
      if (!token) {
        const storageToken = await AsyncStorage.getItem("authToken");
        token = storageToken || undefined;
      }

      if (!token) {
        Alert.alert("Error", "Token inválido");
        router.replace("/login");
        return;
      }

      /* -------------------------------------------------
       VALIDACIONES
    ------------------------------------------------- */
      if (!formData.cliente.trim()) {
        Alert.alert("Error", "Cliente obligatorio");
        return;
      }

      if (!formData.direccion.trim()) {
        Alert.alert("Error", "Dirección obligatoria");
        return;
      }

      if (!formData.ciudad.trim()) {
        Alert.alert("Error", "Ciudad obligatoria");
        return;
      }

      if (!formData.supervisor.trim()) {
        Alert.alert("Error", "Supervisor obligatorio");
        return;
      }

      // 👉 Firma SOLO obligatoria si es nuevo
      if (modo !== "editar" && !signatureData) {
        Alert.alert("Error", "Debe firmar el formulario");
        return;
      }

      /* -------------------------------------------------
       AREAS INSPECCIONADAS
    ------------------------------------------------- */
      const areasInspeccionadas = Object.keys(formData.areas).map((area) => ({
        area,
        cumple: mapCheckboxToEnum(formData.areas[area].cumple),
        observaciones: formData.areas[area].observaciones || "",
        fotos: formData.areas[area].fotos || [],
      }));

      const inventarioItems = Object.keys(formData.inventario).map((key:any) => ({
       key,
        item: formData.inventario[key].item || "",
        marca: formData.inventario[key].marca || "",
        cantidad: formData.inventario[key].cantidad || "",
        cumple: mapCheckboxToEnum(formData.inventario[key].cumple),
      }));

      /* -------------------------------------------------
       INSPECCIÓN MAQUINARIA
    ------------------------------------------------- */
      const inventarioMaquinaria = formData.inspeccion_maquinaria.map(
        (item) => ({
          descripcion: item.descripcion,
          cumple: mapCheckboxToEnum(item.cumple),
        })
      );

      /* -------------------------------------------------
       PAYLOAD
    ------------------------------------------------- */
      const payload: any = {
        registro_id: params.registroId,

        cliente: formData.cliente,
        direccion: formData.direccion,
        ciudad: formData.ciudad,
        supervisor: formData.supervisor,
        numero_trabajadores: Number(formData.trabajadores),
        horario_laboral: formData.horario_laboral,
        otros_horarios: formData.otros_horarios,
        fecha_supervision: formData.fecha,

        areas_inspeccionadas: areasInspeccionadas,
        inventario: inventarioItems,
        tabla_costos: formData.tipo_cobro.filter(
          (t) => t.tipo.trim() || t.cobrable || t.noCobrable
        ),
        inventario_maquinaria: inventarioMaquinaria,
        plan_accion: formData.plan_accion.filter((p) =>
          p.acto_condicion.trim()
        ),

        observaciones_generales: formData.observaciones_generales || "",
      };

      // 👉 Firma solo si viene
      if (signatureData) {
        payload.firma_supervisor = signatureData;
      }

      console.log('📤 Payload Supervisión:', payload);

      /* -------------------------------------------------
       TRACKING
    ------------------------------------------------- */
      await startTracking(token, "Informe_de_Supervisión");
     //await startBackgroundTracking(token, `form_${Date.now()}`);

      /* -------------------------------------------------
       POST / PUT
    ------------------------------------------------- */
      if (modo === "editar" && formularioId) {
        // ✏️ EDITAR
        await axios.put(
          `${API_BASE}/formularios/supervision/${formularioId}`,
          payload,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );
      } else {
        // 🆕 CREAR
        await axios.post(`${API_BASE}/formularios/supervision`, payload, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });
      }

      Alert.alert(
        "Éxito",
        modo === "editar"
          ? "Informe de supervisión actualizado correctamente"
          : "Informe de supervisión creado correctamente",
        [{ text: "OK", onPress: () => router.back() }]
      );
    } catch (error) {
      console.error("❌ Error supervisión:", error);
      Alert.alert("Error", "No se pudo guardar el informe");
    } finally {
      setSaving(false);
    }
  };

  const iniciarProcesoDeFirma = () => {
    setModalFirmaVisible(true);
  };

  return (
    <SafeAreaView
      style={[
        styles.container,
        {
          paddingTop: Platform.OS === "android" ? insets.top + 10 : insets.top,
          paddingBottom: insets.bottom,
        },
      ]}
    >
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.surface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>INFORME DE SUPERVISIÓN</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* DATOS GENERALES */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📋 Datos Generales</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Cliente / Empresa *</Text>
            <TextInput
              style={styles.input}
              value={formData.cliente}
              onChangeText={(text) =>
                setFormData((prev) => ({ ...prev, cliente: text }))
              }
              placeholder="Nombre del cliente"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Dirección *</Text>
            <TextInput
              style={styles.input}
              value={formData.direccion}
              onChangeText={(text) =>
                setFormData((prev) => ({ ...prev, direccion: text }))
              }
              placeholder="Dirección del servicio"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Ciudad *</Text>
            <TextInput
              style={styles.input}
              value={formData.ciudad}
              onChangeText={(text) =>
                setFormData((prev) => ({ ...prev, ciudad: text }))
              }
              placeholder="Ciudad"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Supervisor *</Text>
            <TextInput
              style={styles.input}
              value={formData.supervisor}
              onChangeText={(text) =>
                setFormData((prev) => ({ ...prev, supervisor: text }))
              }
              placeholder="Nombre del supervisor"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Numero de Trabajadores *</Text>
            <TextInput
              style={styles.input}
              value={formData.trabajadores}
              onChangeText={(text) =>
                setFormData((prev) => ({ ...prev, trabajadores: text }))
              }
              placeholder="Número de trabajadores"
              keyboardType="number-pad"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Horario Laboral *</Text>
            <TextInput
              style={styles.input}
              value={formData.horario_laboral}
              onChangeText={(text) =>
                setFormData((prev) => ({ ...prev, horario_laboral: text }))
              }
              placeholder="Horario laboral"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Otros Horarios *</Text>
            <TextInput
              style={styles.input}
              value={formData.otros_horarios}
              onChangeText={(text) =>
                setFormData((prev) => ({ ...prev, otros_horarios: text }))
              }
              placeholder="Otros horarios"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Fecha de Supervisión *</Text>
            <TextInput
              style={styles.input}
              value={formData.fecha}
              onChangeText={(text) =>
                setFormData((prev) => ({ ...prev, fecha: text }))
              }
              placeholder="YYYY-MM-DD"
            />
          </View>
        </View>

        {/* ÁREAS DE INSPECCIÓN */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>✅ Áreas de Inspección</Text>

          {Object.entries(AREAS_SECCIONES).map(([seccion, areas]) => (
            <View key={seccion} style={styles.sectionBlock}>
              {/* TÍTULO DE SECCIÓN */}
              <Text style={styles.sectionTitle}>
                {seccion === "AUXILIARES_TRABAJADOR" &&
                  "INSPECCIÓN AUXILIARES AL TRABAJADOR"}
                {seccion === "CALIDAD_SERVICIO" &&
                  "INSPECCIÓN A LA CALIDAD DEL SERVICIO"}
                {seccion === "INSUMOS_ASEO" &&
                  "INSUMOS DE ASEO, CAFETERÍA Y ALMACENAMIENTO"}
              </Text>

              {areas.map((area) => (
                <View key={area} style={styles.areaCard}>
                  {/* TÍTULO DEL ÁREA */}
                  <Text style={styles.areaTitle}>{area}</Text>

                  {/* CHECKBOX */}
                  <View style={styles.checkboxRow}>
                    <TouchableOpacity
                      style={styles.checkboxOption}
                      onPress={() => handleAreaChange(area, "cumple", true)}
                    >
                      <Ionicons
                        name={
                          formData.areas[area]?.cumple === true
                            ? "checkbox"
                            : "square-outline"
                        }
                        size={22}
                        color={COLORS.success}
                      />
                      <Text style={styles.checkboxLabel}>Sí</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.checkboxOption}
                      onPress={() => handleAreaChange(area, "cumple", false)}
                    >
                      <Ionicons
                        name={
                          formData.areas[area]?.cumple === false
                            ? "checkbox"
                            : "square-outline"
                        }
                        size={22}
                        color={COLORS.danger}
                      />
                      <Text style={styles.checkboxLabel}>No</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.checkboxOption}
                      onPress={() => handleAreaChange(area, "cumple", null)}
                    >
                      <Ionicons
                        name={
                          formData.areas[area]?.cumple === null
                            ? "checkbox"
                            : "square-outline"
                        }
                        size={22}
                        color={COLORS.textSecondary}
                      />
                      <Text style={styles.checkboxLabel}>No aplica</Text>
                    </TouchableOpacity>
                  </View>

                  {/* OBSERVACIONES */}
                  <TextInput
                    style={styles.observacionesInput}
                    value={formData.areas[area]?.observaciones || ""}
                    onChangeText={(text) =>
                      handleAreaChange(area, "observaciones", text)
                    }
                    placeholder="Observaciones (opcional)"
                    multiline
                  />

                  {/* FOTO */}
                  <TouchableOpacity
                    style={styles.addPhotoButton}
                    onPress={() => agregarFoto(area)}
                  >
                    <Ionicons name="camera" size={20} color={COLORS.primary} />
                    <Text style={styles.addPhotoText}>Agregar Foto</Text>
                  </TouchableOpacity>

                  {formData.areas[area]?.fotos?.length > 0 && (
                    <View style={styles.photosContainer}>
                      {formData.areas[area].fotos.map((fotoUrl, idx) => (
                        <View key={idx} style={styles.photoItem}>
                          <Image
                            source={{ uri: fotoUrl }}
                            style={styles.photoThumbnail}
                          />

                          <TouchableOpacity
                            style={styles.deletePhotoButton}
                            onPress={() => eliminarFoto(area, fotoUrl)}
                          >
                            <Ionicons
                              name="close-circle"
                              size={20}
                              color={COLORS.danger}
                            />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              ))}
            </View>
          ))}
        </View>
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>TIPO DE COBRO</Text>

          {formData.tipo_cobro.map((fila, index) => (
            <View key={index} style={styles.inventarioCard}>
              {/* TIPO */}
              <TextInput
                style={styles.input}
                value={fila.tipo}
                onChangeText={(text) => {
                  const copy = [...formData.tipo_cobro];
                  copy[index].tipo = text;
                  setFormData({ ...formData, tipo_cobro: copy });
                }}
                placeholder="Tipo"
              />

              {/* COBRABLE */}
              <TextInput
                style={styles.input}
                value={fila.cobrable}
                onChangeText={(text) => {
                  const copy = [...formData.tipo_cobro];
                  copy[index].cobrable = text;
                  setFormData({ ...formData, tipo_cobro: copy });
                }}
                placeholder="Cobrable"
              />

              {/* NO COBRABLE */}
              <TextInput
                style={styles.input}
                value={fila.noCobrable}
                onChangeText={(text) => {
                  const copy = [...formData.tipo_cobro];
                  copy[index].noCobrable = text;
                  setFormData({ ...formData, tipo_cobro: copy });
                }}
                placeholder="No cobrable"
              />

              {/* ELIMINAR */}
              {formData.tipo_cobro.length > 1 && (
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => {
                    setFormData((prev) => ({
                      ...prev,
                      tipo_cobro: prev.tipo_cobro.filter((_, i) => i !== index),
                    }));
                  }}
                >
                  <Ionicons name="trash" size={20} color={COLORS.danger} />
                </TouchableOpacity>
              )}
            </View>
          ))}

          {/* AGREGAR */}
          <TouchableOpacity
            style={styles.addButton}
            onPress={() =>
              setFormData((prev) => ({
                ...prev,
                tipo_cobro: [
                  ...prev.tipo_cobro,
                  { tipo: "", cobrable: "", noCobrable: "" },
                ],
              }))
            }
          >
            <Ionicons name="add-circle" size={24} color={COLORS.primary} />
            <Text style={styles.addButtonText}>Agregar fila</Text>
          </TouchableOpacity>
        </View>
        {/* INVENTARIO */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>
            INSPECCIÓN MAQUINARIA, HERRAMIENTAS Y EQUIPOS
          </Text>

          {formData.inventario.map((item, index) => (
            <View key={index} style={styles.inventarioCard}>
              {/* ITEM */}
              <TextInput
                style={styles.input}
                value={item.item}
                onChangeText={(text) =>
                  actualizarInventario(index, "item", text)
                }
                placeholder="Equipo / Herramienta"
              />

              {/* MARCA */}
              <TextInput
                style={styles.input}
                value={item.marca}
                onChangeText={(text) =>
                  actualizarInventario(index, "marca", text)
                }
                placeholder="Marca"
              />

              {/* CANTIDAD */}
              <TextInput
                style={styles.input}
                value={item.cantidad}
                onChangeText={(text) =>
                  actualizarInventario(index, "cantidad", text)
                }
                placeholder="Cantidad"
                keyboardType="numeric"
              />

              {/* ESTADO */}
              <View style={styles.checkboxColumn}>
                <TouchableOpacity
                  style={styles.checkboxOption}
                  onPress={() => actualizarInventario(index, "cumple", true)}
                >
                  <Ionicons
                    name={item.cumple === true ? "checkbox" : "square-outline"}
                    size={22}
                    color={COLORS.success}
                  />
                  <Text style={styles.checkboxLabel}>Cumple</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.checkboxOption}
                  onPress={() => actualizarInventario(index, "cumple", false)}
                >
                  <Ionicons
                    name={item.cumple === false ? "checkbox" : "square-outline"}
                    size={22}
                    color={COLORS.danger}
                  />
                  <Text style={styles.checkboxLabel}>No cumple</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.checkboxOption}
                  onPress={() => actualizarInventario(index, "cumple", null)}
                >
                  <Ionicons
                    name={item.cumple === null ? "checkbox" : "square-outline"}
                    size={22}
                    color={COLORS.textSecondary}
                  />
                  <Text style={styles.checkboxLabel}>N/A</Text>
                </TouchableOpacity>
              </View>

              {/* ELIMINAR */}
              {formData.inventario.length > 1 && (
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => eliminarItemInventario(index)}
                >
                  <Ionicons name="trash" size={20} color={COLORS.danger} />
                </TouchableOpacity>
              )}
            </View>
          ))}

          <TouchableOpacity
            style={styles.addButton}
            onPress={agregarItemInventario}
          >
            <Ionicons name="add-circle" size={24} color={COLORS.primary} />
            <Text style={styles.addButtonText}>Agregar equipo</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionBlock}>
          {INSPECCION_MAQUINARIA_DESCRIPCIONES.map((descripcion) => (
            <View key={descripcion} style={styles.areaCard}>
              {/* DESCRIPCIÓN */}
              <Text style={styles.areaTitle}>{descripcion}</Text>

              {/* CHECKBOXES */}
              <View style={styles.checkboxRow}>
                <TouchableOpacity
                  style={styles.checkboxOption}
                  onPress={() => handleAreaChange(descripcion, "cumple", true)}
                >
                  <Ionicons
                    name={
                      formData.areas[descripcion]?.cumple === true
                        ? "checkbox"
                        : "square-outline"
                    }
                    size={22}
                    color={COLORS.success}
                  />
                  <Text style={styles.checkboxLabel}>Cumple</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.checkboxOption}
                  onPress={() => handleAreaChange(descripcion, "cumple", false)}
                >
                  <Ionicons
                    name={
                      formData.areas[descripcion]?.cumple === false
                        ? "checkbox"
                        : "square-outline"
                    }
                    size={22}
                    color={COLORS.danger}
                  />
                  <Text style={styles.checkboxLabel}>No cumple</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.checkboxOption}
                  onPress={() => handleAreaChange(descripcion, "cumple", null)}
                >
                  <Ionicons
                    name={
                      formData.areas[descripcion]?.cumple === null
                        ? "checkbox"
                        : "square-outline"
                    }
                    size={22}
                    color={COLORS.textSecondary}
                  />
                  <Text style={styles.checkboxLabel}>N/A</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>PLAN DE ACCIÓN</Text>

          {formData.plan_accion.map((item, index) => (
            <View key={index} style={styles.card}>
              <Text style={styles.label}>Acto y/o Condición</Text>
              <TextInput
                style={styles.input}
                value={item.acto_condicion}
                onChangeText={(t) =>
                  actualizarPlanAccion(index, "acto_condicion", t)
                }
                placeholder="Describa el acto o condición"
              />

              <Text style={styles.label}>Acción tomada</Text>
              <TextInput
                style={styles.input}
                value={item.accion_tomada}
                onChangeText={(t) =>
                  actualizarPlanAccion(index, "accion_tomada", t)
                }
                placeholder="Acción correctiva"
              />

              <Text style={styles.label}>Responsable</Text>
              <TextInput
                style={styles.input}
                value={item.responsable}
                onChangeText={(t) =>
                  actualizarPlanAccion(index, "responsable", t)
                }
                placeholder="Nombre del responsable"
              />

              <Text style={styles.label}>Fecha programada</Text>
              <TextInput
                style={styles.input}
                value={item.fecha_programada}
                onChangeText={(t) =>
                  actualizarPlanAccion(index, "fecha_programada", t)
                }
                placeholder="YYYY-MM-DD"
              />

              <Text style={styles.label}>Fecha ejecución</Text>
              <TextInput
                style={styles.input}
                value={item.fecha_ejecucion}
                onChangeText={(t) =>
                  actualizarPlanAccion(index, "fecha_ejecucion", t)
                }
                placeholder="YYYY-MM-DD"
              />

              {/* ELIMINAR */}
              {formData.plan_accion.length > 1 && (
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => eliminarPlanAccion(index)}
                >
                  <Ionicons name="trash" size={20} color={COLORS.danger} />
                  <Text style={styles.deleteText}>Eliminar</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}

          {/* AGREGAR */}
          <TouchableOpacity
            style={styles.addButton}
            onPress={agregarPlanAccion}
          >
            <Ionicons name="add-circle" size={24} color={COLORS.primary} />
            <Text style={styles.addButtonText}>Agregar acción</Text>
          </TouchableOpacity>
        </View>

        {/* OBSERVACIONES GENERALES */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📝 Observaciones Generales</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={formData.observaciones_generales}
            onChangeText={(text) =>
              setFormData((prev) => ({
                ...prev,
                observaciones_generales: text,
              }))
            }
            placeholder="Observaciones generales del informe..."
            placeholderTextColor={COLORS.textSecondary}
            multiline
            numberOfLines={4}
          />
        </View>

        <View style={{ height: 40 }} />

        {(formData.firma_supervisor || firmaBase64) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>✍️ Firma Digital</Text>

            <View style={styles.firmaPreviewContainer}>
              {(() => {
                const data = formData.firma_supervisor || firmaBase64;
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
            </View>
          </View>
        )}

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
                  pathname: "/formulario-supervision-completo",
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
              {saving ? "Guardando..." : "Firmar y Guardar Acta"}
            </Text>
          </TouchableOpacity>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

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

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
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
    marginTop: 10,
    alignItems: "center",
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
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 24,
  },
  card: {
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    elevation: 2,
  },
  checkboxColumn: {
    marginTop: 6,
  },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
  },
  deleteText: {
    color: COLORS.danger,
    marginLeft: 6,
  },
  sectionBlock: {
    marginBottom: 28,
    paddingVertical: 12,
    paddingHorizontal: 10,
    backgroundColor: "#F8FAFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E3ECFF",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.primary,
    padding: 16,
    paddingTop: Platform.OS === "ios" ? 50 : 16,
  },
  backButton: {
    padding: 8,
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

  firmaPreview: {
    width: "100%",
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
    fontWeight: "600",
    color: COLORS.textPrimary,
  },

  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.surface,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.primary,
    marginBottom: 16,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    backgroundColor: COLORS.surface,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  areaCard: {
    backgroundColor: COLORS.background,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  inventarioCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E3ECFF",
    gap: 12,
  },

  inventarioRow: {
    flexDirection: "row",
    marginBottom: 10,
  },

  areaHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  areaTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.textPrimary,
    flex: 1,
  },
  toggleButton: {
    backgroundColor: COLORS.danger,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 60,
    alignItems: "center",
  },
  toggleButtonActive: {
    backgroundColor: COLORS.success,
  },
  toggleButtonText: {
    color: COLORS.surface,
    fontWeight: "bold",
    fontSize: 14,
  },
  toggleButtonTextActive: {
    color: COLORS.surface,
  },
  observacionesInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    backgroundColor: COLORS.surface,
    minHeight: 60,
    textAlignVertical: "top",
    marginBottom: 8,
  },
  addPhotoButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
  },
  addPhotoText: {
    color: COLORS.primary,
    fontWeight: "600",
    marginLeft: 8,
  },
  photosContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 12,
    gap: 8,
  },
  photoItem: {
    position: "relative",
  },
  photoThumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  deletePhotoButton: {
    position: "absolute",
    top: -8,
    right: -8,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
  },
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

  inventarioItem: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: COLORS.background,
    borderRadius: 8,
  },

  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surface,
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderStyle: "dashed",
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  addButtonText: {
    color: COLORS.primary,
    fontWeight: "600",
    marginLeft: 8,
  },
  signatureContainer: {
    borderWidth: 2,
    borderColor: COLORS.border,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: COLORS.surface,
  },
  submitButton: {
    backgroundColor: COLORS.success,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 12,
    marginTop: 24,
  },
  submitButtonDisabled: {
    backgroundColor: COLORS.textSecondary,
  },
  submitButtonText: {
    color: COLORS.surface,
    fontSize: 16,
    fontWeight: "bold",
    marginLeft: 8,
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 12,
  },

  checkboxOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  checkboxLabel: {
    fontSize: 14,
    color: COLORS.textPrimary,
  },
});
