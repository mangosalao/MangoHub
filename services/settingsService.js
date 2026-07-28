// ============================================
// Mango Hub - Sistema Global de Configuración
// ============================================

const db = require("../database");
const logger = require("./logger");

// Cache en memoria
let cache = null;
let cacheInitialized = false;

const SettingsService = {

    DEFAULTS: {
        STREAMER_LOGIN: { value: "xmangosalao", description: "Login de Twitch del streamer" },
        STREAMER_DISPLAY_NAME: { value: "xMangoSalao", description: "Nombre visible del streamer" },
        DISCORD_INVITE_URL: { value: "https://discord.gg/xmangosalao", description: "Enlace de invitación al Discord" },
        PAYPAL_URL: { value: "https://www.paypal.com/ncp/payment/2B74NHVXMC694", description: "Enlace de donación PayPal" },
        MANGO_VOICE_DAILY_LIMIT_FOLLOWER: { value: "1", description: "Límite diario de Mango Voice para FOLLOWER" },
        MANGO_VOICE_DAILY_LIMIT_SUBSCRIBER: { value: "-1", description: "Límite diario de Mango Voice para SUBSCRIBER (-1 = ilimitado)" },
        MANGO_VOICE_MAX_SECONDS: { value: "30", description: "Duración máxima de cada audio en segundos" },
        GUILD_OPEN: { value: "true", description: "Si el gremio acepta solicitudes" },
        GUILD_NAME: { value: "Gremio Mango Born", description: "Nombre del gremio" },
        GUILD_GAME: { value: "Albion Online", description: "Juego del gremio" },
        ALLOW_FOLLOWERS: { value: "true", description: "Permitir acceso a seguidores" },
        ALLOW_SUBSCRIBERS: { value: "true", description: "Permitir acceso a suscriptores" },
        ALLOW_GUESTS: { value: "false", description: "Permitir acceso a invitados (no seguidores)" },
        MODULE_STATUS_MANGO_VOICE: { value: "available", description: "Estado del módulo Mango Voice: available, coming_soon, configuring, disabled" },
        MODULE_STATUS_DONATIONS: { value: "available", description: "Estado del módulo Donaciones" },
        MODULE_STATUS_DISCORD: { value: "available", description: "Estado del módulo Discord" },
        MODULE_STATUS_GUILD: { value: "available", description: "Estado del módulo Gremio" },
        MODULE_STATUS_SETTINGS: { value: "available", description: "Estado del módulo Configuración" },
        MODULE_STATUS_STREAMER_PANEL: { value: "available", description: "Estado del módulo Panel Streamer" },
        GUILD_INVITE_URL: { value: "https://discord.gg/xmangosalao", description: "URL de invitación al bot/gremio de Discord" },
        COMMUNITY_GOAL_TITLE: { value: "Meta de Micrófono Nuevo", description: "Título de la meta de la comunidad" },
        COMMUNITY_GOAL_TARGET: { value: "100.00", description: "Monto objetivo de la meta" },
        COMMUNITY_GOAL_CURRENT: { value: "0.00", description: "Monto actual recaudado" }
    },

    async initCache() {
        if (cacheInitialized) return cache;

        await this.loadDefaults();

        return new Promise((resolve, reject) => {
            db.all(`SELECT key, value, description FROM settings`, [], (err, rows) => {
                if (err) {
                    logger.error("SETTINGS", "Error en initCache: " + err.message);
                    return reject(err);
                }

                cache = {};
                rows.forEach(row => {
                    cache[row.key] = {
                        value: row.value,
                        description: row.description || ""
                    };
                });

                cacheInitialized = true;
                resolve(cache);
            });
        });
    },

    loadDefaults() {
        return new Promise((resolve, reject) => {
            const stmt = db.prepare(`
                INSERT OR IGNORE INTO settings (key, value, description)
                VALUES (?, ?, ?)
            `);

            let completed = 0;
            const entries = Object.entries(SettingsService.DEFAULTS);
            const total = entries.length;

            entries.forEach(([key, def]) => {
                stmt.run([key, def.value, def.description], function (err) {
                    if (err) {
                        logger.error("SETTINGS", `Error cargando default ${key}: ${err.message}`);
                        return reject(err);
                    }
                    completed++;
                    if (completed === total) {
                        stmt.finalize();
                        logger.info("SETTINGS", "Defaults cargados correctamente");
                        resolve();
                    }
                });
            });

            if (total === 0) {
                stmt.finalize();
                resolve();
            }
        });
    },

    async get(key) {
        if (!cacheInitialized) {
            await this.initCache();
        }

        if (cache && cache[key] !== undefined) {
            return cache[key].value;
        }

        return new Promise((resolve, reject) => {
            db.get(`SELECT value FROM settings WHERE key = ?`, [key], (err, row) => {
                if (err) {
                    logger.error("SETTINGS", `Error en get(${key}): ${err.message}`);
                    return reject(err);
                }
                resolve(row ? row.value : null);
            });
        });
    },

    async getAll() {
        if (!cacheInitialized) {
            await this.initCache();
        }

        if (cache) {
            return { ...cache };
        }

        return new Promise((resolve, reject) => {
            db.all(`SELECT key, value, description FROM settings`, [], (err, rows) => {
                if (err) {
                    logger.error("SETTINGS", "Error en getAll: " + err.message);
                    return reject(err);
                }
                const result = {};
                rows.forEach(row => {
                    result[row.key] = {
                        value: row.value,
                        description: row.description || ""
                    };
                });
                resolve(result);
            });
        });
    },

    async set(key, value) {
        return new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO settings (key, value, updated_at)
                VALUES (?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(key) DO UPDATE SET
                    value = excluded.value,
                    updated_at = CURRENT_TIMESTAMP
            `, [key, value], function (err) {
                if (err) {
                    logger.error("SETTINGS", `Error en set(${key}): ${err.message}`);
                    return reject(err);
                }

                if (cache) {
                    cache[key] = cache[key] || {};
                    cache[key].value = value;
                }

                logger.info("SETTINGS", `${key} = ${value}`);
                resolve();
            });
        });
    },

    async getBoolean(key) {
        const val = await this.get(key);
        return val === "true" || val === "1";
    },

    async getNumber(key) {
        const val = await this.get(key);
        const num = parseInt(val, 10);
        return isNaN(num) ? 0 : num;
    },

    invalidateCache() {
        cacheInitialized = false;
        cache = null;
        logger.debug("SETTINGS", "Cache invalidado");
    }
};

module.exports = SettingsService;