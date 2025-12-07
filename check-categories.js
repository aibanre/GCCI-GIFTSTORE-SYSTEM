const { sequelize } = require('./models');

async function checkCategories() {
    try {
        const [results] = await sequelize.query('SELECT * FROM product_category WHERE ItemID = 16');
        console.log('\nCategories for product 16:');
        console.log(JSON.stringify(results, null, 2));
        
        const [allResults] = await sequelize.query('SELECT * FROM product_category ORDER BY ItemID');
        console.log('\nAll product-category relationships:');
        console.log(JSON.stringify(allResults, null, 2));
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkCategories();
