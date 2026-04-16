const request = require('supertest');
const app = require('../src/server');
const { v4: uuidv4 } = require('crypto');

const uniqueName = () => `user_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

describe('Health Check', () => {
  test('GET /health returns 200', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.timestamp).toBeDefined();
  });
});

describe('POST /api/users - Register User', () => {
  test('should register a new user', async () => {
    const res = await request(app)
      .post('/api/users')
      .send({ username: uniqueName(), phone: '+1234567890' });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe('User registered successfully');
    expect(res.body.data.username).toBeDefined();
    expect(res.body.data.phone).toBe('+1234567890');
    expect(res.body.data.id).toBeDefined();
  });

  test('should return 400 if username is missing', async () => {
    const res = await request(app)
      .post('/api/users')
      .send({ phone: '+1234567890' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Username and phone are required');
  });

  test('should return 400 if phone is missing', async () => {
    const res = await request(app)
      .post('/api/users')
      .send({ username: 'john' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Username and phone are required');
  });

  test('should return 400 if username is too short', async () => {
    const res = await request(app)
      .post('/api/users')
      .send({ username: 'ab', phone: '+1234567890' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Username must be between 3 and 30 characters');
  });

  test('should return 400 for invalid phone number', async () => {
    const res = await request(app)
      .post('/api/users')
      .send({ username: uniqueName(), phone: '123' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid phone number format');
  });

  test('should return 409 for duplicate username', async () => {
    const name = uniqueName();
    await request(app)
      .post('/api/users')
      .send({ username: name, phone: '+1234567890' });

    const res = await request(app)
      .post('/api/users')
      .send({ username: name, phone: '+0987654321' });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Username already exists');
  });
});

describe('GET /api/users - Get All Users', () => {
  test('should return users array', async () => {
    const res = await request(app).get('/api/users');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('should return newly created users', async () => {
    const name1 = uniqueName();
    const name2 = uniqueName();
    await request(app).post('/api/users').send({ username: name1, phone: '+1111111111' });
    await request(app).post('/api/users').send({ username: name2, phone: '+2222222222' });

    const res = await request(app).get('/api/users');
    expect(res.status).toBe(200);
    const usernames = res.body.data.map(u => u.username);
    expect(usernames).toContain(name1);
    expect(usernames).toContain(name2);
  });
});

describe('GET /api/users/:id - Get User By ID', () => {
  test('should return a user by ID', async () => {
    const name = uniqueName();
    const created = await request(app)
      .post('/api/users')
      .send({ username: name, phone: '+1234567890' });

    const res = await request(app).get(`/api/users/${created.body.data.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.username).toBe(name);
  });

  test('should return 404 for non-existent user', async () => {
    const res = await request(app).get('/api/users/99999');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('User not found');
  });
});

describe('DELETE /api/users/:id - Delete User', () => {
  test('should delete a user', async () => {
    const name = uniqueName();
    const created = await request(app)
      .post('/api/users')
      .send({ username: name, phone: '+1234567890' });

    const res = await request(app).delete(`/api/users/${created.body.data.id}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('User deleted successfully');
  });

  test('should return 404 for deleting non-existent user', async () => {
    const res = await request(app).delete('/api/users/99999');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('User not found');
  });
});
