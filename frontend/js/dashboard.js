document.addEventListener("DOMContentLoaded", () => {
    const token = localStorage.getItem("token");
    if (!token) { window.location.href = "login.html"; return; }

    const username = localStorage.getItem("username");
    document.getElementById("userNameDisplay").innerText = username;

    // Default date to today
    const todayStr = new Date().toISOString().split("T")[0];
    document.getElementById("txDate").value = todayStr;

    // View refs
    const navDashboard = document.getElementById("navDashboard");
    const navGroups    = document.getElementById("navGroups");
    const navSettings  = document.getElementById("navSettings");
    const viewDashboard = document.getElementById("viewDashboard");
    const viewGroups    = document.getElementById("viewGroups");
    const viewSettings  = document.getElementById("viewSettings");
    const pageTitle     = document.getElementById("pageTitle");
    const txTbody       = document.getElementById("txTbody");
    const txCount       = document.getElementById("txCount");
    const txTotal       = document.getElementById("txTotal");
    const txVisibility  = document.getElementById("txVisibility");
    const groupsList    = document.getElementById("groupsList");
    let pieChart;
    let currentBudget = 0.0;
    let groupMap = {}; // groupId -> groupName

    // ── Helpers ──────────────────────────────────────────────────────────────
    function hideAllViews() {
        [viewDashboard, viewGroups, viewSettings].forEach(v => v.style.display = "none");
        [navDashboard, navGroups, navSettings].forEach(n => n.classList.remove("active"));
    }

    function generateId() {
        return typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : Date.now().toString(36) + Math.random().toString(36).substring(2);
    }

    async function authFetch(url, options = {}) {
        const headers = { "Content-Type": "application/json", "Authorization": `Bearer ${token}` };
        const res = await fetch(url, { ...options, headers });
        if (res.status === 401) logout();
        return res;
    }

    function updateBudgetBar(total) {
        const bar   = document.getElementById("budgetProgress");
        const label = document.getElementById("budgetLabel");
        if (currentBudget <= 0) {
            bar.style.width = "0%";
            bar.style.background = "var(--primary)";
            label.innerText = `₹${total.toFixed(0)} spent (no budget set)`;
            return;
        }
        const pct = Math.min((total / currentBudget) * 100, 100);
        bar.style.width = pct + "%";
        bar.style.background = pct >= 100 ? "#ef4444" : pct >= 80 ? "#f59e0b" : "var(--primary)";
        label.innerText = `₹${total.toFixed(0)} / ₹${currentBudget.toFixed(0)} (${Math.round(pct)}%)`;
    }

    function renderPieChart(categoryTotals) {
        const ctx = document.getElementById("pieChart");
        if (pieChart) pieChart.destroy();
        pieChart = new Chart(ctx, {
            type: "doughnut",
            data: {
                labels: Object.keys(categoryTotals),
                datasets: [{ data: Object.values(categoryTotals), backgroundColor: ["#4f46e5","#10b981","#f59e0b","#ef4444","#8b5cf6","#06b6d4"], borderWidth: 0 }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "right" } } }
        });
    }

    function renderTransactions(transactions) {
        txTbody.innerHTML = "";
        let total = 0;
        const categoryTotals = {};
        transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
        transactions.forEach(t => {
            total += t.amount;
            categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
            const spentBy = t.spent_by ? `<span style="font-size:11px;color:var(--text-muted);"> by ${t.spent_by}</span>` : "";
            const groupBadge = t.group_id && groupMap[t.group_id]
                ? `<span style="font-size:11px;background:#e0e7ff;color:#4f46e5;padding:2px 6px;border-radius:4px;margin-left:4px;">${groupMap[t.group_id]}</span>`
                : "";
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${t.title}${spentBy}${groupBadge}</td>
                <td><span style="background:var(--bg-color);padding:4px 8px;border-radius:4px;font-size:12px;">${t.category}</span></td>
                <td style="font-weight:600;">₹${t.amount.toFixed(2)}</td>
                <td style="color:var(--text-muted);">${t.date}</td>
                <td><button class="btn btn-danger" style="padding:4px 8px;font-size:12px;" onclick="deleteTx('${t.id}')">Delete</button></td>`;
            txTbody.appendChild(tr);
        });
        txCount.innerText = transactions.length;
        txTotal.innerText = `₹${total.toFixed(2)}`;
        updateBudgetBar(total);
        renderPieChart(categoryTotals);
    }

    // ── Nav Switching ─────────────────────────────────────────────────────────
    navDashboard.addEventListener("click", (e) => {
        e.preventDefault(); hideAllViews();
        viewDashboard.style.display = "block";
        navDashboard.classList.add("active");
        pageTitle.innerText = "Dashboard";
        fetchTransactions();
    });
    navGroups.addEventListener("click", (e) => {
        e.preventDefault(); hideAllViews();
        viewGroups.style.display = "block";
        navGroups.classList.add("active");
        pageTitle.innerText = "Groups Management";
        fetchGroups();
    });
    navSettings.addEventListener("click", (e) => {
        e.preventDefault(); hideAllViews();
        viewSettings.style.display = "block";
        navSettings.classList.add("active");
        pageTitle.innerText = "Settings";
        fetchUserProfile();
    });

    // ── WebSocket ─────────────────────────────────────────────────────────────
    let socket;
    function connectWebSocket() {
        if (socket) socket.close();
        socket = new WebSocket(`ws://127.0.0.1:8000/ws/${token}`);
        socket.onopen = () => console.log("WebSocket connected.");
        socket.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            if (msg.type === "new_expense") {
                showToast(`Live Update: ₹${msg.expense.amount} added to shared group!`, "success");
                fetchTransactions();
            }
        };
        socket.onclose = () => { console.log("WS disconnected. Retrying…"); setTimeout(connectWebSocket, 5000); };
    }
    connectWebSocket();

    // ── Data Fetching ─────────────────────────────────────────────────────────
    async function fetchTransactions() {
        try {
            const res = await authFetch(`${API_URL}/expenses`);
            renderTransactions(await res.json());
        } catch (e) { console.error(e); }
    }

    async function fetchUserProfile() {
        try {
            const res = await authFetch(`${API_URL}/user`);
            if (res.ok) {
                const data = await res.json();
                currentBudget = data.budget || 0.0;
                document.getElementById("budgetInput").value = currentBudget;
                fetchTransactions();
            }
        } catch (e) { console.error(e); }
    }

    async function fetchGroups() {
        try {
            const res = await authFetch(`${API_URL}/groups`);
            const data = await res.json();

            // Build id→name lookup map
            groupMap = {};
            data.forEach(g => { groupMap[g.id] = g.name; });

            let opts = '<option value="">Personal</option>';
            opts += data.map(g => `<option value="${g.id}">${g.name}</option>`).join("");
            txVisibility.innerHTML = opts;

            if (data.length === 0) {
                groupsList.innerHTML = "<p style='color:var(--text-muted);'>No groups yet.</p>";
            } else {
                groupsList.innerHTML = data.map(g => {
                    const isAdmin = g.admin === username;
                    const membersList = g.members.map(m => {
                        const kickBtn = (isAdmin && m !== username)
                            ? `<button class="btn btn-danger" style="padding:2px 6px;font-size:11px;margin-left:6px;" onclick="kickMember('${g.id}','${m}')">Remove</button>` : "";
                        return `<li>${m} ${m === g.admin ? "<strong>(Admin)</strong>" : ""} ${kickBtn}</li>`;
                    }).join("");

                    const adminControls = isAdmin ? `
                        <div style="margin-top:10px;padding:10px;background:#e0e7ff;border-radius:6px;">
                            <strong>Join Key:</strong>
                            <span style="font-family:monospace;font-size:18px;font-weight:bold;letter-spacing:3px;color:var(--primary);margin-left:8px;">${g.join_key}</span>
                            <br>
                            <button class="btn btn-danger" style="margin-top:10px;padding:5px 10px;font-size:12px;" onclick="deleteGroup('${g.id}')">Delete Group</button>
                            <button class="btn" style="margin-top:10px;margin-left:8px;padding:5px 10px;font-size:12px;background:#f59e0b;color:white;" onclick="leaveGroup('${g.id}')">Leave & Transfer</button>
                        </div>` : `
                        <button class="btn btn-danger" style="padding:5px 10px;font-size:12px;" onclick="leaveGroup('${g.id}')">Leave Group</button>`;

                    return `
                    <div style="padding:15px;border:1px solid var(--border);border-radius:8px;margin-bottom:15px;background:white;">
                        <h3 style="margin-bottom:8px;">${g.name}</h3>
                        <ul style="color:var(--text-muted);font-size:14px;padding-left:20px;margin-bottom:10px;">${membersList}</ul>
                        ${adminControls}
                    </div>`;
                }).join("");
            }
        } catch (e) { console.error(e); }
    }

    // ── Transaction Actions ───────────────────────────────────────────────────
    document.getElementById("txForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const tx = {
            id: generateId(),
            title: document.getElementById("txTitle").value,
            amount: parseFloat(document.getElementById("txAmount").value),
            category: document.getElementById("txCategory").value,
            date: document.getElementById("txDate").value,
            spent_by: document.getElementById("txSpentBy").value.trim(),
            group_id: document.getElementById("txVisibility").value || null
        };
        const res = await authFetch(`${API_URL}/expense`, { method: "POST", body: JSON.stringify(tx) });
        if (res.ok) {
            showToast("Transaction added!"); document.getElementById("txForm").reset(); fetchTransactions();
        } else {
            showToast("Failed to add transaction", "error");
        }
    });

    window.deleteTx = async (id) => {
        if (!confirm("Delete this transaction?")) return;
        const res = await authFetch(`${API_URL}/expense/${id}`, { method: "DELETE" });
        if (res.ok) { showToast("Transaction deleted"); fetchTransactions(); }
    };

    // ── Group Actions ─────────────────────────────────────────────────────────
    document.getElementById("createGroupBtn").addEventListener("click", async () => {
        const name = document.getElementById("newGroupName").value.trim();
        if (!name) return;
        const res = await authFetch(`${API_URL}/groups`, {
            method: "POST",
            body: JSON.stringify({ id: generateId(), name, admin: username, join_key: "", members: [] })
        });
        const data = await res.json();
        if (res.ok) {
            showToast(`Group created! Join Key: ${data.join_key}`);
            document.getElementById("newGroupName").value = "";
            fetchGroups();
        } else { showToast(data.detail || "Failed to create group", "error"); }
    });

    document.getElementById("joinGroupBtn").addEventListener("click", async () => {
        const joinKey = document.getElementById("joinGroupKey").value.trim();
        if (!joinKey) return;
        const res = await authFetch(`${API_URL}/groups/join`, { method: "POST", body: JSON.stringify({ join_key: joinKey }) });
        const data = await res.json();
        if (res.ok) {
            showToast(data.message); document.getElementById("joinGroupKey").value = ""; fetchGroups();
        } else { showToast(data.detail || "Invalid Join Key", "error"); }
    });

    window.kickMember = async (groupId, targetUsername) => {
        if (!confirm(`Remove ${targetUsername} from the group?`)) return;
        const res = await authFetch(`${API_URL}/groups/${groupId}/members/${targetUsername}`, { method: "DELETE" });
        const data = await res.json();
        res.ok ? (showToast("Member removed"), fetchGroups()) : showToast(data.detail || "Failed", "error");
    };

    window.deleteGroup = async (groupId) => {
        if (!confirm("Permanently delete this group?")) return;
        const res = await authFetch(`${API_URL}/groups/${groupId}`, { method: "DELETE" });
        const data = await res.json();
        res.ok ? (showToast("Group deleted"), fetchGroups()) : showToast(data.detail || "Failed", "error");
    };

    window.leaveGroup = async (groupId) => {
        if (!confirm("Are you sure you want to leave this group? If you are the admin, ownership will be transferred.")) return;
        const res = await authFetch(`${API_URL}/groups/${groupId}/leave`, { method: "DELETE" });
        const data = await res.json();
        res.ok ? (showToast(data.message), fetchGroups()) : showToast(data.detail || "Failed to leave group", "error");
    };

    // ── Budget Settings ───────────────────────────────────────────────────────
    document.getElementById("budgetForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const budget = parseFloat(document.getElementById("budgetInput").value);
        const res = await authFetch(`${API_URL}/user/budget`, { method: "PUT", body: JSON.stringify({ budget }) });
        const data = await res.json();
        if (res.ok) {
            showToast("Budget updated!"); currentBudget = data.budget; fetchTransactions();
        } else { showToast(data.detail || "Failed to update budget", "error"); }
    });

    // ── Init ──────────────────────────────────────────────────────────────────
    fetchUserProfile();
    fetchGroups();
});
