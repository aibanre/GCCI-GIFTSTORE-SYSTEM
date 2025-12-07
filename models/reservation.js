"use strict";

module.exports = (sequelize, DataTypes) => {
  const Reservation = sequelize.define("Reservation", {
    ReservationID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    ReservationCode: { type: DataTypes.STRING(50), allowNull: false },
    StudentID: { type: DataTypes.INTEGER, allowNull: false },
    Status: { type: DataTypes.ENUM('Pending','Approved','Claimed','Expired','Canceled'), allowNull: false },
    DateReserved: { type: DataTypes.DATE, allowNull: false },
    CancelWindowExpires: { type: DataTypes.DATE, allowNull: false },
    ClaimDeadline: { type: DataTypes.DATE, allowNull: true },
  }, {
    tableName: "reservation",
    timestamps: false,
  });

  Reservation.associate = function(models) {
    // Reservation belongs to Student
    Reservation.belongsTo(models.Student, {
      foreignKey: 'StudentID',
      as: 'Student'
    });

    // Reservation has many Purchases
    Reservation.hasMany(models.Purchase, {
      foreignKey: 'ReservationID',
      as: 'Purchases'
    });
  };

  return Reservation;
};
