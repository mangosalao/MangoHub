const express = require("express");
const db = require("../../database");
const { ensureAuthenticated } = require("../auth/auth");
const SettingsService = require("../../services/settingsService");
const logger = require("../../services/logger");

const router = express.Router();

router.post("/", ensureAuthenticated, express.json(), (req, res) => {
    const username = req.user.display_name || req.user.login;
    const { amount, message } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: "Monto invalido" });
    db.run("INSERT INTO donations (username, amount, message) VALUES (?, ?, ?)", [username, amount, message || null], function(err) {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true, id: this.lastID });
    });
});

router.get("/my", ensureAuthenticated, (req, res) => {
    const username = req.user.display_name || req.user.login;
    db.all("SELECT * FROM donations WHERE username = ? ORDER BY created_at DESC", [username], (err, rows) => {
        if (err) return res.status(500).json([]);
        res.json(rows);
    });
});

router.get("/recent", (req, res) => {
    db.all("SELECT id, username, donor_name, amount, message, created_at FROM donations WHERE status='completed' ORDER BY created_at DESC LIMIT 10", [], (err, rows) => {
        if (err) return res.status(500).json([]);
        res.json(rows);
    });
});

router.get("/goal", async (req, res) => {
    try {
        const title = await SettingsService.get("COMMUNITY_GOAL_TITLE") || "Meta de la Comunidad";
        const target = parseFloat(await SettingsService.get("COMMUNITY_GOAL_TARGET") || "100");
        const current = parseFloat(await SettingsService.get("COMMUNITY_GOAL_CURRENT") || "0");
        const percentage = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
        res.json({ title, target, current, percentage });
    } catch (err) {
        logger.error("DONATIONS", "Error en goal: " + err.message);
        res.json({ title: "Meta de la Comunidad", target: 100, current: 0, percentage: 0 });
    }
});

router.post("/webhook", express.json(), (req, res) => {
    const { donor_name, amount, message } = req.body;
    db.run("INSERT INTO donations (donor_name, amount, message) VALUES (?, ?, ?)", [donor_name || "Anonimo", parseFloat(amount), message || null], function(err) {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true, id: this.lastID });
    });
});

module.exports = router;