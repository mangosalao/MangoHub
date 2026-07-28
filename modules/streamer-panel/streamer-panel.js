const express = require("express");
const db = require("../../database");
const { ensureAuthenticated, requireMinRole } = require("../auth/auth");
const { ROLES } = require("../../shared/roles");

const router = express.Router();

// Middleware: solo STREAMER puede acceder
router.use(ensureAuthenticated);
router.use(requireMinRole(ROLES.STREAMER));

// Obtener todas las estadísticas del panel
router.get("/stats", (req, res) => {
    db.get(`
        SELECT 
            (SELECT COUNT(*) FROM audios) as total_audios,
            (SELECT COUNT(*) FROM audios WHERE status='pending') as pending_audios,
            (SELECT COUNT(*) FROM audios WHERE status='played') as played_audios,
            (SELECT COUNT(*) FROM users) as total_users,
            (SELECT COUNT(*) FROM users WHERE role='FOLLOWER') as followers,
            (SELECT COUNT(*) FROM users WHERE role='SUBSCRIBER') as subscribers,
            (SELECT COUNT(*) FROM users WHERE role='STREAMER') as streamers,
            (SELECT COUNT(*) FROM donations) as total_donations,
            (SELECT COALESCE(SUM(amount), 0) FROM donations) as total_donated,
            (SELECT COUNT(*) FROM guild_requests WHERE status='pending') as pending_guild_requests
    `, [], (err, row) => {
        if (err) return res.status(500).json({ error: "Error al obtener estadísticas" });
        res.json(row);
    });
});

// Obtener todos los usuarios
router.get("/users", (req, res) => {
    db.all(`SELECT * FROM users ORDER BY created_at DESC`, [], (err, rows) => {
        if (err) return res.status(500).json([]);
        res.json(rows);
    });
});

// Actualizar rol de un usuario
router.post("/users/role", express.json(), (req, res) => {
    const { twitchId, role } = req.body;
    if (![ROLES.FOLLOWER, ROLES.SUBSCRIBER, ROLES.STREAMER].includes(role)) {
        return res.status(400).json({ error: "Rol inválido" });
    }
    db.run(`UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE twitch_id = ?`, [role, twitchId], (err) => {
        if (err) return res.status(500).json({ error: "Error al actualizar rol" });
        res.json({ success: true });
    });
});

// Obtener cola completa de audios
router.get("/queue", (req, res) => {
    db.all(`SELECT * FROM audios ORDER BY id DESC`, [], (err, rows) => {
        if (err) return res.status(500).json([]);
        res.json(rows);
    });
});

// Obtener todas las donaciones
router.get("/donations", (req, res) => {
    db.all(`SELECT * FROM donations ORDER BY created_at DESC`, [], (err, rows) => {
        if (err) return res.status(500).json([]);
        res.json(rows);
    });
});

// Obtener solicitudes del gremio
router.get("/guild-requests", (req, res) => {
    db.all(`SELECT * FROM guild_requests ORDER BY created_at DESC`, [], (err, rows) => {
        if (err) return res.status(500).json([]);
        res.json(rows);
    });
});

// Aprobar/rechazar solicitud del gremio
router.post("/guild-requests/:id", express.json(), (req, res) => {
    const { status } = req.body;
    if (!["approved", "rejected"].includes(status)) {
        return res.status(400).json({ error: "Estado inválido" });
    }
    db.run(`UPDATE guild_requests SET status = ? WHERE id = ?`, [status, req.params.id], (err) => {
        if (err) return res.status(500).json({ error: "Error al actualizar solicitud" });
        res.json({ success: true });
    });
});

module.exports = router;