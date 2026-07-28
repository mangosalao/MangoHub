const express = require("express");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
const session = require("express-session");
const passport = require("passport");
const db = require("./database");
const UserService = require("./services/userService");

// Cargar variables de entorno
require("dotenv").config();

// Módulos
const authModule = require("./modules/auth/auth");
const mangoVoice = require("./modules/mango-voice/mango-voice");
const profileModule = require("./modules/profile/profile");
const donationsModule = require("./modules/donations/donations");
const discordModule = require("./modules/discord/discord");
const guildModule = require("./modules/guild/guild");
const streamerPanel = require("./modules/streamer-panel/streamer-panel");
const settingsModule = require("./modules/settings/settings");
const giveawaysModule = require("./modules/giveaways/giveaways");

const logger = require("./services/logger");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// ─── Configuración de sesión y passport ───
app.use(
    session({
        secret: process.env.SESSION_SECRET || "mangohub-secret",
        resave: false,
        saveUninitialized: false
    })
);

// Configurar autenticación Twitch ANTES de inicializar passport
authModule.configureAuth();
logger.info("SERVER", "Estrategias de autenticación configuradas");

app.use(passport.initialize());
logger.info("SERVER", "passport.initialize() ejecutado");
app.use(passport.session());
logger.info("SERVER", "passport.session() ejecutado");

// ─── Archivos estáticos ───
app.use(express.static("public"));
app.use("/admin", express.static("admin"));
app.use("/overlay", express.static("overlay"));
app.use("/uploads", express.static("uploads"));

// ─── Parseo de JSON ───
app.use(express.json());

// ─── Rutas de autenticación ───
app.use("/auth", authModule.router);

// ─── GET /api/me - Perfil del usuario autenticado ───
app.get("/api/me", authModule.ensureAuthenticated, async (req, res) => {
    try {
        const user = await UserService.getProfile(req.user.twitch_id);
        if (!user) {
            return res.status(404).json({ error: "Usuario no encontrado" });
        }
        res.json(user);
    } catch (err) {
        logger.error("SERVER", "Error en /api/me: " + err.message);
        res.status(500).json({ error: "Error al obtener perfil" });
    }
});

// ─── Rutas de perfil ───
app.use("/api/profile", profileModule);

// ─── Rutas de Mango Voice ───
app.use("/api/voice", mangoVoice.router);

// ─── Rutas de donaciones ───
app.use("/api/donations", donationsModule);

// ─── Rutas de Discord ───
app.use("/api/discord", discordModule);

// ─── Rutas del gremio ───
app.use("/api/guild", guildModule);

// ─── Rutas del panel de streamer ───
app.use("/api/streamer", streamerPanel);

// ─── Rutas de configuración ───
app.use("/api/settings", settingsModule);

// ─── Rutas de sorteos ───
app.use("/api/giveaways", giveawaysModule);

// ─── SPA: servir index.html para todas las rutas del frontend ───
app.use((req, res, next) => {
    if (req.path.startsWith("/api/") || req.path.startsWith("/auth/") || req.path.startsWith("/admin/") || req.path.startsWith("/overlay/") || req.path.startsWith("/uploads/") || req.path.startsWith("/socket.io/") || req.path === "/favicon.ico") {
        return next();
    }
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ─── Configurar Socket.IO para Mango Voice ───
mangoVoice.configureVoiceSocket(io);

// Middleware para emitir eventos después de acciones específicas
app.use((req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = function (body) {
        if (req.path.startsWith("/api/voice/upload") && req.method === "POST") {
            mangoVoice.emitQueueUpdate(io);
        }
        if (req.path.startsWith("/api/voice/delete") && req.method === "DELETE") {
            mangoVoice.emitQueueUpdate(io);
        }
        if (req.path.startsWith("/api/voice/mark-played") && req.method === "POST") {
            mangoVoice.emitQueueUpdate(io);
        }
        if (req.path.startsWith("/api/voice/set-volume")) {
            mangoVoice.emitSettingsUpdate(io);
        }
        return originalJson(body);
    };
    next();
});

// ─── Iniciar servidor ───
server.listen(PORT, () => {
    logger.info("SERVER", `Mango Hub iniciado en http://localhost:${PORT}`);
    logger.info("SERVER", `Panel del streamer: http://localhost:${PORT}/admin/admin.html`);
});

server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
        logger.error("SERVER", `Puerto ${PORT} en uso. Mango Hub ya está ejecutándose.`);
        process.exit(1);
    } else {
        logger.error("SERVER", "Error al iniciar servidor: " + err.message);
        logger.error("SERVER", err.stack);
        process.exit(1);
    }
});
