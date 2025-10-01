"use client"

import { useState, useEffect } from "react"
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  Image,
} from "react-native"
import { useAuth } from "../_layout"
import { Ionicons } from "@expo/vector-icons"
import axios from "axios"

// Extiende el tipo de usuario autenticado para incluir 'id'
interface AuthenticatedUser {
  id: number
  name: string
  email: string
  token: string
  [key: string]: any // Para otras propiedades que pueda tener
}

// --- Configuración de la API ---
const API_BASE = "https://operaciones.lavianda.com.co/api"

// --- Paleta de Colores ---
const COLORS = {
  primary: "#C62828",
  background: "#E3F2FD",
  card: "#FFFFFF",
  textPrimary: "#212121",
  textSecondary: "#757575",
  success: "#4CAF50",
  warning: "#FF9800",
  border: "#E0E0E0",
}

// Define User interface for user objects
interface User {
  id: number
  name: string
  email: string
  role: string
  created_at: string
  profile_photo_url?: string
}

export default function AdminUsersScreen() {
  const { user } = useAuth() as { user: AuthenticatedUser | null }
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<User[]>([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<number | null>(null)

  // Estados para el formulario de nuevo usuario
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    password: "",
    role: "empleado",
  })

  // Estados para el formulario de editar usuario
  const [editUser, setEditUser] = useState({
    id: 0,
    name: "",
    email: "",
    password: "",
    role: "empleado",
  })

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      setLoading(true)

      console.log("🔍 Cargando usuarios...")
      console.log("🔑 Token:", user?.token ? "Presente" : "NO PRESENTE")
      console.log("👤 Usuario actual:", user)

      const response = await axios.get(`${API_BASE}/admin/users`, {
        headers: {
          Authorization: `Bearer ${user?.token}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        timeout: 15000, // Aumentado a 15 segundos
      })

      console.log("✅ Respuesta usuarios:", response.data)

      if (response.data.success) {
        setUsers(response.data.data || [])
      } else {
        throw new Error("Error al cargar usuarios")
      }
    } catch (error) {
      console.error("❌ Error al cargar usuarios:", error)

      if (axios.isAxiosError(error)) {
        console.error("❌ Status:", error.response?.status)
        console.error("❌ Data:", error.response?.data)
        console.error("❌ Headers:", error.response?.headers)

        if (error.response?.status === 401) {
          Alert.alert("Sesión expirada", "Tu sesión ha expirado. Por favor, inicia sesión nuevamente.", [
            {
              text: "OK",
              onPress: () => {
                /* Aquí puedes agregar logout */
              },
            },
          ])
        } else if (error.response?.status === 404) {
          console.warn("⚠️ Endpoint /api/admin/users no encontrado")
          Alert.alert(
            "Endpoint no encontrado",
            "El servidor no tiene configurado el endpoint para listar usuarios.\n\nContacta al administrador del sistema.",
          )
        } else {
          const errorMessage = error.response?.data?.message || "Error al cargar usuarios"
          Alert.alert("Error", errorMessage)
        }
      }
    } finally {
      setLoading(false)
    }
  }

  const createUser = async () => {
    if (!newUser.name || !newUser.email || !newUser.password) {
      Alert.alert("Error", "Todos los campos son obligatorios")
      return
    }

    try {
      setSaving(true)
      console.log("🔍 Creando usuario...")
      console.log("📝 Datos:", newUser)
      console.log("🔑 Token:", user?.token ? "Presente" : "NO PRESENTE")

      const response = await axios.post(`${API_BASE}/admin/users`, newUser, {
        headers: {
          Authorization: `Bearer ${user?.token}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        timeout: 15000,
      })

      console.log("✅ Respuesta crear usuario:", response.data)

      if (response.data.success) {
        Alert.alert("Éxito", "Usuario creado correctamente")
        setShowAddModal(false)
        setNewUser({ name: "", email: "", password: "", role: "empleado" })
        loadUsers()
      } else {
        throw new Error(response.data.message || "Error al crear usuario")
      }
    } catch (error) {
      console.error("❌ Error al crear usuario:", error)

      if (axios.isAxiosError(error)) {
        console.error("❌ Status:", error.response?.status)
        console.error("❌ Data:", error.response?.data)
        console.error("❌ Headers:", error.response?.headers)

        if (error.response?.status === 401) {
          Alert.alert("Sesión expirada", "Tu sesión ha expirado. Por favor, inicia sesión nuevamente.")
        } else if (error.response?.status === 403) {
          Alert.alert("Sin permisos", "No tienes permisos para crear usuarios.")
        } else if (error.response?.status === 404) {
          Alert.alert(
            "Endpoint no encontrado",
            "El servidor necesita el endpoint POST /api/admin/users.\n\nContacta al administrador del sistema.",
          )
        } else if (error.response?.status === 422) {
          const errors = error.response.data?.errors
          if (errors) {
            const errorMessages = Object.values(errors).flat().join("\n")
            Alert.alert("Datos inválidos", errorMessages)
          } else {
            Alert.alert("Error", error.response.data?.message || "Datos inválidos")
          }
        } else if (error.response?.status === 500) {
          Alert.alert(
            "Error interno del servidor",
            "Hay un problema en el servidor Laravel. Revisa:\n\n" +
              "• Si AdminController existe\n" +
              "• Si las rutas están configuradas\n" +
              "• Los logs del servidor Laravel",
          )
        } else {
          Alert.alert("Error", error.response?.data?.message || "Error al crear usuario")
        }
      } else {
        Alert.alert("Error", "Error de conexión al crear usuario")
      }
    } finally {
      setSaving(false)
    }
  }

  // ✅ FUNCIÓN CORREGIDA PARA ELIMINAR USUARIOS
  const deleteUser = (userId: number, userName: string) => {
    // Verificar que no se elimine a sí mismo
    if (user && user.id === userId) {
      Alert.alert("Error", "No puedes eliminar tu propia cuenta")
      return
    }

    // Verificar que no se elimine un usuario root
    const userToDelete = users.find((u) => u.id === userId)
    if (userToDelete?.role === "root") {
      Alert.alert("Error", "No se puede eliminar un usuario root")
      return
    }

    console.log("🗑️ Iniciando eliminación de usuario:", userId, userName)

    // ✅ ALERT SIMPLIFICADO
    Alert.alert(
      "Confirmar eliminación",
      `¿Estás seguro de que quieres eliminar al usuario "${userName}"?\n\nEsta acción no se puede deshacer.`,
      [
        {
          text: "Cancelar",
          style: "cancel",
          onPress: () => console.log("❌ Eliminación cancelada"),
        },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: () => executeDeleteUser(userId, userName),
        },
      ],
    )
  }

  // ✅ FUNCIÓN SEPARADA PARA EJECUTAR LA ELIMINACIÓN
  const executeDeleteUser = async (userId: number, userName: string) => {
    try {
      setDeleting(userId)

      console.log("🗑️ Ejecutando eliminación de usuario:", userId)
      console.log("🔑 Token:", user?.token ? "Presente" : "NO PRESENTE")
      console.log("🌐 URL:", `${API_BASE}/admin/users/${userId}`)

      const response = await axios.delete(`${API_BASE}/admin/users/${userId}`, {
        headers: {
          Authorization: `Bearer ${user?.token}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        timeout: 15000,
      })

      console.log("✅ Respuesta eliminar usuario:", response.data)

      if (response.data.success) {
        Alert.alert("Éxito", "Usuario eliminado correctamente")
        loadUsers() // Recargar la lista
      } else {
        throw new Error(response.data.message || "Error al eliminar usuario")
      }
    } catch (error) {
      console.error("❌ Error al eliminar usuario:", error)

      if (axios.isAxiosError(error)) {
        console.error("❌ Status:", error.response?.status)
        console.error("❌ Data:", error.response?.data)
        console.error("❌ Headers:", error.response?.headers)

        const status = error.response?.status
        const errorMessage = error.response?.data?.message || "Error desconocido"

        switch (status) {
          case 401:
            Alert.alert("Sesión expirada", "Tu sesión ha expirado. Por favor, inicia sesión nuevamente.")
            break
          case 403:
            Alert.alert("Sin permisos", "No tienes permisos para eliminar usuarios.")
            break
          case 404:
            Alert.alert("Usuario no encontrado", "El usuario que intentas eliminar no existe o ya fue eliminado.")
            break
          case 422:
            Alert.alert("No se puede eliminar", "El usuario no puede ser eliminado porque tiene datos relacionados.")
            break
          case 500:
            Alert.alert("Error del servidor", `Error interno del servidor: ${errorMessage}`)
            break
          default:
            Alert.alert("Error", `Error al eliminar usuario: ${errorMessage}`)
        }
      } else {
        Alert.alert("Error de conexión", "No se pudo conectar con el servidor. Verifica tu conexión a internet.")
      }
    } finally {
      setDeleting(null)
    }
  }

  const updateUser = async () => {
    if (!editUser.name || !editUser.email) {
      Alert.alert("Error", "Nombre y email son obligatorios")
      return
    }

    try {
      setSaving(true)
      console.log("🔍 Actualizando usuario...")
      console.log("📝 Datos:", editUser)
      console.log("🔑 Token:", user?.token ? "Presente" : "NO PRESENTE")

      const updateData = {
        name: editUser.name,
        email: editUser.email,
        role: editUser.role,
        ...(editUser.password ? { password: editUser.password } : {}),
      }

      const response = await axios.put(`${API_BASE}/admin/users/${editUser.id}`, updateData, {
        headers: {
          Authorization: `Bearer ${user?.token}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        timeout: 15000,
      })

      console.log("✅ Respuesta actualizar usuario:", response.data)

      if (response.data.success) {
        Alert.alert("Éxito", "Usuario actualizado correctamente")
        setShowEditModal(false)
        setEditUser({ id: 0, name: "", email: "", password: "", role: "empleado" })
        loadUsers()
      } else {
        throw new Error(response.data.message || "Error al actualizar usuario")
      }
    } catch (error) {
      console.error("❌ Error al actualizar usuario:", error)

      if (axios.isAxiosError(error)) {
        console.error("❌ Status:", error.response?.status)
        console.error("❌ Data:", error.response?.data)

        if (error.response?.status === 401) {
          Alert.alert("Sesión expirada", "Tu sesión ha expirado. Por favor, inicia sesión nuevamente.")
        } else if (error.response?.status === 403) {
          Alert.alert("Sin permisos", "No tienes permisos para editar usuarios.")
        } else if (error.response?.status === 404) {
          Alert.alert(
            "Endpoint no encontrado",
            "El servidor necesita el endpoint PUT /api/admin/users/{id}.\n\nContacta al administrador del sistema.",
          )
        } else if (error.response?.status === 422) {
          const errors = error.response.data?.errors
          if (errors) {
            const errorMessages = Object.values(errors).flat().join("\n")
            Alert.alert("Datos inválidos", errorMessages)
          } else {
            Alert.alert("Error", error.response.data?.message || "Datos inválidos")
          }
        } else {
          Alert.alert("Error", error.response?.data?.message || "Error al actualizar usuario")
        }
      } else {
        Alert.alert("Error", "Error de conexión al actualizar usuario")
      }
    } finally {
      setSaving(false)
    }
  }

  const openEditModal = (userToEdit: User) => {
    setEditUser({
      id: userToEdit.id,
      name: userToEdit.name,
      email: userToEdit.email,
      password: "",
      role: userToEdit.role,
    })
    setShowEditModal(true)
  }

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case "admin":
        return "Administrador"
      case "root":
        return "Super Admin"
      case "empleado":
        return "Empleado"
      case "guest":
        return "Invitado"
      default:
        return role
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case "admin":
        return "#FF9800"
      case "root":
        return "#F44336"
      case "empleado":
        return "#4CAF50"
      case "guest":
        return "#9E9E9E"
      default:
        return "#9E9E9E"
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Cargando usuarios...</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Gestión de Usuarios</Text>
        <Text style={styles.headerSubtitle}>{users.length} usuarios registrados</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => setShowAddModal(true)}>
          <Ionicons name="person-add" size={20} color={COLORS.card} />
          <Text style={styles.addButtonText}>Agregar Usuario</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {users.map((userItem) => (
          <View key={`user-${userItem.id}`} style={styles.userCard}>
            <View style={styles.userInfo}>
              <View style={styles.userHeader}>
                <View style={styles.userMainInfo}>
                  <Image
                    source={{
                      uri:
                        userItem.profile_photo_url ||
                        `https://ui-avatars.com/api/?name=${encodeURIComponent(userItem.name)}&color=C62828&background=E3F2FD&bold=true`,
                    }}
                    style={styles.userAvatar}
                  />
                  <View style={styles.userNameContainer}>
                    <Text style={styles.userName}>{userItem.name}</Text>
                    <View style={[styles.roleBadge, { backgroundColor: getRoleColor(userItem.role) }]}>
                      <Text style={styles.roleText}>{getRoleDisplayName(userItem.role)}</Text>
                    </View>
                  </View>
                </View>
              </View>

              <View style={styles.userDetails}>
                <View style={styles.detailRow}>
                  <Ionicons name="mail" size={16} color={COLORS.textSecondary} />
                  <Text style={styles.detailText}>{userItem.email}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Ionicons name="calendar" size={16} color={COLORS.textSecondary} />
                  <Text style={styles.detailText}>
                    Registrado: {new Date(userItem.created_at).toLocaleDateString("es-ES")}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.userActions}>
              <TouchableOpacity style={styles.editButton} onPress={() => openEditModal(userItem)}>
                <Ionicons name="create" size={16} color={COLORS.primary} />
              </TouchableOpacity>

              {userItem.role !== "root" && user?.id !== userItem.id && (
                <TouchableOpacity
                  style={[styles.deleteButton, deleting === userItem.id && styles.deleteButtonDisabled]}
                  onPress={() => deleteUser(userItem.id, userItem.name)}
                  disabled={deleting === userItem.id}
                >
                  {deleting === userItem.id ? (
                    <ActivityIndicator size={16} color="#F44336" />
                  ) : (
                    <Ionicons name="trash" size={16} color="#F44336" />
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Modal para agregar usuario */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Agregar Nuevo Usuario</Text>
            <TouchableOpacity onPress={() => setShowAddModal(false)}>
              <Ionicons name="close" size={24} color={COLORS.card} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Nombre Completo</Text>
              <TextInput
                style={styles.textInput}
                value={newUser.name}
                onChangeText={(text) => setNewUser((prev) => ({ ...prev, name: text }))}
                placeholder="Ingresa el nombre completo"
                autoCapitalize="words"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Correo Electrónico</Text>
              <TextInput
                style={styles.textInput}
                value={newUser.email}
                onChangeText={(text) => setNewUser((prev) => ({ ...prev, email: text }))}
                placeholder="usuario@lavianda.com.co"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Contraseña</Text>
              <TextInput
                style={styles.textInput}
                value={newUser.password}
                onChangeText={(text) => setNewUser((prev) => ({ ...prev, password: text }))}
                placeholder="Contraseña segura"
                secureTextEntry
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Rol del Usuario</Text>
              <View style={styles.roleSelector}>
                {["empleado", "admin"].map((role) => (
                  <TouchableOpacity
                    key={role}
                    style={[styles.roleOption, newUser.role === role && styles.roleOptionSelected]}
                    onPress={() => setNewUser((prev) => ({ ...prev, role }))}
                  >
                    <Text style={[styles.roleOptionText, newUser.role === role && styles.roleOptionTextSelected]}>
                      {getRoleDisplayName(role)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity style={styles.saveButton} onPress={createUser} disabled={saving}>
              {saving ? (
                <ActivityIndicator size="small" color={COLORS.card} />
              ) : (
                <>
                  <Ionicons name="checkmark" size={20} color={COLORS.card} />
                  <Text style={styles.saveButtonText}>Crear Usuario</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Modal para editar usuario */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Editar Usuario</Text>
            <TouchableOpacity onPress={() => setShowEditModal(false)}>
              <Ionicons name="close" size={24} color={COLORS.card} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Nombre Completo</Text>
              <TextInput
                style={styles.textInput}
                value={editUser.name}
                onChangeText={(text) => setEditUser((prev) => ({ ...prev, name: text }))}
                placeholder="Ingresa el nombre completo"
                placeholderTextColor={COLORS.textSecondary}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Correo Electrónico</Text>
              <TextInput
                style={styles.textInput}
                value={editUser.email}
                onChangeText={(text) => setEditUser((prev) => ({ ...prev, email: text }))}
                placeholder="usuario@lavianda.com.co"
                placeholderTextColor={COLORS.textSecondary}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Nueva Contraseña (opcional)</Text>
              <TextInput
                style={styles.textInput}
                value={editUser.password}
                onChangeText={(text) => setEditUser((prev) => ({ ...prev, password: text }))}
                placeholder="Dejar vacío para mantener la actual"
                placeholderTextColor={COLORS.textSecondary}
                secureTextEntry
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Rol del Usuario</Text>
              <View style={styles.roleSelector}>
                {["empleado", "admin"].map((role) => (
                  <TouchableOpacity
                    key={role}
                    style={[styles.roleOption, editUser.role === role && styles.roleOptionSelected]}
                    onPress={() => setEditUser((prev) => ({ ...prev, role }))}
                  >
                    <Text style={[styles.roleOptionText, editUser.role === role && styles.roleOptionTextSelected]}>
                      {getRoleDisplayName(role)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity style={styles.saveButton} onPress={updateUser} disabled={saving}>
              {saving ? (
                <ActivityIndicator size="small" color={COLORS.card} />
              ) : (
                <>
                  <Ionicons name="checkmark" size={20} color={COLORS.card} />
                  <Text style={styles.saveButtonText}>Actualizar Usuario</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  )
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
    marginTop: 10,
    color: COLORS.textSecondary,
    fontSize: 16,
  },
  header: {
    backgroundColor: COLORS.primary,
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerTitle: {
    color: COLORS.card,
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
  },
  headerSubtitle: {
    color: COLORS.card,
    fontSize: 14,
    textAlign: "center",
    marginTop: 5,
    opacity: 0.9,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 25,
    marginTop: 15,
    alignSelf: "center",
  },
  addButtonText: {
    color: COLORS.card,
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  userCard: {
    backgroundColor: COLORS.card,
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  userInfo: {
    flex: 1,
  },
  userHeader: {
    marginBottom: 10,
  },
  userMainInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  userNameContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  userName: {
    fontSize: 16,
    fontWeight: "bold",
    color: COLORS.textPrimary,
    flex: 1,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  roleText: {
    color: COLORS.card,
    fontSize: 10,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  userDetails: {
    gap: 5,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  detailText: {
    marginLeft: 8,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  userActions: {
    flexDirection: "row",
    gap: 10,
  },
  editButton: {
    backgroundColor: COLORS.background,
    padding: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  deleteButton: {
    backgroundColor: "#FFEBEE",
    padding: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#F44336",
  },
  deleteButtonDisabled: {
    opacity: 0.5,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  modalHeader: {
    backgroundColor: COLORS.primary,
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalTitle: {
    color: COLORS.card,
    fontSize: 20,
    fontWeight: "bold",
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  roleSelector: {
    flexDirection: "row",
    gap: 10,
  },
  roleOption: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: "center",
  },
  roleOptionSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },
  roleOptionText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textPrimary,
  },
  roleOptionTextSelected: {
    color: COLORS.card,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 15,
    borderRadius: 10,
    marginTop: 20,
  },
  saveButtonText: {
    color: COLORS.card,
    fontSize: 16,
    fontWeight: "bold",
    marginLeft: 8,
  },
})
