'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Create junction table for product-category many-to-many relationship
    await queryInterface.createTable('product_category', {
      ProductCategoryID: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      ItemID: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'item',
          key: 'ItemID'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      CategoryID: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'category',
          key: 'CategoryID'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      }
    });

    // Add unique constraint to prevent duplicate category assignments
    await queryInterface.addIndex('product_category', ['ItemID', 'CategoryID'], {
      unique: true,
      name: 'unique_item_category'
    });

    // Migrate existing data from item.CategoryID to product_category table
    await queryInterface.sequelize.query(`
      INSERT INTO product_category (ItemID, CategoryID)
      SELECT ItemID, CategoryID
      FROM item
      WHERE CategoryID IS NOT NULL
    `);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('product_category');
  }
};
