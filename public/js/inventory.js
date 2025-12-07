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
  
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:2rem">Loading products...</td></tr>';
  try {
    console.log('Fetching from /api/items-with-variants and /api/categories...');
    const [resItems, resCats] = await Promise.all([
      fetch('/api/items-with-variants'),
      fetch('/api/categories')
    ]);
    if (!resItems.ok) throw new Error('Failed to fetch items-with-variants (status ' + resItems.status + ')');
    if (!resCats.ok) throw new Error('Failed to fetch categories (status ' + resCats.status + ')');
    const raw = await resItems.json();
    const cats = await resCats.json();
    const categoryMap = Array.isArray(cats) ? cats.reduce((m,c)=>{ m[c.CategoryID]=c.CategoryName; return m; }, {}) : {};
    const products = Array.isArray(raw) ? raw : [];
    console.log('Products array length:', products.length);
    if (products.length > 0) {
      console.log('First product:', products[0]);
    }

    if (products.length === 0) {
      console.log('No products, showing empty message');
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:2rem">No products found.</td></tr>';
      return;
    }
    
    // Render products with variant count and collapsible variant list
    console.log('Rendering', products.length, 'products');
    
    // Update product count
    const productCountEl = document.getElementById('productCount');
    if (productCountEl) {
      productCountEl.textContent = `${products.length} product${products.length !== 1 ? 's' : ''}`;
    }
    
    tbody.innerHTML = products
      .map((p) => {
        const variantList = Array.isArray(p.Variants) ? p.Variants : [];
        const variantCount = variantList.length;
        
        // Display all categories from the Categories array
        let categoryDisplay = '';
        if (p.Categories && Array.isArray(p.Categories) && p.Categories.length > 0) {
          categoryDisplay = p.Categories.map(cat => 
            `<span style="background:#e8ecef; padding:0.25rem 0.75rem; border-radius:12px; font-size:0.85rem; color:#546e7a; margin-right:0.25rem; display:inline-block; margin-bottom:0.25rem;">${cat.CategoryName}</span>`
          ).join('');
        } else {
          // Fallback to old CategoryID if Categories array is empty
          categoryDisplay = `<span style="background:#e8ecef; padding:0.25rem 0.75rem; border-radius:12px; font-size:0.85rem; color:#546e7a;">${categoryMap[p.CategoryID] || ''}</span>`;
        }
        
        const variantsRow = variantCount > 0
          ? `
            <tr class="variant-row" id="variantsRow-${p.ItemID}" style="display:none; background:#fafafa;">
              <td colspan="5">
                <div style="padding:0.5rem 0.5rem 0;">
                  <strong>Variants (${variantCount}):</strong>
                </div>
                <div class="data-table" style="margin-top:0.5rem;">
                  <table style="width:100%">
                    <thead>
                      <tr>
                        <th style="text-align:left">Size</th>
                        <th style="text-align:left">Price Override</th>
                        <th style="text-align:left">Stock</th>
                        <th style="text-align:left">Active</th>
                        <th style="text-align:left">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${variantList.map(v => `
                        <tr>
                          <td>${String(v.Size || '')}</td>
                          <td>${v.Price != null ? '₱' + parseFloat(v.Price).toFixed(2) : '<em>Base</em>'}</td>
                          <td>${String(v.StockQuantity ?? '')}</td>
                          <td>${v.IsActive ? 'Yes' : 'No'}</td>
                          <td>
                            <button class="btn btn-warning btn-sm variant-inline-edit-btn" data-item-id="${p.ItemID}" data-variant-id="${v.VariantID}"><i class="fas fa-edit"></i></button>
                            <button class="btn btn-danger btn-sm variant-inline-delete-btn" data-item-id="${p.ItemID}" data-variant-id="${v.VariantID}"><i class="fas fa-trash"></i></button>
                          </td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              </td>
            </tr>
          `
          : '';
        return `
        <tr style="border-bottom: 1px solid #e8ecef;">
          <td style="font-weight: 500; color: #2c3e50;">
            ${String(p.ItemName || '')} 
            ${p.IsActive ? '' : '<span style="background:#e74c3c; color:white; padding:0.2rem 0.5rem; border-radius:12px; font-size:0.75rem; margin-left:0.5rem; font-weight:600;">Inactive</span>'}
          </td>
          <td>${categoryDisplay}</td>
          <td style="font-weight: 600; color: #27ae60;">₱${parseFloat(p.Price || 0).toFixed(2)}</td>
          <td>
            ${p.StockQuantity < 5 
              ? `<span style="background:#e74c3c; color:white; padding:0.25rem 0.75rem; border-radius:12px; font-size:0.85rem; font-weight:600;">${p.StockQuantity}</span>`
              : p.StockQuantity < 20
                ? `<span style="background:#f39c12; color:white; padding:0.25rem 0.75rem; border-radius:12px; font-size:0.85rem; font-weight:600;">${p.StockQuantity}</span>`
                : `<span style="background:#27ae60; color:white; padding:0.25rem 0.75rem; border-radius:12px; font-size:0.85rem; font-weight:600;">${p.StockQuantity}</span>`
            }
          </td>
          <td>
            <span style="background:#3498db; color:white; padding:0.25rem 0.75rem; border-radius:12px; font-size:0.85rem; font-weight:600; margin-right:0.5rem;">${variantCount}</span>
            ${variantCount > 0 ? `<button class="btn btn-secondary btn-sm toggle-variants-btn" data-id="${p.ItemID}" style="padding:0.4rem 0.75rem; font-size:0.85rem;"><i class="fas fa-list"></i> View</button>` : ''}
            <button class="btn btn-info btn-sm manage-variants-btn" data-id="${p.ItemID}" style="padding:0.4rem 0.75rem; font-size:0.85rem; margin-left:0.25rem;"><i class="fas fa-sliders-h"></i> Manage</button>
          </td>
          <td style="text-align: center;">
            <div style="display: flex; gap: 0.5rem; justify-content: center;">
              <button class="btn btn-warning btn-sm edit-product-btn" data-id="${p.ItemID}" style="padding:0.4rem 0.75rem; font-size:0.85rem; background:#f39c12; border:none;" title="Edit Product"><i class="fas fa-edit"></i></button>
              <button class="btn btn-sm toggle-active-product-btn ${p.IsActive ? 'btn-secondary' : 'btn-success'}" data-id="${p.ItemID}" data-active="${p.IsActive ? '1':'0'}" style="padding:0.4rem 0.75rem; font-size:0.85rem;" title="${p.IsActive ? 'Deactivate' : 'Activate'}">
                <i class="fas ${p.IsActive ? 'fa-eye-slash' : 'fa-eye'}"></i>
              </button>
            </div>
          </td>
        </tr>
        ${variantsRow}
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
    document.querySelectorAll('.toggle-active-product-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const isActive = btn.getAttribute('data-active') === '1';
        try {
          const endpoint = isActive ? `/api/products/${id}/deactivate` : `/api/products/${id}/activate`;
          const res = await fetch(endpoint, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ AdminID: null }) });
          const data = await res.json();
          if (data && data.success) {
            fetchProducts();
          } else {
            alert('Failed to toggle active state');
            console.error('Toggle active response:', data);
          }
        } catch (err) {
          alert('Error toggling active state. See console for details.');
          console.error('Error toggling active state:', err);
        }
      });
    });
    // Toggle variants preview
    document.querySelectorAll('.toggle-variants-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const row = document.getElementById('variantsRow-' + id);
        if (row) {
          const visible = row.style.display !== 'none';
          row.style.display = visible ? 'none' : '';
          btn.innerHTML = visible ? '<i class="fas fa-list"></i> Show' : '<i class="fas fa-list"></i> Hide';
        }
      });
    });
    // Manage variants quick jump
    document.querySelectorAll('.manage-variants-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = parseInt(btn.getAttribute('data-id'), 10);
        const variantsTabBtn = document.getElementById('variantsTabBtn');
        if (variantsTabBtn) variantsTabBtn.click();
        if (typeof fetchItemsWithVariants === 'function') {
          await fetchItemsWithVariants();
          if (typeof selectVariantItem === 'function') selectVariantItem(id);
        }
      });
    });
    // Inline variant edit/delete actions
    document.querySelectorAll('.variant-inline-edit-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const itemId = parseInt(btn.getAttribute('data-item-id'), 10);
        const variantId = parseInt(btn.getAttribute('data-variant-id'), 10);
        if (typeof selectVariantItem === 'function') selectVariantItem(itemId);
        if (typeof openEditVariantModal === 'function') openEditVariantModal(variantId);
      });
    });
    document.querySelectorAll('.variant-inline-delete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const itemId = parseInt(btn.getAttribute('data-item-id'), 10);
        const variantId = parseInt(btn.getAttribute('data-variant-id'), 10);
        if (typeof selectVariantItem === 'function') selectVariantItem(itemId);
        if (typeof deleteVariant === 'function') {
          await deleteVariant(variantId);
          if (typeof fetchProducts === 'function') fetchProducts();
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
      const modalHTML = `
        <div style="background-color: #fff; margin: 5% auto; padding: 0; border-radius: 12px; max-width: 600px; box-shadow: 0 8px 32px rgba(0,0,0,0.3); animation: slideDown 0.3s ease;">
          <div style="background: linear-gradient(135deg, #2a6b52 0%, #1e4d3a 100%); color: white; padding: 1.5rem; border-radius: 12px 12px 0 0; display: flex; justify-content: space-between; align-items: center;">
            <h3 style="margin: 0; font-size: 1.25rem; font-weight: 600; display: flex; align-items: center; gap: 0.5rem;">
              <i class="fas fa-edit"></i> Edit Product
            </h3>
            <button class="close-modal" id="closeEditModal" style="background: rgba(255,255,255,0.2); border: none; color: white; font-size: 1.5rem; cursor: pointer; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: all 0.3s;">&times;</button>
          </div>
          <div style="padding: 2rem; max-height: 70vh; overflow-y: auto;">
            <form id="editProductForm">
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem;">
                <div class="form-group">
                  <label style="font-weight: 600; color: #546e7a; margin-bottom: 0.5rem; display: block;">Product Name <span style="color: #e74c3c;">*</span></label>
                  <input type="text" id="editProductName" class="form-control" value="${product.ItemName}" required style="padding: 0.7rem; border: 1px solid #ddd; border-radius: 8px; width: 100%; font-size: 0.95rem;">
                </div>
                <div class="form-group">
                  <label style="font-weight: 600; color: #546e7a; margin-bottom: 0.5rem; display: block;">
                    Categories <span style="color: #e74c3c;">*</span>
                    <small style="font-weight: 400; color: #7f8c8d;">(Hold Ctrl/Cmd to select multiple)</small>
                  </label>
                  <select id="editProductCategories" class="form-control" multiple required style="padding: 0.7rem; border: 1px solid #ddd; border-radius: 8px; width: 100%; font-size: 0.95rem; min-height: 120px;">
                    ${categories.map(cat => {
                      const isSelected = (product.Categories && product.Categories.some(pc => pc.CategoryID === cat.CategoryID)) 
                        || String(cat.CategoryID) === String(product.CategoryID);
                      return `<option value="${cat.CategoryID}"${isSelected ? ' selected' : ''}>${cat.CategoryName}</option>`;
                    }).join('')}
                  </select>
                </div>
                <div class="form-group">
                  <label style="font-weight: 600; color: #546e7a; margin-bottom: 0.5rem; display: block;">Price <span style="color: #e74c3c;">*</span></label>
                  <input type="number" id="editProductPrice" class="form-control" value="${product.Price}" step="0.01" required style="padding: 0.7rem; border: 1px solid #ddd; border-radius: 8px; width: 100%; font-size: 0.95rem;">
                </div>
                <div class="form-group">
                  <label style="font-weight: 600; color: #546e7a; margin-bottom: 0.5rem; display: block;">
                    Stock Adjustment
                    <span style="color: #7f8c8d; font-weight: 400; font-size: 0.85rem;">(Current: ${product.StockQuantity})</span>
                  </label>
                  <input type="number" id="editProductStock" class="form-control" value="0" required style="padding: 0.7rem; border: 1px solid #ddd; border-radius: 8px; width: 100%; font-size: 0.95rem;" placeholder="Enter amount to add/remove">
                  <small style="color: #7f8c8d; font-size: 0.8rem; margin-top: 0.25rem; display: block;">
                    Positive to add stock, negative to remove
                  </small>
                </div>
                <div class="form-group">
                  <label style="font-weight: 600; color: #546e7a; margin-bottom: 0.5rem; display: block;">
                    Min. Reservation Stock
                    <i class="fas fa-info-circle" title="Minimum stock to keep for walk-ins. Items at or below this will not be available for reservation." style="color: #3498db; cursor: help;"></i>
                  </label>
                  <input type="number" id="editMinReservationStock" class="form-control" value="${product.MinReservationStock || 2}" min="0" required style="padding: 0.7rem; border: 1px solid #ddd; border-radius: 8px; width: 100%; font-size: 0.95rem;">
                  <small style="color: #7f8c8d; font-size: 0.8rem; margin-top: 0.25rem; display: block;">
                    Stock reserved for walk-in customers
                  </small>
                </div>
              </div>
              <div class="form-group" style="margin-top: 1rem;">
                <label style="font-weight: 600; color: #546e7a; margin-bottom: 0.5rem; display: block;">Description</label>
                <textarea id="editProductDescription" class="form-control" rows="3" style="padding: 0.7rem; border: 1px solid #ddd; border-radius: 8px; width: 100%; font-size: 0.95rem; resize: vertical;">${product.Description || ''}</textarea>
              </div>
              <div class="form-group" style="margin-top: 1rem;">
                <label style="font-weight: 600; color: #546e7a; margin-bottom: 0.5rem; display: block;">Product Image</label>
                <input type="file" id="editProductImageInput" accept="image/*" style="padding: 0.5rem; border: 1px solid #ddd; border-radius: 8px; width: 100%; font-size: 0.9rem;">
                <div style="margin-top: 1rem;">
                  <label style="font-weight: 600; color: #546e7a; margin-bottom: 0.5rem; display: block;">Or select from existing images:</label>
                  <div id="existingImagesGallery" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 0.5rem; max-height: 200px; overflow-y: auto; padding: 0.5rem; border: 1px solid #e0e0e0; border-radius: 8px; background: #f9f9f9;">
                    <div style="text-align: center; color: #7f8c8d; padding: 1rem; grid-column: 1 / -1;">Loading images...</div>
                  </div>
                </div>
                <div id="editImagePreview" style="margin-top: 0.75rem;">
                  ${product.ImagePath ? `<img src="${product.ImagePath}" alt="Current product image" style="max-width: 150px; border-radius: 8px; border: 1px solid #ddd;">` : ''}
                </div>
                <input type="hidden" id="selectedExistingImage" value="">
              </div>
              <div style="display: flex; gap: 1rem; justify-content: flex-end; margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid #e0e0e0;">
                <button type="button" class="btn btn-secondary" id="cancelEditModal" style="background: #e0e0e0; color: #546e7a; border: none; padding: 0.7rem 1.5rem; border-radius: 8px; cursor: pointer; font-size: 0.95rem; font-weight: 500;">
                  <i class="fas fa-times" style="margin-right: 0.5rem;"></i>Cancel
                </button>
                <button type="submit" class="btn btn-primary" style="background: linear-gradient(135deg, #2a6b52 0%, #1e4d3a 100%); color: white; border: none; padding: 0.7rem 1.5rem; border-radius: 8px; cursor: pointer; font-size: 0.95rem; font-weight: 500;">
                  <i class="fas fa-save" style="margin-right: 0.5rem;"></i>Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      `;
      
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'editProductModal';
        modal.style.cssText = 'display: none; position: fixed; z-index: 9999; left: 0; top: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.6); backdrop-filter: blur(4px);';
        modal.innerHTML = modalHTML;
        document.body.appendChild(modal);
      } else {
        modal.innerHTML = modalHTML;
      }
      
      modal.style.display = 'block';
      
      // Load existing images gallery
      loadExistingImagesGallery();
      
      // Handle image preview
      const imageInput = document.getElementById('editProductImageInput');
      const imagePreview = document.getElementById('editImagePreview');
      
      if (imageInput) {
        // Remove any existing event listeners by cloning the element
        const newImageInput = imageInput.cloneNode(true);
        imageInput.parentNode.replaceChild(newImageInput, imageInput);
        
        newImageInput.addEventListener('change', function(e) {
          const file = e.target.files[0];
          if (file) {
            // Clear selected existing image
            document.getElementById('selectedExistingImage').value = '';
            document.querySelectorAll('.existing-image-item').forEach(img => {
              img.style.border = '2px solid #ddd';
            });
            
            const reader = new FileReader();
            reader.onload = function(event) {
              const preview = document.getElementById('editImagePreview');
              if (preview) {
                preview.innerHTML = `<img src="${event.target.result}" alt="New product image" style="max-width: 150px; border-radius: 8px; border: 1px solid #ddd;">`;
              }
            };
            reader.readAsDataURL(file);
          }
        });
      }
      
      document.getElementById('closeEditModal').onclick = function() {
        modal.style.display = 'none';
      };
      document.getElementById('cancelEditModal').onclick = function() {
        modal.style.display = 'none';
      };
      document.getElementById('editProductForm').onsubmit = function(e) {
        e.preventDefault();
        saveProductChanges(product.ItemID, product.StockQuantity);
      };
      
      // Close modal when clicking outside
      modal.onclick = function(e) {
        if (e.target === modal) {
          modal.style.display = 'none';
        }
      };
    }
    showModal();
  }

  // Load existing images gallery
  async function loadExistingImagesGallery() {
    const gallery = document.getElementById('existingImagesGallery');
    if (!gallery) return;
    
    try {
      const res = await fetch('/api/products');
      if (!res.ok) throw new Error('Failed to fetch products');
      const products = await res.json();
      
      // Get unique image paths
      const uniqueImages = [...new Set(products
        .filter(p => p.ImagePath)
        .map(p => p.ImagePath))];
      
      if (uniqueImages.length === 0) {
        gallery.innerHTML = '<div style="text-align: center; color: #7f8c8d; padding: 1rem; grid-column: 1 / -1;">No images uploaded yet</div>';
        return;
      }
      
      gallery.innerHTML = uniqueImages.map(imgPath => `
        <div class="existing-image-item" data-image-url="${imgPath}" style="cursor: pointer; border: 2px solid #ddd; border-radius: 6px; overflow: hidden; transition: all 0.2s; aspect-ratio: 1;">
          <img src="${imgPath}" alt="Product image" style="width: 100%; height: 100%; object-fit: cover;">
        </div>
      `).join('');
      
      // Add click handlers
      document.querySelectorAll('.existing-image-item').forEach(item => {
        item.addEventListener('click', function() {
          const imageUrl = this.dataset.imageUrl;
          
          // Clear file input
          const fileInput = document.getElementById('editProductImageInput');
          if (fileInput) fileInput.value = '';
          
          // Update hidden field
          document.getElementById('selectedExistingImage').value = imageUrl;
          
          // Update preview
          const preview = document.getElementById('editImagePreview');
          if (preview) {
            preview.innerHTML = `<img src="${imageUrl}" alt="Selected image" style="max-width: 150px; border-radius: 8px; border: 1px solid #ddd;">`;
          }
          
          // Update visual selection
          document.querySelectorAll('.existing-image-item').forEach(img => {
            img.style.border = '2px solid #ddd';
          });
          this.style.border = '2px solid #2a6b52';
          this.style.boxShadow = '0 0 0 2px rgba(42, 107, 82, 0.2)';
        });
        
        // Hover effect
        item.addEventListener('mouseenter', function() {
          if (this.style.border !== '2px solid #2a6b52') {
            this.style.border = '2px solid #27ae60';
          }
        });
        item.addEventListener('mouseleave', function() {
          if (this.style.border !== '2px solid #2a6b52') {
            this.style.border = '2px solid #ddd';
          }
        });
      });
    } catch (err) {
      console.error('Error loading existing images:', err);
      gallery.innerHTML = '<div style="text-align: center; color: #e74c3c; padding: 1rem; grid-column: 1 / -1;">Error loading images</div>';
    }
  }

  // Save product changes to DB
  async function saveProductChanges(itemId, currentStock) {
    const submitBtn = document.querySelector('#editProductForm button[type="submit"]');
    const originalBtnHTML = submitBtn ? submitBtn.innerHTML : '';
    
    try {
      // Show loading state
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-right: 0.5rem;"></i>Saving...';
        submitBtn.style.opacity = '0.7';
      }
      
      const stockAdjustment = parseInt(document.getElementById('editProductStock').value) || 0;
      const newStockQuantity = currentStock + stockAdjustment;
      
      if (newStockQuantity < 0) {
        alert('Stock quantity cannot be negative. Current stock: ' + currentStock + ', Adjustment: ' + stockAdjustment);
        return;
      }
      
      // Check if existing image was selected
      const selectedExistingImage = document.getElementById('selectedExistingImage').value;
      let imagePath = selectedExistingImage || null;
      
      // Get the image input (use getElementById to get the current element in DOM)
      const imageInput = document.getElementById('editProductImageInput');
      
      // Upload new image if selected (and no existing image was selected)
      if (!selectedExistingImage && imageInput && imageInput.files && imageInput.files.length > 0) {
        // Update button to show uploading
        if (submitBtn) {
          submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-right: 0.5rem;"></i>Uploading image...';
        }
        try {
          const formData = new FormData();
          formData.append('image', imageInput.files[0]);
          
          const imgbbRes = await fetch('/client-config');
          const config = await imgbbRes.json();
          const imgbbKey = config.imgbbKey || '';
          
          if (imgbbKey) {
            const uploadRes = await fetch(`https://api.imgbb.com/1/upload?key=${imgbbKey}`, {
              method: 'POST',
              body: formData
            });
            const uploadData = await uploadRes.json();
            if (uploadData.success) {
              imagePath = uploadData.data.url;
            } else {
              console.error('ImgBB upload failed:', uploadData);
              alert('Failed to upload image. Please try again.');
              return;
            }
          } else {
            alert('Image upload is not configured.');
            return;
          }
        } catch (err) {
          console.error('Error uploading image:', err);
          alert('Error uploading image. Please try again.');
          return;
        }
      }
    
    const categoriesSelect = document.getElementById('editProductCategories');
    const selectedCategories = categoriesSelect ? Array.from(categoriesSelect.selectedOptions).map(opt => parseInt(opt.value, 10)) : [];
    
    if (selectedCategories.length === 0) {
      alert('Please select at least one category');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnHTML;
        submitBtn.style.opacity = '1';
      }
      return;
    }
    
    const payload = {
      ItemName: document.getElementById('editProductName').value.trim(),
      CategoryIDs: selectedCategories,
      Price: document.getElementById('editProductPrice').value,
      StockQuantity: newStockQuantity,
      Description: document.getElementById('editProductDescription').value.trim(),
      MinReservationStock: parseInt(document.getElementById('editMinReservationStock').value) || 2,
      AdminID: null // Optionally set admin ID
    };
    
    if (imagePath) {
      payload.ImagePath = imagePath;
    }
    
    // Update button to show saving
    if (submitBtn) {
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-right: 0.5rem;"></i>Saving changes...';
    }
    
    try {
      const res = await fetch(`/api/products/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data && data.success) {
        // Show success state briefly
        if (submitBtn) {
          submitBtn.innerHTML = '<i class="fas fa-check" style="margin-right: 0.5rem;"></i>Saved!';
          submitBtn.style.background = 'linear-gradient(135deg, #27ae60 0%, #229954 100%)';
        }
        
        setTimeout(() => {
          alert('Product updated successfully!');
          document.getElementById('editProductModal').style.display = 'none';
          fetchProducts();
        }, 500);
      } else {
        alert('Failed to update product.');
        console.error('Update product response:', data);
      }
    } catch (err) {
      alert('Error updating product. See console for details.');
      console.error('Error updating product:', err);
    } finally {
      // Restore button state
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnHTML;
        submitBtn.style.opacity = '1';
        submitBtn.style.background = 'linear-gradient(135deg, #2a6b52 0%, #1e4d3a 100%)';
      }
    }
    } catch (err) {
      // Catch for outer try block
      console.error('Error in saveProductChanges:', err);
      alert('Error saving product. Please try again.');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnHTML;
        submitBtn.style.opacity = '1';
        submitBtn.style.background = 'linear-gradient(135deg, #2a6b52 0%, #1e4d3a 100%)';
      }
    }
  }
  
  // Legacy deleteProduct removed; using activate/deactivate instead
  } catch (err) {
    console.error('Error fetching products:', err);
    console.error('Error message:', err.message);
    console.error('Error stack:', err.stack);
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:2rem">Failed to load products: ' + err.message + '</td></tr>';
  }
}

async function initInventory() {
  console.log('initInventory() called');
  // Fetch client config (imgbb key) for image uploads
  let _imgbbKey = '';
  try {
    const cfgRes = await fetch('/client-config');
    if (cfgRes.ok) {
      const cfg = await cfgRes.json();
      _imgbbKey = cfg.imgbbKey || '';
    }
  } catch (err) {
    console.warn('Could not fetch client config for imgbb:', err && err.message);
  }
  // Refresh product list whenever variants are changed elsewhere
  try {
    window.addEventListener('variant-updated', () => {
      if (typeof fetchProducts === 'function') fetchProducts();
    });
  } catch (_) {}
  
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

  // Populate categories in add product form
  async function populateAddProductCategories() {
    try {
      const response = await fetch('/api/categories');
      if (response.ok) {
        const categories = await response.json();
        const select = document.getElementById('productCategories');
        if (select && Array.isArray(categories)) {
          select.innerHTML = categories.map(cat => 
            `<option value="${cat.CategoryID}">${cat.CategoryName}</option>`
          ).join('');
        }
      }
    } catch (err) {
      console.error('Error loading categories:', err);
    }
  }

  // Add product form submission
  const addProductForm = document.getElementById('addProductForm');
  if (addProductForm) {
    addProductForm.addEventListener('submit', function (e) {
      e.preventDefault();

      const name = document.getElementById('productName')?.value.trim();
      const categoriesSelect = document.getElementById('productCategories');
      const selectedCategories = categoriesSelect ? Array.from(categoriesSelect.selectedOptions).map(opt => opt.value) : [];
      const price = document.getElementById('productPrice')?.value;
      const stock = document.getElementById('productStock')?.value;
      const minReservationStock = document.getElementById('productMinReservationStock')?.value;
      const imageInput = document.getElementById('productImageInput');
      const description = document.getElementById('productDescription')?.value.trim();

      if (!name) {
        alert('Please enter product name');
        return;
      }
      if (selectedCategories.length === 0) {
        alert('Please select at least one category');
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
      // Build payload
      const payload = {
        ItemName: name,
        CategoryIDs: selectedCategories,
        Price: parseFloat(price) || 0.0,
        StockQuantity: parseInt(stock, 10) || 0,
        MinReservationStock: parseInt(minReservationStock, 10) || 2,
        Description: description || null,
        ImagePath: null,
      };

      // If image selected and we have an imgbb key, upload to imgbb first
      const file = imageInput && imageInput.files && imageInput.files[0] ? imageInput.files[0] : null;
      async function uploadToImgbb(file, key) {
        // Read file as base64
        const dataUrl = await new Promise((resolve, reject) => {
          const fr = new FileReader();
          fr.onload = () => resolve(fr.result);
          fr.onerror = reject;
          fr.readAsDataURL(file);
        });
        const base64 = dataUrl.split(',')[1];
        const form = new URLSearchParams();
        form.append('key', key);
        form.append('image', base64);
        const resp = await fetch('https://api.imgbb.com/1/upload', { method: 'POST', body: form });
        const json = await resp.json();
        if (!json || !json.success) throw new Error((json && json.error && json.error.message) || 'imgbb upload failed');
        return json.data.url;
      }

      (async () => {
        try {
          if (file) {
            if (!_imgbbKey) {
              alert('Image selected but imgbb is not configured on server. Upload skipped.');
            } else {
              // show small uploading indicator
              const submitBtn = addProductForm.querySelector('button[type="submit"]');
              const origText = submitBtn ? submitBtn.innerText : null;
              if (submitBtn) { submitBtn.disabled = true; submitBtn.innerText = 'Uploading image...'; }
              try {
                const url = await uploadToImgbb(file, _imgbbKey);
                payload.ImagePath = url;
              } finally {
                if (submitBtn) { submitBtn.disabled = false; if (origText) submitBtn.innerText = origText; }
              }
            }
          }

          console.log('Posting product payload:', payload);
          const res = await fetch('/api/products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const data = await res.json();
          if (data && data.success) {
            alert('Product "' + name + '" added successfully!');
            addProductForm.reset();
            const previewDiv = document.getElementById('imagePreview');
            if (previewDiv) previewDiv.innerHTML = '';
            if (typeof fetchProducts === 'function') fetchProducts();
            const hasVariants = document.getElementById('hasVariantsCheckbox')?.checked;
            if (hasVariants && data.product && data.product.ItemID) {
              const variantsBtn = document.getElementById('variantsTabBtn');
              if (variantsBtn) variantsBtn.click();
              if (typeof fetchItemsWithVariants === 'function') {
                fetchItemsWithVariants().then(() => {
                  if (typeof selectVariantItem === 'function') {
                    selectVariantItem(data.product.ItemID);
                  }
                });
              }
            }
          } else {
            alert('Failed to add product.');
            console.error('Create product response:', data);
          }
        } catch (err) {
          console.error('Error creating product:', err);
          alert('Error creating product. See console for details.');
        }
      })();
    });
  }

  // load products into table on init
  if (typeof fetchProducts === 'function') fetchProducts();

  // ================= CSV Batch Upload =================
  initCsvUpload();
}

function initCsvUpload() {
  const downloadTemplateBtn = document.getElementById('downloadTemplateBtn');
  const csvFileInput = document.getElementById('csvFileInput');
  const uploadCsvBtn = document.getElementById('uploadCsvBtn');
  const cancelCsvUploadBtn = document.getElementById('cancelCsvUploadBtn');

  let parsedCsvData = null;

  // Download CSV Template
  if (downloadTemplateBtn) {
    downloadTemplateBtn.addEventListener('click', () => {
      const headers = ['ItemName', 'CategoryID', 'Price', 'StockQuantity', 'Description', 'ImagePath', 'Variants'];
      const sample1 = ['Sample Product 1', '1', '99.99', '50', 'Sample description for product 1', 'https://example.com/image1.jpg', 'S:95.00:20|M:99.99:30|L:105.00:25'];
      const sample2 = ['Sample Product 2', '2', '149.50', '25', 'Sample description for product 2', '', 'Small:149.50:15|Medium:149.50:10'];
      
      const csvContent = headers.join(',') + '\n' + 
                         sample1.join(',') + '\n' +
                         sample2.join(',');
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'product_upload_template.csv';
      link.click();
      URL.revokeObjectURL(url);
    });
  }

  // Handle CSV File Selection
  if (csvFileInput) {
    csvFileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) {
        resetCsvUpload();
        return;
      }

      try {
        const text = await file.text();
        const parsed = parseCSV(text);
        
        if (parsed.length === 0) {
          alert('CSV file is empty or invalid');
          resetCsvUpload();
          return;
        }

        parsedCsvData = parsed;
        displayCsvPreview(parsed);
        
        // Show action buttons
        if (uploadCsvBtn) uploadCsvBtn.style.display = 'inline-block';
        if (cancelCsvUploadBtn) cancelCsvUploadBtn.style.display = 'inline-block';
        
      } catch (err) {
        console.error('Error reading CSV:', err);
        alert('Failed to read CSV file. Please check the format.');
        resetCsvUpload();
      }
    });
  }

  // Handle Upload Button
  if (uploadCsvBtn) {
    uploadCsvBtn.addEventListener('click', async () => {
      if (!parsedCsvData || parsedCsvData.length === 0) {
        alert('No valid data to upload');
        return;
      }

      try {
        // Show progress
        const progressSection = document.getElementById('csvUploadProgress');
        const progressBar = document.getElementById('csvProgressBar');
        const progressText = document.getElementById('csvProgressText');
        
        if (progressSection) progressSection.style.display = 'block';
        if (progressBar) progressBar.style.width = '0%';
        if (progressText) progressText.textContent = 'Uploading...';

        // Disable buttons
        uploadCsvBtn.disabled = true;
        cancelCsvUploadBtn.disabled = true;

        const res = await fetch('/api/products/batch-upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ products: parsedCsvData })
        });

        const data = await res.json();

        if (progressBar) progressBar.style.width = '100%';

        if (data.success) {
          if (progressText) {
            progressText.textContent = `Upload complete! ${data.results.successful} successful, ${data.results.failed} failed`;
          }

          // Display results
          displayUploadResults(data.results);

          // Refresh product list
          setTimeout(() => {
            if (typeof fetchProducts === 'function') fetchProducts();
            resetCsvUpload();
          }, 3000);

        } else {
          alert('Upload failed: ' + (data.error || 'Unknown error'));
          if (progressSection) progressSection.style.display = 'none';
          uploadCsvBtn.disabled = false;
          cancelCsvUploadBtn.disabled = false;
        }

      } catch (err) {
        console.error('Error uploading CSV:', err);
        alert('Failed to upload products. See console for details.');
        const progressSection = document.getElementById('csvUploadProgress');
        if (progressSection) progressSection.style.display = 'none';
        uploadCsvBtn.disabled = false;
        cancelCsvUploadBtn.disabled = false;
      }
    });
  }

  // Handle Cancel Button
  if (cancelCsvUploadBtn) {
    cancelCsvUploadBtn.addEventListener('click', () => {
      resetCsvUpload();
    });
  }

  function parseCSV(text) {
    const lines = text.split('\n').filter(line => line.trim() !== '');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim());
    const products = [];

    // Expected headers
    const expectedHeaders = ['ItemName', 'CategoryID', 'Price', 'StockQuantity', 'Description', 'ImagePath'];
    
    // Validate headers
    const hasRequiredHeaders = ['ItemName', 'Price', 'StockQuantity'].every(h => 
      headers.some(header => header.toLowerCase() === h.toLowerCase())
    );

    if (!hasRequiredHeaders) {
      alert('CSV must contain at least: ItemName, Price, StockQuantity');
      return [];
    }

    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length === 0) continue;

      const product = {};
      headers.forEach((header, index) => {
        const value = values[index] || '';
        product[header] = value.trim();
      });

      // Validate required fields
      if (product.ItemName && product.Price && product.StockQuantity) {
        products.push(product);
      }
    }

    return products;
  }

  function parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current);

    return values.map(v => v.replace(/^"|"$/g, '').trim());
  }

  function displayCsvPreview(products) {
    const previewSection = document.getElementById('csvPreviewSection');
    const tableBody = document.getElementById('csvPreviewTableBody');
    const rowCount = document.getElementById('csvRowCount');
    const validationMessages = document.getElementById('csvValidationMessages');

    if (!previewSection || !tableBody) return;

    // Show preview section
    previewSection.style.display = 'block';
    if (rowCount) rowCount.textContent = products.length;

    // Build preview table
    let html = '';
    products.forEach((product, index) => {
      const isValid = product.ItemName && product.Price && product.StockQuantity;
      const statusColor = isValid ? '#27ae60' : '#e74c3c';
      const statusText = isValid ? 'Valid' : 'Invalid';
      
      html += `
        <tr style="border-bottom: 1px solid #eee;">
          <td style="padding: 0.75rem;">${index + 1}</td>
          <td style="padding: 0.75rem;">${product.ItemName || '<em>Missing</em>'}</td>
          <td style="padding: 0.75rem;">${product.CategoryID || 'N/A'}</td>
          <td style="padding: 0.75rem;">₱${product.Price || '<em>Missing</em>'}</td>
          <td style="padding: 0.75rem;">${product.StockQuantity || '<em>Missing</em>'}</td>
          <td style="padding: 0.75rem;">
            <span style="background: ${statusColor}; color: white; padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.75rem; font-weight: 600;">
              ${statusText}
            </span>
          </td>
        </tr>
      `;
    });
    tableBody.innerHTML = html;

    // Show validation summary
    const validCount = products.filter(p => p.ItemName && p.Price && p.StockQuantity).length;
    const invalidCount = products.length - validCount;

    if (validationMessages) {
      if (invalidCount > 0) {
        validationMessages.innerHTML = `
          <div style="background: #fff3cd; border-left: 4px solid #f39c12; padding: 1rem 1.25rem; border-radius: 8px;">
            <p style="margin: 0; color: #856404; font-weight: 600;">
              <i class="fas fa-exclamation-triangle" style="margin-right: 0.5rem;"></i>
              Warning: ${invalidCount} invalid ${invalidCount === 1 ? 'row' : 'rows'} will be skipped
            </p>
            <p style="margin: 0.5rem 0 0 0; color: #856404; font-size: 0.9rem;">
              ${validCount} valid ${validCount === 1 ? 'product' : 'products'} will be uploaded
            </p>
          </div>
        `;
        validationMessages.style.display = 'block';
      } else {
        validationMessages.innerHTML = `
          <div style="background: #d4edda; border-left: 4px solid #27ae60; padding: 1rem 1.25rem; border-radius: 8px;">
            <p style="margin: 0; color: #155724; font-weight: 600;">
              <i class="fas fa-check-circle" style="margin-right: 0.5rem;"></i>
              All ${validCount} ${validCount === 1 ? 'product is' : 'products are'} valid and ready to upload
            </p>
          </div>
        `;
        validationMessages.style.display = 'block';
      }
    }
  }

  function displayUploadResults(results) {
    const validationMessages = document.getElementById('csvValidationMessages');
    if (!validationMessages) return;

    let html = `
      <div style="background: #d4edda; border-left: 4px solid #27ae60; padding: 1rem 1.25rem; border-radius: 8px; margin-bottom: 1rem;">
        <p style="margin: 0; color: #155724; font-weight: 600;">
          <i class="fas fa-check-circle" style="margin-right: 0.5rem;"></i>
          Upload Complete!
        </p>
        <p style="margin: 0.5rem 0 0 0; color: #155724; font-size: 0.9rem;">
          Successfully uploaded: ${results.successful} products
        </p>
      </div>
    `;

    if (results.failed > 0) {
      html += `
        <div style="background: #f8d7da; border-left: 4px solid #e74c3c; padding: 1rem 1.25rem; border-radius: 8px;">
          <p style="margin: 0; color: #721c24; font-weight: 600;">
            <i class="fas fa-times-circle" style="margin-right: 0.5rem;"></i>
            Failed: ${results.failed} products
          </p>
          <details style="margin-top: 0.5rem;">
            <summary style="cursor: pointer; color: #721c24; font-size: 0.9rem;">View errors</summary>
            <ul style="margin: 0.5rem 0 0 1.5rem; padding: 0; color: #721c24; font-size: 0.85rem;">
              ${results.failedItems.map(item => `<li>Row ${item.row}: ${item.error}</li>`).join('')}
            </ul>
          </details>
        </div>
      `;
    }

    validationMessages.innerHTML = html;
    validationMessages.style.display = 'block';
  }

  function resetCsvUpload() {
    parsedCsvData = null;
    
    if (csvFileInput) csvFileInput.value = '';
    if (uploadCsvBtn) uploadCsvBtn.style.display = 'none';
    if (cancelCsvUploadBtn) cancelCsvUploadBtn.style.display = 'none';
    
    const previewSection = document.getElementById('csvPreviewSection');
    const validationMessages = document.getElementById('csvValidationMessages');
    const progressSection = document.getElementById('csvUploadProgress');
    
    if (previewSection) previewSection.style.display = 'none';
    if (validationMessages) validationMessages.style.display = 'none';
    if (progressSection) progressSection.style.display = 'none';
    
    const tableBody = document.getElementById('csvPreviewTableBody');
    if (tableBody) tableBody.innerHTML = '';

    // Re-enable buttons
    if (uploadCsvBtn) uploadCsvBtn.disabled = false;
    if (cancelCsvUploadBtn) cancelCsvUploadBtn.disabled = false;
  }
}

function removeImage() {
  const input = document.getElementById('productImageInput');
  if (input) input.value = '';
  const preview = document.getElementById('imagePreview');
  if (preview) preview.innerHTML = '';
}

// Load global settings
async function loadGlobalSettings() {
  try {
    const response = await fetch('/api/config/global_min_reservation_stock');
    if (response.ok) {
      const data = await response.json();
      const input = document.getElementById('globalMinReservationStock');
      if (input && data.ConfigValue) {
        input.value = data.ConfigValue;
      }
    }
  } catch (err) {
    console.error('Error loading global settings:', err);
  }
}

// Save global settings
async function saveGlobalSettings() {
  const btn = document.getElementById('saveGlobalSettingsBtn');
  const input = document.getElementById('globalMinReservationStock');
  const originalBtnHTML = btn ? btn.innerHTML : '';
  
  if (!input) return;
  
  try {
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-right: 0.5rem;"></i>Saving...';
    }
    
    const value = parseInt(input.value, 10) || 0;
    
    const response = await fetch('/api/config/global_min_reservation_stock', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: value })
    });
    
    const data = await response.json();
    
    if (data.success) {
      if (btn) {
        btn.innerHTML = '<i class="fas fa-check" style="margin-right: 0.5rem;"></i>Saved!';
        btn.style.background = 'linear-gradient(135deg, #27ae60 0%, #229954 100%)';
      }
      
      setTimeout(() => {
        alert('Global minimum reservation stock updated successfully!');
        if (btn) {
          btn.innerHTML = originalBtnHTML;
          btn.style.background = 'linear-gradient(135deg, #f39c12 0%, #e67e22 100%)';
          btn.disabled = false;
        }
      }, 500);
    } else {
      alert('Failed to save setting.');
      if (btn) {
        btn.innerHTML = originalBtnHTML;
        btn.disabled = false;
      }
    }
  } catch (err) {
    console.error('Error saving global settings:', err);
    alert('Error saving setting. Please try again.');
    if (btn) {
      btn.innerHTML = originalBtnHTML;
      btn.disabled = false;
    }
  }
}

document.addEventListener('DOMContentLoaded', function() {
  initInventory();
  loadGlobalSettings();
  populateAddProductCategories();
  
  // Attach save button handler
  const saveGlobalBtn = document.getElementById('saveGlobalSettingsBtn');
  if (saveGlobalBtn) {
    saveGlobalBtn.addEventListener('click', saveGlobalSettings);
  }
});
