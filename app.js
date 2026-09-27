/* =========================================================
   HRIS WEB APPLICATION
========================================================= */


/* =========================================================
   STATE
========================================================= */

let selectedEmployee = null;

let payrollData = {};


/* =========================================================
   PAGE NAVIGATION
========================================================= */

function showPage(page) {

    const pages =
        document.querySelectorAll(".page");

    pages.forEach(function(element) {

        element.classList.remove("active-page");

    });


    const selectedPage =
        document.getElementById(
            "page-" + page
        );


    if (selectedPage) {

        selectedPage.classList.add(
            "active-page"
        );

    }


    const navItems =
        document.querySelectorAll(
            ".nav-item"
        );


    navItems.forEach(function(item) {

        item.classList.remove("active");

    });


    const activeNav =
        document.querySelector(
            `.nav-item[data-page="${page}"]`
        );


    if (activeNav) {

        activeNav.classList.add("active");

    }


    const titleMap = {

        dashboard:
            "Dashboard",

        contract:
            "Kontrak Kerja",

        employees:
            "Data Karyawan",

        companies:
            "Perusahaan",

        payroll:
            "Payroll",

        attendance:
            "Absensi",

        leave:
            "Cuti & Izin",

        recruitment:
            "Rekrutmen",

        users:
            "Pengguna",

        settings:
            "Pengaturan"

    };


    document.getElementById(
        "pageTitle"
    ).textContent =
        titleMap[page] || "Dashboard";


    closeSidebar();

}


/* =========================================================
   SIDEBAR
========================================================= */

function toggleSidebar() {

    const sidebar =
        document.getElementById(
            "sidebar"
        );

    sidebar.classList.toggle("open");

}


function closeSidebar() {

    const sidebar =
        document.getElementById(
            "sidebar"
        );

    sidebar.classList.remove("open");

}


/* =========================================================
   TOAST
========================================================= */

function showToast(message) {

    const toast =
        document.getElementById(
            "toast"
        );

    const messageElement =
        document.getElementById(
            "toastMessage"
        );


    messageElement.textContent =
        message;


    toast.classList.add("show");


    setTimeout(function() {

        toast.classList.remove(
            "show"
        );

    }, 3000);

}


/* =========================================================
   GOOGLE APPS SCRIPT REQUEST
========================================================= */

/*
    BAGIAN INI TIDAK MENGUBAH GOOGLE APPS SCRIPT.

    Web hanya mengirim request ke URL GS.

    Format action/parameter nanti disesuaikan
    dengan doGet/doPost GS Anda.
*/

async function callGoogleScript(
    payload = {}
) {

    const url =
        HRIS_CONFIG.GOOGLE_SCRIPT_URL;


    if (
        !url ||
        url.includes(
            "PASTE_URL"
        )
    ) {

        throw new Error(
            "URL Google Apps Script belum diisi di config.js"
        );

    }


    const response =
        await fetch(
            url,
            {

                method: "POST",

                headers: {

                    "Content-Type":
                        "text/plain;charset=utf-8"

                },

                body:
                    JSON.stringify(
                        payload
                    )

            }
        );


    if (!response.ok) {

        throw new Error(
            "Request ke Google Apps Script gagal."
        );

    }


    const text =
        await response.text();


    try {

        return JSON.parse(text);

    } catch (error) {

        return text;

    }

}


/* =========================================================
   LOAD INITIAL DATA
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    function() {

        initializeApplication();

    }
);


function initializeApplication() {

    loadDemoEmployees();

}


/* =========================================================
   COMPANY
========================================================= */

function loadCompanies(
    companies = []
) {

    const select =
        document.getElementById(
            "payrollCompany"
        );


    select.innerHTML =
        '<option value="">Pilih Company</option>';


    companies.forEach(function(company) {

        const option =
            document.createElement(
                "option"
            );

        option.value =
            company.id ||
            company.value ||
            company.name;

        option.textContent =
            company.name ||
            company.label ||
            company.value;

        select.appendChild(option);

    });

}


/* =========================================================
   DEMO EMPLOYEE LIST
========================================================= */

/*
   Ini hanya tampilan sementara.

   Setelah struktur response GS diketahui,
   bagian ini dapat dihubungkan langsung
   dengan data asli GS TANPA mengubah GS.
*/

function loadDemoEmployees() {

    const employees = [

        {
            id: "EMP001",
            name: "Karyawan Contoh 1",
            position: "Staff",
            company: "Company A"
        },

        {
            id: "EMP002",
            name: "Karyawan Contoh 2",
            position: "Supervisor",
            company: "Company A"
        },

        {
            id: "EMP003",
            name: "Karyawan Contoh 3",
            position: "Manager",
            company: "Company A"
        }

    ];


    renderEmployees(
        employees
    );


    loadCompanies([

        {
            id: "company-a",
            name: "Company A"
        },

        {
            id: "company-b",
            name: "Company B"
        }

    ]);

}


/* =========================================================
   RENDER EMPLOYEES
========================================================= */

function renderEmployees(
    employees
) {

    const container =
        document.getElementById(
            "employeeList"
        );


    if (
        !employees ||
        employees.length === 0
    ) {

        container.innerHTML = `

            <div class="empty-state">

                <div>♙</div>

                <strong>
                    Belum ada karyawan
                </strong>

                <span>
                    Tidak ada data karyawan.
                </span>

            </div>

        `;

        return;

    }


    container.innerHTML = "";


    employees.forEach(function(employee) {

        const item =
            document.createElement(
                "div"
            );


        item.className =
            "employee-item";


        item.onclick =
            function() {

                selectEmployee(
                    employee
                );

            };


        const initials =
            getInitials(
                employee.name
            );


        item.innerHTML = `

            <div class="employee-avatar">
                ${initials}
            </div>

            <div class="employee-info">

                <strong>
                    ${escapeHtml(employee.name)}
                </strong>

                <span>
                    ${escapeHtml(employee.position || "Karyawan")}
                </span>

            </div>

            <span class="menu-arrow">
                →
            </span>

        `;


        container.appendChild(
            item
        );

    });

}


/* =========================================================
   SELECT EMPLOYEE
========================================================= */

function selectEmployee(
    employee
) {

    selectedEmployee =
        employee;


    document.getElementById(
        "selectedEmployeeName"
    ).textContent =
        employee.name;


    document.getElementById(
        "attendanceSummary"
    ).textContent =
        "Kehadiran mengikuti data absensi karyawan";


    document
        .querySelector(
            ".employee-section"
        )
        .style.display =
        "none";


    const detail =
        document.getElementById(
            "payrollDetail"
        );


    detail.classList.add(
        "show"
    );


    window.scrollTo({

        top: 0,

        behavior: "smooth"

    });

}


/* =========================================================
   BACK
========================================================= */

function backToEmployeeList() {

    document
        .querySelector(
            ".employee-section"
        )
        .style.display =
        "block";


    document
        .getElementById(
            "payrollDetail"
        )
        .classList.remove(
            "show"
        );


    selectedEmployee =
        null;

}


/* =========================================================
   PAYROLL CALCULATION
========================================================= */

function numberValue(
    id
) {

    const element =
        document.getElementById(
            id
        );


    if (!element) {

        return 0;

    }


    const value =
        parseFloat(
            element.value
        );


    return isNaN(value)
        ? 0
        : value;

}


function calculatePayroll() {

    const incomeIds = [

        "basicSalary",
        "fixedAllowance",
        "posAllowance",
        "housingAllowance",
        "familyAllowance",
        "transportPerDay",
        "mealPerDay",
        "attendanceAllowance",
        "overtime",
        "bonus",
        "thr"

    ];


    const deductionIds = [

        "bpjsHealth",
        "bpjsTk",
        "pph21",
        "lateDeduction",
        "alphaDeduction",
        "loanDeduction",
        "cooperativeDeduction",
        "otherDeduction"

    ];


    let gross = 0;


    incomeIds.forEach(
        function(id) {

            gross +=
                numberValue(id);

        }
    );


    let deductions = 0;


    deductionIds.forEach(
        function(id) {

            deductions +=
                numberValue(id);

        }
    );


    const pph21 =
        numberValue(
            "pph21"
        );


    const net =
        gross -
        deductions;


    document.getElementById(
        "grossSalary"
    ).textContent =
        formatRupiah(gross);


    document.getElementById(
        "totalDeduction"
    ).textContent =
        formatRupiah(deductions);


    document.getElementById(
        "summaryPph21"
    ).textContent =
        formatRupiah(pph21);


    document.getElementById(
        "netSalary"
    ).textContent =
        formatRupiah(net);


    payrollData = {

        grossSalary:
            gross,

        totalDeduction:
            deductions,

        pph21:
            pph21,

        netSalary:
            net

    };

}


/* =========================================================
   SAVE PAYROLL
========================================================= */

async function savePayroll() {

    if (!selectedEmployee) {

        showToast(
            "Pilih karyawan terlebih dahulu."
        );

        return;

    }


    calculatePayroll();


    const payload = {

        action:
            "savePayroll",

        employeeId:
            selectedEmployee.id,

        employeeName:
            selectedEmployee.name,

        company:
            document.getElementById(
                "payrollCompany"
            ).value,

        period:
            document.getElementById(
                "payrollPeriod"
            ).value,

        payroll:
            payrollData

    };


    /*
       Payload di atas sengaja dipisahkan.

       Nama action/struktur dapat disamakan dengan
       doPost GS Anda setelah kode GS diberikan.
    */


    try {

        showToast(
            "Menyimpan payroll..."
        );


        /*
        =====================================================
        AKTIFKAN INI SETELAH FORMAT API GS SUDAH DISESUAIKAN
        =====================================================

        const result =
            await callGoogleScript(
                payload
            );

        console.log(result);
        */


        setTimeout(
            function() {

                showToast(
                    "Payroll berhasil dihitung."
                );

            },
            500
        );


    } catch (error) {

        console.error(error);


        showToast(
            error.message ||
            "Gagal menyimpan payroll."
        );

    }

}


/* =========================================================
   FORMAT RUPIAH
========================================================= */

function formatRupiah(
    value
) {

    return new Intl.NumberFormat(
        "id-ID",
        {

            style:
                "currency",

            currency:
                "IDR",

            maximumFractionDigits:
                0

        }
    ).format(
        value || 0
    );

}


/* =========================================================
   INITIALS
========================================================= */

function getInitials(
    name
) {

    if (!name) {

        return "HR";

    }


    return name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(
            function(part) {

                return part
                    .charAt(0)
                    .toUpperCase();

            }
        )
        .join("");

}


/* =========================================================
   HTML ESCAPE
========================================================= */

function escapeHtml(
    text
) {

    const div =
        document.createElement(
            "div"
        );


    div.textContent =
        text || "";


    return div.innerHTML;

}


/* =========================================================
   LOGOUT
========================================================= */

function logout() {

    localStorage.removeItem(
        "hris_user"
    );


    showToast(
        "Anda telah keluar dari sistem."
    );

}


/* =========================================================
   GLOBAL ERROR
========================================================= */

window.addEventListener(
    "error",
    function(event) {

        console.error(
            "HRIS Error:",
            event.error
        );

    }
);
