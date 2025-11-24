

const express = require('express');
const crudController = require('../controller/CRUD');
const router = express.Router();

// Giftstore Catalog route
router.get('/GiftstoreCatalog', crudController.giftstoreCatalog);

// Edit product by ID
router.put('/api/products/:id', crudController.updateProduct);

// Delete product by ID
router.delete('/api/products/:id', crudController.deleteProduct);

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

// Create new product (stores in SQL database if configured)
router.post('/api/products', crudController.createProduct);

router.get('/api/categories', crudController.getCategories);

// Create category (accepts form submissions or JSON)
router.post('/api/categories', crudController.createCategory);

// Update category name by ID
router.put('/api/categories/:id', crudController.updateCategory);

// Delete category by ID
router.delete('/api/categories/:id', crudController.deleteCategory);

// Admin Dashboard Route
router.get('/AdminDashboard', crudController.adminDashboard);

router.get('/api/reservations', (req, res) => {
  res.json([
    {
      id: 1,
      customer: 'John Doe',
      product: 'Sample Product',
      quantity: 2,
      date: '2023-11-05',
      status: 'pending',
    },
    {
      id: 2,
      customer: 'Jane Smith',
      product: 'Book Set',
      quantity: 1,
      date: '2023-11-04',
      status: 'approved',
    },
  ]);
});

module.exports = router;