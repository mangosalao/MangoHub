// ============================================
// Mango Hub - Componentes Reutilizables
// ============================================

const Components = {

    // ─── Button ───
    Button({ text = "", icon = "", variant = "primary", loading = false, disabled = false, onClick = null, className = "" }) {
        const btn = document.createElement("button");
        btn.className = `btn btn-${variant} ${loading ? "btn-loading" : ""} ${className}`;
        btn.disabled = disabled || loading;
        btn.innerHTML = icon ? `${icon} ${text}` : text;
        if (onClick) btn.addEventListener("click", onClick);
        return btn;
    },

    // ─── Card ───
    Card({ title = "", subtitle = "", body = "", footer = "", icon = "", onClick = null }) {
        const card = document.createElement("div");
        card.className = "card";
        if (onClick) card.style.cursor = "pointer";

        let html = "";
        if (icon || title) {
            html += `<div class="card-header">`;
            if (icon) html += `<div class="dash-card-icon">${icon}</div>`;
            if (title) html += `<div class="card-title">${title}</div>`;
            if (subtitle) html += `<div class="card-subtitle">${subtitle}</div>`;
            html += `</div>`;
        }
        if (body) html += `<div class="card-body">${body}</div>`;
        if (footer) html += `<div class="card-footer">${footer}</div>`;

        card.innerHTML = html;
        if (onClick) card.addEventListener("click", onClick);
        return card;
    },

    // ─── Badge ───
    Badge({ text = "", variant = "primary" }) {
        const badge = document.createElement("span");
        badge.className = `badge badge-${variant}`;
        badge.textContent = text;
        return badge;
    },

    // ─── Alert ───
    Alert({ message = "", variant = "info" }) {
        const alert = document.createElement("div");
        alert.className = `alert alert-${variant}`;
        alert.textContent = message;
        return alert;
    },

    // ─── Toast Container ───
    createToastContainer() {
        let container = document.getElementById("toastContainer");
        if (!container) {
            container = document.createElement("div");
            container.id = "toastContainer";
            container.className = "toast-container";
            document.body.appendChild(container);
        }
        return container;
    },

    Toast({ message = "", variant = "info", duration = 4000 }) {
        const container = Components.createToastContainer();
        const toast = document.createElement("div");
        toast.className = `toast toast-${variant}`;
        toast.textContent = message;
        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add("hiding");
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },

    // ─── Modal ───
    Modal({ title = "", content = "", onClose = null }) {
        const overlay = document.createElement("div");
        overlay.className = "modal-overlay";

        const modal = document.createElement("div");
        modal.className = "modal";
        modal.innerHTML = `
            <div class="modal-header">
                <div class="modal-title">${title}</div>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">${content}</div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        const closeBtn = modal.querySelector(".modal-close");
        const close = () => {
            overlay.remove();
            if (onClose) onClose();
        };

        closeBtn.addEventListener("click", close);
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) close();
        });

        return { overlay, modal, close };
    },

    // ─── Input ───
    Input({ type = "text", placeholder = "", value = "", id = "", onChange = null }) {
        const input = document.createElement("input");
        input.type = type;
        input.className = "input";
        input.placeholder = placeholder;
        input.value = value;
        if (id) input.id = id;
        if (onChange) input.addEventListener("input", (e) => onChange(e.target.value));
        return input;
    },

    // ─── Textarea ───
    Textarea({ placeholder = "", value = "", id = "", onChange = null }) {
        const textarea = document.createElement("textarea");
        textarea.className = "textarea";
        textarea.placeholder = placeholder;
        textarea.value = value;
        if (id) textarea.id = id;
        if (onChange) textarea.addEventListener("input", (e) => onChange(e.target.value));
        return textarea;
    },

    // ─── Select ───
    Select({ options = [], value = "", id = "", onChange = null }) {
        const select = document.createElement("select");
        select.className = "select";
        if (id) select.id = id;

        options.forEach(opt => {
            const option = document.createElement("option");
            option.value = opt.value;
            option.textContent = opt.label;
            if (value && opt.value === value) option.selected = true;
            select.appendChild(option);
        });

        if (onChange) select.addEventListener("change", (e) => onChange(e.target.value));
        return select;
    },

    // ─── Avatar ───
    Avatar({ src = "", alt = "", size = "medium" }) {
        const img = document.createElement("img");
        img.className = `avatar avatar-${size}`;
        img.src = src;
        img.alt = alt;
        return img;
    },

    // ─── Spinner ───
    Spinner({ size = "medium" }) {
        const spinner = document.createElement("div");
        spinner.className = `spinner spinner-${size}`;
        return spinner;
    },

    // ─── Skeleton ───
    Skeleton({ type = "text", width = "", height = "" }) {
        const skeleton = document.createElement("div");
        skeleton.className = `skeleton skeleton-${type}`;
        if (width) skeleton.style.width = width;
        if (height) skeleton.style.height = height;
        return skeleton;
    },

    // ─── Dropdown ───
    Dropdown({ trigger = "", items = [], onSelect = null }) {
        const dropdown = document.createElement("div");
        dropdown.className = "dropdown";

        const triggerEl = document.createElement("button");
        triggerEl.className = "btn btn-secondary";
        triggerEl.innerHTML = trigger || "Menu";
        triggerEl.style.position = "relative";

        const menu = document.createElement("div");
        menu.className = "dropdown-menu";
        menu.style.display = "none";

        items.forEach(item => {
            const itemEl = document.createElement("div");
            itemEl.className = "dropdown-item";
            itemEl.textContent = item.label;
            itemEl.addEventListener("click", () => {
                menu.style.display = "none";
                if (onSelect) onSelect(item.value);
            });
            menu.appendChild(itemEl);
        });

        triggerEl.addEventListener("click", (e) => {
            e.stopPropagation();
            menu.style.display = menu.style.display === "none" ? "block" : "none";
        });

        document.addEventListener("click", () => {
            menu.style.display = "none";
        });

        dropdown.appendChild(triggerEl);
        dropdown.appendChild(menu);

        return dropdown;
    }
};

window.Components = Components;
