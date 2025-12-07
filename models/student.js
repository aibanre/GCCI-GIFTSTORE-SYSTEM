"use strict";

module.exports = (sequelize, DataTypes) => {
  const Student = sequelize.define("Student", {
    StudentID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    FullName: { type: DataTypes.STRING(100), allowNull: false },
    Email: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    StudentIDNumber: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  }, {
    tableName: "student",
    timestamps: false,
  });

  Student.associate = function(models) {
    // Student has many Reservations
    Student.hasMany(models.Reservation, {
      foreignKey: 'StudentID',
      as: 'Reservations'
    });
  };

  return Student;
};
