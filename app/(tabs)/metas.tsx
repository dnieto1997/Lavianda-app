import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  SafeAreaView, Platform
} from "react-native";
import axios from "axios";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../_layout";
import { useSafeAreaInsets } from "react-native-safe-area-context";



const API_URL = "https://operaciones.lavianda.com.co/api";

const MESES = [
  { key: "01", label: "Enero" },
  { key: "02", label: "Febrero" },
  { key: "03", label: "Marzo" },
  { key: "04", label: "Abril" },
  { key: "05", label: "Mayo" },
  { key: "06", label: "Junio" },
  { key: "07", label: "Julio" },
  { key: "08", label: "Agosto" },
  { key: "09", label: "Septiembre" },
  { key: "10", label: "Octubre" },
  { key: "11", label: "Noviembre" },
  { key: "12", label: "Diciembre" },
];

export default function MetasScreen() {
  const { user } = useAuth();
  const authUser: any = user;
const insets = useSafeAreaInsets();
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalVisible, setModalVisible] = useState(false);
  const [empleado, setEmpleado] = useState<any>(null);
  const [empresa, setEmpresa] = useState<any>(null);

  const [anio, setAnio] = useState(new Date().getFullYear().toString());
  const [metas, setMetas] = useState<any[]>([]);
  const [nextMesIndex, setNextMesIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [empresaSearch, setEmpresaSearch] = useState("");

  useEffect(() => {
    cargarEmpleados();
  }, []);

  const cargarEmpleados = async () => {
    try {
      const res = await axios.get(`${API_URL}/user/empleados`, {
        headers: { Authorization: `Bearer ${authUser?.token}` },
      });
      setEmpleados(res.data.empleados || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const getNombreMes = (mes: string | number) => {
  const mesNormalizado = String(mes).padStart(2, "0"); // 🔥 CLAVE
  const found = MESES.find((m) => m.key === mesNormalizado);
  return found ? found.label : mesNormalizado;
};

  const cargarMetas = async (userId: number, empresaId: number) => {
    try {
      const res = await axios.get(
        `${API_URL}/metas/${userId}/${empresaId}?anio=${anio}`,{
        headers: { Authorization: `Bearer ${authUser?.token}` },
      }
      );

      const data = (res.data.metas || []).map((m: any) => ({
  ...m,
   mes: String(m.mes).padStart(2, "0"), // 🔥 normalizado
  nombre: getNombreMes(m.mes),    // 🔴 se inyecta el nombre correcto
}));
      setMetas(data);
      setNextMesIndex(data.length);
    } catch {
      setMetas([]);
      setNextMesIndex(0);
    }
  };

  const agregarMes = () => {
    if (nextMesIndex >= MESES.length) return;

    const mes = MESES[nextMesIndex];

    setMetas((prev) => [
      ...prev,
      {
        mes: mes.key,
        nombre: mes.label,
        visitas_inspeccion: "",
      },
    ]);

    setNextMesIndex((prev) => prev + 1);
  };

  const eliminarMes = (mesKey: string) => {
    setMetas((prev) => prev.filter((m) => m.mes !== mesKey));
    setNextMesIndex((prev) => Math.max(prev - 1, 0));
  };

const guardarMetas = async () => {
  if (!empresa) return;

  setSaving(true);
  try {
    await axios.post(
      `${API_URL}/metas`,
      {
        user_id: empleado.id,
        empresa_id: empresa.id,
        anio,
        metas,
      },
      {
        headers: {
          Authorization: `Bearer ${authUser?.token}`,
        },
      }
    );

    Alert.alert(
      '¡Éxito!',
      'Las metas fueron guardadas correctamente.',
      [
        {
          text: 'Aceptar',
          onPress: () => {
            setModalVisible(false);
          },
        },
      ]
    );

  } catch (e) {
    Alert.alert(
      '¡Error!',
      'Hubo un problema al guardar las metas.',
      [{ text: 'Intentar de nuevo' }]
    );
  } finally {
    setSaving(false);
  }
};



  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#C62828" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* HEADER */}
     <View
  style={[
    styles.header,
    { paddingTop: Platform.OS === "ios" ? insets.top : 18 },
  ]}
>
  <View style={styles.headerContent}>
    <View>
      <Text style={styles.headerTitle}>Metas</Text>
      <Text style={styles.headerSubtitle}>
        Gestión de objetivos por empleado
      </Text>
    </View>

    <View style={styles.headerIcon}>
      <Ionicons name="trophy-outline" size={22} color="#fff" />
    </View>
  </View>
</View>


      {/* LISTA EMPLEADOS */}
      <FlatList
  data={empleados}
  keyExtractor={(item) => item.id.toString()}
  contentContainerStyle={styles.empleadosList}
  showsVerticalScrollIndicator={false}
  renderItem={({ item }) => (
    <TouchableOpacity
      activeOpacity={0.85}
      style={styles.empleadoCard}
      onPress={() => {
        setEmpleado(item);
        setEmpresa(null);
        setMetas([]);
        setNextMesIndex(0);
        setModalVisible(true);
      }}
    >
      {/* Avatar */}
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {item.name?.charAt(0).toUpperCase()}
        </Text>
      </View>

      {/* Info */}
      <View style={styles.empleadoInfo}>
        <Text style={styles.empleadoNombre} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.empleadoEmail} numberOfLines={1}>
          {item.email}
        </Text>
      </View>

      {/* Icono */}
      <Ionicons name="chevron-forward" size={20} color="#C62828" />
    </TouchableOpacity>
  )}
/>


      {/* MODAL */}
      <Modal transparent visible={modalVisible} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            {/* 🔴 HEADER */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{empleado?.name}</Text>
                <Text style={styles.modalSubtitle}>Gestión de metas</Text>
              </View>

              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={22} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* 📦 CONTENIDO */}
            <ScrollView
              contentContainerStyle={styles.modalContent}
              showsVerticalScrollIndicator={false}
            >
              {/* AÑO */}
              <View style={styles.block}>
                <Text style={styles.sectionTitle}>Año</Text>
                <TextInput
                  value={anio}
                  onChangeText={setAnio}
                  keyboardType="numeric"
                  style={styles.yearInput}
                  placeholder="2025"
                />
              </View>

              {/* EMPRESAS */}
              <View style={styles.block}>
                <Text style={styles.sectionTitle}>Empresa</Text>

                <TextInput
                  placeholder="Buscar empresa..."
                  value={empresaSearch}
                  onChangeText={setEmpresaSearch}
                  style={styles.searchInput}
                />

                <View style={styles.empresasRow}>
                  {(empleado?.empresas || [])
                    .filter((e: any) =>
                      e.nombre
                        .toLowerCase()
                        .includes(empresaSearch.toLowerCase())
                    )
                    .map((e: any) => (
                      <TouchableOpacity
  key={e.id}
  style={[
    styles.empresaCard,
    empresa?.id === e.id && styles.empresaCardActive,
  ]}
  onPress={() => {
    setEmpresa(e);
    cargarMetas(empleado.id, e.id);
  }}
>
  <Text
    numberOfLines={2}
    ellipsizeMode="tail"
    style={[
      styles.empresaText,
      empresa?.id === e.id && styles.empresaTextActive,
    ]}
  >
    {e.nombre}
  </Text>

  <Text
    style={[
      styles.empresaSub,
      empresa?.id === e.id && styles.empresaTextActive,
    ]}
  >
    CC: {e.centro_costo}
  </Text>
</TouchableOpacity>
                    ))}
                </View>
              </View>

              {/* METAS */}
              {empresa && (
                <View style={styles.block}>
                  <Text style={styles.sectionTitle}>
                    Metas mensuales · {empresa.nombre}
                  </Text>

                  {metas.length === 0 && (
                    <Text style={styles.emptyText}>
                      No hay metas registradas. Agrega meses para comenzar.
                    </Text>
                  )}

                  {metas.map((m) => (
                    <View key={m.mes} style={styles.mesCard}>
                      <View style={styles.mesChip}>
                        <Text style={styles.mesChipText}> {m.nombre}</Text>
                      </View>

                      <TextInput
                        style={styles.metaInputSmall}
                        keyboardType="numeric"
                        value={String(m.visitas_inspeccion)}
                        onChangeText={(v) =>
                          setMetas((prev) =>
                            prev.map((x) =>
                              x.mes === m.mes
                                ? { ...x, visitas_inspeccion: v }
                                : x
                            )
                          )
                        }
                      />

                      <TouchableOpacity
                        style={styles.deleteBtn}
                        onPress={() => eliminarMes(m.mes)}
                      >
                        <Ionicons name="trash-outline" size={16} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  ))}

                  <TouchableOpacity
                    style={styles.addMonthBtn}
                    onPress={agregarMes}
                  >
                    <Ionicons
                      name="add-circle-outline"
                      size={20}
                      color="#C62828"
                    />
                    <Text style={styles.addMonthText}>Agregar mes</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>

            {/* 💾 FOOTER */}
            {empresa && (
              <View style={styles.footer}>
                <TouchableOpacity
                  style={styles.saveBtn}
                  onPress={guardarMetas}
                  disabled={saving}
                >
                  <Text style={styles.saveBtnText}>
                    {saving ? "Guardando..." : "Guardar metas"}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* 🎨 ESTILOS */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F5F5" },

 header: {
  backgroundColor: "#C62828",
  paddingTop: 18,
  paddingBottom: 30,
  paddingHorizontal: 16,

  // sombra
  shadowColor: "#000",
  shadowOpacity: 0.2,
  shadowRadius: 6,
  shadowOffset: { width: 0, height: 4 },
  elevation: 6,
},

headerContent: {
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  top:10
},

headerTitle: {
  color: "#fff",
  fontSize: 22,
  fontWeight: "800",
  letterSpacing: 0.4,
},

headerSubtitle: {
  color: "#FFDADA",
  fontSize: 12,
  marginTop: 2,
},

headerIcon: {
  width: 40,
  height: 40,
  borderRadius: 20,
  backgroundColor: "rgba(255,255,255,0.18)",
  justifyContent: "center",
  alignItems: "center",
},

  empleadosList: {
  padding: 16,
  paddingBottom: 30,
},

empleadoCard: {
  backgroundColor: "#fff",
  borderRadius: 16,
  padding: 14,
  marginBottom: 12,
  flexDirection: "row",
  alignItems: "center",

  // sombra iOS
  shadowColor: "#000",
  shadowOpacity: 0.08,
  shadowRadius: 6,
  shadowOffset: { width: 0, height: 3 },

  // sombra Android
  elevation: 3,
},

avatar: {
  width: 42,
  height: 42,
  borderRadius: 21,
  backgroundColor: "#C62828",
  justifyContent: "center",
  alignItems: "center",
},

avatarText: {
  color: "#fff",
  fontWeight: "700",
  fontSize: 16,
},

empleadoInfo: {
  flex: 1,
  marginLeft: 12,
},

empleadoNombre: {
  fontSize: 15,
  fontWeight: "700",
  color: "#222",
},

empleadoEmail: {
  fontSize: 12,
  color: "#777",
  marginTop: 2,
},


  card: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    elevation: 2,
  },
  searchInput: {
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#ddd",
    marginBottom: 10,
  },

  name: { fontSize: 16, fontWeight: "700" },
  email: { color: "#666" },
  mesChip: {
    backgroundColor: "#1976D2",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    minWidth: 70,
    alignItems: "center",
  },

  mesChipText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
  },
  metaInputSmall: {
    width: 60,
    backgroundColor: "#F5F5F5",
    borderRadius: 10,
    paddingVertical: 6,
    textAlign: "center",
    borderWidth: 1,
    borderColor: "#ddd",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },

  modalBox: {
    width: "94%",
    maxHeight: "92%",
    backgroundColor: "#F9F9F9",
    borderRadius: 18,
    overflow: "hidden",
  },

  modalHeader: {
    backgroundColor: "#C62828",
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  modalTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },

  modalSubtitle: {
    color: "#FFDADA",
    fontSize: 12,
  },

  modalContent: {
    padding: 16,
    paddingBottom: 30,
  },

  block: {
    marginBottom: 18,
  },

  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#333",
    marginBottom: 8,
  },

  yearInput: {
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#ddd",
    width: 120,
  },

  empresasRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },

 empresaCard: {
  backgroundColor: "#fff",
  borderRadius: 14,
  padding: 12,
  borderWidth: 1,
  borderColor: "#ddd",
  width: "48%",              // 🔴 clave
  justifyContent: "space-between",
},

  empresaCardActive: {
    backgroundColor: "#C62828",
    borderColor: "#C62828",
  },

  empresaText: {
    fontWeight: "700",
    color: "#333",
  },

  empresaSub: {
    fontSize: 11,
    color: "#777",
  },

  empresaTextActive: {
    color: "#fff",
  },

  mesCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 10,
    marginBottom: 8,
    gap: 10,
  },

  mesNombre: {
    flex: 1,
    fontWeight: "600",
  },

  metaInput: {
    width: 70,
    backgroundColor: "#F5F5F5",
    borderRadius: 10,
    paddingVertical: 6,
    textAlign: "center",
    borderWidth: 1,
    borderColor: "#ddd",
  },

  deleteBtn: {
    backgroundColor: "#C62828",
    padding: 6,
    borderRadius: 8,
  },

  addMonthBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
  },

  addMonthText: {
    color: "#C62828",
    fontWeight: "700",
  },

  footer: {
    padding: 14,
    borderTopWidth: 1,
    borderColor: "#eee",
    backgroundColor: "#fff",
  },

  emptyText: {
    fontSize: 12,
    color: "#777",
    fontStyle: "italic",
  },

  saveBtn: {
    marginTop: 14,
    backgroundColor: "#167cfc",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
  },

  saveBtnText: {
    color: "#fff",
    fontWeight: "700",
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
