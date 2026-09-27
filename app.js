<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Human Resource System</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>

<!-- LOGIN MODAL -->
<div id="loginModal" class="login-modal">
    <div class="login-card">
        <div class="brand-icon" style="margin: 0 auto 15px auto;">HR</div>
        <h2>HRIS Web System</h2>
        <p>Silakan masuk dengan akun HRIS Anda</p>
        <form onsubmit="handleLogin(event)" style="margin-top: 20px;">
            <div class="form-group">
                <label>USERNAME</label>
                <input type="text" id="loginUsername" placeholder="Masukkan username" required>
            </div>
            <div class="form-group" style="margin-top: 12px;">
                <label>PASSWORD</label>
                <input type="password" id="loginPassword" placeholder="Masukkan password" required>
            </div>
            <div id="loginError" class="login-error" style="display:none;"></div>
            <button type="submit" class="primary-button" style="margin-top: 20px;">MASUK SISTEM</button>
        </form>
    </div>
</div>

<!-- MAIN APP CONTAINER -->
<div class="app" id="appContainer" style="display: none;">
    <!-- SIDEBAR -->
    <aside class="sidebar" id="sidebar">
        <div class="sidebar-brand">
            <div class="brand-icon">HR</div>
            <div class="brand-text">
                <strong>HRIS</strong>
                <span>Human Resource</span>
            </div>
        </div>
        <div class="sidebar-section">
            <div class="sidebar-title">MENU UTAMA</div>
            <button class="nav-item active" data-page="dashboard" onclick="showPage('dashboard')">
                <span class="nav-icon">⌂</span><span>Dashboard</span>
            </button>
            <button class="nav-item" data-page="contract" onclick="showPage('contract')">
                <span class="nav-icon">▣</span><span>Kontrak Kerja</span>
            </button>
            <button class="nav-item" data-page="employees" onclick="showPage('employees')">
                <span class="nav-icon">♙</span><span>Data Karyawan</span>
            </button>
            <button class="nav-item" data-page="companies" onclick="showPage('companies')">
                <span class="nav-icon">▤</span><span>Perusahaan</span>
            </button>
            <button class="nav-item" data-page="payroll" onclick="showPage('payroll')">
                <span class="nav-icon">Rp</span><span>Payroll</span>
            </button>
            <button class="nav-item" data-page="attendance" onclick="showPage('attendance')">
                <span class="nav-icon">✓</span><span>Absensi</span>
            </button>
            <button class="nav-item" data-page="leave" onclick="showPage('leave')">
                <span class="nav-icon">◷</span><span>Cuti & Izin</span>
            </button>
            <button class="nav-item" data-page="recruitment" onclick="showPage('recruitment')">
                <span class="nav-icon">♧</span><span>Rekrutmen</span>
            </button>
            <button class="nav-item" data-page="users" onclick="showPage('users')">
                <span class="nav-icon">♙</span><span>Pengguna</span>
            </button>
            <button class="nav-item" data-page="settings" onclick="showPage('settings')">
                <span class="nav-icon">⚙</span><span>Pengaturan</span>
            </button>
        </div>
        <div class="sidebar-bottom">
            <button class="logout-button" onclick="logout()">
                <span>⇥</span> Keluar
            </button>
        </div>
    </aside>

    <!-- MAIN CONTENT -->
    <main class="main">
        <header class="topbar">
            <button class="mobile-menu" onclick="toggleSidebar()">☰</button>
            <div class="page-heading">
                <span id="pageSmallTitle">HUMAN RESOURCE SYSTEM</span>
                <h1 id="pageTitle">Dashboard</h1>
            </div>
            <div class="topbar-right">
                <div class="user-profile">
                    <div class="user-avatar" id="userAvatar">SA</div>
                    <div class="user-info">
                        <strong id="userName">Administrator</strong>
                        <span id="userRole">Administrator</span>
                    </div>
                </div>
            </div>
        </header>

        <section class="content">
            <!-- DASHBOARD -->
            <div class="page active-page" id="page-dashboard">
                <div class="welcome-card">
                    <div>
                        <span class="welcome-small">SELAMAT DATANG,</span>
                        <h2>Human Resource System</h2>
                        <p>Kelola data karyawan, absensi, payroll, cuti dan kebutuhan HR perusahaan dalam satu sistem.</p>
                    </div>
                    <div class="welcome-decoration">HRIS</div>
                </div>
                <div class="dashboard-grid">
                    <div class="stat-card">
                        <div class="stat-icon">♙</div>
                        <div><span>TOTAL KARYAWAN</span><strong id="totalEmployees">0</strong></div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon olive-bg">✓</div>
                        <div><span>HADIR HARI INI</span><strong id="totalPresent">0</strong></div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon gray-bg">◷</div>
                        <div><span>PENGAJUAN CUTI</span><strong id="totalLeave">0</strong></div>
                    </div>
                </div>
            </div>

            <!-- PAYROLL -->
            <div class="page" id="page-payroll">
                <div class="page-intro">
                    <span class="section-label">PAYROLL</span>
                    <h2>Payroll Karyawan</h2>
                </div>
                <div class="filter-card">
                    <div class="form-group">
                        <label>COMPANY</label>
                        <select id="payrollCompany" onchange="loadPayrollEmployees()">
                            <option value="">Pilih Company</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>PERIODE PAYROLL</label>
                        <select id="payrollPeriod">
                            <option value="2026-01">Januari 2026</option>
                            <option value="2026-02">Februari 2026</option>
                            <option value="2026-03">Maret 2026</option>
                            <option value="2026-04">April 2026</option>
                            <option value="2026-05">Mei 2026</option>
                            <option value="2026-06">Juni 2026</option>
                            <option value="2026-07">Juli 2026</option>
                            <option value="2026-08">Agustus 2026</option>
                            <option value="2026-09" selected>September 2026</option>
                            <option value="2026-10">Oktober 2026</option>
                            <option value="2026-11">November 2026</option>
                            <option value="2026-12">Desember 2026</option>
                        </select>
                    </div>
                </div>

                <div class="employee-section">
                    <div class="section-header">
                        <h2>Pilih Karyawan</h2>
                    </div>
                    <div class="employee-list" id="employeeList"></div>
                </div>

                <!-- PAYROLL DETAIL -->
                <div class="payroll-detail" id="payrollDetail">
                    <button class="back-button" onclick="backToEmployeeList()">← KEMBALI</button>
                    <div class="employee-heading">
                        <div>
                            <span>PAYROLL KARYAWAN</span>
                            <h2 id="selectedEmployeeName">Nama Karyawan</h2>
                            <p id="attendanceSummary">Kehadiran</p>
                        </div>
                    </div>

                    <!-- PENGHASILAN -->
                    <div class="payroll-card">
                        <div class="payroll-card-title income-title">PENGHASILAN</div>
                        <div class="form-grid">
                            <div class="form-group"><label>Gaji Pokok</label><input id="basicSalary" type="number" oninput="calculatePayroll()"></div>
                            <div class="form-group"><label>Tunjangan Tetap</label><input id="fixedAllowance" type="number" oninput="calculatePayroll()"></div>
                            <div class="form-group"><label>Tunjangan Jabatan</label><input id="posAllowance" type="number" oninput="calculatePayroll()"></div>
                            <div class="form-group"><label>Tunjangan Perumahan</label><input id="housingAllowance" type="number" oninput="calculatePayroll()"></div>
                            <div class="form-group"><label>Tunjangan Keluarga</label><input id="familyAllowance" type="number" oninput="calculatePayroll()"></div>
                            <div class="form-group"><label>Transport / Hari</label><input id="transportPerDay" type="number" oninput="calculatePayroll()"></div>
                            <div class="form-group"><label>Makan / Hari</label><input id="mealPerDay" type="number" oninput="calculatePayroll()"></div>
                            <div class="form-group"><label>Tunjangan Kehadiran</label><input id="attendanceAllowance" type="number" oninput="calculatePayroll()"></div>
                            <div class="form-group"><label>Upah Lembur</label><input id="overtime" type="number" oninput="calculatePayroll()"></div>
                            <div class="form-group"><label>Bonus / Insentif</label><input id="bonus" type="number" oninput="calculatePayroll()"></div>
                            <div class="form-group"><label>THR</label><input id="thr" type="number" oninput="calculatePayroll()"></div>
                        </div>
                    </div>

                    <!-- POTONGAN -->
                    <div class="payroll-card">
                        <div class="payroll-card-title deduction-title">POTONGAN</div>
                        <div class="form-grid">
                            <div class="form-group"><label>BPJS Kesehatan</label><input id="bpjsHealth" type="number" oninput="calculatePayroll()"></div>
                            <div class="form-group"><label>BPJS Ketenagakerjaan</label><input id="bpjsTk" type="number" oninput="calculatePayroll()"></div>
                            <div class="form-group"><label>PPh 21</label><input id="pph21" type="number" oninput="calculatePayroll()"></div>
                            <div class="form-group"><label>Potongan Keterlambatan</label><input id="lateDeduction" type="number" oninput="calculatePayroll()"></div>
                            <div class="form-group"><label>Potongan Alpha</label><input id="alphaDeduction" type="number" oninput="calculatePayroll()"></div>
                            <div class="form-group"><label>Kasbon / Pinjaman</label><input id="loanDeduction" type="number" oninput="calculatePayroll()"></div>
                            <div class="form-group"><label>Koperasi / Tabungan</label><input id="cooperativeDeduction" type="number" oninput="calculatePayroll()"></div>
                            <div class="form-group"><label>Potongan Lainnya</label><input id="otherDeduction" type="number" oninput="calculatePayroll()"></div>
                        </div>
                    </div>

                    <!-- RINGKASAN -->
                    <div class="summary-card">
                        <div class="payroll-card-title">RINGKASAN</div>
                        <div class="summary-row"><span>Gross Salary</span><strong id="grossSalary">Rp0</strong></div>
                        <div class="summary-row"><span>Total Potongan</span><strong id="totalDeduction">Rp0</strong></div>
                        <div class="summary-row"><span>PPh 21</span><strong id="summaryPph21">Rp0</strong></div>
                        <div class="net-salary">
                            <span>NET SALARY</span><strong id="netSalary">Rp0</strong>
                        </div>
                        <button class="primary-button" onclick="savePayroll()">HITUNG & SIMPAN PAYROLL</button>
                    </div>
                </div>
            </div>

            <!-- PKWT / KONTRAK KERJA -->
            <div class="page" id="page-contract">
                <div class="page-intro">
                    <span class="section-label">KONTRAK KERJA</span>
                    <h2>Data PKWT Karyawan</h2>
                    <p>Pilih perusahaan, kemudian klik nama karyawan untuk melihat periode dan nomor PKWT.</p>
                </div>
                <div class="filter-card single-filter-card">
                    <div class="form-group">
                        <label>PERUSAHAAN</label>
                        <select id="contractCompany"><option value="ALL">-- SEMUA PERUSAHAAN --</option></select>
                    </div>
                </div>
                <div class="module-card">
                    <div class="module-card-header"><div><span class="section-label">DAFTAR KARYAWAN</span><h3>Karyawan & PKWT</h3></div><span class="data-count" id="contractCount">0 karyawan</span></div>
                    <div class="employee-grid" id="contractEmployeeList"><div class="empty-module"><h2>Memuat data...</h2></div></div>
                </div>
                <div class="modal-overlay" id="contractModal">
                    <div class="contract-modal-card">
                        <button class="modal-close" onclick="closeContractModal()">×</button>
                        <span class="section-label">DOKUMEN PKWT</span>
                        <h2 id="contractModalEmployeeName">Nama Karyawan</h2>
                        <div class="contract-period-box" id="contractModalPeriod">-</div>
                        <div class="form-group"><label>NOMOR PKWT</label><input id="contractModalPkwtNo" type="text"></div>
                        <div class="modal-actions"><button class="secondary-button" onclick="closeContractModal()">BATAL</button><button class="primary-button modal-primary" onclick="saveAndPrintContractWeb()">CETAK PKWT</button></div>
                    </div>
                </div>
            </div>

            <!-- DATA KARYAWAN -->
            <div class="page" id="page-employees">
                <div class="page-intro">
                    <span class="section-label">DATA KARYAWAN</span><h2>Data Karyawan</h2>
                    <p>Filter berdasarkan perusahaan seperti alur aplikasi Android.</p>
                </div>
                <div class="filter-card single-filter-card">
                    <div class="form-group"><label>FILTER PERUSAHAAN</label><select id="employeeCompanyFilter"><option value="ALL">-- SEMUA PERUSAHAAN --</option></select></div>
                </div>
                <div class="module-card">
                    <div class="module-card-header"><div><span class="section-label">DAFTAR</span><h3>Karyawan</h3></div><span class="data-count" id="employeeCount">0 karyawan</span></div>
                    <div class="employee-grid" id="employeeModuleList"><div class="empty-module"><h2>Memuat data...</h2></div></div>
                </div>
            </div>

            <div class="page" id="page-companies"></div>
            <div class="page" id="page-attendance"></div>

            <!-- CUTI & IZIN -->
            <div class="page" id="page-leave">
                <div class="page-intro">
                    <span class="section-label">CUTI & IZIN</span><h2>Pengajuan Cuti & Izin</h2>
                    <p>Filter perusahaan/status dan proses persetujuan seperti aplikasi Android.</p>
                </div>
                <div class="leave-stats-grid">
                    <div class="leave-stat-card"><span>TOTAL</span><strong id="leaveTotal">0</strong></div>
                    <div class="leave-stat-card pending"><span>MENUNGGU</span><strong id="leavePending">0</strong></div>
                    <div class="leave-stat-card approved"><span>DISETUJUI</span><strong id="leaveApproved">0</strong></div>
                    <div class="leave-stat-card rejected"><span>DITOLAK</span><strong id="leaveRejected">0</strong></div>
                </div>
                <div class="filter-card leave-filter-card">
                    <div class="form-group"><label>PERUSAHAAN</label><select id="leaveCompanyFilter"><option value="ALL">-- SEMUA PERUSAHAAN --</option></select></div>
                    <div class="form-group"><label>STATUS</label><select id="leaveStatusFilter"><option value="ALL">Semua Status</option><option value="MENUNGGU">MENUNGGU</option><option value="DISETUJUI">DISETUJUI</option><option value="DITOLAK">DITOLAK</option><option value="PENDING">PENDING</option></select></div>
                </div>
                <div class="module-card leave-table-card">
                    <div class="module-card-header"><div><span class="section-label">DAFTAR PENGAJUAN</span><h3>Cuti & Izin Karyawan</h3></div><span class="data-count" id="leaveCount">0 pengajuan</span></div>
                    <div class="table-scroll">
                        <table class="data-table"><thead><tr><th>Nama Karyawan</th><th>Jenis Cuti</th><th>Tanggal Mulai</th><th>Tanggal Selesai</th><th>Durasi</th><th>Alasan</th><th>Status</th><th>Aksi</th></tr></thead>
                        <tbody id="leaveTableBody"><tr><td colspan="8" class="table-empty">Memuat data...</td></tr></tbody></table>
                    </div>
                </div>
            </div>

            <div class="page" id="page-recruitment"></div>
            <div class="page" id="page-users"></div>
            <div class="page" id="page-settings"></div>
        </section>
    </main>
</div>

<div class="toast" id="toast"><span id="toastMessage"></span></div>

<script src="config.js"></script>
<script src="app.js"></script>
</body>
</html>
