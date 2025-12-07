// Variant Management Logic

let variantItems = [];
let selectedVariantItemId = null;

async function fetchItemsWithVariants() {
  const tbody = document.getElementById('variantItemsTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="2" style="text-align:center; padding:1.5rem;">Loading items...</td></tr>';
  try {
    const res = await fetch('/api/items-with-variants');
    if (!res.ok) throw new Error('Failed to fetch items');
    const data = await res.json();
    variantItems = Array.isArray(data) ? data : [];
    if (variantItems.length === 0) {
      tbody.innerHTML = '<tr><td colspan="2" style="text-align:center; padding:1.5rem;">No products found.</td></tr>';
      return;
    }
    tbody.innerHTML = variantItems.map(it => `
      <tr class="variant-item-row" data-item-id="${it.ItemID}">
        <td>${escapeHtml(it.ItemName)}</td>
        <td>${it.StockQuantity}</td>
      </tr>
    `).join('');
    document.querySelectorAll('.variant-item-row').forEach(row => {
      row.addEventListener('click', () => {
        const id = row.getAttribute('data-item-id');
        selectVariantItem(parseInt(id, 10));
      });
    });
  } catch (err) {
    console.error('Error fetching items with variants:', err);
    tbody.innerHTML = '<tr><td colspan="2" style="text-align:center; padding:1.5rem;">Failed to load products.</td></tr>';
  }
}

function selectVariantItem(itemId) {
  selectedVariantItemId = itemId;
  const item = variantItems.find(i => i.ItemID === itemId);
  const title = document.getElementById('selectedVariantItemTitle');
  const addBtn = document.getElementById('addVariantBtn');
  if (title) title.textContent = item ? `Variants for: ${item.ItemName} (ID ${item.ItemID})` : 'Select a product to view variants';
  if (addBtn) addBtn.disabled = !item;
  renderItemVariants(item);
}

function renderItemVariants(item) {
  const tbody = document.getElementById('itemVariantsTableBody');
  if (!tbody) return;
  if (!item) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:1.5rem;">No item selected.</td></tr>';
    return;
  }
  const variants = Array.isArray(item.Variants) ? item.Variants : [];
  if (variants.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:1.5rem;">No variants for this product.</td></tr>';
    return;
  }
  tbody.innerHTML = variants.map(v => `
    <tr data-variant-id="${v.VariantID}">
      <td>${escapeHtml(v.Size)}</td>
      <td>${v.Price != null ? '₱' + parseFloat(v.Price).toFixed(2) : '<em>Base</em>'}</td>
      <td>${v.StockQuantity}</td>
      <td>${v.IsActive ? 'Yes' : 'No'}</td>
      <td>
        <button class="btn btn-warning btn-sm edit-variant-btn" data-id="${v.VariantID}"><i class="fas fa-edit"></i></button>
        <button class="btn btn-danger btn-sm delete-variant-btn" data-id="${v.VariantID}"><i class="fas fa-trash"></i></button>
      </td>
    </tr>
  `).join('');
  bindVariantRowActions();
}

function bindVariantRowActions() {
  document.querySelectorAll('.edit-variant-btn').forEach(btn => {
    btn.addEventListener('click', () => openEditVariantModal(parseInt(btn.getAttribute('data-id'), 10)));
  });
  document.querySelectorAll('.delete-variant-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteVariant(parseInt(btn.getAttribute('data-id'), 10)));
  });
}

// Add Variant
function initAddVariantForm() {
  const form = document.getElementById('addVariantForm');
  const clearBtn = document.getElementById('clearVariantForm');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!selectedVariantItemId) {
      alert('Select a product first.');
      return;
    }
    const Size = document.getElementById('variantSize').value.trim();
    const Price = document.getElementById('variantPrice').value.trim();
    const StockQuantity = document.getElementById('variantStock').value.trim();
    if (!Size) { alert('Size is required'); return; }
    try {
      const res = await fetch(`/api/items/${selectedVariantItemId}/variants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Size, Price, StockQuantity })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to add variant');
      // Refresh local variant list
      const item = variantItems.find(i => i.ItemID === selectedVariantItemId);
      if (item) {
        item.Variants.push(data.variant);
      }
      form.reset();
      renderItemVariants(item);
      // Notify other UIs
      try { window.dispatchEvent(new CustomEvent('variant-updated', { detail: { itemId: selectedVariantItemId } })); } catch(_) {}
    } catch (err) {
      console.error('Add variant error:', err);
      alert('Error adding variant: ' + err.message);
    }
  });
  if (clearBtn) {
    clearBtn.addEventListener('click', () => form.reset());
  }
}

// Edit Variant Modal
function openEditVariantModal(variantId) {
  const item = variantItems.find(i => i.ItemID === selectedVariantItemId);
  if (!item) return;
  const variant = item.Variants.find(v => v.VariantID === variantId);
  if (!variant) return;
  const modal = document.getElementById('editVariantModal');
  if (!modal) return;
  modal.style.display = 'block';
  document.getElementById('editVariantID').value = variant.VariantID;
  document.getElementById('editVariantSize').value = variant.Size;
  document.getElementById('editVariantPrice').value = variant.Price != null ? variant.Price : '';
  document.getElementById('editVariantStock').value = variant.StockQuantity;
  document.getElementById('editVariantActive').value = variant.IsActive ? '1' : '0';
}

function initEditVariantModal() {
  const modal = document.getElementById('editVariantModal');
  const closeBtn = document.getElementById('closeEditVariantModal');
  const cancelBtn = document.getElementById('cancelEditVariant');
  const form = document.getElementById('editVariantForm');
  if (!modal || !form) return;
  function close() { modal.style.display = 'none'; }
  if (closeBtn) closeBtn.onclick = close;
  if (cancelBtn) cancelBtn.onclick = close;
  // Close modal when clicking outside
  window.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const variantId = parseInt(document.getElementById('editVariantID').value, 10);
    const Size = document.getElementById('editVariantSize').value.trim();
    const Price = document.getElementById('editVariantPrice').value.trim();
    const StockQuantity = document.getElementById('editVariantStock').value.trim();
    const IsActive = document.getElementById('editVariantActive').value === '1';
    try {
      const res = await fetch(`/api/variants/${variantId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Size, Price, StockQuantity, IsActive })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to update variant');
      // Update local store
      const item = variantItems.find(i => i.ItemID === selectedVariantItemId);
      if (item) {
        const idx = item.Variants.findIndex(v => v.VariantID === variantId);
        if (idx >= 0) item.Variants[idx] = data.variant;
        renderItemVariants(item);
      }
      // Notify other UIs
      try { window.dispatchEvent(new CustomEvent('variant-updated', { detail: { itemId: selectedVariantItemId } })); } catch(_) {}
      close();
    } catch (err) {
      console.error('Update variant error:', err);
      alert('Error updating variant: ' + err.message);
    }
  });
}

async function deleteVariant(variantId) {
  if (!confirm('Delete this variant? This action cannot be undone.')) return;
  try {
    const res = await fetch(`/api/variants/${variantId}`, { method: 'DELETE' });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to delete variant');
    const item = variantItems.find(i => i.ItemID === selectedVariantItemId);
    if (item) {
      item.Variants = item.Variants.filter(v => v.VariantID !== variantId);
      renderItemVariants(item);
    }
    // Notify other UIs
    try { window.dispatchEvent(new CustomEvent('variant-updated', { detail: { itemId: selectedVariantItemId } })); } catch(_) {}
  } catch (err) {
    console.error('Delete variant error:', err);
    alert('Error deleting variant: ' + err.message);
  }
}

function escapeHtml(text) {
  const map = { '&': '&', '<': '<', '>': '>', '"': '"', "'": '&#039;' };
  const s = text == null ? '' : String(text);
  return s.replace(/[&<>"']/g, m => map[m]);
}

function initVariants() {
  fetchItemsWithVariants();
  initAddVariantForm();
  initEditVariantModal();
}

document.addEventListener('DOMContentLoaded', initVariants);
