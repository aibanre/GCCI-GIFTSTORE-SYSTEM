"use strict";

module.exports = (sequelize, DataTypes) => {
  const EnrolledStudent = sequelize.define("EnrolledStudent", {
    id: { 
      type: DataTypes.INTEGER, 
      primaryKey: true, 
      autoIncrement: true 
    },
    school_id: { 
      type: DataTypes.STRING(50), 
      allowNull: false, 
      unique: true 
    },
    full_name: { 
      type: DataTypes.STRING(100), 
      allowNull: false 
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: "enrolled_students",
    timestamps: false,
  });

  return EnrolledStudent;
};
