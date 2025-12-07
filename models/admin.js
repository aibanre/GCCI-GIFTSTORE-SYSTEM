"use strict";

module.exports = (sequelize, DataTypes) => {
  const Admin = sequelize.define("Admin", {
    AdminID: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    Username: { type: DataTypes.STRING(64), allowNull: false, unique: true },
    PasswordHash: { type: DataTypes.STRING(255), allowNull: false },
    Role: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'admin' },
    IsActive: { type: DataTypes.TINYINT, allowNull: false, defaultValue: 1 },
    DateCreated: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    LastLoginAt: { type: DataTypes.DATE, allowNull: true }
  }, {
    tableName: 'admin',
    timestamps: false,
    indexes: [
      { unique: true, fields: ['Username'] },
      { fields: ['Role'] }
    ]
  });
  return Admin;
};
