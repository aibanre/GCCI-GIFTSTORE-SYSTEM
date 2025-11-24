// Render Giftstore Catalog with DB products and categories
async function giftstoreCatalog(req, res) {
    try {
        const db = req.db;
        let products = [];
        let categories = [];
        let newProducts = [];
        if (db && db.Item && db.Category) {
            products = await db.Item.findAll({ order: [['ItemID', 'DESC']], raw: true });
            categories = await db.Category.findAll({ order: [['CategoryID', 'ASC']], raw: true });
            newProducts = products.slice(0, 3);
        }
        res.render('GiftstoreCatalog', { products, categories, newProducts });
    } catch (err) {
        console.error('GET /GiftstoreCatalog error:', err);
        res.status(500).send('Error loading catalog');
    }
}
// Render Admin Dashboard with stats, products, categories, etc.
async function adminDashboard(req, res) {
    try {
        const db = req.db;
        let stats = {};
        let products = [];
        let categories = [];
        if (db && db.Item && db.Category) {
            products = await db.Item.findAll({ order: [['ItemID', 'DESC']], raw: true });
            categories = await db.Category.findAll({ order: [['CategoryID', 'ASC']], raw: true });
            // Example stats, you can expand as needed
            stats.totalProducts = products.length;
            stats.totalCategories = categories.length;
            stats.lowStockItems = products.filter(p => p.StockQuantity < 10).length;
        }
        res.render('AdminDashboard', { stats, products, categories });
    } catch (err) {
        console.error('GET /AdminDashboard error:', err);
        res.status(500).send('Error loading dashboard');
    }
}

module.exports = {
    adminDashboard,
    giftstoreCatalog
,
    // Get all products (with category names)
    async getProducts(req, res) {
        try {
            const db = req.db;
            if (db && db.Item && db.Category) {
                const products = await db.Item.findAll({ order: [['ItemID', 'DESC']], raw: true });
                const categories = await db.Category.findAll({ raw: true });
                const categoryMap = {};
                categories.forEach(c => { categoryMap[c.CategoryID] = c.CategoryName; });
                const productsWithCategory = products.map(p => ({
                    ...p,
                    CategoryName: categoryMap[p.CategoryID] || ''
                }));
                return res.json(productsWithCategory);
            }
            // Fallback to test data
            return res.json([
                { ItemID: 1, ItemName: 'Test Product', Price: 100.00, StockQuantity: 10, CategoryID: 1, CategoryName: 'Books', Description: 'Test' },
                { ItemID: 2, ItemName: 'Test Product 2', Price: 200.00, StockQuantity: 20, CategoryID: 1, CategoryName: 'Books', Description: 'Test 2' },
            ]);
        } catch (err) {
            console.error('GET /api/products error:', err);
            res.status(500).json({ error: err.message });
        }
    },

    // Create new product
    async createProduct(req, res) {
        try {
            const db = req.db;
            const { ItemName, CategoryID, Price, StockQuantity, Description, ImagePath, AdminID } = req.body;
            if (!ItemName || (typeof ItemName === 'string' && ItemName.trim() === '')) {
                return res.status(400).json({ error: 'Missing required field: ItemName' });
            }
            if (Price === undefined || Price === null || isNaN(Number(Price))) {
                return res.status(400).json({ error: 'Missing or invalid required field: Price' });
            }
            if (StockQuantity === undefined || StockQuantity === null || isNaN(Number(StockQuantity))) {
                return res.status(400).json({ error: 'Missing or invalid required field: StockQuantity' });
            }
            if (db && db.sequelize && db.Item) {
                await db.sequelize.sync();
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

                // Log inventory transaction for new product
                if (db.Inventory_Transaction) {
                    await db.Inventory_Transaction.create({
                        ItemID: created.ItemID,
                        QuantityChange: parseInt(StockQuantity, 10),
                        Type: 'Add',
                        Reference: 'Product Added',
                        AdminID: AdminID || null,
                    });
                }

                return res.status(201).json({ success: true, product: created });
            }
            return res.status(201).json({ success: true, product: { ItemName, CategoryID, Price, StockQuantity, Description, ImagePath } });
        } catch (err) {
            console.error('POST /api/products error:', err);
            res.status(500).json({ error: 'Failed to create product', details: err.message });
        }
    },

    // Update product by ID
    async updateProduct(req, res) {
        try {
            const db = req.db;
            const itemId = parseInt(req.params.id, 10);
            if (isNaN(itemId)) {
                return res.status(400).json({ error: 'Invalid product ID' });
            }
            const { ItemName, CategoryID, Price, StockQuantity, Description, ImagePath, AdminID } = req.body;
            if (!ItemName || (typeof ItemName === 'string' && ItemName.trim() === '')) {
                return res.status(400).json({ error: 'Missing required field: ItemName' });
            }
            if (Price === undefined || Price === null || isNaN(Number(Price))) {
                return res.status(400).json({ error: 'Missing or invalid required field: Price' });
            }
            if (StockQuantity === undefined || StockQuantity === null || isNaN(Number(StockQuantity))) {
                return res.status(400).json({ error: 'Missing or invalid required field: StockQuantity' });
            }
            if (db && db.Item) {
                const product = await db.Item.findByPk(itemId);
                if (!product) {
                    return res.status(404).json({ error: 'Product not found' });
                }
                // Log inventory transaction if stock changes
                if (db.Inventory_Transaction && product.StockQuantity !== parseInt(StockQuantity, 10)) {
                    await db.Inventory_Transaction.create({
                        ItemID: itemId,
                        QuantityChange: parseInt(StockQuantity, 10) - product.StockQuantity,
                        Type: 'Edit',
                        Reference: 'Product Edit',
                        AdminID: AdminID || null,
                    });
                }
                await product.update({
                    ItemName,
                    CategoryID: CategoryID || product.CategoryID,
                    Price: parseFloat(Price) || 0.0,
                    StockQuantity: parseInt(StockQuantity, 10) || 0,
                    Description: Description || null,
                    ImagePath: ImagePath || null,
                });
                return res.status(200).json({ success: true, product });
            }
            return res.status(500).json({ error: 'DB not configured' });
        } catch (err) {
            console.error('PUT /api/products/:id error:', err);
            res.status(500).json({ error: 'Failed to update product', details: err.message });
        }
    },

    // Delete product by ID
    async deleteProduct(req, res) {
        try {
            const db = req.db;
            const itemId = parseInt(req.params.id, 10);
            const { AdminID } = req.body || {};
            if (isNaN(itemId)) {
                return res.status(400).json({ error: 'Invalid product ID' });
            }
            if (db && db.Item && db.Inventory_Transaction) {
                const product = await db.Item.findByPk(itemId);
                if (!product) {
                    return res.status(404).json({ error: 'Product not found' });
                }
                // Check for related inventory transactions
                const txCount = await db.Inventory_Transaction.count({ where: { ItemID: itemId } });
                if (txCount > 0) {
                    return res.status(400).json({ error: 'Cannot delete product with inventory transaction history. Deletion blocked to preserve audit logs.' });
                }
                const stockQty = product.StockQuantity;
                await product.destroy();
                // Log inventory transaction for product deletion only if actually deleted
                if (db.Inventory_Transaction) {
                    await db.Inventory_Transaction.create({
                        ItemID: itemId,
                        QuantityChange: -stockQty,
                        Type: 'Delete',
                        Reference: 'Product Deleted',
                        AdminID: AdminID || null,
                    });
                }
                return res.status(200).json({ success: true, message: 'Product deleted' });
            }
            return res.status(500).json({ error: 'DB not configured' });
        } catch (err) {
            console.error('DELETE /api/products/:id error:', err);
            res.status(500).json({ error: 'Failed to delete product', details: err.message });
        }
    },

    // Get all categories (with item counts)
    async getCategories(req, res) {
        try {
            const db = req.db;
            if (db && db.Category) {
                const categories = await db.Category.findAll({ order: [['CategoryID', 'ASC']], raw: true });
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
            // Fallback to static data
            return res.json([
                { CategoryID: 1, CategoryName: 'Books', AdminID: null, DateCreated: null, itemsCount: 0 },
                { CategoryID: 2, CategoryName: 'Uniform', AdminID: null, DateCreated: null, itemsCount: 0 },
                { CategoryID: 3, CategoryName: 'College', AdminID: null, DateCreated: null, itemsCount: 0 },
            ]);
        } catch (err) {
            console.error('GET /api/categories error:', err);
            res.status(500).json({ error: 'Failed to fetch categories', details: err.message });
        }
    },

    // Create category
    async createCategory(req, res) {
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
    },

    // Update category by ID
    async updateCategory(req, res) {
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
    },

    // Delete category by ID
    async deleteCategory(req, res) {
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
    }
}