const API_URL = "http://localhost:8000";

const app = {
    currentPage: 'servers',
    user: null,

    init() {
        this.neuralBg();
        this.bindEvents();
        const saved = localStorage.getItem('cn_user_data');
        if (saved) { this.user = JSON.parse(saved); this.showInterface(); }
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
            const res = await fetch(`${API_URL}/api/login`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ username: user_login.value, password: user_pass.value }) });
            if (res.ok) { 
                this.user = await res.json();
                localStorage.setItem('cn_user_data', JSON.stringify(this.user)); 
                this.showInterface(); 
            }
        };
        document.querySelectorAll('.nav-links li').forEach(li => li.onclick = () => this.navigate(li.dataset.page));
        document.querySelector('.btn-add').onclick = () => this.openAddModal();
        document.getElementById('main-search').oninput = (e) => this.filterTable(e.target.value.toLowerCase());
    },

    filterTable(q) {
        document.querySelectorAll("tbody tr").forEach(row => {
            row.style.display = row.innerText.toLowerCase().includes(q) ? "" : "none";
        });
    },

    showInterface() {
        document.getElementById('login-page').classList.remove('active');
        document.getElementById('main-interface').classList.add('active');
        this.navigate('servers');
    },

    async navigate(page) {
        this.currentPage = page;
        document.querySelectorAll('.nav-links li').forEach(l => l.classList.remove('active'));
        const nav = document.querySelector(`[data-page="${page}"]`);
        if (nav) nav.classList.add('active');
        document.getElementById('page-title').innerText = page.charAt(0).toUpperCase() + page.slice(1);
        const res = await fetch(`${API_URL}/api/${page}`);
        this.renderTable(page, await res.json());
    },

    renderTable(page, data) {
        const container = document.getElementById('content-render');
        let h = "";
        if (page === 'servers') {
            h = "<th>OS</th><th>ID</th><th>IP</th><th>Add IP</th><th>Hoster</th><th>Status</th><th>Group</th><th>Project</th><th>Country</th><th>Comments</th><th>Action</th>";
        } else if (page === 'domains') {
            h = "<th>Domain</th><th>Group</th><th>Status</th><th>NS Records</th><th>A Record</th><th>AAAA Record</th><th>Action</th>";
        }
        
        let rows = data.map(i => {
            if(page === 'servers') {
                const ips = i.additional_ip ? i.additional_ip.split(',').join(',<br>') : '-';
                return `<tr><td>${i.os}</td><td>${i.id}</td><td>${i.ip}</td><td style="line-height:1.6">${ips}</td><td>${i.hoster}</td><td><span class="status-${i.status.toLowerCase()}">${i.status}</span></td><td>${i.group}</td><td>${i.project}</td><td>${i.country}</td><td>${i.comments || ''}</td><td><button class="action-btn" onclick="app.openMenu('servers', ${i.id})">⋮</button></td></tr>`;
            }
            if(page === 'domains') {
                // Розбиваємо NS записи для відображення в стовпчик
                const ns_list = i.ns ? i.ns.split(',').join('<br>') : '-';
                return `<tr><td>${i.name}</td><td>${i.group}</td><td><span class="status-${i.status.toLowerCase().replace(' ', '')}">${i.status}</span></td><td style="font-size:12px">${ns_list}</td><td>${i.a_record || '-'}</td><td>${i.aaaa_record || '-'}</td><td><button class="action-btn" onclick="app.openMenu('domains', ${i.id})">⋮</button></td></tr>`;
            }
        }).join('');
        container.innerHTML = `<table><thead><tr>${h}</tr></thead><tbody>${rows}</tbody></table>`;
    },

    openMenu(type, id) {
        this.showModal("Actions", `<div class="action-menu">
            <button onclick="app.openUpdate('${type}', ${id})">Update</button>
            <button onclick="app.openDetails('${type}', ${id})">Details</button>
            <button onclick="app.openHistory('${type}', ${id})">History</button>
        </div>`);
    },

    async openDetails(type, id) {
        const s = await (await fetch(`${API_URL}/api/${type}/${id}`)).json();
        if (type === 'servers') {
            this.showModal("Details", `<div class="form-container"><p>User: ${s.ssh_user}</p><p>Pass: ${s.ssh_pass}</p><p>Cont Pass: ${s.cont_pass || '-'}</p><p>Port: ${s.ssh_port}</p><p>IP: ${s.ip}</p></div>`);
        } else {
            this.showModal("Details", `<div class="form-container"><p>Domain: ${s.name}</p><p>Group: ${s.group}</p><p>Status: ${s.status}</p></div>`);
        }
    },

    async openUpdate(type, id) {
        const s = await (await fetch(`${API_URL}/api/${type}/${id}`)).json();
        let fields = "";
        if (type === 'servers') {
            fields = `
                <input id="u_os" value="${s.os}" placeholder="OS">
                <input id="u_ip" value="${s.ip}" placeholder="IP">
                <input id="u_add_ip" value="${s.additional_ip || ''}" placeholder="Add IPs">
                <input id="u_hoster" value="${s.hoster || ''}" placeholder="Hoster">
                <input id="u_group" value="${s.group || ''}" placeholder="Group">
                <input id="u_project" value="${s.project || ''}" placeholder="Project">
                <input id="u_cont_pass" value="${s.cont_pass || ''}" placeholder="Cont Pass">
                <textarea id="u_comments" placeholder="Comments">${s.comments || ''}</textarea>`;
        } else {
            fields = `
                <input id="u_name" value="${s.name}" placeholder="Domain">
                <input id="u_group" value="${s.group}" placeholder="Group">
                <select id="u_status">
                    <option value="Active" ${s.status === 'Active' ? 'selected' : ''}>Active</option>
                    <option value="Suspended" ${s.status === 'Suspended' ? 'selected' : ''}>Suspended</option>
                    <option value="Abuse" ${s.status === 'Abuse' ? 'selected' : ''}>Abuse</option>
                    <option value="Maintaince" ${s.status === 'Maintaince' ? 'selected' : ''}>Maintaince</option>
                </select>`;
        }
        this.showModal("Update", `<div class="form-container">${fields}<button class="btn-save" onclick="app.saveUpdate('${type}', ${id})">Save Changes</button></div>`);
    },

    async saveUpdate(type, id) {
        let payload = { current_user: this.user.username };
        if (type === 'servers') {
            payload = { ...payload, os: u_os.value, ip: u_ip.value, additional_ip: u_add_ip.value, hoster: u_hoster.value, group: u_group.value, project: u_project.value, cont_pass: u_cont_pass.value, comments: u_comments.value };
        } else {
            payload = { ...payload, name: u_name.value, group: u_group.value, status: u_status.value };
        }
        await fetch(`${API_URL}/api/${type}/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
        this.closeModal(); this.navigate(type);
    },

    async openHistory(type, id) {
        const logs = await (await fetch(`${API_URL}/api/history/${type}/${id}`)).json();
        let list = logs.map(l => `<div style="padding:10px; border-bottom:1px solid #444"><small>${l.timestamp} | User: ${l.user}</small><br><b>${l.action}:</b> ${l.changes}</div>`).join('');
        this.showModal("History Logs", `<div class="history-list">${list || "No history"}</div>`);
    },

    openAddModal() {
        let f = this.currentPage === 'servers' ? 
            `<input id="n_os" placeholder="OS"><input id="n_ip" placeholder="IP"><input id="n_add_ip" placeholder="Add IPs"><input id="n_hoster" placeholder="Hoster"><input id="n_group" placeholder="Group"><input id="n_project" placeholder="Project"><input id="n_country" placeholder="Country"><input id="n_pass" placeholder="SSH Pass"><input id="n_cont_pass" placeholder="Cont Pass"><textarea id="n_comm" placeholder="Comments"></textarea>` :
            `<input id="n_name" placeholder="Domain Name (example.com)"><input id="n_group" placeholder="Group"><select id="n_status"><option value="Active">Active</option><option value="Suspended">Suspended</option><option value="Abuse">Abuse</option><option value="Maintaince">Maintaince</option></select>`;
        this.showModal("Add New", `<div class="form-container">${f}<button class="btn-save" onclick="app.saveNew()">Create</button></div>`);
    },

    async saveNew() {
        let p = { current_user: this.user.username };
        if (this.currentPage === 'servers') {
            p = { ...p, os: n_os.value, ip: n_ip.value, additional_ip: n_add_ip.value, hoster: n_hoster.value, group: n_group.value, project: n_project.value, country: n_country.value, ssh_pass: n_pass.value, cont_pass: n_cont_pass.value, comments: n_comm.value, status: "Running" };
        } else {
            p = { ...p, name: n_name.value, group: n_group.value, status: n_status.value };
        }
        await fetch(`${API_URL}/api/${this.currentPage}`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(p) });
        this.closeModal(); this.navigate(this.currentPage);
    },

    showModal(title, content) {
        document.getElementById('modal-title').innerText = title;
        document.getElementById('modal-content').innerHTML = content;
        document.getElementById('modal-overlay').style.display = 'block';
    },

    closeModal() { document.getElementById('modal-overlay').style.display = 'none'; }
};

window.onclick = (e) => { if (e.target.id === 'modal-overlay' || e.target.classList.contains('close-modal')) app.closeModal(); };
app.init();
