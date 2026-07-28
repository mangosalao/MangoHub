const express = require("express");
const { ensureAuthenticated } = require("../auth/auth");
const SettingsService = require("../../services/settingsService");

const router = express.Router();

// Obtener enlace de invitación al Discord
router.get("/invite", ensureAuthenticated, async (req, res) => {
    const inviteUrl = await SettingsService.get("DISCORD_INVITE_URL");
    res.json({
        invite_url: inviteUrl,
        message: "Únete al Discord oficial de la comunidad de xMangoSalao"
    });
});

// Redirigir al Discord
router.get("/join", ensureAuthenticated, async (req, res) => {
    const inviteUrl = await SettingsService.get("DISCORD_INVITE_URL");
    res.redirect(inviteUrl);
});

module.exports = router;