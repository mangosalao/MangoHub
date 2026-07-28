const express = require("express");
const db = require("../../database");
const { ensureAuthenticated, requireStreamer } = require("../auth/auth");
const logger = require("../../services/logger");

const router = express.Router();

// GET /api/giveaways/active - Obtener sorteo activo y estado del usuario
router.get("/active", ensureAuthenticated, (req, res) => {
    db.get(`SELECT * FROM giveaways WHERE status='active' ORDER BY created_at DESC LIMIT 1`, [], (err, giveaway) => {
        if (err) {
            logger.error("GIVEAWAYS", "Error en active: " + err.message);
            return res.status(500).json({ error: "Error al obtener sorteo" });
        }
        if (!giveaway) {
            return res.json({ active: false });
        }

        const userId = req.user.user_id;
        db.get(`SELECT COUNT(*) as count FROM giveaway_entries WHERE giveaway_id=? AND user_id=?`, [giveaway.id, userId], (err2, row) => {
            const hasEntered = row ? row.count > 0 : false;

            db.all(`SELECT * FROM giveaways WHERE status='completed' ORDER BY created_at DESC`, [], (err3, pastWinners) => {
                res.json({
                    active: true,
                    giveaway: {
                        id: giveaway.id,
                        title: giveaway.title,
                        description: giveaway.description,
                        status: giveaway.status,
                        winner_name: giveaway.winner_name,
                        created_at: giveaway.created_at
                    },
                    has_entered: hasEntered,
                    past_winners: pastWinners || []
                });
            });
        });
    });
});

// POST /api/giveaways/enter - Participar en el sorteo activo (SUBSCRIBER y STREAMER)
router.post("/enter", ensureAuthenticated, (req, res) => {
    const role = req.user.role || "FOLLOWER";
    if (role !== "SUBSCRIBER" && role !== "STREAMER") {
        return res.status(403).json({ error: "Exclusivo para suscriptores" });
    }

    const userId = req.user.user_id;
    db.get(`SELECT id FROM giveaways WHERE status='active' ORDER BY created_at DESC LIMIT 1`, [], (err, giveaway) => {
        if (err) return res.status(500).json({ error: "Error al buscar sorteo" });
        if (!giveaway) return res.status(404).json({ error: "No hay sorteo activo" });

        db.run(`INSERT OR IGNORE INTO giveaway_entries (giveaway_id, user_id) VALUES (?, ?)`, [giveaway.id, userId], function(err2) {
            if (err2) {
                logger.error("GIVEAWAYS", "Error en enter: " + err2.message);
                return res.status(500).json({ error: "Error al participar" });
            }
            res.json({ success: true, giveaway_id: giveaway.id });
        });
    });
});

// POST /api/giveaways/create - Crear un nuevo sorteo (STREAMER)
router.post("/create", ensureAuthenticated, requireStreamer, express.json(), (req, res) => {
    const { title, description } = req.body;
    if (!title) return res.status(400).json({ error: "Título requerido" });

    db.run(`INSERT INTO giveaways (title, description, status) VALUES (?, ?, 'active')`, [title, description || ""], function(err) {
        if (err) {
            logger.error("GIVEAWAYS", "Error en create: " + err.message);
            return res.status(500).json({ error: "Error al crear sorteo" });
        }
        res.json({ success: true, id: this.lastID });
    });
});

// POST /api/giveaways/pick-winner - Elegir ganador aleatorio (STREAMER)
router.post("/pick-winner", ensureAuthenticated, requireStreamer, (req, res) => {
    db.get(`SELECT id FROM giveaways WHERE status='active' ORDER BY created_at DESC LIMIT 1`, [], (err, giveaway) => {
        if (err) return res.status(500).json({ error: "Error al buscar sorteo" });
        if (!giveaway) return res.status(404).json({ error: "No hay sorteo activo" });

        db.get(`SELECT user_id FROM giveaway_entries WHERE giveaway_id=? ORDER BY RANDOM() LIMIT 1`, [giveaway.id], (err2, entry) => {
            if (err2) {
                logger.error("GIVEAWAYS", "Error en pick-winner: " + err2.message);
                return res.status(404).json({ error: "No hay participantes" });
            }
            if (!entry) return res.status(404).json({ error: "No hay participantes" });

            db.get(`SELECT display_name FROM users WHERE id=?`, [entry.user_id], (err3, user) => {
                const winnerName = user ? user.display_name : "Usuario #" + entry.user_id;

                db.run(`UPDATE giveaways SET status='completed', winner_id=?, winner_name=? WHERE id=?`, [entry.user_id, winnerName, giveaway.id], (err4) => {
                    if (err4) {
                        logger.error("GIVEAWAYS", "Error al marcar ganador: " + err4.message);
                        return res.status(500).json({ error: "Error al marcar ganador" });
                    }
                    res.json({ success: true, winner_name: winnerName, giveaway_id: giveaway.id });
                });
            });
        });
    });
});

// GET /api/giveaways/count - Contar participantes del sorteo activo
router.get("/count", ensureAuthenticated, (req, res) => {
    db.get(`SELECT id FROM giveaways WHERE status='active' ORDER BY created_at DESC LIMIT 1`, [], (err, giveaway) => {
        if (err) return res.status(500).json({ count: 0 });
        if (!giveaway) return res.json({ count: 0 });

        db.get(`SELECT COUNT(*) as count FROM giveaway_entries WHERE giveaway_id=?`, [giveaway.id], (err2, row) => {
            res.json({ count: row ? row.count : 0 });
        });
    });
});

module.exports = router;
