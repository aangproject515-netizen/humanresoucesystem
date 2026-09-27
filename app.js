/* =========================================================
   NAVIGATION & PAGE SWITCHER
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

    // Pastikan setiap modul memanggil loader modul kustomnya sendiri
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
   POPULATE DROPDOWNS PERUSAHAAN (PADA LOAD PERTAMA)
========================================================= */
async function populateAllCompanyDropdowns() {
    try {
        const res = await callGoogleScript({ action: "get_companies" });
        if (res.success && Array.isArray(res.data)) {
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

            // Populate Form Perusahaan Tambah Karyawan
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

/* =========================================================
   MODULE 1: DATA KARYAWAN (TAMPILAN KARTU GRID)
========================================================= */
async function loadEmployeesModule() {
    closeEmpForm();
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

/* =========================================================
   MODULE 2: KONTRAK KERJA / PKWT (TAMPILAN KARTU GRID)
========================================================= */
async function loadContractsModule() {
    closeContractModal();
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
    } catch (e) { 
        container.innerHTML = `<div class="empty-state"><span style="color:red;">Error: ${e.message}</span></div>`; 
    }
}

async function openContractModal(emp) {
    selectedEmployee = emp;
    document.getElementById("modalContractEmpName").textContent = emp.name;
    document.getElementById("modalContractInfo").textContent = `PKWT Ke-${emp.pkwt_ke || '1'} | Periode: ${emp.start_date || '-'} s/d ${emp.end_date || '-'}`;
    document.getElementById("modalPkwtNumber").value = "Generasi nomor...";
    
    document.getElementById("contractListSection").style.display = "none";
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
    } catch (e) { 
        document.getElementById("modalPkwtNumber").value = "PKWT/2026/0001"; 
    }
}

function closeContractModal() {
    document.getElementById("contractListSection").style.display = "block";
    document.getElementById("contractDetailModal").classList.remove("show");
    selectedEmployee = null;
}

/* =========================================================
   MODULE 3: PAYROLL (TAMPILAN KARTU GRID)
========================================================= */
async function loadPayrollModule() {
    backToPayrollList();
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
    } catch (e) { 
        container.innerHTML = `<div class="empty-state"><span style="color:red;">Error: ${e.message}</span></div>`; 
    }
}

function backToPayrollList() {
    document.getElementById("payrollListSection").style.display = "block";
    document.getElementById("payrollDetail").classList.remove("show");
    selectedEmployee = null;
}
