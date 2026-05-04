/* Smart Expense Tracker - LocalStorage + Filters + Charts */
(function () {
  const LS_KEY = 'smart_expense_transactions_v1';
  const LS_BUDGET_KEY = 'smart_expense_budget_v1';

  // Elements
  const txForm = document.getElementById('txForm');
  const titleEl = document.getElementById('txTitle');
  const amountEl = document.getElementById('txAmount');
  const categoryEl = document.getElementById('txCategory');
  const dateEl = document.getElementById('txDate');
  const notesEl = document.getElementById('txNotes');

  const tbody = document.getElementById('txTbody');
  const rowTemplate = document.getElementById('rowTemplate');

  const searchBox = document.getElementById('searchBox');
  const fromDate = document.getElementById('fromDate');
  const toDate = document.getElementById('toDate');
  const catFilter = document.getElementById('catFilter');
  const clearFiltersBtn = document.getElementById('clearFilters');

  const txCount = document.getElementById('txCount');
  const txTotal = document.getElementById('txTotal');

  const budgetAmount = document.getElementById('budgetAmount');
  const saveBudgetBtn = document.getElementById('saveBudgetBtn');
  const spentThisMonth = document.getElementById('spentThisMonth');
  const remainingBudget = document.getElementById('remainingBudget');
  const budgetProgress = document.getElementById('budgetProgress');

  const exportBtn = document.getElementById('exportBtn');
  const importFile = document.getElementById('importFile');

  const editDialog = document.getElementById('editDialog');
  const editForm = document.getElementById('editForm');
  const editId = document.getElementById('editId');
  const editTitle = document.getElementById('editTitle');
  const editAmount = document.getElementById('editAmount');
  const editCategory = document.getElementById('editCategory');
  const editDate = document.getElementById('editDate');
  const editNotes = document.getElementById('editNotes');

  const pieCanvas = document.getElementById('pieChart');
  const lineCanvas = document.getElementById('lineChart');
  const usernameInput = document.getElementById('usernameInput');
  const passwordInput = document.getElementById('passwordInput');
  const loginBtn = document.getElementById('loginBtn');
  const signupBtn = document.getElementById('signupBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const groupsSection = document.getElementById('groupsSection');
  const groupsList = document.getElementById('groupsList');
  const newGroupName = document.getElementById('newGroupName');
  const createGroupBtn = document.getElementById('createGroupBtn');
  const addMemberGroupId = document.getElementById('addMemberGroupId');
  const newMemberUsername = document.getElementById('newMemberUsername');
  const addMemberBtn = document.getElementById('addMemberBtn');
  const txVisibility = document.getElementById('txVisibility');
  let groups = [];

  // Try to load token from LocalStorage on startup
  let token = localStorage.getItem('token');

  // State
  let transactions = [];
  const API_URL = "http://127.0.0.1:8000";
  let budget = load(LS_BUDGET_KEY, { amount: 0 });

  // Initialize date inputs defaults
  dateEl.valueAsDate = new Date();
  // Filters default to current month
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  fromDate.valueAsDate = firstOfMonth;
  toDate.valueAsDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  budgetAmount.value = budget.amount || '';

  // Charts
  let pieChart, lineChart;

  function load(key, fallback) {
    try {
      const v = JSON.parse(localStorage.getItem(key));
      return v ?? fallback;
    } catch (e) {
      console.warn('LocalStorage parse error', e);
      return fallback;
    }
  }

  function save(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function currency(n) {
    const val = Number(n || 0);
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: guessCurrency() }).format(val);
  }

  function guessCurrency() {
    // Try to infer from locale, default to INR
    try {
      const code = (Intl.NumberFormat().resolvedOptions().currency) || 'INR';
      return code;
    } catch (e) {
      return 'INR';
    }
  }

  function uid() { return crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()); }

  function toISODate(d) {
    const dd = new Date(d);
    const tzOff = dd.getTimezoneOffset();
    const local = new Date(dd.getTime() - tzOff * 60000);
    return local.toISOString().slice(0, 10);
  }

  function parseAmount(x) {
    const n = Number(x);
    return isFinite(n) ? n : 0;
  }

  function getHeaders() {
    return {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    };
  }

  async function fetchTransactions() {
    if (!token) return; // Stop if not logged in
    try {
      const res = await fetch(`${API_URL}/expenses`, { headers: getHeaders() });
      if (res.status === 401) {
        alert("Session expired. Please log in.");
        logout();
        return;
      }
      transactions = await res.json();
      render();
    } catch (e) {
      console.error("Failed to fetch expenses", e);
    }
  }

  async function addTx(tx) {
    if (!token) return alert("Please log in first!");
    // Attach the logged-in user's username to the expense
    tx.user_id = usernameInput.value || "unknown";

    await fetch(`${API_URL}/expense`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(tx)
    });
    await fetchTransactions();
  }

  async function deleteTx(id) {
    await fetch(`${API_URL}/expense/${id}`, {
      method: "DELETE",
      headers: getHeaders()
    });
    await fetchTransactions();
  }

  async function updateTx(id, next) {
    const idx = transactions.findIndex(t => t.id === id);
    if (idx >= 0) {
      const updatedTx = { ...transactions[idx], ...next };
      await fetch(`${API_URL}/expense/${id}`, {
        method: "PUT",
        headers: getHeaders(),
        body: JSON.stringify(updatedTx)
      });
      await fetchTransactions();
    }
  }


  function getFiltered() {
    const q = (searchBox.value || '').trim().toLowerCase();
    const cf = catFilter.value;
    const fd = fromDate.value ? new Date(fromDate.value) : null;
    const td = toDate.value ? new Date(toDate.value) : null;

    return transactions.filter(t => {
      const matchQ = !q || (t.title.toLowerCase().includes(q) || (t.notes || '').toLowerCase().includes(q));
      const matchCat = !cf || t.category === cf;
      const d = new Date(t.date);
      const matchFrom = !fd || d >= new Date(fd.getFullYear(), fd.getMonth(), fd.getDate());
      const matchTo = !td || d <= new Date(td.getFullYear(), td.getMonth(), td.getDate(), 23, 59, 59);
      return matchQ && matchCat && matchFrom && matchTo;
    });
  }

  function render() {
    const list = getFiltered().sort((a, b) => new Date(b.date) - new Date(a.date));

    // table
    tbody.innerHTML = '';
    for (const t of list) {
      const tr = rowTemplate.content.firstElementChild.cloneNode(true);
      tr.dataset.id = t.id;
      tr.querySelector('[data-col="title"]').textContent = t.title;
      tr.querySelector('[data-col="category"]').textContent = t.category;
      tr.querySelector('[data-col="amount"]').textContent = currency(t.amount);
      tr.querySelector('[data-col="date"]').textContent = toISODate(t.date);
      tr.querySelector('[data-col="notes"]').textContent = t.notes || '';
      tr.querySelector('.edit').addEventListener('click', () => openEdit(t));
      tr.querySelector('.delete').addEventListener('click', () => {
        if (confirm('Delete this transaction?')) deleteTx(t.id);
      });
      tbody.appendChild(tr);
    }

    // meta
    txCount.textContent = String(list.length);
    const total = list.reduce((s, t) => s + parseAmount(t.amount), 0);
    txTotal.textContent = currency(total);

    // budget progress for current month
    const monthSpent = sumForMonth(transactions, new Date());
    spentThisMonth.textContent = currency(monthSpent);
    const bAmt = parseAmount(budget.amount);
    const remaining = Math.max(0, bAmt - monthSpent);
    remainingBudget.textContent = currency(remaining);
    const pct = bAmt > 0 ? Math.min(100, (monthSpent / bAmt) * 100) : 0;
    budgetProgress.style.width = pct + '%';
    budgetProgress.style.background = monthSpent > bAmt ? 'linear-gradient(90deg, var(--danger), #ef4444)' : '';
    budgetProgress.title = `${pct.toFixed(1)}% of budget used`;

    // charts
    renderPie(list);
    renderLine(transactions);
  }

  function sumForMonth(items, when) {
    const y = when.getFullYear(), m = when.getMonth();
    return items.filter(t => {
      const d = new Date(t.date);
      return d.getFullYear() === y && d.getMonth() === m;
    }).reduce((s, t) => s + parseAmount(t.amount), 0);
  }

  function groupByCategory(items) {
    const map = {};
    for (const t of items) {
      map[t.category] = (map[t.category] || 0) + parseAmount(t.amount);
    }
    return map;
  }

  function renderPie(items) {
    const map = groupByCategory(items);
    const labels = Object.keys(map);
    const data = Object.values(map);

    if (pieChart) { pieChart.destroy(); }
    pieChart = new Chart(pieCanvas, {
      type: 'pie',
      data: {
        labels,
        datasets: [{ data }]
      },
      options: {
        plugins: {
          legend: { position: 'bottom', labels: { color: '#e5e7eb' } },
          tooltip: { callbacks: { label: ctx => `${ctx.label}: ${currency(ctx.parsed)}` } }
        }
      }
    });
  }

  function renderLine(items) {
    // Aggregate by month (YYYY-MM)
    const map = {};
    for (const t of items) {
      const d = new Date(t.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      map[key] = (map[key] || 0) + parseAmount(t.amount);
    }
    const labels = Object.keys(map).sort();
    const data = labels.map(k => map[k]);

    if (lineChart) { lineChart.destroy(); }
    lineChart = new Chart(lineCanvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{ label: 'Spend', data, tension: .2 }]
      },
      options: {
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => currency(ctx.parsed.y) } }
        },
        scales: {
          x: { ticks: { color: '#e5e7eb' }, grid: { color: 'rgba(148,163,184,.2)' } },
          y: { ticks: { color: '#e5e7eb' }, grid: { color: 'rgba(148,163,184,.2)' } }
        }
      }
    });
  }
  async function fetchGroups() {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/groups`, { headers: getHeaders() });
      groups = await res.json();
      renderGroups();
    } catch (e) {
      console.error(e);
    }
  }

  function renderGroups() {
    // Show text list of groups
    groupsList.innerHTML = groups.length ?
      groups.map(g => `<b>${g.name}</b> (${g.members.length} members)`).join(' | ')
      : '<p>No groups yet.</p>';

    // Update both dropdowns
    const optionsHtml = '<option value="">Personal</option>' +
      groups.map(g => `<option value="${g.id}">${g.name}</option>`).join('');

    txVisibility.innerHTML = optionsHtml;
    addMemberGroupId.innerHTML = groups.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
  }
  // --- WEBSOCKET CONNECTION ---
  let socket;
  function connectWebSocket() {
    if (socket) socket.close();

    socket = new WebSocket(`ws://127.0.0.1:8000/ws/${token}`);

    // NEW: Debugging logs to see if the connection is alive!
    socket.onopen = () => console.log("🟢 WebSocket Connected!");
    socket.onclose = () => console.log("🔴 WebSocket Disconnected!");
    socket.onerror = (err) => console.error("⚠️ WebSocket Error!", err);

    socket.onmessage = function (event) {
      const message = JSON.parse(event.data);
      if (message.type === "new_expense") {
        console.log("🔥 Live update received!", message.expense);
        fetchTransactions();
        alert(`A friend just added a ₹${message.expense.amount} group expense for ${message.expense.title}!`);
      }
    };
  }


  // Handlers
  loginBtn.addEventListener('click', async () => {
    const res = await fetch(`${API_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: usernameInput.value, password: passwordInput.value })
    });
    if (res.ok) {
      const data = await res.json();
      token = data.access_token;
      localStorage.setItem('token', token);
      alert("Logged in!");
      fetchTransactions();
      updateAuthUI();
    } else {
      alert("Login failed. Check username and password.");
    }
  });

  signupBtn.addEventListener('click', async () => {
    const res = await fetch(`${API_URL}/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: usernameInput.value, password: passwordInput.value })
    });
    if (res.ok) {
      alert("Signed up successfully! You can now log in.");
    } else {
      alert("Signup failed. Username might be taken.");
    }
  });

  logoutBtn.addEventListener('click', logout);

  function logout() {
    token = null;
    localStorage.removeItem('token');
    transactions = [];
    render();
    updateAuthUI();
  }

  function updateAuthUI() {
    if (token) {
      loginBtn.style.display = 'none';
      signupBtn.style.display = 'none';
      usernameInput.style.display = 'none';
      passwordInput.style.display = 'none';
      logoutBtn.style.display = 'inline-block';
      groupsSection.style.display = 'block';
      fetchGroups();
      connectWebSocket(); // NEW: Connect to live updates!
    } else {
      loginBtn.style.display = 'inline-block';
      signupBtn.style.display = 'inline-block';
      usernameInput.style.display = 'inline-block';
      passwordInput.style.display = 'inline-block';
      logoutBtn.style.display = 'none';
      groupsSection.style.display = 'none';
      groups = [];
      if (socket) socket.close(); // NEW: Close live updates!
    }
  }

  createGroupBtn.addEventListener('click', async () => {
    if (!newGroupName.value.trim()) return;
    const group = { id: uid(), name: newGroupName.value.trim(), members: [] };

    const res = await fetch(`${API_URL}/groups`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(group)
    });
    if (res.ok) {
      newGroupName.value = '';
      fetchGroups(); // refresh groups
    }
  });

  addMemberBtn.addEventListener('click', async () => {
    const groupId = addMemberGroupId.value;
    const username = newMemberUsername.value.trim();
    if (!groupId || !username) return;

    const res = await fetch(`${API_URL}/groups/${groupId}/members`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ username: username })
    });
    if (res.ok) {
      newMemberUsername.value = '';
      fetchGroups();
      alert(`Added ${username} to group!`);
    } else {
      alert("Failed to add user. Are you sure they signed up?");
    }
  });


  // Call this right away to setup the UI correctly
  updateAuthUI();

  txForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const tx = {
      id: uid(),
      title: titleEl.value.trim(),
      amount: parseAmount(amountEl.value),
      category: categoryEl.value,
      date: toISODate(dateEl.value || new Date()),
      notes: notesEl.value.trim(),
      group_id: txVisibility.value || null // NEW: Save group selection!
    };
    if (!tx.title || !tx.category || !tx.date) {
      alert('Please fill in title, category, and date.');
      return;
    }
    addTx(tx);
    txForm.reset();
    dateEl.valueAsDate = new Date();
  });


  [searchBox, fromDate, toDate, catFilter].forEach(el => {
    el.addEventListener('input', render);
    el.addEventListener('change', render);
  });

  clearFiltersBtn.addEventListener('click', () => {
    searchBox.value = '';
    fromDate.value = '';
    toDate.value = '';
    catFilter.value = '';
    render();
  });

  saveBudgetBtn.addEventListener('click', () => {
    const amt = parseAmount(budgetAmount.value);
    budget = { amount: amt };
    save(LS_BUDGET_KEY, budget);
    render();
  });

  exportBtn.addEventListener('click', () => {
    const data = {
      exportedAt: new Date().toISOString(),
      budget,
      transactions
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'expense_backup.json';
    a.click();
    URL.revokeObjectURL(url);
  });

  importFile.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (Array.isArray(data)) { // legacy array-only structure
        transactions = data;
      } else {
        if (Array.isArray(data.transactions)) transactions = data.transactions;
        if (data.budget && typeof data.budget.amount !== 'undefined') budget = { amount: parseAmount(data.budget.amount) };
      }
      save(LS_KEY, transactions);
      save(LS_BUDGET_KEY, budget);
      render();
      alert('Import complete.');
    } catch (err) {
      console.error(err);
      alert('Invalid JSON file.');
    } finally {
      importFile.value = '';
    }
  });

  function openEdit(t) {
    editId.value = t.id;
    editTitle.value = t.title;
    editAmount.value = t.amount;
    editCategory.value = t.category;
    editDate.value = toISODate(t.date);
    editNotes.value = t.notes || '';
    editDialog.showModal();
  }

  editForm.addEventListener('close', () => {
    if (editForm.returnValue === 'save') {
      const id = editId.value;
      updateTx(id, {
        title: editTitle.value.trim(),
        amount: parseAmount(editAmount.value),
        category: editCategory.value,
        date: toISODate(editDate.value),
        notes: editNotes.value.trim()
      });
    }
  });

  // Initial render
  fetchTransactions();
})();