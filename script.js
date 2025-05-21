import { db, auth } from './firebase-config.js';
import {
  collection, addDoc, onSnapshot, deleteDoc, doc, getDocs, query, where, updateDoc
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js'; // Added updateDoc
import {
  signOut, onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js';

// ========== Elements ==========
const logoutBtn = document.getElementById("logoutBtn");
const userEmailEl = document.getElementById("userEmail");
const totalSalesEl = document.getElementById("totalSales");
console.log("totalSalesEl on script load:", totalSalesEl); // DEBUG LOG
const totalInventoryEl = document.getElementById("totalInventory");
const totalCustomersEl = document.getElementById("totalCustomers");
const openTicketsEl = document.getElementById("openTickets");
const navLinks = document.querySelectorAll(".nav-link");

const inventoryForm = document.getElementById("inventoryForm");
const inventoryList = document.getElementById("inventoryList");
const salesForm = document.getElementById("salesForm");
const salesList = document.getElementById("salesList");
const customersForm = document.getElementById("customersForm");
const customersList = document.getElementById("customersList");
const ticketsForm = document.getElementById("ticketsForm");
const ticketsList = document.getElementById("ticketsList");

// Report Generation Elements
const generateReportLink = document.getElementById("generateReportLink");
const downloadReportBtn = document.getElementById("downloadReportBtn");
const reportContentPre = document.getElementById("reportContent");
const reportDateForm = document.getElementById("reportDateForm");
const reportStartDateInput = document.getElementById("reportStartDate");
const reportEndDateInput = document.getElementById("reportEndDate");


let salesChart;
let ticketsStatusChart;
let latestSalesData = {};
let latestTicketStatus = {};

// ========== Auth State ==========
onAuthStateChanged(auth, (user) => {
  if (user) {
    userEmailEl.textContent = user.email;
  } else {
    window.location.href = "login.html";
  }
});

logoutBtn?.addEventListener("click", async () => {
  try {
    await signOut(auth);
  } catch (err) {
    alert("Logout failed: " + err.message);
  }
});

// ========== Navigation ==========
navLinks.forEach(link => {
  link.addEventListener("click", e => {
    e.preventDefault();
    const sectionId = link.dataset.section;
    if (!sectionId) return;

    document.querySelectorAll(".content-section").forEach(sec => sec.classList.remove("active"));
    const section = document.getElementById(sectionId);
    if (section) {
      section.classList.add("active");
    }

    navLinks.forEach(l => l.classList.remove("active"));
    link.classList.add("active");

    const currentSectionTitleEl = document.getElementById("currentSectionTitle");
    if (currentSectionTitleEl) {
      currentSectionTitleEl.textContent = link.textContent.trim();
    }

    // Refresh charts only when dashboard section is active
    if (sectionId === "sectionDashboard") {
      renderSalesChart(latestSalesData);
      renderTicketsStatusChart(latestTicketStatus);
    }
  });
});

// ========== Inventory ==========
inventoryForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = inventoryForm["itemName"].value.trim();
  const quantity = parseInt(inventoryForm["itemQuantity"].value);
  const price = parseFloat(inventoryForm["itemPrice"].value);

  if (!name || isNaN(quantity) || quantity < 0 || isNaN(price) || price < 0) {
    return alert("Invalid input");
  }

  try {
    await addDoc(collection(db, "inventory"), { name, quantity, price });
    inventoryForm.reset();
  } catch (error) {
    alert("Failed to add inventory item: " + error.message);
  }
});

onSnapshot(collection(db, "inventory"), (snapshot) => {
  if (!inventoryList) return;
  inventoryList.innerHTML = "";
  let total = 0;

  snapshot.forEach(docSnap => {
    const item = docSnap.data();
    total += item.quantity || 0;

    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${docSnap.id}</td>
      <td>${item.name}</td>
      <td>${item.quantity}</td>
      <td>KES ${item.price.toFixed(2)}</td>
      <td>KES ${(item.quantity * item.price).toFixed(2)}</td>
      <td><button class="btn btn-sm btn-danger" data-id="${docSnap.id}">Delete</button></td>`;

    inventoryList.appendChild(row);

    row.querySelector("button").addEventListener("click", async () => {
      try {
        await deleteDoc(doc(db, "inventory", docSnap.id));
      } catch (err) {
        alert("Failed to delete inventory item: " + err.message);
      }
    });
  });

  if (totalInventoryEl) totalInventoryEl.textContent = total;
});

// ========== Sales ==========
salesForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const date = salesForm["saleDate"].value;
  const itemSoldName = salesForm["saleItemName"].value.trim();
  const quantitySold = parseInt(salesForm["saleQuantity"].value);
  // Removed totalPrice input from form as it will be calculated

  if (!date || !itemSoldName || isNaN(quantitySold) || quantitySold <= 0) {
    return alert("Invalid input for sale. Please fill date, item name, and quantity correctly.");
  }

  try {
    // 1. Fetch item price from inventory and check stock
    const inventoryQuery = query(collection(db, "inventory"), where("name", "==", itemSoldName));
    const inventorySnapshot = await getDocs(inventoryQuery);

    if (inventorySnapshot.empty) {
      alert(`Item "${itemSoldName}" not found in inventory. Cannot complete sale.`);
      return;
    }

    const inventoryDoc = inventorySnapshot.docs[0];
    const currentInventory = inventoryDoc.data();
    const currentQuantity = currentInventory.quantity || 0;
    const itemPrice = currentInventory.price; // Get the price from inventory

    if (currentQuantity < quantitySold) {
      alert(`Insufficient stock for "${itemSoldName}". Available: ${currentQuantity}, Selling: ${quantitySold}`);
      return;
    }

    // Calculate totalPrice based on item price and quantity sold
    const calculatedTotalPrice = itemPrice * quantitySold;

    // 2. Deduct quantity from inventory
    const newQuantity = currentQuantity - quantitySold;
    await updateDoc(doc(db, "inventory", inventoryDoc.id), { quantity: newQuantity });
    console.log(`Inventory updated for ${itemSoldName}: new quantity ${newQuantity}`);

    // 3. Add the sale record with calculated totalPrice
    await addDoc(collection(db, "sales"), { date, item: itemSoldName, quantity: quantitySold, totalPrice: calculatedTotalPrice });
    salesForm.reset();
  } catch (error) {
    alert("Failed to add sale or update inventory: " + error.message);
    console.error("Sale/Inventory update error:", error);
  }
});

onSnapshot(collection(db, "sales"), (snapshot) => {
  console.log("Sales onSnapshot fired!"); // DEBUG LOG
  if (!salesList) {
      console.error("Error: salesList element not found."); // DEBUG LOG
      return;
  }
  if (!totalSalesEl) { // DEBUG LOG
      console.error("Error: totalSalesEl is null inside onSnapshot for sales!"); // DEBUG LOG
      return; // Stop here if element isn't found
  }

  salesList.innerHTML = "";
  let totalSales = 0; // Initialize as a number
  latestSalesData = {};

  if (snapshot.empty) {
      console.log("No sales documents found in Firestore."); // DEBUG LOG
  }

  snapshot.forEach(docSnap => {
    const sale = docSnap.data();
    console.log("Processing sale document:", docSnap.id, sale); // DEBUG LOG
    console.log("Sale totalPrice:", sale.totalPrice, "Type:", typeof sale.totalPrice); // DEBUG LOG

    // Explicitly parse to float and handle potential NaNs more robustly
    let salePrice = parseFloat(sale.totalPrice);

    if (isNaN(salePrice)) {
        console.warn(`Invalid totalPrice for sale ${docSnap.id}. Value: "${sale.totalPrice}". Defaulting to 0.`);
        salePrice = 0; // Ensure it's a number, even if parsing fails
    }

    totalSales += salePrice; // Now totalSales is guaranteed to be adding a number
    console.log("Cumulative totalSales:", totalSales); // DEBUG LOG

    if (!latestSalesData[sale.date]) latestSalesData[sale.date] = 0;
    latestSalesData[sale.date] += salePrice; // Use salePrice here as well

    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${docSnap.id}</td>
      <td>${sale.item}</td>
      <td>${sale.quantity}</td>
      <td>KES ${salePrice.toFixed(2)}</td>
      <td>${sale.date}</td>
      <td><button class="btn btn-sm btn-danger" data-id="${docSnap.id}">Delete</button></td>`;

    salesList.appendChild(row);

    row.querySelector("button").addEventListener("click", async () => {
      try {
        await deleteDoc(doc(db, "sales", docSnap.id));
      } catch (err) {
        alert("Failed to delete sale: " + err.message);
      }
    });
  });

  console.log("Final calculated totalSales:", totalSales); // DEBUG LOG
  totalSalesEl.textContent = `KES ${totalSales.toFixed(2)}`;
  renderSalesChart(latestSalesData);
});

function renderSalesChart(data) {
  const ctx = document.getElementById("salesChart")?.getContext("2d");
  if (!ctx) return;
  const labels = Object.keys(data).sort();
  const values = labels.map(date => data[date]);

  if (salesChart) {
    salesChart.data.labels = labels;
    salesChart.data.datasets[0].data = values;
    salesChart.update();
  } else {
    salesChart = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: "Sales (KES)",
          data: values,
          backgroundColor: "rgba(0,230,118,0.3)",
          borderColor: "#00e676",
          fill: true,
          tension: 0.3
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { labels: { color: '#e0e0e0' } }
        },
        scales: {
          x: { ticks: { color: '#e0e0e0' }, grid: { color: 'rgba(255,255,255,0.1)' } },
          y: { beginAtZero: true, ticks: { color: '#e0e0e0' }, grid: { color: 'rgba(255,255,255,0.1)' } }
        }
      }
    });
  }
}

// ========== Customers ==========
customersForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = customersForm["customerName"].value.trim();
  const phone = customersForm["customerPhone"].value.trim();
  const email = customersForm["customerEmail"].value.trim();
  const address = customersForm["customerAddress"].value.trim();

  if (!name) return alert("Customer name is required");

  try {
    await addDoc(collection(db, "customers"), { name, phone, email, address });
    customersForm.reset();
  } catch (error) {
    alert("Failed to add customer: " + error.message);
  }
});

onSnapshot(collection(db, "customers"), (snapshot) => {
  if (!customersList) return;
  customersList.innerHTML = "";
  let count = 0;

  snapshot.forEach(docSnap => {
    count++;
    const customer = docSnap.data();
    const li = document.createElement("li");
    li.className = "list-group-item d-flex justify-content-between align-items-center";
    li.innerHTML = `
        <div>
            <strong>${customer.name}</strong><br>
            Phone: ${customer.phone || '-'}<br>
            Email: ${customer.email || '-'}<br>
            Address: ${customer.address || '-'}
        </div>
        <button class="btn btn-sm btn-danger" data-id="${docSnap.id}">Delete</button>
    `;
    customersList.appendChild(li);

    li.querySelector("button").addEventListener("click", async () => {
      try {
        await deleteDoc(doc(db, "customers", docSnap.id));
      } catch (err) {
        alert("Failed to delete customer: " + err.message);
      }
    });
  });

  if (totalCustomersEl) totalCustomersEl.textContent = count;
});

// ========== Tickets ==========
ticketsForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const customerId = ticketsForm["ticketCustomerId"].value.trim();
  const device = ticketsForm["ticketDevice"].value.trim();
  const issue = ticketsForm["ticketIssue"].value.trim();
  const status = ticketsForm["ticketStatus"].value || "Open";
  const dateReceived = ticketsForm["ticketDateReceived"].value;

  if (!customerId || !device || !issue || !status || !dateReceived) {
    return alert("All ticket fields are required");
  }

  try {
    await addDoc(collection(db, "tickets"), { customerId, device, issue, status, dateReceived });
    ticketsForm.reset();
  } catch (error) {
    alert("Failed to add ticket: " + error.message);
  }
});

onSnapshot(collection(db, "tickets"), (snapshot) => {
  if (!ticketsList) return;
  ticketsList.innerHTML = "";
  latestTicketStatus = { "Open": 0, "In Progress": 0, "Completed": 0, "Cancelled": 0 };
  let openTicketsCount = 0;

  snapshot.forEach(docSnap => {
    const ticket = docSnap.data();
    const li = document.createElement("li");
    li.className = "list-group-item d-flex justify-content-between align-items-center";
    li.innerHTML = `
        <div>
            <strong>Device:</strong> ${ticket.device || 'N/A'} <br>
            <strong>Issue:</strong> ${ticket.issue || 'N/A'} <br>
            <strong>Status:</strong> ${ticket.status || 'N/A'} <br>
            <strong>Date Received:</strong> ${ticket.dateReceived || 'N/A'} <br>
            <small><em>Customer ID: ${ticket.customerId || 'N/A'}</em></small>
        </div>
        <button class="btn btn-sm btn-danger" data-id="${docSnap.id}">Delete</button>
    `;
    ticketsList.appendChild(li);

    li.querySelector("button").addEventListener("click", async () => {
      try {
        await deleteDoc(doc(db, "tickets", docSnap.id));
      } catch (err) {
        alert("Failed to delete ticket: " + err.message);
      }
    });

    if (latestTicketStatus[ticket.status] !== undefined) {
      latestTicketStatus[ticket.status]++;
    }

    if (ticket.status === "Open" || ticket.status === "In Progress") openTicketsCount++;
  });

  if (openTicketsEl) openTicketsEl.textContent = openTicketsCount;
  renderTicketsStatusChart(latestTicketStatus);
});

function renderTicketsStatusChart(data) {
  const ctx = document.getElementById("ticketsChart")?.getContext("2d");
  if (!ctx) return;
  const labels = Object.keys(data);
  const values = labels.map(status => data[status]);

  if (ticketsStatusChart) {
    ticketsStatusChart.data.labels = labels;
    ticketsStatusChart.data.datasets[0].data = values;
    ticketsStatusChart.update();
  } else {
    ticketsStatusChart = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels,
        datasets: [{
          label: "Tickets",
          data: values,
          backgroundColor: [
            '#b2ff59', // Open
            '#ffc107', // In Progress
            '#00bcd4', // Completed
            '#dc3545'  // Cancelled
          ],
          borderColor: '#2a2a4e',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              color: '#e0e0e0'
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                let label = context.label || '';
                if (label) {
                  label += ': ';
                }
                if (context.parsed !== null) {
                  label += context.parsed + ' tickets';
                }
                return label;
              }
            }
          }
        },
        scales: {
          // No x/y scales for doughnut charts
        }
      }
    });
  }
}


// ===== REPORT GENERATION =====
generateReportLink?.addEventListener("click", () => {
    showSection("sectionReport"); // Assumes showSection function exists, if not, it will be an error
    reportContentPre.textContent = "Please select a date range and click 'Generate Report'.";
});

reportDateForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    generateAndDisplayReport();
});

downloadReportBtn?.addEventListener("click", () => {
    const reportText = reportContentPre.textContent;
    if (reportText && reportText !== "Generating report..." && reportText !== "Please select a date range and click 'Generate Report'.") {
        const blob = new Blob([reportText], { type: "text/plain;charset=utf-8" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "business_report.txt";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    } else {
        alert("Report not yet generated or is empty.");
    }
});

async function generateAndDisplayReport() {
    reportContentPre.textContent = "Generating report...";
    const startDate = reportStartDateInput.value;
    const endDate = reportEndDateInput.value;

    if (!startDate || !endDate) {
        reportContentPre.textContent = "Please select both start and end dates for the report.";
        alert("Please select both start and end dates for the report.");
        return;
    }

    let reportText = `TELEPAIR Business Report (${startDate} to ${endDate}) - ${new Date().toLocaleDateString()}\n\n`;
    reportText += `=========================================\n`;

    try {
        // Fetch Sales Data with date filter
        reportText += `SALES DATA:\n`;
        const salesQuery = query(collection(db, "sales"), where("date", ">=", startDate), where("date", "<=", endDate));
        const salesSnapshot = await getDocs(salesQuery);
        if (salesSnapshot.empty) {
            reportText += "No sales data available for the selected date range.\n";
        } else {
            salesSnapshot.forEach(doc => {
                const sale = doc.data();
                reportText += `  Sale ID: ${doc.id}, Item: ${sale.item}, Quantity: ${sale.quantity}, Total: KES ${sale.totalPrice.toFixed(2)}, Date: ${sale.date}\n`;
            });
        }
        reportText += `\n`;

        // Fetch Inventory Data (no date filter needed for current inventory)
        reportText += `INVENTORY DATA:\n`;
        const inventorySnapshot = await getDocs(collection(db, "inventory"));
        if (inventorySnapshot.empty) {
            reportText += "No inventory data available.\n";
        } else {
            inventorySnapshot.forEach(doc => {
                const item = doc.data();
                reportText += `  Item ID: ${doc.id}, Name: ${item.name}, Quantity: ${item.quantity}, Price: KES ${item.price.toFixed(2)}, Value: KES ${(item.quantity * item.price).toFixed(2)}\n`;
            });
        }
        reportText += `\n`;

        // Fetch Customer Data (no date filter needed for all customers)
        reportText += `CUSTOMER DATA:\n`;
        const customersSnapshot = await getDocs(collection(db, "customers"));
        if (customersSnapshot.empty) {
            reportText += "No customer data available.\n";
        } else {
            customersSnapshot.forEach(doc => {
                const customer = doc.data();
                reportText += `  Customer ID: ${doc.id}, Name: ${customer.name}, Phone: ${customer.phone}, Email: ${customer.email || 'N/A'}, Address: ${customer.address || 'N/A'}\n`;
            });
        }
        reportText += `\n`;

        // Fetch Tickets Data with date filter
        reportText += `SUPPORT TICKETS DATA:\n`;
        const ticketsQuery = query(collection(db, "tickets"), where("dateReceived", ">=", startDate), where("dateReceived", "<=", endDate));
        const ticketsSnapshot = await getDocs(ticketsQuery);
        if (ticketsSnapshot.empty) {
            reportText += "No tickets data available for the selected date range.\n";
        } else {
            ticketsSnapshot.forEach(doc => {
                const ticket = doc.data();
                reportText += `  Ticket ID: ${doc.id}, Customer ID: ${ticket.customerId}, Device: ${ticket.device}, Issue: ${ticket.issue}, Status: ${ticket.status}, Date Received: ${ticket.dateReceived}\n`;
            });
        }
        reportText += `\n`;

        reportText += `=========================================\n`;
        reportText += `End of Report\n`;

        reportContentPre.textContent = reportText;

    } catch (error) {
        console.error("Error generating report:", error);
        reportContentPre.textContent = "Error generating report: " + error.message;
        alert("Failed to generate report. Please check console for details.");
    }
}


// ========== Initial UI Setup ==========
window.addEventListener("load", () => {
  // Show dashboard section and highlight dashboard nav link by default
  const dashboardSection = document.getElementById("sectionDashboard");
  const dashboardLink = document.querySelector(".nav-link[data-section='sectionDashboard']");
  if (dashboardSection) dashboardSection.classList.add("active");
  if (dashboardLink) dashboardLink.classList.add("active");

  // Set current section title
  const currentSectionTitleEl = document.getElementById("currentSectionTitle");
  if (currentSectionTitleEl && dashboardLink) {
    currentSectionTitleEl.textContent = dashboardLink.textContent.trim();
  }
});

// Helper function to show sections (if not already defined)
function showSection(sectionId) {
    document.querySelectorAll(".content-section").forEach(sec => sec.classList.remove("active"));
    const section = document.getElementById(sectionId);
    if (section) {
        section.classList.add("active");
    }
    // Update active nav link
    navLinks.forEach(l => l.classList.remove("active"));
    const activeLink = document.querySelector(`.nav-link[data-section='${sectionId}']`);
    if (activeLink) {
        activeLink.classList.add("active");
        const currentSectionTitleEl = document.getElementById("currentSectionTitle");
        if (currentSectionTitleEl) {
            currentSectionTitleEl.textContent = activeLink.textContent.trim();
        }
    }
}

