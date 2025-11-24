"use strict";

module.exports = (sequelize, DataTypes) => {
  const Category = sequelize.define(
    "Category",
    {
      CategoryID: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      CategoryName: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      AdminID: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      DateCreated: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      tableName: "category",
      timestamps: false,
    }
  );

  return Category;
};
