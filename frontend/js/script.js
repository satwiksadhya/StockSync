// script.js
window.onbeforeunload = function () {
    console.log("🚨 PAGE RELOADING");
};

/* ==========================================
   GLOBAL VARIABLES
   ========================================== */
let chartInstance = null;
let lastAnalysisResult = null;
let aiGeneratedText = null;

/* ==========================================
   VIEW TOGGLING & NAVIGATION
   ========================================== */
function showSignup() {
    const landing = document.getElementById('landing-wrapper');
    const signup = document.getElementById('signup-view');

    landing.style.opacity = '0';
    landing.style.transition = '0.4s';

    setTimeout(() => {
        landing.style.display = 'none';
        signup.style.display = 'flex';
        signup.style.opacity = '0';

        setTimeout(() => {
            signup.style.opacity = '1';
            signup.style.transition = '0.6s ease-in-out';
            window.scrollTo(0, 0);
        }, 50);
    }, 400);
}

function switchToDashboard() {
    document.getElementById('landing-wrapper').style.display = 'none';
    document.getElementById('signup-view').style.display = 'none';
    document.getElementById('dashboard-view').style.display = 'block';

    const firstTab = document.getElementById('features-content');
    if (firstTab) firstTab.style.display = 'block';

    window.scrollTo(0, 0);
}

function switchToHome() {
    document.getElementById('dashboard-view').style.display = 'none';
    document.getElementById('signup-view').style.display = 'none';
    const landing = document.getElementById('landing-wrapper');
    landing.style.display = 'block';
    landing.style.opacity = '1';
    window.scrollTo(0, 0);
}

function navToSection(sectionId) {
    if (document.getElementById('landing-wrapper').style.display === 'none') {
        switchToHome();
    }

    setTimeout(() => {
        const element = document.getElementById(sectionId);
        if (element) {
            const offset = 100;
            const bodyRect = document.body.getBoundingClientRect().top;
            const elementRect = element.getBoundingClientRect().top;
            const elementPosition = elementRect - bodyRect;
            const offsetPosition = elementPosition - offset;

            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
        }
    }, 100);
}

/* ==========================================
   SCROLL REVEAL ANIMATION
   ========================================== */
const revealOnScroll = () => {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.reveal').forEach(row => {
        observer.observe(row);
    });
};

/* ==========================================
   INITIALIZATION
   ========================================== */
document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Scroll Animations
    revealOnScroll();

    // 2. Dark Mode Toggle Logic (Persistent)
    const darkModeToggle = document.getElementById('darkModeToggle');
    if (darkModeToggle) {
        if (localStorage.getItem('theme') === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
            darkModeToggle.checked = true;
        }

        darkModeToggle.addEventListener('change', () => {
            if (darkModeToggle.checked) {
                document.documentElement.setAttribute('data-theme', 'dark');
                localStorage.setItem('theme', 'dark');
            } else {
                document.documentElement.removeAttribute('data-theme');
                localStorage.setItem('theme', 'light');
            }

            if (chartInstance) {
                const lastData = chartInstance.data.datasets[0].data;
                const lastLabels = chartInstance.data.labels;
                updateDemandChart(null, true, { labels: lastLabels, values: lastData });
            }
        });
    }

    // 3. Single ML Analysis Trigger
    const analyzeBtn = document.getElementById("analyzeBtn");
    if (analyzeBtn) {
        analyzeBtn.addEventListener("click", runMLAnalysis);
    }

    // 4. Tab Setup
    const aiImages = {
        plan: "images/plan.jpeg",
        track: "images/track2.jpeg",
        collaborate: "images/collaborate.jpeg",
        report: "images/report.jpeg"
    };
    setupTabs(".feature-tab-gusto", ".tab-content-gusto", "featureImageDisplay", aiImages);
    setupTabs(".feature-tab", ".tab-content");
});

/* ==========================================
   SIGNUP & FORM LOGIC
   ========================================== */
function handleSignup(event) {
    event.preventDefault();
    const companyInput = event.target.querySelector('input[placeholder="Company Name"]');
    const company = companyInput ? companyInput.value : "Your";
    const submitBtn = event.target.querySelector('button');

    submitBtn.innerText = "Creating Account...";
    submitBtn.disabled = true;

    setTimeout(() => {
        switchToDashboard();
        const dashboardTitle = document.querySelector('#dashboard-view h1');
        if (dashboardTitle) {
            dashboardTitle.innerText = `${company} Inventory Dashboard`;
        }
        submitBtn.innerText = "Create Account";
        submitBtn.disabled = false;
    }, 1000);
}

/* ==========================================
   TAB LOGIC
   ========================================== */
function setupTabs(buttonClass, contentClass, imageId = null, imageMap = null) {
    const tabs = document.querySelectorAll(buttonClass);
    tabs.forEach(tab => {
        tab.addEventListener("click", (e) => {
            e.preventDefault();
            const targetId = tab.getAttribute("data-tab");
            tabs.forEach(t => t.classList.remove("active"));
            tab.classList.add("active");

            document.querySelectorAll(contentClass).forEach(content => {
                content.style.display = (content.id === targetId) ? "block" : "none";
            });

            if (imageId && imageMap && imageMap[targetId]) {
                const imgDisplay = document.getElementById(imageId);
                imgDisplay.style.opacity = 0;
                imgDisplay.style.transform = "scale(0.98)";

                setTimeout(() => {
                    imgDisplay.src = imageMap[targetId];
                    imgDisplay.style.opacity = 1;
                    imgDisplay.style.transform = "scale(1)";
                }, 200);
            }
        });
    });
}

/* ==========================================
   ML ANALYSIS & DASHBOARD UPDATE
   ========================================== */

let globalStoredData = null;

async function runMLAnalysis(e) {
    if (e) e.preventDefault();

    const fileInput = document.getElementById('csvFile');
    const analyzeBtn = document.getElementById('analyzeBtn');

    if (!fileInput.files[0]) {
        alert("Upload a CSV first!");
        return;
    }

    analyzeBtn.innerText = "Processing...";
    analyzeBtn.disabled = true;

    const formData = new FormData();
    formData.append("file", fileInput.files[0]);

    try {
        const BASE_URL = window.location.origin;
        const response = await fetch(`${BASE_URL}/upload`, {
            method: "POST",
            body: formData
        });

        const data = await response.json();
        console.log("Revenue Data:", data.revenue_data);
        console.log("BACKEND RESPONSE:", data);
        globalStoredData = data;

        // KPI updates
        document.getElementById('rev-value').innerText =
            `Rs. ${data.total_revenue.toLocaleString('en-IN')}`;

        document.getElementById('reorder-count').innerText =
            data.reorder_count || 0;

        document.getElementById('expiry-count').innerText =
            data.expiry_count || 0;

        // Switch UI
        document.getElementById('upload-stage').classList.add('d-none');
        document.getElementById('nav-hub-stage').classList.remove('d-none');

        globalStoredData = data
        populateExpiryTable(data.expiry_data);
        switchView('sales');
        renderInventoryTable(data.inventory_data);

        if (data.revenue_data) {
            renderRevenueChart(data.revenue_data);
        }

    } catch (err) {
        alert("Backend error: " + err.message);
    } finally {
        analyzeBtn.innerText = "Analyze Data";
        analyzeBtn.disabled = false;
    }
}

function switchView(type, element) {
    if (!globalStoredData) return;

    const titleElement = document.getElementById('main-title');

    // 1. Handle Navigation UI
    document.querySelectorAll('.kpi-nav-card')
        .forEach(c => c.classList.remove('active'));
    if (element) element.classList.add('active');

    // 2. Handle Content Visibility
    document.querySelectorAll('.tab-content')
        .forEach(c => c.classList.add('d-none'));

    const targetContent = document.getElementById(`${type}-content`);
    if (targetContent) targetContent.classList.remove('d-none');

    // 3. RENDER DATA BASED ON TAB
    if (type === 'sales') {
        if (titleElement) titleElement.innerText = "Product Demand Forecast";
        updateDemandChart(globalStoredData.demand_data);
    }
    else if (type === 'revenue') {
        if (titleElement) titleElement.innerText = "Revenue Forecast";
        renderRevenueChart(globalStoredData.revenue_data);
    }
    else if (type === 'expiry') {
        if (titleElement) titleElement.innerText = "Expiry Risk Analysis";
        populateExpiryTable(globalStoredData.expiry_data);
    }
    else if (type === 'inventory') {
        if (titleElement) titleElement.innerText = "Inventory Stock Levels";
        // CRITICAL: Ensure we pass the correct data object
        renderInventoryTable(globalStoredData.inventory_data);
    }
}
function populateExpiryTable(expiryData) {
    const body = document.getElementById('expiry-table-body');
    if (!body) return;

    body.innerHTML = Object.entries(expiryData || {}).map(([name, d]) => `
        <tr>
            <td>${name}</td>
            <td>${d.units || 0}</td>
            <td class="${d.Status === 'High Risk' ? 'text-danger' : 'text-warning'}">
                ${d.Status || 'Safe'}
            </td>
        </tr>
    `).join('');
}
function renderInventoryTable(invData) {
    // 1. Target BOTH table bodies
    const summaryBody = document.getElementById('inventory-summary-body');
    const fullAnalysisBody = document.getElementById('inventory-table-body');

    if (!invData) return;
    const rowsHtml = Object.entries(invData).map(([name, d]) => {
        const currentStock = d['Current Stock'] || 0;
        const reorderPoint = d['Reorder Point'] || 0;
        const isLow = currentStock <= reorderPoint;

        return `
            <tr>
                <td class="fw-bold">${name}</td>
                <td class="${isLow ? 'text-danger fw-bold' : ''}">${currentStock}</td>
                <td>${reorderPoint}</td>
                <td>
                    <span class="badge ${isLow ? 'bg-danger' : 'bg-success'}">
                        ${isLow ? 'Low Stock' : 'Optimal'}
                    </span>
                </td>
            </tr>`;
    }).join('');

    // 3. Update both sections at once!
    if (summaryBody) summaryBody.innerHTML = rowsHtml;
    if (fullAnalysisBody) fullAnalysisBody.innerHTML = rowsHtml;
}
/* ==========================================
   THEME-AWARE CHARTING
   ========================================== */


function updateDemandChart(demandData, isRefresh = false, cached = null) {
    const canvas = document.getElementById('demandChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (chartInstance !== null) {
        chartInstance.destroy();
    }

    const themeColor = getComputedStyle(document.documentElement).getPropertyValue('--gusto-green').trim() || '#28a745';
    const textColor = getComputedStyle(document.body).color || '#666';

    let labels, values;
    if (isRefresh && cached) {
        labels = cached.labels;
        values = cached.values;
    } else {
        labels = Object.keys(demandData);
        values = labels.map(key => {
            const entry = demandData[key];
            return typeof entry === 'object' ? (entry['Predicted Daily Demand'] || 0) : entry;
        });
    }

    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Predicted Demand by Product',
                data: values,
                backgroundColor: `${themeColor}33`,
                borderColor: themeColor,
                borderWidth: 2,
                borderRadius: 20, 
                borderSkipped: false,
                maxBarThickness: 35,

                hoverBackgroundColor: themeColor,
                hoverBorderWidth: 0,
                hoverBorderRadius: 20,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: { top: 20 } 
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1a1a1a',
                    padding: 15,
                    cornerRadius: 12,
                    displayColors: false,
                    titleSpacing: 5
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    border: { display: false },
                    grid: { color: 'rgba(0,0,0,0.03)' }, 
                    ticks: { color: textColor }
                },
                x: {
                    border: { display: false },
                    grid: { display: false },
                    ticks: { color: textColor, font: { weight: '600' } }
                }
            }
        }
    });
}


function updateDashboard(data) {
    const demand = data["Demand Forecast"];
    const inventory = data["Inventory Analysis"];
    const revenue = data["Revenue Forecast"];
    const expiry = data["Expiry Risk"];

    // ---------------- Revenue ----------------
    let totalRevenue = 0;
    for (let item in revenue) {
        totalRevenue += revenue[item]["Predicted Revenue"] || 0;
    }
    (document.getElementById("revenue").innerText =
        "₹ " + (data.total_revenue || 0).toLocaleString());

    // ---------------- Expiry Alerts ----------------
    let expiryHTML = "";
    for (let item in expiry) {
        if (expiry[item]["Status"] === "Expiry Risk" || expiry[item]["Status"] === "High Risk") {
            expiryHTML += `<div class="p-2 mb-2 border-start border-danger border-4 bg-dark-subtle text-danger-emphasis"><strong>${item}</strong>: Expiry Risk</div>`;
        }
    }
    document.getElementById("expiry-list").innerHTML = expiryHTML || '<div class="text-success">Stock is healthy.</div>';

    // ---------------- Inventory Table ----------------
    let tableHTML = ""; 
    for (let item in inventory) {
        const row = inventory[item]; 
        tableHTML += `
            <tr>
                <td>${item}</td>
                <td>${row["Current Stock"] || 0}</td>
                <td>${row["Suggested Restock"] !== undefined ? row["Suggested Restock"] : "Safe"}</td>
                <td><span class="badge ${(row["Status"] === "Reorder Needed" || row["Status"] === "LOW_STOCK")? 'bg-danger': 'bg-success'}">${(row["Status"] === "Reorder Needed" || row["Status"] === "LOW_STOCK")? "Low Stock": "Optimal"}</span></td>
            </tr>
        `;
    }
    document.getElementById("inventory-table-body").innerHTML = tableHTML;

    // ---------------- Update Chart ----------------
    if (demand) {
        updateDemandChart(demand);
    }
}
// async function askAI() {
//     const question = document.getElementById('question').value;
//     const apiKey = document.getElementById('apiKey').value;
//     const model = document.getElementById('model_name').value;
//     const provider = document.getElementById('provider').value;
//     const aiBtn = document.getElementById('aiBtn');
//     const responseWrapper = document.getElementById('ai-response-wrapper');
//     const responseDiv = document.getElementById('ai-response');

//     if (!question || !apiKey) {
//         alert("Please enter both a question and your API Key.");
//         return;
//     }

    
//     const context = `
//         Current Inventory Stats:
//         - Total Predicted Revenue: ${document.getElementById('rev-value').innerText}
//         - Products Needing Reorder: ${document.getElementById('reorder-count').innerText}
//         - Units at Expiry Risk: ${document.getElementById('expiry-count').innerText}
//         - User Question: ${question}
//     `;

//     aiBtn.innerText = "Consulting AI...";
//     aiBtn.disabled = true;
//     responseWrapper.classList.remove('d-none');
//     responseDiv.innerText = "Analyzing your inventory trends...";

//     try {
//         // This assumes you have a proxy route in Flask to handle the API call
//         // OR you are calling Groq/OpenAI directly from JS (Careful with API keys in frontend!)
//         const response = await fetch('http://127.0.0.1:5000/ask_ai', {
//             method: 'POST',
//             headers: { 'Content-Type': 'application/json' },
//             body: JSON.stringify({
//                 question: question,
//                 context: context,
//                 api_key: apiKey,
//                 model: model,
//                 provider: provider
//             })
//         });

//         const result = await response.json();

//         if (result.answer) {
//             responseDiv.innerHTML = result.answer.replace(/\n/g, '<br>');
//             aiGeneratedText = result.answer;
//         } else {
//             throw new Error(result.error || "Failed to get AI response");
//         }

//     } catch (error) {
//         responseDiv.innerHTML = `<span class="text-warning">Error: ${error.message}</span>`;
//     } finally {
//         aiBtn.innerText = "Generate AI Insights";
//         aiBtn.disabled = false;
//     }
// }

// // Utility to toggle API key visibility
// function togglePass() {
//     const passInput = document.getElementById('apiKey');
//     passInput.type = passInput.type === 'password' ? 'text' : 'password';
// }
// function resetToUpload() {
//     document.getElementById('nav-hub-stage').classList.add('d-none');
//     document.getElementById('upload-stage').classList.remove('d-none');
//     document.getElementById('csvFile').value = '';
// }


let revenueChartInstance = null; 

function renderRevenueChart(revenueData) {
    const canvas = document.getElementById('revenueChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (revenueChartInstance) {
        revenueChartInstance.destroy();
    }

    const labels = Object.keys(revenueData);

    // Safely extract the numeric value from the object
    const values = labels.map(key => {
        const entry = revenueData[key];
        return typeof entry === 'object' ? (entry['Predicted Revenue'] || 0) : entry;
    });

    revenueChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Revenue (Rs.)',
                data: values,
                backgroundColor: 'rgba(25, 135, 84, 0.6)',
                borderColor: '#198754',
                borderWidth: 2,
                borderRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: (value) => '₹' + value.toLocaleString('en-IN')
                    }
                }
            }
        }
    });
}

async function askAI() {
    const question = document.getElementById('question').value;
    const apiKey = document.getElementById('apiKey').value;
    const model = document.getElementById('model_name').value;
    const provider = document.getElementById('provider').value;
    const aiBtn = document.getElementById('aiBtn');
    const responseWrapper = document.getElementById('ai-response-wrapper');
    const responseDiv = document.getElementById('ai-response');

    if (!question || !apiKey) {
        alert("Please enter both a question and your API Key.");
        return;
    }

    const context = `
        Current Inventory Stats:
        - Total Predicted Revenue: ${document.getElementById('rev-value').innerText}
        - Products Needing Reorder: ${document.getElementById('reorder-count').innerText}
        - Units at Expiry Risk: ${document.getElementById('expiry-count').innerText}
        - User Question: ${question}
    `;

    aiBtn.innerText = "Consulting AI...";
    aiBtn.disabled = true;

    // ✅ FIX: null safety added
    if (responseWrapper) {
        responseWrapper.classList.remove('d-none');
    }
    if (responseDiv) {
        responseDiv.innerText = "Analyzing your inventory trends...";
    }

    try {
        const response = await fetch('http://127.0.0.1:5000/ask_ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                question: question,
                context: context,
                api_key: apiKey,
                model_name: model,
                provider: provider
            })
        });

        // const result = await response.json();
        const result = await response.json();
        console.log("AI RESULT:", result);

        // ✅ FIX: null safety added
        // if (result.answer && responseDiv) {
        //     responseDiv.innerHTML = result.answer.replace(/\n/g, '<br>');
        //     aiGeneratedText = result.answer;
        // } 
        console.log("AI RESULT:", result);

const output =
    result.answer?.trim() ||
    result.error ||
    "⚠️ No response from AI";

const responseDiv = document.getElementById('ai-response');

if (responseDiv) {
    responseDiv.style.display = "block";   // 🔥 ensure visible
    responseDiv.innerHTML = output.replace(/\n/g, '<br>');
} else {
    console.error("❌ ai-response div NOT FOUND in HTML");
}
        // else {
        //     throw new Error(result.error || "Failed to get AI response");
        // }

    } catch (error) {
        // ✅ FIX: null safety added
        if (responseDiv) {
            responseDiv.innerHTML = `<span class="text-warning">Error: ${error.message}</span>`;
        }
    } finally {
        aiBtn.innerText = "Generate AI Insights";
        aiBtn.disabled = false;
    }
}

async function downloadReport() {

    if (!globalStoredData) {
        alert("Run analysis first!");
        return;
    }

    try {
        const response = await fetch("http://127.0.0.1:5000/download_report", {
        
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                ...globalStoredData,
                ai_insights: aiGeneratedText
            })
        });

        // ❗ CHECK RESPONSE FIRST (IMPORTANT)
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || "Server error");
        }

        const blob = await response.blob();

        // ❗ VALIDATE FILE
        if (blob.size === 0) {
            throw new Error("Empty PDF received");
        }

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");

        a.href = url;
        a.download = "Business_Report.pdf";

        document.body.appendChild(a);
        a.click();
        a.remove();

        window.URL.revokeObjectURL(url); // cleanup

    } catch (err) {
        console.error("Download error:", err);
        alert("Download failed: " + err.message);
    }
}