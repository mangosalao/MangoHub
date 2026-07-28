# 🥭 Mango Hub

**Plataforma oficial de la comunidad de Twitch de xMangoSalao**

Mango Hub es un sistema modular que integra múltiples servicios para la comunidad, incluyendo envío de audios (Mango Voice), donaciones, Discord, y gestión de gremio.

## 📋 Módulos

| Módulo | Descripción |
|--------|-------------|
| **Perfil** | Información y estadísticas personales del usuario |
| **Mango Voice** | Envío de audios al streamer (antes Voice Donations) |
| **Donaciones** | Sistema de donaciones vía PayPal |
| **Discord** | Enlace al Discord oficial de la comunidad |
| **Gremio Mango Born** | Solicitud de ingreso al gremio oficial |
| **Panel Streamer** | Administración completa del sistema (solo STREAMER) |

## 🎭 Roles

| Rol | Permisos |
|-----|----------|
| **FOLLOWER** | 1 Mango Voice/día, donaciones, Discord, solicitar gremio |
| **SUBSCRIBER** | Mango Voice ilimitados, donaciones, Discord, contacto directo, solicitar gremio |
| **STREAMER** | Acceso completo, administración, estadísticas |

## 🚀 Inicio rápido

1. Instalar dependencias:
```bash
npm install
```

2. Configurar variables de entorno en `.env`:
```
TWITCH_CLIENT_ID=tu_client_id
TWITCH_CLIENT_SECRET=tu_client_secret
SESSION_SECRET=tu_secret
BASE_URL=http://localhost:3000
```

3. Iniciar el servidor:
```bash
npm start
```

4. Abrir en el navegador:
```
http://localhost:3000
```

## 🏗️ Arquitectura

```
Mango Hub
├── server.js              # Punto de entrada principal
├── database.js            # Base de datos SQLite
├── modules/
│   ├── auth/              # Autenticación Twitch OAuth
│   ├── profile/           # Perfil de usuario
│   ├── mango-voice/       # Sistema de audios
│   ├── donations/         # Donaciones
│   ├── discord/           # Integración Discord
│   ├── guild/             # Gremio Mango Born
│   └── streamer-panel/    # Panel de administración
├── public/
│   ├── index.html         # Dashboard principal
│   ├── style.css          # Estilos globales
│   ├── modules/           # Páginas de cada módulo
│   └── recorder.js        # Grabador de audio
├── admin/                 # Panel del streamer
├── overlay/               # Overlay para OBS
└── uploads/               # Archivos de audio subidos
```

## 🔧 API Endpoints

### Autenticación
- `GET /auth/twitch` - Iniciar sesión con Twitch
- `GET /auth/twitch/callback` - Callback de Twitch OAuth
- `GET /auth/profile` - Obtener perfil del usuario autenticado
- `GET /auth/logout` - Cerrar sesión

### Mango Voice
- `POST /api/voice/upload` - Subir audio
- `GET /api/voice/queue` - Obtener cola de audios
- `GET /api/voice/next-audio` - Siguiente audio en cola
- `GET /api/voice/current-audio` - Audio reproduciéndose
- `POST /api/voice/mark-played/:id` - Marcar como reproducido
- `DELETE /api/voice/delete-audio/:id` - Eliminar audio
- `GET /api/voice/settings` - Obtener configuración
- `POST /api/voice/set-volume` - Actualizar volumen
- `GET /api/voice/stats` - Estadísticas

### Perfil
- `GET /api/profile/` - Perfil completo
- `GET /api/profile/stats` - Estadísticas personales

### Donaciones
- `POST /api/donations/` - Registrar donación
- `GET /api/donations/my` - Mis donaciones
- `GET /api/donations/recent` - Donaciones recientes

### Discord
- `GET /api/discord/invite` - Enlace de invitación
- `GET /api/discord/join` - Redirigir al Discord

### Gremio
- `POST /api/guild/request` - Solicitar ingreso
- `GET /api/guild/my-request` - Estado de solicitud
- `GET /api/guild/info` - Información del gremio

### Panel Streamer (solo STREAMER)
- `GET /api/streamer/stats` - Estadísticas completas
- `GET /api/streamer/users` - Lista de usuarios
- `POST /api/streamer/users/role` - Actualizar rol
- `GET /api/streamer/queue` - Cola completa
- `GET /api/streamer/donations` - Todas las donaciones
- `GET /api/streamer/guild-requests` - Solicitudes del gremio
- `POST /api/streamer/guild-requests/:id` - Aprobar/rechazar solicitud

## 📦 Tecnologías

- **Backend:** Node.js, Express, Passport.js
- **Autenticación:** Twitch OAuth (passport-twitch-new)
- **Base de datos:** SQLite3
- **Tiempo real:** Socket.IO
- **Frontend:** HTML, CSS, JavaScript vanilla