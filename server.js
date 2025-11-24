const express = require('express');
const path = require('path');
const app = express();

let db;
try {
  db = require('./models');
  console.log('Database models loaded successfully');
} catch (err) {
  console.error('Warning: Failed to load database models:', err.message);
  db = null;
}

app.set('view engine', 'ejs');
// set explicit views folder (optional if default ./views is used)
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// serve static files from /public
app.use(express.static(path.join(__dirname, 'public')));

// Make db available to route handlers
app.use((req, res, next) => {
  req.db = db;
  next();
});

app.use(require('./router/web'));

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});