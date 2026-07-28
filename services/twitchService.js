// ============================================
// Mango Hub - Servicio de la API de Twitch
// ============================================

const UserService = require("./userService");
const SettingsService = require("./settingsService");
const { ROLES } = require("../shared/roles");
const logger = require("./logger");

const TWITCH_API_BASE = "https://api.twitch.tv/helix";
const CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;

let BROADCASTER_ID = null;

// ─── Helpers de logging ───
function logTwitchRequest(endpoint, status, body) {
    logger.debug("TWITCH", `${endpoint} | status=${status}`);
    if (body) {
        const safe = { ...body };
        if (safe.data && Array.isArray(safe.data)) {
            safe.data = safe.data.map(item => typeof item === "object" ? { ...item } : item);
        }
        logger.debug("TWITCH", JSON.stringify(safe, null, 2));
    }
}

function logTwitchError(context, err) {
    logger.error("TWITCH", `${context}: ${err.message}`);
    if (err.status) logger.debug("TWITCH", `Twitch status: ${err.status}`);
    if (err.url) logger.debug("TWITCH", `Twitch url: ${err.url}`);
    if (err.body) logger.debug("TWITCH", `Twitch response: ${JSON.stringify(err.body)}`);
}

// ─── Funciones internas ───

async function twitchFetch(path, accessToken) {
    const url = `${TWITCH_API_BASE}${path}`;
    const headers = {
        "Client-ID": CLIENT_ID,
        "Authorization": `Bearer ${accessToken}`
    };

    logger.debug("TWITCH", `GET ${url}`);
    logger.debug("TWITCH", `Client_ID existe: ${!!CLIENT_ID}`);
    logger.debug("TWITCH", `accessToken existe: ${!!accessToken}`);

    const res = await fetch(url, { headers });

    const status = res.status;
    let body = null;

    try {
        body = await res.json();
    } catch (e) {
        body = await res.text();
    }

    logTwitchRequest(url, status, body);

    if (!res.ok) {
        const err = new Error(`Twitch API error: ${status}`);
        err.status = status;
        err.url = url;
        err.body = body;
        throw err;
    }

    return body;
}

// ─── API Pública ───

const TwitchService = {

    /**
     * Obtiene el ID del broadcaster desde la API.
     */
    async getBroadcasterId() {
        if (BROADCASTER_ID) return BROADCASTER_ID;

        try {
            const data = await twitchFetch("/users?login=xmangosalao", null);
            if (!data.data || data.data.length === 0) {
                throw new Error("Broadcaster no encontrado");
            }
            BROADCASTER_ID = data.data[0].id;
            logger.info("TWITCH", "Broadcaster ID obtenido: " + BROADCASTER_ID);
            return BROADCASTER_ID;
        } catch (err) {
            logTwitchError("getBroadcasterId", err);
            throw err;
        }
    },

    /**
     * Obtiene un token de app access para llamadas internas.
     */
    async getAppAccessToken() {
        try {
            logger.debug("TWITCH", "Solicitando app access token...");
            const res = await fetch("https://id.twitch.tv/oauth2/token", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({
                    client_id: CLIENT_ID,
                    client_secret: CLIENT_SECRET,
                    grant_type: "client_credentials"
                })
            });

            const status = res.status;
            let body = null;

            try {
                body = await res.json();
            } catch (e) {
                body = await res.text();
            }

            logTwitchRequest("/oauth2/token", status, body);

            if (!res.ok) {
                const err = new Error(`Error al obtener app access token: ${status}`);
                err.status = status;
                err.body = body;
                throw err;
            }

            return body.access_token;
        } catch (err) {
            logTwitchError("getAppAccessToken", err);
            throw err;
        }
    },

    /**
     * Obtiene información del usuario autenticado.
     * Usa el User Access Token (NO el app access token).
     */
    async getUser(accessToken) {
        if (!accessToken) {
            throw new Error("getUser: accessToken es requerido");
        }

        try {
            const data = await twitchFetch("/users", accessToken);
            if (!data.data || data.data.length === 0) {
                logger.debug("TWITCH", "users endpoint devolvió data vacía");
                return null;
            }
            return data.data[0];
        } catch (err) {
            logTwitchError("getUser", err);
            throw err;
        }
    },

    /**
     * Verifica si un usuario sigue al broadcaster.
     */
    async getFollowerStatus(accessToken, userId) {
        try {
            const broadcasterId = await TwitchService.getBroadcasterId();
            const data = await twitchFetch(
                `/channels/followers?user_id=${userId}&broadcaster_id=${broadcasterId}`,
                accessToken
            );
            return data.data && data.data.length > 0;
        } catch (err) {
            logger.error("TWITCH", "Error en getFollowerStatus: " + err.message);
            return false;
        }
    },

    /**
     * Verifica si un usuario es suscriptor del broadcaster.
     */
    async getSubscriberStatus(accessToken, userId) {
        try {
            const broadcasterId = await TwitchService.getBroadcasterId();
            const data = await twitchFetch(
                `/subscriptions?user_id=${userId}&broadcaster_id=${broadcasterId}`,
                accessToken
            );
            if (data.data && data.data.length > 0) {
                const sub = data.data[0];
                return {
                    is_subscriber: true,
                    tier: sub.tier || "1000",
                    months: sub.cumulative_months || 0
                };
            }
            return null;
        } catch (err) {
            logger.error("TWITCH", "Error en getSubscriberStatus: " + err.message);
            return null;
        }
    },

    /**
     * Sincroniza completamente un usuario con la API de Twitch.
     */
    async syncUser(accessToken, twitchId) {
        if (!accessToken) {
            throw new Error("syncUser: accessToken es requerido");
        }

        const twitchUser = await TwitchService.getUser(accessToken);
        if (!twitchUser) {
            throw new Error("No se pudo obtener información del usuario desde Twitch");
        }

        const login = twitchUser.login || "";
        const streamerLogin = await SettingsService.get("STREAMER_LOGIN") || "xmangosalao";
        const isBroadcaster = login.toLowerCase() === streamerLogin.toLowerCase();

        let isFollower = false;
        let subscriberData = null;

        if (!isBroadcaster) {
            [isFollower, subscriberData] = await Promise.all([
                TwitchService.getFollowerStatus(accessToken, twitchId),
                TwitchService.getSubscriberStatus(accessToken, twitchId)
            ]);
        }

        let role;
        if (isBroadcaster) {
            role = ROLES.STREAMER;
        } else if (subscriberData && subscriberData.is_subscriber) {
            role = ROLES.SUBSCRIBER;
        } else if (isFollower) {
            role = ROLES.FOLLOWER;
        } else {
            role = ROLES.FOLLOWER;
        }

        await UserService.updateSyncData(twitchId, {
            is_follower: isFollower,
            is_subscriber: subscriberData ? subscriberData.is_subscriber : false,
            subscriber_tier: subscriberData ? subscriberData.tier : null,
            subscription_months: subscriberData ? subscriberData.months : 0,
            role,
            last_sync: new Date().toISOString()
        });

        return UserService.getProfile(twitchId);
    },

    async isFollowing(twitchId) {
        const user = await UserService.findByTwitchId(twitchId);
        return user ? !!user.is_follower : false;
    },

    async isSubscriber(twitchId) {
        const user = await UserService.findByTwitchId(twitchId);
        return user ? !!user.is_subscriber : false;
    }
};

module.exports = TwitchService;