"use client"

import React, { useState, useEffect } from "react"
import { Stack, useRouter, useSegments } from "expo-router"
import * as SecureStore from "expo-secure-store"
import { Platform, ActivityIndicator, View } from "react-native"
import axios from "axios"
import type { AuthContextType, AuthenticatedUser, User } from "../types/auth"
import { LocationProvider } from "../contexts/LocationContext"

// --- Configuración de la API ---
// ¡¡¡CAMBIA ESTA IP POR LA TUYA!!!
const API_BASE = "https://operaciones.lavianda.com.co/api" // URL base para API calls

// Cambia a true para modo demo, false para producción
const DEMO_MODE = false

const AuthContext = React.createContext<AuthContextType | null>(null)

export const useAuth = () => {
  const context = React.useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth debe ser usado dentro de un AuthProvider")
  }
  return context
}

// Funciones para manejo de token multiplataforma
const getStoredToken = async (): Promise<string | null> => {
  try {
    if (Platform.OS === "web") {
      // En web usamos localStorage
      return localStorage.getItem("userToken")
    } else {
      // En móvil usamos SecureStore
      return await SecureStore.getItemAsync("userToken")
    }
  } catch (error) {
    console.log("❌ Error al obtener token:", error)
    return null
  }
}

const storeToken = async (token: string): Promise<void> => {
  try {
    if (Platform.OS === "web") {
      localStorage.setItem("userToken", token)
    } else {
      await SecureStore.setItemAsync("userToken", token)
    }
    console.log("💾 Token almacenado correctamente")
  } catch (error) {
    console.log("❌ Error al almacenar token:", error)
  }
}

const removeStoredToken = async (): Promise<void> => {
  try {
    if (Platform.OS === "web") {
      localStorage.removeItem("userToken")
    } else {
      await SecureStore.deleteItemAsync("userToken")
    }
    console.log("🗑️ Token eliminado correctamente")
  } catch (error) {
    console.log("❌ Error al eliminar token:", error)
  }
}

function useProtectedRoute(user: AuthenticatedUser | null, isReady: boolean) {
  const segments = useSegments()
  const router = useRouter()

  useEffect(() => {
    if (!isReady) return

    // Verificar si estamos en el grupo de tabs (rutas protegidas)
    const inAuthGroup = Array.isArray(segments) && segments[0] === "(tabs)"

    // Definir rutas públicas
    const inPublicRoute =
      segments.length === 1 ||
      segments.includes("login") ||
      segments.includes("register") ||
      segments.includes("forgot-password") ||
      segments.includes("reset-password")

    // Definir rutas protegidas que usuarios autenticados pueden acceder
    const inProtectedRoute = 
      inAuthGroup ||
      segments.includes("registro-detalle") ||
      segments.includes("formulario-acta-inicio")

    console.log("🔍 Navegación - Segmentos:", segments)
    console.log("🔍 Usuario autenticado:", !!user)
    console.log("🔍 En grupo auth:", inAuthGroup)
    console.log("🔍 En ruta pública:", inPublicRoute)
    console.log("🔍 En ruta protegida:", inProtectedRoute)

    // Si no hay usuario y está intentando acceder a rutas protegidas
    if (!user && inProtectedRoute) {
      console.log("🚫 Redirigiendo a login - Usuario no autenticado")
      router.replace("/login")
      return
    }

    // Si hay usuario y está en rutas públicas (excepto si ya está navegando)
    if (user && inPublicRoute && !inProtectedRoute) {
      console.log("✅ Redirigiendo a tabs - Usuario autenticado")
      router.replace("/(tabs)")
      return
    }

    // No hacer nada si el usuario está autenticado y ya está en las tabs
    // Esto permite la navegación libre entre pestañas
  }, [user, segments, isReady, router])
}

export default function RootLayout() {
  const [user, setUser] = useState<AuthenticatedUser | null>(null)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    const checkToken = async () => {
      console.log(`🔄 Iniciando verificación de token en ${Platform.OS}...`)

      try {
        // Obtener token del almacenamiento (funciona tanto en web como móvil)
        const token = await getStoredToken()

        if (token) {
          console.log("🔍 Token encontrado, verificando validez...")

          if (DEMO_MODE) {
            console.log("🎭 Modo demo: simulando verificación de token")
            // En modo demo, creamos un usuario falso basado en el token guardado
            const demoUser: User = {
              id: 1,
              name: "Usuario Demo",
              email: "demo@lavianda.com",
              role: "admin",
            }
            console.log("✅ Token demo válido, usuario simulado:", demoUser)
            setUser({ token, userData: demoUser })
          } else {
            // Modo producción: verificar token con el servidor
            console.log("🌐 Verificando token con servidor...")
            const response = await axios.get<User>(`${API_BASE}/user`, {
              headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
                "Content-Type": "application/json",
              },
              timeout: 10000, // 10 segundos de timeout
            })
            console.log("✅ Token válido, usuario autenticado:", response.data)
            setUser({ token, userData: response.data })
          }
        } else {
          console.log("ℹ️ No se encontró token almacenado")
        }
      } catch (e) {
        console.log("❌ Error al verificar token:", e)

        if (e instanceof Error) {
          console.log("Detalles del error:", e.message)
        }

        if (axios.isAxiosError(e)) {
          console.log("❌ Error de red:", e.code)
          console.log("❌ Status:", e.response?.status)
          console.log("❌ Data:", e.response?.data)

          // Si es error 401 (no autorizado), el token expiró
          if (e.response?.status === 401) {
            console.log("🔒 Token expirado, limpiando almacenamiento")
            await removeStoredToken()
          }
        }

        // En caso de error, limpiar el token inválido
        try {
          await removeStoredToken()
          console.log("🧹 Token inválido eliminado")
        } catch (deleteError) {
          console.log("⚠️ Error al limpiar token inválido:", deleteError)
        }
      } finally {
        console.log("✅ Verificación de token completada")
        setIsReady(true)
      }
    }

    checkToken()
  }, [])

  useProtectedRoute(user, isReady)

  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    )
  }

  return (
    <LocationProvider>
      <AuthContext.Provider
        value={{
          signIn: async (userData, token) => {
            console.log("🔐 Usuario iniciando sesión:", userData.name)
            await storeToken(token) // Almacenar token al hacer login
            setUser({ token, userData })
          },
          signOut: async () => {
            console.log("🚪 Usuario cerrando sesión")
            await removeStoredToken() // Eliminar token al hacer logout
            setUser(null)
          },
          user,
        }}
      >
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="login" />
          <Stack.Screen name="register" />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="registro-detalle" options={{ headerShown: true, title: "Detalle del Registro" }} />
          <Stack.Screen name="formulario-acta-inicio" options={{ headerShown: true, title: "Formulario Acta de Inicio" }} />
          <Stack.Screen name="forgot-password" />
          <Stack.Screen name="reset-password" options={{ headerShown: true, title: "Restablecer Contraseña" }} />
        </Stack>
      </AuthContext.Provider>
    </LocationProvider>
  )
}
