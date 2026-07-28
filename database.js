const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("mangohub.db");

db.serialize(() => {

    // Tabla de usuarios
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            twitch_id TEXT NOT NULL UNIQUE,
            login TEXT NOT NULL,
            display_name TEXT,
            email TEXT DEFAULT '',
            avatar TEXT DEFAULT '',
            role TEXT DEFAULT 'FOLLOWER',
            is_follower INTEGER DEFAULT 0,
            is_subscriber INTEGER DEFAULT 0,
            subscriber_tier TEXT,
            subscription_months INTEGER DEFAULT 0,
            last_sync DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_login DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Tabla de configuración global
    db.run(`
        CREATE TABLE IF NOT EXISTS settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key TEXT NOT NULL UNIQUE,
            value TEXT NOT NULL,
            description TEXT DEFAULT '',
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Migrar tablas antiguas si existen con esquema viejo
    // Añadir description si no existe
    db.all(`PRAGMA table_info(settings)`, [], (err, cols) => {
        if (err) return;
        const hasDescription = cols.some(c => c.name === "description");
        const hasUpdatedAt = cols.some(c => c.name === "updated_at");

        if (!hasDescription) {
            db.run(`ALTER TABLE settings ADD COLUMN description TEXT DEFAULT ''`, () => {});
        }
        if (!hasUpdatedAt) {
            db.run(`ALTER TABLE settings ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP`, () => {});
        }
    });

    // Tabla de audios (Mango Voice)
    db.run(`
        CREATE TABLE IF NOT EXISTS audios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            filename TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            is_anonymous INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Migrar audios antiguas para agregar is_anonymous si falta
    db.all(`PRAGMA table_info(audios)`, [], (err, cols) => {
        if (err) return;
        const hasIsAnonymous = cols.some(c => c.name === "is_anonymous");
        if (!hasIsAnonymous) {
            db.run(`ALTER TABLE audios ADD COLUMN is_anonymous INTEGER DEFAULT 0`, () => {});
        }
    });

    // Tabla de donaciones
    db.run(`
        CREATE TABLE IF NOT EXISTS donations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            donor_name TEXT,
            amount REAL NOT NULL,
            message TEXT,
            status TEXT DEFAULT 'completed',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Migrar tabla donations para agregar user_id y donor_name si faltan
    db.all(`PRAGMA table_info(donations)`, [], (err, cols) => {
        if (err) return;
        const colNames = cols.map(c => c.name);
        if (!colNames.includes("user_id")) {
            db.run(`ALTER TABLE donations ADD COLUMN user_id INTEGER`, () => {});
        }
        if (!colNames.includes("donor_name")) {
            db.run(`ALTER TABLE donations ADD COLUMN donor_name TEXT`, () => {});
        }
    });

    // Insertar configuraciones por defecto si no existen
    const defaultSettings = [
        ["GUILD_INVITE_URL", "https://discord.gg/xmangosalao", "URL de invitación al bot/gremio de Discord"],
        ["COMMUNITY_GOAL_TITLE", "Meta de Micrófono Nuevo", "Título de la meta de la comunidad"],
        ["COMMUNITY_GOAL_TARGET", "100.00", "Monto objetivo de la meta"],
        ["COMMUNITY_GOAL_CURRENT", "0.00", "Monto actual recaudado"]
    ];
    defaultSettings.forEach(([key, value, desc]) => {
        db.run(`INSERT OR IGNORE INTO settings (key, value, description) VALUES (?, ?, ?)`, [key, value, desc], () => {});
    });

    // Tabla de solicitudes al gremio
    db.run(`
        CREATE TABLE IF NOT EXISTS guild_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            twitch_id TEXT NOT NULL,
            message TEXT,
            status TEXT DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Tabla de límites diarios de Mango Voice
    db.run(`
        CREATE TABLE IF NOT EXISTS daily_voice_limits (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            twitch_id TEXT NOT NULL,
            date TEXT NOT NULL,
            count INTEGER DEFAULT 0,
            UNIQUE(twitch_id, date)
        )
    `);

    // Tabla de sorteos mensuales
    db.run(`
        CREATE TABLE IF NOT EXISTS giveaways (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            status TEXT DEFAULT 'active',
            winner_id INTEGER,
            winner_name TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Tabla de participaciones en sorteos
    db.run(`
        CREATE TABLE IF NOT EXISTS giveaway_entries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            giveaway_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(giveaway_id, user_id)
        )
    `);

});

module.exports = db;