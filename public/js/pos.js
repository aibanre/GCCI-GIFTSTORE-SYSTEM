// Point of Sale (POS) System Logic (Variant-aware)

let cartItems = [];
let allPOSProducts = [];

function filterAndRenderPOSProducts() {
  const categoryFilter = document.getElementById('posCategoryFilter');
  const searchInput = document.getElementById('posProductSearch');
  let filtered = allPOSProducts;
  if (categoryFilter && categoryFilter.value) {
    filtered = filtered.filter(p => String(p.categoryID) === String(categoryFilter.value));
  }
  if (searchInput && searchInput.value.trim() !== '') {
    const term = searchInput.value.trim().toLowerCase();
    filtered = filtered.filter(p => p.name.toLowerCase().includes(term));
  }
  renderPOSProducts(filtered);
}

async function initPOS() {
  await fetchPOSCategories();
  await fetchPOSProducts();
  setupPOSEventListeners();
  const categoryFilter = document.getElementById('posCategoryFilter');
  if (categoryFilter) categoryFilter.addEventListener('change', filterAndRenderPOSProducts);
  const searchInput = document.getElementById('posProductSearch');
  if (searchInput) searchInput.addEventListener('input', filterAndRenderPOSProducts);
}

// Fetch categories from API and populate POS category dropdown
async function fetchPOSCategories() {
  try {
    const res = await fetch('/api/categories');
    if (!res.ok) throw new Error('Failed to fetch categories');
    const categories = await res.json();
    const categoryFilter = document.getElementById('posCategoryFilter');
    if (!categoryFilter) return;
    categoryFilter.innerHTML = '<option value="">All Categories</option>' +
      categories.map(c => `<option value="${c.CategoryID}">${escapeHtml(c.CategoryName)}</option>`).join('');
  } catch (err) {
    console.error('Error fetching POS categories:', err);
    // Fallback to static options
    const categoryFilter = document.getElementById('posCategoryFilter');
    if (categoryFilter) {
      categoryFilter.innerHTML = `
        <option value="">All Categories</option>
        <option value="books">Books</option>
        <option value="uniform">Uniform</option>
        <option value="college">College</option>
        <option value="senior-high">Senior High</option>
        <option value="electronics">Electronics</option>
      `;
    }
  }
}

async function fetchPOSProducts() {
  try {
    const response = await fetch('/api/items-with-variants');
    if (!response.ok) throw new Error('Failed to fetch products');
    const raw = await response.json();
    const items = Array.isArray(raw) ? raw : [];
    const flattened = [];
    items.forEach(item => {
      const base = {
        id: item.ItemID,
        itemId: item.ItemID,
        variantId: null,
        name: item.ItemName,
        price: Number(item.Price || 0) || 0,
        stock: Number(item.StockQuantity || 0) || 0,
        categoryID: item.CategoryID ?? '',
        isVariant: false
      };
      const variants = Array.isArray(item.Variants) ? item.Variants : [];
      if (variants.length === 0) {
        flattened.push(base);
      } else {
        variants.forEach(v => {
          flattened.push({
            id: `${item.ItemID}-V${v.VariantID}`,
            itemId: item.ItemID,
            variantId: v.VariantID,
            name: `${item.ItemName} (${v.Size})`,
            price: v.Price != null ? Number(v.Price) : base.price,
            stock: Number(v.StockQuantity || 0) || 0,
            categoryID: item.CategoryID ?? '',
            isVariant: true,
            size: v.Size
          });
        });
      }
    });
    allPOSProducts = flattened;
    filterAndRenderPOSProducts();
  } catch (error) {
    console.error('Error fetching POS products:', error);
    renderPOSProducts([
      { id: '1', name: 'Sample Product', price: 999.99, stock: 15 },
      { id: '2', name: 'Book Set (M)', price: 599.99, stock: 20 },
      { id: '3', name: 'Uniform (S)', price: 1299.99, stock: 8 },
    ]);
  }
}

function renderPOSProducts(products) {
  const productsList = document.getElementById('posProductsList');
  if (!productsList) return;

  productsList.innerHTML = products
    .map(
      (product) => `
    <div class="pos-product-item" data-product-id="${product.id}" data-name="${escapeHtml(product.name)}" data-price="${product.price}" data-stock="${product.stock}">
      <div class="pos-product-info">
        <strong>${escapeHtml(product.name)}</strong>
        <span class="pos-product-price">₱${parseFloat(product.price).toFixed(2)}</span>
        <small>Stock: ${product.stock}</small>
      </div>
      <button class="btn btn-primary btn-sm add-to-cart-btn">Add</button>
    </div>
  `
    )
    .join('');

  // Attach click handlers to newly created buttons (no inline onclick)
  document.querySelectorAll('.pos-product-item .add-to-cart-btn').forEach((btn) => {
    btn.addEventListener('click', function (e) {
      const productItem = e.target.closest('.pos-product-item');
      if (productItem) {
        const product = {
          id: productItem.dataset.productId,
          name: productItem.dataset.name,
          price: parseFloat(productItem.dataset.price),
          quantity: 1,
        };
        addToCart(product.id, product.name, product.price);
      }
    });
  });
}

function setupPOSEventListeners() {
  const completeBtn = document.getElementById('posCompleteTransaction');
  if (completeBtn) {
    completeBtn.addEventListener('click', completePurchase);
  }

  const clearBtn = document.getElementById('posClearCart');
  if (clearBtn) {
    clearBtn.addEventListener('click', clearCart);
  }

  const closeBtn = document.getElementById('posCloseReceipt');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeReceipt);
  }
  
  // Modal close button
  const closeModalBtn = document.getElementById('closePurchaseSlip');
  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', () => {
      const modal = document.getElementById('purchaseSlipModal');
      if (modal) modal.style.display = 'none';
    });
  }
  
  // New transaction button
  const newTransactionBtn = document.getElementById('posNewTransaction');
  if (newTransactionBtn) {
    newTransactionBtn.addEventListener('click', closeReceipt);
  }
  
  // Close modal when clicking outside
  const modal = document.getElementById('purchaseSlipModal');
  if (modal) {
    window.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.style.display = 'none';
      }
    });
  }
}

function addToCart(productId, productName, productPrice) {
  const product = allPOSProducts.find(p => p.id == productId);
  if (!product) { alert('Product not found'); return; }
  const existingItem = cartItems.find(ci => ci.displayId === productId);
  const currentQty = existingItem ? existingItem.quantity : 0;
  if (currentQty + 1 > product.stock) {
    alert(`Cannot add more than ${product.stock} items. Only ${product.stock - currentQty} more available.`);
    return;
  }
  if (existingItem) {
    existingItem.quantity++;
  } else {
    cartItems.push({
      id: product.itemId, // base ItemID for backend
      variantId: product.variantId, // optional
      displayId: product.id, // unique per variant/base
      name: productName,
      price: productPrice,
      stock: product.stock,
      quantity: 1,
      isVariant: product.isVariant,
      size: product.size || null
    });
  }
  updateCart();
}

function removeFromCart(productId) {
  cartItems = cartItems.filter(ci => ci.displayId !== productId && ci.id !== productId);
  updateCart();
}

function updateQuantity(productId, newQuantity) {
  const item = cartItems.find(ci => ci.displayId === productId || ci.id === productId);
  const product = allPOSProducts.find(p => p.id == productId || p.id == (item ? item.displayId : null));
  if (item && product) {
    const qty = Math.max(1, parseInt(newQuantity) || 1);
    if (qty > product.stock) {
      alert(`Cannot set quantity to ${qty}. Maximum available stock is ${product.stock}.`);
      item.quantity = product.stock;
    } else {
      item.quantity = qty;
    }
    updateCart();
  } else if (item) {
    item.quantity = Math.max(1, parseInt(newQuantity) || 1);
    updateCart();
  }
}

function updateCart() {
  const cart = document.getElementById('posCartItems');
  if (!cart) return;

  if (cartItems.length === 0) {
    cart.innerHTML = '<p class="empty-cart">Cart is empty</p>';
  } else {
    cart.innerHTML = cartItems
      .map(
        (item) => `
      <div class="cart-item">
        <div class="cart-item-details">
          <strong>${escapeHtml(item.name)}</strong>
          <span class="cart-item-price">₱${item.price.toFixed(2)}</span>
        </div>
        <div class="cart-item-controls">
          <button class="qty-btn" onclick="updateQuantity('${item.displayId}', ${item.quantity - 1})">-</button>
          <input type="number" value="${item.quantity}" onchange="updateQuantity('${item.displayId}', this.value)" class="qty-input">
          <button class="qty-btn" onclick="updateQuantity('${item.displayId}', ${item.quantity + 1})">+</button>
          <span class="item-total">₱${(item.price * item.quantity).toFixed(2)}</span>
          <button class="btn btn-danger btn-sm" onclick="removeFromCart('${item.displayId}')"><i class="fas fa-trash"></i></button>
        </div>
      </div>
    `
      )
      .join('');
  }
  calculateTotals();
}

function calculateTotals() {
  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const subtotalEl = document.getElementById('posSubtotal');
  const totalAmountEl = document.getElementById('posTotalAmount');

  if (subtotalEl) subtotalEl.textContent = '₱' + subtotal.toFixed(2);
  if (totalAmountEl) totalAmountEl.textContent = '₱' + subtotal.toFixed(2);
}

function completePurchase() {
  if (cartItems.length === 0) {
    alert('Please add items to cart');
    return;
  }

  // Send purchase to backend
  fetch('/api/purchase/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cartItems, purchaseType: 'Onsite' })
  })
    .then(res => res.json())
    .then(data => {
      if (!data.success) throw new Error(data.error || 'Failed to complete purchase');
      // Show receipt modal on success
      const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const receiptContent = document.getElementById('receiptContent');
      if (!receiptContent) return;
      const receiptHTML = `
        <div class="receipt-details" style="text-align: center; font-family: monospace;">
          <div style="margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 2px dashed #ddd;">
            <h4 style="margin: 0 0 0.5rem 0; color: #2a6b52; font-size: 1.25rem;">GCCI GIFTSTORE</h4>
            <p style="margin: 0; color: #7f8c8d; font-size: 0.9rem;">Gingoog City Colleges, Inc.</p>
            <p style="margin: 0.25rem 0 0 0; color: #7f8c8d; font-size: 0.85rem;">PURCHASE SLIP</p>
          </div>
          <div style="margin-bottom: 1rem; text-align: left; font-size: 0.9rem;">
            <p style="margin: 0.25rem 0;"><strong>Slip #:</strong> ${data.purchase.PurchaseID}</p>
            <p style="margin: 0.25rem 0;"><strong>Date/Time:</strong> ${new Date().toLocaleString()}</p>
          </div>
          <div style="border: 2px dashed #ddd; border-left: none; border-right: none; padding: 1rem 0; margin: 1rem 0;">
            <table style="width: 100%; font-size: 0.9rem; text-align: left;">
              <thead>
                <tr style="border-bottom: 1px solid #ddd;">
                  <th style="padding: 0.5rem 0;">Item</th>
                  <th style="padding: 0.5rem 0; text-align: center;">Qty</th>
                  <th style="padding: 0.5rem 0; text-align: right;">Price</th>
                  <th style="padding: 0.5rem 0; text-align: right;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${cartItems.map((item) => `
                  <tr>
                    <td style="padding: 0.5rem 0;">${escapeHtml(item.name)}</td>
                    <td style="padding: 0.5rem 0; text-align: center;">${item.quantity}</td>
                    <td style="padding: 0.5rem 0; text-align: right;">₱${item.price.toFixed(2)}</td>
                    <td style="padding: 0.5rem 0; text-align: right; font-weight: 600;">₱${(item.price * item.quantity).toFixed(2)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          <div style="margin: 1.5rem 0; padding: 1rem; background: linear-gradient(135deg, #f8f9fa 0%, #e8ecef 100%); border-radius: 8px;">
            <p style="margin: 0; font-size: 1.25rem; font-weight: 700; color: #27ae60;">TOTAL: ₱${subtotal.toFixed(2)}</p>
          </div>
          <div style="margin-top: 1.5rem; padding-top: 1rem; border-top: 2px dashed #ddd; color: #7f8c8d; font-size: 0.85rem;">
            <p style="margin: 0.25rem 0;">Customer pays at cashier</p>
            <p style="margin: 0.5rem 0 0 0; font-weight: 600; color: #2a6b52;">Thank you for your purchase!</p>
          </div>
        </div>
      `;
      receiptContent.innerHTML = receiptHTML;
      const modal = document.getElementById('purchaseSlipModal');
      if (modal) modal.style.display = 'block';
      // NO AUTOMATIC REFRESH - User can manually refresh when needed
    })
    .catch(err => {
      alert('Error: ' + (err.message || 'Failed to complete purchase'));
    });
}

function clearCart() {
  if (confirm('Are you sure you want to clear the cart?')) {
    cartItems = [];
    updateCart();
  }
}

function closeReceipt() {
  cartItems = [];
  updateCart();
  const modal = document.getElementById('purchaseSlipModal');
  if (modal) modal.style.display = 'none';
}

// Refresh POS System Function
async function refreshPOSSystem() {
  console.log('Refreshing POS System...');
  
  // Clear cart and close modal
  cartItems = [];
  updateCart();
  
  const modal = document.getElementById('purchaseSlipModal');
  if (modal) modal.style.display = 'none';
  
  // Re-fetch products to get updated stock levels
  await fetchPOSProducts();
  
  // Reset filters
  const categoryFilter = document.getElementById('posCategoryFilter');
  const searchInput = document.getElementById('posProductSearch');
  if (categoryFilter) categoryFilter.value = '';
  if (searchInput) searchInput.value = '';
  
  console.log('POS System refreshed successfully');
}

function escapeHtml(text) {
  const map = {
    '&': '&',
    '<': '<',
    '>': '>',
    '"': '"',
    "'": '&#039;',
  };
  // Ensure we operate on a string to avoid errors when fields are undefined/null
  const s = text == null ? '' : String(text);
  return s.replace(/[&<>\"']/g, (m) => map[m]);
}

document.addEventListener('DOMContentLoaded', initPOS);
