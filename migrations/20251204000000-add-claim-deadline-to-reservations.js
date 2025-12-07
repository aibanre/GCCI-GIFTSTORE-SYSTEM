'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('reservation', 'ClaimDeadline', {
      type: Sequelize.DATE,
      allowNull: true,
      after: 'CancelWindowExpires'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('reservation', 'ClaimDeadline');
  }
};
