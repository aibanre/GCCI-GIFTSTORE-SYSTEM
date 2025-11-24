// Point of Sale (POS) System Logic

let cartItems = [];

async function initPOS() {
  await fetchPOSProducts();
  setupPOSEventListeners();
}

async function fetchPOSProducts() {
  try {
    const response = await fetch('/api/products');
    if (!response.ok) throw new Error('Failed to fetch products');
    const raw = await response.json();
    // Normalize server product shape to what POS expects
    const products = Array.isArray(raw)
      ? raw.map((p) => ({
          id: p.ItemID ?? p.id ?? p.ItemID,
          name: p.ItemName ?? p.name ?? '',
          price: Number(p.Price ?? p.price ?? 0) || 0,
          stock: Number(p.StockQuantity ?? p.stock ?? 0) || 0,
        }))
      : [];

    renderPOSProducts(products);
  } catch (error) {
    console.error('Error fetching POS products:', error);
    // Fallback to sample data
    renderPOSProducts([
      { id: '1', name: 'Sample Product', price: 999.99, stock: 15 },
      { id: '2', name: 'Book Set', price: 599.99, stock: 20 },
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
      <button class="btn btn-primary btn-sm" onclick="addToCart('${product.id}', '${escapeHtml(product.name)}', ${product.price})">Add</button>
    </div>
  `
    )
    .join('');

  // Attach click handlers to newly created buttons
  document.querySelectorAll('.pos-product-item .btn').forEach((btn) => {
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
}

function addToCart(productId, productName, productPrice) {
  const existingItem = cartItems.find((item) => item.id === productId);
  if (existingItem) {
    existingItem.quantity++;
  } else {
    cartItems.push({
      id: productId,
      name: productName,
      price: productPrice,
      quantity: 1,
    });
  }
  updateCart();
}

function removeFromCart(productId) {
  cartItems = cartItems.filter((item) => item.id !== productId);
  updateCart();
}

function updateQuantity(productId, newQuantity) {
  const item = cartItems.find((item) => item.id === productId);
  if (item) {
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
          <button class="qty-btn" onclick="updateQuantity('${item.id}', ${item.quantity - 1})">-</button>
          <input type="number" value="${item.quantity}" onchange="updateQuantity('${item.id}', this.value)" class="qty-input">
          <button class="qty-btn" onclick="updateQuantity('${item.id}', ${item.quantity + 1})">+</button>
          <span class="item-total">₱${(item.price * item.quantity).toFixed(2)}</span>
          <button class="btn btn-danger btn-sm" onclick="removeFromCart('${item.id}')"><i class="fas fa-trash"></i></button>
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

  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const receiptContent = document.getElementById('receiptContent');
  if (!receiptContent) return;

  const receiptHTML = `
    <div class="receipt-details">
      <p><strong>GCCI GIFTSTORE - PURCHASE SLIP</strong></p>
      <p>Slip #${Date.now()}</p>
      <p>Date/Time: ${new Date().toLocaleString()}</p>
      <hr>
      <table class="receipt-table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Qty</th>
            <th>Price</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          ${cartItems.map((item) => `
            <tr>
              <td>${escapeHtml(item.name)}</td>
              <td>${item.quantity}</td>
              <td>₱${item.price.toFixed(2)}</td>
              <td>₱${(item.price * item.quantity).toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <hr>
      <div class="receipt-summary">
        <p><strong>TOTAL: ₱${subtotal.toFixed(2)}</strong></p>
      </div>
      <hr>
      <p style="text-align: center; font-size: 0.9em;">Customer pays at cashier</p>
      <p style="text-align: center; font-size: 0.9em;">Thank you for your purchase!</p>
    </div>
  `;

  receiptContent.innerHTML = receiptHTML;
  const receipt = document.getElementById('posReceipt');
  if (receipt) receipt.classList.remove('hidden');

  alert('Purchase slip generated successfully!');
}

function clearCart() {
  if (confirm('Are you sure you want to clear the cart?')) {
    cartItems = [];
    updateCart();
    const receipt = document.getElementById('posReceipt');
    if (receipt) receipt.classList.add('hidden');
  }
}

function closeReceipt() {
  cartItems = [];
  updateCart();
  const receipt = document.getElementById('posReceipt');
  if (receipt) receipt.classList.add('hidden');
}

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  // Ensure we operate on a string to avoid errors when fields are undefined/null
  const s = text == null ? '' : String(text);
  return s.replace(/[&<>\"']/g, (m) => map[m]);
}

document.addEventListener('DOMContentLoaded', initPOS);
