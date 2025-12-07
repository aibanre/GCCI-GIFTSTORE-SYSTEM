# Quick Reference Guide - Refactored GCCI Giftstore

## 📋 File Locations

### CSS Files
| File | Purpose |
|------|---------|
| `/public/css/common.css` | Shared utilities, buttons, forms, tables |
| `/public/css/dashboard.css` | Admin dashboard layout and components |
| `/public/css/pos.css` | Point of Sale interface styles |
| `/public/css/header.css` | Header navigation styles |
| `/public/css/home.css` | Home page basic styles |

### JavaScript Modules
| File | Purpose | Functions |
|------|---------|-----------|
| `/public/js/dashboard.js` | Navigation logic | `initDashboardNavigation()` |
| `/public/js/tabs.js` | Tab switching | `initTabs()` |
| `/public/js/stats.js` | Dashboard stats | `loadDashboardStats()` |
| `/public/js/categories.js` | Category CRUD | `addCategory()`, `deleteCategory()`, `editCategory()` |
| `/public/js/inventory.js` | Product management | `initInventory()`, `removeImage()` |
| `/public/js/pos.js` | POS system | `addToCart()`, `completePurchase()`, `clearCart()` |

### Views
| File | Purpose |
|------|---------|
| `views/AdminDashboard.ejs` | Main admin interface |
| `views/AdminLogin.html` | Admin login page |
| `views/home.html` | Home/catalog page |
| `views/GiftstoreCatalog.html` | Product catalog |

## 🎯 How to Use

### Adding a New Feature to Dashboard

1. **Create new CSS** in appropriate file:
```css
/* public/css/dashboard.css */
.my-new-component {
  /* styles */
}
```

2. **Create new JS module** if needed:
```javascript
// public/js/my-feature.js
function initMyFeature() {
  // Your logic
}
document.addEventListener('DOMContentLoaded', initMyFeature);
```

3. **Add HTML** to AdminDashboard.ejs:
```html
<div id="myFeatureSection" class="hidden">
  <!-- Your markup -->
</div>
```

4. **Link JS in AdminDashboard.ejs**:
```html
<script src="/js/my-feature.js"></script>
```

### Adding Utility Classes

Need a new common style? Add to `common.css`:

```css
.my-utility-class {
  property: value;
}
```

Then use in HTML:
```html
<div class="my-utility-class">Content</div>
```

### Hiding/Showing Elements

**Before (❌ Don't do this):**
```html
<div style="display: none;">Hidden</div>
```

**After (✅ Do this):**
```html
<div class="hidden">Hidden</div>

<script>
element.classList.add('hidden');    // Hide
element.classList.remove('hidden');  // Show
</script>
```

### Fetching Data from API

```javascript
async function loadData() {
  try {
    const response = await fetch('/api/products');
    if (!response.ok) throw new Error('Failed to fetch');
    const data = await response.json();
    // Use data
  } catch (error) {
    console.error('Error:', error);
    // Fallback
  }
}
```

### Available API Endpoints

| Endpoint | Method | Returns |
|----------|--------|---------|
| `/api/stats` | GET | Dashboard statistics |
| `/api/products` | GET | Product list |
| `/api/categories` | GET | Category list |
| `/api/reservations` | GET | Reservation list |

## 🔧 Styling Guidelines

### Use Semantic HTML
```html
<!-- ✅ Good -->
<button class="btn btn-primary">Click me</button>

<!-- ❌ Avoid -->
<span style="background: blue; color: white;">Click me</span>
```

### Use CSS Classes Instead of Inline Styles
```html
<!-- ✅ Good -->
<div class="hidden">Hidden content</div>

<!-- ❌ Avoid -->
<div style="display: none;">Hidden content</div>
```

### Component Naming Convention
- Use hyphenated names: `.card-header`, `.cart-item`
- Use semantic prefixes: `.btn-`, `.form-`, `.pos-`
- Avoid generic names: `.box`, `.container` (use specific ones)

## 🚀 Common Tasks

### Hide/Show a Section
```javascript
const section = document.getElementById('mySection');
section.classList.add('hidden');    // Hide
section.classList.remove('hidden');  // Show
section.classList.toggle('hidden');  // Toggle
```

### Add Event Listener to Dynamic Element
```javascript
document.addEventListener('click', (e) => {
  if (e.target.matches('.my-button')) {
    // Handle click
  }
});
```

### Escape HTML (Prevent XSS)
```javascript
function escapeHtml(text) {
  const map = {
    '&': '&amp;', '<': '&lt;', '>': '&gt;',
    '"': '&quot;', "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}
```

### Update Multiple Stats
```javascript
const stats = { totalProducts: 100, pending: 5 };
document.querySelector('[data-stat="totalProducts"]').textContent = stats.totalProducts;
document.querySelector('[data-stat="pending"]').textContent = stats.pending;
```

## 📱 Responsive Design

Mobile breakpoints are in CSS files:

```css
/* Tablet and below */
@media (max-width: 768px) {
  .dashboard-container { flex-direction: column; }
}

/* Mobile and below */
@media (max-width: 480px) {
  .form-group { margin-bottom: 1rem; }
}
```

## 🐛 Debugging

1. **Check CSS loads**: Network tab → `/css/` files should be 200
2. **Check JS loads**: Network tab → `/js/` files should be 200
3. **Console errors**: F12 → Console tab for JavaScript errors
4. **Inspect elements**: Right-click → Inspect to see final CSS
5. **API calls**: Network tab → XHR filter to see fetch requests

## ✅ Before Deploying

- [ ] All CSS files load (Network: 200)
- [ ] All JS files load (Network: 200)
- [ ] No console errors (F12)
- [ ] No inline styles in HTML (except <style> tags)
- [ ] Dashboard stats load correctly
- [ ] POS cart works
- [ ] Categories can be added/deleted
- [ ] No hardcoded data visible to users

---

**Questions?** Check REFACTORING_SUMMARY.md for detailed information.
