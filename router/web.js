
const express = require('express');
const crudController = require('../controller/CRUD');
const router = express.Router();
const superUserAuth = crudController.superUserAuth;
const adminAuth = crudController.adminAuth;
const optionalAdminAuth = crudController.optionalAdminAuth;

// Root route - redirect to catalog
router.get('/', (req, res) => {
    res.redirect('/GiftstoreCatalog');
});

// Complete POS purchase (creates purchase and pending payment)
router.post('/api/purchase/complete', crudController.completePOSPurchase);

// Create purchase from reservation
router.post('/purchases/from-reservation/:reservationCode', crudController.createPurchaseFromReservation);

// Pending Payments API
router.get('/payments/pending', crudController.getPendingPayments);
router.post('/payment/:id/confirm', crudController.confirmPayment);
router.post('/payment/:id/reject', crudController.rejectPayment);
router.get('/payment/:id/details', crudController.getPaymentDetails);

// Giftstore Catalog route
router.get('/GiftstoreCatalog', crudController.giftstoreCatalog);

// Edit product by ID
router.put('/api/products/:id', crudController.updateProduct);

// (Legacy) Delete product route disabled in favor of soft deactivate (kept for backward compatibility if needed)
// router.delete('/api/products/:id', crudController.deleteProduct);
// Soft activation endpoints
router.patch('/api/products/:id/deactivate', crudController.deactivateProduct);
router.patch('/api/products/:id/activate', crudController.activateProduct);

// API Routes for Data
router.get('/api/stats', (req, res) => {
  res.json({
    totalProducts: 124,
    pendingReservations: 18,
    lowStockItems: 7,
    totalReservations: 56,
  });
});

router.get('/api/products', (req, res) => {
  crudController.getProducts(req, res);
});

// Variant & extended item endpoints
router.get('/api/items-with-variants', crudController.getItemsWithVariants);
router.get('/api/items/:id/variants', crudController.getItemVariants);
router.post('/api/items/:id/variants', crudController.createItemVariant);
router.put('/api/variants/:variantId', crudController.updateItemVariant);
router.delete('/api/variants/:variantId', crudController.deleteItemVariant);
router.patch('/api/variants/:variantId/stock', crudController.updateItemVariantStock);

// Create new product (stores in SQL database if configured)
router.post('/api/products', crudController.createProduct);

// Batch upload products via CSV
router.post('/api/products/batch-upload', crudController.batchUploadProducts);

router.get('/api/categories', crudController.getCategories);

// Create category (accepts form submissions or JSON)
router.post('/api/categories', crudController.createCategory);

// Update category name by ID
router.put('/api/categories/:id', crudController.updateCategory);

// Delete category by ID
router.delete('/api/categories/:id', crudController.deleteCategory);

// Admin Login & Dashboard Routes
router.get('/AdminLogin', crudController.adminLoginPage);
router.post('/admin/login', crudController.adminLogin);
router.get('/admin/logout', crudController.adminLogout);
router.get('/AdminDashboard', crudController.adminAuth, crudController.adminDashboard);

// Client config (returns safe bits for client usage) - require admin session
router.get('/client-config', adminAuth, (req, res) => {
  try {
    const imgbbKey = req.app.get('imgbbApiKey') || '';
    res.json({ imgbbKey });
  } catch (err) {
    res.status(500).json({ imgbbKey: '' });
  }
});

// Super Admin Management Page (requires logged-in superuser)
router.get('/SuperAdmin', crudController.adminAuth, crudController.adminRole('superuser'), (req, res) => {
  res.render('SuperAdmin');
});

// Super Admin API (require session superuser + secret header for defense-in-depth)
router.get('/super/admins', crudController.adminAuth, crudController.adminRole('superuser'), superUserAuth, crudController.listAdmins);
router.post('/super/admins', crudController.adminAuth, crudController.adminRole('superuser'), superUserAuth, crudController.createAdmin);
router.put('/super/admins/:id', crudController.adminAuth, crudController.adminRole('superuser'), superUserAuth, crudController.updateAdmin);
router.patch('/super/admins/:id/password', crudController.adminAuth, crudController.adminRole('superuser'), superUserAuth, crudController.resetAdminPassword);
router.patch('/super/admins/:id/deactivate', crudController.adminAuth, crudController.adminRole('superuser'), superUserAuth, crudController.deactivateAdmin);

// Enrolled Students Management (Super Admin only)
router.post('/super/enrolled-students/upload', crudController.adminAuth, crudController.adminRole('superuser'), superUserAuth, crudController.uploadEnrolledStudents);
router.get('/super/enrolled-students/count', crudController.adminAuth, crudController.adminRole('superuser'), superUserAuth, crudController.getEnrolledStudentsCount);

// Verify enrolled student (public endpoint for reservations)
router.get('/api/verify-student/:studentId', crudController.verifyEnrolledStudent);

router.get('/api/reservations', crudController.getReservations);

// Check reservations by email (used by catalog to prevent duplicates)
router.get('/api/reservations/check-email', crudController.checkReservationsByEmail);

// Create a reservation (guest or student)
router.post('/api/reservations', crudController.createReservation);

// Get a single reservation by code
router.get('/api/reservations/:code', crudController.getReservationByCode);

// Cancel a reservation (optional admin auth to allow admin bypass)
router.post('/api/reservations/:code/cancel', optionalAdminAuth, crudController.cancelReservation);

// System configuration
router.get('/api/config/:key', adminAuth, crudController.getSystemConfig);
router.put('/api/config/:key', adminAuth, crudController.updateSystemConfig);

// Regular reports (stock, reservations, sales)
router.post('/api/reports/generate', adminAuth, crudController.generateReport);
// AI Stock Report (uses configured AI API on server; requires admin session)
router.post('/api/reports/stock-ai', adminAuth, crudController.generateAiStockReport);
// AI report history and actions
router.get('/api/reports/ai-history', adminAuth, crudController.getAiReportHistory);
router.post('/api/reports/ai-history/:id/mark-ordered', adminAuth, crudController.markAiReportOrdered);

module.exports = router;