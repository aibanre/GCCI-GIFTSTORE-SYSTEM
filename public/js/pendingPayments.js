// public/js/pendingPayments.js
// Handles Pending Payments tab: fetch, render, filter, approve/reject, details modal

document.addEventListener('DOMContentLoaded', function() {
  const tabBtn = document.getElementById('pendingPaymentsTabBtn');
  const section = document.getElementById('pendingPaymentsSection');
  const dashboardSection = document.getElementById('dashboardSection');
  const tableBody = document.getElementById('pendingPaymentsTableBody');
  const searchInput = document.getElementById('pendingPaymentsSearch');
  const refreshBtn = document.getElementById('refreshPendingPayments');
  const modal = document.getElementById('paymentDetailsModal');
  const closeModalBtn = document.getElementById('closePaymentDetailsModal');
  const modalInfo = document.getElementById('modalPaymentInfo');
  const modalItems = document.getElementById('modalPaymentItems');

  let payments = [];

  // Tab switching
  tabBtn.addEventListener('click', function() {
    dashboardSection.classList.add('hidden');
    section.classList.remove('hidden');
    loadPendingPayments();
  });

  // Refresh button
  refreshBtn.addEventListener('click', loadPendingPayments);

  // Search/filter
  searchInput.addEventListener('input', function() {
    renderTable(filterPayments(searchInput.value));
  });

  // Modal close
  closeModalBtn.addEventListener('click', function() {
    modal.style.display = 'none';
  });

  // Fetch pending payments
  function loadPendingPayments() {
    tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center;">Loading...</td></tr>`;
    fetch('/payments/pending')
      .then(res => res.json())
      .then(data => {
        payments = data;
        renderTable(payments);
      })
      .catch(() => {
        tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:red;">Failed to load payments.</td></tr>`;
      });
  }

  // Render table rows
  function renderTable(list) {
    // Update count badge
    const countBadge = document.getElementById('pendingPaymentsCount');
    if (countBadge) {
      countBadge.innerHTML = `<i class="fas fa-clock"></i> ${list.length} pending`;
    }
    
    if (!list.length) {
      tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:3rem; color:#7f8c8d;"><i class="fas fa-check-circle" style="font-size:3rem; opacity:0.3; display:block; margin-bottom:1rem;"></i>No pending payments found.</td></tr>`;
      return;
    }
    tableBody.innerHTML = list.map(p => `
      <tr style="border-bottom: 1px solid #e8ecef;">
        <td style="font-weight: 600; color: #2c3e50;">${p.PaymentID}</td>
        <td><span style="background:#e8ecef; padding:0.25rem 0.75rem; border-radius:12px; font-size:0.85rem; color:#546e7a;">${p.PurchaseID}</span></td>
        <td style="font-family: monospace; font-weight: 500; color: #3498db;">${p.PaymentRef}</td>
        <td style="font-weight: 600; color: #27ae60;">₱${parseFloat(p.AmountPaid).toFixed(2)}</td>
        <td style="font-size: 0.9rem; color: #7f8c8d;">${formatDate(p.PaymentDate)}</td>
        <td><span style="background:#3498db; color:white; padding:0.25rem 0.75rem; border-radius:12px; font-size:0.85rem; font-weight:600;">${p.PurchaseType}</span></td>
        <td style="font-weight: 500;">${p.StudentName || '<em style="color:#95a5a6;">N/A</em>'}</td>
        <td style="text-align: center;">
          <div style="display: flex; gap: 0.5rem; justify-content: center;">
            <button class="btn btn-success btn-sm" data-action="approve" data-id="${p.PaymentID}" style="padding:0.4rem 0.75rem; font-size:0.85rem; border-radius:6px; background:#27ae60; border:none;" title="Approve"><i class="fas fa-check"></i></button>
            <button class="btn btn-danger btn-sm" data-action="reject" data-id="${p.PaymentID}" style="padding:0.4rem 0.75rem; font-size:0.85rem; border-radius:6px; background:#e74c3c; border:none;" title="Reject"><i class="fas fa-times"></i></button>
            <button class="btn btn-info btn-sm" data-action="details" data-id="${p.PaymentID}" style="padding:0.4rem 0.75rem; font-size:0.85rem; border-radius:6px; background:#3498db; border:none;" title="View Details"><i class="fas fa-eye"></i></button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  // Table actions
  tableBody.addEventListener('click', function(e) {
    const btn = e.target.closest('button');
    if (!btn) return;
    const id = btn.getAttribute('data-id');
    const action = btn.getAttribute('data-action');
    if (action === 'approve') confirmPayment(id);
    if (action === 'reject') rejectPayment(id);
    if (action === 'details') showDetails(id);
  });

  // Approve payment
  function confirmPayment(id) {
    if (!confirm('Approve this payment?')) return;
    fetch(`/payment/${id}/confirm`, { method: 'POST' })
      .then(res => res.json())
      .then(() => loadPendingPayments());
  }

  // Reject payment
  function rejectPayment(id) {
    if (!confirm('Reject this payment?')) return;
    fetch(`/payment/${id}/reject`, { method: 'POST' })
      .then(res => res.json())
      .then(() => loadPendingPayments());
  }

  // Show payment details modal
  function showDetails(id) {
    fetch(`/payment/${id}/details`)
      .then(res => res.json())
      .then(data => {
        modalInfo.innerHTML = `
          <div style="background: #f8f9fa; padding: 1.25rem; border-radius: 8px; margin-bottom: 1.5rem;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; font-size: 0.95rem;">
              <div>
                <p style="margin: 0 0 0.5rem 0; color: #7f8c8d; font-size: 0.85rem; text-transform: uppercase; font-weight: 600;">Payment Reference</p>
                <p style="margin: 0; font-family: monospace; font-weight: 600; color: #3498db; font-size: 1.1rem;">${data.PaymentRef}</p>
              </div>
              <div>
                <p style="margin: 0 0 0.5rem 0; color: #7f8c8d; font-size: 0.85rem; text-transform: uppercase; font-weight: 600;">Amount Paid</p>
                <p style="margin: 0; font-weight: 700; color: #27ae60; font-size: 1.25rem;">₱${parseFloat(data.AmountPaid).toFixed(2)}</p>
              </div>
              <div>
                <p style="margin: 0 0 0.5rem 0; color: #7f8c8d; font-size: 0.85rem; text-transform: uppercase; font-weight: 600;">Payment Date</p>
                <p style="margin: 0; color: #2c3e50; font-weight: 500;">${formatDate(data.PaymentDate)}</p>
              </div>
              <div>
                <p style="margin: 0 0 0.5rem 0; color: #7f8c8d; font-size: 0.85rem; text-transform: uppercase; font-weight: 600;">Purchase Type</p>
                <p style="margin: 0;"><span style="background:#3498db; color:white; padding:0.25rem 0.75rem; border-radius:12px; font-size:0.85rem; font-weight:600;">${data.PurchaseType}</span></p>
              </div>
              <div style="grid-column: 1 / -1;">
                <p style="margin: 0 0 0.5rem 0; color: #7f8c8d; font-size: 0.85rem; text-transform: uppercase; font-weight: 600;">Student Name</p>
                <p style="margin: 0; color: #2c3e50; font-weight: 500;">${data.StudentName || '<em style="color:#95a5a6;">N/A</em>'}</p>
              </div>
            </div>
          </div>
        `;
        modalItems.innerHTML = `
          <h4 style="margin: 0 0 1rem 0; color: #2c3e50; font-size: 1.1rem; font-weight: 600; display: flex; align-items: center; gap: 0.5rem;">
            <i class="fas fa-shopping-bag" style="color: #2a6b52;"></i> Purchased Items
          </h4>
          <div style="background: #f8f9fa; border-radius: 8px; padding: 1rem;">
            ${(data.Items||[]).length > 0 
              ? `<ul style="list-style: none; padding: 0; margin: 0;">${(data.Items||[]).map(i => `
                  <li style="padding: 0.75rem; border-bottom: 1px solid #e8ecef; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                      <strong style="color: #2c3e50; display: block; margin-bottom: 0.25rem;">${i.ProductName}</strong>
                      <span style="color: #7f8c8d; font-size: 0.9rem;">Quantity: ${i.Quantity}</span>
                    </div>
                    <span style="font-weight: 700; color: #27ae60; font-size: 1.1rem;">₱${parseFloat(i.Price).toFixed(2)}</span>
                  </li>
                `).join('')}</ul>`
              : '<p style="text-align: center; color: #7f8c8d; padding: 1rem; margin: 0;">No items found</p>'
            }
          </div>
        `;
        modal.style.display = 'block';
      });
  }

  // Filter payments
  function filterPayments(query) {
    query = query.trim().toLowerCase();
    if (!query) return payments;
    return payments.filter(p =>
      (p.PaymentRef && p.PaymentRef.toLowerCase().includes(query)) ||
      (p.PurchaseID && p.PurchaseID.toString().includes(query)) ||
      (p.StudentName && p.StudentName.toLowerCase().includes(query))
    );
  }

  function formatDate(d) {
    if (!d) return '';
    const date = new Date(d);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  }
});
