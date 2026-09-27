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
    await fetchCompaniesList();
    showPage("dashboard");
    loadDashboardStats();
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
async function loadCompaniesModule() {
    renderSimpleList("page-companies", "get_companies", c => `<strong>${c.name}</strong> - ${c.industry || "Industri Utama"}`);
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
async function loadUsersModule() {
    renderSimpleList("page-users", "get_users", u => `<strong>${u.nama || u.username}</strong> - Email: ${u.email || "-"}`);
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
    const e=selectedContractEmployeeWeb,n=document.getElementById("contractModalPkwtNo")?.value.trim()||"";if(!e)return;
    if(!n||n==="Generasi nomor..."||n==="Nomor belum tersedia"){showToast("Nomor PKWT belum tersedia.");return;}
    showToast("Memproses Cetak Dokumen PKWT...");
    try{
        const r=await callGoogleScript({action:"save_contract",employee_id:e.id||"",employee_name:webEmployeeName(e),pkwt_number:n,start_date:e.start_date||"",end_date:e.end_date||""});
        closeContractModal();
        if(r.pdf_url){window.open(r.pdf_url,"_blank","noopener");showToast("Dokumen PKWT berhasil dibuat.");}
        else showToast(r.message||"Gagal mendapatkan link PDF.");
    }catch(x){showToast("Error: "+x.message);}
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
    const box=document.getElementById("employeeModuleList");if(!box)return;setCountWeb("employeeCount",employeeModuleDataWeb.length,"karyawan");
    if(!employeeModuleDataWeb.length){box.innerHTML='<div class="empty-module"><h2>Belum ada karyawan</h2></div>';return;}
    box.innerHTML=employeeModuleDataWeb.map(e=>{
        const n=webEmployeeName(e),nik=e.nik||e.NIK||"-",pos=e.position||e.jabatan||"Karyawan",st=e.status||"ACTIVE";
        return `<div class="employee-module-card"><div class="employee-avatar">${escapeHtml(getInitials(n))}</div><div class="employee-card-info"><strong>${escapeHtml(n)}</strong><span>${escapeHtml(webCompanyName(e))}</span><small>NIK: ${escapeHtml(String(nik))} • ${escapeHtml(String(pos))}</small></div><span class="status-chip ${String(st).toUpperCase()==="ACTIVE"?"status-active":"status-neutral"}">${escapeHtml(String(st))}</span></div>`;
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
