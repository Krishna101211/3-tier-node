const { query } = require('../config/database');

class UserRepository {
  async create(username, phone) {
    const result = await query(
      'INSERT INTO users (username, phone) VALUES ($1, $2) RETURNING id, username, phone, created_at',
      [username, phone]
    );
    return result.rows[0];
  }

  async findAll() {
    const result = await query(
      'SELECT id, username, phone, created_at, updated_at FROM users ORDER BY created_at DESC'
    );
    return result.rows;
  }

  async findById(id) {
    const result = await query(
      'SELECT id, username, phone, created_at, updated_at FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  async findByUsername(username) {
    const result = await query(
      'SELECT id, username, phone, created_at, updated_at FROM users WHERE username = $1',
      [username]
    );
    return result.rows[0] || null;
  }

  async delete(id) {
    const result = await query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
    return result.rows[0] || null;
  }
}

module.exports = new UserRepository();
