/**
 * 🔐 Auth Context - Gestión de autenticación
 * 
 * Context para manejar el estado de autenticación del usuario,
 * tokens, y sesión activa con el backend Laravel.
 * 
 * Autor: GitHub Copilot
 * Fecha: 5 de octubre de 2025
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';
import { setSecureItem, getSecureItem, deleteSecureItem, getStorageDebugInfo } from '../utils/secureStorage';

// Configuración del API
const API_URL = 'https://operaciones.lavianda.com.co/api';

// Tipos
interface User {
    id: number;
    name: string;
    email: string;
    role: string;
    empresa_id?: number;
}

interface AuthContextData {
    user: User | null;
    token: string | null;
    loading: boolean;
    isAuthenticated: boolean;
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    register: (data: RegisterData) => Promise<void>;
}

interface RegisterData {
    name: string;
    email: string;
    password: string;
    password_confirmation: string;
}

// Crear el contexto
const AuthContext = createContext<AuthContextData>({} as AuthContextData);

// Provider
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    // Cargar token al iniciar
    useEffect(() => {
        loadStoredToken();
    }, []);

    // Cargar token guardado
    const loadStoredToken = async () => {
        try {
            console.log('🔄 Cargando token guardado...');
            const storedToken = await getSecureItem('auth_token');
            
            if (storedToken) {
                console.log('✅ Token encontrado, longitud:', storedToken.length);
                setToken(storedToken);
                await loadUser(storedToken);
            } else {
                console.log('⚠️ No se encontró token guardado');
            }
        } catch (error) {
            console.error('❌ Error cargando token:', error);
        } finally {
            setLoading(false);
        }
    };

    // Cargar datos del usuario
    const loadUser = async (authToken: string) => {
        try {
            const response = await axios.get(`${API_URL}/user`, {
                headers: {
                    Authorization: `Bearer ${authToken}`,
                    Accept: 'application/json',
                },
            });
            setUser(response.data);
        } catch (error) {
            console.error('Error cargando usuario:', error);
            // Si falla, limpiar token inválido
            await logout();
        }
    };

    // Login
    const login = async (email: string, password: string) => {
        try {
            const response = await axios.post(`${API_URL}/login`, {
                email,
                password,
            });

            console.log('✅ Login exitoso:', response.data);

            // El servidor devuelve access_token, no token
            const { access_token: authToken, user: userData } = response.data;
            
            console.log('💾 Guardando token con longitud:', authToken.length);
            
            // Guardar token usando sistema híbrido
            await setSecureItem('auth_token', authToken);
            setToken(authToken);
            setUser(userData);

            // Verificar que se guardó correctamente
            const debugInfo = await getStorageDebugInfo('auth_token');
            console.log('🔍 Debug storage:', debugInfo);
            console.log('💾 Token almacenado correctamente');
            console.log('🔐 Usuario iniciando sesión:', userData.name);
        } catch (error: any) {
            console.error('❌ Error en login:', error.response?.data || error.message);
            throw new Error(error.response?.data?.message || 'Error al iniciar sesión');
        }
    };

    // Register
    const register = async (data: RegisterData) => {
        try {
            const response = await axios.post(`${API_URL}/register`, data);

            // El servidor puede devolver access_token o token, verificar ambos
            const authToken = response.data.access_token || response.data.token;
            const userData = response.data.user;
            
            // Guardar token usando sistema híbrido
            await setSecureItem('auth_token', authToken);
            setToken(authToken);
            setUser(userData);

            console.log('✅ Registro exitoso:', userData.name);
        } catch (error: any) {
            console.error('❌ Error en registro:', error.response?.data || error.message);
            throw new Error(error.response?.data?.message || 'Error al registrarse');
        }
    };

    // Logout
    const logout = async () => {
        try {
            if (token) {
                await axios.post(
                    `${API_URL}/logout`,
                    {},
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                            Accept: 'application/json',
                        },
                    }
                );
            }
        } catch (error) {
            console.error('Error en logout:', error);
        } finally {
            // Limpiar estado
            await deleteSecureItem('auth_token');
            setToken(null);
            setUser(null);
            console.log('👋 Sesión cerrada');
        }
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                token,
                loading,
                isAuthenticated: !!token && !!user,
                login,
                logout,
                register,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

// Hook para usar el contexto
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth debe usarse dentro de AuthProvider');
    }
    return context;
};

export default AuthContext;
