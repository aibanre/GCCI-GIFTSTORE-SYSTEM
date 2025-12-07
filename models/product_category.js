"use strict";

module.exports = (sequelize, DataTypes) => {
  const ProductCategory = sequelize.define("ProductCategory", {
    ProductCategoryID: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    ItemID: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    CategoryID: {
      type: DataTypes.INTEGER,
      allowNull: false
    }
  }, {
    tableName: "product_category",
    timestamps: false
  });

  ProductCategory.associate = function(models) {
    ProductCategory.belongsTo(models.Item, {
      foreignKey: 'ItemID',
      as: 'Item'
    });
    ProductCategory.belongsTo(models.Category, {
      foreignKey: 'CategoryID',
      as: 'Category'
    });
  };

  return ProductCategory;
};
