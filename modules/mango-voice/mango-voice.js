const express = require("express");
const path = require("path");
const multer = require("multer");
const fs = require("fs");
const db = require("../../database");
const { ensureAuthenticated } = require("../auth/auth");
const SettingsService = require("../../services/settingsService");
const logger = require("../../services/logger");

const router = express.Router();

// Configuración de almacenamiento para subida de audios
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, "uploads/"),
    filename: (req, file, cb) => cb(null, Date.now() + ".webm")
});

const upload = multer({ storage });

// Variable para el audio actual
let currentAudio = null;

// Configurar Socket.IO
function configureVoiceSocket(io) {
    io.on("connection", (socket) => {
        socket.on("audio-started", async (audio) => {
            let isAnonymous = false;
            if (audio && audio.id) {
                await new Promise((resolve) => {
                    db.get(`SELECT is_anonymous FROM audios WHERE id=?`, [audio.id], (err, row) => {
                        if (!err && row) isAnonymous = !!row.is_anonymous;
                        resolve();
                    });
                });
            }
            const socketData = {
                ...audio,
                username: isAnonymous ? "Anónimo" : (audio && audio.username),
                display_name: isAnonymous ? "Anónimo" : (audio && audio.display_name),
                is_anonymous: isAnonymous
            };
            currentAudio = socketData;
            io.emit("current-audio", currentAudio);
        });

        socket.on("audio-ended", () => {
            currentAudio = null;
            io.emit("current-audio", null);
        });

        socket.on("skip-audio", () => {
            io.emit("force-stop");
        });
    });
}

// Emitir actualización de la cola
function emitQueueUpdate(io) {
    io.emit("queue-updated");
}

// Emitir actualización de configuración
async function emitSettingsUpdate(io) {
    try {
        const volume = await SettingsService.get("volume");
        io.emit("settings-update", {
            volume: volume ? parseFloat(volume) : 1
        });
    } catch (err) {
        logger.error("VOICE", "Error en emitSettingsUpdate: " + err.message);
    }
}

// Obtener límite diario desde configuración
async function getDailyLimitFromSettings(role) {
    const followersLimit = await SettingsService.get("MANGO_VOICE_DAILY_LIMIT_FOLLOWER");
    const subscribersLimit = await SettingsService.get("MANGO_VOICE_DAILY_LIMIT_SUBSCRIBER");

    if (role === "SUBSCRIBER") {
        const limit = parseInt(subscribersLimit, 10);
        return limit === -1 ? Infinity : limit;
    }

    // FOLLOWER o cualquier otro rol
    return parseInt(followersLimit, 10) || 1;
}

// Verificar límite diario de Mango Voice
async function checkDailyLimit(req) {
    return new Promise((resolve, reject) => {
        const twitchId = req.user.twitch_id;
        const today = new Date().toISOString().split("T")[0];

        db.get(`SELECT role FROM users WHERE twitch_id = ?`, [twitchId], async (err, user) => {
            if (err || !user) {
                resolve({ allowed: false, reason: "Usuario no encontrado" });
                return;
            }

            const limit = await getDailyLimitFromSettings(user.role);

            // Si es ilimitado, permitir
            if (limit === Infinity) {
                resolve({ allowed: true });
                return;
            }

            // Verificar conteo del día
            db.get(`SELECT count FROM daily_voice_limits WHERE twitch_id = ? AND date = ?`, [twitchId, today], (err, row) => {
                if (err) {
                    resolve({ allowed: false, reason: "Error al verificar límite" });
                    return;
                }

                const currentCount = row ? row.count : 0;
                if (currentCount >= limit) {
                    resolve({ allowed: false, reason: `Límite diario alcanzado (${limit} por día)` });
                } else {
                    resolve({ allowed: true });
                }
            });
        });
    });
}

// Incrementar contador diario
function incrementDailyCount(twitchId) {
    const today = new Date().toISOString().split("T")[0];
    db.run(`
        INSERT INTO daily_voice_limits (twitch_id, date, count)
        VALUES (?, ?, 1)
        ON CONFLICT(twitch_id, date) DO UPDATE SET count = count + 1
    `, [twitchId, today]);
}

// ─── Rutas ───

// Subir audio (Mango Voice)
router.post("/upload", ensureAuthenticated, upload.single("audio"), async (req, res) => {
    const username = req.body.username;
    const isAnonymous = req.body.isAnonymous === "true" || req.body.isAnonymous === true || req.body.is_anonymous === "1" || req.body.is_anonymous === 1;
    const filename = req.file.filename;

    // Verificar límite diario
    const limitCheck = await checkDailyLimit(req);
    if (!limitCheck.allowed) {
        const filePath = path.join(__dirname, "../../uploads", filename);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        return res.status(429).json({ success: false, error: limitCheck.reason });
    }

    // REGLA BASTIÓN: Si es anónimo, guardar "Anónimo" directamente en la BD
    const displayNameToSave = isAnonymous ? "Anónimo" : username;
    const isAnonymousBit = isAnonymous ? 1 : 0;

    db.run(`
        INSERT INTO audios (username, filename, is_anonymous)
        VALUES (?, ?, ?)
    `, [displayNameToSave, filename, isAnonymousBit], function (err) {
        if (err) return res.status(500).json({ success: false });

        incrementDailyCount(req.user.twitch_id);

        res.json({ success: true, id: this.lastID, isAnonymous });
    });
});

// Obtener cola de audios pendientes
router.get("/queue", (req, res) => {
    db.all(`
        SELECT * FROM audios
        WHERE status='pending'
        ORDER BY id ASC
    `, [], (err, rows) => {
        if (err) return res.status(500).json([]);
        const sanitized = rows.map(r => ({
            ...r,
            username: r.is_anonymous ? "Anónimo" : r.username,
            display_name: r.is_anonymous ? "Anónimo" : r.username
        }));
        res.json(sanitized);
    });
});

// Obtener siguiente audio
router.get("/next-audio", (req, res) => {
    db.get(`
        SELECT * FROM audios
        WHERE status='pending'
        ORDER BY id ASC
        LIMIT 1
    `, [], (err, row) => {
        if (err) return res.status(500).json({ success: false });
        if (!row) return res.json(null);
        const sanitized = {
            ...row,
            username: row.is_anonymous ? "Anónimo" : row.username,
            display_name: row.is_anonymous ? "Anónimo" : row.username
        };
        res.json(sanitized);
    });
});

// Obtener audio actual
router.get("/current-audio", (req, res) => {
    if (!currentAudio) return res.json(null);
    const isAnonymous = !!currentAudio.is_anonymous;
    const sanitized = {
        ...currentAudio,
        username: isAnonymous ? "Anónimo" : currentAudio.username,
        display_name: isAnonymous ? "Anónimo" : currentAudio.display_name
    };
    res.json(sanitized);
});

// Marcar audio como reproducido
router.post("/mark-played/:id", (req, res) => {
    db.run(`
        UPDATE audios SET status='played'
        WHERE id=?
    `, [req.params.id], (err) => {
        if (err) return res.status(500).json({ success: false });
        try { io.emit("voice:status-changed", { id: req.params.id, status: "played" }); } catch (e) {}
        res.json({ success: true });
    });
});

// Eliminar audio (marcar como rechazado)
router.delete("/delete-audio/:id", (req, res) => {
    db.get(`SELECT * FROM audios WHERE id=?`, [req.params.id], (err, row) => {
        if (!row) return res.status(404).json({ success: false });

        const filePath = path.join(__dirname, "../../uploads", row.filename);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

        db.run(`UPDATE audios SET status='rejected' WHERE id=?`, [req.params.id], () => {
            try { io.emit("voice:status-changed", { id: req.params.id, status: "rejected" }); } catch (e) {}
            res.json({ success: true });
        });
    });
});

// Obtener configuración
router.get("/settings", async (req, res) => {
    try {
        const allSettings = await SettingsService.getAll();
        res.json(allSettings);
    } catch (err) {
        res.json({});
    }
});

// Actualizar volumen
router.post("/set-volume", express.json(), async (req, res) => {
    const volume = req.body.volume;
    await SettingsService.set("volume", volume);
    res.json({ success: true });
});

// Estadísticas de Mango Voice
router.get("/stats", (req, res) => {
    db.get(`
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) as pending,
            SUM(CASE WHEN status='played' THEN 1 ELSE 0 END) as played
        FROM audios
    `, [], (err, row) => {
        if (err) return res.status(500).json({ total: 0, pending: 0, played: 0 });
        res.json(row);
    });
});

// Obtener límite diario del usuario autenticado
router.get("/my-limit", ensureAuthenticated, async (req, res) => {
    const twitchId = req.user.twitch_id;
    const today = new Date().toISOString().split("T")[0];

    db.get(`SELECT role FROM users WHERE twitch_id = ?`, [twitchId], async (err, user) => {
        if (err || !user) {
            return res.json({ limit: 1, used: 0, remaining: 1 });
        }

        const limit = await getDailyLimitFromSettings(user.role);

        if (limit === Infinity) {
            return res.json({ limit: "ilimitado", used: 0, remaining: "ilimitado" });
        }

        db.get(`SELECT count FROM daily_voice_limits WHERE twitch_id = ? AND date = ?`, [twitchId, today], (err, row) => {
            if (err) {
                logger.error("VOICE", "Error en my-limit: " + err.message);
                return res.json({ limit: 1, used: 0, remaining: 1 });
            }
            const used = row ? row.count : 0;
            res.json({ limit, used, remaining: Math.max(0, limit - used) });
        });
    });
});

// Obtener historial de audios del usuario autenticado
router.get("/my-audios", ensureAuthenticated, (req, res) => {
    const username = req.user.display_name || req.user.login;
    db.all(`
        SELECT id, username, filename, status, is_anonymous, created_at
        FROM audios
        WHERE username = ?
        ORDER BY id DESC
    `, [username], (err, rows) => {
        if (err) {
            logger.error("VOICE", "Error en my-audios: " + err.message);
            return res.status(500).json({ error: "Error al obtener historial" });
        }
        res.json(rows || []);
    });
});

module.exports = { router, configureVoiceSocket, emitQueueUpdate, emitSettingsUpdate };