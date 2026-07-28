// ============================================
// Mango Hub - SPA Router & Module Loader
// ============================================

// Components are loaded via script tags in index.html and exposed as window.Components and window.getIcon

const MangoHub = (function () {
    let currentUser = null;
    let currentModule = "dashboard";
    let mediaRecorder = null;
    let audioChunks = [];
    let audioBlob = null;
    let countdownInterval = null;
    let secondsRemaining = 30;
    let socket = null;

    const MODULES = {
        profile: {
            label: "Perfil",
            icon: "👤",
            render: renderProfile
        },
        "mango-voice": {
            label: "Mango Voice",
            icon: "🎤",
            render: renderMangoVoice
        },
        donations: {
            label: "Donaciones",
            icon: "💵",
            render: renderDonations
        },
        discord: {
            label: "Discord",
            icon: "💬",
            render: renderDiscord
        },
        guild: {
            label: "Gremio",
            icon: "⚔️",
            render: renderGuild
        },
        settings: {
            label: "Configuración",
            icon: "🛠",
            render: renderSettings,
            requiredRole: "STREAMER"
        },
        "streamer-panel": {
            label: "Panel Streamer",
            icon: "📊",
            render: renderStreamerPanel,
            requiredRole: "STREAMER"
        }
    };

    async function init() {
        const logged = await checkAuth();
        if (!logged) return;

        socket = io();

        window.addEventListener("popstate", handleNavigation);

        document.querySelectorAll(".nav-link").forEach(link => {
            link.addEventListener("click", function (e) {
                e.preventDefault();
                navigateTo(this.dataset.module);
            });
        });

        // Socket.io: actualizar historial de audios en tiempo real
        if (socket) {
            socket.on("voice:status-changed", () => {
                if (currentModule === "mango-voice") {
                    loadMyAudios();
                }
            });
        }

        const initialModule = getInitialModule();
        navigateTo(initialModule, false);
    }

    async function checkAuth() {
        try {
            // Primero verificar si hay sesión
            const authRes = await fetch("/auth/profile");
            const authData = await authRes.json();
            if (!authData.logged) {
                showLogin();
                return false;
            }

            // Obtener perfil completo desde /api/me
            const meRes = await fetch("/api/me");
            if (!meRes.ok) {
                showLogin();
                return false;
            }
            currentUser = await meRes.json();

            showApp();
            updateHeader();
            updateSidebar();
            return true;
        } catch (err) {
            console.error("Error de autenticación:", err);
            showLogin();
            return false;
        }
    }

    function showLogin() {
        document.getElementById("appShell").style.display = "none";
        document.getElementById("loginScreen").style.display = "flex";
    }

    function showApp() {
        document.getElementById("loginScreen").style.display = "none";
        document.getElementById("appShell").style.display = "flex";
    }

    function updateHeader() {
        document.getElementById("userAvatar").src = currentUser.avatar || "";
        document.getElementById("userName").textContent = currentUser.display_name || currentUser.login || "Usuario";
        document.getElementById("userRole").textContent = currentUser.role || "FOLLOWER";
    }

    function updateSidebar() {
        const role = currentUser.role || "FOLLOWER";
        document.querySelectorAll(".nav-link").forEach(link => {
            const requiredRole = link.dataset.requiredRole;
            link.style.display = (requiredRole && requiredRole !== role) ? "none" : "";
        });
    }

    function getInitialModule() {
        const hash = window.location.hash.slice(1);
        if (hash && MODULES[hash]) return hash;
        return "dashboard";
    }

    function navigateTo(module, pushState = true) {
        if (module === "dashboard") {
            if (pushState) history.pushState(null, "", "/");
            currentModule = "dashboard";
            renderDashboard();
            updateActiveNav(null);
            return;
        }

        if (!MODULES[module]) {
            navigateTo("dashboard");
            return;
        }

        if (MODULES[module].requiredRole) {
            const role = currentUser.role || "";
            if (role !== MODULES[module].requiredRole) {
                renderDashboard();
                return;
            }
        }

        if (pushState) history.pushState(null, "", `#${module}`);
        currentModule = module;
        MODULES[module].render();
        updateActiveNav(module);
    }

    function handleNavigation() {
        navigateTo(getInitialModule(), false);
    }

    function updateActiveNav(activeModule) {
        document.querySelectorAll(".nav-link").forEach(link => {
            link.classList.toggle("active", link.dataset.module === activeModule);
        });
    }

    function formatDate(dateStr) {
        if (!dateStr) return "—";
        const d = new Date(dateStr);
        return d.toLocaleDateString("es-CL", {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
    }

    // ─── Dashboard ───
    async function renderDashboard() {
        const content = document.getElementById("mainContent");
        const role = currentUser.role || "FOLLOWER";

        let modulesHtml = "";

        let moduleStatuses = {};
        try {
            const res = await fetch("/api/settings");
            const settings = await res.json();
            Object.keys(settings).forEach(key => {
                if (key.startsWith("MODULE_STATUS_")) {
                    const modKey = key.replace("MODULE_STATUS_", "").replace(/_/g, "-").toLowerCase();
                    moduleStatuses[modKey] = settings[key].value;
                }
            });
        } catch (e) { console.error(e); }

        const getModuleKey = (label) => {
            const map = {
                "Perfil": "profile",
                "Mango Voice": "mango-voice",
                "Donaciones": "donations",
                "Discord": "discord",
                "Gremio": "guild",
                "Configuración": "settings",
                "Panel Streamer": "streamer-panel"
            };
            return map[label] || null;
        };

        const statusLabels = {
            available: { text: "Disponible", class: "badge-success" },
            coming_soon: { text: "Próximamente", class: "badge-warning" },
            configuring: { text: "Configurando", class: "badge-info" },
            disabled: { text: "Deshabilitado", class: "badge-danger" }
        };

        let moduleIndex = 0;

        Object.entries(MODULES).forEach(([key, mod]) => {
            if (mod.requiredRole && mod.requiredRole !== role) return;

            const modKey = getModuleKey(mod.label);
            const status = moduleStatuses[modKey] || "available";
            const statusInfo = statusLabels[status] || statusLabels.available;
            const isClickable = status === "available";
            const currentIndex = moduleIndex;
            moduleIndex++;

            modulesHtml += `
                <div class="dash-card ${isClickable ? '' : 'disabled-card'}" 
                     ${isClickable ? `onclick="MangoHub.navigateTo('${key}')"` : ''}
                     style="animation: fadeIn 0.3s ease ${currentIndex * 0.1}s both;">
                    <div class="dash-card-icon">${mod.icon}</div>
                    <h3>${mod.label}</h3>
                    <p>${getModuleDescription(key)}</p>
                    <div style="margin-top:10px;">
                        <span class="badge ${statusInfo.class}">${statusInfo.text}</span>
                    </div>
                </div>
            `;
        });

        if (role === "SUBSCRIBER") {
            const currentIndex = moduleIndex;
            moduleIndex++;
            modulesHtml += `
                <div class="dash-card disabled-card" 
                     style="animation: fadeIn 0.3s ease ${currentIndex * 0.1}s both;">
                    <div class="dash-card-icon">💌</div>
                    <h3>Contactar al streamer</h3>
                    <p>Envía un mensaje directo al streamer</p>
                    <div style="margin-top:10px;">
                        <span class="badge badge-info">Próximamente</span>
                    </div>
                </div>
            `;
        }

        content.innerHTML = `
            <div class="dashboard-page">
                <div class="welcome-banner">
                    <h2>
                        🥭 Hola, ${currentUser.display_name || currentUser.login || "Usuario"}
                    </h2>
                    <div class="welcome-meta">
                        <span>
                            <img src="${currentUser.avatar || ""}" class="welcome-avatar" alt="Avatar" onerror="this.style.display='none'">
                            <span>${currentUser.display_name || currentUser.login || "Usuario"}</span>
                        </span>
                        <span class="role-badge">${role}</span>
                        <span>🕒 Último acceso: ${formatDate(currentUser.last_login)}</span>
                    </div>
                </div>
                <div class="dash-grid">${modulesHtml}</div>
                <div id="giveawayWidgetContainer"></div>
            </div>
        `;
        renderGiveawayWidget();
    }

    function getModuleDescription(key) {
        const descs = {
            profile: "Tu información en la plataforma",
            "mango-voice": "Envía audios al streamer",
            donations: "Apoya al canal con donaciones",
            discord: "Únete al Discord oficial de la comunidad",
            guild: "Solicita ingreso al gremio oficial",
            "streamer-panel": "Administra Mango Voice, usuarios y estadísticas"
        };
        return descs[key] || "";
    }

    // ─── Giveaway Widget (Dashboard) ───
    async function renderGiveawayWidget() {
        const container = document.getElementById("giveawayWidgetContainer");
        if (!container) return;

        const role = currentUser.role || "FOLLOWER";
        let data = null;
        try {
            const res = await fetch("/api/giveaways/active");
            data = await res.json();
        } catch (e) {
            console.error("Giveaway widget error:", e);
        }

        let widgetHtml = "";

        if (role === "FOLLOWER") {
            widgetHtml = `
                <div class="giveaway-widget locked">
                    <div class="giveaway-widget-header">
                        <span class="giveaway-widget-icon">🎁</span>
                        <h3>Sorteo Mensual</h3>
                    </div>
                    <div class="giveaway-widget-body">
                        <p>🔒 Sorteo Exclusivo para Suscriptores. ¡Suscríbete en Twitch para participar por este premio!</p>
                    </div>
                </div>
            `;
        } else if (data && data.active) {
            const g = data.giveaway;
            const hasEntered = data.has_entered;
            widgetHtml = `
                <div class="giveaway-widget active">
                    <div class="giveaway-widget-header">
                        <span class="giveaway-widget-icon">🎁</span>
                        <h3>${g.title}</h3>
                    </div>
                    <div class="giveaway-widget-body">
                        <p>${g.description || "¡Participa por este increíble premio!"}</p>
                        ${hasEntered
                            ? `<button class="btn btn-success" disabled>✅ ¡Ya estás participando! 🎟️</button>`
                            : `<button class="btn btn-primary" id="giveawayEnterBtn">🎟️ Participar en el Sorteo</button>`
                        }
                    </div>
                </div>
            `;
        } else {
            widgetHtml = `
                <div class="giveaway-widget inactive">
                    <div class="giveaway-widget-header">
                        <span class="giveaway-widget-icon">🎁</span>
                        <h3>Sorteo Mensual</h3>
                    </div>
                    <div class="giveaway-widget-body">
                        <p>No hay ningún sorteo activo en este momento. ¡Atento a las transmisiones!</p>
                    </div>
                </div>
            `;
        }

        container.innerHTML = `
            <h2>🎁 Sorteo Mensual</h2>
            ${widgetHtml}
        `;

        const enterBtn = document.getElementById("giveawayEnterBtn");
        if (enterBtn) {
            enterBtn.onclick = async function () {
                try {
                    const res = await fetch("/api/giveaways/enter", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({})
                    });
                    const result = await res.json();
                    if (result.success) {
                        Components.Toast({ message: "🎟️ ¡Te has unido al sorteo!", variant: "success" });
                        renderGiveawayWidget();
                    } else {
                        Components.Toast({ message: result.error || "Error al participar", variant: "error" });
                    }
                } catch (e) {
                    Components.Toast({ message: "Error al participar", variant: "error" });
                }
            };
        }
    }

    // ─── Perfil ───
    function renderProfile() {
        const content = document.getElementById("mainContent");
        content.innerHTML = `
            <div class="module-page">
                <div class="module-header"><h2>👤 Perfil</h2></div>
                <div class="module-content">
                    <div class="info-card" style="text-align:center;">
                        <img src="${currentUser.avatar || ""}" 
                             style="width:100px;height:100px;border-radius:50%;border:3px solid #9146FF;object-fit:cover;margin-bottom:12px;"
                             onerror="this.style.display='none'">
                        <h3 style="font-size:22px;margin-bottom:6px;">${currentUser.display_name || currentUser.login || "Usuario"}</h3>
                        <p class="role-badge" style="display:inline-block;margin-bottom:10px;">${currentUser.role || "FOLLOWER"}</p>
                        <p style="color:#64748b;font-size:14px;">@${currentUser.login || ""}</p>
                    </div>
                    <div class="info-card">
                        <h4>📅 Información</h4>
                        <p><strong>ID:</strong> ${currentUser.id || "—"}</p>
                        <p><strong>Twitch ID:</strong> ${currentUser.twitch_id || "—"}</p>
                        <p><strong>Miembro desde:</strong> ${formatDate(currentUser.created_at)}</p>
                        <p><strong>Último acceso:</strong> ${formatDate(currentUser.last_login)}</p>
                    </div>
                </div>
            </div>
        `;
    }

    // ─── Mango Voice ───
    async function renderMangoVoice() {
        const content = document.getElementById("mainContent");
        let limitHtml = "";
        try {
            const res = await fetch("/api/voice/my-limit");
            const limit = await res.json();
            limitHtml = limit.limit === "ilimitado"
                ? `<p style="color:#22c55e;">✔ Límite: Ilimitado</p>`
                : `<p style="color:#94a3b8;">Límite: ${limit.used}/${limit.limit} usados hoy</p>`;
        } catch (e) {
            limitHtml = `<p style="color:#64748b;">No se pudo cargar el límite</p>`;
        }

        let maxSeconds = 30;
        try {
            const settingsRes = await fetch("/api/settings");
            const settings = await settingsRes.json();
            const raw = settings.MANGO_VOICE_MAX_SECONDS && settings.MANGO_VOICE_MAX_SECONDS.value;
            const parsed = parseInt(raw, 10);
            if (!isNaN(parsed) && parsed > 0) maxSeconds = parsed;
        } catch (e) { console.error(e); }

        content.innerHTML = `
            <div class="module-page">
                <div class="module-header"><h2>🎤 Mango Voice</h2></div>
                <div class="module-content">
                    <div class="info-card">
                        <h4>📋 Instrucciones</h4>
                        <ul>
                            <li>Máximo ${maxSeconds} segundos por audio.</li>
                            <li>No spam ni publicidad.</li>
                            <li>Los audios que incumplan las reglas podrán ser omitidos.</li>
                        </ul>
                        <div style="margin-top:10px;" id="voiceLimitInfo">${limitHtml}</div>
                    </div>
                    <button class="btn btn-primary" id="recordBtn">🔴 Iniciar Grabación</button>
                    <button class="btn btn-danger" id="stopBtn" disabled>⏹ Detener Grabación</button>
                    <div class="timer" id="timer">00:${String(maxSeconds).padStart(2, "0")}</div>
                    <audio id="audioPlayer" controls></audio>
                    <div class="form-group anonymous-option" style="margin-top:1rem; display:flex; align-items:center; gap:0.5rem;">
                        <input type="checkbox" id="chk-anonymous" style="width:auto; cursor:pointer;">
                        <label for="chk-anonymous" style="cursor:pointer; font-size:0.9rem;">Enviar audio de forma anónima 🥷</label>
                    </div>
                    <button class="btn btn-primary" id="sendBtn" disabled style="margin-top:15px;">📤 Enviar Audio</button>

                    <div class="info-card" style="margin-top:25px;">
                        <h4>📜 Mis Audios Enviados</h4>
                        <div id="myAudiosList"><p style="color:#64748b;">Cargando...</p></div>
                    </div>
                </div>
            </div>
        `;
        initRecorder(maxSeconds);
        loadMyAudios();
    }

    async function loadMyAudios() {
        const container = document.getElementById("myAudiosList");
        if (!container) return;
        try {
            const res = await fetch("/api/voice/my-audios");
            const audios = await res.json();
            if (!Array.isArray(audios) || audios.length === 0) {
                container.innerHTML = '<p style="color:#64748b;">No tienes audios enviados aún</p>';
                return;
            }
            const statusLabels = {
                pending: { text: "⏳ En cola", class: "badge-info" },
                played: { text: "▶️ Reproducido", class: "badge-success" },
                rejected: { text: "❌ Rechazado", class: "badge-danger" }
            };
            let html = '<ul style="list-style:none;padding:0;">';
            audios.forEach(a => {
                const status = statusLabels[a.status] || statusLabels.pending;
                const date = a.created_at ? new Date(a.created_at).toLocaleString("es-CL") : "—";
                const anonBadge = a.is_anonymous ? ' <span style="font-size:12px;">🥷</span>' : "";
                html += `<li style="padding:10px 0;border-bottom:1px solid #334155;display:flex;justify-content:space-between;align-items:center;">
                    <span>#${a.id} ${anonBadge}<span class="badge ${status.class}" style="margin-left:8px;">${status.text}</span></span>
                    <span style="color:#94a3b8;font-size:12px;">${date}</span>
                </li>`;
            });
            html += '</ul>';
            container.innerHTML = html;
        } catch (e) {
            container.innerHTML = '<p style="color:#ef4444;">Error al cargar el historial</p>';
        }
    }

    function initRecorder(maxSeconds) {
        const recordBtn = document.getElementById("recordBtn");
        const stopBtn = document.getElementById("stopBtn");
        const sendBtn = document.getElementById("sendBtn");
        const audioPlayer = document.getElementById("audioPlayer");
        const timer = document.getElementById("timer");
        audioChunks = [];
        audioBlob = null;

        recordBtn.onclick = async function () {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                audioChunks = [];
                audioBlob = null;
                mediaRecorder = new MediaRecorder(stream);
                mediaRecorder.ondataavailable = function (e) { if (e.data.size > 0) audioChunks.push(e.data); };
                mediaRecorder.onstop = function () {
                    audioBlob = new Blob(audioChunks, { type: "audio/webm" });
                    audioPlayer.src = URL.createObjectURL(audioBlob);
                    sendBtn.disabled = false;
                    clearInterval(countdownInterval);
                    timer.textContent = "00:" + String(maxSeconds).padStart(2, "0");
                    timer.style.color = "white";
                };
                mediaRecorder.start();
                recordBtn.disabled = true;
                stopBtn.disabled = false;
                sendBtn.disabled = true;
                secondsRemaining = maxSeconds;
                timer.textContent = "00:" + String(maxSeconds).padStart(2, "0");
                timer.style.color = "#ef4444";
                countdownInterval = setInterval(() => {
                    secondsRemaining--;
                    timer.textContent = "00:" + String(secondsRemaining).padStart(2, "0");
                    if (secondsRemaining <= 10) timer.style.color = "#f59e0b";
                    if (secondsRemaining <= 0) {
                        clearInterval(countdownInterval);
                        if (mediaRecorder && mediaRecorder.state === "recording") mediaRecorder.stop();
                        recordBtn.disabled = false;
                        stopBtn.disabled = true;
                    }
                }, 1000);
            } catch (error) {
                alert("Error al acceder al micrófono:\n" + error.message);
            }
        };

        stopBtn.onclick = function () {
            clearInterval(countdownInterval);
            if (mediaRecorder && mediaRecorder.state === "recording") mediaRecorder.stop();
            recordBtn.disabled = false;
            stopBtn.disabled = true;
        };

        sendBtn.onclick = async function () {
            if (!audioBlob) {
                Components.Toast({ message: "Debes grabar un audio", variant: "warning" });
                return;
            }
            try {
                const isAnonymous = document.getElementById("chk-anonymous").checked;
                const formData = new FormData();
                formData.append("username", currentUser.display_name || currentUser.login);
                formData.append("audio", audioBlob, "audio.webm");
                formData.append("isAnonymous", isAnonymous);
                const response = await fetch("/api/voice/upload", { method: "POST", body: formData });
                const result = await response.json();
                if (result.success) {
                    Components.Toast({ message: "🎤 Audio enviado correctamente", variant: "success" });
                    sendBtn.disabled = true;
                    renderMangoVoice();
                } else {
                    Components.Toast({ message: result.error || "Error al enviar audio", variant: "error" });
                }
            } catch (error) {
                Components.Toast({ message: "Error enviando audio", variant: "error" });
            }
        };
    }

    // ─── Donaciones ───
    async function renderDonations() {
        const content = document.getElementById("mainContent");
        let paypalUrl = "https://www.paypal.com";
        let goal = { title: "Meta de la Comunidad", target: 100, current: 0, percentage: 0 };
        try {
            const settingsRes = await fetch("/api/settings");
            const settings = await settingsRes.json();
            if (settings.PAYPAL_URL && settings.PAYPAL_URL.value) paypalUrl = settings.PAYPAL_URL.value;
        } catch (e) { console.error(e); }

        try {
            const goalRes = await fetch("/api/donations/goal");
            goal = await goalRes.json();
        } catch (e) { console.error(e); }

        content.innerHTML = `
            <div class="module-page">
                <div class="module-header"><h2>💵 Donaciones</h2></div>
                <div class="module-content">
                    <div class="info-card">
                        <h4>🎯 Meta de la Comunidad</h4>
                        <p style="color:#94a3b8;margin-bottom:8px;">${goal.title || "Meta de la Comunidad"}</p>
                        <div style="background:#1e293b;border-radius:10px;height:24px;overflow:hidden;border:1px solid #334155;">
                            <div id="goalBar" style="background:linear-gradient(90deg,#fbbf24,#f59e0b);height:100%;width:0%;transition:width .5s ease;"></div>
                        </div>
                        <p style="color:#fbbf24;font-weight:bold;margin-top:8px;" id="goalText">$${goal.current || 0} / $${goal.target || 0} (${goal.percentage || 0}%)</p>
                    </div>
                    <div style="text-align:center;margin:25px 0;">
                        <button class="btn btn-primary" id="paypalBtn" style="font-size:18px;padding:16px 40px;">💳 Donar con PayPal</button>
                    </div>
                    <div class="info-card"><h4>💖 Últimos Apoyos</h4><div id="recentDonations"><p style="color:#64748b;">Cargando...</p></div></div>
                </div>
            </div>
        `;
        document.getElementById("paypalBtn").onclick = () => window.open(paypalUrl, "_blank");
        document.getElementById("goalBar").style.width = (goal.percentage || 0) + "%";

        try {
            const res = await fetch("/api/donations/recent");
            const donations = await res.json();
            const container = document.getElementById("recentDonations");
            if (!donations.length) {
                container.innerHTML = '<p style="color:#64748b;">No hay donaciones recientes</p>';
            } else {
                let html = '<ul style="list-style:none;padding:0;">';
                donations.forEach(d => {
                    const name = d.donor_name || d.username || "Anónimo";
                    const msg = d.message ? `<div style="color:#94a3b8;font-size:13px;margin-top:4px;">${d.message}</div>` : "";
                    html += `<li style="padding:10px 0;border-bottom:1px solid #334155;">
                        <div style="display:flex;justify-content:space-between;">
                            <strong>${name}</strong>
                            <span style="color:#fbbf24;font-weight:600;">$${parseFloat(d.amount).toFixed(2)}</span>
                        </div>${msg}
                    </li>`;
                });
                html += '</ul>';
                container.innerHTML = html;
            }
        } catch (e) { console.error(e); }
    }

    // ─── Discord ───
    function renderDiscord() {
        const content = document.getElementById("mainContent");
        content.innerHTML = `
            <div class="module-page">
                <div class="module-header"><h2>💬 Discord</h2></div>
                <div class="module-content">
                    <div class="info-card" style="text-align:center;">
                        <div style="font-size:80px;margin-bottom:20px;">💬</div>
                        <h3 style="font-size:24px;margin-bottom:15px;">Discord Oficial de xMangoSalao</h3>
                        <p style="color:#94a3b8;margin-bottom:25px;">Únete a la comunidad en Discord.</p>
                        <button class="btn btn-twitch-purple" id="discordBtn" style="font-size:18px;padding:16px 40px;">🚀 Unirse al Discord</button>
                    </div>
                    <div class="info-card"><h4>📋 Reglas</h4><ul><li>Respeta a todos los miembros.</li><li>No hacer spam ni publicidad.</li></ul></div>
                </div>
            </div>
        `;
        document.getElementById("discordBtn").onclick = () => window.open("/api/discord/join", "_blank");
    }

    // ─── Gremio ───
    async function renderGuild() {
        const content = document.getElementById("mainContent");
        let guildInviteUrl = "https://discord.gg/xmangosalao";
        try {
            const settingsRes = await fetch("/api/settings");
            const settings = await settingsRes.json();
            if (settings.GUILD_INVITE_URL && settings.GUILD_INVITE_URL.value) {
                guildInviteUrl = settings.GUILD_INVITE_URL.value;
            }
        } catch (e) { console.error(e); }

        content.innerHTML = `
            <div class="module-page">
                <div class="module-header"><h2>⚔️ Gremio Mango Born</h2></div>
                <div class="module-content">
                    <div class="info-card" style="text-align:center;">
                        <div style="font-size:80px;margin-bottom:20px;">⚔️</div>
                        <h3 style="font-size:24px;margin-bottom:15px;">Gremio Mango Born</h3>
                        <p style="color:#94a3b8;margin-bottom:5px;">🎮 Albion Online</p>
                        <p style="color:#94a3b8;margin-bottom:25px;">El gremio oficial de la comunidad de xMangoSalao</p>
                        <p style="color:#94a3b8;margin-bottom:25px;">Únete a nuestro gremio mediante el sistema de registro automático en Discord.</p>
                        <button class="btn btn-primary" id="guildJoinBtn" style="font-size:18px;padding:16px 40px;">🚀 Unirse al Gremio</button>
                    </div>
                    <div class="info-card"><h4>📋 Requisitos</h4><ul><li>Ser parte activa de la comunidad.</li><li>Seguir las reglas del gremio.</li></ul></div>
                </div>
            </div>
        `;
        document.getElementById("guildJoinBtn").onclick = () => window.open(guildInviteUrl, "_blank");
    }

    // ─── Configuración ───
    async function renderSettings() {
        const content = document.getElementById("mainContent");
        content.innerHTML = `
            <div class="module-page">
                <div class="module-header"><h2>🛠 Configuración</h2></div>
                <div class="module-content">
                    <div id="settingsMessage"></div>
                    <div class="info-card"><h4>📋 General</h4>
                        <div class="form-grid">
                            <div class="form-group">
                                <label for="setting-STREAMER_DISPLAY_NAME">Nombre del Streamer</label>
                                <input type="text" id="setting-STREAMER_DISPLAY_NAME" data-key="STREAMER_DISPLAY_NAME">
                            </div>
                        </div>
                    </div>
                    <div class="info-card"><h4>🔗 Enlaces</h4>
                        <div class="form-grid">
                            <div class="form-group">
                                <label for="setting-DISCORD_INVITE_URL">Discord Invite URL</label>
                                <input type="url" id="setting-DISCORD_INVITE_URL" data-key="DISCORD_INVITE_URL">
                            </div>
                            <div class="form-group">
                                <label for="setting-PAYPAL_URL">PayPal URL</label>
                                <input type="url" id="setting-PAYPAL_URL" data-key="PAYPAL_URL">
                            </div>
                        </div>
                    </div>
                    <div class="info-card"><h4>🎤 Mango Voice</h4>
                        <div class="form-grid">
                            <div class="form-group">
                                <label for="setting-MANGO_VOICE_DAILY_LIMIT_FOLLOWER">Límite diario FOLLOWER</label>
                                <input type="number" id="setting-MANGO_VOICE_DAILY_LIMIT_FOLLOWER" data-key="MANGO_VOICE_DAILY_LIMIT_FOLLOWER">
                            </div>
                            <div class="form-group">
                                <label for="setting-MANGO_VOICE_DAILY_LIMIT_SUBSCRIBER">Límite diario SUBSCRIBER (-1 = ilimitado)</label>
                                <input type="number" id="setting-MANGO_VOICE_DAILY_LIMIT_SUBSCRIBER" data-key="MANGO_VOICE_DAILY_LIMIT_SUBSCRIBER">
                            </div>
                            <div class="form-group">
                                <label for="setting-MANGO_VOICE_MAX_SECONDS">Duración máxima (segundos)</label>
                                <input type="number" id="setting-MANGO_VOICE_MAX_SECONDS" data-key="MANGO_VOICE_MAX_SECONDS">
                            </div>
                        </div>
                    </div>
                    <div class="info-card"><h4>⚔️ Gremio</h4>
                        <div class="form-grid">
                            <div class="form-group">
                                <label for="setting-GUILD_NAME">Nombre del Gremio</label>
                                <input type="text" id="setting-GUILD_NAME" data-key="GUILD_NAME">
                            </div>
                            <div class="form-group">
                                <label for="setting-GUILD_GAME">Juego</label>
                                <input type="text" id="setting-GUILD_GAME" data-key="GUILD_GAME">
                            </div>
                            <div class="form-group">
                                <label for="setting-GUILD_INVITE_URL">Guild Invite / Bot URL</label>
                                <input type="url" id="setting-GUILD_INVITE_URL" data-key="GUILD_INVITE_URL">
                            </div>
                            <div class="form-group">
                                <label for="setting-GUILD_OPEN">Aceptar solicitudes</label>
                                <select id="setting-GUILD_OPEN" data-key="GUILD_OPEN">
                                    <option value="true">Sí</option>
                                    <option value="false">No</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    <div class="info-card"><h4>🎯 Meta de la Comunidad</h4>
                        <div class="form-grid">
                            <div class="form-group">
                                <label for="setting-COMMUNITY_GOAL_TITLE">Título de la Meta</label>
                                <input type="text" id="setting-COMMUNITY_GOAL_TITLE" data-key="COMMUNITY_GOAL_TITLE">
                            </div>
                            <div class="form-group">
                                <label for="setting-COMMUNITY_GOAL_TARGET">Monto Objetivo ($)</label>
                                <input type="number" step="0.01" id="setting-COMMUNITY_GOAL_TARGET" data-key="COMMUNITY_GOAL_TARGET">
                            </div>
                            <div class="form-group">
                                <label for="setting-COMMUNITY_GOAL_CURRENT">Monto Actual Recaudado ($)</label>
                                <input type="number" step="0.01" id="setting-COMMUNITY_GOAL_CURRENT" data-key="COMMUNITY_GOAL_CURRENT">
                            </div>
                        </div>
                    </div>
                    <div style="margin-top:20px;">
                        <button class="btn btn-primary" id="saveSettingsBtn">💾 Guardar Cambios</button>
                    </div>
                </div>
            </div>
        `;

        // Cargar valores actuales
        try {
            const res = await fetch("/api/settings");
            const settings = await res.json();
            Object.keys(settings).forEach(key => {
                const input = document.getElementById("setting-" + key);
                if (input) input.value = settings[key].value;
            });
        } catch (e) { console.error(e); }

        document.getElementById("saveSettingsBtn").onclick = async () => {
            const inputs = document.querySelectorAll("[data-key]");
            let firstError = null;
            for (const input of inputs) {
                const key = input.dataset.key;
                const value = input.value;
                const msgEl = document.getElementById("settingsMessage");
                try {
                    const r = await fetch("/api/settings", {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ key, value })
                    });
                    const data = await r.json();
                    if (!r.ok) {
                        if (!firstError) firstError = data.error;
                        msgEl.innerHTML = `<div class="alert alert-error">❌ ${firstError}</div>`;
                    }
                } catch (err) {
                    if (!firstError) firstError = "Error de conexión";
                    msgEl.innerHTML = `<div class="alert alert-error">❌ Error al guardar</div>`;
                }
            }
            if (!firstError) {
                const msgEl = document.getElementById("settingsMessage");
                msgEl.innerHTML = `<div class="alert alert-success">✅ Configuración guardada correctamente</div>`;
            }
        };
    }

    // ─── Panel Streamer ───
    async function renderStreamerPanel() {
        const content = document.getElementById("mainContent");
        content.innerHTML = `
            <div class="module-page">
                <div class="module-header"><h2>⚙️ Panel Streamer</h2></div>
                <div class="module-content">
                    <div class="stats-grid" id="streamerStats">
                        <div class="stat-box"><div class="stat-value" id="statUsers">-</div><div class="stat-label">Usuarios</div></div>
                        <div class="stat-box"><div class="stat-value" id="statAudios">-</div><div class="stat-label">Total Audios</div></div>
                        <div class="stat-box"><div class="stat-value" id="statPending">-</div><div class="stat-label">Pendientes</div></div>
                        <div class="stat-box"><div class="stat-value" id="statDonated">-</div><div class="stat-label">Donado Total</div></div>
                        <div class="stat-box"><div class="stat-value" id="statGuild">-</div><div class="stat-label">Sol. Gremio</div></div>
                    </div>
                    <div class="info-card">
                        <h4>🔊 Volumen Global</h4>
                        <input type="range" min="0" max="1" step="0.01" id="volumeSlider" style="width:100%;">
                        <span id="volumeValue" style="color:#fbbf24;font-weight:bold;">1</span>
                    </div>
                    <div class="info-card">
                        <h4>🎁 Gestión de Sorteos</h4>
                        <div id="giveawayManager">
                            <p style="color:#64748b;">Cargando...</p>
                        </div>
                    </div>
                    <div style="margin-top:20px;">
                        <a href="/admin/admin.html" class="btn btn-primary">Abrir Panel Completo →</a>
                    </div>
                </div>
            </div>
        `;
        const slider = document.getElementById("volumeSlider");
        const volValue = document.getElementById("volumeValue");
        try {
            const res = await fetch("/api/voice/settings");
            const data = await res.json();
            slider.value = data.volume || 1;
            volValue.textContent = data.volume || 1;
        } catch (e) {}
        slider.oninput = async function () {
            volValue.textContent = this.value;
            await fetch("/api/voice/set-volume", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ volume: this.value }) });
        };
        try {
            const res = await fetch("/api/streamer/stats");
            const s = await res.json();
            document.getElementById("statUsers").textContent = s.total_users || 0;
            document.getElementById("statAudios").textContent = s.total_audios || 0;
            document.getElementById("statPending").textContent = s.pending_audios || 0;
            document.getElementById("statDonated").textContent = "$" + (parseFloat(s.total_donated) || 0).toFixed(2);
            document.getElementById("statGuild").textContent = s.pending_guild_requests || 0;
        } catch (e) {}

        renderGiveawayManager();
    }

    // ─── Giveaway Manager (Streamer Panel) ───
    async function renderGiveawayManager() {
        const container = document.getElementById("giveawayManager");
        if (!container) return;

        let activeData = null;
        let entryCount = 0;

        try {
            const res = await fetch("/api/giveaways/active");
            activeData = await res.json();
        } catch (e) { console.error(e); }

        try {
            const res2 = await fetch("/api/giveaways/count");
            const countData = await res2.json();
            entryCount = countData.count || 0;
        } catch (e) { console.error(e); }

        let html = "";

        // Creation form
        html += `
            <div style="margin-bottom:20px;">
                <h5 style="color:var(--color-text-secondary);margin-bottom:10px;">➕ Lanzar Nuevo Sorteo</h5>
                <div class="form-group">
                    <label for="giveawayTitle">Título del Premio</label>
                    <input type="text" id="giveawayTitle" class="input" placeholder="Ej: Suscripción de 1 mes">
                </div>
                <div class="form-group">
                    <label for="giveawayDesc">Descripción / Reglas</label>
                    <textarea id="giveawayDesc" class="textarea" placeholder="Describe el premio y las reglas..."></textarea>
                </div>
                <button class="btn btn-primary" id="giveawayCreateBtn" style="margin-top:10px;">🚀 Lanzar Nuevo Sorteo</button>
            </div>
        `;

        // Active giveaway control
        if (activeData && activeData.active) {
            const g = activeData.giveaway;
            html += `
                <div style="margin-bottom:20px;">
                    <h5 style="color:var(--color-text-secondary);margin-bottom:10px;">🎲 Sorteo Activo</h5>
                    <div style="background:var(--color-background);border-radius:var(--radius-medium);padding:15px;border:1px solid var(--color-border);">
                        <h4 style="color:var(--color-secondary);margin-bottom:8px;">${g.title}</h4>
                        <p style="color:var(--color-text-secondary);font-size:14px;margin-bottom:12px;">${g.description || "Sin descripción"}</p>
                        <p style="color:var(--color-info);font-weight:600;margin-bottom:12px;">👥 ${entryCount} participante(s)</p>
                        <button class="btn btn-danger" id="giveawayPickBtn" style="width:100%;">🎲 Elegir Ganador Aleatorio</button>
                    </div>
                </div>
            `;
        } else {
            html += `
                <div style="margin-bottom:20px;">
                    <p style="color:var(--color-text-muted);font-size:14px;">No hay sorteo activo.</p>
                </div>
            `;
        }

        // Past winners
        const pastWinners = (activeData && activeData.past_winners) || [];
        html += `
            <div>
                <h5 style="color:var(--color-text-secondary);margin-bottom:10px;">🏆 Ganadores Anteriores</h5>
        `;
        if (pastWinners.length === 0) {
            html += `<p style="color:var(--color-text-muted);font-size:14px;">No hay ganadores anteriores.</p>`;
        } else {
            html += `<ul style="list-style:none;padding:0;">`;
            pastWinners.forEach(w => {
                html += `<li style="padding:8px 0;border-bottom:1px solid var(--color-border);display:flex;justify-content:space-between;">
                    <span>🏆 <strong>${w.winner_name || "Anónimo"}</strong></span>
                    <span style="color:var(--color-text-muted);font-size:12px;">${w.title || "Sorteo"} • ${formatDate(w.created_at)}</span>
                </li>`;
            });
            html += `</ul>`;
        }
        html += `</div>`;

        container.innerHTML = html;

        // Attach event listeners
        const createBtn = document.getElementById("giveawayCreateBtn");
        if (createBtn) {
            createBtn.onclick = async function () {
                const title = document.getElementById("giveawayTitle").value.trim();
                const description = document.getElementById("giveawayDesc").value.trim();
                if (!title) {
                    Components.Toast({ message: "El título es requerido", variant: "warning" });
                    return;
                }
                try {
                    const res = await fetch("/api/giveaways/create", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ title, description })
                    });
                    const result = await res.json();
                    if (result.success) {
                        Components.Toast({ message: "🎁 Sorteo creado correctamente", variant: "success" });
                        document.getElementById("giveawayTitle").value = "";
                        document.getElementById("giveawayDesc").value = "";
                        renderGiveawayManager();
                    } else {
                        Components.Toast({ message: result.error || "Error al crear sorteo", variant: "error" });
                    }
                } catch (e) {
                    Components.Toast({ message: "Error al crear sorteo", variant: "error" });
                }
            };
        }

        const pickBtn = document.getElementById("giveawayPickBtn");
        if (pickBtn) {
            pickBtn.onclick = pickWinner;
        }
    }

    async function pickWinner() {
        if (!confirm("¿Estás seguro de elegir un ganador aleatorio? Esta acción no se puede deshacer.")) return;
        try {
            const res = await fetch("/api/giveaways/pick-winner", { method: "POST" });
            const result = await res.json();
            if (result.success) {
                Components.Modal({
                    title: "🎉 ¡Ganador del Sorteo!",
                    content: `<div style="text-align:center;padding:20px;">
                        <div style="font-size:48px;margin-bottom:15px;">🎁</div>
                        <p style="font-size:20px;margin-bottom:10px;">El ganador es:</p>
                        <p style="font-size:28px;font-weight:bold;color:var(--color-secondary);margin-bottom:15px;">${result.winner_name}</p>
                        <p style="color:var(--color-text-secondary);">¡Felicidades! El sorteo ha sido completado.</p>
                    </div>`,
                    onClose: () => renderGiveawayManager()
                });
            } else {
                Components.Toast({ message: result.error || "Error al elegir ganador", variant: "error" });
            }
        } catch (e) {
            Components.Toast({ message: "Error al elegir ganador", variant: "error" });
        }
    }

    return { init, navigateTo, currentUser: () => currentUser };
})();

document.addEventListener("DOMContentLoaded", () => MangoHub.init());