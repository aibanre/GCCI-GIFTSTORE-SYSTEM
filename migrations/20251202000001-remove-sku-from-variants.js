"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('item_variant', 'SKU');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('item_variant', 'SKU', {
      type: Sequelize.STRING(64),
      allowNull: true,
      unique: true
    });
  }
};
