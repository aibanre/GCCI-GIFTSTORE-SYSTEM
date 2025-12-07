const { sequelize } = require('./models');

async function testProductCategories() {
    try {
        // Get a product with its categories
        const [products] = await sequelize.query(`
            SELECT 
                i.ItemID,
                i.ItemName,
                GROUP_CONCAT(c.CategoryName ORDER BY c.CategoryName) as Categories,
                GROUP_CONCAT(c.CategoryID ORDER BY c.CategoryName) as CategoryIDs
            FROM item i
            LEFT JOIN product_category pc ON i.ItemID = pc.ItemID
            LEFT JOIN category c ON pc.CategoryID = c.CategoryID
            WHERE i.ItemID IN (12, 16)
            GROUP BY i.ItemID, i.ItemName
        `);
        
        console.log('\n=== Products with Multiple Categories ===\n');
        products.forEach(p => {
            console.log(`Product: ${p.ItemName} (ID: ${p.ItemID})`);
            console.log(`Categories: ${p.Categories || 'None'}`);
            console.log(`Category IDs: ${p.CategoryIDs || 'None'}`);
            console.log('---');
        });
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

testProductCategories();
