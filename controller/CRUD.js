const { sendReservationEmail, sendCancellationEmail, sendClaimDeadlineEmail } = require('../config/emailService');

// Helper function to calculate claim deadline (2 business days, excluding weekends)
function calculateClaimDeadline(startDate) {
    let businessDaysToAdd = 2;
    let currentDate = new Date(startDate);
    
    while (businessDaysToAdd > 0) {
        currentDate.setDate(currentDate.getDate() + 1);
        const dayOfWeek = currentDate.getDay();
        // Skip Saturday (6) and Sunday (0)
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            businessDaysToAdd--;
        }
    }
    
    return currentDate;
}

// Get all pending payments with details
async function getPendingPayments(req, res) {
    try {
        const db = req.db;
        if (!db || !db.Payment || !db.Purchase) return res.status(500).json({ error: 'DB not configured' });
        const payments = await db.Payment.findAll({
            where: { PaymentStatus: 'Pending' },
            include: [
                {
                    model: db.Purchase,
                    as: 'Purchase',
                    required: true,
                    include: [
                        {
                            model: db.Reservation,
                            as: 'Reservation',
                            required: false,
                            include: [
                                {
                                    model: db.Student,
                                    as: 'Student',
                                    required: false
                                }
                            ]
                        }
                    ]
                }
            ],
            order: [['PaymentDate', 'DESC']],
            raw: false
        });
        // Flatten and format response - Fixed data mapping
        const result = payments.map(p => ({
            PaymentID: p.PaymentID,
            PurchaseID: p.PurchaseID,
            PaymentRef: p.PaymentRef,
            AmountPaid: p.AmountPaid,
            PaymentDate: p.PaymentDate,
            PaymentStatus: p.PaymentStatus,
            PurchaseType: p.Purchase?.PurchaseType,
            StudentName: p.Purchase?.Reservation?.Student?.StudentName || ''
        }));
        res.json(result);
    } catch (err) {
        console.error('GET /payments/pending error:', err);
        res.status(500).json({ error: 'Failed to fetch pending payments', details: err.message });
    }
}

// Complete POS purchase: create Purchase, Purchase_Items, and Payment (pending) with stock reservation
async function completePOSPurchase(req, res) {
    try {
        const db = req.db;
        const { cartItems, studentId, purchaseType } = req.body;
        
        if (!db || !db.Purchase || !db.Purchase_Items || !db.Payment) {
            console.error('DB object:', db);
            return res.status(500).json({ error: 'DB not configured' });
        }
        if (!Array.isArray(cartItems) || cartItems.length === 0) {
            return res.status(400).json({ error: 'Cart is empty' });
        }

        // STOCK RESERVATION: Check and reserve stock before creating payment
        for (const item of cartItems) {
            const dbItem = await db.Item.findByPk(item.id);
            if (!dbItem) {
                return res.status(400).json({ error: `Item with ID ${item.id} not found` });
            }
            if (dbItem.StockQuantity < item.quantity) {
                return res.status(400).json({ 
                    error: `Insufficient stock for ${dbItem.ItemName}. Available: ${dbItem.StockQuantity}, Requested: ${item.quantity}` 
                });
            }
        }

        // Calculate total
        const totalAmount = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        
        // Create Purchase
        const purchase = await db.Purchase.create({
            ReservationID: null,
            PurchaseType: purchaseType || 'Onsite',
            DatePurchased: new Date(),
            TotalAmount: totalAmount
        });
        
        // Create Purchase_Items (include VariantID when schema supports it)
        const supportsVariantId = !!(db.Purchase_Items && db.Purchase_Items.rawAttributes && db.Purchase_Items.rawAttributes.VariantID);
        for (const item of cartItems) {
            const payload = {
                PurchaseID: purchase.PurchaseID,
                ItemID: item.id,
                Quantity: item.quantity,
                PriceAtPurchase: item.price ?? item.Price ?? item.PriceAtPurchase ?? 0
            };
            if (supportsVariantId && item.variantId) {
                payload.VariantID = item.variantId;
            }
            await db.Purchase_Items.create(payload);
        }
        
        // Create Payment (pending)
        const payment = await db.Payment.create({
            PurchaseID: purchase.PurchaseID,
            PaymentRef: 'POS-' + purchase.PurchaseID + '-' + Date.now(),
            AmountPaid: totalAmount,
            PaymentDate: new Date(),
            PaymentStatus: 'Pending'
        });

        // NOW we have the payment ID - reserve stock and create transactions WITH PAYMENT ID
        for (const item of cartItems) {
            const dbItem = await db.Item.findByPk(item.id);
            await dbItem.update({ StockQuantity: dbItem.StockQuantity - item.quantity });
            // Log inventory transaction for stock reservation (include VariantID when available)
            if (db.Inventory_Transaction) {
                const txPayload = {
                    ItemID: item.id,
                    QuantityChange: -item.quantity,
                    Type: 'Sale',
                    Reference: `Payment ${payment.PaymentID} pending - Stock reserved`,
                    AdminID: (req.admin && req.admin.AdminID) || null,
                    Date: new Date()
                };
                // Optional VariantID support if column exists
                const invSupportsVariant = !!(db.Inventory_Transaction.rawAttributes && db.Inventory_Transaction.rawAttributes.VariantID);
                if (invSupportsVariant && item.variantId) {
                    txPayload.VariantID = item.variantId;
                }
                await db.Inventory_Transaction.create(txPayload);
            }
        }
        
        res.json({ success: true, purchase, payment });
    } catch (err) {
        console.error('POST /api/purchase/complete error:', err);
        console.log('completePOSPurchase called with:', { cartItems: req.body.cartItems, studentId, purchaseType });
        res.status(500).json({ error: 'Failed to complete purchase', details: err.message });
    }
}

// Confirm payment - no longer needs to update stock (already reserved)
async function confirmPayment(req, res) {
    try {
        const db = req.db;
        const paymentId = parseInt(req.params.id, 10);
        if (!db || !db.Payment) return res.status(500).json({ error: 'DB not configured' });
        const payment = await db.Payment.findByPk(paymentId);
        if (!payment || payment.PaymentStatus !== 'Pending') return res.status(404).json({ error: 'Pending payment not found' });
        
        // Update payment status
        await payment.update({ PaymentStatus: 'Confirmed' });
        
        // Update associated reservation to Completed if it exists
        if (db.Purchase && db.Reservation) {
            const purchase = await db.Purchase.findByPk(payment.PurchaseID);
            if (purchase && purchase.ReservationID) {
                await db.Reservation.update(
                    { Status: 'Completed' },
                    { where: { ReservationID: purchase.ReservationID } }
                );
            }
        }
        
        // FIXED: Properly update inventory transactions for this specific payment
        if (db.Inventory_Transaction) {
            const purchaseItems = await db.Purchase_Items.findAll({ where: { PurchaseID: payment.PurchaseID } });
            
            for (const pi of purchaseItems) {
                // Find the specific inventory transaction for this item and this payment
                const inventoryTransaction = await db.Inventory_Transaction.findOne({
                    where: {
                        ItemID: pi.ItemID,
                        Reference: `Payment ${payment.PaymentID} pending - Stock reserved`,
                        Type: 'Sale'
                    },
                    order: [['TxID', 'DESC']] // Get the most recent one
                });
                
                if (inventoryTransaction) {
                    // Update this specific transaction
                    await inventoryTransaction.update({
                        Reference: `Payment ${payment.PaymentID} confirmed - Purchase ${payment.PurchaseID}`
                    });
                }
            }
        }
        
        res.json({ success: true });
    } catch (err) {
        console.error('POST /payment/:id/confirm error:', err);
        res.status(500).json({ error: 'Failed to confirm payment', details: err.message });
    }
}

// Reject payment - RESTORE stock
async function rejectPayment(req, res) {
    try {
        const db = req.db;
        const paymentId = parseInt(req.params.id, 10);
        if (!db || !db.Payment || !db.Purchase || !db.Purchase_Items || !db.Item) return res.status(500).json({ error: 'DB not configured' });
        const payment = await db.Payment.findByPk(paymentId);
        if (!payment || payment.PaymentStatus !== 'Pending') return res.status(404).json({ error: 'Pending payment not found' });
        
        // Restore stock for rejected payments
        const purchaseItems = await db.Purchase_Items.findAll({ where: { PurchaseID: payment.PurchaseID } });
        for (const pi of purchaseItems) {
            const item = await db.Item.findByPk(pi.ItemID);
            if (item) {
                // Restore inventory stock
                await item.update({ StockQuantity: item.StockQuantity + pi.Quantity });
                
                // Log inventory transaction for stock restoration
                if (db.Inventory_Transaction) {
                    await db.Inventory_Transaction.create({
                        ItemID: pi.ItemID,
                        QuantityChange: pi.Quantity, // Positive because we're restoring stock
                        Type: 'Restock', // Payment rejected, stock restored
                        Reference: `Payment ${payment.PaymentID} rejected - Stock restored`,
                        AdminID: (req.admin && req.admin.AdminID) || null,
                        Date: new Date()
                    });
                }
            }
        }
        
        // Update payment status
        await payment.update({ PaymentStatus: 'Rejected' });
        res.json({ success: true });
    } catch (err) {
        console.error('POST /payment/:id/reject error:', err);
        res.status(500).json({ error: 'Failed to reject payment', details: err.message });
    }
}

// Get payment details (purchase items, quantities, total) - Fixed to match client expectations
async function getPaymentDetails(req, res) {
    try {
        const db = req.db;
        const paymentId = parseInt(req.params.id, 10);
        if (!db || !db.Payment || !db.Purchase || !db.Purchase_Items || !db.Item) return res.status(500).json({ error: 'DB not configured' });
        const payment = await db.Payment.findByPk(paymentId);
        if (!payment) return res.status(404).json({ error: 'Payment not found' });
        const purchase = await db.Purchase.findByPk(payment.PurchaseID, {
            include: [{
                model: db.Reservation,
                as: 'Reservation',
                include: [{
                    model: db.Student,
                    as: 'Student'
                }]
            }]
        });
        if (!purchase) return res.status(404).json({ error: 'Purchase not found' });
        const items = await db.Purchase_Items.findAll({ where: { PurchaseID: purchase.PurchaseID }, raw: true });
        // Attach item details
        for (const pi of items) {
            const item = await db.Item.findByPk(pi.ItemID);
            pi.ProductName = item ? item.ItemName : '';
            pi.Price = pi.PriceAtPurchase || 0;
        }
        res.json({
            PaymentRef: payment.PaymentRef,
            AmountPaid: payment.AmountPaid,
            PaymentDate: payment.PaymentDate,
            PurchaseType: purchase.PurchaseType,
            StudentName: purchase.Reservation?.Student?.StudentName || '',
            Items: items
        });
    } catch (err) {
        console.error('GET /payment/:id/details error:', err);
        res.status(500).json({ error: 'Failed to fetch payment details', details: err.message });
    }
}

// Render Giftstore Catalog with DB products and categories (tolerant if IsActive column missing)
async function giftstoreCatalog(req, res) {
    try {
        const db = req.db;
        let products = [];
        let categories = [];
        let carouselData = { title: 'Featured Items', items: [] };
        
        if (db && db.Item && db.Category) {
            const hasIsActive = !!(db.Item.rawAttributes && db.Item.rawAttributes.IsActive);
            const whereClause = hasIsActive ? { IsActive: 1 } : undefined;
            products = await db.Item.findAll({ where: whereClause, order: [['ItemID', 'DESC']], raw: true });
            
            // Attach variants if model exists
            if (db.Item_Variant) {
                const variants = await db.Item_Variant.findAll({ raw: true });
                const variantsByItem = {};
                variants.forEach(v => { if (!variantsByItem[v.ItemID]) variantsByItem[v.ItemID] = []; variantsByItem[v.ItemID].push(v); });
                products = products.map(p => ({ ...p, Variants: variantsByItem[p.ItemID] || [] }));
            }
            
            // Fetch product-category relationships
            let productCategories = [];
            if (db.sequelize.models.ProductCategory) {
                productCategories = await db.sequelize.models.ProductCategory.findAll({ raw: true });
            }
            
            categories = await db.Category.findAll({ order: [['CategoryID', 'ASC']], raw: true });
            const categoryMap = {};
            categories.forEach(c => { categoryMap[c.CategoryID] = c.CategoryName; });
            
            // Attach Categories array to each product
            products = products.map(p => {
                const productCats = productCategories
                    .filter(pc => pc.ItemID === p.ItemID)
                    .map(pc => ({ CategoryID: pc.CategoryID, CategoryName: categoryMap[pc.CategoryID] || '' }));
                return { ...p, Categories: productCats };
            });
            
            // Get AI-powered carousel recommendations
            try {
                carouselData = await getAICarouselRecommendation(products, req);
            } catch (aiErr) {
                console.error('AI carousel recommendation failed, using fallback:', aiErr);
                // Fallback to newest products
                carouselData = {
                    title: 'Newly Stocked Items',
                    items: products.slice(0, 5)
                };
            }
        }
        res.render('GiftstoreCatalog', { products, categories, carouselData });
    } catch (err) {
        console.error('GET /GiftstoreCatalog error:', err);
        res.status(500).send('Error loading catalog');
    }
}

// Carousel cache (stores for 24 hours)
let carouselCache = {
    data: null,
    timestamp: null,
    expiryHours: 24
};

// AI-powered carousel recommendation
async function getAICarouselRecommendation(products, req) {
    // Check if we have a valid cached carousel (less than 24 hours old)
    const now = new Date();
    if (carouselCache.data && carouselCache.timestamp) {
        const hoursSinceCache = (now - carouselCache.timestamp) / (1000 * 60 * 60);
        if (hoursSinceCache < carouselCache.expiryHours) {
            console.log(`Using cached AI carousel (generated ${hoursSinceCache.toFixed(1)} hours ago)`);
            // Map cached item IDs to current products (in case stock changed)
            const cachedItemIds = carouselCache.data.items.map(item => item.ItemID);
            const freshItems = products.filter(p => cachedItemIds.includes(p.ItemID));
            return {
                title: carouselCache.data.title,
                items: freshItems.length >= 3 ? freshItems : products.slice(0, 5),
                aiReason: carouselCache.data.aiReason,
                cached: true
            };
        }
    }
    
    const aiApiUrl = req.app.get('aiApiUrl') || process.env.AI_API_URL;
    const aiApiKey = req.app.get('aiApiKey') || process.env.AI_API_KEY;
    
    if (!aiApiUrl || !aiApiKey) {
        throw new Error('AI API not configured');
    }
    
    // Prepare product data for AI analysis
    const productSummary = products.slice(0, 50).map(p => ({
        id: p.ItemID,
        name: p.ItemName,
        stock: p.StockQuantity,
        price: p.Price,
        category: p.CategoryID
    }));
    
    const prompt = `You are an e-commerce AI assistant for a school giftstore. Analyze the following products and recommend which items should be featured in the carousel and what title to use.

Products:
${JSON.stringify(productSummary, null, 2)}

Choose ONE of these carousel strategies based on what makes most sense for these products:
1. "Best Sellers Today" - Popular or well-stocked items
2. "New Arrivals" - Recently added products
3. "Limited Stock - Get Them Now!" - Low stock items that need attention
4. "Customer Favorites" - Well-priced, popular category items
5. "Trending Now" - Balanced selection across categories
6. Or create your own creative, engaging title that fits the products

Return ONLY a JSON object (no markdown, no extra text) with this exact format:
{
  "title": "Your chosen carousel title",
  "reason": "Brief explanation of why you chose this strategy",
  "itemIds": [array of 3-5 ItemIDs to feature]
}`;
    
    const fetchFn = (typeof fetch === 'function') ? fetch : require('node-fetch');
    let response;
    
    if (aiApiUrl.toLowerCase().includes('generativelanguage.googleapis.com')) {
        const headers = { 'Content-Type': 'application/json', 'X-goog-api-key': aiApiKey };
        const bodyPayload = { contents: [{ parts: [{ text: prompt }] }] };
        response = await fetchFn(aiApiUrl, { method: 'POST', headers, body: JSON.stringify(bodyPayload) });
    } else {
        response = await fetchFn(aiApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${aiApiKey}` },
            body: JSON.stringify({ prompt })
        });
    }
    
    if (!response.ok) {
        throw new Error(`AI API responded with ${response.status}`);
    }
    
    const respText = await response.text();
    let aiResult;
    try { aiResult = JSON.parse(respText); } catch (e) { aiResult = { text: respText }; }
    
    // Parse AI response
    let recommendation;
    try {
        // Handle Google Gemini response format
        if (aiResult.candidates && aiResult.candidates[0]?.content?.parts?.[0]?.text) {
            const textContent = aiResult.candidates[0].content.parts[0].text;
            const jsonMatch = textContent.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                recommendation = JSON.parse(jsonMatch[0]);
            }
        } else if (typeof aiResult === 'object' && aiResult.title) {
            recommendation = aiResult;
        } else if (typeof aiResult.text === 'string') {
            const jsonMatch = aiResult.text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                recommendation = JSON.parse(jsonMatch[0]);
            }
        }
    } catch (parseErr) {
        console.error('Failed to parse AI recommendation:', parseErr);
        throw new Error('Invalid AI response format');
    }
    
    if (!recommendation || !recommendation.title || !Array.isArray(recommendation.itemIds)) {
        throw new Error('Invalid recommendation structure');
    }
    
    // Get the recommended products
    const recommendedItems = products.filter(p => recommendation.itemIds.includes(p.ItemID));
    
    // Fallback if AI didn't return enough items
    if (recommendedItems.length < 3) {
        recommendedItems.push(...products.slice(0, 5 - recommendedItems.length));
    }
    
    console.log(`AI Carousel: "${recommendation.title}" - ${recommendation.reason}`);
    
    // Cache the result for 24 hours
    carouselCache = {
        data: {
            title: recommendation.title,
            items: recommendedItems.slice(0, 5),
            aiReason: recommendation.reason
        },
        timestamp: new Date(),
        expiryHours: 24
    };
    console.log('AI carousel cached for 24 hours');
    
    return {
        title: recommendation.title,
        items: recommendedItems.slice(0, 5),
        aiReason: recommendation.reason
    };
}

// Render Admin Dashboard with stats, products, categories, etc.
async function adminDashboard(req, res) {
    try {
        const db = req.db;
        let stats = {};
        let products = [];
        let categories = [];
        let recentPurchases = [];
        let recentInventoryTransactions = [];
        let lowStockItemsList = [];
        let reservations = [];
        let pendingPaymentsCount = 0;
        if (db && db.Item && db.Category) {
            const hasIsActive = !!(db.Item.rawAttributes && db.Item.rawAttributes.IsActive);
            const whereClause = hasIsActive ? { IsActive: 1 } : undefined;
            products = await db.Item.findAll({ where: whereClause, order: [['ItemID', 'DESC']], raw: true });
            categories = await db.Category.findAll({ order: [['CategoryID', 'ASC']], raw: true });
            // Example stats, you can expand as needed
            stats.totalProducts = products.length;
            stats.totalCategories = categories.length;
            stats.lowStockItems = products.filter(p => p.StockQuantity < 10).length;
        }
        if (db && db.Purchase) {
            // Only show purchases that have at least one confirmed payment
            recentPurchases = await db.Purchase.findAll({ 
                include: [{
                    model: db.Payment,
                    as: 'Payments',
                    where: { PaymentStatus: 'Confirmed' },
                    attributes: []
                }],
                order: [['DatePurchased','DESC']], 
                limit: 10, 
                raw: true,
                distinct: true
            });
        }
        if (db && db['Inventory_Transaction']) {
            recentInventoryTransactions = await db['Inventory_Transaction'].findAll({ order: [['Date','DESC']], limit: 10, raw: true });
            // attach item names
            if (recentInventoryTransactions.length && db.Item) {
                const itemIds = [...new Set(recentInventoryTransactions.map(t => t.ItemID))];
                const itemRows = await db.Item.findAll({ where: { ItemID: itemIds }, raw: true });
                const itemMap = {}; itemRows.forEach(r => { itemMap[r.ItemID] = r.ItemName; });
                recentInventoryTransactions = recentInventoryTransactions.map(t => ({
                    ...t,
                    ItemName: itemMap[t.ItemID] || 'Item '+t.ItemID
                }));
            }
        }
        if (products.length) {
            lowStockItemsList = products.filter(p => p.StockQuantity < 10).sort((a,b)=>a.StockQuantity-b.StockQuantity).slice(0,10);
        }
        // Reservations & Pending
        if (db && db.Reservation) {
            reservations = await db.Reservation.findAll({ raw: true });
            stats.totalReservations = reservations.length;
            stats.pendingReservations = reservations.filter(r => r.Status === 'Pending').length;
        }
        if (db && db.Payment) {
            const pendingPayments = await db.Payment.count({ where: { PaymentStatus: 'Pending' } });
            pendingPaymentsCount = pendingPayments;
            stats.pendingPayments = pendingPaymentsCount;
        }
        // Revenue stats (today, last 7 days)
        if (db && db.Purchase) {
            const startOfToday = new Date(); startOfToday.setHours(0,0,0,0);
            const sevenDaysAgo = new Date(Date.now() - 7*24*60*60*1000);
            const todayRows = await db.Purchase.findAll({ where: { DatePurchased: { [db.Sequelize.Op.gte]: startOfToday } }, raw: true });
            const weekRows = await db.Purchase.findAll({ where: { DatePurchased: { [db.Sequelize.Op.gte]: sevenDaysAgo } }, raw: true });
            const sum = rows => rows.reduce((acc,r)=> acc + Number(r.TotalAmount||0),0);
            stats.todayRevenue = sum(todayRows);
            stats.weekRevenue = sum(weekRows);
        }
        res.render('AdminDashboard', { 
            stats, 
            products, 
            categories, 
            adminUser: req.admin || null,
            recentPurchases,
            recentInventoryTransactions,
            lowStockItemsList
        });
    } catch (err) {
        console.error('GET /AdminDashboard error:', err);
        res.status(500).send('Error loading dashboard');
    }
}

// Get all products (with category names)
async function getProducts(req, res) {
    try {
        const db = req.db;
        if (db && db.Item && db.Category) {
            const hasIsActive = !!(db.Item.rawAttributes && db.Item.rawAttributes.IsActive);
            const whereClause = hasIsActive ? { IsActive: 1 } : undefined;
            const products = await db.Item.findAll({ where: whereClause, order: [['ItemID', 'DESC']], raw: true });
            
            // Fetch product-category relationships
            let productCategories = [];
            if (db.sequelize.models.ProductCategory) {
                productCategories = await db.sequelize.models.ProductCategory.findAll({ raw: true });
            }
            
            const categories = await db.Category.findAll({ raw: true });
            const categoryMap = {};
            categories.forEach(c => { categoryMap[c.CategoryID] = c.CategoryName; });
            
            const productsWithCategory = products.map(p => {
                // Get all categories for this product
                const productCats = productCategories
                    .filter(pc => pc.ItemID === p.ItemID)
                    .map(pc => ({ CategoryID: pc.CategoryID, CategoryName: categoryMap[pc.CategoryID] || '' }));
                
                return {
                    ...p,
                    CategoryName: categoryMap[p.CategoryID] || '',
                    Categories: productCats
                };
            });
            return res.json(productsWithCategory);
        }
        // Fallback to test data
        return res.json([
            { ItemID: 1, ItemName: 'Test Product', Price: 100.00, StockQuantity: 10, CategoryID: 1, CategoryName: 'Books', Description: 'Test', Categories: [] },
            { ItemID: 2, ItemName: 'Test Product 2', Price: 200.00, StockQuantity: 20, CategoryID: 1, CategoryName: 'Books', Description: 'Test 2', Categories: [] },
        ]);
    } catch (err) {
        console.error('GET /api/products error:', err);
        res.status(500).json({ error: err.message });
    }
}

// Create new product
async function createProduct(req, res) {
    try {
        const db = req.db;
        const { ItemName, CategoryID, CategoryIDs, Price, StockQuantity, Description, ImagePath, AdminID, MinReservationStock } = req.body;
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
            
            // Handle both single CategoryID (for backward compatibility) and multiple CategoryIDs
            let categoryIds = [];
            if (CategoryIDs && Array.isArray(CategoryIDs)) {
                categoryIds = CategoryIDs.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
            } else if (CategoryID !== undefined && CategoryID !== null && CategoryID !== '') {
                const catId = parseInt(CategoryID, 10);
                if (!isNaN(catId)) categoryIds.push(catId);
            }
            
            // Validate categories exist
            if (categoryIds.length > 0 && db.Category) {
                for (const catId of categoryIds) {
                    const found = await db.Category.findByPk(catId);
                    if (!found) {
                        return res.status(400).json({ error: `Category with ID ${catId} does not exist` });
                    }
                }
            }
            
            const hasIsActive = !!(db.Item.rawAttributes && db.Item.rawAttributes.IsActive);
            const payload = {
                ItemName,
                Description: Description || null,
                Price: parseFloat(Price) || 0.0,
                StockQuantity: parseInt(StockQuantity, 10) || 0,
                CategoryID: categoryIds.length > 0 ? categoryIds[0] : null, // Keep first category for backward compatibility
                ImagePath: ImagePath || null,
                MinReservationStock: MinReservationStock !== undefined ? parseInt(MinReservationStock, 10) : 2
            };
            if (hasIsActive) payload.IsActive = 1;
            const created = await db.Item.create(payload);

            // Create product-category relationships
            if (categoryIds.length > 0 && db.sequelize.models.ProductCategory) {
                for (const catId of categoryIds) {
                    await db.sequelize.models.ProductCategory.create({
                        ItemID: created.ItemID,
                        CategoryID: catId
                    });
                }
            }

            // Log inventory transaction for new product
            if (db.Inventory_Transaction) {
                await db.Inventory_Transaction.create({
                    ItemID: created.ItemID,
                    QuantityChange: parseInt(StockQuantity, 10),
                    Type: 'Add',
                    Reference: 'Product Added',
                    AdminID: (req.admin && req.admin.AdminID) || AdminID || null,
                });
            }

            return res.status(201).json({ success: true, product: created });
        }
        return res.status(201).json({ success: true, product: { ItemName, CategoryID, Price, StockQuantity, Description, ImagePath } });
    } catch (err) {
        console.error('POST /api/products error:', err);
        res.status(500).json({ error: 'Failed to create product', details: err.message });
    }
}

// Batch upload products from CSV
async function batchUploadProducts(req, res) {
    try {
        const db = req.db;
        if (!db || !db.Item) {
            return res.status(500).json({ error: 'DB not configured' });
        }

        const { products, adminId } = req.body;
        
        if (!Array.isArray(products) || products.length === 0) {
            return res.status(400).json({ error: 'No products provided' });
        }

        const results = {
            success: [],
            failed: [],
            totalProcessed: 0
        };

        // Get admin ID from session if available
        const adminID = adminId || (req.admin && req.admin.AdminID) || null;

        // Process each product
        for (let i = 0; i < products.length; i++) {
            const product = products[i];
            results.totalProcessed++;

            try {
                // Validate required fields
                if (!product.ItemName || product.ItemName.trim() === '') {
                    results.failed.push({
                        row: i + 1,
                        data: product,
                        error: 'Missing required field: ItemName'
                    });
                    continue;
                }

                if (product.Price === undefined || product.Price === null || isNaN(Number(product.Price))) {
                    results.failed.push({
                        row: i + 1,
                        data: product,
                        error: 'Missing or invalid required field: Price'
                    });
                    continue;
                }

                if (product.StockQuantity === undefined || product.StockQuantity === null || isNaN(Number(product.StockQuantity))) {
                    results.failed.push({
                        row: i + 1,
                        data: product,
                        error: 'Missing or invalid required field: StockQuantity'
                    });
                    continue;
                }

                // Validate CategoryID if provided
                let categoryIdInt = null;
                if (product.CategoryID !== undefined && product.CategoryID !== null && product.CategoryID !== '') {
                    categoryIdInt = parseInt(product.CategoryID, 10);
                    if (isNaN(categoryIdInt)) {
                        results.failed.push({
                            row: i + 1,
                            data: product,
                            error: 'Invalid CategoryID'
                        });
                        continue;
                    }

                    if (db.Category) {
                        const category = await db.Category.findByPk(categoryIdInt);
                        if (!category) {
                            results.failed.push({
                                row: i + 1,
                                data: product,
                                error: `Category with ID ${categoryIdInt} does not exist`
                            });
                            continue;
                        }
                    }
                }

                // Check for IsActive support
                const hasIsActive = !!(db.Item.rawAttributes && db.Item.rawAttributes.IsActive);

                // Create product payload
                const payload = {
                    ItemName: product.ItemName.trim(),
                    Description: product.Description || null,
                    Price: parseFloat(product.Price) || 0.0,
                    StockQuantity: parseInt(product.StockQuantity, 10) || 0,
                    CategoryID: categoryIdInt,
                    ImagePath: product.ImagePath || null
                };

                if (hasIsActive) {
                    payload.IsActive = 1;
                }

                // Create the product
                const created = await db.Item.create(payload);

                // Log inventory transaction
                if (db.Inventory_Transaction) {
                    await db.Inventory_Transaction.create({
                        ItemID: created.ItemID,
                        QuantityChange: parseInt(product.StockQuantity, 10),
                        Type: 'Add',
                        Reference: 'Batch CSV Upload',
                        AdminID: adminID
                    });
                }

                // Handle variants if provided
                let variantsCreated = 0;
                if (product.Variants && product.Variants.trim() !== '' && db.Item_Variant) {
                    const variantParts = product.Variants.split('|');
                    for (const variantStr of variantParts) {
                        const parts = variantStr.split(':');
                        if (parts.length >= 3) {
                            const size = parts[0].trim();
                            const variantPrice = parseFloat(parts[1]);
                            const variantStock = parseInt(parts[2], 10);
                            
                            if (size && !isNaN(variantPrice) && !isNaN(variantStock)) {
                                await db.Item_Variant.create({
                                    ItemID: created.ItemID,
                                    Size: size,
                                    Price: variantPrice,
                                    StockQuantity: variantStock,
                                    IsActive: 1
                                });
                                variantsCreated++;
                            }
                        }
                    }
                }

                results.success.push({
                    row: i + 1,
                    product: {
                        ItemID: created.ItemID,
                        ItemName: created.ItemName,
                        Price: created.Price,
                        StockQuantity: created.StockQuantity,
                        VariantsCreated: variantsCreated
                    }
                });

            } catch (err) {
                console.error(`Error creating product at row ${i + 1}:`, err);
                results.failed.push({
                    row: i + 1,
                    data: product,
                    error: err.message || 'Unknown error'
                });
            }
        }

        return res.json({
            success: true,
            results: {
                total: results.totalProcessed,
                successful: results.success.length,
                failed: results.failed.length,
                successItems: results.success,
                failedItems: results.failed
            }
        });

    } catch (err) {
        console.error('POST /api/products/batch-upload error:', err);
        return res.status(500).json({ 
            error: 'Failed to process batch upload', 
            details: err.message 
        });
    }
}

// Update product by ID
async function updateProduct(req, res) {
    try {
        const db = req.db;
        const itemId = parseInt(req.params.id, 10);
        if (isNaN(itemId)) {
            return res.status(400).json({ error: 'Invalid product ID' });
        }
        const { ItemName, CategoryID, CategoryIDs, Price, StockQuantity, Description, ImagePath, AdminID, MinReservationStock } = req.body;
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
            
            // Handle both single CategoryID and multiple CategoryIDs
            let categoryIds = [];
            if (CategoryIDs && Array.isArray(CategoryIDs)) {
                categoryIds = CategoryIDs.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
            } else if (CategoryID !== undefined && CategoryID !== null && CategoryID !== '') {
                const catId = parseInt(CategoryID, 10);
                if (!isNaN(catId)) categoryIds.push(catId);
            }
            
            // Validate categories exist
            if (categoryIds.length > 0 && db.Category) {
                for (const catId of categoryIds) {
                    const found = await db.Category.findByPk(catId);
                    if (!found) {
                        return res.status(400).json({ error: `Category with ID ${catId} does not exist` });
                    }
                }
            }
            
            // Log inventory transaction if stock changes
            if (db.Inventory_Transaction && product.StockQuantity !== parseInt(StockQuantity, 10)) {
                await db.Inventory_Transaction.create({
                    ItemID: itemId,
                    QuantityChange: parseInt(StockQuantity, 10) - product.StockQuantity,
                    Type: 'Edit',
                    Reference: 'Product Edit',
                    AdminID: (req.admin && req.admin.AdminID) || AdminID || null,
                });
            }
            
            await product.update({
                ItemName,
                CategoryID: categoryIds.length > 0 ? categoryIds[0] : product.CategoryID,
                Price: parseFloat(Price) || 0.0,
                StockQuantity: parseInt(StockQuantity, 10) || 0,
                Description: Description || null,
                ImagePath: ImagePath || null,
                MinReservationStock: MinReservationStock !== undefined ? parseInt(MinReservationStock, 10) : product.MinReservationStock
            });
            
            // Update product-category relationships
            if (categoryIds.length > 0 && db.sequelize.models.ProductCategory) {
                // Delete existing relationships
                await db.sequelize.models.ProductCategory.destroy({
                    where: { ItemID: itemId }
                });
                
                // Create new relationships
                for (const catId of categoryIds) {
                    await db.sequelize.models.ProductCategory.create({
                        ItemID: itemId,
                        CategoryID: catId
                    });
                }
            }
            
            return res.status(200).json({ success: true, product });
        }
        return res.status(500).json({ error: 'DB not configured' });
    } catch (err) {
        console.error('PUT /api/products/:id error:', err);
        res.status(500).json({ error: 'Failed to update product', details: err.message });
    }
}

// Soft deactivate product by ID
async function deactivateProduct(req, res) {
    try {
        const db = req.db;
        const itemId = parseInt(req.params.id, 10);
        const { AdminID } = req.body || {};
        if (isNaN(itemId)) return res.status(400).json({ error: 'Invalid product ID' });
        if (!db || !db.Item) return res.status(500).json({ error: 'DB not configured' });
        const product = await db.Item.findByPk(itemId);
        if (!product) return res.status(404).json({ error: 'Product not found' });
        const hasIsActive = !!(db.Item.rawAttributes && db.Item.rawAttributes.IsActive);
        if (!hasIsActive) return res.status(500).json({ error: 'IsActive column missing in DB. Run migration to add it.' });
        if (product.IsActive === 0) return res.status(200).json({ success: true, message: 'Already inactive' });
        await product.update({ IsActive: 0 });
        if (db.Inventory_Transaction) {
            await db.Inventory_Transaction.create({
                ItemID: itemId,
                QuantityChange: 0,
                Type: 'Deactivate',
                Reference: 'Product Deactivated',
                AdminID: (req.admin && req.admin.AdminID) || AdminID || null,
                Date: new Date()
            });
        }
        res.json({ success: true, message: 'Product deactivated' });
    } catch (err) {
        console.error('PATCH /api/products/:id/deactivate error:', err);
        res.status(500).json({ error: 'Failed to deactivate product', details: err.message });
    }
}

// Activate product by ID
async function activateProduct(req, res) {
    try {
        const db = req.db;
        const itemId = parseInt(req.params.id, 10);
        const { AdminID } = req.body || {};
        if (isNaN(itemId)) return res.status(400).json({ error: 'Invalid product ID' });
        if (!db || !db.Item) return res.status(500).json({ error: 'DB not configured' });
        const product = await db.Item.findByPk(itemId);
        if (!product) return res.status(404).json({ error: 'Product not found' });
        const hasIsActive = !!(db.Item.rawAttributes && db.Item.rawAttributes.IsActive);
        if (!hasIsActive) return res.status(500).json({ error: 'IsActive column missing in DB. Run migration to add it.' });
        if (product.IsActive === 1) return res.status(200).json({ success: true, message: 'Already active' });
        await product.update({ IsActive: 1 });
        if (db.Inventory_Transaction) {
            await db.Inventory_Transaction.create({
                ItemID: itemId,
                QuantityChange: 0,
                Type: 'Activate',
                Reference: 'Product Activated',
                AdminID: (req.admin && req.admin.AdminID) || AdminID || null,
                Date: new Date()
            });
        }
        res.json({ success: true, message: 'Product activated' });
    } catch (err) {
        console.error('PATCH /api/products/:id/activate error:', err);
        res.status(500).json({ error: 'Failed to activate product', details: err.message });
    }
}

// Get all categories (with item counts)
async function getCategories(req, res) {
    try {
        const db = req.db;
        if (db && db.Category) {
            const categories = await db.Category.findAll({ order: [['CategoryID', 'ASC']], raw: true });
            let categoriesWithCounts = categories;
            
            // Count items using the product_category junction table
            if (db && db.sequelize.models.ProductCategory) {
                categoriesWithCounts = await Promise.all(categories.map(async (c) => {
                    const count = await db.sequelize.models.ProductCategory.count({ 
                        where: { CategoryID: c.CategoryID } 
                    });
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
}

// Create category
async function createCategory(req, res) {
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
}

// Update category by ID
async function updateCategory(req, res) {
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
}

// Delete category by ID
async function deleteCategory(req, res) {
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

    // ================= Variant APIs =================
    async function getItemsWithVariants(req, res) {
        try {
            const db = req.db;
            if (!db || !db.Item) return res.status(500).json({ error: 'DB not configured' });
            const items = await db.Item.findAll({ raw: true, order: [['ItemID', 'DESC']] });
            let variantsByItem = {};
            if (db.Item_Variant) {
                const variants = await db.Item_Variant.findAll({ raw: true });
                variants.forEach(v => {
                    if (!variantsByItem[v.ItemID]) variantsByItem[v.ItemID] = [];
                    variantsByItem[v.ItemID].push(v);
                });
            }
            const result = items.map(it => ({ ...it, Variants: variantsByItem[it.ItemID] || [] }));
            res.json(result);
        } catch (err) {
            console.error('GET /api/items-with-variants error:', err);
            res.status(500).json({ error: 'Failed to fetch items with variants', details: err.message });
        }
    }

    async function getItemVariants(req, res) {
        try {
            const db = req.db;
            const itemId = parseInt(req.params.id, 10);
            if (!db || !db.Item_Variant) return res.status(500).json({ error: 'DB not configured' });
            if (isNaN(itemId)) return res.status(400).json({ error: 'Invalid item ID' });
            const variants = await db.Item_Variant.findAll({ where: { ItemID: itemId }, raw: true, order: [['VariantID', 'ASC']] });
            res.json(variants);
        } catch (err) {
            console.error('GET /api/items/:id/variants error:', err);
            res.status(500).json({ error: 'Failed to fetch variants', details: err.message });
        }
    }

    async function createItemVariant(req, res) {
        try {
            const db = req.db;
            const itemId = parseInt(req.params.id, 10);
            const { Size, Price, StockQuantity } = req.body;
            if (!db || !db.Item || !db.Item_Variant) return res.status(500).json({ error: 'DB not configured' });
            if (isNaN(itemId)) return res.status(400).json({ error: 'Invalid item ID' });
            if (!Size || Size.trim() === '') return res.status(400).json({ error: 'Size is required' });
            const item = await db.Item.findByPk(itemId);
            if (!item) return res.status(404).json({ error: 'Item not found' });
            const created = await db.Item_Variant.create({
                ItemID: itemId,
                Size: Size.trim(),
                Price: Price !== undefined && Price !== null && Price !== '' ? parseFloat(Price) : null,
                StockQuantity: parseInt(StockQuantity, 10) || 0
            });
            res.status(201).json({ success: true, variant: created });
        } catch (err) {
            console.error('POST /api/items/:id/variants error:', err);
            res.status(500).json({ error: 'Failed to create variant', details: err.message });
        }
    }

    async function updateItemVariant(req, res) {
        try {
            const db = req.db;
            const variantId = parseInt(req.params.variantId, 10);
            const { Size, Price, StockQuantity, IsActive } = req.body;
            if (!db || !db.Item_Variant) return res.status(500).json({ error: 'DB not configured' });
            if (isNaN(variantId)) return res.status(400).json({ error: 'Invalid variant ID' });
            const variant = await db.Item_Variant.findByPk(variantId);
            if (!variant) return res.status(404).json({ error: 'Variant not found' });
            await variant.update({
                Size: Size !== undefined && Size !== null && Size.trim() !== '' ? Size.trim() : variant.Size,
                Price: Price !== undefined && Price !== null && Price !== '' ? parseFloat(Price) : variant.Price,
                StockQuantity: StockQuantity !== undefined && StockQuantity !== null && StockQuantity !== '' ? parseInt(StockQuantity, 10) : variant.StockQuantity,
                IsActive: IsActive !== undefined && IsActive !== null ? (IsActive ? 1 : 0) : variant.IsActive
            });
            res.json({ success: true, variant });
        } catch (err) {
            console.error('PUT /api/variants/:variantId error:', err);
            res.status(500).json({ error: 'Failed to update variant', details: err.message });
        }
    }

    async function deleteItemVariant(req, res) {
        try {
            const db = req.db;
            const variantId = parseInt(req.params.variantId, 10);
            if (!db || !db.Item_Variant) return res.status(500).json({ error: 'DB not configured' });
            if (isNaN(variantId)) return res.status(400).json({ error: 'Invalid variant ID' });
            const variant = await db.Item_Variant.findByPk(variantId);
            if (!variant) return res.status(404).json({ error: 'Variant not found' });
            // (Future: check for existing purchase_items referencing VariantID before hard delete)
            await variant.destroy();
            res.json({ success: true });
        } catch (err) {
            console.error('DELETE /api/variants/:variantId error:', err);
            res.status(500).json({ error: 'Failed to delete variant', details: err.message });
        }
    }

    async function updateItemVariantStock(req, res) {
        try {
            const db = req.db;
            const variantId = parseInt(req.params.variantId, 10);
            const { StockQuantity } = req.body;
            if (!db || !db.Item_Variant) return res.status(500).json({ error: 'DB not configured' });
            if (isNaN(variantId)) return res.status(400).json({ error: 'Invalid variant ID' });
            if (StockQuantity === undefined || StockQuantity === null || StockQuantity === '') return res.status(400).json({ error: 'StockQuantity is required' });
            const variant = await db.Item_Variant.findByPk(variantId);
            if (!variant) return res.status(404).json({ error: 'Variant not found' });
            await variant.update({ StockQuantity: parseInt(StockQuantity, 10) });
            res.json({ success: true, variant });
        } catch (err) {
            console.error('PATCH /api/variants/:variantId/stock error:', err);
            res.status(500).json({ error: 'Failed to update variant stock', details: err.message });
        }
    }

// Create purchase from reservation
async function createPurchaseFromReservation(req, res) {
    try {
        const db = req.db;
        const { reservationCode } = req.params;
        
        if (!db || !db.Reservation || !db.Purchase || !db.Payment) {
            return res.status(500).json({ error: 'DB not configured' });
        }
        
        // Find reservation
        const reservation = await db.Reservation.findOne({ 
            where: { ReservationCode: reservationCode },
            raw: true 
        });
        
        if (!reservation) {
            return res.status(404).json({ error: 'Reservation not found' });
        }
        
        if (reservation.Status !== 'Pending') {
            return res.status(400).json({ error: `Reservation is ${reservation.Status}, cannot proceed to payment` });
        }
        
        // Get reservation items
        const resItems = await db.Reservation_Item.findAll({
            where: { ReservationID: reservation.ReservationID },
            raw: true
        });
        
        if (!resItems || resItems.length === 0) {
            return res.status(400).json({ error: 'No items in reservation' });
        }
        
        // Get item details and calculate total
        const { Op } = require('sequelize');
        const itemIds = resItems.map(ri => ri.ItemID);
        const items = await db.Item.findAll({
            where: { ItemID: { [Op.in]: itemIds } },
            raw: true
        });
        
        const itemMap = {};
        items.forEach(it => { itemMap[it.ItemID] = it; });
        
        const totalAmount = resItems.reduce((sum, ri) => {
            const item = itemMap[ri.ItemID];
            return sum + ((item?.Price || 0) * ri.Quantity);
        }, 0);
        
        // Create Purchase
        const purchase = await db.Purchase.create({
            ReservationID: reservation.ReservationID,
            PurchaseType: 'Reservation',
            DatePurchased: new Date(),
            TotalAmount: totalAmount
        });
        
        // Create Purchase_Items
        for (const ri of resItems) {
            const item = itemMap[ri.ItemID];
            await db.Purchase_Items.create({
                PurchaseID: purchase.PurchaseID,
                ItemID: ri.ItemID,
                Quantity: ri.Quantity,
                PriceAtPurchase: item?.Price || 0
            });
        }
        
        // Create Payment (pending)
        const payment = await db.Payment.create({
            PurchaseID: purchase.PurchaseID,
            PaymentRef: `${reservationCode}-${Date.now()}`,
            AmountPaid: totalAmount,
            PaymentDate: new Date(),
            PaymentStatus: 'Pending'
        });
        
        // Update reservation status to Approved (payment pending)
        await db.Reservation.update(
            { Status: 'Approved' },
            { where: { ReservationID: reservation.ReservationID } }
        );
        
        res.json({ 
            success: true, 
            purchase, 
            payment,
            message: 'Purchase created successfully. Payment is pending.' 
        });
    } catch (err) {
        console.error('POST /purchases/from-reservation/:code error:', err);
        res.status(500).json({ error: 'Failed to create purchase', details: err.message });
    }
}

module.exports = {
    adminDashboard,
    giftstoreCatalog,
    getPendingPayments,
    confirmPayment,
    rejectPayment,
    getPaymentDetails,
    getProducts,
    createProduct,
    batchUploadProducts,
    updateProduct,
    deactivateProduct,
    activateProduct,
    getCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    completePOSPurchase,
    createPurchaseFromReservation,
    getItemVariants,
    createItemVariant,
    updateItemVariant,
    deleteItemVariant,
    updateItemVariantStock,
    getItemsWithVariants
};

// Create reservation (guest-friendly)
async function createReservation(req, res) {
    try {
        const db = req.db;
        if (!db || !db.Reservation || !db.Reservation_Item) return res.status(500).json({ error: 'DB not configured' });
        // Accept either single ItemID/Quantity or an Items array [{ ItemID, Quantity }]
        const { ItemID, Quantity, Items, StudentName, StudentEmail, StudentNumber } = req.body;
        let itemsPayload = [];
        if (Array.isArray(Items) && Items.length) {
            itemsPayload = Items.map(it => ({ ItemID: parseInt(it.ItemID,10), Quantity: parseInt(it.Quantity,10) }));
        } else if (ItemID && Quantity) {
            itemsPayload = [{ ItemID: parseInt(ItemID,10), Quantity: parseInt(Quantity,10) }];
        }
        if (!itemsPayload.length) return res.status(400).json({ error: 'Items required' });

        // Anti-hoarding: Validate quantity limits
        const MAX_QUANTITY_PER_ITEM = 5;
        for (const it of itemsPayload) {
            if (it.Quantity > MAX_QUANTITY_PER_ITEM) {
                return res.status(400).json({ 
                    error: `Maximum ${MAX_QUANTITY_PER_ITEM} units per item allowed. You requested ${it.Quantity}.` 
                });
            }
        }

        // Ensure student exists - create guest if necessary
        let studentId = null;
        if (db.Student) {
            if (StudentEmail && StudentEmail.includes('@')) {
                // Find or create by StudentIDNumber (unique per student), not email
                // This allows same email to be used for different student IDs
                let student = null;
                if (StudentNumber) {
                    student = await db.Student.findOne({ where: { StudentIDNumber: StudentNumber } });
                }
                
                if (!student) {
                    // Create new student record
                    student = await db.Student.create({ 
                        FullName: StudentName || 'Guest', 
                        Email: StudentEmail, 
                        StudentIDNumber: StudentNumber || `TEMP-${Date.now()}` 
                    });
                } else {
                    // Update student info if changed
                    const updates = {};
                    if (StudentName && StudentName !== student.FullName) {
                        updates.FullName = StudentName;
                    }
                    if (StudentEmail && StudentEmail !== student.Email) {
                        updates.Email = StudentEmail;
                    }
                    if (Object.keys(updates).length > 0) {
                        await student.update(updates);
                    }
                }
                studentId = student.StudentID;
                
                // Anti-hoarding: Check for existing active reservations for this specific student ID
                // Active = Pending or Approved (payment pending), not Completed or Canceled
                const { Op } = require('sequelize');
                const activeReservation = await db.Reservation.findOne({
                    where: { 
                        StudentID: studentId,
                        Status: { [Op.in]: ['Pending', 'Approved'] }
                    }
                });
                
                if (activeReservation) {
                    return res.status(400).json({ 
                        error: 'You already have an active reservation. Please complete or cancel it before making a new one.',
                        existingReservation: activeReservation.ReservationCode
                    });
                }
            } else {
                // create guest placeholder
                const ts = Date.now();
                const guestEmail = `guest+${ts}@local.local`;
                const guestNumber = `GUEST-${ts}`;
                const guest = await db.Student.create({ FullName: StudentName || 'Guest', Email: guestEmail, StudentIDNumber: guestNumber });
                studentId = guest.StudentID;
            }
        } else {
            return res.status(500).json({ error: 'Student model missing' });
        }

        // Create reservation and items in a transaction when available
        const code = 'RES-' + Math.random().toString(36).slice(2,9).toUpperCase();
        const now = new Date();
        const cancelExpires = new Date(now.getTime() + 1*60*1000); // 1 minute cancellation window
        const claimDeadline = new Date(cancelExpires.getTime() + 1*60*1000); // 1 minute claim deadline for testing

        const supportsReservationVariant = !!(db.Reservation_Item && db.Reservation_Item.rawAttributes && db.Reservation_Item.rawAttributes.VariantID);
        
        // Get global minimum reservation stock setting
        let globalMinStock = 2; // default fallback
        if (db.SystemConfig) {
            const config = await db.SystemConfig.findOne({ where: { ConfigKey: 'global_min_reservation_stock' }, raw: true });
            if (config && config.ConfigValue) {
                globalMinStock = parseInt(config.ConfigValue, 10) || 2;
            }
        }
        
        if (db.sequelize && typeof db.sequelize.transaction === 'function') {
            await db.sequelize.transaction(async (t) => {
                // Check stock availability first
                for (const it of itemsPayload) {
                    const item = await db.Item.findByPk(it.ItemID, { transaction: t });
                    if (!item) {
                        throw new Error(`Item ${it.ItemID} not found`);
                    }
                    
                    // Use item's MinReservationStock if set, otherwise use global setting
                    const minReservationStock = (item.MinReservationStock !== null && item.MinReservationStock !== undefined) 
                        ? item.MinReservationStock 
                        : globalMinStock;
                    const availableForReservation = item.StockQuantity - minReservationStock;
                    
                    if (availableForReservation < it.Quantity) {
                        if (item.StockQuantity < it.Quantity) {
                            throw new Error(`Insufficient stock for ${item.ItemName}. Available: ${item.StockQuantity}, Requested: ${it.Quantity}`);
                        } else {
                            throw new Error(`${item.ItemName} has low stock (${item.StockQuantity} remaining). Only ${availableForReservation} available for reservation. Please visit the store or reduce quantity.`);
                        }
                    }
                }
                
                const reservation = await db.Reservation.create({ 
                    ReservationCode: code, 
                    StudentID: studentId, 
                    Status: 'Pending', 
                    DateReserved: now, 
                    CancelWindowExpires: cancelExpires,
                    ClaimDeadline: claimDeadline
                }, { transaction: t });
                
                // Create reservation items and deduct stock
                for (const it of itemsPayload) {
                    const payload = { ReservationID: reservation.ReservationID, ItemID: it.ItemID, Quantity: it.Quantity };
                    if (supportsReservationVariant && it.VariantID) payload.VariantID = it.VariantID;
                    await db.Reservation_Item.create(payload, { transaction: t });
                    
                    // Deduct stock
                    const item = await db.Item.findByPk(it.ItemID, { transaction: t });
                    await item.update({ StockQuantity: item.StockQuantity - it.Quantity }, { transaction: t });
                    
                    // Log inventory transaction
                    if (db.Inventory_Transaction) {
                        await db.Inventory_Transaction.create({
                            ItemID: it.ItemID,
                            QuantityChange: -it.Quantity,
                            Type: 'Reservation',
                            Reference: `Reservation ${code} - Stock reserved`,
                            AdminID: (req.admin && req.admin.AdminID) || null,
                            Date: new Date()
                        }, { transaction: t });
                    }
                }
                
                // Send confirmation email if email provided
                if (StudentEmail && StudentEmail.includes('@')) {
                    try {
                        // Get item details for email
                        const emailItems = [];
                        for (const it of itemsPayload) {
                            let productName = 'Product';
                            let variantName = '';
                            
                            if (db.Item_Variant && it.VariantID) {
                                const variant = await db.Item_Variant.findByPk(it.VariantID, { transaction: t });
                                if (variant && db.Item) {
                                    const product = await db.Item.findByPk(variant.ItemID, { transaction: t });
                                    if (product) {
                                        productName = product.ItemName;
                                        variantName = variant.Size || variant.VariantName || '';
                                    }
                                }
                            } else if (db.Item && it.ItemID) {
                                const product = await db.Item.findByPk(it.ItemID, { transaction: t });
                                if (product) productName = product.ItemName;
                            }
                            
                            emailItems.push({
                                productName,
                                variantName,
                                quantity: it.Quantity
                            });
                        }
                        
                        await sendReservationEmail(StudentEmail, {
                            reservationCode: code,
                            studentName: StudentName || 'Guest',
                            items: emailItems,
                            cancelWindowExpires: cancelExpires
                        });
                    } catch (emailErr) {
                        console.error('Failed to send reservation email:', emailErr);
                        // Don't fail the reservation if email fails
                    }
                }
                
                res.json({ success: true, reservationId: reservation.ReservationID, code });
            });
        } else {
            // Check stock availability first
            for (const it of itemsPayload) {
                const item = await db.Item.findByPk(it.ItemID);
                if (!item) {
                    return res.status(400).json({ error: `Item ${it.ItemID} not found` });
                }
                
                // Minimum stock threshold for reservations (keep at least 2 for walk-ins)
                const MIN_STOCK_FOR_RESERVATION = 2;
                const availableForReservation = item.StockQuantity - MIN_STOCK_FOR_RESERVATION;
                
                if (availableForReservation < it.Quantity) {
                    if (item.StockQuantity < it.Quantity) {
                        return res.status(400).json({ error: `Insufficient stock for ${item.ItemName}. Available: ${item.StockQuantity}, Requested: ${it.Quantity}` });
                    } else {
                        return res.status(400).json({ error: `${item.ItemName} has low stock (${item.StockQuantity} remaining). Only ${availableForReservation} available for reservation. Please visit the store or reduce quantity.` });
                    }
                }
            }
            
            const reservation = await db.Reservation.create({ 
                ReservationCode: code, 
                StudentID: studentId, 
                Status: 'Pending', 
                DateReserved: now, 
                CancelWindowExpires: cancelExpires,
                ClaimDeadline: claimDeadline
            });
            
            // Create reservation items and deduct stock
            for (const it of itemsPayload) {
                const payload = { ReservationID: reservation.ReservationID, ItemID: it.ItemID, Quantity: it.Quantity };
                if (supportsReservationVariant && it.VariantID) payload.VariantID = it.VariantID;
                await db.Reservation_Item.create(payload);
                
                // Deduct stock
                const item = await db.Item.findByPk(it.ItemID);
                await item.update({ StockQuantity: item.StockQuantity - it.Quantity });
                
                // Log inventory transaction
                if (db.Inventory_Transaction) {
                    await db.Inventory_Transaction.create({
                        ItemID: it.ItemID,
                        QuantityChange: -it.Quantity,
                        Type: 'Reservation',
                        Reference: `Reservation ${code} - Stock reserved`,
                        AdminID: (req.admin && req.admin.AdminID) || null,
                        Date: new Date()
                    });
                }
            }
            
            // Send confirmation email if email provided
            if (StudentEmail && StudentEmail.includes('@')) {
                try {
                    // Get item details for email
                    const emailItems = [];
                    for (const it of itemsPayload) {
                        let productName = 'Product';
                        let variantName = '';
                        
                        if (db.Item_Variant && it.VariantID) {
                            const variant = await db.Item_Variant.findByPk(it.VariantID);
                            if (variant && db.Item) {
                                const product = await db.Item.findByPk(variant.ItemID);
                                if (product) {
                                    productName = product.ItemName;
                                    variantName = variant.Size || variant.VariantName || '';
                                }
                            }
                        } else if (db.Item && it.ItemID) {
                            const product = await db.Item.findByPk(it.ItemID);
                            if (product) productName = product.ItemName;
                        }
                        
                        emailItems.push({
                            productName,
                            variantName,
                            quantity: it.Quantity
                        });
                    }
                    
                    await sendReservationEmail(StudentEmail, {
                        reservationCode: code,
                        studentName: StudentName || 'Guest',
                        items: emailItems,
                        cancelWindowExpires: cancelExpires
                    });
                } catch (emailErr) {
                    console.error('Failed to send reservation email:', emailErr);
                    // Don't fail the reservation if email fails
                }
            }
            
            res.json({ success: true, reservationId: reservation.ReservationID, code });
        }
    } catch (err) {
        console.error('POST /api/reservations error:', err);
        res.status(500).json({ error: 'Failed to create reservation', details: err.message });
    }
}

module.exports.createReservation = createReservation;

// Get reservations (for admin UI)
async function getReservations(req, res) {
    try {
        const db = req.db;
        if (!db || !db.Reservation) return res.status(500).json({ error: 'DB not configured' });

        console.log('[getReservations] Fetching all reservations...');
        
        // Get all reservations (admin can see all, including those in cancel window)
        const reservations = await db.Reservation.findAll({ 
            raw: true, 
            order: [['DateReserved','DESC']] 
        });
        
        console.log(`[getReservations] Found ${reservations.length} reservations`);
        const reservationIds = reservations.map(r => r.ReservationID).filter(Boolean);
        console.log(`[getReservations] Reservation IDs:`, reservationIds);

        // load reservation items
        let resItems = [];
        if (reservationIds.length && db.Reservation_Item) {
            const { Op } = require('sequelize');
            resItems = await db.Reservation_Item.findAll({ 
                where: { ReservationID: { [Op.in]: reservationIds } }, 
                raw: true 
            });
        }

        // load related items
        const itemIds = [...new Set(resItems.map(i => i.ItemID).filter(Boolean))];
        let items = [];
        if (itemIds.length && db.Item) {
            const { Op } = require('sequelize');
            items = await db.Item.findAll({ 
                where: { ItemID: { [Op.in]: itemIds } }, 
                raw: true 
            });
        }
        const itemMap = {};
        items.forEach(it => { itemMap[it.ItemID] = it; });

        // load students
        const studentIds = [...new Set(reservations.map(r => r.StudentID).filter(Boolean))];
        let students = [];
        if (studentIds.length && db.Student) {
            const { Op } = require('sequelize');
            students = await db.Student.findAll({ 
                where: { StudentID: { [Op.in]: studentIds } }, 
                raw: true 
            });
        }
        const studentMap = {};
        students.forEach(s => { studentMap[s.StudentID] = s; });

        const mapped = reservations.map(r => {
            const itemsFor = resItems.filter(ri => ri.ReservationID === r.ReservationID).map(ri => ({
                ItemID: ri.ItemID,
                ItemName: (itemMap[ri.ItemID] && itemMap[ri.ItemID].ItemName) || '',
                Price: (itemMap[ri.ItemID] && itemMap[ri.ItemID].Price) || 0,
                Quantity: ri.Quantity
            }));

            return {
                ReservationID: r.ReservationID,
                ReservationCode: r.ReservationCode,
                StudentID: r.StudentID,
                StudentName: (studentMap[r.StudentID] && (studentMap[r.StudentID].FullName || studentMap[r.StudentID].StudentName)) || 'Guest',
                StudentIDNumber: (studentMap[r.StudentID] && studentMap[r.StudentID].StudentIDNumber) || '',
                DateReserved: r.DateReserved || r.CreatedAt || null,
                CancelWindowExpires: r.CancelWindowExpires || null,
                ClaimDeadline: r.ClaimDeadline || null,
                Status: r.Status || r.StatusID || 'Pending',
                Items: itemsFor
            };
        });

        res.json(mapped);
    } catch (err) {
        console.error('GET /api/reservations error:', err);
        res.status(500).json({ error: 'Failed to load reservations', details: err.message });
    }
}

module.exports.getReservations = getReservations;

// Generate an AI-driven stock report by calling an external AI API configured in app settings
async function generateAiStockReport(req, res) {
    try {
        const db = req.db;
        if (!db || !db.Item) return res.status(500).json({ error: 'DB not configured' });

        // Fetch items with their current stock levels
        const items = await db.Item.findAll({ 
            attributes: ['ItemID','ItemName','StockQuantity','Price','CategoryID'], 
            order: [['StockQuantity','ASC']], 
            raw: true 
        });

        // Fetch inventory transactions from last 90 days for trend analysis
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        
        const transactions = await db.Inventory_Transaction.findAll({
            where: {
                Date: { [db.Sequelize.Op.gte]: ninetyDaysAgo }
            },
            attributes: ['ItemID', 'QuantityChange', 'Type', 'Date'],
            order: [['Date', 'DESC']],
            raw: true
        });

        // Calculate sales velocity and trends per item
        const itemAnalytics = {};
        items.forEach(item => {
            itemAnalytics[item.ItemID] = {
                ...item,
                totalSold: 0,
                totalRestocked: 0,
                salesCount: 0,
                restockCount: 0,
                lastSaleDate: null,
                lastRestockDate: null,
                avgDailyDepletion: 0
            };
        });

        // Process transactions to build analytics
        transactions.forEach(tx => {
            if (!itemAnalytics[tx.ItemID]) return;
            
            const txDate = new Date(tx.Date);
            
            if (tx.Type === 'sale' || tx.Type === 'reservation') {
                itemAnalytics[tx.ItemID].totalSold += Math.abs(tx.QuantityChange);
                itemAnalytics[tx.ItemID].salesCount++;
                if (!itemAnalytics[tx.ItemID].lastSaleDate || txDate > new Date(itemAnalytics[tx.ItemID].lastSaleDate)) {
                    itemAnalytics[tx.ItemID].lastSaleDate = tx.Date;
                }
            } else if (tx.Type === 'restock' || tx.Type === 'purchase') {
                itemAnalytics[tx.ItemID].totalRestocked += Math.abs(tx.QuantityChange);
                itemAnalytics[tx.ItemID].restockCount++;
                if (!itemAnalytics[tx.ItemID].lastRestockDate || txDate > new Date(itemAnalytics[tx.ItemID].lastRestockDate)) {
                    itemAnalytics[tx.ItemID].lastRestockDate = tx.Date;
                }
            }
        });

        // Calculate average daily depletion rate (sales velocity)
        Object.keys(itemAnalytics).forEach(itemId => {
            const analytics = itemAnalytics[itemId];
            if (analytics.totalSold > 0) {
                analytics.avgDailyDepletion = (analytics.totalSold / 90).toFixed(2);
            }
        });

        // Prepare top 30 items for AI analysis (mix of low stock and high velocity items)
        const analyticsArray = Object.values(itemAnalytics);
        
        // Get low stock items
        const lowStock = analyticsArray
            .filter(a => a.StockQuantity < 20)
            .slice(0, 15);
        
        // Get high velocity items
        const highVelocity = analyticsArray
            .filter(a => a.avgDailyDepletion > 0)
            .sort((a, b) => b.avgDailyDepletion - a.avgDailyDepletion)
            .slice(0, 15);
        
        // Combine and deduplicate
        const analysisSet = new Map();
        [...lowStock, ...highVelocity].forEach(item => analysisSet.set(item.ItemID, item));
        const itemsForAnalysis = Array.from(analysisSet.values()).slice(0, 30);

        // Build enhanced prompt with transaction data
        const itemDetails = itemsForAnalysis.map(i => 
            `ID:${i.ItemID} | ${i.ItemName} | CurrentStock:${i.StockQuantity} | Price:₱${i.Price} | ` +
            `TotalSold(90d):${i.totalSold} | DailySales:${i.avgDailyDepletion} | SalesEvents:${i.salesCount} | ` +
            `Restocked:${i.restockCount}x | LastSale:${i.lastSaleDate ? new Date(i.lastSaleDate).toLocaleDateString() : 'N/A'}`
        ).join('\n');

        const prompt = `You are an inventory analyst for a school giftstore. Analyze the following items with their sales history over the last 90 days.

ITEM DATA (ID | Name | Current Stock | Price | Total Sold (90 days) | Daily Sales Rate | Sales Events | Restock Count | Last Sale):
${itemDetails}

Based on this data, produce a JSON object with:
- summary: Short analysis of inventory health considering sales velocity and stock levels
- suggestions: Array of reorder recommendations with these fields:
  * ItemID: number
  * ItemName: string
  * reason: string (explain based on sales velocity, stock level, and trends)
  * suggestedQty: number (calculate based on daily sales rate and desired 30-day buffer)
  * priority: "high" | "medium" | "low" (high = high velocity + low stock, medium = moderate velocity or stock, low = slow movers)
  * daysUntilStockout: number (estimated days until out of stock based on current sales rate, or null if not applicable)
- topReorder: Array of top 5 ItemIDs that need immediate attention

Return ONLY valid JSON (no markdown, no commentary).`;

        // AI API configuration (set in app locals or environment)
        const aiApiUrl = req.app.get('aiApiUrl') || process.env.AI_API_URL;
        const aiApiKey = req.app.get('aiApiKey') || process.env.AI_API_KEY;
        const aiModel = req.app.get('aiModel') || process.env.AI_MODEL;
        if (!aiApiUrl) return res.status(500).json({ error: 'AI API URL not configured on server' });

        // Use Google Auth flow when targeting Google Generative API endpoint
        const fetchFn = (typeof fetch === 'function') ? fetch : require('node-fetch');
        let response;
        if (aiApiUrl.toLowerCase().includes('generativelanguage.googleapis.com')) {
            // Google Generative API: prefer API key header fallback if provided (matches curl style),
            // otherwise use OAuth2 ADC via google-auth-library.
            try {
                const isGenerateContent = aiApiUrl.includes(':generateContent');
                // If an API key is provided, use X-goog-api-key header (useful for quick testing)
                if (aiApiKey) {
                    const headers = { 'Content-Type': 'application/json', 'X-goog-api-key': aiApiKey };
                    // For endpoints like :generateContent the request body uses "contents" with parts array
                    let bodyPayload;
                    if (isGenerateContent) {
                        bodyPayload = { contents: [{ parts: [{ text: prompt }] }] };
                    } else {
                        // v1beta2-style expects model in body
                        const model = aiModel || 'models/gemini-1.0';
                        bodyPayload = { model: model, prompt: { text: prompt } };
                    }
                    response = await fetchFn(aiApiUrl, { method: 'POST', headers, body: JSON.stringify(bodyPayload) });
                } else {
                    // No API key: use ADC OAuth flow (service account or gcloud ADC)
                    const { GoogleAuth } = require('google-auth-library');
                    const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
                    const client = await auth.getClient();
                    const accessTokenObj = await client.getAccessToken();
                    const accessToken = (accessTokenObj && accessTokenObj.token) ? accessTokenObj.token : accessTokenObj;
                    if (!accessToken) return res.status(500).json({ error: 'Failed to obtain Google access token (check GOOGLE_APPLICATION_CREDENTIALS)' });

                    // Build Google request payload
                    const model = aiModel || 'models/gemini-1.0';
                    let bodyPayload;
                    if (isGenerateContent) {
                        bodyPayload = { contents: [{ parts: [{ text: prompt }] }] };
                    } else {
                        bodyPayload = { model: model, prompt: { text: prompt } };
                    }

                    response = await fetchFn(aiApiUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
                        body: JSON.stringify(bodyPayload)
                    });
                }
            } catch (err) {
                console.error('Google auth/process error:', err);
                return res.status(500).json({ error: 'Google AI auth error', details: err.message });
            }
        } else {
            // Generic provider: use API key in Authorization Bearer header (or as configured)
            if (!aiApiKey) return res.status(500).json({ error: 'AI API key not configured on server' });
            response = await fetchFn(aiApiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${aiApiKey}`
                },
                body: JSON.stringify({ prompt })
            });
        }

        if (!response.ok) {
            const txt = await response.text();
            console.error('AI provider responded with error', response.status, txt);
            return res.status(500).json({ error: 'AI provider error', details: txt });
        }

        const respText = await response.text();
        let aiResult;
        try { aiResult = JSON.parse(respText); } catch (e) { aiResult = { text: respText }; }

        return res.json({ success: true, ai: aiResult, items: items.slice(0, 200) });
    } catch (err) {
        console.error('POST /api/reports/stock-ai error:', err);
        return res.status(500).json({ error: 'Failed to generate AI stock report', details: err.message });
    }
}

// Store AI report in database
async function storeAiReport(db, entry) {
    const { prompt, raw, parsed, items } = entry;
    const reportId = Date.now().toString(36) + Math.random().toString(36).slice(2,6);
    
    // Store one row per suggestion
    if (parsed && parsed.suggestions && Array.isArray(parsed.suggestions)) {
        const insertPromises = parsed.suggestions.map(suggestion => 
            db.AI_Analysis_Log.create({
                ItemID: suggestion.ItemID || null,
                Date: new Date(),
                Notes: suggestion.reason || '',
                ReportType: 'stock_report',
                AIProvider: 'gemini',
                PromptText: prompt,
                RawResponse: JSON.stringify(raw),
                ParsedSuggestions: JSON.stringify(parsed),
                SuggestedQty: suggestion.suggestedQty || null,
                Priority: suggestion.priority || null,
                Status: 'suggested'
            })
        );
        await Promise.all(insertPromises);
    } else {
        // Fallback: store one row with no specific item
        await db.AI_Analysis_Log.create({
            ItemID: null,
            Date: new Date(),
            Notes: 'AI report generated',
            ReportType: 'stock_report',
            AIProvider: 'gemini',
            PromptText: prompt,
            RawResponse: JSON.stringify(raw),
            ParsedSuggestions: JSON.stringify(parsed || {}),
            Status: 'suggested'
        });
    }
    
    return { id: reportId, generatedAt: new Date(), status: 'suggested', ...entry };
}

function parseAiResult(aiResult) {
    if (!aiResult) return { suggestions: [] };
    // Handle Google Gemini / generativeLanguage response shape
    try {
        if (aiResult && aiResult.candidates && Array.isArray(aiResult.candidates) && aiResult.candidates.length) {
            const c = aiResult.candidates[0];
            const partText = c && c.content && c.content.parts && c.content.parts[0] && c.content.parts[0].text;
            if (partText) {
                // extract JSON inside triple-backtick fenced block or plain JSON
                const fenced = partText.match(/```(?:json)?\n([\s\S]*?)```/);
                const jsonText = fenced ? fenced[1] : partText;
                try {
                    const parsed = JSON.parse(jsonText);
                    if (Array.isArray(parsed.suggestions)) return { suggestions: parsed.suggestions };
                    if (Array.isArray(parsed.topReorder)) return { suggestions: parsed.topReorder.map(id => ({ ItemID: id, ItemName: '', reason: 'AI suggested reorder', suggestedQty: 1, priority: 'high' })) };
                } catch (e) {
                    // fallthrough to other handlers
                }
            }
        }
    } catch (e) {
        // ignore
    }
    // If provider returned structured object
    if (typeof aiResult === 'object') {
        if (Array.isArray(aiResult.suggestions)) return { suggestions: aiResult.suggestions };
        if (Array.isArray(aiResult.topReorder)) {
            return { suggestions: aiResult.topReorder.map(id => ({ ItemID: id, ItemName: '', reason: 'AI suggested reorder', suggestedQty: 1, priority: 'high' })) };
        }
    }
    // Try to extract JSON from text
    try {
        const txt = (aiResult && aiResult.text) ? aiResult.text : (typeof aiResult === 'string' ? aiResult : '');
        const jmatch = txt.match(/\{[\s\S]*\}/);
        if (jmatch) {
            const parsed = JSON.parse(jmatch[0]);
            if (Array.isArray(parsed.suggestions)) return { suggestions: parsed.suggestions };
        }
    } catch (e) {
        // ignore parse errors
    }
    return { suggestions: [], rawText: (aiResult && aiResult.text) ? aiResult.text : (typeof aiResult === 'string' ? aiResult : '') };
}

async function getAiReportHistory(req, res) {
    try {
        const db = req.db;
        if (!db || !db.AI_Analysis_Log) return res.status(500).json({ error: 'DB not configured' });
        
        const reports = await db.AI_Analysis_Log.findAll({
            where: { ReportType: 'stock_report' },
            order: [['Date', 'DESC']],
            limit: 100,
            include: [{
                model: db.Item,
                as: 'Item',
                attributes: ['ItemID', 'ItemName'],
                required: false
            }],
            raw: false
        });
        
        // Group by ParsedSuggestions to reconstruct reports
        const reportMap = new Map();
        
        for (const record of reports) {
            const parsed = record.ParsedSuggestions ? JSON.parse(record.ParsedSuggestions) : {};
            const parsedKey = record.ParsedSuggestions || `default-${record.AnalysisID}`;
            
            if (!reportMap.has(parsedKey)) {
                reportMap.set(parsedKey, {
                    id: `report-${record.AnalysisID}`,
                    generatedAt: record.Date,
                    prompt: record.PromptText,
                    raw: record.RawResponse ? JSON.parse(record.RawResponse) : null,
                    parsed: parsed,
                    suggestions: [],
                    status: record.Status
                });
            }
            
            const report = reportMap.get(parsedKey);
            report.suggestions.push({
                AnalysisID: record.AnalysisID,
                ItemID: record.ItemID,
                ItemName: record.Item ? record.Item.ItemName : null,
                reason: record.Notes,
                suggestedQty: record.SuggestedQty,
                priority: record.Priority,
                status: record.Status
            });
        }
        
        return res.json({ success: true, reports: Array.from(reportMap.values()) });
    } catch (err) {
        console.error('GET /api/reports/ai-history error:', err);
        return res.status(500).json({ error: 'Failed to get AI history', details: err.message });
    }
}

async function markAiReportOrdered(req, res) {
    try {
        const db = req.db;
        if (!db || !db.AI_Analysis_Log) return res.status(500).json({ error: 'DB not configured' });
        
        const id = req.params.id;
        // id format: report-{AnalysisID}
        const analysisId = parseInt(id.replace('report-', ''));
        
        const [updated] = await db.AI_Analysis_Log.update(
            { Status: 'ordered' },
            { where: { AnalysisID: analysisId } }
        );
        
        if (updated === 0) {
            return res.status(404).json({ error: 'Report not found' });
        }
        
        return res.json({ success: true, message: 'Report marked as ordered' });
    } catch (err) {
        console.error('POST /api/reports/ai-history/:id/mark-ordered error:', err);
        return res.status(500).json({ error: 'Failed to mark report ordered', details: err.message });
    }
}

// Wrap generateAiStockReport to also parse and store the result in cache
async function generateAiStockReportWrapper(req, res) {
    try {
        const db = req.db;
        if (!db || !db.Item) return res.status(500).json({ error: 'DB not configured' });

        // Fetch items (sorted by stock ascending so low-stock first)
        const items = await db.Item.findAll({ attributes: ['ItemID','ItemName','StockQuantity','Price'], order: [['StockQuantity','ASC']], raw: true });

        // Build a concise prompt for the AI service
        const sample = items.slice(0, 50).map(i => `${i.ItemID} | ${i.ItemName} | stock:${i.StockQuantity} | price:${i.Price}`).join('\n');
        const prompt = `You are an inventory analyst for a school giftstore. Given the following items (ID | Name | stock | price), produce a JSON object containing:\n` +
            `- summary: a short human-readable summary of current stock health\n` +
            `- suggestions: an array of suggestions for items to reorder with fields { ItemID, ItemName, reason, suggestedQty, priority }\n` +
            `- topReorder: an ordered list of up to 5 ItemIDs to reorder immediately.\n\nItems:\n${sample}\n\nReturn only valid JSON (no extra commentary).`;

        // Reuse the same AI call logic from original function
        const aiApiUrl = req.app.get('aiApiUrl') || process.env.AI_API_URL;
        const aiApiKey = req.app.get('aiApiKey') || process.env.AI_API_KEY;
        const aiModel = req.app.get('aiModel') || process.env.AI_MODEL;
        
        if (!aiApiUrl) {
            return res.status(500).json({ error: 'AI API URL not configured (set AI_API_URL in config or environment)' });
        }
        
        const fetchFn = (typeof fetch === 'function') ? fetch : require('node-fetch');
        let response;
        if (aiApiUrl.toLowerCase().includes('generativelanguage.googleapis.com')) {
            try {
                const isGenerateContent = aiApiUrl.includes(':generateContent');
                // Prefer API key if provided (simpler than ADC for quick testing)
                if (aiApiKey && aiApiKey.trim()) {
                    const headers = { 'Content-Type': 'application/json', 'X-goog-api-key': aiApiKey };
                    let bodyPayload = isGenerateContent ? { contents: [{ parts: [{ text: prompt }] }] } : { model: aiModel || 'models/gemini-1.0', prompt: { text: prompt } };
                    response = await fetchFn(aiApiUrl, { method: 'POST', headers, body: JSON.stringify(bodyPayload) });
                } else {
                    // No API key: use ADC OAuth flow (service account or gcloud ADC) - only when explicitly configured
                    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.GCLOUD_PROJECT) {
                        return res.status(500).json({ error: 'No API key provided and no Google credentials configured (set AI_API_KEY or GOOGLE_APPLICATION_CREDENTIALS)' });
                    }
                    const { GoogleAuth } = require('google-auth-library');
                    const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
                    const client = await auth.getClient();
                    const accessTokenObj = await client.getAccessToken();
                    const accessToken = (accessTokenObj && accessTokenObj.token) ? accessTokenObj.token : accessTokenObj;
                    if (!accessToken) return res.status(500).json({ error: 'Failed to obtain Google access token (check GOOGLE_APPLICATION_CREDENTIALS)' });
                    let bodyPayload = isGenerateContent ? { contents: [{ parts: [{ text: prompt }] }] } : { model: aiModel || 'models/gemini-1.0', prompt: { text: prompt } };
                    response = await fetchFn(aiApiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` }, body: JSON.stringify(bodyPayload) });
                }
            } catch (err) {
                console.error('Google auth/process error:', err);
                return res.status(500).json({ error: 'Google AI auth error', details: err.message });
            }
        } else {
            if (!aiApiKey) return res.status(500).json({ error: 'AI API key not configured on server' });
            response = await fetchFn(aiApiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${aiApiKey}` }, body: JSON.stringify({ prompt }) });
        }

        if (!response.ok) {
            const txt = await response.text();
            console.error('AI provider responded with error', response.status, txt);
            return res.status(500).json({ error: 'AI provider error', details: txt });
        }

        const respText = await response.text();
        let aiResult;
        try { aiResult = JSON.parse(respText); } catch (e) { aiResult = { text: respText }; }

        const parsed = parseAiResult(aiResult);
        const rec = await storeAiReport(db, { prompt, raw: aiResult, parsed, items: items.slice(0,200) });
        return res.json({ success: true, ai: aiResult, items: items.slice(0,200), reportId: rec.id });
    } catch (err) {
        console.error('Wrapped POST /api/reports/stock-ai error:', err);
        return res.status(500).json({ error: 'Failed to generate AI stock report', details: err.message });
    }
}

// Generate regular reports (stock, reservations, sales)
async function generateReport(req, res) {
    try {
        const db = req.db;
        if (!db) return res.status(500).json({ error: 'DB not configured' });
        
        const { reportType, dateFrom, dateTo } = req.body;
        
        console.log('Generate Report - Type:', reportType, 'From:', dateFrom, 'To:', dateTo);
        
        if (!reportType) {
            return res.status(400).json({ error: 'Report type is required' });
        }
        
        // Validate date filters for reservations and sales reports
        if (reportType === 'reservations' || reportType === 'sales') {
            if (!dateFrom || !dateTo) {
                return res.status(400).json({ error: 'Date range is required for this report type' });
            }
            
            const fromDate = new Date(dateFrom);
            const toDate = new Date(dateTo);
            const today = new Date();
            today.setHours(23, 59, 59, 999); // End of today
            
            // Check if dates are valid
            if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
                return res.status(400).json({ error: 'Invalid date format' });
            }
            
            // Check if either date is in the future
            if (fromDate > today || toDate > today) {
                return res.status(400).json({ error: 'Date cannot be in the future' });
            }
            
            // Check if from date is after to date
            if (fromDate > toDate) {
                return res.status(400).json({ error: 'Start date cannot be after end date' });
            }
        }
        
        let reportData = {};
        
        switch (reportType) {
            case 'stock':
                const items = await db.Item.findAll({
                    attributes: ['ItemID', 'ItemName', 'StockQuantity', 'Price', 'CategoryID'],
                    include: [
                        {
                            model: db.Category,
                            as: 'Category',
                            attributes: ['CategoryName']
                        },
                        {
                            model: db.Item_Variant,
                            as: 'Variants',
                            attributes: ['VariantID', 'Size', 'StockQuantity', 'Price'],
                            required: false
                        }
                    ],
                    order: [['StockQuantity', 'ASC']],
                    raw: false
                });
                
                // Build stock rows including variants
                const stockRows = [];
                
                for (const item of items) {
                    const hasVariants = !!(item.Variants && item.Variants.length > 0);
                    
                    if (!hasVariants) {
                        // Only add base item row if it has NO variants
                        const lastRestock = await db.Inventory_Transaction.findOne({
                            where: {
                                ItemID: item.ItemID,
                                VariantID: null,
                                Type: 'Restock',
                                QuantityChange: { [db.Sequelize.Op.gt]: 0 }
                            },
                            order: [['Date', 'DESC']],
                            attributes: ['Date', 'QuantityChange'],
                            raw: true
                        });
                        stockRows.push({
                            ItemID: item.ItemID,
                            ItemName: item.ItemName,
                            Variant: null,
                            Stock: item.StockQuantity,
                            Price: item.Price,
                            Category: item.Category ? item.Category.CategoryName : 'N/A',
                            LastRestockDate: lastRestock ? lastRestock.Date : null,
                            LastRestockQty: lastRestock ? lastRestock.QuantityChange : null
                        });
                    }
                    
                    // Add variant rows if any
                    if (hasVariants) {
                        for (const variant of item.Variants) {
                            const variantRestock = await db.Inventory_Transaction.findOne({
                                where: {
                                    ItemID: item.ItemID,
                                    VariantID: variant.VariantID,
                                    Type: 'Restock',
                                    QuantityChange: { [db.Sequelize.Op.gt]: 0 }
                                },
                                order: [['Date', 'DESC']],
                                attributes: ['Date', 'QuantityChange'],
                                raw: true
                            });
                            stockRows.push({
                                ItemID: item.ItemID,
                                ItemName: item.ItemName,
                                Variant: variant.Size,
                                Stock: variant.StockQuantity,
                                Price: (variant.Price == null ? item.Price : variant.Price),
                                Category: item.Category ? item.Category.CategoryName : 'N/A',
                                LastRestockDate: variantRestock ? variantRestock.Date : null,
                                LastRestockQty: variantRestock ? variantRestock.QuantityChange : null
                            });
                        }
                    }
                }
                
                reportData = {
                    type: 'stock',
                    generatedAt: new Date(),
                    dateFrom: dateFrom ? dateFrom : null,
                    dateTo: dateTo ? dateTo : null,
                    totalItems: items.length,
                    totalRows: stockRows.length,
                    lowStockItems: stockRows.filter(i => i.Stock < 10).length,
                    outOfStock: stockRows.filter(i => i.Stock === 0).length,
                    items: stockRows
                };
                break;
                
            case 'reservations':
                let whereClause = {};
                if (dateFrom || dateTo) {
                    whereClause.DateReserved = {};
                    if (dateFrom) whereClause.DateReserved[db.Sequelize.Op.gte] = new Date(dateFrom);
                    if (dateTo) whereClause.DateReserved[db.Sequelize.Op.lte] = new Date(dateTo);
                }
                
                const reservations = await db.Reservation.findAll({
                    where: whereClause,
                    include: [{
                        model: db.Student,
                        as: 'Student',
                        attributes: ['FullName', 'Email', 'StudentIDNumber']
                    }],
                    order: [['DateReserved', 'DESC']],
                    raw: false
                });
                
                reportData = {
                    type: 'reservations',
                    generatedAt: new Date(),
                    dateFrom: dateFrom || null,
                    dateTo: dateTo || null,
                    totalReservations: reservations.length,
                    pending: reservations.filter(r => r.Status === 'Pending').length,
                    confirmed: reservations.filter(r => r.Status === 'Confirmed').length,
                    cancelled: reservations.filter(r => r.Status === 'Cancelled').length,
                    reservations: reservations.map(r => ({
                        ReservationID: r.ReservationID,
                        ReservationCode: r.ReservationCode,
                        Status: r.Status,
                        DateReserved: r.DateReserved,
                        StudentName: r.Student ? r.Student.FullName : 'N/A',
                        StudentEmail: r.Student ? r.Student.Email : 'N/A'
                    }))
                };
                break;
                
            case 'sales':
                let purchaseWhereClause = {};
                if (dateFrom || dateTo) {
                    purchaseWhereClause.DatePurchased = {};
                    if (dateFrom) purchaseWhereClause.DatePurchased[db.Sequelize.Op.gte] = new Date(dateFrom);
                    if (dateTo) purchaseWhereClause.DatePurchased[db.Sequelize.Op.lte] = new Date(dateTo);
                }
                
                const purchases = await db.Purchase.findAll({
                    where: purchaseWhereClause,
                    include: [
                        {
                            model: db.Payment,
                            as: 'Payments',
                            attributes: ['AmountPaid', 'PaymentStatus']
                        },
                        {
                            model: db.Purchase_Items,
                            as: 'Items',
                            attributes: ['PurchaseItemID', 'ItemID', 'VariantID', 'Quantity', 'PriceAtPurchase'],
                            include: [
                                {
                                    model: db.Item,
                                    as: 'Item',
                                    attributes: ['ItemName']
                                },
                                {
                                    model: db.Item_Variant,
                                    as: 'Variant',
                                    attributes: ['Size'],
                                    required: false
                                }
                            ]
                        }
                    ],
                    order: [['DatePurchased', 'DESC']],
                    raw: false
                });
                
                const totalRevenue = purchases.reduce((sum, p) => {
                    const paid = p.Payments ? p.Payments.reduce((s, pay) => s + parseFloat(pay.AmountPaid || 0), 0) : 0;
                    return sum + paid;
                }, 0);
                
                // Calculate total items sold
                const totalItemsSold = purchases.reduce((sum, p) => {
                    return sum + (p.Items ? p.Items.reduce((s, item) => s + item.Quantity, 0) : 0);
                }, 0);
                
                reportData = {
                    type: 'sales',
                    generatedAt: new Date(),
                    dateFrom: dateFrom || null,
                    dateTo: dateTo || null,
                    totalPurchases: purchases.length,
                    totalItemsSold: totalItemsSold,
                    totalRevenue: totalRevenue.toFixed(2),
                    purchases: purchases.map(p => ({
                        PurchaseID: p.PurchaseID,
                        PurchaseType: p.PurchaseType,
                        DatePurchased: p.DatePurchased,
                        TotalAmount: p.TotalAmount,
                        AmountPaid: p.Payments ? p.Payments.reduce((s, pay) => s + parseFloat(pay.AmountPaid || 0), 0) : 0,
                        Items: p.Items ? p.Items.map(item => ({
                            ItemName: item.Item ? item.Item.ItemName : 'Unknown',
                            Variant: item.Variant ? item.Variant.Size : null,
                            Quantity: item.Quantity,
                            PriceAtPurchase: item.PriceAtPurchase
                        })) : []
                    }))
                };
                break;
                
            default:
                return res.status(400).json({ error: 'Invalid report type' });
        }
        
        console.log('Sending report data:', JSON.stringify(reportData, null, 2));
        res.json({ success: true, report: reportData });
    } catch (err) {
        console.error('Error generating report:', err);
        res.status(500).json({ error: 'Failed to generate report', details: err.message });
    }
}

module.exports.generateReport = generateReport;
module.exports.generateAiStockReport = generateAiStockReportWrapper;
module.exports.getAiReportHistory = getAiReportHistory;
module.exports.markAiReportOrdered = markAiReportOrdered;

// ================= Super Admin (Admin Accounts) =================
// Use native bcrypt if available; fallback to bcryptjs for portability
let bcrypt;
try { bcrypt = require('bcrypt'); } catch (e) {
    try { bcrypt = require('bcryptjs'); console.warn('Fallback to bcryptjs (native bcrypt not installed).'); } catch (e2) {
        console.error('No bcrypt implementation available. Install bcrypt or bcryptjs.');
        bcrypt = { hash: async () => { throw new Error('bcrypt unavailable'); }, compare: async () => false };
    }
}
const SALT_ROUNDS = 10;

async function superUserAuth(req, res, next) {
    try {
        const headerSecret = req.headers['x-superuser-secret'];
        const expected = req.app.get('superuserSecret');
        if (!expected || !headerSecret || headerSecret !== expected) {
            return res.status(403).json({ error: 'Forbidden: invalid superuser secret' });
        }
        next();
    } catch (err) {
        return res.status(500).json({ error: 'Auth middleware error' });
    }
}

async function listAdmins(req, res) {
    try {
        const db = req.db;
        if (!db || !db.Admin) return res.status(500).json({ error: 'DB not configured' });
        const admins = await db.Admin.findAll({ raw: true, order: [['AdminID','ASC']] });
        const sanitized = admins.map(a => ({
            AdminID: a.AdminID,
            Username: a.Username,
            Name: a.Name,
            Role: a.Role,
            IsActive: !!a.IsActive,
            DateCreated: a.DateCreated,
            LastLoginAt: a.LastLoginAt
        }));
        res.json(sanitized);
    } catch (err) {
        res.status(500).json({ error: 'Failed to list admins', details: err.message });
    }
}

async function createAdmin(req, res) {
    try {
        const db = req.db;
        if (!db || !db.Admin) return res.status(500).json({ error: 'DB not configured' });
        const { Username, Name, Password, Role } = req.body;
        if (!Username || !Password) return res.status(400).json({ error: 'Username and Password required' });
        const existing = await db.Admin.findOne({ where: { Username }, raw: true });
        if (existing) return res.status(400).json({ error: 'Username already exists' });
        const hash = await bcrypt.hash(String(Password), SALT_ROUNDS);
        const created = await db.Admin.create({ Username: Username.trim(), Name: Name || null, PasswordHash: hash, Role: Role || 'admin' });
        res.status(201).json({ success: true, admin: { AdminID: created.AdminID, Username: created.Username, Name: created.Name, Role: created.Role, IsActive: !!created.IsActive } });
    } catch (err) {
        console.error('createAdmin error:', err);
        res.status(500).json({ error: 'Failed to create admin', details: err.message });
    }
}

async function updateAdmin(req, res) {
    try {
        const db = req.db;
        if (!db || !db.Admin) return res.status(500).json({ error: 'DB not configured' });
        const adminId = parseInt(req.params.id, 10);
        if (isNaN(adminId)) return res.status(400).json({ error: 'Invalid admin ID' });
        const { Role, Name, IsActive } = req.body;
        const admin = await db.Admin.findByPk(adminId);
        if (!admin) return res.status(404).json({ error: 'Admin not found' });
        
        const updateData = {};
        if (Role !== undefined && Role !== null && Role !== '') {
            updateData.Role = Role;
        }
        if (Name !== undefined) {
            updateData.Name = Name;
        }
        if (IsActive !== undefined && IsActive !== null) {
            updateData.IsActive = IsActive ? 1 : 0;
        }
        
        await admin.update(updateData);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update admin', details: err.message });
    }
}

async function resetAdminPassword(req, res) {
    try {
        const db = req.db;
        if (!db || !db.Admin) return res.status(500).json({ error: 'DB not configured' });
        const adminId = parseInt(req.params.id, 10);
        if (isNaN(adminId)) return res.status(400).json({ error: 'Invalid admin ID' });
        const { NewPassword } = req.body;
        if (!NewPassword) return res.status(400).json({ error: 'NewPassword required' });
        const admin = await db.Admin.findByPk(adminId);
        if (!admin) return res.status(404).json({ error: 'Admin not found' });
        const hash = await bcrypt.hash(String(NewPassword), SALT_ROUNDS);
        await admin.update({ PasswordHash: hash });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to reset password', details: err.message });
    }
}

async function deactivateAdmin(req, res) {
    try {
        const db = req.db;
        if (!db || !db.Admin) return res.status(500).json({ error: 'DB not configured' });
        const adminId = parseInt(req.params.id, 10);
        if (isNaN(adminId)) return res.status(400).json({ error: 'Invalid admin ID' });
        const admin = await db.Admin.findByPk(adminId);
        if (!admin) return res.status(404).json({ error: 'Admin not found' });
        await admin.update({ IsActive: 0 });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to deactivate admin', details: err.message });
    }
}

// ================= Enrolled Students Management =================
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

async function uploadEnrolledStudents(req, res) {
    try {
        const db = req.db;
        if (!db || !db.EnrolledStudent) {
            return res.status(500).json({ error: 'DB not configured' });
        }

        // Use multer middleware inline
        upload.single('csvFile')(req, res, async (err) => {
            if (err) {
                return res.status(400).json({ error: 'File upload failed', details: err.message });
            }

            if (!req.file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }

            try {
                const csvContent = req.file.buffer.toString('utf-8');
                const lines = csvContent.split('\n').map(line => line.trim()).filter(line => line);
                
                let inserted = 0;
                let updated = 0;
                let errors = 0;
                const errorDetails = [];

                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    // Skip header row if it exists
                    if (i === 0 && (line.toLowerCase().includes('student_id') || line.toLowerCase().includes('full_name'))) {
                        continue;
                    }

                    const parts = line.split(';').map(p => p.trim().replace(/^"|"$/g, '')); // Split by semicolon and remove quotes
                    if (parts.length < 2) {
                        errors++;
                        errorDetails.push(`Line ${i + 1}: Invalid format`);
                        continue;
                    }

                    const school_id = parts[0];
                    const full_name = parts.slice(1).join(';').trim(); // Handle names with semicolons

                    if (!school_id || !full_name) {
                        errors++;
                        errorDetails.push(`Line ${i + 1}: Missing data`);
                        continue;
                    }

                    try {
                        // Try to find existing student
                        const existing = await db.EnrolledStudent.findOne({ where: { school_id } });
                        
                        if (existing) {
                            // Update existing student
                            await existing.update({ full_name });
                            updated++;
                        } else {
                            // Insert new student
                            await db.EnrolledStudent.create({ school_id, full_name });
                            inserted++;
                        }
                    } catch (dbErr) {
                        errors++;
                        errorDetails.push(`Line ${i + 1}: ${dbErr.message}`);
                    }
                }

                res.json({
                    success: true,
                    inserted,
                    updated,
                    errors,
                    errorDetails: errorDetails.slice(0, 10) // Return first 10 errors
                });
            } catch (parseErr) {
                res.status(400).json({ error: 'Failed to parse CSV', details: parseErr.message });
            }
        });
    } catch (err) {
        res.status(500).json({ error: 'Upload failed', details: err.message });
    }
}

async function getEnrolledStudentsCount(req, res) {
    try {
        const db = req.db;
        if (!db || !db.EnrolledStudent) {
            return res.status(500).json({ error: 'DB not configured' });
        }

        const count = await db.EnrolledStudent.count();
        res.json({ success: true, count });
    } catch (err) {
        res.status(500).json({ error: 'Failed to get count', details: err.message });
    }
}

async function verifyEnrolledStudent(req, res) {
    try {
        const db = req.db;
        if (!db || !db.EnrolledStudent) {
            return res.status(500).json({ error: 'DB not configured' });
        }

        const studentId = req.params.studentId;
        if (!studentId) {
            return res.status(400).json({ success: false, error: 'Student ID required' });
        }

        const student = await db.EnrolledStudent.findOne({ 
            where: { school_id: studentId } 
        });

        if (student) {
            // Check for pending reservations by StudentIDNumber or Email
            let pendingReservation = null;
            if (db.Student && db.Reservation) {
                const { Op } = require('sequelize');
                
                // Find student record by StudentIDNumber
                const studentRecord = await db.Student.findOne({
                    where: { StudentIDNumber: studentId }
                });
                
                if (studentRecord) {
                    // Check for active reservations (Pending or Approved)
                    pendingReservation = await db.Reservation.findOne({
                        where: {
                            StudentID: studentRecord.StudentID,
                            Status: { [Op.in]: ['Pending', 'Approved'] }
                        },
                        order: [['DateReserved', 'DESC']]
                    });
                }
            }
            
            res.json({ 
                success: true, 
                student: {
                    school_id: student.school_id,
                    full_name: student.full_name
                },
                hasPendingReservation: !!pendingReservation,
                pendingReservation: pendingReservation ? {
                    code: pendingReservation.ReservationCode,
                    status: pendingReservation.Status,
                    dateReserved: pendingReservation.DateReserved
                } : null
            });
        } else {
            res.json({ success: false, error: 'Student not found' });
        }
    } catch (err) {
        res.status(500).json({ success: false, error: 'Verification failed', details: err.message });
    }
}

module.exports.superUserAuth = superUserAuth;
module.exports.listAdmins = listAdmins;
module.exports.createAdmin = createAdmin;
module.exports.updateAdmin = updateAdmin;
module.exports.resetAdminPassword = resetAdminPassword;
module.exports.deactivateAdmin = deactivateAdmin;
module.exports.uploadEnrolledStudents = uploadEnrolledStudents;
module.exports.getEnrolledStudentsCount = getEnrolledStudentsCount;
module.exports.verifyEnrolledStudent = verifyEnrolledStudent;
// ================= Admin Login & Session =================
const crypto = require('crypto');
const adminSessions = new Map(); // sessionId -> { AdminID, Username, Role }

function adminAuth(req, res, next) {
    const sid = (req.cookies && req.cookies.admin_session) || null;
    if (!sid || !adminSessions.has(sid)) {
        return res.redirect('/AdminLogin');
    }
    req.admin = adminSessions.get(sid);
    next();
}

// Optional admin auth - populates req.admin if session exists but doesn't redirect
function optionalAdminAuth(req, res, next) {
    const sid = (req.cookies && req.cookies.admin_session) || null;
    if (sid && adminSessions.has(sid)) {
        req.admin = adminSessions.get(sid);
    }
    next();
}

async function adminLogin(req, res) {
    try {
        const { Username, Password } = req.body;
        if (!Username || !Password) return res.status(400).render('AdminLogin', { error: 'Username and Password required' });
        const db = req.db;
        if (!db || !db.Admin) return res.status(500).render('AdminLogin', { error: 'DB not configured' });
        const admin = await db.Admin.findOne({ where: { Username, IsActive: 1 } });
        if (!admin) return res.status(401).render('AdminLogin', { error: 'Invalid credentials' });
        const ok = await bcrypt.compare(String(Password), admin.PasswordHash);
        if (!ok) return res.status(401).render('AdminLogin', { error: 'Invalid credentials' });
        await admin.update({ LastLoginAt: new Date() });
        const sessionId = crypto.randomBytes(24).toString('hex');
        adminSessions.set(sessionId, { AdminID: admin.AdminID, Username: admin.Username, Name: admin.Name, Role: admin.Role });
        res.cookie('admin_session', sessionId, { httpOnly: true, sameSite: 'lax' });
        // Redirect superuser directly to SuperAdmin management page; others to dashboard
        if (admin.Role === 'superuser') {
            return res.redirect('/SuperAdmin');
        }
        res.redirect('/AdminDashboard');
    } catch (err) {
        console.error('adminLogin error:', err);
        res.status(500).render('AdminLogin', { error: 'Server error' });
    }
}

function adminLoginPage(req, res) {
    res.render('AdminLogin', { error: null });
}

function adminLogout(req, res) {
    const sid = (req.cookies && req.cookies.admin_session) || null;
    if (sid) adminSessions.delete(sid);
    res.clearCookie('admin_session');
    res.redirect('/AdminLogin');
}

module.exports.adminAuth = adminAuth;
module.exports.optionalAdminAuth = optionalAdminAuth;
module.exports.adminLogin = adminLogin;
module.exports.adminLoginPage = adminLoginPage;
module.exports.adminLogout = adminLogout;
function adminRole(requiredRole){
    return (req, res, next) => {
        if(!req.admin || !req.admin.Role){
            return res.redirect('/AdminLogin');
        }
        if(req.admin.Role !== requiredRole){
            return res.status(403).send('Forbidden: insufficient role');
        }
        next();
    };
}
module.exports.adminRole = adminRole;

// Get a single reservation by code
async function getReservationByCode(req, res) {
    try {
        const db = req.db;
        if (!db || !db.Reservation) return res.status(500).json({ error: 'DB not configured' });

        const { code } = req.params;
        const reservation = await db.Reservation.findOne({ 
            where: { ReservationCode: code },
            raw: true 
        });

        if (!reservation) {
            return res.status(404).json({ error: 'Reservation not found' });
        }

        // Get reservation items
        let items = [];
        if (db.Reservation_Item) {
            const resItems = await db.Reservation_Item.findAll({
                where: { ReservationID: reservation.ReservationID },
                raw: true
            });

            // Get item details
            const itemIds = [...new Set(resItems.map(i => i.ItemID).filter(Boolean))];
            let itemsData = [];
            if (itemIds.length && db.Item) {
                const { Op } = require('sequelize');
                itemsData = await db.Item.findAll({
                    where: { ItemID: { [Op.in]: itemIds } },
                    raw: true
                });
            }

            const itemMap = {};
            itemsData.forEach(item => { itemMap[item.ItemID] = item; });

            items = resItems.map(ri => {
                const item = itemMap[ri.ItemID];
                return {
                    ProductName: item ? item.ItemName : 'Unknown',
                    VariantName: '',
                    Quantity: ri.Quantity
                };
            });
        }

        // Get student information
        let studentName = 'Guest';
        let studentIdNumber = '';
        if (reservation.StudentID && db.Student) {
            const student = await db.Student.findByPk(reservation.StudentID, { raw: true });
            if (student) {
                studentName = student.FullName || student.StudentName || 'Guest';
                studentIdNumber = student.StudentIDNumber || '';
            }
        }

        res.json({
            ReservationCode: reservation.ReservationCode,
            ReservationID: reservation.ReservationID,
            Status: reservation.Status,
            DateReserved: reservation.DateReserved,
            CancelWindowExpires: reservation.CancelWindowExpires,
            StudentName: studentName,
            StudentIDNumber: studentIdNumber,
            Items: items
        });
    } catch (err) {
        console.error('getReservationByCode error:', err);
        res.status(500).json({ error: 'Failed to fetch reservation' });
    }
}

module.exports.getReservationByCode = getReservationByCode;

// Cancel a reservation
async function cancelReservation(req, res) {
    try {
        const db = req.db;
        if (!db || !db.Reservation) return res.status(500).json({ error: 'DB not configured' });

        const { code } = req.params;
        const reservation = await db.Reservation.findOne({ 
            where: { ReservationCode: code }
        });

        if (!reservation) {
            return res.status(404).json({ success: false, message: 'Reservation not found' });
        }

        // Check if cancel window has expired (only for non-admin users)
        const isAdmin = req.admin && req.admin.AdminID;
        if (!isAdmin) {
            const now = new Date();
            const cancelExpires = new Date(reservation.CancelWindowExpires);
            if (now > cancelExpires) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Cancel window has expired. You can no longer cancel this reservation.' 
                });
            }
        }

        // Update status to Canceled
        await reservation.update({ Status: 'Canceled' });

        // Restore inventory: get reservation items and add quantities back to Item stock
        const emailItems = [];
        if (db.Reservation_Item && db.Item) {
            const resItems = await db.Reservation_Item.findAll({
                where: { ReservationID: reservation.ReservationID }
            });

            for (const item of resItems) {
                const itemRecord = await db.Item.findByPk(item.ItemID);
                if (itemRecord) {
                    await itemRecord.update({ 
                        StockQuantity: itemRecord.StockQuantity + item.Quantity 
                    });
                    
                    // Log inventory transaction for stock restoration
                    if (db.Inventory_Transaction) {
                        await db.Inventory_Transaction.create({
                            ItemID: item.ItemID,
                            QuantityChange: item.Quantity,
                            Type: 'Restock',
                            Reference: `Reservation ${code} canceled - Stock restored`,
                            AdminID: (req.admin && req.admin.AdminID) || null,
                            Date: new Date()
                        });
                    }
                    
                    // Collect items for email
                    emailItems.push({
                        productName: itemRecord.ItemName,
                        variantName: '',
                        quantity: item.Quantity
                    });
                }
            }
        }

        // Send cancellation confirmation email
        if (db.Student && reservation.StudentID) {
            try {
                const student = await db.Student.findByPk(reservation.StudentID);
                if (student && student.Email && student.Email.includes('@') && !student.Email.includes('guest+')) {
                    await sendCancellationEmail(student.Email, {
                        reservationCode: reservation.ReservationCode,
                        studentName: student.FullName || 'Guest',
                        items: emailItems
                    });
                }
            } catch (emailErr) {
                console.error('Failed to send cancellation email:', emailErr);
                // Don't fail the cancellation if email fails
            }
        }

        res.json({ success: true, message: 'Reservation canceled and inventory restored' });
    } catch (err) {
        console.error('cancelReservation error:', err);
        res.status(500).json({ success: false, message: 'Failed to cancel reservation' });
    }
}

// Get system configuration
async function getSystemConfig(req, res) {
    try {
        const db = req.db;
        if (!db || !db.SystemConfig) return res.status(500).json({ error: 'DB not configured' });
        
        const { key } = req.params;
        const config = await db.SystemConfig.findOne({ where: { ConfigKey: key }, raw: true });
        
        if (!config) {
            return res.status(404).json({ error: 'Configuration not found' });
        }
        
        res.json(config);
    } catch (err) {
        console.error('GET /api/config/:key error:', err);
        res.status(500).json({ error: 'Failed to fetch configuration', details: err.message });
    }
}

// Update system configuration
async function updateSystemConfig(req, res) {
    try {
        const db = req.db;
        if (!db || !db.SystemConfig) return res.status(500).json({ error: 'DB not configured' });
        
        const { key } = req.params;
        const { value } = req.body;
        
        if (value === undefined || value === null) {
            return res.status(400).json({ error: 'Value is required' });
        }
        
        const config = await db.SystemConfig.findOne({ where: { ConfigKey: key } });
        
        if (!config) {
            return res.status(404).json({ error: 'Configuration not found' });
        }
        
        await config.update({ ConfigValue: String(value) });
        
        res.json({ success: true, config });
    } catch (err) {
        console.error('PUT /api/config/:key error:', err);
        res.status(500).json({ error: 'Failed to update configuration', details: err.message });
    }
}

module.exports.cancelReservation = cancelReservation;
module.exports.getSystemConfig = getSystemConfig;
module.exports.updateSystemConfig = updateSystemConfig;

