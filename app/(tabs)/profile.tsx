// --- START OF FILE app/(tabs)/profile.tsx (Versión Definitiva con Corrección de Header) ---

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Image, TouchableOpacity, Alert,
  ActivityIndicator, ScrollView, Platform, Modal, TextInput,
} from 'react-native';
import { useAuth } from '../_layout';
import { useLocation } from '../../contexts/LocationContext';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';

// --- Configuración ---
const API_BASE = 'https://operaciones.lavianda.com.co/api';
const COLORS = {
  primary: '#C62828', background: '#E3F2FD', card: '#FFFFFF',
  textPrimary: '#212121', textSecondary: '#757575', success: '#4CAF50', border: '#E0E0E0',
};

export default function ProfileScreen() {
  const { user, signOut, signIn } = useAuth();
  const { startTracking } = useLocation();
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);

  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');

  useEffect(() => {
    if (user?.userData) {
      // Validar que sean cadenas antes de usarlas
      const validName = typeof user.userData.name === 'string' ? user.userData.name : '';
      const validEmail = typeof user.userData.email === 'string' ? user.userData.email : '';
      setEditName(validName);
      setEditEmail(validEmail);
    }
  }, [user]);

  const handleApiError = (error: any, action: string) => {
    console.error(`Error al ${action}:`, JSON.stringify(error, null, 2));
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const message = error.response?.data?.message || `El servidor respondió con un error ${status}.`;
      Alert.alert('Error', `No se pudo ${action}. ${message}`);
    } else {
      Alert.alert('Error', `Ocurrió un error de red al intentar ${action}.`);
    }
  };

  const refreshUserData = async () => {
    if (!user?.token) return;
    try {
      const response = await axios.get(`${API_BASE}/user`, { headers: { 'Authorization': `Bearer ${user.token}` } });
      if (response.data && user) signIn(response.data, user.token);
    } catch (error) { console.error("No se pudo refrescar los datos del usuario", error); }
  };

  const pickImage = async () => {
    try {
      if (Platform.OS !== 'web') await ImagePicker.requestMediaLibraryPermissionsAsync();
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true, aspect: [1, 1], quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets[0]) {
        await uploadProfilePhoto(result.assets[0].uri);
      }
    } catch (error) { Alert.alert('Error', 'No se pudo abrir la galería.'); }
  };

  const uploadProfilePhoto = async (uri: string) => {
    setUploadingPhoto(true);
    const formData = new FormData();
    const filename = uri.split('/').pop() || 'profile.jpg';
    const type = `image/${filename.split('.').pop()}`;
    formData.append('photo', { uri, name: filename, type } as any);

    try {
      await axios.post(`${API_BASE}/profile/photo`, formData, {
        headers: {
          'Authorization': `Bearer ${user?.token}`,
          // ✅✅✅ SOLUCIÓN DEFINITIVA: Forzamos la cabecera correcta para la subida de archivos.
          'Content-Type': 'multipart/form-data',
        },
      });
      await refreshUserData();
      Alert.alert('Éxito', 'Foto de perfil actualizada.');
    } catch (error) {
      handleApiError(error, 'subir la foto');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleUpdateProfile = async () => {
    if (!editName.trim() || !editEmail.trim()) {
      return Alert.alert('Campos requeridos', 'El nombre y el correo no pueden estar vacíos.');
    }
    setUpdatingProfile(true);
    const profileData = { name: editName.trim(), email: editEmail.trim() };

    try {
      await axios.put(`${API_BASE}/profile`, profileData, {
        headers: { 'Authorization': `Bearer ${user?.token}` }
      });
      await refreshUserData();
      Alert.alert('Éxito', 'Perfil actualizado correctamente.');
      setEditModalVisible(false);
    } catch (error) {
      handleApiError(error, 'actualizar el perfil');
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handleLogout = () => Alert.alert('Cerrar Sesión', '¿Estás seguro?', [{ text: 'Cancelar' }, { text: 'Sí, Cerrar', style: 'destructive', onPress: executeLogout }]);
  const executeLogout = async () => {
    setLogoutLoading(true);
    try {
      if (user?.token) {
        await startTracking(user.token, 'logout').catch(e => console.warn("Fallo al enviar ubicación de logout", e));
        await axios.post(`${API_BASE}/logout`, {}, { headers: { 'Authorization': `Bearer ${user.token}` } }).catch(e => console.warn("Fallo al invalidar token en servidor", e));
      }
    } finally { signOut(); setLogoutLoading(false); }
  };

  const getRoleDisplayName = (role: string = 'guest') => ({ admin: 'Administrador', root: 'Super Admin', empleado: 'Empleado', guest: 'Invitado' }[role] || role);
  const getRoleColor = (role: string = 'guest') => ({ admin: '#FF9800', root: '#F44336', empleado: '#4CAF50', guest: '#9E9E9E' }[role] || '#9E9E9E');

  // Validar que los datos del usuario sean cadenas
  const userName = typeof user?.userData?.name === 'string' ? user.userData.name : 'Usuario';
  const userEmail = typeof user?.userData?.email === 'string' ? user.userData.email : 'email@ejemplo.com';
  const userRole = typeof user?.userData?.role === 'string' ? user.userData.role : 'guest';

  return (
    <>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.card}>
          <View style={styles.photoSection}>
            <TouchableOpacity onPress={pickImage} disabled={uploadingPhoto}>
              <Image 
                source={{ 
                  uri: user?.userData?.profile_photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&color=FFFFFF&background=C62828&bold=true` 
                }} 
                style={styles.profilePhoto} 
              />
              <View style={styles.cameraButton}>
                {uploadingPhoto ? (
                  <ActivityIndicator size="small" color={COLORS.card} />
                ) : (
                  <Ionicons name="camera-outline" size={20} color={COLORS.card} />
                )}
              </View>
            </TouchableOpacity>
            <Text style={styles.photoHint}>Toca la foto para cambiarla</Text>
          </View>
          
          <View style={styles.infoSection}>
            <View style={styles.infoRow}>
              <Ionicons name="person-outline" size={20} color={COLORS.primary} />
              <View style={styles.infoText}>
                <Text style={styles.infoLabel}>Nombre</Text>
                <Text style={styles.infoValue}>{userName}</Text>
              </View>
            </View>
            
            <View style={styles.infoRow}>
              <Ionicons name="mail-outline" size={20} color={COLORS.primary} />
              <View style={styles.infoText}>
                <Text style={styles.infoLabel}>Correo</Text>
                <Text style={styles.infoValue}>{userEmail}</Text>
              </View>
            </View>
            
            <View style={styles.infoRow}>
              <Ionicons name="shield-outline" size={20} color={getRoleColor(userRole)} />
              <View style={styles.infoText}>
                <Text style={styles.infoLabel}>Rol</Text>
                <View style={[styles.roleBadge, { backgroundColor: getRoleColor(userRole) }]}>
                  <Text style={styles.roleText}>{getRoleDisplayName(userRole)}</Text>
                </View>
              </View>
            </View>
          </View>
          
          <View style={styles.actionsSection}>
            <TouchableOpacity 
              style={styles.editButton} 
              onPress={() => setEditModalVisible(true)} 
              disabled={logoutLoading}
            >
              <Ionicons name="create-outline" size={18} color={COLORS.primary} />
              <Text style={styles.editButtonText}>Editar</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.logoutButton} 
              onPress={handleLogout} 
              disabled={logoutLoading}
            >
              {logoutLoading ? (
                <ActivityIndicator size="small" color={COLORS.card} />
              ) : (
                <>
                  <Ionicons name="log-out-outline" size={20} color={COLORS.card} />
                  <Text style={styles.logoutButtonText}>Salir</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
      
      <Modal 
        animationType="slide" 
        transparent={true} 
        visible={editModalVisible} 
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Editar Perfil</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Ionicons name="close-outline" size={28} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>Nombre Completo</Text>
              <TextInput 
                style={styles.textInput} 
                value={editName} 
                onChangeText={setEditName} 
                autoCapitalize="words" 
              />
              
              <Text style={styles.inputLabel}>Correo Electrónico</Text>
              <TextInput 
                style={styles.textInput} 
                value={editEmail} 
                onChangeText={setEditEmail} 
                keyboardType="email-address" 
                autoCapitalize="none" 
              />
            </View>
            
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]} 
                onPress={() => setEditModalVisible(false)} 
                disabled={updatingProfile}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, styles.saveButton]} 
                onPress={handleUpdateProfile} 
                disabled={updatingProfile}
              >
                {updatingProfile ? (
                  <ActivityIndicator size="small" color={COLORS.card} />
                ) : (
                  <Text style={styles.saveButtonText}>Guardar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

// --- Estilos ---
const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: COLORS.background },
  card: { backgroundColor: COLORS.card, borderRadius: 18, paddingVertical: 30, paddingHorizontal: 24, width: '100%', maxWidth: 420, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 8 },
  photoSection: { alignItems: 'center', marginBottom: 25 },
  profilePhoto: { width: 120, height: 120, borderRadius: 60, borderWidth: 4, borderColor: COLORS.card, backgroundColor: '#e0e0e0' },
  cameraButton: { position: 'absolute', bottom: 5, right: 5, backgroundColor: COLORS.primary, borderRadius: 20, width: 40, height: 40, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: COLORS.card },
  photoHint: { color: COLORS.textSecondary, fontSize: 13, textAlign: 'center', marginTop: 10 },
  infoSection: { width: '100%', marginBottom: 30 },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#f2f2f2' },
  infoText: { marginLeft: 16, flex: 1 },
  infoLabel: { color: COLORS.textSecondary, fontSize: 12, marginBottom: 2 },
  infoValue: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '500' },
  roleBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 15, alignSelf: 'flex-start' },
  roleText: { color: COLORS.card, fontSize: 12, fontWeight: 'bold' },
  actionsSection: { flexDirection: 'row', justifyContent: 'space-around', width: '100%' },
  editButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E3F2FD', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8 },
  editButtonText: { color: COLORS.primary, fontSize: 16, fontWeight: 'bold', marginLeft: 8 },
  logoutButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, minWidth: 120, justifyContent: 'center' },
  logoutButtonText: { color: COLORS.card, fontSize: 16, fontWeight: 'bold', marginLeft: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: COLORS.card, borderRadius: 12, width: '100%', maxWidth: 400 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.textPrimary },
  modalBody: { padding: 20 },
  inputLabel: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 8, marginTop: 10 },
  textInput: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 12, fontSize: 16, color: COLORS.textPrimary },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', padding: 15, borderTopWidth: 1, borderTopColor: COLORS.border },
  modalButton: { padding: 12, borderRadius: 8, alignItems: 'center', marginHorizontal: 5, minWidth: 110 },
  cancelButton: { backgroundColor: '#eeeeee' },
  saveButton: { backgroundColor: COLORS.primary },
  cancelButtonText: { color: COLORS.textSecondary, fontSize: 16, fontWeight: '600' },
  saveButtonText: { color: COLORS.card, fontSize: 16, fontWeight: '600' },
});