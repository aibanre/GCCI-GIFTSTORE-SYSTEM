// Category Management Logic

let categories = [];

async function fetchCategories() {
  try {
    const response = await fetch('/api/categories');
    if (!response.ok) throw new Error('Failed to fetch categories');
    categories = await response.json();
    renderCategories();
    populateProductCategorySelect();
  } catch (error) {
    console.error('Error fetching categories:', error);
    // Fallback to sample data
    categories = [
      {
        id: 1,
        name: 'Books',
        description: 'School books and learning materials',
        itemsCount: 12,
      },
      {
        id: 2,
        name: 'Uniform',
        description: 'School uniforms for all grade levels',
        itemsCount: 8,
      },
      {
        id: 3,
        name: 'College',
        description: 'College-specific items and merchandise',
        itemsCount: 5,
      },
    ];
    renderCategories();
    populateProductCategorySelect();
  }
}

// Handle category form submission (uses fetch to POST to server)
async function handleCategoryFormSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const nameInput = form.querySelector('#categoryName');
  const descInput = form.querySelector('#categoryDescription');

  if (!nameInput || !nameInput.value.trim()) {
    alert('Please enter a category name');
    return;
  }

  const payload = { CategoryName: nameInput.value.trim() };
  try {
    const res = await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      nameInput.value = '';
      if (descInput) descInput.value = '';
      alert('Category added successfully');
      await fetchCategories();
    } else {
      console.error('Failed to create category', data);
      alert('Failed to create category');
    }
  } catch (err) {
    console.error('Error creating category:', err);
    alert('Error creating category');
  }
}

function deleteCategory(categoryId) {
  if (confirm('Are you sure you want to delete this category?')) {
    fetch(`/api/categories/${categoryId}`, { method: 'DELETE' })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          alert('Category deleted');
          fetchCategories();
        } else {
          alert('Failed to delete category: ' + (data.error || 'Unknown error'));
          console.error('Delete response:', data);
        }
      })
      .catch((err) => {
        console.error('Error deleting category:', err);
        alert('Error deleting category');
      });
  }
}

function editCategory(categoryId) {
  const category = categories.find((c) => (c.CategoryID || c.id) === categoryId);
  if (!category) {
    alert('Category not found');
    return;
  }

  const newName = prompt('Edit category name:', category.CategoryName || category.name);
  if (!newName || !newName.trim()) {
    return; // User cancelled or entered empty
  }

  fetch(`/api/categories/${categoryId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ CategoryName: newName.trim() }),
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.success) {
        alert('Category updated');
        fetchCategories();
      } else {
        alert('Failed to update category: ' + (data.error || 'Unknown error'));
        console.error('Update response:', data);
      }
    })
    .catch((err) => {
      console.error('Error updating category:', err);
      alert('Error updating category');
    });
}

function renderCategories() {
  const tbody = document.getElementById('categoriesTableBody');
  if (!tbody) return;

  tbody.innerHTML = categories
    .map((cat) => {
      const id = cat.CategoryID || cat.id;
      const name = cat.CategoryName || cat.name || '';
      const itemsCount = cat.itemsCount || 0;
      return `
      <tr>
        <td>${escapeHtml(name)}</td>
        <td>${id}</td>
        <td>${itemsCount}</td>
        <td>
          <button class="btn btn-warning btn-sm" onclick="editCategory(${id})"><i class="fas fa-edit"></i> Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteCategory(${id})"><i class="fas fa-trash"></i> Delete</button>
        </td>
      </tr>
    `;
    })
    .join('');
}

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

// Initialize
document.addEventListener('DOMContentLoaded', fetchCategories);

// Attach category form handler
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('addCategoryForm');
  if (form) form.addEventListener('submit', handleCategoryFormSubmit);
});

// Populate product category select used in Add Product form
function populateProductCategorySelect() {
  const select = document.getElementById('productCategory');
  if (!select) return;
  // Clear existing options but keep first 'Select a category'
  const firstOption = select.options[0];
  select.innerHTML = '';
  if (firstOption) select.appendChild(firstOption);
  categories.forEach((c) => {
    const opt = document.createElement('option');
    opt.value = c.CategoryID || c.id;
    opt.textContent = c.CategoryName || c.name;
    select.appendChild(opt);
  });
}
