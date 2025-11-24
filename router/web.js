const express = require('express');
const crudController = require('../controller/CRUD');
const router = express.Router();

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
  try {
    console.log('GET /api/products called');
    const db = req.db;
    
    if (db && db.Item) {
      console.log('DB Item model available, querying products');
      db.Item.findAll({ 
        order: [['ItemID', 'DESC']], 
        raw: true
      })
        .then((products) => {
          console.log('Products fetched:', products.length);
          res.json(products);
        })
        .catch((err) => {
          console.error('Product query error:', err.message);
          // Fallback to test data on error
          res.json([
            { ItemID: 1, ItemName: 'Test Product', Price: 100.00, StockQuantity: 10, CategoryID: 1, Description: 'Test' },
            { ItemID: 2, ItemName: 'Test Product 2', Price: 200.00, StockQuantity: 20, CategoryID: 1, Description: 'Test 2' },
          ]);
        });
    } else {
      console.log('DB not available, returning test data');
      res.json([
        { ItemID: 1, ItemName: 'Test Product', Price: 100.00, StockQuantity: 10, CategoryID: 1, Description: 'Test' },
        { ItemID: 2, ItemName: 'Test Product 2', Price: 200.00, StockQuantity: 20, CategoryID: 1, Description: 'Test 2' },
      ]);
    }
  } catch (err) {
    console.error('GET /api/products error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Create new product (stores in SQL database if configured)
router.post('/api/products', async (req, res) => {
  try {
    const db = req.db;
    console.log('POST /api/products - Request body:', req.body);
    console.log('DB status:', { hasDb: !!db, hasSequelize: !!db?.sequelize, hasItem: !!db?.Item });
    
    const { ItemName, CategoryID, Price, StockQuantity, Description, ImagePath } = req.body;

    console.log('Received types:', {
      ItemNameType: typeof ItemName,
      PriceType: typeof Price,
      StockQuantityType: typeof StockQuantity,
    });

    // Validate presence and numeric values correctly
    if (!ItemName || (typeof ItemName === 'string' && ItemName.trim() === '')) {
      console.log('Validation failed: missing ItemName');
      return res.status(400).json({ error: 'Missing required field: ItemName' });
    }

    if (Price === undefined || Price === null || isNaN(Number(Price))) {
      console.log('Validation failed: invalid Price', Price);
      return res.status(400).json({ error: 'Missing or invalid required field: Price' });
    }

    if (StockQuantity === undefined || StockQuantity === null || isNaN(Number(StockQuantity))) {
      console.log('Validation failed: invalid StockQuantity', StockQuantity);
      return res.status(400).json({ error: 'Missing or invalid required field: StockQuantity' });
    }

    if (db && db.sequelize && db.Item) {
      console.log('Creating product in database...');
      // ensure tables exist (development convenience)
      await db.sequelize.sync();

      // If a CategoryID is provided, ensure it exists to avoid FK constraint errors
      let categoryIdInt = null;
      if (CategoryID !== undefined && CategoryID !== null && CategoryID !== '') {
        categoryIdInt = parseInt(CategoryID, 10);
        if (isNaN(categoryIdInt)) {
          return res.status(400).json({ error: 'Invalid CategoryID' });
        }
        if (db && db.Category) {
          const found = await db.Category.findByPk(categoryIdInt);
          if (!found) {
            return res.status(400).json({ error: `Category with ID ${categoryIdInt} does not exist` });
          }
        }
      }

      const created = await db.Item.create({
        ItemName,
        Description: Description || null,
        Price: parseFloat(Price) || 0.0,
        StockQuantity: parseInt(StockQuantity, 10) || 0,
        CategoryID: categoryIdInt,
        ImagePath: ImagePath || null,
      });

      console.log('Product created successfully:', created.toJSON());
      return res.status(201).json({ success: true, product: created });
    }

    console.log('DB not fully configured, returning mock response');
    // If DB not configured, return success with received payload
    return res.status(201).json({ success: true, product: { ItemName, CategoryID, Price, StockQuantity, Description, ImagePath } });
  } catch (err) {
    console.error('POST /api/products error:', err.message);
    console.error('Full error:', err);
    res.status(500).json({ error: 'Failed to create product', details: err.message });
  }
});

router.get('/api/categories', async (req, res) => {
  try {
    const db = req.db;
    if (db && db.Category) {
      console.log('Fetching categories from DB...');
      const categories = await db.Category.findAll({ order: [['CategoryID', 'ASC']], raw: true });
      console.log('Categories fetched:', categories.length);
      
      // Count items per category
      let categoriesWithCounts = categories;
      if (db && db.Item) {
        categoriesWithCounts = await Promise.all(categories.map(async (c) => {
          const count = await db.Item.count({ where: { CategoryID: c.CategoryID } });
          return {
            CategoryID: c.CategoryID,
            CategoryName: c.CategoryName,
            AdminID: c.AdminID,
            DateCreated: c.DateCreated,
            itemsCount: count
          };
        }));
      }
      
      return res.json(categoriesWithCounts);
    }

    console.log('DB Category model not available, returning static data');
    res.json([
      { CategoryID: 1, CategoryName: 'Books', AdminID: null, DateCreated: null, itemsCount: 0 },
      { CategoryID: 2, CategoryName: 'Uniform', AdminID: null, DateCreated: null, itemsCount: 0 },
      { CategoryID: 3, CategoryName: 'College', AdminID: null, DateCreated: null, itemsCount: 0 },
    ]);
  } catch (err) {
    console.error('GET /api/categories error:', err);
    res.status(500).json({ error: 'Failed to fetch categories', details: err.message });
  }
});

// Create category (accepts form submissions or JSON)
router.post('/api/categories', async (req, res) => {
  try {
    const db = req.db;
    const { CategoryName, AdminID } = req.body;
    if (!CategoryName || (typeof CategoryName === 'string' && CategoryName.trim() === '')) {
      return res.status(400).json({ error: 'Missing required field: CategoryName' });
    }

    if (db && db.sequelize && db.Category) {
      await db.sequelize.sync();
      const created = await db.Category.create({ CategoryName: CategoryName.trim(), AdminID: AdminID || null });
      return res.status(201).json({ success: true, category: created });
    }

    return res.status(201).json({ success: true, category: { CategoryName, AdminID } });
  } catch (err) {
    console.error('POST /api/categories error:', err);
    res.status(500).json({ error: 'Failed to create category', details: err.message });
  }
});

// Update category name by ID
router.put('/api/categories/:id', async (req, res) => {
  try {
    const db = req.db;
    const categoryId = parseInt(req.params.id, 10);
    if (isNaN(categoryId)) {
      return res.status(400).json({ error: 'Invalid category ID' });
    }

    const { CategoryName } = req.body;
    if (!CategoryName || (typeof CategoryName === 'string' && CategoryName.trim() === '')) {
      return res.status(400).json({ error: 'Missing required field: CategoryName' });
    }

    if (db && db.sequelize && db.Category) {
      const category = await db.Category.findByPk(categoryId);
      if (!category) {
        return res.status(404).json({ error: 'Category not found' });
      }

      await category.update({ CategoryName: CategoryName.trim() });
      return res.status(200).json({ success: true, category });
    }

    return res.status(200).json({ success: true, message: 'Category updated' });
  } catch (err) {
    console.error('PUT /api/categories/:id error:', err);
    res.status(500).json({ error: 'Failed to update category', details: err.message });
  }
});

// Delete category by ID
router.delete('/api/categories/:id', async (req, res) => {
  try {
    const db = req.db;
    const categoryId = parseInt(req.params.id, 10);
    if (isNaN(categoryId)) {
      return res.status(400).json({ error: 'Invalid category ID' });
    }

    if (db && db.sequelize && db.Category) {
      const category = await db.Category.findByPk(categoryId);
      if (!category) {
        return res.status(404).json({ error: 'Category not found' });
      }

      await category.destroy();
      return res.status(200).json({ success: true, message: 'Category deleted' });
    }

    return res.status(200).json({ success: true, message: 'Category deleted' });
  } catch (err) {
    console.error('DELETE /api/categories/:id error:', err);
    res.status(500).json({ error: 'Failed to delete category', details: err.message });
  }
});

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