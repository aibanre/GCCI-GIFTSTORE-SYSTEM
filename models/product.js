"use strict";

module.exports = (sequelize, DataTypes) => {
  const Product = sequelize.define(
    "Item",
    {
      ItemID: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      ItemName: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      Description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      Price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.0,
      },
      StockQuantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      IsActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      CategoryID: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      ImagePath: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
    },
    {
      tableName: "item",
      timestamps: false,
    }
  );

  Product.associate = function(models) {
    Product.belongsTo(models.Category, {
      foreignKey: 'CategoryID',
      as: 'Category'
    });
    Product.hasMany(models.Item_Variant, {
      foreignKey: 'ItemID',
      as: 'Variants'
    });
  };

  return Product;
};
