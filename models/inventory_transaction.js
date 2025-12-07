"use strict";

module.exports = (sequelize, DataTypes) => {
  const InventoryTransaction = sequelize.define(
    "Inventory_Transaction",
    {
      TxID: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      ItemID: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      VariantID: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      QuantityChange: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      Type: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      Reference: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      Date: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      AdminID: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
    },
    {
      tableName: "Inventory_Transaction",
      timestamps: false,
    }
  );

  return InventoryTransaction;
};
