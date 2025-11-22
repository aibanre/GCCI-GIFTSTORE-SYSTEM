const express = require('express');
const crudController = require('../controller/CRUD');
const router = express.Router();

router.get('/AdminDashboard', crudController.adminDashboard);

module.exports = router;