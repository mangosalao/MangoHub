// ============================================
// Mango Hub - Roles y permisos centralizados
// ============================================

const ROLES = Object.freeze({
    FOLLOWER: "FOLLOWER",
    SUBSCRIBER: "SUBSCRIBER",
    STREAMER: "STREAMER"
});

const ROLE_HIERARCHY = Object.freeze({
    [ROLES.FOLLOWER]: 0,
    [ROLES.SUBSCRIBER]: 1,
    [ROLES.STREAMER]: 2
});

const PERMISSIONS = Object.freeze({
    // Módulos a los que cada rol puede acceder
    modules: {
        [ROLES.FOLLOWER]: ["profile", "mango-voice", "donations", "discord", "guild"],
        [ROLES.SUBSCRIBER]: ["profile", "mango-voice", "donations", "discord", "guild"],
        [ROLES.STREAMER]: ["profile", "mango-voice", "donations", "discord", "guild", "streamer-panel"]
    },
    // Límites de Mango Voice por día (valores por defecto)
    voiceDailyLimit: {
        [ROLES.FOLLOWER]: 1,
        [ROLES.SUBSCRIBER]: Infinity,
        [ROLES.STREAMER]: Infinity
    },
    // Permisos específicos
    canDonate: {
        [ROLES.FOLLOWER]: true,
        [ROLES.SUBSCRIBER]: true,
        [ROLES.STREAMER]: true
    },
    canJoinDiscord: {
        [ROLES.FOLLOWER]: true,
        [ROLES.SUBSCRIBER]: true,
        [ROLES.STREAMER]: true
    },
    canRequestGuild: {
        [ROLES.FOLLOWER]: true,
        [ROLES.SUBSCRIBER]: true,
        [ROLES.STREAMER]: true
    },
    canContactStreamer: {
        [ROLES.FOLLOWER]: false,
        [ROLES.SUBSCRIBER]: true,
        [ROLES.STREAMER]: true
    },
    canManageVoice: {
        [ROLES.FOLLOWER]: false,
        [ROLES.SUBSCRIBER]: false,
        [ROLES.STREAMER]: true
    },
    canManageUsers: {
        [ROLES.FOLLOWER]: false,
        [ROLES.SUBSCRIBER]: false,
        [ROLES.STREAMER]: true
    },
    canManageGuild: {
        [ROLES.FOLLOWER]: false,
        [ROLES.SUBSCRIBER]: false,
        [ROLES.STREAMER]: true
    },
    canViewStats: {
        [ROLES.FOLLOWER]: false,
        [ROLES.SUBSCRIBER]: false,
        [ROLES.STREAMER]: true
    },
    canViewDonations: {
        [ROLES.FOLLOWER]: false,
        [ROLES.SUBSCRIBER]: false,
        [ROLES.STREAMER]: true
    }
});

// Verificar si un rol tiene al menos cierto nivel
function hasMinRole(userRole, minRole) {
    const userLevel = ROLE_HIERARCHY[userRole] ?? -1;
    const requiredLevel = ROLE_HIERARCHY[minRole] ?? 0;
    return userLevel >= requiredLevel;
}

// Obtener los módulos disponibles para un rol
function getModulesForRole(role) {
    return PERMISSIONS.modules[role] ?? PERMISSIONS.modules[ROLES.FOLLOWER];
}

// Obtener el límite diario de Mango Voice (sincrónico, por defecto)
function getVoiceDailyLimit(role) {
    return PERMISSIONS.voiceDailyLimit[role] ?? PERMISSIONS.voiceDailyLimit[ROLES.FOLLOWER];
}

// Verificar un permiso específico
function hasPermission(role, permission) {
    const permSet = PERMISSIONS[permission];
    if (!permSet) return false;
    return permSet[role] ?? false;
}

async function getVoiceDailyLimitFromSettings(role) {
    const SettingsService = require("../services/settingsService");

    const followersLimit = await SettingsService.get("MANGO_VOICE_DAILY_LIMIT_FOLLOWER");
    const subscribersLimit = await SettingsService.get("MANGO_VOICE_DAILY_LIMIT_SUBSCRIBER");

    if (role === ROLES.SUBSCRIBER || role === ROLES.STREAMER) {
        const limit = parseInt(subscribersLimit, 10);
        if (limit === -1) return Infinity;
        if (!isNaN(limit)) return limit;
    }

    const fLimit = parseInt(followersLimit, 10);
    return isNaN(fLimit) ? 1 : fLimit;
}

module.exports = {
    ROLES,
    ROLE_HIERARCHY,
    PERMISSIONS,
    hasMinRole,
    getModulesForRole,
    getVoiceDailyLimit,
    getVoiceDailyLimitFromSettings,
    hasPermission
};
