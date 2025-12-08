// Dashboard Navigation Logic

const navLinkMap = {
  Dashboard: 'dashboardSection',
  'POS System': 'posSystemSection',
  Inventory: 'inventorySection',
  Reservations: 'reservationsSection',
  Reports: 'reportsSection',
};

function initDashboardNavigation() {
  document.querySelectorAll('.admin-nav a').forEach((link) => {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      document
        .querySelectorAll('.admin-nav a')
        .forEach((l) => l.classList.remove('active'));
      this.classList.add('active');

      // Hide all sections
      document.querySelectorAll('[id$="Section"]').forEach((section) => {
        section.classList.add('hidden');
      });

      // Get the text content and map to section ID
      const linkText = this.textContent.trim();
      const sectionId = navLinkMap[linkText];

      if (sectionId) {
        const section = document.getElementById(sectionId);
        if (section) {
          section.classList.remove('hidden');
          
          // Trigger data refresh for Inventory section
          if (linkText === 'Inventory' && typeof fetchProducts === 'function') {
            console.log('Inventory tab clicked, fetching products');
            fetchProducts();
          }
          
          // Trigger data refresh for POS System section
          if (linkText === 'POS System' && typeof refreshPOSSystem === 'function') {
            console.log('POS System tab clicked, refreshing POS data');
            refreshPOSSystem();
          }
          
              // Trigger data refresh for Reservations section
              if (linkText === 'Reservations' && typeof fetchReservations === 'function') {
                console.log('Reservations tab clicked, fetching reservations');
                fetchReservations();
              }
        }
      }
    });
  });
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', initDashboardNavigation);

// Activity toggle functionality for dashboard
document.addEventListener('DOMContentLoaded', function() {
  const toggleBtns = document.querySelectorAll('.activity-toggle-btn');
  toggleBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      const view = this.getAttribute('data-view');
      
      // Update button styles
      toggleBtns.forEach(b => {
        if (b === this) {
          b.style.background = '#2a6b52';
          b.style.color = 'white';
          b.classList.add('active');
        } else {
          b.style.background = '#e8ecef';
          b.style.color = '#546e7a';
          b.classList.remove('active');
        }
      });
      
      // Show/hide views
      document.querySelectorAll('.activity-view').forEach(v => {
        v.style.display = 'none';
      });
      document.getElementById('activityView-' + view).style.display = 'block';
    });
  });
});


// Reports: attach event handlers for Generate AI Stock Report
document.addEventListener('DOMContentLoaded', function(){
  const aiBtn = document.getElementById('generateAiStockReportBtn');
  const aiOutput = document.getElementById('aiReportOutput');
  if (aiBtn) {
    aiBtn.addEventListener('click', async function(){
      aiOutput.style.display = 'block';
      aiOutput.textContent = 'Generating AI stock report...';
      try {
        const resp = await fetch('/api/reports/stock-ai', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
        if (!resp.ok) {
          const txt = await resp.text();
          aiOutput.textContent = 'AI provider error: ' + txt;
          return;
        }
        const data = await resp.json();
        if (data && data.ai) {
          // Display AI JSON prettily if possible
          try { aiOutput.textContent = JSON.stringify(data.ai, null, 2); }
          catch(e) { aiOutput.textContent = String(data.ai); }
          // If the response included a reportId, fetch history and display suggestions
          if (data.reportId) {
            await loadAiHistory();
          }
        } else {
          aiOutput.textContent = 'No AI result returned.';
        }
      } catch (err) {
        console.error('AI report error', err);
        aiOutput.textContent = 'Error generating AI report. See console.';
      }
    });
  }
});

async function loadAiHistory() {
  const out = document.getElementById('aiReportOutput');
  const container = document.getElementById('aiSuggestionsContainer');
  const tbody = document.getElementById('aiSuggestionsBody');
  if (!tbody || !container) return;
  try {
    const resp = await fetch('/api/reports/ai-history');
    if (!resp.ok) return;
    const data = await resp.json();
    const reports = (data && data.reports) ? data.reports : [];
    // Show latest report suggestions (first record)
    if (!reports.length) {
      container.style.display = 'none';
      return;
    }
    const latest = reports[0];
    // Use suggestions array from report object (aggregated from DB records)
    const suggestions = latest.suggestions || [];
    if (!suggestions.length) {
      container.style.display = 'none';
      out.textContent = latest.parsed && latest.parsed.rawText ? latest.parsed.rawText : JSON.stringify(latest.raw||{}, null, 2);
      out.style.display = 'block';
      return;
    }
    // Render suggestions into table
    tbody.innerHTML = suggestions.map(s => {
      const priorityColor = s.priority === 'high' ? '#e74c3c' : s.priority === 'medium' ? '#f39c12' : '#95a5a6';
      const statusColor = s.status === 'ordered' ? '#27ae60' : '#3498db';
      return `<tr data-analysis-id="${s.AnalysisID||""}" data-itemid="${s.ItemID||""}" style="border-bottom: 1px solid #e8ecef;">
        <td style="padding: 0.75rem; font-weight: 600; color: #2c3e50;">${escapeHtml(s.ItemID||"")}</td>
        <td style="padding: 0.75rem; color: #2c3e50;">${escapeHtml(s.ItemName||"")}</td>
        <td style="padding: 0.75rem; color: #7f8c8d; font-size: 0.9rem;">${escapeHtml(s.reason||"")}</td>
        <td style="padding: 0.75rem; font-weight: 600; color: #3498db;">${escapeHtml(String(s.suggestedQty||""))}</td>
        <td style="padding: 0.75rem;"><span style="background: ${priorityColor}; color: white; padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.85rem; font-weight: 600; text-transform: uppercase;">${escapeHtml(s.priority||"")}</span></td>
        <td style="padding: 0.75rem;"><span style="background: ${statusColor}; color: white; padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.85rem; font-weight: 600;">${escapeHtml(s.status||"")}</span></td>
      </tr>`;
    }).join('');
    container.style.display = 'block';
    out.style.display = 'none';
  } catch (err) {
    console.error('Error loading AI history', err);
  }
}

document.addEventListener('DOMContentLoaded', function(){
  const refreshBtn = document.getElementById('refreshAiHistoryBtn');
  if (refreshBtn) refreshBtn.addEventListener('click', loadAiHistory);
  // Export CSV of latest suggestions
  const exportBtn = document.getElementById('exportAiCsvBtn');
  if (exportBtn) exportBtn.addEventListener('click', function(){
    const tbody = document.getElementById('aiSuggestionsBody');
    if (!tbody) return alert('No suggestions to export');
    const rows = Array.from(tbody.querySelectorAll('tr'));
    if (!rows.length) return alert('No suggestions to export');
    // build CSV header
    const headers = ['ItemID','ItemName','Reason','SuggestedQty','Priority','Status'];
    const csv = [headers.join(',')];
    rows.forEach(r => {
      const cols = Array.from(r.querySelectorAll('td')).slice(0,6).map(td => '"' + (td.textContent||'').replace(/"/g,'""') + '"');
      csv.push(cols.join(','));
    });
    const blob = new Blob([csv.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ai_suggestions_' + (new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')) + '.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });
});

// Regular report generation
document.addEventListener('DOMContentLoaded', function(){
  const generateBtn = document.getElementById('generateReportBtn');
  if (!generateBtn) return;
  
  generateBtn.addEventListener('click', async function(){
    const reportType = document.getElementById('reportTypeSelect')?.value;
    const dateFrom = document.getElementById('reportFrom')?.value;
    const dateTo = document.getElementById('reportTo')?.value;
    
    if (!reportType) {
      return alert('Please select a report type');
    }
    
    // Validate date filters for all reports
    if (!dateFrom || !dateTo) {
      return alert('Date range is required for ' + reportType + ' reports');
    }
    
    const fromDate = new Date(dateFrom);
    const toDate = new Date(dateTo);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    
    // Check if either date is in the future
    if (fromDate > today || toDate > today) {
      return alert('Date cannot be in the future');
    }
    
    // Check if from date is after to date
    if (fromDate > toDate) {
      return alert('Start date cannot be after end date');
    }
    
    try {
      generateBtn.disabled = true;
      generateBtn.textContent = 'Generating...';
      
      const response = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportType, dateFrom, dateTo })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate report');
      }
      
      const data = await response.json();
      
      if (data.success && data.report) {
        displayReport(data.report);
      } else {
        alert('No report data received');
      }
    } catch (err) {
      console.error('Error generating report:', err);
      alert('Error: ' + err.message);
    } finally {
      generateBtn.disabled = false;
      generateBtn.textContent = 'Generate Report';
    }
  });
});

function displayReport(report) {
  const container = document.querySelector('.report-chart');
  if (!container) return;
  
  // Hide AI report outputs
  const aiOutput = document.getElementById('aiReportOutput');
  const aiSuggestions = document.getElementById('aiSuggestionsContainer');
  if (aiOutput) aiOutput.style.display = 'none';
  if (aiSuggestions) aiSuggestions.style.display = 'none';
  
  // Remove any existing report display
  let reportDiv = document.getElementById('standardReportOutput');
  if (!reportDiv) {
    reportDiv = document.createElement('div');
    reportDiv.id = 'standardReportOutput';
    container.appendChild(reportDiv);
  }
  
  reportDiv.style.cssText = 'background:#fff; padding:1.75rem; border-radius:12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); display:block;';
  
  const reportIcon = report.type === 'stock' ? 'fa-boxes' : report.type === 'reservations' ? 'fa-ticket-alt' : 'fa-dollar-sign';
  let html = `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 2px solid #e8ecef;">
    <h3 style="margin: 0; color: #2c3e50; font-size: 1.25rem; font-weight: 600; display: flex; align-items: center;">
      <i class="fas ${reportIcon}" style="margin-right: 0.75rem; color: #2a6b52;"></i>
      ${report.type.charAt(0).toUpperCase() + report.type.slice(1)} Report
    </h3>
    <p style="margin: 0; color: #7f8c8d; font-size: 0.9rem;"><i class="far fa-clock" style="margin-right: 0.5rem;"></i>Generated: ${new Date(report.generatedAt).toLocaleString()}</p>
  </div>`;
  
  // Add date range if available
  console.log('Report dates:', report.dateFrom, report.dateTo);
  if (report.dateFrom && report.dateTo) {
    const fromDate = new Date(report.dateFrom).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const toDate = new Date(report.dateTo).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    html += `<div style="background: #f8f9fa; padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem; border-left: 4px solid #2a6b52;">
      <strong style="color: #2c3e50;">Report Period:</strong> <span style="color: #546e7a;">${fromDate} to ${toDate}</span>
    </div>`;
  }
  
  if (report.type === 'stock') {
    html += `
      <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:1rem; margin-bottom:1.5rem;">
        <div style="padding:1.25rem; background:linear-gradient(135deg, #3498db 0%, #2980b9 100%); border-radius:10px; color:white; box-shadow: 0 2px 8px rgba(52,152,219,0.3);">
          <div style="font-size: 0.85rem; opacity: 0.9; margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.5px;">Total Items</div>
          <div style="font-size: 2rem; font-weight: 700;">${report.totalItems}</div>
        </div>
        <div style="padding:1.25rem; background:linear-gradient(135deg, #2a6b52 0%, #1e4d3a 100%); border-radius:10px; color:white; box-shadow: 0 2px 8px rgba(42,107,82,0.3);">
          <div style="font-size: 0.85rem; opacity: 0.9; margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.5px;">Total Rows</div>
          <div style="font-size: 2rem; font-weight: 700;">${report.totalRows}</div>
        </div>
        <div style="padding:1.25rem; background:linear-gradient(135deg, #f39c12 0%, #e67e22 100%); border-radius:10px; color:white; box-shadow: 0 2px 8px rgba(243,156,18,0.3);">
          <div style="font-size: 0.85rem; opacity: 0.9; margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.5px;">Low Stock</div>
          <div style="font-size: 2rem; font-weight: 700;">${report.lowStockItems}</div>
        </div>
        <div style="padding:1.25rem; background:linear-gradient(135deg, #e74c3c 0%, #c0392b 100%); border-radius:10px; color:white; box-shadow: 0 2px 8px rgba(231,76,60,0.3);">
          <div style="font-size: 0.85rem; opacity: 0.9; margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.5px;">Out of Stock</div>
          <div style="font-size: 2rem; font-weight: 700;">${report.outOfStock}</div>
        </div>
      </div>
      <div style="margin-bottom:1rem;">
        <button id="exportReportCsvBtn" class="btn btn-primary" style="padding: 0.75rem 1.5rem; background: #27ae60; color: white; border: none; border-radius: 8px; font-weight: 600; display: inline-flex; align-items: center; gap: 0.5rem; cursor: pointer;">
          <i class="fas fa-file-excel"></i>
          Export to Excel
        </button>
      </div>
      <div class="data-table">
        <table id="reportDataTable">
          <thead><tr><th>Item ID</th><th>Item Name</th><th>Variant</th><th>Stock</th><th>Price</th><th>Category</th><th>Last Restock Date</th><th>Last Restock Qty</th></tr></thead>
          <tbody>
            ${report.items.map(i => `<tr style="${i.Stock === 0 ? 'background:#f8d7da;' : i.Stock < 10 ? 'background:#fff3cd;' : ''}">
              <td>${i.ItemID}</td><td>${escapeHtml(i.ItemName)}</td><td>${i.Variant ? escapeHtml(i.Variant) : '-'}</td><td>${i.Stock}</td><td>₱${i.Price}</td><td>${escapeHtml(i.Category)}</td>
              <td>${i.LastRestockDate ? new Date(i.LastRestockDate).toLocaleDateString() : 'Never'}</td><td>${i.LastRestockQty || '-'}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    `;
  } else if (report.type === 'reservations') {
    html += `
      <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:1rem; margin-bottom:1.5rem;">
        <div style="padding:1.25rem; background:linear-gradient(135deg, #3498db 0%, #2980b9 100%); border-radius:10px; color:white; box-shadow: 0 2px 8px rgba(52,152,219,0.3);">
          <div style="font-size: 0.85rem; opacity: 0.9; margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.5px;">Total Reservations</div>
          <div style="font-size: 2rem; font-weight: 700;">${report.totalReservations}</div>
        </div>
        <div style="padding:1.25rem; background:linear-gradient(135deg, #f39c12 0%, #e67e22 100%); border-radius:10px; color:white; box-shadow: 0 2px 8px rgba(243,156,18,0.3);">
          <div style="font-size: 0.85rem; opacity: 0.9; margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.5px;">Pending</div>
          <div style="font-size: 2rem; font-weight: 700;">${report.pending}</div>
        </div>
        <div style="padding:1.25rem; background:linear-gradient(135deg, #27ae60 0%, #229954 100%); border-radius:10px; color:white; box-shadow: 0 2px 8px rgba(39,174,96,0.3);">
          <div style="font-size: 0.85rem; opacity: 0.9; margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.5px;">Confirmed</div>
          <div style="font-size: 2rem; font-weight: 700;">${report.confirmed}</div>
        </div>
        <div style="padding:1.25rem; background:linear-gradient(135deg, #e74c3c 0%, #c0392b 100%); border-radius:10px; color:white; box-shadow: 0 2px 8px rgba(231,76,60,0.3);">
          <div style="font-size: 0.85rem; opacity: 0.9; margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.5px;">Cancelled</div>
          <div style="font-size: 2rem; font-weight: 700;">${report.cancelled}</div>
        </div>
      </div>
      <div style="margin-bottom:1rem;">
        <button id="exportReportCsvBtn" class="btn btn-primary" style="padding: 0.75rem 1.5rem; background: #27ae60; color: white; border: none; border-radius: 8px; font-weight: 600; display: inline-flex; align-items: center; gap: 0.5rem; cursor: pointer;">
          <i class="fas fa-file-excel"></i>
          Export to Excel
        </button>
      </div>
      <div class="data-table">
        <table id="reportDataTable">
          <thead><tr><th>ID</th><th>Code</th><th>Status</th><th>Date</th><th>Student</th><th>Email</th></tr></thead>
          <tbody>
            ${report.reservations.map(r => `<tr>
              <td>${r.ReservationID}</td><td>${escapeHtml(r.ReservationCode)}</td><td>${escapeHtml(r.Status)}</td>
              <td>${new Date(r.DateReserved).toLocaleDateString()}</td><td>${escapeHtml(r.StudentName)}</td><td>${escapeHtml(r.StudentEmail)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    `;
  } else if (report.type === 'sales') {
    html += `
      <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:1rem; margin-bottom:1.5rem;">
        <div style="padding:1.25rem; background:linear-gradient(135deg, #3498db 0%, #2980b9 100%); border-radius:10px; color:white; box-shadow: 0 2px 8px rgba(52,152,219,0.3);">
          <div style="font-size: 0.85rem; opacity: 0.9; margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.5px;">Total Purchases</div>
          <div style="font-size: 2rem; font-weight: 700;">${report.totalPurchases}</div>
        </div>
        <div style="padding:1.25rem; background:linear-gradient(135deg, #9b59b6 0%, #8e44ad 100%); border-radius:10px; color:white; box-shadow: 0 2px 8px rgba(155,89,182,0.3);">
          <div style="font-size: 0.85rem; opacity: 0.9; margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.5px;">Items Sold</div>
          <div style="font-size: 2rem; font-weight: 700;">${report.totalItemsSold || 0}</div>
        </div>
        <div style="padding:1.25rem; background:linear-gradient(135deg, #27ae60 0%, #229954 100%); border-radius:10px; color:white; box-shadow: 0 2px 8px rgba(39,174,96,0.3);">
          <div style="font-size: 0.85rem; opacity: 0.9; margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.5px;">Total Revenue</div>
          <div style="font-size: 2rem; font-weight: 700;">₱${parseFloat(report.totalRevenue).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
        </div>
      </div>
      <div style="margin-bottom:1rem;">
        <button id="exportReportCsvBtn" class="btn btn-primary" style="padding: 0.75rem 1.5rem; background: #27ae60; color: white; border: none; border-radius: 8px; font-weight: 600; display: inline-flex; align-items: center; gap: 0.5rem; cursor: pointer;">
          <i class="fas fa-file-excel"></i>
          Export to Excel
        </button>
      </div>
      <div class="data-table">
        <table id="reportDataTable">
          <thead><tr><th>Purchase ID</th><th>Type</th><th>Date</th><th>Items Purchased</th><th>Total Amount</th></tr></thead>
          <tbody>
            ${report.purchases.map(p => {
              const itemsList = p.Items && p.Items.length > 0 
                ? p.Items.map(item => {
                    const variantText = item.Variant ? ` (${item.Variant})` : '';
                    return `${item.ItemName}${variantText} x${item.Quantity}`;
                  }).join('<br>')
                : 'N/A';
              return `<tr>
                <td>${p.PurchaseID}</td>
                <td>${escapeHtml(p.PurchaseType)}</td>
                <td>${new Date(p.DatePurchased).toLocaleDateString()}</td>
                <td style="max-width: 300px;">${itemsList}</td>
                <td>₱${parseFloat(p.TotalAmount).toFixed(2)}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }
  
  reportDiv.innerHTML = html;
  
  // Attach Excel export handler (using SheetJS)
  const exportBtn = document.getElementById('exportReportCsvBtn');
  if (exportBtn) {
    exportBtn.addEventListener('click', async function() {
      const table = document.getElementById('reportDataTable');
      if (!table || typeof ExcelJS === 'undefined') return alert('Excel export not available');
      
      const timestamp = new Date(report.generatedAt);
      const dateStr = timestamp.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      const timeStr = timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      
      // Create workbook using ExcelJS
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet(report.type.charAt(0).toUpperCase() + report.type.slice(1));
      
      let currentRow = 1;
      
      // Add header information
      worksheet.getCell(`A${currentRow}`).value = 'Gingoog City Colleges, Inc.';
      worksheet.getCell(`A${currentRow}`).font = { bold: true, size: 14 };
      currentRow += 2;
      
      worksheet.getCell(`A${currentRow}`).value = 'Report Type:';
      worksheet.getCell(`B${currentRow}`).value = report.type.charAt(0).toUpperCase() + report.type.slice(1) + ' Report';
      currentRow++;
      
      worksheet.getCell(`A${currentRow}`).value = 'Generated On:';
      worksheet.getCell(`B${currentRow}`).value = dateStr;
      currentRow++;
      
      worksheet.getCell(`A${currentRow}`).value = 'Generated At:';
      worksheet.getCell(`B${currentRow}`).value = timeStr;
      currentRow++;
      
      // Add generated by (get from session)
      const adminUsername = document.querySelector('.sessionUser')?.textContent?.trim() || 'Admin';
      worksheet.getCell(`A${currentRow}`).value = 'Generated By:';
      worksheet.getCell(`B${currentRow}`).value = adminUsername;
      currentRow++;
      
      // Format date range for better readability
      const formatDateRange = (fromDate, toDate) => {
        if (!fromDate || !toDate) return 'N/A';
        const from = new Date(fromDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        const to = new Date(toDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        return `${from} to ${to}`;
      };
      
      // Add report-specific metadata
      if (report.type === 'stock') {
        if (report.dateFrom || report.dateTo) {
          worksheet.getCell(`A${currentRow}`).value = 'Date Range:';
          worksheet.getCell(`B${currentRow}`).value = formatDateRange(report.dateFrom, report.dateTo);
          currentRow++;
        }
        worksheet.getCell(`A${currentRow}`).value = 'Total Items:';
        worksheet.getCell(`B${currentRow}`).value = report.totalItems;
        currentRow++;
        worksheet.getCell(`A${currentRow}`).value = 'Total Rows:';
        worksheet.getCell(`B${currentRow}`).value = report.totalRows;
        currentRow++;
        worksheet.getCell(`A${currentRow}`).value = 'Low Stock Items:';
        worksheet.getCell(`B${currentRow}`).value = report.lowStockItems;
        currentRow++;
        worksheet.getCell(`A${currentRow}`).value = 'Out of Stock:';
        worksheet.getCell(`B${currentRow}`).value = report.outOfStock;
        currentRow++;
      } else if (report.type === 'reservations') {
        worksheet.getCell(`A${currentRow}`).value = 'Date Range:';
        worksheet.getCell(`B${currentRow}`).value = formatDateRange(report.dateFrom, report.dateTo);
        currentRow++;
        worksheet.getCell(`A${currentRow}`).value = 'Total Reservations:';
        worksheet.getCell(`B${currentRow}`).value = report.totalReservations;
        currentRow++;
        worksheet.getCell(`A${currentRow}`).value = 'Pending:';
        worksheet.getCell(`B${currentRow}`).value = report.pending;
        currentRow++;
        worksheet.getCell(`A${currentRow}`).value = 'Confirmed:';
        worksheet.getCell(`B${currentRow}`).value = report.confirmed;
        currentRow++;
        worksheet.getCell(`A${currentRow}`).value = 'Cancelled:';
        worksheet.getCell(`B${currentRow}`).value = report.cancelled;
        currentRow++;
      } else if (report.type === 'sales') {
        worksheet.getCell(`A${currentRow}`).value = 'Date Range:';
        worksheet.getCell(`B${currentRow}`).value = formatDateRange(report.dateFrom, report.dateTo);
        currentRow++;
        worksheet.getCell(`A${currentRow}`).value = 'Total Purchases:';
        worksheet.getCell(`B${currentRow}`).value = report.totalPurchases;
        currentRow++;
        worksheet.getCell(`A${currentRow}`).value = 'Total Items Sold:';
        worksheet.getCell(`B${currentRow}`).value = report.totalItemsSold || 0;
        currentRow++;
        worksheet.getCell(`A${currentRow}`).value = 'Total Revenue:';
        const revenueCell = worksheet.getCell(`B${currentRow}`);
        revenueCell.value = parseFloat(report.totalRevenue);
        revenueCell.numFmt = '₱#,##0.00';
        revenueCell.font = { bold: true };
        currentRow++;
      }
      
      currentRow += 2; // Skip rows
      
      // Add table headers
      const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.trim());
      const headerRow = worksheet.getRow(currentRow);
      headerRow.values = headers;
      
      // Style header row - bold, white text, green background
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF2A6B52' }
        };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      });
      
      currentRow++;
      
      // Determine column indices for special formatting based on report type
      let currencyColumns = [];
      let centerColumns = [];
      
      if (report.type === 'stock') {
        // Stock report columns: Item ID, Item Name, Variant, Stock, Price, Category, Last Restock Date, Last Restock Qty
        centerColumns = [0, 3, 7]; // ItemID, Stock, Last Restock Qty
        currencyColumns = [4]; // Price
      } else if (report.type === 'sales') {
        // Sales report columns: Purchase ID, Type, Date, Items Purchased, Total Amount
        centerColumns = [0, 1, 2]; // Purchase ID, Type, Date
        currencyColumns = [4]; // Total Amount
      } else if (report.type === 'reservations') {
        // Reservations report columns: ID, Code, Status, Date, Student, Email
        centerColumns = [0]; // ID
        currencyColumns = []; // No currency columns
      }
      
      // Add table data with proper number formatting and alignment
      const rows = Array.from(table.querySelectorAll('tbody tr'));
      const dataStartRow = currentRow;
      
      rows.forEach((row, rowIndex) => {
        const rowData = [];
        row.querySelectorAll('td').forEach((td, colIndex) => {
          let text = td.textContent.trim();
          
          // Check if cell contains <br> tags (items list)
          if (td.innerHTML.includes('<br>')) {
            // Replace <br> with newlines for Excel
            const itemsText = td.innerHTML.split('<br>').map(item => item.trim()).join('\n');
            // Remove any HTML tags
            const cleanText = itemsText.replace(/<[^>]*>/g, '');
            rowData.push(cleanText);
          }
          // Check if it's a price/currency value
          else if (text.includes('₱') || text.startsWith('PHP')) {
            const numValue = parseFloat(text.replace(/[₱,PHP\s]/g, ''));
            rowData.push(isNaN(numValue) ? text : numValue);
          }
          // Check if it's a pure number (stock quantity, etc.)
          else if (/^\d+$/.test(text)) {
            rowData.push(parseInt(text, 10));
          }
          // Check if it's a decimal number
          else if (/^\d+\.\d+$/.test(text)) {
            rowData.push(parseFloat(text));
          }
          // Otherwise keep as text
          else {
            rowData.push(text);
          }
        });
        
        const excelRow = worksheet.addRow(rowData);
        
        // Apply formatting to specific columns
        excelRow.eachCell((cell, colNumber) => {
          const colIndex = colNumber - 1;
          
          // Center align specified columns
          if (centerColumns.includes(colIndex)) {
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          }
          
          // Currency format for specified columns
          if (currencyColumns.includes(colIndex) && typeof cell.value === 'number') {
            cell.numFmt = '₱#,##0.00';
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
          }
          
          // Enable text wrapping for items column in sales report (column index 3)
          if (report.type === 'sales' && colIndex === 3 && typeof cell.value === 'string') {
            cell.alignment = { vertical: 'top', wrapText: true };
          }
        });
      });
      
      currentRow = worksheet.rowCount + 2;
      worksheet.getCell(`A${currentRow}`).value = 'End of Report';
      
      // Auto-size columns
      worksheet.columns.forEach((column, index) => {
        let maxLength = 8;
        column.eachCell({ includeEmpty: false }, (cell) => {
          const cellValue = cell.value ? cell.value.toString() : '';
          maxLength = Math.max(maxLength, cellValue.length);
        });
        // Cap width - first column (ItemID) at 15, others at 30
        column.width = Math.min(maxLength + 2, index === 0 ? 15 : 30);
      });
      
      // Generate Excel file
      const fileTimestamp = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
      const filename = `GCCI_${report.type}_report_${fileTimestamp}.xlsx`;
      
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });
  }
}

// Fetch and render reservations for the admin dashboard
let allReservationsData = [];

async function fetchReservations() {
  const tbody = document.getElementById('reservationsTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:2rem;"><i class="fas fa-spinner fa-spin"></i> Loading reservations...</td></tr>';

  try {
    const resp = await fetch('/api/reservations');
    if (!resp.ok) throw new Error('Failed to load reservations');
    const data = await resp.json();
    
    allReservationsData = data; // Store for filtering
    updateReservationStats(data);
    renderReservationsTable(data);
  } catch (err) {
    console.error('Error fetching reservations', err);
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:2rem; color:darkred;"><i class="fas fa-exclamation-triangle"></i> Unable to load reservations.</td></tr>';
  }
}

function updateReservationStats(data) {
  const total = data.length;
  const pending = data.filter(r => r.Status === 'Pending').length;
  const approved = data.filter(r => r.Status === 'Approved').length;
  const claimed = data.filter(r => r.Status === 'Claimed').length;

  document.getElementById('totalReservationsCount').textContent = total;
  document.getElementById('pendingReservationsCount').textContent = pending;
  document.getElementById('approvedReservationsCount').textContent = approved;
  document.getElementById('claimedReservationsCount').textContent = claimed;
}

function renderReservationsTable(data) {
  const tbody = document.getElementById('reservationsTableBody');
  if (!tbody) return;

  if (!Array.isArray(data) || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:2rem; color:#666;"><i class="fas fa-inbox"></i><p style="margin-top:0.5rem;">No reservations found.</p></td></tr>';
    return;
  }

  const getStatusBadge = (status) => {
    const colors = {
      'Pending': 'background: #ffc107; color: #000;',
      'Approved': 'background: #28a745; color: white;',
      'Claimed': 'background: #17a2b8; color: white;',
      'Expired': 'background: #6c757d; color: white;',
      'Canceled': 'background: #dc3545; color: white;'
    };
    return `<span style="padding: 0.35rem 0.75rem; border-radius: 12px; font-size: 0.85rem; font-weight: 500; ${colors[status] || 'background: #6c757d; color: white;'}">${status}</span>`;
  };

  const formatDateTime = (date) => {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getTimeRemaining = (deadline) => {
    if (!deadline) return '-';
    const now = new Date();
    const end = new Date(deadline);
    const diff = end - now;
    
    if (diff <= 0) return '<span style="color: #dc3545; font-weight: 500;">Expired</span>';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const rows = data.map(r => {
    const student = r.StudentName || 'Guest';
    const studentId = r.StudentIDNumber || '';
    const items = r.Items || [];
    const itemsText = items.length > 0 
      ? items.map(it => it.ItemName).join(', ') 
      : 'No items';
    const itemsShort = itemsText.length > 40 ? itemsText.substring(0, 40) + '...' : itemsText;
    const totalQty = items.reduce((sum, it) => sum + (it.Quantity || 0), 0);
    
    const cancelWindow = getTimeRemaining(r.CancelWindowExpires);
    const claimDeadline = r.ClaimDeadline ? formatDateTime(r.ClaimDeadline) : '-';

    return `
      <tr style="cursor: pointer;" class="reservation-row" data-id="${r.ReservationID}">
        <td style="font-weight: 600; color: #2a6b52;">${escapeHtml(r.ReservationCode || '-')}</td>
        <td>
          <div style="font-weight: 500;">${escapeHtml(student)}</div>
          ${studentId ? `<div style="font-size: 0.85rem; color: #666;">${escapeHtml(studentId)}</div>` : ''}
        </td>
        <td>
          <div style="font-size: 0.9rem;" title="${escapeHtml(itemsText)}">${escapeHtml(itemsShort)}</div>
          <div style="font-size: 0.85rem; color: #666;">${totalQty} item(s)</div>
        </td>
        <td style="font-size: 0.9rem;">${formatDateTime(r.DateReserved)}</td>
        <td style="font-size: 0.9rem;">${cancelWindow}</td>
        <td style="font-size: 0.9rem;">${claimDeadline}</td>
        <td>${getStatusBadge(r.Status || 'Pending')}</td>
        <td>
          <button class="btn btn-sm view-reservation-btn" data-id="${r.ReservationID}" style="padding: 0.4rem 0.85rem;">
            <i class="fas fa-eye"></i> View
          </button>
        </td>
      </tr>`;
  }).join('');

  tbody.innerHTML = rows;
  
  // Attach click handlers
  document.querySelectorAll('.view-reservation-btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      const id = this.getAttribute('data-id');
      const found = data.find(x => String(x.ReservationID) === String(id));
      if (!found) {
        console.error('Reservation not found for ID:', id);
        return alert('Reservation not found');
      }
      showReservationModal(found);
    });
  });

  // Make entire row clickable
  document.querySelectorAll('.reservation-row').forEach(row => {
    row.addEventListener('click', function() {
      const id = this.getAttribute('data-id');
      const found = data.find(x => String(x.ReservationID) === String(id));
      if (found) {
        showReservationModal(found);
      }
    });
  });
}

// Filter and search functionality
if (document.getElementById('reservationSearchInput')) {
  document.getElementById('reservationSearchInput').addEventListener('input', filterReservations);
}
if (document.getElementById('reservationStatusFilter')) {
  document.getElementById('reservationStatusFilter').addEventListener('change', filterReservations);
}
if (document.getElementById('refreshReservationsBtn')) {
  document.getElementById('refreshReservationsBtn').addEventListener('click', fetchReservations);
}

function filterReservations() {
  const searchTerm = (document.getElementById('reservationSearchInput')?.value || '').toLowerCase();
  const statusFilter = document.getElementById('reservationStatusFilter')?.value || '';

  let filtered = allReservationsData;

  // Filter by status
  if (statusFilter) {
    filtered = filtered.filter(r => r.Status === statusFilter);
  }

  // Filter by search term
  if (searchTerm) {
    filtered = filtered.filter(r => {
      const code = (r.ReservationCode || '').toLowerCase();
      const student = (r.StudentName || '').toLowerCase();
      const studentId = (r.StudentIDNumber || '').toLowerCase();
      const items = (r.Items || []).map(it => (it.ItemName || '').toLowerCase()).join(' ');
      
      return code.includes(searchTerm) || 
             student.includes(searchTerm) || 
             studentId.includes(searchTerm) ||
             items.includes(searchTerm);
    });
  }

  updateReservationStats(filtered);
  renderReservationsTable(filtered);
}

// Show reservation details modal
function showReservationModal(reservation) {
  const modal = document.getElementById('reservationDetailsModal');
  if (!modal) {
    console.error('Modal element not found!');
    return;
  }
  const meta = document.getElementById('reservationMeta');
  const tbodyItems = document.getElementById('reservationItemsBody');
  
  const student = reservation.StudentName || 'Guest';
  const studentID = reservation.StudentIDNumber || '';
  const studentEmail = reservation.StudentEmail || (reservation.Student && reservation.Student.Email) || '';
  const dateReserved = reservation.DateReserved ? new Date(reservation.DateReserved).toLocaleString() : '-';
  const cancelWindow = reservation.CancelWindowExpires ? new Date(reservation.CancelWindowExpires).toLocaleString() : '-';
  const claimDeadline = reservation.ClaimDeadline ? new Date(reservation.ClaimDeadline).toLocaleString() : '-';
  const status = reservation.Status || 'Pending';
  
  const getStatusBadge = (status) => {
    const colors = {
      'Pending': 'background: #ffc107; color: #000;',
      'Approved': 'background: #28a745; color: white;',
      'Claimed': 'background: #17a2b8; color: white;',
      'Expired': 'background: #6c757d; color: white;',
      'Canceled': 'background: #dc3545; color: white;'
    };
    return `<span style="padding: 0.4rem 1rem; border-radius: 12px; font-size: 0.9rem; font-weight: 500; ${colors[status] || 'background: #6c757d; color: white;'}">${status}</span>`;
  };

  meta.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 0.35rem;">
      <div style="font-size: 0.85rem; color: #666;">Reservation Code</div>
      <div style="font-weight: 600; font-size: 1.1rem; color: #2a6b52;">${escapeHtml(reservation.ReservationCode || '-')}</div>
    </div>
    <div style="display: flex; flex-direction: column; gap: 0.35rem;">
      <div style="font-size: 0.85rem; color: #666;">Student</div>
      <div style="font-weight: 500;">${escapeHtml(student)}</div>
      ${studentID ? `<div style="font-size: 0.85rem; color: #666;">${escapeHtml(studentID)}</div>` : ''}
      ${studentEmail ? `<div style="font-size: 0.85rem; color: #666; margin-top:0.25rem;">Email</div><div style="font-weight:500;">${escapeHtml(studentEmail)}</div>` : ''}
      ${reservation.EmailHasOtherPending ? `<div style="margin-top:0.5rem; padding:0.5rem; border-radius:8px; background:#fff3cd; color:#856404; font-size:0.9rem;">This email is linked to another pending reservation. Please verify before approving.</div>` : ''}
    </div>
    <div style="display: flex; flex-direction: column; gap: 0.35rem;">
      <div style="font-size: 0.85rem; color: #666;">Status</div>
      <div>${getStatusBadge(status)}</div>
    </div>
    <div style="display: flex; flex-direction: column; gap: 0.35rem;">
      <div style="font-size: 0.85rem; color: #666;">Date Reserved</div>
      <div style="font-size: 0.9rem;">${dateReserved}</div>
    </div>
    <div style="display: flex; flex-direction: column; gap: 0.35rem;">
      <div style="font-size: 0.85rem; color: #666;">Cancel Window Expires</div>
      <div style="font-size: 0.9rem;">${cancelWindow}</div>
    </div>
    <div style="display: flex; flex-direction: column; gap: 0.35rem;">
      <div style="font-size: 0.85rem; color: #666;">Claim Deadline</div>
      <div style="font-size: 0.9rem; ${new Date(reservation.ClaimDeadline) < new Date() ? 'color: #dc3545; font-weight: 500;' : ''}">${claimDeadline}</div>
    </div>
  `;
  
  // Items table
  const items = reservation.Items || [];
  if (!items.length) {
    tbodyItems.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:1.5rem; color: #666;">No items in this reservation</td></tr>';
  } else {
    const totalPrice = items.reduce((sum, it) => sum + ((it.Price || 0) * (it.Quantity || 0)), 0);
    tbodyItems.innerHTML = items.map(it => `
      <tr>
        <td style="font-weight: 500;">${escapeHtml(it.ItemName || 'Unknown Item')}</td>
        <td style="text-align: center;">${it.Quantity || 0}</td>
        <td style="text-align: right;">₱${((it.Price || 0) * (it.Quantity || 1)).toFixed(2)}</td>
      </tr>
    `).join('') + `
      <tr style="border-top: 2px solid #dee2e6; font-weight: 600;">
        <td colspan="2" style="text-align: right; padding-top: 0.75rem;">Total:</td>
        <td style="text-align: right; padding-top: 0.75rem;">₱${totalPrice.toFixed(2)}</td>
      </tr>
    `;
  }
  
  modal.style.display = 'block';
  
  // Wire up buttons
  const closeBtn = document.getElementById('closeReservationDetailsModal');
  const closeBtn2 = document.getElementById('closeReservationDetailsBtn');
  const proceedPaymentBtn = document.getElementById('reservationProceedPayment');
  const cancelBtn = document.getElementById('reservationMarkCancelled');
  
  const closeModal = () => { modal.style.display = 'none'; };
  
  if (closeBtn) closeBtn.onclick = closeModal;
  if (closeBtn2) closeBtn2.onclick = closeModal;
  
  if (proceedPaymentBtn) {
    proceedPaymentBtn.onclick = async () => {
      if (!confirm('Proceed to payment for this reservation?')) return;
      try {
        const resp = await fetch(`/purchases/from-reservation/${reservation.ReservationCode}`, { 
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        if (resp.ok) {
          const result = await resp.json();
          alert('Purchase created successfully! Redirecting to pending payments...');
          modal.style.display = 'none';
          // Switch to pending payments tab
          document.getElementById('pendingPaymentsTabBtn')?.click();
        } else {
          const err = await resp.json();
          alert(err.message || 'Failed to create purchase');
        }
      } catch (err) {
        console.error(err);
        alert('Error creating purchase');
      }
    };
  }
  
  if (cancelBtn) {
    cancelBtn.onclick = async () => {
      if (!confirm('Cancel this reservation? This will restore inventory.')) return;
      try {
        const resp = await fetch(`/api/reservations/${reservation.ReservationCode}/cancel`, { method: 'POST' });
        if (resp.ok) {
          alert('Reservation cancelled');
          modal.style.display = 'none';
          fetchReservations();
        } else {
          const err = await resp.json();
          alert(err.message || 'Failed to cancel reservation');
        }
      } catch (err) {
        console.error(err);
        alert('Error cancelling reservation');
      }
    };
  }
  
  modal.addEventListener('click', function(ev) { 
    if (ev.target && ev.target.id === 'reservationDetailsModal') modal.style.display = 'none'; 
  });
  
  document.addEventListener('keydown', function(ev) { 
    if (ev.key === 'Escape' && modal.style.display === 'block') modal.style.display = 'none'; 
  });
}

// basic html escape for table cells
function escapeHtml(str) {
  if (!str && str !== 0) return '';
  return String(str).replace(/[&<>"'`]/g, function (s) {
    return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;","`":"&#96;"})[s];
  });
}