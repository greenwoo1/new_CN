const API_URL = "http://localhost:8000";

const api = {
    async request(endpoint, method = 'GET', body = null) {
        const token = localStorage.getItem('cn_token');
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const config = { method, headers };
        if (body) config.body = JSON.stringify(body);

        const response = await fetch(`${API_URL}${endpoint}`, config);

        if (response.status === 401) {
            app.logout();
            return;
        }
        if (!response.ok) {
            const err = await response.json();
            alert(`Error: ${err.detail || 'Request failed'}`);
            throw new Error('API request failed');
        }
        return response.json();
    }
};

const app = {
    currentPage: 'servers',
    dataCache: {},

    init() {
        this.neuralBg();
        this.bindEvents();
        const token = localStorage.getItem('cn_token');
        if (token) {
            this.showInterface();
        }
    },

    neuralBg() {
        const canvas = document.getElementById('neural-canvas');
        const ctx = canvas.getContext('2d');
        let dots = [];
        const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
        window.onresize = resize; resize();
        for (let i = 0; i < 80; i++) dots.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, vx: (Math.random() - 0.5) * 0.5, vy: (Math.random() - 0.5) * 0.5 });
        const draw = () => {
            let grad = ctx.createRadialGradient(canvas.width/2, canvas.height/2, 0, canvas.width/2, canvas.height/2, canvas.width);
            grad.addColorStop(0, "#2b0000"); grad.addColorStop(1, "#000000");
            ctx.fillStyle = grad; ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = "white";
            dots.forEach(d => {
                d.x += d.vx; d.y += d.vy;
                if (d.x < 0 || d.x > canvas.width) d.vx *= -1;
                if (d.y < 0 || d.y > canvas.height) d.vy *= -1;
                ctx.beginPath(); ctx.arc(d.x, d.y, 1.2, 0, Math.PI * 2); ctx.fill();
            });
            requestAnimationFrame(draw);
        };
        draw();
    },

    bindEvents() {
        document.getElementById('auth-form').onsubmit = async (e) => {
            e.preventDefault();
            const formData = new FormData();
            formData.append('username', document.getElementById('user_login').value);
            formData.append('password', document.getElementById('user_pass').value);

            const response = await fetch(`${API_URL}/api/token`, { method: 'POST', body: new URLSearchParams(formData) });
            if (response.ok) {
                const data = await response.json();
                localStorage.setItem('cn_token', data.access_token);
                this.showInterface();
            } else {
                alert('Login failed!');
            }
        };
        document.querySelectorAll('.nav-links li').forEach(li => li.onclick = () => this.navigate(li.dataset.page));
        document.querySelector('.btn-add').onclick = () => this.openAddModal();
        document.getElementById('main-search').oninput = (e) => this.search(e.target.value.toLowerCase());
    },

    async search(q) {
        if (this.currentPage === 'settings') return;
        const data = await api.request(`/api/${this.currentPage}?q=${q}`);
        this.renderTable(this.currentPage, data);
    },

    showInterface() {
        document.getElementById('login-page').classList.remove('active');
        document.getElementById('main-interface').classList.add('active');
        this.navigate('servers');
    },

    logout() {
        localStorage.removeItem('cn_token');
        document.getElementById('login-page').classList.add('active');
        document.getElementById('main-interface').classList.remove('active');
    },

    async navigate(page) {
        this.currentPage = page;
        document.querySelectorAll('.nav-links li').forEach(l => l.classList.remove('active'));
        const nav = document.querySelector(`[data-page="${page}"]`);
        if (nav) nav.classList.add('active');
        document.getElementById('page-title').innerText = page.charAt(0).toUpperCase() + page.slice(1);

        if (page === 'settings') {
            this.renderSettings();
            return;
        }

        const data = await api.request(`/api/${page}`);
        this.renderTable(page, data);
    },

    renderTable(page, data) {
        const container = document.getElementById('content-render');
        let headers = "", rows = "";

        switch(page) {
            case 'servers':
                headers = "<th>ID</th><th>OS</th><th>IP</th><th>Additional IP</th><th>Hoster</th><th>Status</th><th>Group</th><th>Project</th><th>Country</th><th>Comments</th><th>Action</th>";
                rows = data.map(i => `<tr><td>${i.id}</td><td>${i.os}</td><td>${i.ip}</td><td>${i.additional_ip || ''}</td><td>${i.hoster}</td><td>${i.status}</td><td>${i.group ? i.group.title : ''}</td><td>${i.project ? i.project.title : ''}</td><td>${i.country}</td><td>${i.comments || ''}</td><td><button class="action-btn" onclick="app.openMenu('${page}', ${i.id})">⋮</button></td></tr>`).join('');
                break;
            case 'domains':
                headers = "<th>ID</th><th>Domain</th><th>Group</th><th>Status</th><th>NS</th><th>A Record</th><th>AAAA Record</th><th>Action</th>";
                rows = data.map(i => `<tr><td>${i.id}</td><td>${i.name}</td><td>${i.group ? i.group.title : ''}</td><td>${i.status}</td><td>${i.ns || ''}</td><td>${i.a_record || ''}</td><td>${i.aaaa_record || ''}</td><td><button class="action-btn" onclick="app.openMenu('${page}', ${i.id})">⋮</button></td></tr>`).join('');
                break;
            case 'projects':
                headers = "<th>ID</th><th>Title</th><th>Action</th>";
                rows = data.map(i => `<tr><td>${i.id}</td><td>${i.title}</td><td><button class="action-btn" onclick="app.openMenu('${page}', ${i.id})">⋮</button></td></tr>`).join('');
                break;
            case 'finance':
                headers = "<th>ID</th><th>Server ID</th><th>Server IP</th><th>Price</th><th>Status</th><th>Payment Date</th><th>Action</th>";
                rows = data.map(i => `<tr><td>${i.id}</td><td>${i.server_id}</td><td>${i.server ? i.server.ip : ''}</td><td>${i.price}</td><td>${i.account_status}</td><td>${new Date(i.payment_date).toLocaleDateString()}</td><td><button class="action-btn" onclick="app.openMenu('${page}', ${i.id})">⋮</button></td></tr>`).join('');
                break;
            case 'users':
                headers = "<th>ID</th><th>Username</th><th>Email</th><th>Role</th><th>Status</th><th>Phone</th><th>Last IP</th><th>Action</th>";
                rows = data.map(i => `<tr><td>${i.id}</td><td>${i.username}</td><td>${i.email}</td><td>${i.role}</td><td>${i.status}</td><td>${i.number || ''}</td><td>${i.ip || ''}</td><td><button class="action-btn" onclick="app.openMenu('${page}', ${i.id})">⋮</button></td></tr>`).join('');
                break;
            case 'groups':
                headers = "<th>ID</th><th>Title</th><th>Project</th><th>Status</th><th>Description</th><th>Action</th>";
                rows = data.map(i => `<tr><td>${i.id}</td><td>${i.title}</td><td>${i.project ? i.project.title : ''}</td><td>${i.status}</td><td>${i.description || ''}</td><td><button class="action-btn" onclick="app.openMenu('${page}', ${i.id})">⋮</button></td></tr>`).join('');
                break;
        }
        
        container.innerHTML = `<table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`;
    },

    async renderSettings() {
        const container = document.getElementById('content-render');
        const user = await api.request('/api/settings/me');
        container.innerHTML = `<div class="form-container" style="max-width: 500px; margin: 20px;">
            <h2>My Profile</h2>
            <input id="s_username" value="${user.username}" placeholder="Username">
            <input id="s_email" value="${user.email}" placeholder="Email">
            <input id="s_number" value="${user.number || ''}" placeholder="Phone Number">
            <input type="password" id="s_password" placeholder="New Password (optional)">
            <p>Role: ${user.role}</p>
            <p>Status: ${user.status}</p>
            <button class="btn-save" onclick="app.saveSettings()">Save Changes</button>
        </div>`;
    },

    openMenu(type, id) {
        let buttons = `<button onclick="app.openUpdate('${type}', ${id})">Update</button>
                       <button onclick="app.openHistory('${type}', ${id})">History</button>`;
        if (type === 'servers') {
            buttons += `<button onclick="app.openDetails('servers', ${id})">Details</button>`;
        }
        this.showModal("Actions", `<div class="action-menu">${buttons}</div>`);
    },

    async openDetails(type, id) {
        const item = await api.request(`/api/${type}/${id}`);
        let details = '';
        if (type === 'servers') {
            details = `<p><strong>Username:</strong> ${item.ssh_user}</p>
                       <p><strong>Password:</strong> ${item.ssh_pass}</p>
                       <p><strong>Container Pass:</strong> ${item.cont_pass || '-'}</p>
                       <p><strong>SSH Port:</strong> ${item.ssh_port}</p>
                       <p><strong>IP Address:</strong> ${item.ip}</p>`;
        }
        this.showModal("Connection Details", `<div class="form-container">${details}</div>`);
    },

    async openUpdate(type, id) {
        const item = await api.request(`/api/${type}/${id}`);
        const fields = await this.getFormFields(type, item);
        this.showModal(`Update ${type}`, `<form class="form-container" onsubmit="event.preventDefault(); app.saveUpdate('${type}', ${id})">${fields}<button type="submit" class="btn-save">Save Changes</button></form>`);
    },

    async openAddModal() {
        const fields = await this.getFormFields(this.currentPage);
        this.showModal(`Add New ${this.currentPage}`, `<form class="form-container" onsubmit="event.preventDefault(); app.saveNew()">${fields}<button type="submit" class="btn-save">Create</button></form>`);
    },

    async getFormFields(type, item = {}) {
        let fields = '';
        if (type === 'servers') {
            const groups = await this.getSelectOptions('groups', item.group_id);
            const projects = await this.getSelectOptions('projects', item.project_id);
            fields = `<input id="f_os" value="${item.os || ''}" placeholder="OS" required>
                      <input id="f_ip" value="${item.ip || ''}" placeholder="IP" required>
                      <input id="f_additional_ip" value="${item.additional_ip || ''}" placeholder="Additional IPs">
                      <input id="f_hoster" value="${item.hoster || ''}" placeholder="Hoster" required>
                      <select id="f_status">${this.getStatusOptions(item.status, ['Running', 'Stopped', 'Reserved', 'Abuse', 'Maintenance'])}</select>
                      <select id="f_group_id">${groups}</select>
                      <select id="f_project_id">${projects}</select>
                      <input id="f_country" value="${item.country || ''}" placeholder="Country" required>
                      <textarea id="f_comments" placeholder="Comments">${item.comments || ''}</textarea>
                      <input id="f_ssh_pass" type="password" placeholder="SSH Password" ${item.id ? '' : 'required'}>`;
        } else if (type === 'domains') {
            const groups = await this.getSelectOptions('groups', item.group_id);
            fields = `<input id="f_name" value="${item.name || ''}" placeholder="Domain Name" required>
                      <select id="f_group_id">${groups}</select>
                      <select id="f_status">${this.getStatusOptions(item.status, ['Active', 'Suspended', 'Abuse', 'Maintenance'])}</select>`;
        } else if (type === 'users') {
            fields = `<input id="f_username" value="${item.username || ''}" placeholder="Username" required>
                      <input id="f_email" value="${item.email || ''}" placeholder="Email" required>
                      <select id="f_role">${this.getStatusOptions(item.role, ['Super Admin', 'Admin 2L', 'Admin 1L', 'Service Manager'])}</select>
                      <select id="f_status">${this.getStatusOptions(item.status, ['active', 'suspended', 'inactive'])}</select>
                      <input id="f_number" value="${item.number || ''}" placeholder="Phone Number">
                      <input id="f_password" type="password" placeholder="Password" ${item.id ? '' : 'required'}>`;
        } else if (type === 'projects') {
            fields = `<input id="f_title" value="${item.title || ''}" placeholder="Project Title" required>`;
        } else if (type === 'groups') {
            const projects = await this.getSelectOptions('projects', item.project_id);
            fields = `<input id="f_title" value="${item.title || ''}" placeholder="Group Title" required>
                      <select id="f_project_id">${projects}</select>
                      <select id="f_status">${this.getStatusOptions(item.status, ['Enabled', 'Disabled'])}</select>
                      <textarea id="f_description" placeholder="Description">${item.description || ''}</textarea>`;
        } else if (type === 'finance') {
            const servers = await this.getSelectOptions('servers', item.server_id, 'ip');
            const paymentDate = item.payment_date ? new Date(item.payment_date).toISOString().split('T')[0] : '';
            fields = `<select id="f_server_id">${servers}</select>
                      <input id="f_price" type="number" step="0.01" value="${item.price || ''}" placeholder="Price" required>
                      <select id="f_account_status">${this.getStatusOptions(item.account_status, ['Active', 'Deactivated'])}</select>
                      <input id="f_payment_date" type="date" value="${paymentDate}" required>`;
        }
        return fields;
    },

    async getSelectOptions(type, selectedId, displayField = 'title') {
        if (!this.dataCache[type]) {
            this.dataCache[type] = await api.request(`/api/${type}`);
        }
        return this.dataCache[type].map(o => `<option value="${o.id}" ${o.id === selectedId ? 'selected' : ''}>${o[displayField] || o.title || o.name}</option>`).join('');
    },

    getStatusOptions(selected, options) {
        return options.map(o => `<option value="${o}" ${o === selected ? 'selected' : ''}>${o}</option>`).join('');
    },

    async saveUpdate(type, id) {
        const payload = this.getPayloadFromForm(type);
        await api.request(`/api/${type}/${id}`, 'PUT', payload);
        this.closeModal(); this.navigate(type);
    },

    async saveNew() {
        const payload = this.getPayloadFromForm(this.currentPage);
        await api.request(`/api/${this.currentPage}`, 'POST', payload);
        this.closeModal(); this.navigate(this.currentPage);
    },

    async saveSettings() {
        const payload = {
            username: s_username.value, email: s_email.value, number: s_number.value
        };
        if (s_password.value) payload.password = s_password.value;

        await api.request('/api/settings/me', 'PUT', payload);
        alert('Settings updated!');
        this.navigate('settings');
    },

    getPayloadFromForm(type) {
        let payload = {};
        if (type === 'servers') {
            payload = { os: f_os.value, ip: f_ip.value, additional_ip: f_additional_ip.value, hoster: f_hoster.value, status: f_status.value, group_id: f_group_id.value, project_id: f_project_id.value, country: f_country.value, comments: f_comments.value };
            if (f_ssh_pass.value) payload.ssh_pass = f_ssh_pass.value;
        } else if (type === 'domains') {
            payload = { name: f_name.value, group_id: f_group_id.value, status: f_status.value };
        } else if (type === 'users') {
            payload = { username: f_username.value, email: f_email.value, role: f_role.value, status: f_status.value, number: f_number.value };
            if (f_password.value) payload.password = f_password.value;
        } else if (type === 'projects') {
            payload = { title: f_title.value };
        } else if (type === 'groups') {
            payload = { title: f_title.value, project_id: f_project_id.value, status: f_status.value, description: f_description.value };
        } else if (type === 'finance') {
            payload = { server_id: f_server_id.value, price: f_price.value, account_status: f_account_status.value, payment_date: f_payment_date.value };
        }
        return payload;
    },

    async openHistory(type, id) {
        const logs = await api.request(`/api/history/${type}/${id}`);
        let list = logs.map(l => `<div style="padding:10px; border-bottom:1px solid #444"><small>${new Date(l.timestamp).toLocaleString()} | User: ${l.user}</small><br><b>${l.action}:</b> ${l.changes}</div>`).join('');
        this.showModal("History Logs", `<div class="history-list">${list || "No history"}</div>`);
    },

    showModal(title, content) {
        document.getElementById('modal-title').innerText = title;
        document.getElementById('modal-content').innerHTML = content;
        document.getElementById('modal-overlay').style.display = 'flex';
    },

    closeModal() { document.getElementById('modal-overlay').style.display = 'none'; }
};

window.onclick = (e) => { if (e.target.id === 'modal-overlay' || e.target.classList.contains('close-modal')) app.closeModal(); };
app.init();
