// ============================================
// Mango Hub - Sistema de Logging
// ============================================

const fs = require("fs");
const path = require("path");

const LOG_DIR = path.join(__dirname, "..", "logs");
const ERROR_LOG = path.join(LOG_DIR, "error.log");
const APP_LOG = path.join(LOG_DIR, "app.log");

const LOG_LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
};

const CURRENT_LEVEL = (process.env.LOG_LEVEL || "info").toLowerCase();

const COLORS = {
    reset: "\x1b[0m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    red: "\x1b[31m",
    blue: "\x1b[36m",
    gray: "\x1b[90m"
};

// Asegurar que existe la carpeta logs
try {
    if (!fs.existsSync(LOG_DIR)) {
        fs.mkdirSync(LOG_DIR, { recursive: true });
    }
} catch (e) {
    // Si no se puede crear, seguir sin logs a archivo
}

function formatDate() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const hh = String(now.getHours()).padStart(2, "0");
    const mi = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

function writeToFile(filePath, message) {
    try {
        fs.appendFileSync(filePath, message + "\n");
    } catch (e) {
        // Silenciar errores de escritura
    }
}

function log(level, module, message) {
    const numericLevel = LOG_LEVELS[level];
    if (numericLevel === undefined) return;
    if (numericLevel < LOG_LEVELS[CURRENT_LEVEL]) return;

    const timestamp = formatDate();
    const formatted = `[${timestamp}]\n[${module}]\n[${level.toUpperCase()}]\n${message}\n`;

    // Consola con colores
    let color = COLORS.reset;
    if (level === "info") color = COLORS.green;
    else if (level === "warn") color = COLORS.yellow;
    else if (level === "error") color = COLORS.red;
    else if (level === "debug") color = COLORS.blue;

    console.log(`${color}${formatted}${COLORS.reset}`);

    // Archivos
    if (level === "error") {
        writeToFile(ERROR_LOG, formatted);
    }
    writeToFile(APP_LOG, formatted);
}

const logger = {
    info: (module, message) => log("info", module, message),
    warn: (module, message) => log("warn", module, message),
    error: (module, message) => log("error", module, message),
    debug: (module, message) => log("debug", module, message)
};

module.exports = logger;