process.env.DB_HOST = process.env.DB_HOST || 'localhost';
process.env.DB_PORT = process.env.DB_PORT || '5432';
process.env.DB_NAME = process.env.DB_NAME || 'userdb_test';
process.env.DB_USER = process.env.DB_USER || 'testuser';
process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'testpassword';
process.env.DB_SSL = process.env.DB_SSL || 'false';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const { pool } = require('../src/config/database');

beforeAll(async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      phone VARCHAR(20) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const triggerExists = await pool.query(`
    SELECT EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgname = 'update_updated_at'
    )
  `);

  if (!triggerExists.rows[0].exists) {
    await pool.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';

      CREATE TRIGGER update_updated_at
        BEFORE UPDATE ON users
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);
  }
});

beforeEach(async () => {
  await pool.query('TRUNCATE users RESTART IDENTITY CASCADE');
});

afterAll(async () => {
  await pool.end();
});
