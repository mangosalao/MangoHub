const express = require("express");
const passport = require("passport");
const TwitchStrategy = require("passport-twitch-new").Strategy;
const UserService = require("../../services/userService");
const TwitchService = require("../../services/twitchService");
const { ROLES } = require("../../shared/roles");
const logger = require("../../services/logger");

const router = express.Router();

// ─── Configurar estrategia de Twitch ───
function configureAuth() {
    passport.use(
        new TwitchStrategy(
            {
                clientID: process.env.TWITCH_CLIENT_ID,
                clientSecret: process.env.TWITCH_CLIENT_SECRET,
                callbackURL: `${process.env.BASE_URL}/auth/twitch/callback`,
                scope: ["user:read:email"]
            },
            async (accessToken, refreshToken, profile, done) => {
                try {
                    const twitchId = profile.id;
                    const login = profile.login || "";

                    // 1. Buscar o crear usuario en la BD
                    const existingUser = await UserService.findByTwitchId(twitchId);

                    if (existingUser) {
                        await UserService.updateFromTwitch(twitchId, profile);
                    } else {
                        await UserService.createFromTwitch(profile);
                    }

                    // 2. Sincronizar con la API de Twitch (follow, sub, rol)
                    const syncedUser = await TwitchService.syncUser(accessToken, twitchId);

                    // Sesión mínima
                    return done(null, {
                        user_id: syncedUser.id,
                        twitch_id: syncedUser.twitch_id,
                        role: syncedUser.role
                    });

                } catch (err) {
                    logger.error("AUTH", "Error en autenticación: " + err.message);
                    if (err.status) logger.debug("AUTH", "Twitch status: " + err.status);
                    if (err.body) logger.debug("AUTH", "Twitch response: " + JSON.stringify(err.body));
                    return done(err);
                }
            }
        )
    );

    passport.serializeUser((user, done) => {
        try {
            logger.info("AUTH", "serializeUser llamado para user_id=" + user.user_id);
        } catch (e) {}
        done(null, {
            user_id: user.user_id,
            twitch_id: user.twitch_id,
            role: user.role
        });
    });

    passport.deserializeUser((user, done) => {
        try {
            logger.info("AUTH", "deserializeUser llamado para user_id=" + user.user_id);
        } catch (e) {}
        done(null, user);
    });
}

// ─── Middleware: verificar autenticación ───
function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) return next();
    res.status(401).json({ error: "No autenticado" });
}

// ─── Middleware: verificar que el usuario sigue al canal ───
async function requireFollower(req, res, next) {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "No autenticado" });
    }
    try {
        const user = await UserService.findByTwitchId(req.user.twitch_id);
        if (!user) {
            return res.status(403).json({ error: "Usuario no encontrado" });
        }
        // El broadcaster siempre tiene acceso
        if (user.login.toLowerCase() === "xmangosalao") {
            return next();
        }
        if (!user.is_follower) {
            return res.status(403).json({
                error: "Debes seguir el canal de xMangoSalao en Twitch para usar esta funcionalidad"
            });
        }
        next();
    } catch (err) {
        res.status(500).json({ error: "Error al verificar seguidor" });
    }
}

// ─── Middleware: verificar que el usuario es suscriptor ───
async function requireSubscriber(req, res, next) {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "No autenticado" });
    }
    try {
        const user = await UserService.findByTwitchId(req.user.twitch_id);
        if (!user) {
            return res.status(403).json({ error: "Usuario no encontrado" });
        }
        // El broadcaster siempre tiene acceso
        if (user.login.toLowerCase() === "xmangosalao") {
            return next();
        }
        if (!user.is_subscriber) {
            return res.status(403).json({
                error: "Esta funcionalidad es exclusiva para suscriptores"
            });
        }
        next();
    } catch (err) {
        res.status(500).json({ error: "Error al verificar suscriptor" });
    }
}

// ─── Middleware: verificar rol STREAMER ───
function requireStreamer(req, res, next) {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "No autenticado" });
    }
    if (req.user.role !== ROLES.STREAMER) {
        return res.status(403).json({ error: "Solo el streamer puede acceder a esta funcionalidad" });
    }
    next();
}

// ─── Middleware: verificar rol mínimo ───
function requireMinRole(minRole) {
    const { ROLE_HIERARCHY } = require("../../shared/roles");
    return (req, res, next) => {
        if (!req.isAuthenticated()) {
            return res.status(401).json({ error: "No autenticado" });
        }
        const userLevel = ROLE_HIERARCHY[req.user.role] ?? -1;
        const requiredLevel = ROLE_HIERARCHY[minRole] ?? 0;
        if (userLevel >= requiredLevel) return next();
        res.status(403).json({ error: "No tienes permisos suficientes" });
    };
}

// ─── Middleware: verificar roles específicos ───
function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.isAuthenticated()) {
            return res.status(401).json({ error: "No autenticado" });
        }
        if (roles.includes(req.user.role)) return next();
        res.status(403).json({ error: "No tienes permisos suficientes" });
    };
}

// ─── Rutas ───

router.get("/twitch", (req, res, next) => {
    logger.info("AUTH", "Inicio /auth/twitch");
    next();
}, passport.authenticate("twitch"));

router.get(
    "/twitch/callback",
    (req, res, next) => {
        logger.info("AUTH", "Inicio /auth/twitch/callback");
        next();
    },
    passport.authenticate("twitch", { failureRedirect: "/" }),
    (req, res) => {
        logger.info("AUTH", "Callback Twitch exitoso, usuario autenticado, redirigiendo a /");
        req.session.save((err) => {
            if (err) {
                logger.error("AUTH", "Error guardando sesión: " + err.message);
            }
            res.redirect("/");
        });
    }
);

// Obtener perfil del usuario autenticado
router.get("/profile", async (req, res) => {
    try {
        logger.info("AUTH", "/auth/profile llamada, isAuthenticated=" + req.isAuthenticated() + ", req.user=" + JSON.stringify(req.user));
    } catch (e) {}

    if (!req.isAuthenticated()) {
        return res.json({ logged: false });
    }

    try {
        logger.info("AUTH", "Antes de responder /api/me, twitch_id=" + req.user.twitch_id);
        const user = await UserService.getProfile(req.user.twitch_id);
        if (user) {
            logger.info("AUTH", "Respondiendo /api/me con usuario encontrado");
            res.json({ logged: true, user });
        } else {
            logger.info("AUTH", "Respondiendo /api/me con usuario mínimo");
            res.json({
                logged: true,
                user: {
                    id: req.user.user_id,
                    twitch_id: req.user.twitch_id,
                    login: "",
                    display_name: "Usuario",
                    avatar: "",
                    role: req.user.role,
                    is_follower: false,
                    is_subscriber: false,
                    subscriber_tier: null,
                    subscription_months: 0,
                    last_sync: null,
                    created_at: null,
                    last_login: null
                }
            });
        }
    } catch (err) {
        logger.error("AUTH", "Error en /auth/profile: " + err.message);
        res.status(500).json({ error: "Error al obtener perfil" });
    }
});

// Cerrar sesión
router.get("/logout", (req, res) => {
    req.logout(() => {
        res.redirect("/");
    });
});

module.exports = {
    router,
    configureAuth,
    ensureAuthenticated,
    requireRole,
    requireMinRole,
    requireFollower,
    requireSubscriber,
    requireStreamer
};