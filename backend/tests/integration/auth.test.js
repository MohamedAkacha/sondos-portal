const request = require('supertest');
const app = require('../../src/app');
const User = require('../../src/models/User');

describe('Auth Flow', () => {
  beforeEach(async () => {
    await User.deleteMany({});
  });

  describe('POST /api/auth/register', () => {
    test('should register a new user', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test User',
          email: 'test@example.com',
          phone: '+966500000000',
          password: 'password123',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe('test@example.com');
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
    });

    test('should reject duplicate email', async () => {
      await User.create({ name: 'A', email: 'dup@example.com', phone: '123', password: 'password123' });

      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'B', email: 'dup@example.com', phone: '456', password: 'password123' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    test('should reject short password', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'C', email: 'c@example.com', phone: '789', password: '123' });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await request(app).post('/api/auth/register').send({
        name: 'Login Test', email: 'login@example.com', phone: '000', password: 'password123',
      });
    });

    test('should login with correct credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'login@example.com', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
    });

    test('should reject wrong password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'login@example.com', password: 'wrongpass' });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/auth/me', () => {
    test('should return user data with valid token', async () => {
      const registerRes = await request(app).post('/api/auth/register').send({
        name: 'Me Test', email: 'me@example.com', phone: '111', password: 'password123',
      });
      const token = registerRes.body.data.accessToken;

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.email).toBe('me@example.com');
    });

    test('should reject without token', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });
  });
});
