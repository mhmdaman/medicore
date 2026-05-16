/**
 * MediCore — Hospital Patient Record System
 * Frontend JS — All 5 tables: patients, doctors, wards, medications, users
 * API Base: http://localhost:8000/api
 */

const API = 'http://localhost:8000/api';

// ─── API LAYER ───────────────────────────────────────────────────────────────

async function apiFetch(path, options = {}) {
  try {
    const res  = await fetch(`${API}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.message || 'Request failed');
    return json.data;
  } catch (err) {
    if (err.message === 'Failed to fetch') {
      showToast('Cannot reach server. Is server.py running on port 8000?', 'error');
    } else {
      showToast(err.message, 'error');
    }
    throw err;
  }
}

const API_CALLS = {
  // Stats
  getStats:         ()          => apiFetch('/stats'),
  // Patients
  getPatients:      (p='')      => apiFetch(`/patients${p}`),
  getPatient:       (id)        => apiFetch(`/patients/${id}`),
  createPatient:    (b)         => apiFetch('/patients',      { method:'POST',   body:JSON.stringify(b) }),
  updatePatient:    (id,b)      => apiFetch(`/patients/${id}`,{ method:'PUT',    body:JSON.stringify(b) }),
  deletePatient:    (id)        => apiFetch(`/patients/${id}`,{ method:'DELETE' }),
  // Doctors
  getDoctors:       (p='')      => apiFetch(`/doctors${p}`),
  getDoctor:        (id)        => apiFetch(`/doctors/${id}`),
  createDoctor:     (b)         => apiFetch('/doctors',       { method:'POST',   body:JSON.stringify(b) }),
  updateDoctor:     (id,b)      => apiFetch(`/doctors/${id}`, { method:'PUT',    body:JSON.stringify(b) }),
  deleteDoctor:     (id)        => apiFetch(`/doctors/${id}`, { method:'DELETE' }),
  // Wards
  getWards:         ()          => apiFetch('/wards'),
  createWard:       (b)         => apiFetch('/wards',         { method:'POST',   body:JSON.stringify(b) }),
  updateWard:       (id,b)      => apiFetch(`/wards/${id}`,   { method:'PUT',    body:JSON.stringify(b) }),
  deleteWard:       (id)        => apiFetch(`/wards/${id}`,   { method:'DELETE' }),
  // Medications
  getMedications:   (p='')      => apiFetch(`/medications${p}`),
  createMedication: (b)         => apiFetch('/medications',   { method:'POST',   body:JSON.stringify(b) }),
  deleteMedication: (id)        => apiFetch(`/medications/${id}`,{ method:'DELETE' }),
  // Users
  getUsers:         ()          => apiFetch('/users'),
  createUser:       (b)         => apiFetch('/users',         { method:'POST',   body:JSON.stringify(b) }),
  deleteUser:       (id)        => apiFetch(`/users/${id}`,   { method:'DELETE' }),
};

// ─── VIEW MANAGEMENT ─────────────────────────────────────────────────────────

const viewTitles = {
  dashboard:    ['Dashboard',    'Home / Dashboard'],
  patients:     ['All Patients', 'Home / Patients'],
  'add-patient':['Add Patient',  'Home / Add Patient'],
  search:       ['Search',       'Home / Search'],
  doctors:      ['Doctors',      'Home / Doctors'],
  wards:        ['Wards',        'Home / Wards'],
  medications:  ['Medications',  'Home / Medications'],
  users:        ['Users',        'Home / Users'],
};

function switchView(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const target = document.getElementById(`view-${view}`);
  if (target) target.classList.add('active');
  const navBtn = document.querySelector(`.nav-item[data-view="${view}"]`);
  if (navBtn) navBtn.classList.add('active');
  const [title, breadcrumb] = viewTitles[view] || ['', ''];
  document.getElementById('pageTitle').textContent  = title;
  document.getElementById('breadcrumb').textContent = breadcrumb;

  if (view === 'dashboard')   renderDashboard();
  if (view === 'patients')    renderPatients();
  if (view === 'doctors')     renderDoctors();
  if (view === 'wards')       renderWards();
  if (view === 'medications') renderMedications();
  if (view === 'users')       renderUsers();
  if (view === 'add-patient' && !document.getElementById('editPatientId').value) resetPatientForm();
}

// ─── DASHBOARD ───────────────────────────────────────────────────────────────

async function renderDashboard() {
  try {
    const [stats, patients] = await Promise.all([
      API_CALLS.getStats(),
      API_CALLS.getPatients('?limit=6'),
    ]);
    document.getElementById('stat-total').textContent       = stats.total;
    document.getElementById('stat-today').textContent       = stats.today;
    document.getElementById('stat-discharged').textContent  = stats.discharged;
    document.getElementById('stat-critical').textContent    = stats.critical;
    document.getElementById('stat-doctors').textContent     = stats.doctors;
    document.getElementById('stat-wards').textContent       = stats.wards;
    document.getElementById('stat-medications').textContent = stats.medications;
    document.getElementById('stat-users').textContent       = stats.users;
    document.getElementById('maleCount').textContent        = stats.male;
    document.getElementById('femaleCount').textContent      = stats.female;
    document.getElementById('donutCount').textContent       = stats.total;

    const circ     = 2 * Math.PI * 54;
    const total    = stats.total || 1;
    const maleDash   = (stats.male   / total) * circ;
    const femaleDash = (stats.female / total) * circ;
    document.getElementById('maleSeg').setAttribute('stroke-dasharray',   `${maleDash} ${circ - maleDash}`);
    document.getElementById('femaleSeg').setAttribute('stroke-dasharray', `${femaleDash} ${circ - femaleDash}`);
    document.getElementById('femaleSeg').style.strokeDashoffset = `-${maleDash}`;

    const tbody = document.getElementById('recentTbody');
    tbody.innerHTML = patients.length
      ? patients.map(p => `
          <tr>
            <td><strong>${esc(p.name)}</strong><br><span class="patient-id">${esc(p.id)}</span></td>
            <td>${esc(p.age)}</td>
            <td>${esc(p.diagnosis)}</td>
            <td><span class="badge badge-${p.status.toLowerCase()}">${esc(p.status)}</span></td>
          </tr>`).join('')
      : '<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:24px">No patients yet.</td></tr>';
  } catch (_) {}
}

// ─── PATIENTS ─────────────────────────────────────────────────────────────────

async function renderPatients() {
  const q = (document.getElementById('quickSearch')?.value || '').trim();
  try {
    setTableLoading('allPatientsTbody', 8);
    const patients = await API_CALLS.getPatients(q ? `?q=${encodeURIComponent(q)}` : '');
    const tbody    = document.getElementById('allPatientsTbody');
    const empty    = document.getElementById('emptyState');
    if (!patients.length) { tbody.innerHTML = ''; empty.style.display = 'flex'; return; }
    empty.style.display = 'none';
    tbody.innerHTML = patients.map(p => `
      <tr>
        <td><span class="patient-id">${esc(p.id)}</span></td>
        <td><strong>${esc(p.name)}</strong></td>
        <td>${esc(p.age)}</td>
        <td>${esc(p.gender)}</td>
        <td>${esc(p.contact)}</td>
        <td>${esc(p.diagnosis)}</td>
        <td><span class="badge badge-${p.status.toLowerCase()}">${esc(p.status)}</span></td>
        <td><div class="action-btns">
          <button class="action-btn edit-btn" onclick="editPatient('${p.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          <button class="action-btn del-btn"  onclick="confirmDelete('patient','${p.id}','${esc(p.name)}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg></button>
        </div></td>
      </tr>`).join('');
  } catch (_) {}
}

async function savePatient(e) {
  e.preventDefault();
  const id = document.getElementById('editPatientId').value;
  const body = {
    name:      document.getElementById('fName').value.trim(),
    age:       parseInt(document.getElementById('fAge').value),
    gender:    document.getElementById('fGender').value,
    blood:     document.getElementById('fBlood').value,
    contact:   document.getElementById('fContact').value.trim(),
    email:     document.getElementById('fEmail').value.trim(),
    address:   document.getElementById('fAddress').value.trim(),
    diagnosis: document.getElementById('fDiagnosis').value.trim(),
    doctor:    document.getElementById('fDoctor').value.trim(),
    ward:      document.getElementById('fWard').value.trim(),
    status:    document.getElementById('fStatus').value,
    history:   document.getElementById('fHistory').value.trim(),
    treatment: document.getElementById('fTreatment').value.trim(),
  };
  const btn = document.getElementById('patientSubmitBtn');
  btn.disabled = true; btn.textContent = id ? 'Updating…' : 'Saving…';
  try {
    if (id) { await API_CALLS.updatePatient(id, body); showToast('Patient updated.', 'success'); }
    else    { await API_CALLS.createPatient(body);     showToast('Patient registered.', 'success'); }
    resetPatientForm();
    switchView('patients');
  } catch (_) { btn.disabled = false; btn.textContent = 'Save Patient'; }
}

function resetPatientForm() {
  document.getElementById('patientForm').reset();
  document.getElementById('editPatientId').value = '';
  document.getElementById('patientFormTitle').textContent = 'Register New Patient';
  document.getElementById('patientSubmitBtn').textContent = 'Save Patient';
  document.getElementById('patientSubmitBtn').disabled = false;
}

async function editPatient(id) {
  try {
    const p = await API_CALLS.getPatient(id);
    document.getElementById('editPatientId').value      = p.id;
    document.getElementById('fName').value              = p.name;
    document.getElementById('fAge').value               = p.age;
    document.getElementById('fGender').value            = p.gender;
    document.getElementById('fBlood').value             = p.blood     || '';
    document.getElementById('fContact').value           = p.contact;
    document.getElementById('fEmail').value             = p.email     || '';
    document.getElementById('fAddress').value           = p.address   || '';
    document.getElementById('fDiagnosis').value         = p.diagnosis;
    document.getElementById('fDoctor').value            = p.doctor    || '';
    document.getElementById('fWard').value              = p.ward      || '';
    document.getElementById('fStatus').value            = p.status;
    document.getElementById('fHistory').value           = p.history   || '';
    document.getElementById('fTreatment').value         = p.treatment || '';
    document.getElementById('patientFormTitle').textContent = `Edit — ${p.name}`;
    document.getElementById('patientSubmitBtn').textContent = 'Update Patient';
    switchView('add-patient');
  } catch (_) {}
}

// ─── SEARCH ───────────────────────────────────────────────────────────────────

let searchDebounce = null;
function performSearch() { clearTimeout(searchDebounce); searchDebounce = setTimeout(_doSearch, 280); }

async function _doSearch() {
  const q      = document.getElementById('bigSearch').value.trim();
  const gender = document.getElementById('filterGender').value;
  const status = document.getElementById('filterStatus').value;
  const blood  = document.getElementById('filterBlood').value;
  if (!q && !gender && !status && !blood) { document.getElementById('searchResultsCard').style.display = 'none'; return; }
  const params = new URLSearchParams();
  if (q)      params.set('q', q);
  if (gender) params.set('gender', gender);
  if (status) params.set('status', status);
  if (blood)  params.set('blood', blood);
  try {
    document.getElementById('searchResultsCard').style.display = '';
    setTableLoading('searchTbody', 7);
    const results = await API_CALLS.getPatients(`?${params.toString()}`);
    document.getElementById('resultCount').textContent = `${results.length} result${results.length !== 1 ? 's' : ''}`;
    document.getElementById('searchTbody').innerHTML = results.length
      ? results.map(p => `
          <tr>
            <td><span class="patient-id">${esc(p.id)}</span></td>
            <td><strong>${esc(p.name)}</strong></td>
            <td>${esc(p.age)}</td>
            <td>${esc(p.gender)}</td>
            <td>${esc(p.diagnosis)}</td>
            <td><span class="badge badge-${p.status.toLowerCase()}">${esc(p.status)}</span></td>
            <td><div class="action-btns">
              <button class="action-btn edit-btn" onclick="editPatient('${p.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
              <button class="action-btn del-btn" onclick="confirmDelete('patient','${p.id}','${esc(p.name)}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg></button>
            </div></td>
          </tr>`).join('')
      : '<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:32px">No results found.</td></tr>';
  } catch (_) {}
}

// ─── DOCTORS ─────────────────────────────────────────────────────────────────

async function renderDoctors() {
  try {
    setTableLoading('doctorsTbody', 7);
    const doctors = await API_CALLS.getDoctors();
    document.getElementById('doctorsTbody').innerHTML = doctors.length
      ? doctors.map(d => `
          <tr>
            <td><span class="patient-id">${esc(d.id)}</span></td>
            <td><strong>${esc(d.name)}</strong></td>
            <td>${esc(d.specialty || '—')}</td>
            <td>${esc(d.department || '—')}</td>
            <td>${esc(d.contact || '—')}</td>
            <td>${esc(d.email || '—')}</td>
            <td><div class="action-btns">
              <button class="action-btn del-btn" onclick="confirmDelete('doctor','${d.id}','${esc(d.name)}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg></button>
            </div></td>
          </tr>`).join('')
      : '<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:32px">No doctors added yet.</td></tr>';
  } catch (_) {}
}

function openDoctorForm() {
  document.getElementById('modalContent').innerHTML = `
    <h2 style="font-family:var(--font-head);font-size:1.1rem;font-weight:700;margin-bottom:20px;color:var(--text)">Add Doctor</h2>
    <div style="display:flex;flex-direction:column;gap:14px">
      <div class="form-group"><label>Full Name <span class="req">*</span></label><input type="text" id="dName" placeholder="Dr. John"/></div>
      <div class="form-group"><label>Specialty</label><input type="text" id="dSpecialty" placeholder="Cardiology"/></div>
      <div class="form-group"><label>Department</label><input type="text" id="dDept" placeholder="Heart Centre"/></div>
      <div class="form-group"><label>Contact</label><input type="tel" id="dContact" placeholder="+91 9876543210"/></div>
      <div class="form-group"><label>Email</label><input type="email" id="dEmail" placeholder="doctor@hospital.com"/></div>
    </div>
    <div class="modal-actions" style="margin-top:20px">
      <button class="btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn-primary" onclick="saveDoctor()">Save Doctor</button>
    </div>`;
  document.getElementById('modalOverlay').classList.add('open');
}

async function saveDoctor() {
  const name = document.getElementById('dName').value.trim();
  if (!name) { showToast('Name is required', 'error'); return; }
  try {
    await API_CALLS.createDoctor({
      name, specialty: document.getElementById('dSpecialty').value.trim(),
      department: document.getElementById('dDept').value.trim(),
      contact: document.getElementById('dContact').value.trim(),
      email: document.getElementById('dEmail').value.trim(),
    });
    showToast('Doctor added successfully.', 'success');
    closeModal(); renderDoctors(); renderDashboard();
  } catch (_) {}
}

// ─── WARDS ────────────────────────────────────────────────────────────────────

async function renderWards() {
  try {
    setTableLoading('wardsTbody', 6);
    const wards = await API_CALLS.getWards();
    document.getElementById('wardsTbody').innerHTML = wards.length
      ? wards.map(w => `
          <tr>
            <td><span class="patient-id">${esc(w.id)}</span></td>
            <td><strong>${esc(w.name)}</strong></td>
            <td>${esc(w.type || '—')}</td>
            <td>${esc(w.capacity)}</td>
            <td>${esc(w.floor || '—')}</td>
            <td><div class="action-btns">
              <button class="action-btn del-btn" onclick="confirmDelete('ward','${w.id}','${esc(w.name)}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg></button>
            </div></td>
          </tr>`).join('')
      : '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:32px">No wards added yet.</td></tr>';
  } catch (_) {}
}

function openWardForm() {
  document.getElementById('modalContent').innerHTML = `
    <h2 style="font-family:var(--font-head);font-size:1.1rem;font-weight:700;margin-bottom:20px;color:var(--text)">Add Ward</h2>
    <div style="display:flex;flex-direction:column;gap:14px">
      <div class="form-group"><label>Ward Name <span class="req">*</span></label><input type="text" id="wName" placeholder="ICU"/></div>
      <div class="form-group"><label>Type</label><input type="text" id="wType" placeholder="Intensive Care"/></div>
      <div class="form-group"><label>Capacity</label><input type="number" id="wCapacity" placeholder="10" value="10"/></div>
      <div class="form-group"><label>Floor</label><input type="number" id="wFloor" placeholder="1" value="1"/></div>
    </div>
    <div class="modal-actions" style="margin-top:20px">
      <button class="btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn-primary" onclick="saveWard()">Save Ward</button>
    </div>`;
  document.getElementById('modalOverlay').classList.add('open');
}

async function saveWard() {
  const name = document.getElementById('wName').value.trim();
  if (!name) { showToast('Name is required', 'error'); return; }
  try {
    await API_CALLS.createWard({
      name, type: document.getElementById('wType').value.trim(),
      capacity: parseInt(document.getElementById('wCapacity').value) || 10,
      floor: parseInt(document.getElementById('wFloor').value) || 1,
    });
    showToast('Ward added successfully.', 'success');
    closeModal(); renderWards(); renderDashboard();
  } catch (_) {}
}

// ─── MEDICATIONS ─────────────────────────────────────────────────────────────

async function renderMedications() {
  try {
    setTableLoading('medicationsTbody', 8);
    const meds = await API_CALLS.getMedications();
    document.getElementById('medicationsTbody').innerHTML = meds.length
      ? meds.map(m => `
          <tr>
            <td><span class="patient-id">${esc(m.id)}</span></td>
            <td><span class="patient-id">${esc(m.patient_id)}</span></td>
            <td><strong>${esc(m.medicine)}</strong></td>
            <td>${esc(m.dosage || '—')}</td>
            <td>${esc(m.frequency || '—')}</td>
            <td>${esc(m.start_date ? m.start_date.split('T')[0] : '—')}</td>
            <td>${esc(m.end_date   ? m.end_date.split('T')[0]   : '—')}</td>
            <td><div class="action-btns">
              <button class="action-btn del-btn" onclick="confirmDelete('medication','${m.id}','${esc(m.medicine)}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg></button>
            </div></td>
          </tr>`).join('')
      : '<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:32px">No medications added yet.</td></tr>';
  } catch (_) {}
}

function openMedForm() {
  document.getElementById('modalContent').innerHTML = `
    <h2 style="font-family:var(--font-head);font-size:1.1rem;font-weight:700;margin-bottom:20px;color:var(--text)">Add Medication</h2>
    <div style="display:flex;flex-direction:column;gap:14px">
      <div class="form-group"><label>Patient ID <span class="req">*</span></label><input type="text" id="mPatient" placeholder="MC-XXXXXXXXXX"/></div>
      <div class="form-group"><label>Medicine <span class="req">*</span></label><input type="text" id="mMedicine" placeholder="Paracetamol"/></div>
      <div class="form-group"><label>Dosage</label><input type="text" id="mDosage" placeholder="500mg"/></div>
      <div class="form-group"><label>Frequency</label><input type="text" id="mFrequency" placeholder="Twice daily"/></div>
      <div class="form-group"><label>Start Date</label><input type="date" id="mStart"/></div>
      <div class="form-group"><label>End Date</label><input type="date" id="mEnd"/></div>
      <div class="form-group"><label>Notes</label><textarea id="mNotes" rows="2" placeholder="Additional notes..."></textarea></div>
    </div>
    <div class="modal-actions" style="margin-top:20px">
      <button class="btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn-primary" onclick="saveMedication()">Save Medication</button>
    </div>`;
  document.getElementById('modalOverlay').classList.add('open');
}

async function saveMedication() {
  const patient_id = document.getElementById('mPatient').value.trim();
  const medicine   = document.getElementById('mMedicine').value.trim();
  if (!patient_id || !medicine) { showToast('Patient ID and Medicine are required', 'error'); return; }
  try {
    await API_CALLS.createMedication({
      patient_id, medicine,
      dosage:     document.getElementById('mDosage').value.trim(),
      frequency:  document.getElementById('mFrequency').value.trim(),
      start_date: document.getElementById('mStart').value || null,
      end_date:   document.getElementById('mEnd').value   || null,
      notes:      document.getElementById('mNotes').value.trim(),
    });
    showToast('Medication added successfully.', 'success');
    closeModal(); renderMedications(); renderDashboard();
  } catch (_) {}
}

// ─── USERS ────────────────────────────────────────────────────────────────────

async function renderUsers() {
  try {
    setTableLoading('usersTbody', 6);
    const users = await API_CALLS.getUsers();
    document.getElementById('usersTbody').innerHTML = users.length
      ? users.map(u => `
          <tr>
            <td><span class="patient-id">${esc(u.id)}</span></td>
            <td><strong>${esc(u.name)}</strong></td>
            <td>${esc(u.email)}</td>
            <td><span class="badge badge-role">${esc(u.role)}</span></td>
            <td>${esc(u.created_at ? u.created_at.split('T')[0] : '—')}</td>
            <td><div class="action-btns">
              <button class="action-btn del-btn" onclick="confirmDelete('user','${u.id}','${esc(u.name)}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg></button>
            </div></td>
          </tr>`).join('')
      : '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:32px">No users added yet.</td></tr>';
  } catch (_) {}
}

function openUserForm() {
  document.getElementById('modalContent').innerHTML = `
    <h2 style="font-family:var(--font-head);font-size:1.1rem;font-weight:700;margin-bottom:20px;color:var(--text)">Add Staff User</h2>
    <div style="display:flex;flex-direction:column;gap:14px">
      <div class="form-group"><label>Full Name <span class="req">*</span></label><input type="text" id="uName" placeholder="Dr. John"/></div>
      <div class="form-group"><label>Email <span class="req">*</span></label><input type="email" id="uEmail" placeholder="staff@hospital.com"/></div>
      <div class="form-group"><label>Password <span class="req">*</span></label><input type="password" id="uPassword" placeholder="••••••••"/></div>
      <div class="form-group"><label>Role</label>
        <select id="uRole"><option value="Staff">Staff</option><option value="Doctor">Doctor</option><option value="Admin">Admin</option><option value="Nurse">Nurse</option></select>
      </div>
    </div>
    <div class="modal-actions" style="margin-top:20px">
      <button class="btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn-primary" onclick="saveUser()">Save User</button>
    </div>`;
  document.getElementById('modalOverlay').classList.add('open');
}

async function saveUser() {
  const name     = document.getElementById('uName').value.trim();
  const email    = document.getElementById('uEmail').value.trim();
  const password = document.getElementById('uPassword').value;
  if (!name || !email || !password) { showToast('Name, email and password are required', 'error'); return; }
  try {
    await API_CALLS.createUser({ name, email, password, role: document.getElementById('uRole').value });
    showToast('User created successfully.', 'success');
    closeModal(); renderUsers(); renderDashboard();
  } catch (_) {}
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

let pendingDelete = null;

function confirmDelete(type, id, name) {
  pendingDelete = { type, id };
  document.getElementById('modalContent').innerHTML = `
    <div class="modal-title">⚠ Delete Record</div>
    <div class="modal-body">You are about to permanently delete <strong>${esc(name)}</strong>. This cannot be undone.</div>
    <div class="modal-actions">
      <button class="btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn-danger" onclick="executeDelete()">Yes, Delete</button>
    </div>`;
  document.getElementById('modalOverlay').classList.add('open');
}

async function executeDelete() {
  if (!pendingDelete) return;
  const { type, id } = pendingDelete;
  pendingDelete = null;
  closeModal();
  try {
    if (type === 'patient')    await API_CALLS.deletePatient(id);
    if (type === 'doctor')     await API_CALLS.deleteDoctor(id);
    if (type === 'ward')       await API_CALLS.deleteWard(id);
    if (type === 'medication') await API_CALLS.deleteMedication(id);
    if (type === 'user')       await API_CALLS.deleteUser(id);
    showToast('Record deleted.', 'error');
    if (type === 'patient')    { renderPatients(); renderDashboard(); }
    if (type === 'doctor')     { renderDoctors();  renderDashboard(); }
    if (type === 'ward')       { renderWards();    renderDashboard(); }
    if (type === 'medication') { renderMedications(); renderDashboard(); }
    if (type === 'user')       { renderUsers();    renderDashboard(); }
  } catch (_) {}
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
  pendingDelete = null;
}

// ─── TOAST ────────────────────────────────────────────────────────────────────

let toastTimer = null;
function showToast(message, type = 'info') {
  const t = document.getElementById('toast');
  t.textContent = message;
  t.className   = `toast ${type} show`;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3400);
}

// ─── UTILITIES ───────────────────────────────────────────────────────────────

function esc(str) {
  if (str === undefined || str === null) return '';
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

function setTableLoading(tbodyId, cols) {
  document.getElementById(tbodyId).innerHTML = Array(3).fill(
    `<tr>${Array(cols).fill(`<td><div style="height:14px;background:var(--border);border-radius:4px;animation:pulse 1.2s infinite"></div></td>`).join('')}</tr>`
  ).join('');
}

// ─── INIT ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('dateBadge').textContent = new Date().toLocaleDateString('en-IN', {
    weekday:'short', day:'numeric', month:'short', year:'numeric',
  });
  const style = document.createElement('style');
  style.textContent = `@keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:1} }`;
  document.head.appendChild(style);
  renderDashboard();
});