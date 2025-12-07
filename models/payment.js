"use strict";

module.exports = (sequelize, DataTypes) => {
  const Payment = sequelize.define("Payment", {
    PaymentID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    PurchaseID: { type: DataTypes.INTEGER, allowNull: false },
    PaymentRef: { type: DataTypes.STRING(100), allowNull: false },
    AmountPaid: { type: DataTypes.DECIMAL(10,2), allowNull: false },
    PaymentStatus: { type: DataTypes.ENUM('Pending','Confirmed','Rejected'), allowNull: false },
    PaymentDate: { type: DataTypes.DATE, allowNull: false },
  }, {
    tableName: "payment",
    timestamps: false,
  });

  Payment.associate = function(models) {
    // Payment belongs to Purchase
    Payment.belongsTo(models.Purchase, {
      foreignKey: 'PurchaseID',
      as: 'Purchase'
    });
  };

  return Payment;
};
