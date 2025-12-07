'use strict';

const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const process = require('process');
const basename = path.basename(__filename);
const env = process.env.NODE_ENV || 'development';

console.log('=== SEQUELIZE CONFIG DEBUG ===');
console.log('NODE_ENV:', env);
console.log('Environment variables present:', {
  DB_HOST: !!process.env.DB_HOST,
  DB_PORT: !!process.env.DB_PORT,
  DB_NAME: !!process.env.DB_NAME,
  DB_USER: !!process.env.DB_USER,
  DB_PASSWORD: !!process.env.DB_PASSWORD
});

let config = require(__dirname + '/../config/config.json')[env];

// Replace environment variable placeholders in config
function replaceEnvVars(obj) {
  if (typeof obj === 'string') {
    // Match ${VAR_NAME} pattern
    const replaced = obj.replace(/\$\{([^}]+)\}/g, (match, varName) => {
      return process.env[varName] || match;
    });
    return replaced;
  } else if (typeof obj === 'object' && obj !== null) {
    const newObj = Array.isArray(obj) ? [] : {};
    for (const key in obj) {
      newObj[key] = replaceEnvVars(obj[key]);
    }
    return newObj;
  }
  return obj;
}

config = replaceEnvVars(config);

// Convert port to number if it's a string
if (config.port && typeof config.port === 'string') {
  config.port = parseInt(config.port, 10);
}

// Debug: Log database connection info
console.log('Final database config:', {
  host: config.host,
  port: config.port,
  database: config.database,
  username: config.username,
  hasPassword: !!config.password,
  dialect: config.dialect
});
console.log('=== END DEBUG ===');

const db = {};

let sequelize;
if (config.use_env_variable) {
  sequelize = new Sequelize(process.env[config.use_env_variable], config);
} else {
  sequelize = new Sequelize(config.database, config.username, config.password, config);
}

fs
  .readdirSync(__dirname)
  .filter(file => {
    return (
      file.indexOf('.') !== 0 &&
      file !== basename &&
      file.slice(-3) === '.js' &&
      file.indexOf('.test.js') === -1
    );
  })
  .forEach(file => {
    const model = require(path.join(__dirname, file))(sequelize, Sequelize.DataTypes);
    db[model.name] = model;
  });

Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
