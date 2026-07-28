// ============================================
// Mango Hub - Servicio de Usuarios
// Toda la lógica de acceso a usuarios debe
// pasar por este servicio.
// ============================================

const db = require("../database");
const SettingsService = require("./settingsService");
const { ROLES } = require("../shared/roles");

const UserService = {

    /**
     * Obtiene el login del streamer desde configuración.
     * @returns {Promise<string>}
     */
    async getStreamerLogin() {
        return await SettingsService.get("STREAMER_LOGIN") || "xmangosalao";
    },

    /**
     * Busca un usuario por su twitch_id.
     * @param {string} twitchId
     * @returns {Promise<object|null>}
     */
    findByTwitchId(twitchId) {
        return new Promise((resolve, reject) => {
            db.get(`SELECT * FROM users WHERE twitch_id = ?`, [twitchId], (err, row) => {
                if (err) return reject(err);
                resolve(row || null);
            });
        });
    },

    /**
     * Crea un nuevo usuario a partir del perfil de Twitch.
     * @param {object} profile - Perfil devuelto por Twitch
     * @returns {Promise<object>} Usuario creado
     */
    async createFromTwitch(profile) {
        const twitchId = profile.id;
        const login = profile.login || "";
        const displayName = profile.display_name || login;
        const email = profile.email || "";
        const avatar = profile.profile_image_url || "";

        // Asignar STREAMER si es el broadcaster, sino FOLLOWER
        const streamerLogin = await UserService.getStreamerLogin();
        const role = login.toLowerCase() === streamerLogin.toLowerCase()
            ? ROLES.STREAMER
            : ROLES.FOLLOWER;

        return new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO users (twitch_id, login, display_name, email, avatar, role, last_login)
                VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `, [twitchId, login, displayName, email, avatar, role], function (err) {
                if (err) return reject(err);

                resolve({
                    id: this.lastID,
                    twitch_id: twitchId,
                    login,
                    display_name: displayName,
                    email,
                    avatar,
                    role,
                    is_follower: 0,
                    is_subscriber: 0,
                    subscriber_tier: null,
                    subscription_months: 0,
                    last_sync: null,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    last_login: new Date().toISOString()
                });
            });
        });
    },

    /**
     * Actualiza un usuario existente con datos de Twitch.
     * @param {string} twitchId
     * @param {object} profile - Perfil devuelto por Twitch
     * @returns {Promise<void>}
     */
    updateFromTwitch(twitchId, profile) {
        return new Promise((resolve, reject) => {
            const login = profile.login || "";
            const displayName = profile.display_name || login;
            const email = profile.email || "";
            const avatar = profile.profile_image_url || "";

            db.run(`
                UPDATE users
                SET login = ?,
                    display_name = ?,
                    email = ?,
                    avatar = ?,
                    last_login = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE twitch_id = ?
            `, [login, displayName, email, avatar, twitchId], function (err) {
                if (err) return reject(err);
                resolve();
            });
        });
    },

    /**
     * Actualiza los datos de sincronización con Twitch.
     * @param {string} twitchId
     * @param {object} data - { is_follower, is_subscriber, subscriber_tier, subscription_months, role, last_sync }
     * @returns {Promise<void>}
     */
    updateSyncData(twitchId, data) {
        return new Promise((resolve, reject) => {
            db.run(`
                UPDATE users
                SET is_follower = ?,
                    is_subscriber = ?,
                    subscriber_tier = ?,
                    subscription_months = ?,
                    role = ?,
                    last_sync = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE twitch_id = ?
            `, [
                data.is_follower ? 1 : 0,
                data.is_subscriber ? 1 : 0,
                data.subscriber_tier || null,
                data.subscription_months || 0,
                data.role,
                data.last_sync,
                twitchId
            ], function (err) {
                if (err) return reject(err);
                resolve();
            });
        });
    },

    /**
     * Obtiene el perfil público de un usuario (para /api/me).
     * @param {string} twitchId
     * @returns {Promise<object|null>}
     */
    getProfile(twitchId) {
        return new Promise((resolve, reject) => {
            db.get(`
                SELECT id, twitch_id, login, display_name, avatar, role,
                       is_follower, is_subscriber, subscriber_tier, subscription_months,
                       last_sync, created_at, last_login
                FROM users
                WHERE twitch_id = ?
            `, [twitchId], (err, row) => {
                if (err) return reject(err);
                if (!row) return resolve(null);

                // Convertir booleanos
                resolve({
                    ...row,
                    is_follower: !!row.is_follower,
                    is_subscriber: !!row.is_subscriber
                });
            });
        });
    },

    /**
     * Obtiene el rol de un usuario.
     * @param {string} twitchId
     * @returns {Promise<string>}
     */
    getRole(twitchId) {
        return new Promise((resolve, reject) => {
            db.get(`SELECT role FROM users WHERE twitch_id = ?`, [twitchId], (err, row) => {
                if (err) return reject(err);
                resolve(row ? row.role : ROLES.FOLLOWER);
            });
        });
    },

    /**
     * Actualiza el rol de un usuario.
     * @param {string} twitchId
     * @param {string} role
     * @returns {Promise<void>}
     */
    updateRole(twitchId, role) {
        return new Promise((resolve, reject) => {
            db.run(`
                UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP
                WHERE twitch_id = ?
            `, [role, twitchId], function (err) {
                if (err) return reject(err);
                resolve();
            });
        });
    },

    /**
     * Obtiene todos los usuarios.
     * @returns {Promise<Array>}
     */
    findAll() {
        return new Promise((resolve, reject) => {
            db.all(`SELECT * FROM users ORDER BY created_at DESC`, [], (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            });
        });
    }
};

module.exports = UserService;