# Testing Guide - Refactored GCCI Giftstore

## Pre-Testing Checklist

- [ ] Server is running: `node server.js`
- [ ] No console errors in terminal
- [ ] Browser DevTools available (F12)

---

## 1. Page Load Test

### Steps:
1. Navigate to `http://localhost:3000/AdminDashboard`
2. Page should load without errors
3. Check browser console (F12 → Console tab)

### Expected Results:
- ✅ Page displays properly
- ✅ No red errors in console
- ✅ No 404 errors for assets
- ✅ Dashboard stats visible (124, 18, 7, 56)

---

## 2. Network Tab Test

### Steps:
1. Press F12 → Network tab
2. Reload page (Ctrl+R or Cmd+R)
3. Check all requests

### Expected Results:
| Resource | Status | Size |
|----------|--------|------|
| AdminDashboard.ejs | 200 | ~20KB |
| common.css | 200 | ~5KB |
| dashboard.css | 200 | ~4KB |
| pos.css | 200 | ~3KB |
| header.css | 200 | ~3KB |
| dashboard.js | 200 | ~2KB |
| tabs.js | 200 | ~1KB |
| stats.js | 200 | ~1KB |
| categories.js | 200 | ~2KB |
| inventory.js | 200 | ~1KB |
| pos.js | 200 | ~5KB |
| api/stats | 200 | ~200B |

**All should return 200 status** ✅

---

## 3. CSS Loading Test

### Steps:
1. Right-click on page → Inspect
2. Select any element
3. Check Styles panel
4. Verify CSS rules are applied

### Expected Results:
- ✅ Styles are applied correctly
- ✅ No inline `style="..."` attributes
- ✅ Classes like `.hidden`, `.btn-primary` work
- ✅ Colors match design

### Check for Classes:
```
✅ .dashboard-container
✅ .admin-sidebar
✅ .admin-nav
✅ .main-content
✅ .stat-card
✅ .hidden
✅ .btn
✅ .btn-primary
```

---

## 4. JavaScript Functionality Test

### 4.1 Navigation Test

**Steps:**
1. Click "POS System" in sidebar
2. Dashboard should hide, POS should show
3. Click "Inventory" in sidebar
4. POS should hide, Inventory should show

**Expected Results:**
- ✅ Sections toggle correctly
- ✅ No console errors
- ✅ Active state follows navigation

### 4.2 Tab Switching Test

**Steps:**
1. Go to Inventory section
2. Click "Product List" tab
3. Content should show
4. Click "Add New Product" tab
5. Different content should show
6. Click "Categories" tab
7. Categories content should show

**Expected Results:**
- ✅ Tabs switch smoothly
- ✅ Only one tab content visible at a time
- ✅ Active tab shows styling

### 4.3 Category Management Test

**Steps:**
1. Go to Inventory → Categories tab
2. Check if categories load:
   - Books
   - Uniform
   - College
3. Fill in "Category Name": "Test Category"
4. Fill in "Description": "A test category"
5. Click "Add Category"
6. Verify success message appears
7. Check if new category appears in table
8. Click Edit button on any category
9. Edit name and save
10. Click Delete button
11. Confirm deletion

**Expected Results:**
- ✅ Categories load from API
- ✅ Can add new category
- ✅ Can edit category
- ✅ Can delete category
- ✅ All operations show confirmation
- ✅ Table updates immediately

### 4.4 POS System Test

**Steps:**
1. Go to POS System section
2. Verify products load:
   - Sample Product (₱999.99)
   - Book Set (₱599.99)
   - Uniform (S) (₱1,299.99)
3. Click "Add" button on any product
4. Verify item appears in cart
5. Increase quantity using + button
6. Decrease quantity using - button
7. Type number in quantity field
8. Verify total updates
9. Click Remove (trash icon)
10. Item should disappear from cart
11. Add multiple items
12. Click "Complete Purchase"
13. Receipt should appear
14. Click "Print Slip" (triggers print)
15. Click "New Purchase"
16. Cart should clear

**Expected Results:**
- ✅ Products load from API
- ✅ Items add to cart
- ✅ Quantity can be adjusted
- ✅ Total calculates correctly
- ✅ Receipt generates
- ✅ Cart clears after purchase

### 4.5 Stats Test

**Steps:**
1. Check dashboard stats display
2. Verify values:
   - Total Products: 124
   - Pending Reservations: 18
   - Low Stock Items: 7
   - Total Reservations: 56

**Expected Results:**
- ✅ Stats load from `/api/stats`
- ✅ Correct values display
- ✅ No console errors

---

## 5. Hidden/Visible Class Test

### Steps:
1. Open Console (F12)
2. Run command:
```javascript
// Test hidden class
const section = document.getElementById('inventorySection');
console.log(section.classList.contains('hidden')); // Should be true

// Remove hidden class
section.classList.remove('hidden');
// Section should now be visible

// Add hidden class back
section.classList.add('hidden');
// Section should be hidden again
```

**Expected Results:**
- ✅ `.hidden` class properly hides elements
- ✅ Class can be added/removed
- ✅ Visibility changes immediately

---

## 6. Form Test

### Image Upload Test:

**Steps:**
1. Go to Inventory → Add New Product
2. Click "Upload Image" button
3. Select an image file from your computer
4. Image preview should appear
5. Click "Remove" button
6. Preview should disappear

**Expected Results:**
- ✅ File input opens
- ✅ Preview shows after upload
- ✅ Remove button clears preview

### Add Product Form Validation:

**Steps:**
1. Leave Product Name empty
2. Click "Add Product"
3. Error message: "Please enter product name"
4. Fill Name, leave Category as "Select a category"
5. Click "Add Product"
6. Error message: "Please select a category"
7. Continue testing validation for Price, Stock, Image

**Expected Results:**
- ✅ Each field validates
- ✅ Error messages appear for empty fields
- ✅ Form doesn't submit with invalid data

---

## 7. API Integration Test

### Steps:
1. Open Console (F12)
2. Test each API endpoint:

```javascript
// Test /api/stats
fetch('/api/stats').then(r => r.json()).then(d => console.log('Stats:', d));

// Test /api/products
fetch('/api/products').then(r => r.json()).then(d => console.log('Products:', d));

// Test /api/categories
fetch('/api/categories').then(r => r.json()).then(d => console.log('Categories:', d));

// Test /api/reservations
fetch('/api/reservations').then(r => r.json()).then(d => console.log('Reservations:', d));
```

**Expected Results:**
- ✅ All endpoints return 200 status
- ✅ Data returned as JSON
- ✅ Data matches expected structure

---

## 8. Browser Compatibility Test

### Test on:
- [ ] Chrome/Chromium
- [ ] Firefox
- [ ] Safari
- [ ] Edge

### Expected Results on all browsers:
- ✅ Page loads correctly
- ✅ Styling matches
- ✅ All interactions work
- ✅ No console errors

---

## 9. Responsive Design Test

### Mobile View (F12 → Toggle Device Toolbar)

**Steps:**
1. Press Ctrl+Shift+M (or Cmd+Shift+M on Mac)
2. Set viewport to iPhone 12 (390x844)
3. Test all features:
   - Navigation works
   - Tabs switch
   - Forms work
   - Buttons clickable
   - Text readable

**Tablet View:**
1. Set viewport to iPad (768x1024)
2. Same tests as mobile

**Desktop View:**
1. Set viewport to 1920x1080
2. Same tests

**Expected Results:**
- ✅ Layout adapts to screen size
- ✅ All features work on all sizes
- ✅ No horizontal scrolling needed
- ✅ Text is readable

---

## 10. Console Check

### Steps:
1. Press F12 → Console tab
2. Reload page
3. Check for any errors (red messages)

### Expected Results:
- ✅ No errors displayed
- ✅ No warnings about missing files
- ✅ Console should be clean

---

## 11. Performance Test

### Steps:
1. F12 → Performance tab
2. Click record button
3. Perform main actions:
   - Navigate between sections
   - Switch tabs
   - Add to POS cart
   - Generate receipt
4. Stop recording
5. Review performance metrics

### Expected Results:
- ✅ No long tasks (>50ms)
- ✅ Smooth animations
- ✅ Fast response to clicks
- ✅ Quick page transitions

---

## 12. No Inline Styles Test

### Steps:
1. Right-click → Inspect element
2. Look for any HTML elements with `style="..."`
3. Search the HTML for `style=`

**Expected Results:**
- ✅ No inline styles found
- ✅ All styling via CSS classes
- ✅ Only meta tags have style attributes

---

## 13. No Hardcoded Data Test

### Steps:
1. Right-click → View Page Source
2. Search for hardcoded values like:
   - Product prices in HTML (❌ Shouldn't be there)
   - Category names in HTML (❌ Shouldn't be there)
   - Stats numbers in HTML (✅ Only "0" placeholders)

**Expected Results:**
- ✅ Data-attributes used for stats
- ✅ No product data in HTML
- ✅ No category data in HTML
- ✅ Actual data loaded from API

---

## Issue Reporting Template

If you find an issue, report it with:

```
## Issue: [Title]

**Steps to Reproduce:**
1. ...
2. ...
3. ...

**Expected Behavior:**
- ...

**Actual Behavior:**
- ...

**Console Error:**
```
[paste error message]
```

**Screenshot:**
[attach screenshot]

**Environment:**
- Browser: [Chrome/Firefox/etc]
- OS: [Windows/Mac/Linux]
- Screen Size: [Desktop/Tablet/Mobile]
```

---

## Passing Criteria

All tests pass when:

- ✅ No console errors
- ✅ All network requests return 200
- ✅ All CSS loads correctly
- ✅ All JS runs correctly
- ✅ Navigation works smoothly
- ✅ Forms validate properly
- ✅ POS system functions correctly
- ✅ Categories CRUD works
- ✅ Stats load from API
- ✅ Responsive design works
- ✅ No inline styles in HTML
- ✅ No hardcoded data visible
- ✅ Performance is smooth
- ✅ Works on all browsers

---

## Quick Test Checklist

Print and check off:

```
□ Page loads without errors
□ CSS files load (Network tab)
□ JS files load (Network tab)
□ Stats display correctly
□ Navigation works
□ Tabs switch
□ POS cart works
□ Categories load
□ Can add category
□ Can edit category
□ Can delete category
□ Forms validate
□ Image upload works
□ Receipt generates
□ Mobile view works
□ No console errors
□ No hardcoded data
```

---

**Testing complete when all boxes are checked!** ✅

*Refer to REFACTORING_SUMMARY.md for technical details.*
