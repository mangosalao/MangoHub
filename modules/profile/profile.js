const express = require("express");
const db = require("../../database");
const { ensureAuthenticated } = require("../auth/auth");

const router = express.Router();

// Obtener perfil completo del usuario autenticado
router.get("/", ensureAuthenticated, (req, res) => {
    const twitchId = req.user.id;

    db.get(`SELECT * FROM users WHERE twitch_id = ?`, [twitchId], (err, user) => {
        if (err || !user) {
            return res.json({
                twitch_id: twitchId,
                username: req.user.login || req.user.display_name,
                display_name: req.user.display_name,
                avatar_url: req.user.profile_image_url,
                role: "FOLLOWER"
            });
        }

        res.json({
            twitch_id: user.twitch_id,
            username: user.username,
            display_name: user.display_name,
            avatar_url: user.avatar_url,
            role: user.role,
            created_at: user.created_at,
            updated_at: user.updated_at
        });
    });
});

// Obtener estadísticas personales del usuario
router.get("/stats", ensureAuthenticated, (req, res) => {
    const username = req.user.display_name || req.user.login;

    db.get(`
        SELECT 
            (SELECT COUNT(*) FROM audios WHERE username = ?) as total_voices,
            (SELECT COUNT(*) FROM donations WHERE username = ?) as total_donations,
            (SELECT COALESCE(SUM(amount), 0) FROM donations WHERE username = ?) as total_donated
    `, [username, username, username], (err, row) => {
        if (err) return res.status(500).json({ total_voices: 0, total_donations: 0, total_donated: 0 });
        res.json(row);
    });
});

module.exports = router;