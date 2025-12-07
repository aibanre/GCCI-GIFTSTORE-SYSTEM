'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Drop the unique index on Email column in student table
    // MySQL automatically creates an index named 'Email' for unique constraints
    try {
      await queryInterface.removeIndex('student', 'Email');
    } catch (err) {
      // If the index doesn't exist or has a different name, try alternative approach
      console.log('Could not remove index by name, trying raw SQL...');
      await queryInterface.sequelize.query('ALTER TABLE student DROP INDEX Email;');
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Restore unique constraint by adding index back
    await queryInterface.addIndex('student', ['Email'], {
      unique: true,
      name: 'Email'
    });
  }
};
