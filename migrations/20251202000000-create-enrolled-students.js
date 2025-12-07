'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('enrolled_students', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      school_id: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true
      },
      full_name: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Add index on school_id for faster lookups
    await queryInterface.addIndex('enrolled_students', ['school_id']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('enrolled_students');
  }
};
