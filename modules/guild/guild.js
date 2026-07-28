const express = require("express");
const db = require("../../database");
const { ensureAuthenticated } = require("../auth/auth");

const router = express.Router();

// Enviar solicitud para unirse al gremio
router.post("/request", ensureAuthenticated, express.json(), (req, res) => {
    const twitchId = req.user.id;
    const username = req.user.display_name || req.user.login;
    const { message } = req.body;

    // Verificar si ya existe una solicitud pendiente
    db.get(`SELECT * FROM guild_requests WHERE twitch_id = ? AND status = 'pending'`, [twitchId], (err, existing) => {
        if (err) return res.status(500).json({ error: "Error al procesar solicitud" });
        if (existing) {
            return res.status(400).json({ error: "Ya tienes una solicitud pendiente" });
        }

        db.run(`
            INSERT INTO guild_requests (username, twitch_id, message)
            VALUES (?, ?, ?)
        `, [username, twitchId, message || null], function (err) {
            if (err) return res.status(500).json({ success: false });
            res.json({ success: true, id: this.lastID });
        });
    });
});

// Obtener estado de la solicitud del usuario
router.get("/my-request", ensureAuthenticated, (req, res) => {
    const twitchId = req.user.id;
    db.get(`SELECT * FROM guild_requests WHERE twitch_id = ? ORDER BY created_at DESC LIMIT 1`, [twitchId], (err, row) => {
        if (err) return res.status(500).json(null);
        res.json(row || { status: "none" });
    });
});

// Información del gremio
router.get("/info", (req, res) => {
    res.json({
        name: "Gremio Mango Born",
        description: "El gremio oficial de la comunidad de xMangoSalao",
        game: "Albion Online",
        requirements: "Ser parte activa de la comunidad"
    });
});

module.exports = router;