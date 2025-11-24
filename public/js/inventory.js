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
        console.log('Mapping product:', p.ItemName);
        return `
        <tr>
          <td>${String(p.ItemName || '')}</td>
          <td>${String(p.CategoryID || '')}</td>
          <td>${String(p.Price || '')}</td>
          <td>${String(p.StockQuantity || '')}</td>
          <td>
            <button class="btn btn-sm btn-secondary" data-id="${p.ItemID}">Edit</button>
            <button class="btn btn-sm btn-danger" data-id="${p.ItemID}">Delete</button>
          </td>
        </tr>
      `;
      })
      .join('');
    console.log('Rendered', products.length, 'products successfully');
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
