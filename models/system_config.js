"use strict";

module.exports = (sequelize, DataTypes) => {
  const SystemConfig = sequelize.define("SystemConfig", {
    ConfigID: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    ConfigKey: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true
    },
    ConfigValue: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    Description: {
      type: DataTypes.STRING(255),
      allowNull: true
    }
  }, {
    tableName: "system_config",
    timestamps: false
  });

  return SystemConfig;
};
