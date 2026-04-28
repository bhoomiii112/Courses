/* ════════════════════════════════════════════════════════════
   app.js  — CourseAPI Dashboard
   Wired to FastAPI routes (routes.py):
     GET    /courses
     GET    /courses/{id}
     POST   /create_course
     PUT    /update_course/{id}
     DELETE /delete_course/{id}
     GET    /query_courses  (with query params)
     GET    /courses?page=&limit=   (pagination)
   ════════════════════════════════════════════════════════════ */

'use strict';

// ── State ──────────────────────────────────────────────────
let editingId   = null;   // null = create, number = update
let allCourses  = [];     // cache for card rendering

// accent color cycling per card
const ACCENTS = ['', 'teal', 'rose', 'blue', 'amber'];

// ── Helpers ────────────────────────────────────────────────
const BASE = () => document.getElementById('baseUrl').value.replace(/\/$/, '');

/** Compute price_category — mirrors Pydantic computed_field */
function priceCategory(price) {
  if (price < 599)  return 'Budget';
  if (price < 999)  return 'Mid-range';
  return 'Premium';
}

/** title-case — mirrors field_validator clean_title / instructor_name */
function toTitleCase(str) {
  return String(str).replace(/\w\S*/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase());
}

// ── API Status indicator ───────────────────────────────────
function setStatus(state) {
  const el = document.getElementById('apiStatus');
  const states = {
    idle:    '<span class="dot dot-idle"></span> Idle',
    loading: '<span class="dot dot-loading"></span> Loading…',
    ok:      '<span class="dot dot-ok"></span> OK',
    error:   '<span class="dot dot-error"></span> Error',
  };
  el.innerHTML = states[state] || states.idle;
}

// ── Core fetch wrapper ─────────────────────────────────────
async function api(method, path, body = null) {
  setStatus('loading');
  try {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(BASE() + path, opts);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || `HTTP ${res.status}`);
    }
    setStatus('ok');
    return data;
  } catch (err) {
    setStatus('error');
    throw err;
  }
}

// ══════════════════════════════════════════════════════════
//  VIEW SWITCHING
// ══════════════════════════════════════════════════════════
const VIEW_META = {
  courses:  { title: 'All Courses',    sub: 'GET /courses' },
  filter:   { title: 'Query & Filter', sub: 'GET /query_courses' },
  paginate: { title: 'Pagination',     sub: 'GET /courses?page=&limit=' },
};

function switchView(view, btn) {
  // update nav
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  // update sections
  document.querySelectorAll('.view').forEach(s => {
    s.classList.toggle('active', s.id === 'view-' + view);
    s.classList.toggle('hidden', s.id !== 'view-' + view);
  });

  // update topbar
  document.getElementById('viewTitle').textContent = VIEW_META[view].title;
  document.getElementById('viewSub').textContent   = VIEW_META[view].sub;

  // auto-load
  if (view === 'courses') loadCourses();
  if (view === 'paginate') runPaginate();
}

// ══════════════════════════════════════════════════════════
//  GET /courses  — load all
// ══════════════════════════════════════════════════════════
async function loadCourses() {
  const grid  = document.getElementById('coursesGrid');
  const empty = document.getElementById('emptyState');

  grid.innerHTML = `<div class="skeleton-grid">
    <div class="skeleton-card"></div>
    <div class="skeleton-card"></div>
    <div class="skeleton-card"></div>
  </div>`;
  empty.classList.add('hidden');

  try {
    const data = await api('GET', '/courses');
    allCourses = Array.isArray(data) ? data : [];
    document.getElementById('totalCount').textContent = allCourses.length;
    renderCards(allCourses, 'coursesGrid', 'emptyState');
  } catch (err) {
    grid.innerHTML = '';
    toast(`Failed to load courses: ${err.message}`, 'error');
  }
}

function refreshCourses() { loadCourses(); }

// ══════════════════════════════════════════════════════════
//  Card renderer (shared between all views)
// ══════════════════════════════════════════════════════════
function renderCards(courses, gridId, emptyId) {
  const grid  = document.getElementById(gridId);
  const empty = document.getElementById(emptyId);

  if (!courses || courses.length === 0) {
    grid.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  grid.innerHTML = courses.map((c, i) => {
    const accent   = ACCENTS[i % ACCENTS.length];
    const catClass = priceCategory(c.price);
    const pub      = c.is_published;
    const discount = parseFloat(c.discount_percent) || 0;

    return `
    <article class="course-card" onclick="openDrawer(${c.id})" style="animation-delay:${i * 40}ms">
      <div class="card-accent ${accent}"></div>
      <div class="card-body">
        <div class="card-top">
          <span class="card-category">${c.category || '—'}</span>
          <span class="status-pill ${pub ? 'on' : 'off'}">${pub ? '● Live' : '○ Draft'}</span>
        </div>
        <div class="id-badge">#${c.id}</div>
        <div class="card-title">${c.title}</div>
        <div class="card-instructor">by ${c.instructor}</div>
        <div class="card-stats">
          <div class="stat-box">
            <div class="stat-lbl">Price</div>
            <div class="stat-val">₹${Number(c.price).toLocaleString('en-IN')}</div>
          </div>
          <div class="stat-box">
            <div class="stat-lbl">Duration</div>
            <div class="stat-val">${c.duration_hours}h</div>
          </div>
        </div>
        <span class="price-badge ${catClass}">${catClass}</span>
        ${discount > 0 ? `<span class="price-badge" style="background:var(--rose-bg);color:var(--rose);margin-left:6px;">−${discount}%</span>` : ''}
      </div>
      <div class="card-footer" onclick="event.stopPropagation()">
        <button class="btn btn-teal btn-sm" onclick="openModal(${c.id})">Edit</button>
        <button class="btn btn-rose btn-sm" onclick="confirmDelete(${c.id}, '${c.title.replace(/'/g,"\\'")}')">Delete</button>
      </div>
    </article>`;
  }).join('');
}

// ══════════════════════════════════════════════════════════
//  GET /courses/{id}  — Detail Drawer
// ══════════════════════════════════════════════════════════
async function openDrawer(id) {
  const overlay = document.getElementById('drawerOverlay');
  const content = document.getElementById('drawerContent');
  content.innerHTML = `<div style="color:var(--text-3);padding:40px 0;text-align:center">Loading…</div>`;
  overlay.classList.remove('hidden');

  try {
    // GET /courses/{id} returns an array (see routes.py)
    const data = await api('GET', `/courses/${id}`);
    const c = Array.isArray(data) ? data[0] : data;
    const catClass = priceCategory(c.price);
    const discount = parseFloat(c.discount_percent) || 0;

    content.innerHTML = `
      <span class="card-category" style="display:inline-block;margin-bottom:12px">${c.category}</span>
      <div class="drawer-title">${c.title}</div>
      <div class="drawer-instructor">by ${c.instructor}</div>

      <div class="drawer-section">
        <div class="drawer-section-title">Pricing</div>
        <div class="drawer-row"><span class="drawer-key">Price</span><span class="drawer-val">₹${Number(c.price).toLocaleString('en-IN')}</span></div>
        <div class="drawer-row"><span class="drawer-key">Tier</span><span class="drawer-val"><span class="price-badge ${catClass}">${catClass}</span></span></div>
        <div class="drawer-row"><span class="drawer-key">Discount</span><span class="drawer-val">${discount > 0 ? discount + '%' : 'None'}</span></div>
      </div>

      <div class="drawer-section">
        <div class="drawer-section-title">Details</div>
        <div class="drawer-row"><span class="drawer-key">Duration</span><span class="drawer-val">${c.duration_hours}h</span></div>
        <div class="drawer-row"><span class="drawer-key">Status</span><span class="drawer-val">${c.is_published ? '● Published' : '○ Draft'}</span></div>
        <div class="drawer-row"><span class="drawer-key">ID</span><span class="drawer-val">#${c.id}</span></div>
      </div>

      <div class="drawer-actions">
        <button class="btn btn-teal btn-sm" onclick="closeDrawer(); openModal(${c.id})">Edit</button>
        <button class="btn btn-rose btn-sm" onclick="closeDrawer(); confirmDelete(${c.id}, '${c.title.replace(/'/g,"\\'")}')">Delete</button>
      </div>`;
  } catch (err) {
    content.innerHTML = `<div style="color:var(--rose);padding:20px 0">Error: ${err.message}</div>`;
  }
}

function closeDrawer() {
  document.getElementById('drawerOverlay').classList.add('hidden');
}

// ══════════════════════════════════════════════════════════
//  POST /create_course  |  PUT /update_course/{id}
// ══════════════════════════════════════════════════════════
function openModal(id = null) {
  editingId = id;
  const isEdit = id !== null;
  document.getElementById('modalTitle').textContent = isEdit ? 'Edit Course'   : 'New Course';
  document.getElementById('modalSub').textContent   = isEdit ? `PUT /update_course/${id}` : 'POST /create_course';
  document.getElementById('submitBtn').textContent  = isEdit ? 'Update Course' : 'Create Course';

  clearFormErrors();

  if (isEdit) {
    // find from cache; if not found, fetch
    const c = allCourses.find(x => x.id === id);
    if (c) fillForm(c);
    else {
      api('GET', `/courses/${id}`).then(data => {
        const c = Array.isArray(data) ? data[0] : data;
        fillForm(c);
      });
    }
  } else {
    // blank form
    ['m-title','m-instructor','m-category','m-price','m-duration','m-discount'].forEach(k => {
      document.getElementById(k).value = '';
    });
    document.getElementById('m-published').checked = true;
    updateToggle();
  }

  document.getElementById('modalOverlay').classList.remove('hidden');
}

function fillForm(c) {
  document.getElementById('m-title').value      = c.title       || '';
  document.getElementById('m-instructor').value = c.instructor  || '';
  document.getElementById('m-category').value   = c.category    || '';
  document.getElementById('m-price').value      = c.price       ?? '';
  document.getElementById('m-duration').value   = c.duration_hours ?? '';
  document.getElementById('m-discount').value   = c.discount_percent ?? '';
  document.getElementById('m-published').checked = Boolean(c.is_published);
  updateToggle();
}

function closeModal() {
  document.getElementById('modalOverlay').classList.add('hidden');
  editingId = null;
}

function handleOverlayClick(e) {
  if (e.target === e.currentTarget) closeModal();
}

function updateToggle() {
  const checked = document.getElementById('m-published').checked;
  document.getElementById('toggleText').textContent = checked ? 'Yes — Published' : 'No — Draft';
}

// ── Front-end validation mirrors Pydantic model ────────────
function validateForm() {
  const errs = {};
  const title      = document.getElementById('m-title').value.trim();
  const instructor = document.getElementById('m-instructor').value.trim();
  const category   = document.getElementById('m-category').value.trim();
  const price      = parseFloat(document.getElementById('m-price').value);
  const duration   = parseInt(document.getElementById('m-duration').value);
  const discount   = parseFloat(document.getElementById('m-discount').value);
  const published  = document.getElementById('m-published').checked;

  if (!title || title.length < 2)          errs.title      = 'Min 2 characters.';
  if (title.length > 100)                  errs.title      = 'Max 100 characters.';
  if (!instructor || instructor.length < 2) errs.instructor = 'Min 2 characters.';
  if (!category || category.length < 2)    errs.category   = 'Min 2 characters.';
  if (isNaN(price) || price < 0)           errs.price      = 'Price ≥ 0 required.';
  if (price > 10000)                       errs.price      = 'Price ≤ ₹10,000.';
  if (isNaN(duration) || duration < 1)     errs.duration   = 'Duration ≥ 1 hour.';
  if (duration > 1000)                     errs.duration   = 'Duration ≤ 1000 hours.';
  if (isNaN(discount) || discount < 0)     errs.discount   = 'Discount ≥ 0 required.';
  if (discount > 100)                      errs.discount   = 'Discount ≤ 100%.';
  // mirrors model_validator: unpublished + discount > 0 is invalid
  if (!published && discount > 0)          errs.discount   = 'Unpublished courses cannot have a discount.';

  return errs;
}

function showFormErrors(errs) {
  Object.entries(errs).forEach(([field, msg]) => {
    const key = field === 'duration' ? 'duration' : field;
    const inputId = { title:'m-title', instructor:'m-instructor', category:'m-category',
                      price:'m-price', duration:'m-duration', discount:'m-discount' }[key];
    if (inputId) document.getElementById(inputId)?.classList.add('has-error');
    const errEl = document.getElementById('e-' + key);
    if (errEl) { errEl.textContent = msg; errEl.classList.add('show'); }
  });
}

function clearFormErrors() {
  ['title','instructor','category','price','duration','discount'].forEach(k => {
    document.getElementById('m-' + k)?.classList.remove('has-error');
    const e = document.getElementById('e-' + k);
    if (e) { e.textContent = ''; e.classList.remove('show'); }
  });
}

async function submitCourse() {
  clearFormErrors();
  const errs = validateForm();
  if (Object.keys(errs).length) { showFormErrors(errs); return; }

  const payload = {
    title:            toTitleCase(document.getElementById('m-title').value.trim()),
    instructor:       toTitleCase(document.getElementById('m-instructor').value.trim()),
    category:         document.getElementById('m-category').value.trim().toLowerCase(),
    price:            parseFloat(document.getElementById('m-price').value),
    duration_hours:   parseInt(document.getElementById('m-duration').value),
    discount_percent: parseFloat(document.getElementById('m-discount').value),
    is_published:     document.getElementById('m-published').checked,
  };

  try {
    if (editingId !== null) {
      // PUT /update_course/{id}
      await api('PUT', `/update_course/${editingId}`, payload);
      toast('Course updated ✓', 'success');
    } else {
      // POST /create_course
      await api('POST', '/create_course', payload);
      toast('Course created ✓', 'success');
    }
    closeModal();
    loadCourses();
  } catch (err) {
    toast(`Error: ${err.message}`, 'error');
  }
}

// ══════════════════════════════════════════════════════════
//  DELETE /delete_course/{id}
// ══════════════════════════════════════════════════════════
function confirmDelete(id, title) {
  if (!confirm(`Delete "${title}"?\nThis cannot be undone.`)) return;
  deleteCourse(id, title);
}

async function deleteCourse(id, title) {
  try {
    await api('DELETE', `/delete_course/${id}`);
    toast(`"${title}" deleted`, 'error');
    loadCourses();
  } catch (err) {
    toast(`Delete failed: ${err.message}`, 'error');
  }
}

// ══════════════════════════════════════════════════════════
//  GET /query_courses  — filter view
// ══════════════════════════════════════════════════════════
function buildQueryParams() {
  const params = new URLSearchParams();
  const add = (id, key) => {
    const val = document.getElementById(id).value.trim();
    if (val !== '') params.set(key, val);
  };
  add('q-title',      'title');
  add('q-instructor', 'instructor');
  add('q-category',   'category');
  add('q-duration',   'duration_hours');
  add('q-minprice',   'min_price');
  add('q-maxprice',   'max_price');
  add('q-discount',   'discount_percent');

  const pub = document.getElementById('q-published').value;
  if (pub !== '') params.set('is_published', pub);

  return params;
}

// Live URL preview
['q-title','q-instructor','q-category','q-duration','q-minprice','q-maxprice','q-discount','q-published']
  .forEach(id => {
    document.getElementById(id)?.addEventListener('input', updateQueryPreview);
    document.getElementById(id)?.addEventListener('change', updateQueryPreview);
  });

function updateQueryPreview() {
  const params = buildQueryParams();
  const qs = params.toString();
  document.getElementById('queryPreview').textContent =
    BASE() + '/query_courses' + (qs ? '?' + qs : ' (no filters — returns all)');
}

async function runFilter() {
  const grid  = document.getElementById('filterGrid');
  const empty = document.getElementById('filterEmpty');
  grid.innerHTML = '';
  empty.classList.add('hidden');

  const params = buildQueryParams();
  const path   = '/query_courses' + (params.toString() ? '?' + params.toString() : '');

  try {
    const data = await api('GET', path);
    // route returns { filtered_courses: [...] }
    const courses = Array.isArray(data) ? data : (data.filtered_courses || []);
    renderCards(courses, 'filterGrid', 'filterEmpty');
    toast(`${courses.length} result(s) found`, 'info');
  } catch (err) {
    toast(`Query failed: ${err.message}`, 'error');
  }
}

// ══════════════════════════════════════════════════════════
//  GET /courses?page=&limit=  — pagination view
// ══════════════════════════════════════════════════════════
async function runPaginate() {
  const grid  = document.getElementById('paginateGrid');
  const empty = document.getElementById('paginateEmpty');
  grid.innerHTML = '';
  empty.classList.add('hidden');

  // const page  = parseInt(document.getElementById('p-page').value)  || 1;
  // const limit = parseInt(document.getElementById('p-limit').value) || 10;
    const rawPage  = parseInt(document.getElementById('p-page').value);
    const rawLimit = parseInt(document.getElementById('p-limit').value);

    const page  = (!isNaN(rawPage)  && rawPage  >= 1) ? rawPage  : 1;
    const limit = (!isNaN(rawLimit) && rawLimit >= 1 && rawLimit <= 100) ? rawLimit : 10;

  // NOTE: In your routes.py there are TWO @route.get("/courses") routes.
  // FastAPI will use the FIRST one (no pagination). To use pagination,
  // the paginated route should be renamed e.g. /courses/paginated.
  // This call targets the pagination route as-is:
  try {
    const data = await api('GET', `/courses/paginated?page=${page}&limit=${limit}`);
    // route returns { total_courses, page, limit, courses: [...] }
    const courses = Array.isArray(data) ? data : (data.courses || []);
    const total   = data.total_courses ?? courses.length;
    document.getElementById('p-total').textContent = total;
    renderCards(courses, 'paginateGrid', 'paginateEmpty');
  } catch (err) {
    toast(`Pagination failed: ${err.message}`, 'error');
  }
}

// ══════════════════════════════════════════════════════════
//  Toast
// ══════════════════════════════════════════════════════════
function toast(msg, type = 'info') {
  const stack = document.getElementById('toastStack');
  const el    = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  stack.appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    el.addEventListener('animationend', () => el.remove());
  }, 3500);
}

// ══════════════════════════════════════════════════════════
//  Keyboard shortcuts
// ══════════════════════════════════════════════════════════
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeModal(); closeDrawer(); }
  if ((e.ctrlKey || e.metaKey) && e.key === 'n') { e.preventDefault(); openModal(); }
});

// ══════════════════════════════════════════════════════════
//  Init
// ══════════════════════════════════════════════════════════
loadCourses();
updateQueryPreview();
