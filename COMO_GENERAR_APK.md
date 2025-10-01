# 📱 Cómo Generar APK con Mapas Funcionando

## ✅ Tu proyecto ya está configurado para EAS Build

### Paso 1: Instalar EAS CLI (cuando la conexión mejore)

```bash
# Opción A: Global (recomendado)
sudo npm install -g eas-cli

# Opción B: Local en el proyecto
cd /home/fabricciodev21/Documentos/operaciones.lavianda/operaciones_front
npm install --save-dev eas-cli
```

### Paso 2: Login en EAS

```bash
cd /home/fabricciodev21/Documentos/operaciones.lavianda/operaciones_front
eas login
```

Usa tus credenciales de Expo:
- Username: `fabricciodev_21`
- Email o contraseña de tu cuenta Expo

### Paso 3: Crear APK de Desarrollo (con mapas funcionando)

```bash
# APK de desarrollo (más rápido, para testing)
eas build --profile development --platform android

# O APK de preview (optimizado pero no firmado para Play Store)
eas build --profile preview --platform android
```

### Paso 4: Descargar e Instalar

1. El build se hará en la nube de Expo (no necesitas Android Studio)
2. Cuando termine (5-15 minutos), recibirás un link para descargar la APK
3. Descarga la APK en tu teléfono
4. Instálala (necesitarás permitir instalación desde fuentes desconocidas)

### 📱 Diferencias entre los builds:

| Build | Uso | Mapas | Tamaño |
|-------|-----|-------|--------|
| **development** | Testing y debug | ✅ Sí | ~100MB |
| **preview** | Testing final | ✅ Sí | ~50MB |
| **production** | Play Store | ✅ Sí | ~30MB |

### 🗺️ ¿Qué incluye la APK?

✅ Mapas nativos con Google Maps (react-native-maps)
✅ Tracking en tiempo real
✅ Marcadores de login/logout
✅ Polylines de rutas
✅ Mejor rendimiento que Expo Go
✅ Todas las funcionalidades nativas

### 💡 Mientras tanto (en Expo Go):

En Expo Go verás una vista informativa con:
- 📍 Coordenadas exactas
- 📊 Información de sesiones de tracking
- ⏰ Tiempos de inicio y fin
- 🔢 Cantidad de puntos

**Toda la lógica funciona**, solo falta el mapa visual.

### 🌐 Alternativa: Probar en Web

```bash
# En la terminal donde está corriendo Expo, presiona:
w

# O abre directamente:
http://localhost:8081
```

En web, los mapas funcionan perfectamente con Google Maps JavaScript API.

### ⚠️ Notas Importantes:

1. **Primera vez**: El primer build puede tardar más (15-20 min)
2. **Builds siguientes**: Serán más rápidos (5-10 min)
3. **Límites gratuitos**: Expo te da builds gratis mensuales
4. **Sin Android Studio**: Todo se compila en la nube
5. **API Key**: Ya está configurada en `app.json`

### 🆘 Si algo falla:

```bash
# Ver el status del build
eas build:list

# Cancelar un build
eas build:cancel

# Ver logs en tiempo real
eas build --profile development --platform android --wait
```

### 📞 Soporte:

- Documentación: https://docs.expo.dev/build/introduction/
- Tu Project ID: `9715e6ce-e4b3-430a-a637-caee4a1ed165`
- Owner: `fabricciodev_21`

---

## 🎯 Resumen Rápido:

```bash
# 1. Instalar (cuando la red funcione)
sudo npm install -g eas-cli

# 2. Login
eas login

# 3. Crear APK
cd /home/fabricciodev21/Documentos/operaciones.lavianda/operaciones_front
eas build --profile preview --platform android

# 4. Esperar link de descarga
# 5. Instalar en tu teléfono
# 6. ¡Probar los mapas! 🗺️
```

¡Todo está listo para cuando tu conexión mejore! 🚀
