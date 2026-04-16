const { connectDB } = require('../config/database');

const initDB = async () => {
  await connectDB();
  console.log('Database connection verified (schema managed by Docker init scripts)');
};

module.exports = initDB;
