const express = require("express");
const SettingsService = require("../../services/settingsService");
const { ensureAuthenticated, requireStreamer } = require("../auth/auth");

const router = express.Router();

// GET /api/settings - Solo STREAMER
router.get("/", ensureAuthenticated, requireStreamer, async (req, res) => {
    try {
        const settings = await SettingsService.getAll();
        res.json(settings);
    } catch (err) {
        console.error("Error en GET /api/settings:", err);
        res.status(500).json({ error: "Error al obtener configuración" });
    }
});

// PUT /api/settings - Solo STREAMER
router.put("/", ensureAuthenticated, requireStreamer, express.json(), async (req, res) => {
    try {
        const { key, value } = req.body;
        
        if (!key) {
            return res.status(400).json({ error: "Falta el parámetro key" });
        }

        // Verificar si la clave existe en defaults
        const defaults = SettingsService.DEFAULTS;
        if (defaults[key]) {
            await SettingsService.set(key, value);
            res.json({ success: true, key, value });
        } else {
            res.status(400).json({ error: "Clave de configuración no válida" });
        }
    } catch (err) {
        console.error("Error en PUT /api/settings:", err);
        res.status(500).json({ error: "Error al guardar configuración" });
    }
});

module.exports = router;