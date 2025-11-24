// Inventory Management Logic

// Fetch and render products into the Product List table
async function fetchProducts() {
  console.log('fetchProducts() called');
  const tbody = document.getElementById('productsTableBody');
  console.log('tbody element found:', !!tbody);
  
  if (!tbody) {
    console.error('productsTableBody not found in DOM');
    return;
  }
  
  tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:2rem">Loading products...</td></tr>';
  try {
    console.log('Fetching from /api/products...');
    const res = await fetch('/api/products');
    console.log('Fetch response received, status:', res.status, 'ok:', res.ok);
    
    if (!res.ok) throw new Error('Failed to fetch products (status ' + res.status + ')');
    
    const raw = await res.json();
    console.log('GET /api/products raw response:', raw);
    console.log('Response type:', typeof raw);
    console.log('Is array:', Array.isArray(raw));
    
    // Convert to array if needed and normalize
    const products = Array.isArray(raw) ? raw : [];
    console.log('Products array length:', products.length);
    if (products.length > 0) {
      console.log('First product:', products[0]);
    }

    if (products.length === 0) {
      console.log('No products, showing empty message');
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:2rem">No products found.</td></tr>';
      return;
    }
    
    // Render products directly without complex normalization
    console.log('Rendering', products.length, 'products');
    tbody.innerHTML = products
      .map((p) => {
        return `
        <tr>
          <td>${String(p.ItemName || '')}</td>
          <td>${String(p.CategoryName || '')}</td>
          <td>${String(p.Price || '')}</td>
          <td>${String(p.StockQuantity || '')}</td>
          <td>
            <button class="btn btn-warning btn-sm edit-product-btn" data-id="${p.ItemID}"><i class="fas fa-edit"></i> Edit</button>
            <button class="btn btn-danger btn-sm delete-product-btn" data-id="${p.ItemID}"><i class="fas fa-trash"></i> Delete</button>
          </td>
        </tr>
      `;
      })
      .join('');
    // Attach event listeners for edit/delete
    document.querySelectorAll('.edit-product-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = btn.getAttribute('data-id');
        const product = products.find(p => String(p.ItemID) === String(id));
        if (product) showEditProductModal(product);
      });
    });
    document.querySelectorAll('.delete-product-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = btn.getAttribute('data-id');
        if (confirm('Are you sure you want to delete this product?')) {
          deleteProduct(id);
        }
      });
    });
    console.log('Rendered', products.length, 'products successfully');
  // Show modal for editing product (styled and centered)
  function showEditProductModal(product) {
    let modal = document.getElementById('editProductModal');
    // Fetch categories for dropdown
    async function getCategoriesForDropdown() {
      try {
        const res = await fetch('/api/categories');
        if (!res.ok) throw new Error('Failed to fetch categories');
        return await res.json();
      } catch (err) {
        console.error('Error fetching categories for modal:', err);
        return [];
      }
    }

    function renderCategoryDropdown(categories, selectedId) {
      return `
        <select id="editProductCategory" class="form-control" required>
          ${categories.map(cat => `<option value="${cat.CategoryID}"${String(cat.CategoryID) === String(selectedId) ? ' selected' : ''}>${cat.CategoryName}</option>`).join('')}
        </select>
      `;
    }

    async function showModal() {
      const categories = await getCategoriesForDropdown();
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'editProductModal';
        modal.className = 'modal-centered';
        modal.style.display = 'flex';
        modal.innerHTML = `
          <div class="modal-content-custom">
            <span class="close-modal" id="closeEditModal">&times;</span>
            <h3 style="margin-top:0;">Edit Product</h3>
            <form id="editProductForm">
              <div class="form-group">
                <label>Product Name:</label>
                <input type="text" id="editProductName" class="form-control" value="${product.ItemName}" required>
              </div>
              <div class="form-group">
                <label>Category:</label>
                ${renderCategoryDropdown(categories, product.CategoryID)}
              </div>
              <div class="form-group">
                <label>Price:</label>
                <input type="number" id="editProductPrice" class="form-control" value="${product.Price}" step="0.01" required>
              </div>
              <div class="form-group">
                <label>Stock Quantity:</label>
                <input type="number" id="editProductStock" class="form-control" value="${product.StockQuantity}" required>
              </div>
              <div class="form-group">
                <label>Description:</label>
                <textarea id="editProductDescription" class="form-control">${product.Description || ''}</textarea>
              </div>
              <div class="form-actions">
                <button type="submit" class="btn btn-primary">Save Changes</button>
                <button type="button" class="btn btn-secondary" id="cancelEditModal">Cancel</button>
              </div>
            </form>
          </div>
        `;
        if (modal.parentNode) modal.parentNode.removeChild(modal);
        document.body.appendChild(modal);
      } else {
        modal.style.display = 'flex';
        modal.innerHTML = `
          <div class="modal-content-custom">
            <span class="close-modal" id="closeEditModal">&times;</span>
            <h3 style="margin-top:0;">Edit Product</h3>
            <form id="editProductForm">
              <div class="form-group">
                <label>Product Name:</label>
                <input type="text" id="editProductName" class="form-control" value="${product.ItemName}" required>
              </div>
              <div class="form-group">
                <label>Category:</label>
                ${renderCategoryDropdown(categories, product.CategoryID)}
              </div>
              <div class="form-group">
                <label>Price:</label>
                <input type="number" id="editProductPrice" class="form-control" value="${product.Price}" step="0.01" required>
              </div>
              <div class="form-group">
                <label>Stock Quantity:</label>
                <input type="number" id="editProductStock" class="form-control" value="${product.StockQuantity}" required>
              </div>
              <div class="form-group">
                <label>Description:</label>
                <textarea id="editProductDescription" class="form-control">${product.Description || ''}</textarea>
              </div>
              <div class="form-actions">
                <button type="submit" class="btn btn-primary">Save Changes</button>
                <button type="button" class="btn btn-secondary" id="cancelEditModal">Cancel</button>
              </div>
            </form>
          </div>
        `;
      }
      document.getElementById('closeEditModal').onclick = function() {
        modal.style.display = 'none';
      };
      document.getElementById('cancelEditModal').onclick = function() {
        modal.style.display = 'none';
      };
      document.getElementById('editProductForm').onsubmit = function(e) {
        e.preventDefault();
        saveProductChanges(product.ItemID);
      };
    }
    showModal();
  }

  // Save product changes to DB
  async function saveProductChanges(itemId) {
    const payload = {
      ItemName: document.getElementById('editProductName').value.trim(),
      CategoryID: document.getElementById('editProductCategory').value,
      Price: document.getElementById('editProductPrice').value,
      StockQuantity: document.getElementById('editProductStock').value,
      Description: document.getElementById('editProductDescription').value.trim(),
      AdminID: null // Optionally set admin ID
    };
    try {
      const res = await fetch(`/api/products/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data && data.success) {
        alert('Product updated successfully!');
        document.getElementById('editProductModal').style.display = 'none';
        fetchProducts();
      } else {
        alert('Failed to update product.');
        console.error('Update product response:', data);
      }
    } catch (err) {
      alert('Error updating product. See console for details.');
      console.error('Error updating product:', err);
    }
  }

  // Delete product from DB
  async function deleteProduct(itemId) {
    try {
      const res = await fetch(`/api/products/${itemId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ AdminID: null }) // Optionally set AdminID here
      });
      const data = await res.json();
      if (data && data.success) {
        alert('Product deleted successfully!');
        fetchProducts();
      } else {
        alert('Failed to delete product.');
        console.error('Delete product response:', data);
      }
    } catch (err) {
      alert('Error deleting product. See console for details.');
      console.error('Error deleting product:', err);
    }
  }
  } catch (err) {
    console.error('Error fetching products:', err);
    console.error('Error message:', err.message);
    console.error('Error stack:', err.stack);
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:2rem">Failed to load products: ' + err.message + '</td></tr>';
  }
}

async function initInventory() {
  console.log('initInventory() called');
  
  // Image upload preview
  const productImageInput = document.getElementById('productImageInput');
  if (productImageInput) {
    productImageInput.addEventListener('change', function (e) {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = function (event) {
          const preview = document.getElementById('imagePreview');
          if (preview) {
            preview.innerHTML = `
              <div class="preview-container">
                <img src="${event.target.result}" alt="Product Image Preview">
                <button type="button" class="btn btn-danger btn-sm" onclick="removeImage()">
                  <i class="fas fa-times"></i> Remove
                </button>
              </div>
            `;
          }
        };
        reader.readAsDataURL(file);
      }
    });
  }

  // Add product form submission
  const addProductForm = document.getElementById('addProductForm');
  if (addProductForm) {
    addProductForm.addEventListener('submit', function (e) {
      e.preventDefault();

      const name = document.getElementById('productName')?.value.trim();
      const category = document.getElementById('productCategory')?.value;
      const price = document.getElementById('productPrice')?.value;
      const stock = document.getElementById('productStock')?.value;
      const imageInput = document.getElementById('productImageInput');
      const description = document.getElementById('productDescription')?.value.trim();

      if (!name) {
        alert('Please enter product name');
        return;
      }
      if (category === 'Select a category' || !category) {
        alert('Please select a category');
        return;
      }
      if (!price || price <= 0) {
        alert('Please enter a valid price');
        return;
      }
      if (!stock || stock < 0) {
        alert('Please enter valid stock quantity');
        return;
      }
      // Build payload and POST to server
      const payload = {
        ItemName: name,
        CategoryID: category === 'Select a category' ? null : category,
        Price: parseFloat(price) || 0.0,
        StockQuantity: parseInt(stock, 10) || 0,
        Description: description || null,
        ImagePath: null,
      };

      // If an image is selected, we won't upload it here (server handling/image storage not implemented),
      // but we allow the field to be optional. You can extend this to upload files via FormData + multer.

      console.log('Posting product payload:', payload);
      fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data && data.success) {
            alert('Product "' + name + '" added successfully!');
            this.reset();
            const previewDiv = document.getElementById('imagePreview');
            if (previewDiv) previewDiv.innerHTML = '';
            // Optionally refresh product list
            if (typeof fetchProducts === 'function') fetchProducts();
          } else {
            alert('Failed to add product.');
            console.error('Create product response:', data);
          }
        })
        .catch((err) => {
          console.error('Error creating product:', err);
          alert('Error creating product. See console for details.');
        });
    });
  }

  // load products into table on init
  if (typeof fetchProducts === 'function') fetchProducts();
}

function removeImage() {
  const input = document.getElementById('productImageInput');
  if (input) input.value = '';
  const preview = document.getElementById('imagePreview');
  if (preview) preview.innerHTML = '';
}

document.addEventListener('DOMContentLoaded', initInventory);
