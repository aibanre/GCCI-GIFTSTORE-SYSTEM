"use strict";

module.exports = (sequelize, DataTypes) => {
  const Purchase = sequelize.define("Purchase", {
    PurchaseID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    ReservationID: { type: DataTypes.INTEGER, allowNull: true },
    PurchaseType: { type: DataTypes.ENUM('Reservation','Onsite'), allowNull: false },
    DatePurchased: { type: DataTypes.DATE, allowNull: false },
    TotalAmount: { type: DataTypes.DECIMAL(10,2), allowNull: false },
  }, {
    tableName: "purchase",
    timestamps: false,
  });

  Purchase.associate = function(models) {
    // Purchase has many Payments
    Purchase.hasMany(models.Payment, {
      foreignKey: 'PurchaseID',
      as: 'Payments'
    });

    // Purchase has many Purchase_Items
    Purchase.hasMany(models.Purchase_Items, {
      foreignKey: 'PurchaseID',
      as: 'Items'
    });

    // Purchase belongs to Reservation (optional)
    Purchase.belongsTo(models.Reservation, {
      foreignKey: 'ReservationID',
      as: 'Reservation'
    });
  };

  return Purchase;
};
