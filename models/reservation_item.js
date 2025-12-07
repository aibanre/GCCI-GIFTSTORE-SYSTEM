"use strict";

module.exports = (sequelize, DataTypes) => {
  const ReservationItem = sequelize.define("Reservation_Item", {
    ResItemID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    ReservationID: { type: DataTypes.INTEGER, allowNull: false },
    ItemID: { type: DataTypes.INTEGER, allowNull: false },
    Quantity: { type: DataTypes.INTEGER, allowNull: false },
  }, {
    tableName: "reservation_item",
    timestamps: false,
  });
  return ReservationItem;
};