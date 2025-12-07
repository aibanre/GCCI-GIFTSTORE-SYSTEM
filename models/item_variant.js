"use strict";

module.exports = (sequelize, DataTypes) => {
  const ItemVariant = sequelize.define(
    "Item_Variant",
    {
      VariantID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      ItemID: { type: DataTypes.INTEGER, allowNull: false },
      Size: { type: DataTypes.STRING(32), allowNull: false },
      Price: { type: DataTypes.DECIMAL(10,2), allowNull: true }, // null => fallback to Item.Price
      StockQuantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      IsActive: { type: DataTypes.TINYINT, allowNull: false, defaultValue: 1 }
    },
    {
      tableName: "item_variant",
      timestamps: false,
      indexes: [
        { unique: false, fields: ["ItemID"] },
        { unique: false, fields: ["Size"] }
      ]
    }
  );

  ItemVariant.associate = (models) => {
    if (models.Item) {
      ItemVariant.belongsTo(models.Item, { foreignKey: "ItemID", onDelete: "CASCADE" });
      models.Item.hasMany(ItemVariant, { foreignKey: "ItemID" });
    }
  };

  return ItemVariant;
};
