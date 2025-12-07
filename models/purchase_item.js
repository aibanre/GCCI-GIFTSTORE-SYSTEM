"use strict";

module.exports = (sequelize, DataTypes) => {
  const Purchase_Items = sequelize.define("Purchase_Items", {
    PurchaseItemID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    PurchaseID: { type: DataTypes.INTEGER, allowNull: false },
    ItemID: { type: DataTypes.INTEGER, allowNull: false },
    VariantID: { type: DataTypes.INTEGER, allowNull: true },
    Quantity: { type: DataTypes.INTEGER, allowNull: false },
    PriceAtPurchase: { type: DataTypes.DECIMAL(10,2), allowNull: false },
  }, {
    tableName: "purchase_items",
    timestamps: false,
  });

  Purchase_Items.associate = function(models) {
    // Purchase_Items belongs to Purchase
    Purchase_Items.belongsTo(models.Purchase, {
      foreignKey: 'PurchaseID',
      as: 'Purchase'
    });

    // Purchase_Items belongs to Item
    Purchase_Items.belongsTo(models.Item, {
      foreignKey: 'ItemID',
      as: 'Item'
    });

    // Purchase_Items belongs to Item_Variant (optional)
    Purchase_Items.belongsTo(models.Item_Variant, {
      foreignKey: 'VariantID',
      as: 'Variant'
    });
  };

  return Purchase_Items;
};