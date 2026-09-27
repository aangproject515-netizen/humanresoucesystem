/* =========================================================
   HRIS WEB APPLICATION - FULL INTEGRATED WITH GS
========================================================= */

let currentUser = null;
let selectedEmployee = null;
let payrollData = {};
let companyMap = {};

/* =========================================================
   INITIALIZATION & AUTHENTICATION
========================================================= */
document.addEventListener("DOMContentLoaded", function () {
    checkSession();
});

function checkSession() {
    const savedUser = localStorage.getItem("hris_user");

    if (!savedUser) {
        showLoginModal();
        return;
    }

    try {
        const parsed = JSON.parse(savedUser);
        if (!parsed || typeof parsed !== "object" || !parsed.username) {
            throw new Error("Session tidak valid");
        }

        currentUser = parsed;
        setupUserUI();
        showPage("dashboard");

        // Data Dashboard dimuat setelah UI sudah terbuka.
        // Kegagalan API tidak akan mengembalikan user ke halaman login.
        Promise.resolve().then(() => initDashboardData()).catch(err => {
            console.error("Gagal inisialisasi Dashboard:", err);
        });
    } catch (e) {
        console.error("Session HRIS tidak valid:", e);
        localStorage.removeItem("hris_user");
        currentUser = null;
        showLoginModal();
    }
}

function setupUserUI() {
    const loginModal = document.getElementById("loginModal");
    const appContainer = document.getElementById("appContainer");

    if (loginModal) loginModal.style.display = "none";
    if (appContainer) appContainer.style.display = "flex";

    const user = currentUser || {};
    const name = user.nama || user.username || "Administrator";

    const userName = document.getElementById("userName");
    const userRole = document.getElementById("userRole");
    const userAvatar = document.getElementById("userAvatar");

    if (userName) userName.textContent = name;
    if (userRole) userRole.textContent = user.company || "Administrator";
    if (userAvatar) userAvatar.textContent = getInitials(name);
}

function showLoginModal() {
    const appContainer = document.getElementById("appContainer");
    const loginModal = document.getElementById("loginModal");
    if (appContainer) appContainer.style.display = "none";
    if (loginModal) loginModal.style.display = "flex";
}

async function handleLogin(event) {
    if (event) event.preventDefault();

    const usernameEl = document.getElementById("loginUsername");
    const passwordEl = document.getElementById("loginPassword");
    const errorEl = document.getElementById("loginError");

    const usernameInput = usernameEl ? usernameEl.value.trim() : "";
    const passwordInput = passwordEl ? passwordEl.value.trim() : "";

    if (!usernameInput || !passwordInput) {
        if (errorEl) {
            errorEl.textContent = "Username dan password wajib diisi!";
            errorEl.style.display = "block";
        }
        return false;
    }

    if (errorEl) errorEl.style.display = "none";
    showToast("Memproses login...");

    try {
        const response = await callGoogleScript({
            action: "login",
            username: usernameInput,
            password: passwordInput
        });

        if (response && response.success && response.user) {
            // Simpan session lebih dahulu.
            currentUser = response.user;
            localStorage.setItem("hris_user", JSON.stringify(currentUser));

            // Masuk Dashboard segera; API Dashboard tidak menentukan status login.
            setupUserUI();
            showPage("dashboard");
            showToast("Login berhasil!");

            // Muat data secara non-blocking.
            Promise.resolve().then(() => initDashboardData()).catch(err => {
                console.error("Gagal memuat data Dashboard:", err);
                showToast("Dashboard terbuka, tetapi sebagian data gagal dimuat.");
            });
        } else {
            if (errorEl) {
                errorEl.textContent = (response && response.message) || "Username atau password salah.";
                errorEl.style.display = "block";
            }
        }
    } catch (err) {
        if (errorEl) {
            errorEl.textContent = "Koneksi gagal: " + (err && err.message ? err.message : err);
            errorEl.style.display = "block";
        }
    }

    return false;
}

function logout() {
    localStorage.removeItem("hris_user");
    currentUser = null;
    showToast("Anda telah keluar dari sistem.");
    showLoginModal();
}


/* =========================================================
   GOOGLE APPS SCRIPT API CALLER
========================================================= */
async function callGoogleScript(payload = {}) {
    const url = HRIS_CONFIG.GOOGLE_SCRIPT_URL;
    if (!url || url.includes("PASTE_URL")) {
        throw new Error("URL Google Apps Script belum dikonfigurasi di config.js.");
    }

    const action = payload.action || "";
    const isReadOnly = action.startsWith("get_") || action === "generate_pkwt_number";
    
    let targetUrl = url;
    let options = {};

    const separator = url.includes("?") ? "&" : "?";

    if (isReadOnly) {
        // GET: kirim action + parameter melalui query string ke Apps Script.
        const queryParams = new URLSearchParams(payload).toString();
        targetUrl = `${url}${separator}${queryParams}`;
        options = {
            method: "GET",
            headers: { "Accept": "application/json" }
        };
    } else {
        // POST: mengikuti pola yang juga dipakai aplikasi Android.
        // Action diletakkan di query URL dan seluruh payload dikirim sebagai form body.
        const formData = new URLSearchParams();
        Object.keys(payload).forEach(key => {
            formData.append(key, payload[key] == null ? "" : String(payload[key]));
        });

        targetUrl = `${url}${separator}action=${encodeURIComponent(action)}`;
        options = {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                "Accept": "application/json"
            },
            body: formData.toString()
        };
    }

    const response = await fetch(targetUrl, options);
    if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}`);
    }

    const text = await response.text();
    try {
        return JSON.parse(text);
    } catch (e) {
        return { success: true, raw: text };
    }
}

/* =========================================================
   NAVIGATION & PAGE LOADERS
========================================================= */
function showPage(page) {
    document.querySelectorAll(".page").forEach(p => p.classList.remove("active-page"));
    const selectedPage = document.getElementById("page-" + page);
    if (selectedPage) selectedPage.classList.add("active-page");

    document.querySelectorAll(".nav-item").forEach(item => item.classList.remove("active"));
    const activeNav = document.querySelector(`.nav-item[data-page="${page}"]`);
    if (activeNav) activeNav.classList.add("active");

    const titleMap = {
        dashboard: "Dashboard",
        contract: "Kontrak Kerja",
        employees: "Data Karyawan",
        companies: "Perusahaan",
        payroll: "Payroll",
        attendance: "Absensi",
        leave: "Cuti & Izin",
        recruitment: "Rekrutmen",
        users: "Pengguna",
        settings: "Pengaturan"
    };
    document.getElementById("pageTitle").textContent = titleMap[page] || "Dashboard";
    closeSidebar();

    // Trigger Load Data
    if (page === "employees") loadEmployeesModule();
    if (page === "companies") loadCompaniesModule();
    if (page === "payroll") loadPayrollModule();
    if (page === "attendance") loadAttendanceModule();
    if (page === "leave") loadLeaveModule();
    if (page === "recruitment") loadRecruitmentModule();
    if (page === "users") loadUsersModule();
    if (page === "contract") loadContractsModule();
}

/* =========================================================
   DASHBOARD & DATA INITIALIZATION
========================================================= */
async function initDashboardData() {
    try {
        await fetchCompaniesList();
    } catch (e) {
        console.error("Gagal memuat daftar perusahaan:", e);
    }

    try {
        showPage("dashboard");
    } catch (e) {
        console.error("Gagal menampilkan Dashboard:", e);
    }

    try {
        await loadDashboardStats();
    } catch (e) {
        console.error("Gagal memuat statistik Dashboard:", e);
    }
}

async function fetchCompaniesList() {
    try {
        const res = await callGoogleScript({ action: "get_companies" });
        if (res.success && Array.isArray(res.data)) {
            const selectPayroll = document.getElementById("payrollCompany");
            selectPayroll.innerHTML = '<option value="">-- Semua Perusahaan --</option>';
            companyMap = {};
            res.data.forEach(c => {
                companyMap[c.id] = c.name;
                const opt = document.createElement("option");
                opt.value = c.id;
                opt.textContent = c.name;
                selectPayroll.appendChild(opt);
            });
        }
    } catch (e) {
        console.error("Gagal memuat company:", e);
    }
}

async function loadDashboardStats() {
    try {
        const empRes = await callGoogleScript({ action: "get_employees" });
        if (empRes.success && empRes.data) {
            document.getElementById("totalEmployees").textContent = empRes.data.length;
        }
        const attRes = await callGoogleScript({ action: "get_attendance" });
        if (attRes.success && attRes.data) {
            const today = new Date().toISOString().split("T")[0];
            const present = attRes.data.filter(a => String(a.date).includes(today)).length;
            document.getElementById("totalPresent").textContent = present;
        }
        const leaveRes = await callGoogleScript({ action: "get_leave" });
        if (leaveRes.success && leaveRes.data) {
            const pending = leaveRes.data.filter(l => l.status === "MENUNGGU" || l.status === "PENDING").length;
            document.getElementById("totalLeave").textContent = pending;
        }
    } catch (e) {
        console.error("Gagal memuat stats:", e);
    }
}

/* =========================================================
   PAYROLL MODULE LOGIC
========================================================= */
async function loadPayrollModule() {
    await fetchCompaniesList();
    loadPayrollEmployees();
}

async function loadPayrollEmployees() {
    const compId = document.getElementById("payrollCompany").value;
    const container = document.getElementById("employeeList");
    container.innerHTML = `<div class="empty-state"><span>Memuat karyawan...</span></div>`;

    try {
        const res = await callGoogleScript({
            action: "get_employees",
            company_id: compId || "ALL"
        });

        if (res.success && res.data && res.data.length > 0) {
            renderEmployees(res.data);
        } else {
            container.innerHTML = `
                <div class="empty-state">
                    <div>♙</div>
                    <strong>Belum ada karyawan</strong>
                    <span>Tidak ada data karyawan untuk perusahaan ini.</span>
                </div>`;
        }
    } catch (e) {
        container.innerHTML = `<div class="empty-state"><span style="color:red;">Error: ${e.message}</span></div>`;
    }
}

function renderEmployees(employees) {
    const container = document.getElementById("employeeList");
    container.innerHTML = "";

    employees.forEach(emp => {
        const item = document.createElement("div");
        item.className = "employee-item";
        item.onclick = () => selectEmployeeForPayroll(emp);
        item.innerHTML = `
            <div class="employee-avatar">${getInitials(emp.name)}</div>
            <div class="employee-info">
                <strong>${escapeHtml(emp.name)}</strong>
                <span>${escapeHtml(emp.company_name || emp.position || "Staff")}</span>
            </div>
            <span class="menu-arrow">→</span>
        `;
        container.appendChild(item);
    });
}

async function selectEmployeeForPayroll(employee) {
    selectedEmployee = employee;
    document.getElementById("selectedEmployeeName").textContent = employee.name;
    document.querySelector(".employee-section").style.display = "none";
    document.getElementById("payrollDetail").classList.add("show");

    const period = document.getElementById("payrollPeriod").value || "2026-09";
    showToast("Memuat kalkulasi payroll...");

    try {
        const res = await callGoogleScript({
            action: "get_payroll",
            employee_id: employee.id,
            period: period
        });

        if (res.success) {
            const set = res.settings || {};
            const pay = res.payroll || {};
            const att = res.attendance_summary || {};

            document.getElementById("attendanceSummary").textContent =
                `Hadir: ${att.days_present || 0} hari | Terlambat: ${att.late_count || 0} | Alpha: ${att.alpha_count || 0}`;

            // Isi nilai form
            document.getElementById("basicSalary").value = pay.basic_salary || set.basic_salary || 0;
            document.getElementById("fixedAllowance").value = pay.fixed_allowance || set.fixed_allowance || 0;
            document.getElementById("posAllowance").value = pay.position_allowance || set.position_allowance || 0;
            document.getElementById("housingAllowance").value = pay.housing_allowance || set.housing_allowance || 0;
            document.getElementById("familyAllowance").value = pay.family_allowance || set.family_allowance || 0;
            document.getElementById("transportPerDay").value = pay.transport_per_day || set.transport_per_day || 0;
            document.getElementById("mealPerDay").value = pay.meal_per_day || set.meal_per_day || 0;
            document.getElementById("attendanceAllowance").value = pay.attendance_allowance || set.attendance_allowance || 0;
            
            document.getElementById("overtime").value = pay.overtime || 0;
            document.getElementById("bonus").value = pay.bonus || 0;
            document.getElementById("thr").value = pay.thr || 0;

            document.getElementById("bpjsHealth").value = pay.bpjs_health || 0;
            document.getElementById("bpjsTk").value = pay.bpjs_tk || 0;
            document.getElementById("pph21").value = pay.pph21 || 0;
            document.getElementById("lateDeduction").value = pay.late_deduction || 0;
            document.getElementById("alphaDeduction").value = pay.alpha_deduction || 0;
            document.getElementById("loanDeduction").value = pay.loan_deduction || 0;
            document.getElementById("cooperativeDeduction").value = pay.cooperative_deduction || 0;
            document.getElementById("otherDeduction").value = pay.other_deduction || 0;

            calculatePayroll();
        }
    } catch (e) {
        showToast("Gagal memuat detail: " + e.message);
    }
}

function calculatePayroll() {
    const gross = numberValue("basicSalary") + numberValue("fixedAllowance") + numberValue("posAllowance") + 
                  numberValue("housingAllowance") + numberValue("familyAllowance") + numberValue("transportPerDay") + 
                  numberValue("mealPerDay") + numberValue("attendanceAllowance") + numberValue("overtime") + 
                  numberValue("bonus") + numberValue("thr");

    const deductions = numberValue("bpjsHealth") + numberValue("bpjsTk") + numberValue("pph21") + 
                       numberValue("lateDeduction") + numberValue("alphaDeduction") + numberValue("loanDeduction") + 
                       numberValue("cooperativeDeduction") + numberValue("otherDeduction");

    const pph21 = numberValue("pph21");
    const net = gross - deductions;

    document.getElementById("grossSalary").textContent = formatRupiah(gross);
    document.getElementById("totalDeduction").textContent = formatRupiah(deductions);
    document.getElementById("summaryPph21").textContent = formatRupiah(pph21);
    document.getElementById("netSalary").textContent = formatRupiah(net);

    payrollData = { grossSalary: gross, totalDeduction: deductions, pph21: pph21, netSalary: net };
}

async function savePayroll() {
    if (!selectedEmployee) {
        showToast("Pilih karyawan terlebih dahulu.");
        return;
    }
    calculatePayroll();
    showToast("Menyimpan payroll...");

    const payload = {
        action: "save_payroll",
        employee_id: selectedEmployee.id,
        period: document.getElementById("payrollPeriod").value || "2026-09",
        basic_salary: numberValue("basicSalary"),
        fixed_allowance: numberValue("fixedAllowance"),
        position_allowance: numberValue("posAllowance"),
        housing_allowance: numberValue("housingAllowance"),
        family_allowance: numberValue("familyAllowance"),
        transport_per_day: numberValue("transportPerDay"),
        meal_per_day: numberValue("mealPerDay"),
        attendance_allowance: numberValue("attendanceAllowance"),
        overtime: numberValue("overtime"),
        bonus: numberValue("bonus"),
        thr: numberValue("thr"),
        bpjs_health: numberValue("bpjsHealth"),
        bpjs_tk: numberValue("bpjsTk"),
        pph21: numberValue("pph21"),
        late_deduction: numberValue("lateDeduction"),
        alpha_deduction: numberValue("alphaDeduction"),
        loan_deduction: numberValue("loanDeduction"),
        cooperative_deduction: numberValue("cooperativeDeduction"),
        other_deduction: numberValue("otherDeduction")
    };

    try {
        const res = await callGoogleScript(payload);
        if (res.success) {
            showToast("Payroll berhasil disimpan ke Sheet!");
        } else {
            showToast(res.message || "Gagal menyimpan.");
        }
    } catch (e) {
        showToast("Error: " + e.message);
    }
}

function backToEmployeeList() {
    document.querySelector(".employee-section").style.display = "block";
    document.getElementById("payrollDetail").classList.remove("show");
    selectedEmployee = null;
}

/* =========================================================
   GENERIC MODULE LOADERS
========================================================= */
let companyModuleDataWeb = [];
let selectedCompanyWeb = null;

async function loadCompaniesModule() {
    const page = document.getElementById("page-companies");
    if (!page) return;
    page.innerHTML = `<div class="empty-module"><h2>Memuat data perusahaan...</h2></div>`;
    try {
        const res = await callGoogleScript({ action: "get_companies" });
        companyModuleDataWeb = res.success && Array.isArray(res.data) ? res.data : [];
        renderCompaniesModuleWeb();
    } catch (e) {
        companyModuleDataWeb = [];
        page.innerHTML = `<div class="empty-module"><h2 style="color:red;">Gagal memuat: ${escapeHtml(e.message)}</h2></div>`;
    }
}

function renderCompaniesModuleWeb() {
    const page = document.getElementById("page-companies");
    if (!page) return;
    page.innerHTML = `
        <div class="page-intro">
            <span class="section-label">PERUSAHAAN</span>
            <h2>Manajemen Perusahaan</h2>
            <p>Tambah perusahaan baru atau klik data perusahaan untuk mengeditnya.</p>
        </div>
        <div class="module-card company-module-card">
            <div class="module-card-header">
                <div><span class="section-label">DAFTAR</span><h3>Perusahaan Terdaftar</h3></div>
                <button type="button" class="primary-button module-add-button" onclick="openAddCompanyWeb()">+ NEW COMPANY</button>
            </div>
            <div class="company-grid" id="companyModuleList">
                ${companyModuleDataWeb.length ? companyModuleDataWeb.map((c,i) => `
                    <button type="button" class="company-card-button" onclick="openEditCompanyWeb(${i})">
                        <div class="company-card-icon">▤</div>
                        <div class="company-card-info">
                            <strong>${escapeHtml(c.name || "Tanpa Nama")}</strong>
                            <span>ID: ${escapeHtml(c.id || "-")}</span>
                        </div>
                        <span class="menu-arrow">EDIT →</span>
                    </button>`).join("") : `<div class="empty-module"><h2>Belum ada perusahaan</h2><span>Klik + NEW COMPANY untuk menambahkan.</span></div>`}
            </div>
        </div>

        <div class="modal-overlay" id="companyFormModal">
            <div class="company-form-modal-card">
                <button type="button" class="modal-close" onclick="closeCompanyFormWeb()">×</button>
                <span class="section-label">PERUSAHAAN</span>
                <h2 id="companyFormTitle">Tambah Perusahaan</h2>
                <input type="hidden" id="companyFormId">
                <div class="company-form-grid">
                    <div class="form-group"><label>NAMA PERUSAHAAN *</label><input id="companyFormName" type="text" placeholder="Nama perusahaan"></div>
                    <div class="form-group"><label>BIDANG USAHA / INDUSTRI</label><input id="companyFormIndustry" type="text" placeholder="Bidang usaha / industri"></div>
                    <div class="form-group company-form-full"><label>ALAMAT LENGKAP</label><textarea id="companyFormAddress" placeholder="Alamat perusahaan"></textarea></div>
                    <div class="form-group"><label>KOTA / PROVINSI / KODE POS</label><input id="companyFormCity" type="text" placeholder="Kota / Provinsi / Kode Pos"></div>
                    <div class="form-group"><label>NOMOR TELEPON / FAX</label><input id="companyFormPhone" type="text" placeholder="Nomor telepon / fax"></div>
                    <div class="form-group"><label>EMAIL RESMI</label><input id="companyFormEmail" type="email" placeholder="Email perusahaan"></div>
                    <div class="form-group"><label>WEBSITE</label><input id="companyFormWebsite" type="text" placeholder="Website perusahaan"></div>
                </div>
                <div class="modal-actions company-form-actions">
                    <button type="button" class="secondary-button" onclick="closeCompanyFormWeb()">BATAL</button>
                    <button type="button" class="danger-button" id="companyDeleteBtn" onclick="deleteCompanyWeb()">HAPUS</button>
                    <button type="button" class="primary-button modal-primary" onclick="saveCompanyWeb()">SIMPAN</button>
                </div>
            </div>
        </div>`;
}

function clearCompanyFormWeb() {
    ["companyFormId","companyFormName","companyFormIndustry","companyFormAddress","companyFormCity","companyFormPhone","companyFormEmail","companyFormWebsite"].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = "";
    });
}

function openAddCompanyWeb() {
    clearCompanyFormWeb();
    selectedCompanyWeb = null;
    const modal = document.getElementById("companyFormModal");
    if (modal) modal.classList.add("show");
    const title = document.getElementById("companyFormTitle");
    const del = document.getElementById("companyDeleteBtn");
    if (title) title.textContent = "Tambah Perusahaan";
    if (del) del.style.display = "none";
}

function openEditCompanyWeb(index) {
    const c = companyModuleDataWeb[index];
    if (!c) return;
    selectedCompanyWeb = c;
    clearCompanyFormWeb();
    document.getElementById("companyFormId").value = c.id || "";
    document.getElementById("companyFormName").value = c.name || "";
    // get_companies intentionally returns only id/name, so the remaining fields
    // are editable when creating a company but are not fabricated on edit.
    const modal = document.getElementById("companyFormModal");
    if (modal) modal.classList.add("show");
    const title = document.getElementById("companyFormTitle");
    const del = document.getElementById("companyDeleteBtn");
    if (title) title.textContent = "Edit Data Perusahaan";
    if (del) del.style.display = "block";
}

function closeCompanyFormWeb() {
    const modal = document.getElementById("companyFormModal");
    if (modal) modal.classList.remove("show");
}

async function saveCompanyWeb() {
    const id = document.getElementById("companyFormId")?.value.trim() || "";
    const name = document.getElementById("companyFormName")?.value.trim() || "";
    if (!name) { showToast("Nama perusahaan wajib diisi!"); return; }
    const payload = {
        action: "save_company",
        id, name,
        industry: document.getElementById("companyFormIndustry")?.value.trim() || "",
        address: document.getElementById("companyFormAddress")?.value.trim() || "",
        city_province_zip: document.getElementById("companyFormCity")?.value.trim() || "",
        phone_fax: document.getElementById("companyFormPhone")?.value.trim() || "",
        email: document.getElementById("companyFormEmail")?.value.trim() || "",
        website: document.getElementById("companyFormWebsite")?.value.trim() || ""
    };
    showToast(id ? "Menyimpan perubahan perusahaan..." : "Menyimpan perusahaan...");
    try {
        const res = await callGoogleScript(payload);
        if (!res.success) { showToast(res.message || "Gagal menyimpan perusahaan."); return; }
        closeCompanyFormWeb();
        showToast(res.message || "Data perusahaan berhasil disimpan.");
        await loadCompaniesModule();
        await fetchCompaniesList();
    } catch (e) { showToast("Gagal menyimpan: " + e.message); }
}

async function deleteCompanyWeb() {
    const id = document.getElementById("companyFormId")?.value.trim() || "";
    if (!id) return;
    if (!confirm("Hapus perusahaan ini?")) return;
    try {
        const res = await callGoogleScript({ action: "delete_company", id });
        if (!res.success) { showToast(res.message || "Gagal menghapus perusahaan."); return; }
        closeCompanyFormWeb();
        showToast(res.message || "Perusahaan berhasil dihapus.");
        await loadCompaniesModule();
        await fetchCompaniesList();
    } catch (e) { showToast("Gagal menghapus: " + e.message); }
}
async function loadEmployeesModule() {
    renderSimpleList("page-employees", "get_employees", e => `<strong>${e.name}</strong> (NIK: ${e.nik || "-"}) - ${e.company_name || ""}`);
}
async function loadAttendanceModule() {
    renderSimpleList("page-attendance", "get_attendance", a => `<strong>${a.employee_name || a.employee_id}</strong> - ${a.date} [Masuk: ${a.check_in || "-"}]`);
}
async function loadLeaveModule() {
    renderSimpleList("page-leave", "get_leave", l => `<strong>${l.employee_name || l.employee_id}</strong> - ${l.status || ""}`);
}
async function loadRecruitmentModule() {
    renderSimpleList("page-recruitment", "get_recruitment", r => `<strong>${r.name}</strong> - Posisi: ${r.status || ""}`);
}
let userModuleDataWeb = [];
let selectedUserWeb = null;

async function loadUsersModule() {
    const page = document.getElementById("page-users");
    if (!page) return;
    page.innerHTML = `<div class="empty-module"><h2>Memuat data pengguna...</h2></div>`;
    try {
        const res = await callGoogleScript({ action: "get_users" });
        userModuleDataWeb = res.success && Array.isArray(res.data) ? res.data : [];
        renderUsersModuleWeb();
    } catch (e) {
        userModuleDataWeb = [];
        page.innerHTML = `<div class="empty-module"><h2 style="color:red;">Gagal memuat: ${escapeHtml(e.message)}</h2></div>`;
    }
}

function renderUsersModuleWeb() {
    const page = document.getElementById("page-users");
    if (!page) return;
    page.innerHTML = `
        <div class="page-intro">
            <span class="section-label">PENGGUNA</span>
            <h2>Manajemen Pengguna</h2>
            <p>Kelola nama, username, password, email, dan perusahaan pengguna HRIS.</p>
        </div>
        <div class="module-card user-module-card">
            <div class="module-card-header">
                <div><span class="section-label">DAFTAR</span><h3>Pengguna Sistem</h3></div>
                <button type="button" class="primary-button module-add-button" onclick="openAddUserWeb()">+ TAMBAH PENGGUNA</button>
            </div>
            <div class="user-grid" id="userModuleList">
                ${userModuleDataWeb.length ? userModuleDataWeb.map((u,i) => `
                    <button type="button" class="user-card-button" onclick="openEditUserWeb(${i})">
                        <div class="employee-avatar">${escapeHtml(getInitials(u.nama || u.username || "HR"))}</div>
                        <div class="user-card-info">
                            <strong>${escapeHtml(u.nama || "Nama belum diisi")}</strong>
                            <span>Username: ${escapeHtml(u.username || "-")}</span>
                            <small>${escapeHtml(u.email || u.company || "Pengguna HRIS")}</small>
                        </div>
                        <span class="menu-arrow">EDIT →</span>
                    </button>`).join("") : `<div class="empty-module"><h2>Belum ada pengguna</h2><span>Klik + TAMBAH PENGGUNA untuk menambahkan.</span></div>`}
            </div>
        </div>

        <div class="modal-overlay" id="userFormModal">
            <div class="user-form-modal-card">
                <button type="button" class="modal-close" onclick="closeUserFormWeb()">×</button>
                <span class="section-label">PENGGUNA</span>
                <h2 id="userFormTitle">Tambah Pengguna</h2>
                <input type="hidden" id="userFormId">
                <div class="user-form-grid">
                    <div class="form-group"><label>USERNAME *</label><input id="userFormUsername" type="text" placeholder="Masukkan username"></div>
                    <div class="form-group"><label>NAMA LENGKAP *</label><input id="userFormName" type="text" placeholder="Masukkan nama lengkap"></div>
                    <div class="form-group"><label>EMAIL</label><input id="userFormEmail" type="email" placeholder="Email pengguna"></div>
                    <div class="form-group"><label>PERUSAHAAN</label><input id="userFormCompany" type="text" placeholder="Nama / perusahaan pengguna"></div>
                    <div class="form-group user-form-full"><label>PASSWORD *</label><input id="userFormPassword" type="password" placeholder="Masukkan password"></div>
                </div>
                <div class="user-password-note">Untuk keamanan dan karena API GS tidak mengirim password saat mengambil daftar pengguna, password lama tidak dapat ditampilkan. Saat mengedit pengguna, isi password untuk menyimpannya kembali.</div>
                <div class="modal-actions user-form-actions">
                    <button type="button" class="secondary-button" onclick="closeUserFormWeb()">BATAL</button>
                    <button type="button" class="primary-button modal-primary" onclick="saveUserWeb()">SIMPAN PENGGUNA</button>
                </div>
            </div>
        </div>`;
}

function clearUserFormWeb() {
    ["userFormId","userFormUsername","userFormName","userFormEmail","userFormCompany","userFormPassword"].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = "";
    });
}

function openAddUserWeb() {
    clearUserFormWeb();
    selectedUserWeb = null;
    const modal = document.getElementById("userFormModal");
    if (modal) modal.classList.add("show");
    const title = document.getElementById("userFormTitle");
    if (title) title.textContent = "Tambah Pengguna";
}

function openEditUserWeb(index) {
    const u = userModuleDataWeb[index];
    if (!u) return;
    selectedUserWeb = u;
    clearUserFormWeb();
    document.getElementById("userFormId").value = u.id || "";
    document.getElementById("userFormUsername").value = u.username || "";
    document.getElementById("userFormName").value = u.nama || "";
    document.getElementById("userFormEmail").value = u.email || "";
    document.getElementById("userFormCompany").value = u.company || "";
    const modal = document.getElementById("userFormModal");
    if (modal) modal.classList.add("show");
    const title = document.getElementById("userFormTitle");
    if (title) title.textContent = "Edit Data Pengguna";
}

function closeUserFormWeb() {
    const modal = document.getElementById("userFormModal");
    if (modal) modal.classList.remove("show");
}

async function saveUserWeb() {
    const id = document.getElementById("userFormId")?.value.trim() || "";
    const username = document.getElementById("userFormUsername")?.value.trim() || "";
    const nama = document.getElementById("userFormName")?.value.trim() || "";
    const password = document.getElementById("userFormPassword")?.value || "";
    if (!username || !nama || !password) {
        showToast("Username, nama lengkap, dan password wajib diisi.");
        return;
    }
    const payload = {
        action: "save_user", id, username, nama, password,
        email: document.getElementById("userFormEmail")?.value.trim() || "",
        company: document.getElementById("userFormCompany")?.value.trim() || ""
    };
    showToast(id ? "Menyimpan perubahan pengguna..." : "Menyimpan pengguna...");
    try {
        const res = await callGoogleScript(payload);
        if (!res.success) { showToast(res.message || "Gagal menyimpan pengguna."); return; }
        closeUserFormWeb();
        showToast(res.message || "Pengguna berhasil disimpan.");
        await loadUsersModule();
    } catch (e) { showToast("Gagal menyimpan: " + e.message); }
}
async function loadContractsModule() {
    renderSimpleList("page-contract", "get_contracts", c => `<strong>${c.employee_name || c.employee_id}</strong> - No PKWT: ${c.pkwt_number || "-"}`);
}

async function renderSimpleList(containerId, action, templateFn) {
    const page = document.getElementById(containerId);
    page.innerHTML = `<div class="empty-module"><h2>Memuat data...</h2></div>`;
    try {
        const res = await callGoogleScript({ action: action });
        if (res.success && res.data && res.data.length > 0) {
            let html = `<div class="payroll-card"><div class="payroll-card-title">DAFTAR DATA</div><ul style="list-style:none; padding:0;">`;
            res.data.forEach(item => {
                html += `<li style="padding:12px; border-bottom:1px solid #E3E6E9;">${templateFn(item)}</li>`;
            });
            html += `</ul></div>`;
            page.innerHTML = html;
        } else {
            page.innerHTML = `<div class="empty-module"><h2>Tidak ada data.</h2></div>`;
        }
    } catch (e) {
        page.innerHTML = `<div class="empty-module"><h2 style="color:red;">Gagal memuat: ${e.message}</h2></div>`;
    }
}

/* =========================================================
   UTILS & HELPERS
========================================================= */
function numberValue(id) {
    const el = document.getElementById(id);
    if (!el) return 0;
    const val = parseFloat(el.value);
    return isNaN(val) ? 0 : val;
}

function formatRupiah(value) {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value || 0);
}

function getInitials(name) {
    if (!name) return "HR";
    return name.trim().split(/\s+/).slice(0, 2).map(p => p.charAt(0).toUpperCase()).join("");
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text || "";
    return div.innerHTML;
}

function showToast(message) {
    const toast = document.getElementById("toast");
    document.getElementById("toastMessage").textContent = message;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 3000);
}

function toggleSidebar() {
    document.getElementById("sidebar").classList.toggle("open");
}

function closeSidebar() {
    document.getElementById("sidebar").classList.remove("open");
}

/* =========================================================
   REVISI WEB: PKWT, DATA KARYAWAN, CUTI & IZIN
   Login, Apps Script caller, Payroll dan modul lain dipertahankan.
========================================================= */
let contractEmployeesWeb=[];
let selectedContractEmployeeWeb=null;
let employeeModuleDataWeb=[];
let leaveDataWeb=[];

function webEmployeeName(o){return o?.name||o?.employee_name||o?.nama||o?.employeeName||o?.username||"Nama tidak ditemukan";}
function webCompanyId(o){return String(o?.company_id??o?.companyId??"").trim();}
function webCompanyName(o){return o?.company_name||o?.companyName||companyMap[webCompanyId(o)]||o?.company||"-";}
function webStatus(s){s=String(s||"").trim().toUpperCase();return {PENDING:"MENUNGGU",APPROVED:"DISETUJUI",REJECTED:"DITOLAK"}[s]||s||"MENUNGGU";}
function setCountWeb(id,n,label){const e=document.getElementById(id);if(e)e.textContent=`${n} ${label}`;}
function jsAttrWeb(v){return String(v||"").replace(/\\/g,"\\\\").replace(/'/g,"\\'");}

/* =========================================================
   DATA KARYAWAN - TAMBAH / EDIT / HAPUS
   Dibuat mengikuti alur EmployeeActivity Android.
========================================================= */
async function openAddEmployeeWeb(){
    clearEmployeeFormWeb();
    const modal=document.getElementById("employeeFormModal");
    const title=document.getElementById("employeeFormTitle");
    const deleteBtn=document.getElementById("employeeDeleteBtn");
    const companyFilter=document.getElementById("employeeCompanyFilter");
    if(title)title.textContent="Tambah Karyawan";
    if(deleteBtn)deleteBtn.style.display="none";
    // Tampilkan form terlebih dahulu. Pengambilan daftar perusahaan tidak boleh
    // membuat tombol TAMBAH terlihat seperti tidak bekerja saat jaringan lambat.
    if(modal)modal.classList.add("show");
    const formCompany=document.getElementById("employeeFormCompany");
    try {
        await fillEmployeeFormCompanyWeb();
        if(formCompany && companyFilter && companyFilter.value && companyFilter.value!=="ALL"){
            formCompany.value=companyFilter.value;
        }
    } catch(e) {
        console.error(e);
    }
}

async function openEmployeeEditWeb(id){
    const employee=employeeModuleDataWeb.find(e=>String(e.id||"")===String(id||""));
    if(!employee){
        showToast("Data karyawan tidak ditemukan.");
        return;
    }
    await fillEmployeeFormCompanyWeb();
    fillEmployeeFormWeb(employee);
    const modal=document.getElementById("employeeFormModal");
    const title=document.getElementById("employeeFormTitle");
    const deleteBtn=document.getElementById("employeeDeleteBtn");
    if(title)title.textContent="Edit Data Karyawan";
    if(deleteBtn)deleteBtn.style.display="block";
    if(modal)modal.classList.add("show");
}

function clearEmployeeFormWeb(){
    const ids=[
        "employeeFormId","employeeFormName","employeeFormNIK","employeeFormBirthPlace",
        "employeeFormBirthDate","employeeFormGender","employeeFormReligion",
        "employeeFormMarital","employeeFormBlood","employeeFormEducation",
        "employeeFormPhone","employeeFormAddress","employeeFormStartDate",
        "employeeFormEndDate","employeeFormPkwt"
    ];
    ids.forEach(id=>{const el=document.getElementById(id);if(el)el.value="";});
    const status=document.getElementById("employeeFormStatus");
    if(status)status.value="ACTIVE";
    const company=document.getElementById("employeeFormCompany");
    if(company && company.options.length)company.selectedIndex=0;
}

function normalizeDateForInputWeb(value){
    const s=String(value||"").trim();
    if(!s)return "";
    const m=s.match(/(\d{4}-\d{2}-\d{2})/);
    return m?m[1]:"";
}

function fillEmployeeFormWeb(e){
    const set=(id,v)=>{const el=document.getElementById(id);if(el)el.value=v==null?"":String(v);};
    set("employeeFormId",e.id||"");
    set("employeeFormName",e.name||"");
    set("employeeFormNIK",e.nik||e.NIK||"");
    set("employeeFormBirthPlace",e.birth_place||"");
    set("employeeFormBirthDate",normalizeDateForInputWeb(e.birth_date));
    set("employeeFormGender",e.gender||"");
    set("employeeFormReligion",e.religion||"");
    set("employeeFormMarital",e.marital_status||"");
    set("employeeFormBlood",e.blood_type||"");
    set("employeeFormEducation",e.education||"");
    set("employeeFormPhone",e.phone||"");
    set("employeeFormAddress",e.address||"");
    set("employeeFormStartDate",normalizeDateForInputWeb(e.start_date));
    set("employeeFormEndDate",normalizeDateForInputWeb(e.end_date));
    set("employeeFormPkwt",e.pkwt_ke||"1");
    set("employeeFormStatus",e.status||"ACTIVE");
    const company=document.getElementById("employeeFormCompany");
    if(company)company.value=webCompanyId(e)||"";
}

async function fillEmployeeFormCompanyWeb(){
    const sel=document.getElementById("employeeFormCompany");
    if(!sel)return;
    try{
        const r=await callGoogleScript({action:"get_companies"});
        const data=r.success&&Array.isArray(r.data)?r.data:[];
        sel.innerHTML='<option value="">-- PILIH PERUSAHAAN --</option>';
        data.forEach(c=>{
            const o=document.createElement("option");
            o.value=c.id||"";
            o.textContent=c.name||"Tanpa Nama";
            sel.appendChild(o);
        });
    }catch(e){
        console.error("Gagal memuat perusahaan untuk form karyawan:",e);
        sel.innerHTML='<option value="">Gagal memuat perusahaan</option>';
    }
}

function closeEmployeeFormWeb(){
    const modal=document.getElementById("employeeFormModal");
    if(modal)modal.classList.remove("show");
}

async function saveEmployeeWeb(){
    const id=document.getElementById("employeeFormId")?.value.trim()||"";
    const name=document.getElementById("employeeFormName")?.value.trim()||"";
    const nik=document.getElementById("employeeFormNIK")?.value.trim()||"";
    const companyId=document.getElementById("employeeFormCompany")?.value.trim()||"";

    if(!name||!nik){
        showToast("Nama dan NIK wajib diisi!");
        return;
    }
    if(!companyId){
        showToast("Silakan pilih perusahaan!");
        return;
    }

    const payload={
        action:"save_employee",
        id:id,
        name:name,
        nik:nik,
        birth_place:document.getElementById("employeeFormBirthPlace")?.value.trim()||"",
        birth_date:document.getElementById("employeeFormBirthDate")?.value||"",
        gender:document.getElementById("employeeFormGender")?.value.trim()||"",
        religion:document.getElementById("employeeFormReligion")?.value.trim()||"",
        marital_status:document.getElementById("employeeFormMarital")?.value.trim()||"",
        blood_type:document.getElementById("employeeFormBlood")?.value.trim()||"",
        education:document.getElementById("employeeFormEducation")?.value.trim()||"",
        phone:document.getElementById("employeeFormPhone")?.value.trim()||"",
        address:document.getElementById("employeeFormAddress")?.value.trim()||"",
        company_id:companyId,
        start_date:document.getElementById("employeeFormStartDate")?.value||"",
        end_date:document.getElementById("employeeFormEndDate")?.value||"",
        pkwt_ke:document.getElementById("employeeFormPkwt")?.value.trim()||"1",
        status:document.getElementById("employeeFormStatus")?.value||"ACTIVE"
    };

    showToast(id?"Menyimpan perubahan karyawan...":"Menyimpan karyawan...");
    try{
        const r=await callGoogleScript(payload);
        if(!r.success){
            showToast(r.message||"Gagal menyimpan data karyawan.");
            return;
        }
        closeEmployeeFormWeb();
        showToast(r.message||(id?"Data karyawan berhasil diperbarui.":"Karyawan berhasil ditambahkan."));
        await loadEmployeesByCompanyWeb();
        try{await loadDashboardStats();}catch(_){}
    }catch(e){
        showToast("Gagal menyimpan: "+e.message);
    }
}

async function deleteEmployeeWeb(){
    const id=document.getElementById("employeeFormId")?.value.trim()||"";
    const name=document.getElementById("employeeFormName")?.value.trim()||"";
    if(!id){
        showToast("Data karyawan belum dipilih!");
        return;
    }
    if(!confirm(`Hapus karyawan "${name||"ini"}"?\\n\\nData karyawan akan dihapus dari sistem.`)){
        return;
    }

    showToast("Menghapus karyawan...");
    try{
        const r=await callGoogleScript({action:"delete_employee",id:id});
        if(!r.success){
            showToast(r.message||"Gagal menghapus karyawan.");
            return;
        }
        closeEmployeeFormWeb();
        showToast(r.message||"Karyawan berhasil dihapus.");
        await loadEmployeesByCompanyWeb();
        try{await loadDashboardStats();}catch(_){}
    }catch(e){
        showToast("Gagal menghapus: "+e.message);
    }
}


/* PKWT */
async function loadContractsModule(){
    const sel=document.getElementById("contractCompany"); if(!sel)return;
    await fillCompanySelectWeb(sel);
    if(!sel.dataset.bound){sel.dataset.bound="1";sel.onchange=loadContractEmployeesWeb;}
    await loadContractEmployeesWeb();
}
async function fillCompanySelectWeb(sel){
    try{
        const r=await callGoogleScript({action:"get_companies"});
        const data=r.success&&Array.isArray(r.data)?r.data:[];
        sel.innerHTML='<option value="ALL">-- SEMUA PERUSAHAAN --</option>';
        data.forEach(c=>{const o=document.createElement("option");o.value=c.id||"";o.textContent=c.name||"Tanpa Nama";sel.appendChild(o);});
    }catch(e){console.error(e);}
}
async function loadContractEmployeesWeb(){
    const sel=document.getElementById("contractCompany"), box=document.getElementById("contractEmployeeList");if(!sel||!box)return;
    box.innerHTML='<div class="empty-module"><h2>Memuat karyawan...</h2></div>';
    try{
        const r=await callGoogleScript({action:"get_employees",company_id:sel.value||"ALL"});
        contractEmployeesWeb=r.success&&Array.isArray(r.data)?r.data:[];
        renderContractEmployeesWeb();
    }catch(e){contractEmployeesWeb=[];box.innerHTML=`<div class="empty-module"><h2 style="color:red;">Gagal memuat: ${escapeHtml(e.message)}</h2></div>`;}
}
function renderContractEmployeesWeb(){
    const box=document.getElementById("contractEmployeeList");if(!box)return;
    setCountWeb("contractCount",contractEmployeesWeb.length,"karyawan");
    if(!contractEmployeesWeb.length){box.innerHTML='<div class="empty-module"><h2>Belum ada karyawan</h2><span>Tidak ada data untuk perusahaan yang dipilih.</span></div>';return;}
    box.innerHTML=contractEmployeesWeb.map((e,i)=>{
        const n=webEmployeeName(e),k=e.pkwt_ke||e.pkwtKe||"1",s=e.start_date||"-",en=e.end_date||"-";
        return `<button class="employee-card-button" onclick="openContractModalWeb(${i})"><div class="employee-avatar">${escapeHtml(getInitials(n))}</div><div class="employee-card-info"><strong>${escapeHtml(n)}</strong><span>${escapeHtml(webCompanyName(e))}</span><small>PKWT Ke-${escapeHtml(String(k))} • ${escapeHtml(String(s))} s/d ${escapeHtml(String(en))}</small></div><span class="menu-arrow">→</span></button>`;
    }).join("");
}
async function openContractModalWeb(i){
    const e=contractEmployeesWeb[i];if(!e)return;selectedContractEmployeeWeb=e;
    const n=webEmployeeName(e),k=e.pkwt_ke||e.pkwtKe||"1",s=e.start_date||"-",en=e.end_date||"-";
    document.getElementById("contractModalEmployeeName").textContent=n;
    document.getElementById("contractModalPeriod").textContent=`${s} s/d ${en} (PKWT Ke-${k})`;
    document.getElementById("contractModalPkwtNo").value="Generasi nomor...";
    document.getElementById("contractModal").classList.add("show");
    try{
        const r=await callGoogleScript({action:"generate_pkwt_number",company_id:webCompanyId(e)||"CMP",pkwt_ke:k});
        document.getElementById("contractModalPkwtNo").value=r.pkwt_number||"Nomor belum tersedia";
    }catch(x){document.getElementById("contractModalPkwtNo").value="Nomor belum tersedia";}
}
function closeContractModal(){const m=document.getElementById("contractModal");if(m)m.classList.remove("show");selectedContractEmployeeWeb=null;}
async function saveAndPrintContractWeb(){
    const e=selectedContractEmployeeWeb;
    const n=document.getElementById("contractModalPkwtNo")?.value.trim()||"";
    if(!e)return;
    if(!n||n==="Generasi nomor..."||n==="Nomor belum tersedia"){showToast("Nomor PKWT belum tersedia.");return;}
    showToast("Memproses Cetak Dokumen PKWT...");
    try{
        const r=await callGoogleScript({
            action:"save_contract",
            employee_id:e.id||"",
            employee_name:webEmployeeName(e),
            company_id:webCompanyId(e)||"",
            pkwt_number:n,
            pkwt_ke:e.pkwt_ke||e.pkwtKe||"1",
            start_date:e.start_date||"",
            end_date:e.end_date||""
        });
        closeContractModal();
        if(r.pdf_url){
            downloadPkwtPdfWeb(r.pdf_url, `PKWT_${webEmployeeName(e)}_${n}.pdf`);
        } else {
            showToast(r.message||"Gagal mendapatkan link PDF.");
        }
    }catch(x){showToast("Error: "+x.message);}
}

function downloadPkwtPdfWeb(url,fileName){
    try{
        const a=document.createElement("a");
        a.href=url;
        a.download=String(fileName||"PKWT.pdf").replace(/[^a-zA-Z0-9._-]/g,"_");
        a.target="_blank";
        a.rel="noopener";
        a.style.display="none";
        document.body.appendChild(a);
        a.click();
        a.remove();
        showToast("Dokumen PKWT berhasil dibuat. Jika browser tidak langsung mengunduh, cek tab baru atau folder Download.");
    }catch(e){
        window.open(url,"_blank","noopener");
        showToast("PDF dibuka. Silakan simpan ke folder Download.");
    }
}

/* DATA KARYAWAN */
async function loadEmployeesModule(){
    const sel=document.getElementById("employeeCompanyFilter");if(!sel)return;
    if(!sel.dataset.bound){sel.dataset.bound="1";sel.onchange=loadEmployeesByCompanyWeb;}
    await fillCompanySelectWeb(sel);await loadEmployeesByCompanyWeb();
}
async function loadEmployeesByCompanyWeb(){
    const sel=document.getElementById("employeeCompanyFilter"),box=document.getElementById("employeeModuleList");if(!sel||!box)return;
    box.innerHTML='<div class="empty-module"><h2>Memuat data karyawan...</h2></div>';
    try{
        const r=await callGoogleScript({action:"get_employees",company_id:sel.value||"ALL"});
        employeeModuleDataWeb=r.success&&Array.isArray(r.data)?r.data:[];renderEmployeeModuleWeb();
    }catch(e){employeeModuleDataWeb=[];box.innerHTML=`<div class="empty-module"><h2 style="color:red;">Gagal memuat: ${escapeHtml(e.message)}</h2></div>`;}
}
function renderEmployeeModuleWeb(){
    const box=document.getElementById("employeeModuleList");
    if(!box)return;
    setCountWeb("employeeCount",employeeModuleDataWeb.length,"karyawan");

    if(!employeeModuleDataWeb.length){
        box.innerHTML='<div class="empty-module"><h2>Belum ada karyawan</h2><span>Klik tombol TAMBAH KARYAWAN untuk menambahkan data.</span></div>';
        return;
    }

    box.innerHTML=employeeModuleDataWeb.map(e=>{
        const n=webEmployeeName(e);
        const nik=e.nik||e.NIK||"-";
        const st=e.status||"ACTIVE";
        return `
            <button type="button" class="employee-module-card employee-edit-card" onclick="openEmployeeEditWeb('${jsAttrWeb(e.id||"")}')">
                <div class="employee-avatar">${escapeHtml(getInitials(n))}</div>
                <div class="employee-card-info">
                    <strong>${escapeHtml(n)}</strong>
                    <span>${escapeHtml(webCompanyName(e))}</span>
                    <small>NIK: ${escapeHtml(String(nik))}</small>
                </div>
                <span class="status-chip ${String(st).toUpperCase()==="ACTIVE"?"status-active":"status-neutral"}">${escapeHtml(String(st))}</span>
                <span class="menu-arrow">→</span>
            </button>`;
    }).join("");
}

/* CUTI & IZIN */
async function loadLeaveModule(){
    const cs=document.getElementById("leaveCompanyFilter"),ss=document.getElementById("leaveStatusFilter"),body=document.getElementById("leaveTableBody");if(!cs||!ss)return;
    if(!cs.dataset.bound){cs.dataset.bound="1";cs.onchange=renderLeaveWeb;}
    if(!ss.dataset.bound){ss.dataset.bound="1";ss.onchange=renderLeaveWeb;}
    await fillCompanySelectWeb(cs);
    if(body)body.innerHTML='<tr><td colspan="8" class="table-empty">Memuat data...</td></tr>';
    try{const r=await callGoogleScript({action:"get_leave"});leaveDataWeb=r.success&&Array.isArray(r.data)?r.data:[];renderLeaveWeb();}
    catch(e){leaveDataWeb=[];if(body)body.innerHTML=`<tr><td colspan="8" class="table-empty error-text">Gagal memuat: ${escapeHtml(e.message)}</td></tr>`;}
}
function renderLeaveWeb(){
    const cs=document.getElementById("leaveCompanyFilter"),ss=document.getElementById("leaveStatusFilter"),body=document.getElementById("leaveTableBody");if(!cs||!ss||!body)return;
    const cid=cs.value||"ALL",want=ss.value==="ALL"?"":webStatus(ss.value);
    const rows=leaveDataWeb.filter(x=>(cid==="ALL"||!webCompanyId(x)||webCompanyId(x)===cid)&&(!want||webStatus(x.status)===want));
    const all=leaveDataWeb.map(x=>webStatus(x.status));const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
    set("leaveTotal",all.length);set("leavePending",all.filter(x=>x==="MENUNGGU").length);set("leaveApproved",all.filter(x=>x==="DISETUJUI").length);set("leaveRejected",all.filter(x=>x==="DITOLAK").length);setCountWeb("leaveCount",rows.length,"pengajuan");
    if(!rows.length){body.innerHTML='<tr><td colspan="8" class="table-empty">Tidak ada pengajuan cuti/izin untuk filter yang dipilih.</td></tr>';return;}
    body.innerHTML=rows.map(x=>{
        const st=webStatus(x.status),id=x.id||x.leave_id||x.leaveId||"",n=webEmployeeName(x),jenis=x.jenis_cuti||x.leave_type||x.type||x.jenis||"Cuti/Izin",s=x.tgl_mulai||x.start_date||x.tanggal_mulai||"-",en=x.tgl_selesai||x.end_date||x.tanggal_selesai||"-",d=x.durasi||x.duration||"-",a=x.alasan||x.reason||"-";
        return `<tr><td><strong>${escapeHtml(n)}</strong></td><td>${escapeHtml(String(jenis))}</td><td>${escapeHtml(String(s))}</td><td>${escapeHtml(String(en))}</td><td>${escapeHtml(String(d))}</td><td>${escapeHtml(String(a))}</td><td><span class="leave-status-chip status-${st.toLowerCase()}">${escapeHtml(st)}</span></td><td><div class="leave-actions"><button class="approve-button" onclick="updateLeaveStatusWeb('${jsAttrWeb(id)}','DISETUJUI')" ${st==="DISETUJUI"?"disabled":""}>✓ SETUJUI</button><button class="reject-button" onclick="updateLeaveStatusWeb('${jsAttrWeb(id)}','DITOLAK')" ${st==="DITOLAK"?"disabled":""}>✕ TIDAK DISETUJUI</button></div></td></tr>`;
    }).join("");
}
async function updateLeaveStatusWeb(id,status){
    if(!id){showToast("ID pengajuan cuti tidak ditemukan.");return;}
    showToast(`Mengubah status cuti ke ${status}...`);
    try{
        const r=await callGoogleScript({action:"update_leave_status",id:id,leave_id:id,status:status});
        if(r.success||r.status==="success"){showToast(`Status cuti berhasil diubah menjadi ${status}.`);await loadLeaveModule();}
        else showToast(r.message||"Gagal mengubah status cuti.");
    }catch(e){showToast("Gagal mengubah status: "+e.message);}
}

/* Klik area luar untuk menutup modal PKWT */
document.addEventListener("click",e=>{const m=document.getElementById("contractModal");if(m&&e.target===m)closeContractModal();});
