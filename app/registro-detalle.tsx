import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  TextInput,
  FlatList,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from './_layout';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';

// --- Configuración de la API ---
const API_BASE = 'https://operaciones.lavianda.com.co/api';

// --- Paleta de Colores ---
const COLORS = {
  primary: '#C62828',
  background: '#E3F2FD',
  card: '#FFFFFF',
  textPrimary: '#212121',
  textSecondary: '#757575',
  success: '#4CAF50',
  warning: '#FF9800',
  error: '#F44336',
  danger: '#F44336',
  border: '#E0E0E0',
};

// --- Interfaces ---
interface RegistroDetalle {
  id: number;
  empresa_id: number;
  empresa: {
    id: number;
    nombre: string;
    centro_costo: string;
    identificacion?: string;
    direccion?: string;
  };
  supervisor_id?: number;
  supervisor?: {
    id: number;
    name: string;
  };
  fecha_creacion: string;
  creado_por: number;
  creador?: {
    id: number;
    name: string;
  };
  created_at: string;
  updated_at: string;
}

interface Formulario {
  id: number;
  registro_cliente_id: number;
  nombre_contrato?: string;
  supervisor_id?: number;
  supervisor?: {
    id: number;
    name: string;
  };
  creado_por: number;
  creador?: {
    id: number;
    name: string;
  };
  created_at: string;
  updated_at: string;
}

interface Empleado {
  id: number;
  name?: string;
}

interface Carpeta {
  id: number;
  nombre: string;
  carpeta_padre_id?: number;
  registro_cliente_id: number;
  ruta: string;
  created_at: string;
  updated_at: string;
  subcarpetas?: Carpeta[];
  documentos?: Documento[];
}

interface Documento {
  id: number;
  nombre: string;
  nombre_original: string;
  ruta: string;
  tipo: string;
  tamaño: number;
  carpeta_id?: number;
  registro_cliente_id: number;
  subido_por: number;
  uploaded_by: number;
  usuario?: string | {
    id: number;
    name: string;
  };
  created_at: string;
  updated_at: string;
}

export default function RegistroDetalleScreen() {
  const { registroId } = useLocalSearchParams<{ registroId: string }>();
  const { user } = useAuth();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [registro, setRegistro] = useState<RegistroDetalle | null>(null);
  const [formularios, setFormularios] = useState<Formulario[]>([]);
  const [puedeCrearFormulario, setPuedeCrearFormulario] = useState(false);
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [showCambiarSupervisorModal, setShowCambiarSupervisorModal] = useState(false);
  
  // Estados para sistema de documentos
  const [carpetas, setCarpetas] = useState<Carpeta[]>([]);
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [carpetaActual, setCarpetaActual] = useState<Carpeta | null>(null);
  const [rutaCarpetas, setRutaCarpetas] = useState<Carpeta[]>([]);
  const [showDocumentosModal, setShowDocumentosModal] = useState(false);
  const [showCrearCarpetaModal, setShowCrearCarpetaModal] = useState(false);
  const [nombreNuevaCarpeta, setNombreNuevaCarpeta] = useState('');
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  
  // Verificar permisos de administrador
  const isAdmin = user?.userData?.role === 'admin' || user?.userData?.role === 'root';

  useEffect(() => {
    if (registroId) {
      loadRegistroDetalle();
    }
  }, [registroId]);

  const loadRegistroDetalle = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE}/registros-clientes/${registroId}`, {
        headers: { 'Authorization': `Bearer ${user?.token}` }
      });

      const data = response.data;
      setRegistro(data.registro);
      setFormularios(data.formularios || []);
      setPuedeCrearFormulario(data.puede_crear_formulario || false);
      setEmpleados(data.empleados || []);
    } catch (error) {
      console.error('Error al cargar detalle del registro:', error);
      Alert.alert('Error', 'No se pudo cargar la información del registro');
      router.back();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadRegistroDetalle();
  };

  const crearFormulario = () => {
    if (!registro) return;
    
    console.log('Datos completos del registro:', registro);
    console.log('Empresa:', registro.empresa);
    console.log('Identificación empresa:', registro.empresa?.identificacion);
    
    router.push({
      pathname: '/formulario-acta-inicio',
      params: { 
        registroId: registro.id.toString(),
        empresaId: registro.empresa_id.toString(),
        empresa: registro.empresa.nombre,
        nit: registro.empresa?.identificacion || '',
        modo: 'crear'
      }
    });
  };

  const abrirFormulario = (formularioId: number) => {
    router.push({
      pathname: '/formulario-acta-inicio',
      params: { 
        registroId: registroId,
        formularioId: formularioId,
        modo: 'ver'
      }
    });
  };

  const eliminarFormulario = (formularioId: number) => {
    Alert.alert(
      'Confirmar eliminación',
      '¿Estás seguro de que deseas eliminar este formulario?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await axios.delete(`${API_BASE}/formularios-acta-inicio/${formularioId}`, {
                headers: { 'Authorization': `Bearer ${user?.token}` }
              });
              Alert.alert('Éxito', 'Formulario eliminado correctamente');
              loadRegistroDetalle();
            } catch (error) {
              console.error('Error al eliminar formulario:', error);
              Alert.alert('Error', 'No se pudo eliminar el formulario');
            }
          }
        }
      ]
    );
  };

  const cambiarSupervisor = async (supervisorId: number) => {
    try {
      await axios.put(`${API_BASE}/registros-clientes/${registroId}/supervisor`, {
        supervisor_id: supervisorId
      }, {
        headers: { 'Authorization': `Bearer ${user?.token}` }
      });

      Alert.alert('Éxito', 'Supervisor actualizado correctamente');
      setShowCambiarSupervisorModal(false);
      loadRegistroDetalle();
    } catch (error) {
      console.error('Error al cambiar supervisor:', error);
      Alert.alert('Error', 'No se pudo cambiar el supervisor');
    }
  };

  // --- FUNCIONES PARA SISTEMA DE DOCUMENTOS ---
  
  const loadDocumentos = async (carpetaId?: number) => {
    try {
      setLoadingDocuments(true);
      const params = carpetaId ? `?carpeta_id=${carpetaId}` : '';
      
      const [carpetasResponse, documentosResponse] = await Promise.all([
        axios.get(`${API_BASE}/registros-clientes/${registroId}/carpetas${params}`, {
          headers: { 'Authorization': `Bearer ${user?.token}` }
        }),
        axios.get(`${API_BASE}/registros-clientes/${registroId}/documentos${params}`, {
          headers: { 'Authorization': `Bearer ${user?.token}` }
        })
      ]);

      setCarpetas(carpetasResponse.data);
      setDocumentos(documentosResponse.data);
    } catch (error) {
      console.error('Error al cargar documentos:', error);
      Alert.alert('Error', 'No se pudieron cargar los documentos');
    } finally {
      setLoadingDocuments(false);
    }
  };

  const crearCarpeta = async () => {
    if (!nombreNuevaCarpeta.trim()) {
      Alert.alert('Error', 'Ingrese un nombre para la carpeta');
      return;
    }

    try {
      await axios.post(`${API_BASE}/registros-clientes/${registroId}/carpetas`, {
        nombre: nombreNuevaCarpeta.trim(),
        carpeta_padre_id: carpetaActual?.id || null
      }, {
        headers: { 'Authorization': `Bearer ${user?.token}` }
      });

      Alert.alert('Éxito', 'Carpeta creada correctamente');
      setNombreNuevaCarpeta('');
      setShowCrearCarpetaModal(false);
      loadDocumentos(carpetaActual?.id);
    } catch (error) {
      console.error('Error al crear carpeta:', error);
      Alert.alert('Error', 'No se pudo crear la carpeta');
    }
  };

  const subirDocumento = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: true
      });

      if (!result.canceled && result.assets) {
        setUploadingDocument(true);
        
        for (const asset of result.assets) {
          const formData = new FormData();
          formData.append('documento', {
            uri: asset.uri,
            type: asset.mimeType || 'application/octet-stream',
            name: asset.name
          } as any);
          
          if (carpetaActual?.id) {
            formData.append('carpeta_id', carpetaActual.id.toString());
          }

          await axios.post(`${API_BASE}/registros-clientes/${registroId}/documentos`, formData, {
            headers: { 
              'Authorization': `Bearer ${user?.token}`,
              'Content-Type': 'multipart/form-data'
            }
          });
        }

        Alert.alert('Éxito', `${result.assets.length} documento(s) subido(s) correctamente`);
        loadDocumentos(carpetaActual?.id);
      }
    } catch (error) {
      console.error('Error al subir documento:', error);
      Alert.alert('Error', 'No se pudo subir el documento');
    } finally {
      setUploadingDocument(false);
    }
  };

  const navegarACarpeta = (carpeta: Carpeta) => {
    setCarpetaActual(carpeta);
    setRutaCarpetas([...rutaCarpetas, carpeta]);
    loadDocumentos(carpeta.id);
  };

  const navegarAtras = () => {
    const nuevaRuta = [...rutaCarpetas];
    nuevaRuta.pop();
    
    const carpetaPadre = nuevaRuta.length > 0 ? nuevaRuta[nuevaRuta.length - 1] : null;
    setCarpetaActual(carpetaPadre);
    setRutaCarpetas(nuevaRuta);
    loadDocumentos(carpetaPadre?.id);
  };

  const eliminarCarpeta = (carpeta: Carpeta) => {
    Alert.alert(
      'Confirmar eliminación',
      `¿Estás seguro de que deseas eliminar la carpeta "${carpeta.nombre}"? Esto eliminará también todo su contenido.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await axios.delete(`${API_BASE}/carpetas/${carpeta.id}`, {
                headers: { 'Authorization': `Bearer ${user?.token}` }
              });
              Alert.alert('Éxito', 'Carpeta eliminada correctamente');
              loadDocumentos(carpetaActual?.id);
            } catch (error) {
              console.error('Error al eliminar carpeta:', error);
              Alert.alert('Error', 'No se pudo eliminar la carpeta');
            }
          }
        }
      ]
    );
  };

  const eliminarDocumento = (documento: Documento) => {
    Alert.alert(
      'Confirmar eliminación',
      `¿Estás seguro de que deseas eliminar el documento "${documento.nombre_original}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await axios.delete(`${API_BASE}/documentos/${documento.id}`, {
                headers: { 'Authorization': `Bearer ${user?.token}` }
              });
              Alert.alert('Éxito', 'Documento eliminado correctamente');
              loadDocumentos(carpetaActual?.id);
            } catch (error) {
              console.error('Error al eliminar documento:', error);
              Alert.alert('Error', 'No se pudo eliminar el documento');
            }
          }
        }
      ]
    );
  };

  const descargarDocumento = async (documento: Documento) => {
    try {
      Alert.alert('Descargando...', 'Por favor espere...');
      
      // Usar downloadAsync para descargar el archivo directamente
      const fileName = documento.nombre_original;
      const fileUri = FileSystem.documentDirectory + fileName;
      
      const downloadResult = await FileSystem.downloadAsync(
        `${API_BASE}/documentos/${documento.id}/descargar`,
        fileUri,
        {
          headers: {
            'Authorization': `Bearer ${user?.token}`,
          },
        }
      );

      if (downloadResult.status === 200) {
        // Verificar si el archivo se descargó correctamente
        const fileInfo = await FileSystem.getInfoAsync(fileUri);
        if (fileInfo.exists) {
          // Compartir el archivo
          const Sharing = require('expo-sharing');
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(fileUri);
            Alert.alert('Éxito', 'Documento descargado y compartido');
          } else {
            Alert.alert('Éxito', `Documento guardado en: ${fileName}`);
          }
        } else {
          Alert.alert('Error', 'No se pudo guardar el archivo');
        }
      } else {
        Alert.alert('Error', `Error al descargar: ${downloadResult.status}`);
      }

    } catch (error: any) {
      console.error('Error al descargar documento:', error);
      if (error?.response?.status === 404) {
        Alert.alert('Error', 'Documento no encontrado');
      } else if (error?.response?.status === 403) {
        Alert.alert('Error', 'No tienes permisos para descargar este documento');
      } else {
        Alert.alert('Error', 'No se pudo descargar el documento. Verifique su conexión.');
      }
    }
  };

  const abrirDocumentos = () => {
    setShowDocumentosModal(true);
    loadDocumentos();
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Cargando...</Text>
      </View>
    );
  }

  if (!registro) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>No se pudo cargar la información</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header con información del registro */}
        <View style={styles.headerCard}>
          <View style={styles.headerRow}>
            <TouchableOpacity style={styles.backIcon} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Registro #{registro.id}</Text>
            {isAdmin && (
              <TouchableOpacity 
                style={styles.editIcon}
                onPress={() => setShowCambiarSupervisorModal(true)}
              >
                <Ionicons name="person-add" size={24} color={COLORS.primary} />
              </TouchableOpacity>
            )}
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Empresa:</Text>
            <Text style={styles.infoValue}>{registro.empresa.nombre}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Centro de Costo:</Text>
            <Text style={styles.infoValue}>{registro.empresa.centro_costo}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Supervisor:</Text>
            <Text style={styles.infoValue}>
              {registro.supervisor?.name || 'Sin asignar'}
            </Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Creado por:</Text>
            <Text style={styles.infoValue}>{registro.creador?.name || 'Usuario desconocido'}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Fecha de creación:</Text>
            <Text style={styles.infoValue}>
              {new Date(registro.created_at).toLocaleDateString()}
            </Text>
          </View>
        </View>

        {/* Sección de documentos */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Documentos</Text>
            <TouchableOpacity style={styles.documentsButton} onPress={abrirDocumentos}>
              <Ionicons name="folder-outline" size={20} color={COLORS.card} />
              <Text style={styles.createButtonText}>Gestionar Documentos</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Sección de formularios */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Formularios</Text>
            {puedeCrearFormulario && (
              <TouchableOpacity style={styles.createButton} onPress={crearFormulario}>
                <Ionicons name="add" size={20} color={COLORS.card} />
                <Text style={styles.createButtonText}>Crear Formulario</Text>
              </TouchableOpacity>
            )}
          </View>

          {formularios.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="document-outline" size={48} color={COLORS.textSecondary} />
              <Text style={styles.emptyStateText}>
                {puedeCrearFormulario 
                  ? 'No hay formularios creados. Presiona "Crear Formulario" para comenzar.'
                  : 'No hay formularios disponibles.'
                }
              </Text>
            </View>
          ) : (
            formularios.map((formulario) => (
              <View key={formulario.id} style={styles.formularioCard}>
                <View style={styles.formularioHeader}>
                  <Text style={styles.formularioTitle}>ACTA DE INICIO DEL SERVICIO DE ASEO INTEGRAL Y CAFETERIA </Text>
                  {isAdmin && (
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => eliminarFormulario(formulario.id)}
                    >
                      <Ionicons name="trash" size={20} color={COLORS.error} />
                    </TouchableOpacity>
                  )}
                </View>
                
                <View style={styles.formularioInfo}>
                  <Text style={styles.formularioLabel}>Supervisor:</Text>
                  <Text style={styles.formularioValue}>
                    {formulario.supervisor?.name || 'Sin asignar'}
                  </Text>
                </View>
                
                <View style={styles.formularioInfo}>
                  <Text style={styles.formularioLabel}>Creado por:</Text>
                  <Text style={styles.formularioValue}>{formulario.creador?.name || 'Usuario desconocido'}</Text>
                </View>
                
                <View style={styles.formularioInfo}>
                  <Text style={styles.formularioLabel}>Fecha:</Text>
                  <Text style={styles.formularioValue}>
                    {new Date(formulario.created_at).toLocaleDateString()}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.openFormButton}
                  onPress={() => abrirFormulario(formulario.id)}
                >
                  <Text style={styles.openFormButtonText}>Abrir Formulario</Text>
                  <Ionicons name="chevron-forward" size={20} color={COLORS.primary} />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Modal para cambiar supervisor */}
      <Modal
        visible={showCambiarSupervisorModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCambiarSupervisorModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Cambiar Supervisor</Text>
            
            <ScrollView style={styles.empleadosList}>
              {empleados.map((empleado) => (
                <TouchableOpacity
                  key={empleado.id}
                  style={styles.empleadoItem}
                  onPress={() => cambiarSupervisor(empleado.id)}
                >
                  <Text style={styles.empleadoName}>{empleado.name || 'Empleado sin nombre'}</Text>
                  {registro?.supervisor_id === empleado.id && (
                    <Ionicons name="checkmark" size={20} color={COLORS.success} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setShowCambiarSupervisorModal(false)}
            >
              <Text style={styles.modalCancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal de Documentos */}
      <Modal
        visible={showDocumentosModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.container}>
          <View style={styles.documentsModalHeader}>
            <TouchableOpacity onPress={() => setShowDocumentosModal(false)}>
              <Ionicons name="close" size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.documentsModalTitle}>Documentos - {registro?.empresa.nombre}</Text>
            <View style={styles.headerActions}>
              <TouchableOpacity 
                onPress={() => setShowCrearCarpetaModal(true)}
                style={styles.headerButton}
              >
                <Ionicons name="folder-outline" size={20} color={COLORS.primary} />
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={subirDocumento}
                style={styles.headerButton}
                disabled={uploadingDocument}
              >
                {uploadingDocument ? (
                  <ActivityIndicator size="small" color={COLORS.primary} />
                ) : (
                  <Ionicons name="cloud-upload-outline" size={20} color={COLORS.primary} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Breadcrumb de navegación */}
          {rutaCarpetas.length > 0 && (
            <View style={styles.breadcrumb}>
              <TouchableOpacity onPress={() => {
                setCarpetaActual(null);
                setRutaCarpetas([]);
                loadDocumentos();
              }}>
                <Text style={styles.breadcrumbItem}>📁 Raíz</Text>
              </TouchableOpacity>
              {rutaCarpetas.map((carpeta, index) => (
                <View key={carpeta.id} style={styles.breadcrumbContainer}>
                  <Text style={styles.breadcrumbSeparator}> {'>'} </Text>
                  <TouchableOpacity onPress={() => {
                    const nuevaRuta = rutaCarpetas.slice(0, index + 1);
                    setCarpetaActual(carpeta);
                    setRutaCarpetas(nuevaRuta);
                    loadDocumentos(carpeta.id);
                  }}>
                    <Text style={styles.breadcrumbItem}>📁 {carpeta.nombre}</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Botón de volver atrás */}
          {carpetaActual && (
            <TouchableOpacity style={styles.backToParent} onPress={navegarAtras}>
              <Ionicons name="arrow-back" size={20} color={COLORS.primary} />
              <Text style={styles.backToParentText}>Volver atrás</Text>
            </TouchableOpacity>
          )}

          {loadingDocuments ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.loadingText}>Cargando documentos...</Text>
            </View>
          ) : (
            <ScrollView style={styles.documentsContent}>
              {/* Lista de carpetas */}
              {carpetas.map((carpeta) => (
                <TouchableOpacity
                  key={carpeta.id}
                  style={styles.documentItem}
                  onPress={() => navegarACarpeta(carpeta)}
                >
                  <View style={styles.documentInfo}>
                    <Ionicons name="folder" size={32} color={COLORS.warning} />
                    <View style={styles.documentDetails}>
                      <Text style={styles.documentName}>{carpeta.nombre}</Text>
                      <Text style={styles.documentDate}>
                        Creada: {new Date(carpeta.created_at).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>
                  {(user?.userData?.role === 'admin' || user?.userData?.role === 'root') && (
                    <TouchableOpacity
                      onPress={() => eliminarCarpeta(carpeta)}
                      style={styles.deleteDocumentButton}
                    >
                      <Ionicons name="trash-outline" size={20} color={COLORS.error} />
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              ))}

              {/* Lista de documentos */}
              {documentos.map((documento) => {
                // Debug: verificar rol del usuario
                console.log('🔍 Debug permisos documento:', {
                  documentoId: documento.id,
                  userRole: user?.userData?.role,
                  canDelete: (user?.userData?.role === 'admin' || user?.userData?.role === 'root')
                });
                
                return (
                <View key={documento.id} style={styles.documentItem}>
                  <View style={styles.documentInfo}>
                    <Ionicons 
                      name={
                        documento.tipo && documento.tipo.includes('image') ? 'image' :
                        documento.tipo && documento.tipo.includes('pdf') ? 'document' :
                        documento.tipo && documento.tipo.includes('video') ? 'videocam' :
                        'document-text'
                      } 
                      size={32} 
                      color={COLORS.primary} 
                    />
                    <View style={styles.documentDetails}>
                      <Text style={styles.documentName}>{documento.nombre_original || 'Documento sin nombre'}</Text>
                      <Text style={styles.documentDate}>
                        {documento.tamaño ? formatFileSize(documento.tamaño) : '0 KB'} • {new Date(documento.created_at).toLocaleDateString()}
                      </Text>
                      <Text style={styles.documentUser}>
                        Subido por: {typeof documento.usuario === 'string' ? documento.usuario : 
                                   documento.usuario?.name || 'Usuario desconocido'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.documentActions}>
                    <TouchableOpacity
                      onPress={() => descargarDocumento(documento)}
                      style={styles.downloadButton}
                    >
                      <Ionicons name="download" size={20} color={COLORS.primary} />
                    </TouchableOpacity>
                    {(user?.userData?.role === 'admin' || user?.userData?.role === 'root') && (
                      <TouchableOpacity
                        onPress={() => eliminarDocumento(documento)}
                        style={styles.deleteDocumentButton}
                      >
                        <Ionicons name="trash" size={20} color={COLORS.danger} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
                );
              })}

              {carpetas.length === 0 && documentos.length === 0 && (
                <View style={styles.emptyDocuments}>
                  <Ionicons name="folder-open-outline" size={64} color={COLORS.textSecondary} />
                  <Text style={styles.emptyDocumentsText}>
                    {carpetaActual ? 'Esta carpeta está vacía' : 'No hay documentos'}
                  </Text>
                  <Text style={styles.emptyDocumentsSubtext}>
                    Presiona + para crear una carpeta o ☁️ para subir documentos
                  </Text>
                </View>
              )}
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* Modal Crear Carpeta */}
      <Modal
        visible={showCrearCarpetaModal}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.createFolderModalOverlay}>
          <View style={styles.createFolderModalContent}>
            <Text style={styles.modalTitle}>Nueva Carpeta</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Nombre de la carpeta"
              value={nombreNuevaCarpeta}
              onChangeText={setNombreNuevaCarpeta}
              autoFocus={true}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setShowCrearCarpetaModal(false);
                  setNombreNuevaCarpeta('');
                }}
              >
                <Text style={styles.modalCancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmButton}
                onPress={crearCarpeta}
              >
                <Text style={styles.modalConfirmButtonText}>Crear</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: COLORS.error,
    textAlign: 'center',
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  backButtonText: {
    color: COLORS.card,
    fontSize: 16,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  headerCard: {
    backgroundColor: COLORS.card,
    margin: 16,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  backIcon: {
    marginRight: 12,
  },
  headerTitle: {
    flex: 1,
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  editIcon: {
    marginLeft: 12,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textSecondary,
    width: 120,
  },
  infoValue: {
    flex: 1,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  section: {
    backgroundColor: COLORS.card,
    margin: 16,
    marginTop: 0,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  documentsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.warning,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  createButtonText: {
    color: COLORS.card,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 24,
  },
  formularioCard: {
    backgroundColor: COLORS.background,
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  formularioHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  formularioTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  deleteButton: {
    padding: 4,
  },
  formularioInfo: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  formularioLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textSecondary,
    width: 100,
  },
  formularioValue: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  openFormButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  openFormButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: COLORS.card,
    width: '80%',
    maxHeight: '70%',
    borderRadius: 12,
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: 20,
  },
  empleadosList: {
    maxHeight: 300,
  },
  empleadoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  empleadoName: {
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  modalCancelButton: {
    backgroundColor: COLORS.textSecondary,
    padding: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  modalCancelButtonText: {
    color: COLORS.card,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  
  // --- Estilos para Sistema de Documentos ---
  documentsModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  documentsModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  headerButton: {
    backgroundColor: COLORS.background,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  breadcrumb: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    flexWrap: 'wrap',
  },
  breadcrumbContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  breadcrumbItem: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '500',
  },
  breadcrumbSeparator: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginHorizontal: 4,
  },
  backToParent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backToParentText: {
    marginLeft: 8,
    fontSize: 16,
    color: COLORS.primary,
    fontWeight: '500',
  },
  documentsContent: {
    flex: 1,
    padding: 16,
  },
  documentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    padding: 16,
    marginBottom: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  documentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  documentDetails: {
    marginLeft: 12,
    flex: 1,
  },
  documentName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  documentDate: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  documentUser: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
    fontStyle: 'italic',
  },
  deleteDocumentButton: {
    padding: 8,
    backgroundColor: COLORS.background,
    borderRadius: 6,
  },
  emptyDocuments: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyDocumentsText: {
    fontSize: 18,
    color: COLORS.textSecondary,
    marginTop: 16,
    fontWeight: '600',
  },
  emptyDocumentsSubtext: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  createFolderModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  createFolderModalContent: {
    backgroundColor: COLORS.card,
    margin: 20,
    borderRadius: 12,
    padding: 24,
    minWidth: 300,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginTop: 16,
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalConfirmButton: {
    flex: 1,
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalConfirmButtonText: {
    color: COLORS.card,
    fontWeight: '600',
  },
  documentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  downloadButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
});
