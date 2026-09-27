/* =========================================================
   HRIS WEB APPLICATION - FULL INTEGRATED & FIXED
========================================================= */

let currentUser = null;
let selectedEmployee = null;
let payrollData = {};
let companyListCache = [];

/* =========================================================
   INITIALIZATION & AUTHENTICATION
========================================================= */
document.addEventListener("DOMContentLoaded", function () {
    checkSession();
});

function checkSession() {
    const savedUser = localStorage.getItem("hris_user");
    if (savedUser) {
        try {
            currentUser = JSON.parse(savedUser);
            setupUserUI();
            initDashboardData();
        } catch (e) {
            showLoginModal();
        }
    } else {
        showLoginModal();
    }
}

function setupUserUI() {
    document.getElementById("loginModal").style.display = "none";
    document.getElementById("appContainer").style.display = "flex";
    
    const name = currentUser.nama || currentUser.username || "Administrator";
    document.getElementById("userName").textContent = name;
    document.getElementById("userRole").textContent = currentUser.company || "Administrator";
    document.getElementById("userAvatar").textContent = getInitials(name);
}

function showLoginModal() {
    document.getElementById("appContainer").style.display = "none";
    document.getElementById("loginModal").style.display = "flex";
}

async function handleLogin(event) {
    event.preventDefault();
    const usernameInput = document.getElementById("loginUsername").value.trim();
    const passwordInput = document.getElementById("loginPassword").value.trim();
    const errorEl = document.getElementById("loginError");

    if (!usernameInput || !passwordInput) {
        errorEl.textContent = "Username dan password wajib diisi!";
        errorEl.style.display = "block";
        return;
    }

    errorEl.style.display = "none";
    showToast("Memproses login...");

    try {
        const response = await callGoogleScript({
            action: "login",
            username: usernameInput,
            password: passwordInput
        });

        if (response.success && response.user) {
            currentUser = response.user;
            localStorage.setItem("hris_user", JSON.stringify(currentUser));
            showToast("Login berhasil!");
            setupUserUI();
            initDashboardData();
        } else {
            errorEl.textContent = response.message || "Username atau password salah.";
            errorEl.style.display = "block";
        }
    } catch (err) {
        errorEl.textContent = "Koneksi gagal: " + err.message;
        errorEl.style.display = "block";
    }
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

    if (isReadOnly) {
        const queryParams = new URLSearchParams(payload).toString();
        targetUrl = `${url}?${queryParams}`;
        options = { method: "GET", headers: { "Accept": "application/json" } };
    } else {
        const formData = new URLSearchParams();
        Object.keys(payload).forEach(key => formData.append(key, payload[key]));
        targetUrl = url.includes("?") ? `${url}&action=${action}` : `${url}?action=${action}`;
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
    if (!response.ok) throw new Error(`HTTP Error ${response.status}`);

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
        dashboard: "Dashboard", contract: "Kontrak Kerja", employees: "Data Karyawan",
        companies: "Perusahaan", payroll: "Payroll", attendance: "Absensi",
        leave: "Cuti & Izin", recruitment: "Rekrutmen", users: "Pengguna", settings: "Pengaturan"
    };
    document.getElementById("pageTitle").textContent = titleMap[page] || "Dashboard";
    closeSidebar();

    if (page === "employees") loadEmployeesModule();
    if (page === "contract") loadContractsModule();
    if (page === "payroll") loadPayrollModule();
    if (page === "companies") loadCompaniesModule();
    if (page === "attendance") loadAttendanceModule();
    if (page === "leave") loadLeaveModule();
    if (page === "recruitment") loadRecruitmentModule();
    if (page === "users") loadUsersModule();
}

/* =========================================================
   DASHBOARD & COMMON DROPDOWNS
========================================================= */
async function initDashboardData() {
    await populateAllCompanyDropdowns();
    showPage("dashboard");
    loadDashboardStats();
}

async function populateAllCompanyDropdowns() {
    try {
        const res = await callGoogleScript({ action: "get_companies" });
        if (res.success && Array.isArray(res.data)) {
            companyListCache = res.data;
            const dropdownIds = ["payrollCompany", "empCompanyFilter", "contractCompanyFilter"];
            
            dropdownIds.forEach(id => {
                const select = document.getElementById(id);
                if (select) {
                    select.innerHTML = '<option value="">-- Semua Perusahaan --</option>';
                    res.data.forEach(c => {
                        const opt = document.createElement("option");
                        opt.value = c.id;
                        opt.textContent = c.name;
                        select.appendChild(opt);
                    });
                }
            });

            // Populate form company
            const formSelect = document.getElementById("spFormEmpCompany");
            if (formSelect) {
                formSelect.innerHTML = "";
                res.data.forEach(c => {
                    const opt = document.createElement("option");
                    opt.value = c.id;
                    opt.textContent = c.name;
                    formSelect.appendChild(opt);
                });
            }
        }
    } catch (e) {
        console.error("Gagal memuat daftar perusahaan:", e);
    }
}

async function loadDashboardStats() {
    try {
        const empRes = await callGoogleScript({ action: "get_employees" });
        if (empRes.success && empRes.data) document.getElementById("totalEmployees").textContent = empRes.data.length;
        const attRes = await callGoogleScript({ action: "get_attendance" });
        if (attRes.success && attRes.data) {
            const today = new Date().toISOString().split("T")[0];
            document.getElementById("totalPresent").textContent = attRes.data.filter(a => String(a.date).includes(today)).length;
        }
        const leaveRes = await callGoogleScript({ action: "get_leave" });
        if (leaveRes.success && leaveRes.data) {
            document.getElementById("totalLeave").textContent = leaveRes.data.filter(l => l.status === "MENUNGGU" || l.status === "PENDING").length;
        }
    } catch (e) { console.error("Gagal stats:", e); }
}

/* =========================================================
   MODULE 1: DATA KARYAWAN
========================================================= */
async function loadEmployeesModule() {
    const compId = document.getElementById("empCompanyFilter").value || "ALL";
    const container = document.getElementById("empGridContainer");
    container.innerHTML = `<div class="empty-state"><span>Memuat karyawan...</span></div>`;

    try {
        const res = await callGoogleScript({ action: "get_employees", company_id: compId });
        if (res.success && res.data && res.data.length > 0) {
            container.innerHTML = "";
            res.data.forEach(emp => {
                const card = document.createElement("div");
                card.className = "employee-item";
                card.onclick = () => openEditEmployeeForm(emp);
                card.innerHTML = `
                    <div class="employee-avatar">${getInitials(emp.name)}</div>
                    <div class="employee-info">
                        <strong>${escapeHtml(emp.name)}</strong>
                        <span>NIK: ${escapeHtml(emp.nik || "-")} | ${escapeHtml(emp.company_name || "")}</span>
                    </div>
                    <span class="menu-arrow">→</span>
                `;
                container.appendChild(card);
            });
        } else {
            container.innerHTML = `<div class="empty-state"><div>♙</div><strong>Belum ada karyawan</strong><span>Tidak ada data karyawan.</span></div>`;
        }
    } catch (e) {
        container.innerHTML = `<div class="empty-state"><span style="color:red;">Error: ${e.message}</span></div>`;
    }
}

function openAddEmployeeForm() {
    selectedEmployee = null;
    document.getElementById("empFormTitle").textContent = "TAMBAH KARYAWAN";
    document.getElementById("btnDeleteEmp").style.display = "none";
    clearEmpFields();
    document.getElementById("empListSection").style.display = "none";
    document.getElementById("empFormDetail").classList.add("show");
}

function openEditEmployeeForm(emp) {
    selectedEmployee = emp;
    document.getElementById("empFormTitle").textContent = "EDIT DATA KARYAWAN";
    document.getElementById("btnDeleteEmp").style.display = "block";
    
    document.getElementById("edtEmpName").value = emp.name || "";
    document.getElementById("edtEmpNIK").value = emp.nik || "";
    document.getElementById("spFormEmpCompany").value = emp.company_id || "";
    document.getElementById("edtEmpBirth").value = emp.birth_place ? `${emp.birth_place}, ${emp.birth_date || ''}` : (emp.birth_date || "");
    document.getElementById("edtEmpGender").value = emp.gender || "";
    document.getElementById("edtEmpReligion").value = emp.religion || "";
    document.getElementById("edtEmpMarital").value = emp.marital_status || "";
    document.getElementById("edtEmpEducation").value = emp.education || "";
    document.getElementById("edtEmpPhone").value = emp.phone || "";
    document.getElementById("edtEmpStart").value = emp.start_date || "";
    document.getElementById("edtEmpEnd").value = emp.end_date || "";
    document.getElementById("edtEmpPkwt").value = emp.pkwt_ke || "1";
    document.getElementById("edtEmpAddress").value = emp.address || "";

    document.getElementById("empListSection").style.display = "none";
    document.getElementById("empFormDetail").classList.add("show");
}

function closeEmpForm() {
    document.getElementById("empListSection").style.display = "block";
    document.getElementById("empFormDetail").classList.remove("show");
    selectedEmployee = null;
}

function clearEmpFields() {
    document.getElementById("edtEmpName").value = "";
    document.getElementById("edtEmpNIK").value = "";
    document.getElementById("edtEmpBirth").value = "";
    document.getElementById("edtEmpGender").value = "";
    document.getElementById("edtEmpReligion").value = "";
    document.getElementById("edtEmpMarital").value = "";
    document.getElementById("edtEmpEducation").value = "";
    document.getElementById("edtEmpPhone").value = "";
    document.getElementById("edtEmpStart").value = "";
    document.getElementById("edtEmpEnd").value = "";
    document.getElementById("edtEmpPkwt").value = "";
    document.getElementById("edtEmpAddress").value = "";
}

async function saveEmployeeData() {
    const name = document.getElementById("edtEmpName").value.trim();
    const nik = document.getElementById("edtEmpNIK").value.trim();
    const companyId = document.getElementById("spFormEmpCompany").value;

    if (!name || !nik || !companyId) {
        showToast("Nama, NIK, dan Perusahaan wajib diisi!");
        return;
    }

    const birthParts = document.getElementById("edtEmpBirth").value.split(",");
    const payload = {
        action: "save_employee",
        id: selectedEmployee ? selectedEmployee.id : "",
        name: name,
        nik: nik,
        company_id: companyId,
        birth_place: birthParts[0] ? birthParts[0].trim() : "",
        birth_date: birthParts[1] ? birthParts[1].trim() : "",
        gender: document.getElementById("edtEmpGender").value.trim(),
        religion: document.getElementById("edtEmpReligion").value.trim(),
        marital_status: document.getElementById("edtEmpMarital").value.trim(),
        education: document.getElementById("edtEmpEducation").value.trim(),
        phone: document.getElementById("edtEmpPhone").value.trim(),
        start_date: document.getElementById("edtEmpStart").value,
        end_date: document.getElementById("edtEmpEnd").value,
        pkwt_ke: document.getElementById("edtEmpPkwt").value,
        address: document.getElementById("edtEmpAddress").value.trim(),
        status: "ACTIVE"
    };

    showToast("Menyimpan data karyawan...");
    try {
        const res = await callGoogleScript(payload);
        if (res.success) {
            showToast("Karyawan berhasil disimpan!");
            closeEmpForm();
            loadEmployeesModule();
        } else {
            showToast(res.message || "Gagal menyimpan.");
        }
    } catch (e) { showToast("Error: " + e.message); }
}

async function deleteEmployeeData() {
    if (!selectedEmployee || !selectedEmployee.id) return;
    if (!confirm(`Apakah Anda yakin ingin menghapus ${selectedEmployee.name}?`)) return;

    showToast("Menghapus karyawan...");
    try {
        const res = await callGoogleScript({ action: "delete_employee", id: selectedEmployee.id });
        if (res.success) {
            showToast("Karyawan berhasil dihapus.");
            closeEmpForm();
            loadEmployeesModule();
        } else { showToast(res.message || "Gagal menghapus."); }
    } catch (e) { showToast("Error: " + e.message); }
}

/* =========================================================
   MODULE 2: KONTRAK KERJA (PKWT)
========================================================= */
async function loadContractsModule() {
    const compId = document.getElementById("contractCompanyFilter").value || "ALL";
    const container = document.getElementById("contractGridContainer");
    container.innerHTML = `<div class="empty-state"><span>Memuat data kontrak...</span></div>`;

    try {
        const res = await callGoogleScript({ action: "get_employees", company_id: compId });
        if (res.success && res.data && res.data.length > 0) {
            container.innerHTML = "";
            res.data.forEach(emp => {
                const card = document.createElement("div");
                card.className = "employee-item";
                card.onclick = () => openContractModal(emp);
                card.innerHTML = `
                    <div class="employee-avatar">${getInitials(emp.name)}</div>
                    <div class="employee-info">
                        <strong>${escapeHtml(emp.name)}</strong>
                        <span>PKWT Ke-${escapeHtml(emp.pkwt_ke || "1")} | Periode: ${escapeHtml(emp.start_date || "-")} s/d ${escapeHtml(emp.end_date || "-")}</span>
                    </div>
                    <span class="menu-arrow">→</span>
                `;
                container.appendChild(card);
            });
        } else {
            container.innerHTML = `<div class="empty-state"><div>▣</div><strong>Belum ada kontrak</strong><span>Tidak ada data kontrak karyawan.</span></div>`;
        }
    } catch (e) { container.innerHTML = `<div class="empty-state"><span style="color:red;">Error: ${e.message}</span></div>`; }
}

async function openContractModal(emp) {
    selectedEmployee = emp;
    document.getElementById("modalContractEmpName").textContent = emp.name;
    document.getElementById("modalContractInfo").textContent = `PKWT Ke-${emp.pkwt_ke || '1'} | Periode: ${emp.start_date || '-'} s/d ${emp.end_date || '-'}`;
    document.getElementById("modalPkwtNumber").value = "Generasi nomor...";
    document.getElementById("contractDetailModal").classList.add("show");

    try {
        const res = await callGoogleScript({
            action: "generate_pkwt_number",
            company_id: emp.company_id || "",
            pkwt_ke: emp.pkwt_ke || "1"
        });
        if (res.success && res.pkwt_number) {
            document.getElementById("modalPkwtNumber").value = res.pkwt_number;
        }
    } catch (e) { document.getElementById("modalPkwtNumber").value = "PKWT/2026/0001"; }
}

function closeContractModal() {
    document.getElementById("contractDetailModal").classList.remove("show");
    selectedEmployee = null;
}

async function printContractPdf() {
    if (!selectedEmployee) return;
    const pkwtNo = document.getElementById("modalPkwtNumber").value;
    showToast("Memproses cetak PDF PKWT...");

    const payload = {
        action: "save_contract",
        employee_id: selectedEmployee.id,
        employee_name: selectedEmployee.name,
        company_id: selectedEmployee.company_id,
        pkwt_number: pkwtNo,
        start_date: selectedEmployee.start_date || "",
        end_date: selectedEmployee.end_date || "",
        pkwt_ke: selectedEmployee.pkwt_ke || "1"
    };

    try {
        const res = await callGoogleScript(payload);
        if (res.success && res.pdf_url) {
            showToast("PDF berhasil dibuat!");
            window.open(res.pdf_url, "_blank");
        } else {
            showToast(res.message || "Gagal membuat PDF.");
        }
    } catch (e) { showToast("Error: " + e.message); }
}

/* =========================================================
   MODULE 3: PAYROLL MODULE
========================================================= */
async function loadPayrollModule() {
    const compId = document.getElementById("payrollCompany").value || "ALL";
    const container = document.getElementById("payrollGridContainer");
    container.innerHTML = `<div class="empty-state"><span>Memuat karyawan...</span></div>`;

    try {
        const res = await callGoogleScript({ action: "get_employees", company_id: compId });
        if (res.success && res.data && res.data.length > 0) {
            container.innerHTML = "";
            res.data.forEach(emp => {
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
        } else {
            container.innerHTML = `<div class="empty-state"><div>Rp</div><strong>Belum ada karyawan</strong><span>Tidak ada data karyawan.</span></div>`;
        }
    } catch (e) { container.innerHTML = `<div class="empty-state"><span style="color:red;">Error: ${e.message}</span></div>`; }
}

async function selectEmployeeForPayroll(employee) {
    selectedEmployee = employee;
    document.getElementById("selectedEmployeeName").textContent = employee.name;
    document.querySelector("#page-payroll .employee-section").style.display = "none";
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
    } catch (e) { showToast("Gagal memuat detail: " + e.message); }
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
    if (!selectedEmployee) return;
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
        if (res.success) showToast("Payroll berhasil disimpan ke Sheet!");
        else showToast(res.message || "Gagal menyimpan.");
    } catch (e) { showToast("Error: " + e.message); }
}

function backToPayrollList() {
    document.querySelector("#page-payroll .employee-section").style.display = "block";
    document.getElementById("payrollDetail").classList.remove("show");
    selectedEmployee = null;
}

/* =========================================================
   GENERIC MODULE RENDERERS
========================================================= */
async function loadCompaniesModule() { renderSimpleList("page-companies", "get_companies", c => `<strong>${c.name}</strong> - ${c.industry || "Industri Utama"}`); }
async function loadAttendanceModule() { renderSimpleList("page-attendance", "get_attendance", a => `<strong>${a.employee_name || a.employee_id}</strong> - ${a.date} [Masuk: ${a.check_in || "-"}]`); }
async function loadLeaveModule() { renderSimpleList("page-leave", "get_leave", l => `<strong>${l.employee_name || l.employee_id}</strong> - ${l.leave_type} (${l.status})`); }
async function loadRecruitmentModule() { renderSimpleList("page-recruitment", "get_recruitment", r => `<strong>${r.name}</strong> - Posisi: ${r.position} (${r.status})`); }
async function loadUsersModule() { renderSimpleList("page-users", "get_users", u => `<strong>${u.nama || u.username}</strong> - Email: ${u.email || "-"}`); }

async function renderSimpleList(containerId, action, templateFn) {
    const page = document.getElementById(containerId);
    page.innerHTML = `<div class="empty-module"><h2>Memuat data...</h2></div>`;
    try {
        const res = await callGoogleScript({ action: action });
        if (res.success && res.data && res.data.length > 0) {
            let html = `<div class="payroll-card"><div class="payroll-card-title">DAFTAR DATA</div><ul style="list-style:none; padding:0;">`;
            res.data.forEach(item => html += `<li style="padding:12px; border-bottom:1px solid #E3E6E9;">${templateFn(item)}</li>`);
            html += `</ul></div>`;
            page.innerHTML = html;
        } else { page.innerHTML = `<div class="empty-module"><h2>Tidak ada data.</h2></div>`; }
    } catch (e) { page.innerHTML = `<div class="empty-module"><h2 style="color:red;">Gagal memuat: ${e.message}</h2></div>`; }
}

/* =========================================================
   HELPERS & UTILS
========================================================= */
function numberValue(id) {
    const el = document.getElementById(id);
    if (!el) return 0;
    const val = parseFloat(el.value);
    return isNaN(val) ? 0 : val;
}
function formatRupiah(val) { return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val || 0); }
function getInitials(name) { return !name ? "HR" : name.trim().split(/\s+/).slice(0, 2).map(p => p.charAt(0).toUpperCase()).join(""); }
function escapeHtml(text) { const div = document.createElement("div"); div.textContent = text || ""; return div.innerHTML; }
function showToast(msg) { const toast = document.getElementById("toast"); document.getElementById("toastMessage").textContent = msg; toast.classList.add("show"); setTimeout(() => toast.classList.remove("show"), 3000); }
function toggleSidebar() { document.getElementById("sidebar").classList.toggle("open"); }
function closeSidebar() { document.getElementById("sidebar").classList.remove("open"); }
