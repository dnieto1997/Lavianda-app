import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  ScrollView,
  TextInput,
  useWindowDimensions,
  Alert,
  
} from "react-native";
import axios from "axios";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../_layout";
import { router } from "expo-router";

const API_URL = "https://operaciones.lavianda.com.co/api";

const MESES = [
  { id: 1, label: "Enero" },
  { id: 2, label: "Febrero" },
  { id: 3, label: "Marzo" },
  { id: 4, label: "Abril" },
  { id: 5, label: "Mayo" },
  { id: 6, label: "Junio" },
  { id: 7, label: "Julio" },
  { id: 8, label: "Agosto" },
  { id: 9, label: "Septiembre" },
  { id: 10, label: "Octubre" },
  { id: 11, label: "Noviembre" },
  { id: 12, label: "Diciembre" },
];

export default function DashboardScreen() {
  const { user } = useAuth();
  const authUser: any = user;
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;

  const [loading, setLoading] = useState(true);
  const [supervisores, setSupervisores] = useState<any[]>([]);
  const [totalEmpresas, setTotalEmpresas] = useState(0);

  const [modalVisible, setModalVisible] = useState(false);
  const [supervisor, setSupervisor] = useState<any>(null);
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [loadingDetalle, setLoadingDetalle] = useState(false);

  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [anio, setAnio] = useState(String(new Date().getFullYear()));
  const [showYearPicker, setShowYearPicker] = useState(false);
const [yearDate, setYearDate] = useState(new Date());
const { signOut } = useAuth();

  useEffect(() => {
    cargarDashboard();
  }, []);

const cargarDashboard = async () => {
  try {
    const [resStats, resEmpresas] = await Promise.all([
      axios.get(`${API_URL}/dashboard/stats`, {
        headers: { Authorization: `Bearer ${authUser?.token}` },
      }),
      axios.get(`${API_URL}/dashboard/empresas-stats`, {
        headers: { Authorization: `Bearer ${authUser?.token}`, 'Content-Type': 'application/json',
            'Accept': 'application/json' },
      }),
    ]);

    setSupervisores(resStats.data.supervisores || []);
    setTotalEmpresas(resEmpresas.data.total_empresas_creadas || 0);

  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      Alert.alert(
        "Sesión expirada",
        "Tu sesión ha vencido. Por favor inicia sesión nuevamente.",
        [
          {
            text: "OK",
            onPress: () => {
              signOut();
            },
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


  const cargarEmpresas = async (
  supervisorId: number,
  mesParam = mes,
  anioParam = anio
) => {
  setLoadingDetalle(true);
  try {
    const res = await axios.get(
      `${API_URL}/dashboard/supervisor/${supervisorId}/empresas`,
      {
        params: {
          mes: mesParam,
          anio: anioParam,
        },
        headers: { Authorization: `Bearer ${authUser?.token}` },
      }
    );
    setEmpresas(res.data.empresas || []);
  } finally {
    setLoadingDetalle(false);
  }
};


  const irADetalle = (e: any) => {
    setModalVisible(false)
    router.push({
      pathname: "/registro-detalle",
      params: {
        registroId: e.registro_cliente_id.toString(),
        empresaNombre: e.empresa,
      },
    });
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
    <View style={styles.header}>
      <Text style={styles.headerTitle}>Dashboard</Text>
    </View>

    {/* ===== METRICAS ===== */}
    <View style={styles.metricsRow}>
      <View style={styles.metricCard}>
        <Ionicons name="business" size={26} color="#C62828" />
        <View>
          <Text style={styles.metricValue}>{totalEmpresas}</Text>
          <Text style={styles.metricLabel}>Empresas creadas</Text>
        </View>
      </View>

      <View style={styles.metricCard}>
        <Ionicons name="people" size={26} color="#1565C0" />
        <View>
          <Text style={styles.metricValue}>{supervisores.length}</Text>
          <Text style={styles.metricLabel}>Supervisores</Text>
        </View>
      </View>
    </View>

    {/* ===== TITULO LISTADO ===== */}
<View style={styles.sectionHeader}>
  <Text style={styles.sectionTitle}>
    Listado de supervisores por metas
  </Text>
  <Text style={styles.sectionSubtitle}>
    Seguimiento del rendimiento mensual por supervisor
  </Text>
</View>

    <FlatList
      data={supervisores}
      keyExtractor={(i) => i.supervisor_id.toString()}
      contentContainerStyle={{ padding: 16 }}
      renderItem={({ item }) => {
        const ultimo = item.historial?.[item.historial.length - 1];

     
    

        return (
          <TouchableOpacity
            style={styles.supervisorCard}
            onPress={() => {
              setSupervisor(item);
              cargarEmpresas(item.supervisor_id);
              setModalVisible(true);
            }}
          >
            {/* HEADER CARD */}
            <View style={styles.supervisorHeader}>
              <Ionicons name="person-circle" size={34} color="#C62828" />
              <View style={{ flex: 1 }}>
                <Text style={styles.supervisorNombre}>
                  {item.nombre_supervisor}
                </Text>
               
              </View>

              <Ionicons name="chevron-forward" size={22} color="#999" />
            </View>

            {/* BODY */}
           
          </TouchableOpacity>
        );
      }}
    />

      {/* ================= MODAL ================= */}
      <Modal transparent visible={modalVisible} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {supervisor?.nombre_supervisor}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={22} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* FILTROS */}
         <View style={styles.filtersRow}>
  {/* MESES */}
  <View style={styles.mesesContainer}>
    <Text style={{ fontSize: 12, fontWeight: "700", color: "#666", marginBottom: 4 }}>
      Mes
    </Text>
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.mesesScroll}
    >
      {MESES.map((m) => (
        <TouchableOpacity
          key={m.id}
          style={[
            styles.mesBtn,
            mes === m.id && styles.mesBtnActivo,
          ]}
          onPress={() => {
            setMes(m.id);
  cargarEmpresas(supervisor.supervisor_id, m.id, anio)
          }}
        >
          <Text
            style={[
              styles.mesText,
              mes === m.id && styles.mesTextActivo,
            ]}
          >
            {m.label}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
      <View style={styles.anioContainer}>
    <Text style={styles.anioLabel}>Año</Text>
   <TextInput
  value={anio}
  onChangeText={setAnio}
  onBlur={() =>
    cargarEmpresas(
      supervisor.supervisor_id,
      mes,
      anio
    )
  }
  keyboardType="numeric"
  maxLength={4}
  style={styles.yearInput}
/>

  </View>
  </View>

  {/* AÑO */}

</View>


            {/* TABLA */}
            {loadingDetalle ? (
              <ActivityIndicator size="large" color="#C62828" />
            ) : (
              <ScrollView horizontal={!isDesktop} contentContainerStyle={{ padding: 20 }}>
                <View style={{ minWidth: isDesktop ? 1000 : 800 }}>
                  <View style={styles.tableHeader}>
                    <Text style={[styles.th, { flex: 3 }]}>Empresa</Text>
                    <Text style={[styles.th, { flex: 1 }]}>Visitas</Text>
                    <Text style={[styles.th, { flex: 1 }]}>Meta</Text>
                    <Text style={[styles.th, { flex: 3 }]}>Rendimiento</Text>
                  </View>

                  {empresas.map((e, idx) => {
                    const porcentaje = Number(e.porcentaje) || 0;

                    return (
                      <View key={idx} style={styles.tableRow}>
                        {/* EMPRESA + BOTÓN */}
                        <View style={[styles.cell, { flex: 3 }]}>
                          <Text style={styles.empresaNombre}>{e.empresa}</Text>
                          <TouchableOpacity
                            style={styles.botonEntrar}
                            onPress={() => irADetalle(e)}
                          >
                            <Ionicons
                              name="enter-outline"
                              size={16}
                              color="#fff"
                            />
                            <Text style={styles.textoEntrar}>ENTRAR</Text>
                          </TouchableOpacity>
                        </View>

                        <View style={[styles.cell, { flex: 1 }]}>
                          <Text>{e.visitas}</Text>
                        </View>

                        <View style={[styles.cell, { flex: 1 }]}>
                          <Text>{e.meta}</Text>
                        </View>

                        {/* RENDIMIENTO */}
                        <View style={[styles.cell, { flex: 3 }]}>
                          <Text
                            style={[
                              styles.rendimientoText,
                              {
                                color:
                                  porcentaje >= 100
                                    ? "#2E7D32"
                                    : "#C62828",
                              },
                            ]}
                          >
                            {porcentaje.toFixed(1)}%
                          </Text>

                          <View style={styles.track}>
                            <View
                              style={[
                                styles.fill,
                                {
                                  width: `${Math.min(porcentaje, 100)}%`,
                                  backgroundColor:
                                    porcentaje >= 100
                                      ? "#2E7D32"
                                      : "#C62828",
                                },
                              ]}
                            />
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ===================== STYLES ===================== */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F6F8" },
  header: { backgroundColor: "#C62828", padding: 30 },
  headerTitle: { color: "#fff", fontSize: 22, fontWeight: "800",top:20,textAlign:'center' },

  statsCard: {
    backgroundColor: "#fff",
    margin: 16,
    padding: 16,
    borderRadius: 16,
    flexDirection: "row",
    gap: 12,
  },
  filtersRow: {
  padding: 16,
  borderBottomWidth: 1,
  borderBottomColor: "#EEE",

  flexDirection: "row",
  alignItems: "center",
  gap: 16,

  // clave para responsive
  flexWrap: "wrap",
},

/* ===== MESES ===== */
mesesContainer: {
  flex: 1,
  minWidth: 280,
},

mesesScroll: {
  alignItems: "center",
  gap: 6,
},

mesBtn: {
  backgroundColor: "#EEE",
  paddingVertical: 6,
  paddingHorizontal: 14,
  borderRadius: 20,
},

mesBtnActivo: {
  backgroundColor: "#C62828",
},

mesText: {
  fontSize: 12,
  fontWeight: "600",
  color: "#333",
},

mesTextActivo: {
  color: "#fff",
},

/* ===== AÑO ===== */
anioContainer: {
  minWidth: 40,
  top:10
},

anioLabel: {
  fontSize: 12,
  fontWeight: "700",
  color: "#666",
  marginBottom: 4,
},

yearInput: {
  backgroundColor: "#F1F1F1",
  borderRadius: 12,
  paddingVertical: 8,
  paddingHorizontal: 12,
  fontSize: 14,
  textAlign: "center",
},


  statsValue: { fontSize: 24, fontWeight: "800" },
  statsLabel: { color: "#777" },

  card: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
  },

  nombre: { fontWeight: "700", fontSize: 16 },
  small: { fontSize: 12, color: "#666", marginTop: 4 },
  percent: { fontWeight: "800", marginTop: 6 },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },

  modalBox: {
    width: "95%",
    maxWidth: 1400,
    height: "90%",
    backgroundColor: "#fff",
    borderRadius: 22,
    overflow: "hidden",
  },

  modalHeader: {
    backgroundColor: "#C62828",
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
  },

  modalTitle: { color: "#fff", fontWeight: "800" },

 sectionHeader: {
  paddingHorizontal: 16,
  marginTop: 22,
  marginBottom: 12,
},

sectionTitle: {
  fontSize: 18,
  fontWeight: "800",
  color: "#222",
},

sectionSubtitle: {
  fontSize: 13,
  color: "#777",
  marginTop: 4,
},


  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#F1F1F1",
    borderRadius: 12,
    padding: 12,
  },

  th: { fontWeight: "800", fontSize: 13 },

  tableRow: {
    flexDirection: "row",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#EEE",
  },

  cell: {
    justifyContent: "center",
    paddingHorizontal: 6,
  },

  empresaNombre: {
    fontWeight: "700",
    marginBottom: 6,
  },

  botonEntrar: {
    backgroundColor: "#167cfc",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
  },

  textoEntrar: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 12,
  },

  rendimientoText: {
    fontWeight: "800",
    fontSize: 12,
    marginBottom: 4,
  },

  track: {
    height: 8,
    backgroundColor: "#E0E0E0",
    borderRadius: 8,
    overflow: "hidden",
  },

  fill: { height: 8 },

  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  metricsRow: {
  flexDirection: "row",
  gap: 12,
  paddingHorizontal: 16,
  marginTop: 16,
},

metricCard: {
  flex: 1,
  backgroundColor: "#fff",
  borderRadius: 16,
  padding: 16,
  flexDirection: "row",
  gap: 12,
  alignItems: "center",
},

metricValue: {
  fontSize: 22,
  fontWeight: "800",
},

metricLabel: {
  fontSize: 12,
  color: "#777",
},

supervisorCard: {
  backgroundColor: "#fff",
  borderRadius: 18,
  padding: 16,
  marginBottom: 14,
},

supervisorHeader: {
  flexDirection: "row",
  alignItems: "center",
  gap: 12,
  marginBottom: 8,
},

supervisorNombre: {
  fontSize: 16,
  fontWeight: "800",
},

supervisorSub: {
  fontSize: 12,
  color: "#777",
},

supervisorPorcentaje: {
  fontWeight: "800",
  marginBottom: 6,
},

trackMini: {
  height: 6,
  backgroundColor: "#EEE",
  borderRadius: 6,
  overflow: "hidden",
},

fillMini: {
  height: 6,
  borderRadius: 6,
},

sinDatos: {
  fontSize: 12,
  color: "#999",
  fontStyle: "italic",
},


});
