const API = "/api";
let BOOKS = [];

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

const toast = (msg) => {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("show"), 2200);
};

const money = (n) => "₹" + Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const stockBadge = (n) => {
  if (n === 0) return `<span class="badge bad">Out</span>`;
  if (n < 5) return `<span class="badge warn">Low · ${n}</span>`;
  return `<span class="badge good">${n}</span>`;
};

const coverStyle = (b) => b.cover
  ? `style="background-image:url('${b.cover}')"`
  : `style=""`;

async function api(path, opts = {}) {
  const res = await fetch(API + path, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.status === 204 ? null : res.json();
}

/* ---------- views ---------- */
const VIEWS = {
  dashboard: { title: "Dashboard", sub: "Live overview of your bookstore" },
  inventory: { title: "Inventory", sub: "Manage your full catalog" },
  add: { title: "Add Book", sub: "Add a new title to inventory" },
};
function showView(name) {
  $$(".view").forEach(v => v.classList.add("hidden"));
  $("#view-" + name).classList.remove("hidden");
  $$(".nav-item").forEach(n => n.classList.toggle("active", n.dataset.view === name));
  $("#view-title").textContent = VIEWS[name].title;
  $("#view-subtitle").textContent = VIEWS[name].sub;
  if (name === "add" && !$("#book-form").dataset.editing) resetForm();
}

$$(".nav-item").forEach(n => n.onclick = () => showView(n.dataset.view));
document.addEventListener("click", e => {
  const j = e.target.closest("[data-jump]");
  if (j) showView(j.dataset.jump);
});

/* ---------- render ---------- */
function renderStats(s) {
  $("#s-titles").textContent = s.titles;
  $("#s-units").textContent = s.units;
  $("#s-value").textContent = money(s.value);
  $("#s-alert").textContent = `${s.low_stock} / ${s.out_of_stock}`;

  const sel = $("#genre-filter");
  const cur = sel.value;
  sel.innerHTML = `<option value="">All genres</option>` +
    s.genres.map(g => `<option value="${g.genre}">${g.genre} (${g.c})</option>`).join("");
  sel.value = cur;
}

function renderRecent() {
  const recent = BOOKS.slice(0, 6);
  $("#recent-grid").innerHTML = recent.map(b => `
    <div class="book-card" data-edit="${b.id}">
      <div class="cover" ${coverStyle(b)}>${b.cover ? "" : "📖"}</div>
      <div class="meta">
        <h4>${escapeHtml(b.title)}</h4>
        <p>${escapeHtml(b.author)}</p>
        <div class="row"><span class="price">${money(b.price)}</span>${stockBadge(b.stock)}</div>
      </div>
    </div>`).join("") || `<p class="muted">No books yet.</p>`;
}

function renderTable() {
  const tbody = $("#books-table tbody");
  tbody.innerHTML = BOOKS.map(b => `
    <tr>
      <td><div class="thumb" ${coverStyle(b)}></div></td>
      <td><strong>${escapeHtml(b.title)}</strong><br><small class="muted">${b.isbn || ""}</small></td>
      <td>${escapeHtml(b.author)}</td>
      <td>${escapeHtml(b.genre || "—")}</td>
      <td>${money(b.price)}</td>
      <td>${stockBadge(b.stock)}</td>
      <td><div class="row-actions">
        <button class="btn icon" data-stock="${b.id}" data-delta="-1">−</button>
        <button class="btn icon" data-stock="${b.id}" data-delta="1">＋</button>
        <button class="btn icon" data-edit="${b.id}">Edit</button>
        <button class="btn icon danger" data-del="${b.id}">✕</button>
      </div></td>
    </tr>`).join("") || `<tr><td colspan="7" class="muted" style="text-align:center;padding:30px">No books match.</td></tr>`;
}

const escapeHtml = (s = "") => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ---------- load ---------- */
async function loadAll() {
  const q = $("#search").value;
  const genre = $("#genre-filter").value;
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (genre) params.set("genre", genre);
  const [books, stats] = await Promise.all([
    api("/books?" + params.toString()),
    api("/stats"),
  ]);
  BOOKS = books;
  renderStats(stats);
  renderRecent();
  renderTable();
}

/* ---------- events ---------- */
let searchT;
$("#search").addEventListener("input", () => {
  clearTimeout(searchT);
  searchT = setTimeout(loadAll, 200);
});
$("#genre-filter").addEventListener("change", loadAll);

document.addEventListener("click", async e => {
  const stockBtn = e.target.closest("[data-stock]");
  if (stockBtn) {
    await api(`/books/${stockBtn.dataset.stock}/stock`, {
      method: "PATCH",
      body: JSON.stringify({ delta: Number(stockBtn.dataset.delta) }),
    });
    toast("Stock updated");
    loadAll();
    return;
  }
  const editBtn = e.target.closest("[data-edit]");
  if (editBtn) {
    const b = BOOKS.find(x => x.id == editBtn.dataset.edit);
    if (b) openEdit(b);
    return;
  }
  const delBtn = e.target.closest("[data-del]");
  if (delBtn && confirm("Delete this book?")) {
    await api(`/books/${delBtn.dataset.del}`, { method: "DELETE" });
    toast("Deleted");
    loadAll();
  }
});

/* ---------- form ---------- */
function resetForm() {
  const f = $("#book-form");
  f.reset();
  f.id.value = "";
  delete f.dataset.editing;
  $("#form-title").textContent = "Add a new book";
}
function openEdit(b) {
  showView("add");
  const f = $("#book-form");
  f.dataset.editing = "1";
  $("#form-title").textContent = "Edit book";
  for (const k of ["id", "title", "author", "genre", "isbn", "price", "stock", "cover"]) {
    if (f[k]) f[k].value = b[k] ?? "";
  }
}
$("#cancel-edit").onclick = () => { resetForm(); showView("dashboard"); };

$("#book-form").addEventListener("submit", async e => {
  e.preventDefault();
  const f = e.target;
  const data = Object.fromEntries(new FormData(f));
  const id = data.id;
  delete data.id;
  if (id) {
    await api(`/books/${id}`, { method: "PUT", body: JSON.stringify(data) });
    toast("Book updated");
  } else {
    await api("/books", { method: "POST", body: JSON.stringify(data) });
    toast("Book added");
  }
  resetForm();
  showView("inventory");
  loadAll();
});

loadAll();
