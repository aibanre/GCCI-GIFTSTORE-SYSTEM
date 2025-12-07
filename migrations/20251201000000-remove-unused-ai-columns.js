'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Remove unused columns from ai_analysis_log table
    await queryInterface.removeColumn('ai_analysis_log', 'PredictedDemand');
    await queryInterface.removeColumn('ai_analysis_log', 'LowStockRisk');
    await queryInterface.removeColumn('ai_analysis_log', 'SlowMovingScore');
  },

  down: async (queryInterface, Sequelize) => {
    // Restore columns if migration needs to be reverted
    await queryInterface.addColumn('ai_analysis_log', 'PredictedDemand', {
      type: Sequelize.INTEGER,
      allowNull: true
    });
    await queryInterface.addColumn('ai_analysis_log', 'LowStockRisk', {
      type: Sequelize.STRING(50),
      allowNull: true
    });
    await queryInterface.addColumn('ai_analysis_log', 'SlowMovingScore', {
      type: Sequelize.DECIMAL(5, 2),
      allowNull: true
    });
  }
};
