const mongoose = require('mongoose');
const User = require('../../src/models/User');

describe('User Model', () => {
  test('should hash password before saving', async () => {
    const user = new User({
      name: 'Test User',
      email: 'test@example.com',
      phone: '+966500000000',
      password: 'password123',
    });
    await user.save();

    expect(user.password).not.toBe('password123');
    expect(user.password).toMatch(/^\$2[ab]\$/);
  });

  test('should compare password correctly', async () => {
    const user = await User.create({
      name: 'Test User 2',
      email: 'test2@example.com',
      phone: '+966500000001',
      password: 'mypassword',
    });

    const dbUser = await User.findById(user._id).select('+password');
    expect(await dbUser.comparePassword('mypassword')).toBe(true);
    expect(await dbUser.comparePassword('wrongpassword')).toBe(false);
  });

  test('should not include password in toPublicJSON', async () => {
    const user = await User.create({
      name: 'Test User 3',
      email: 'test3@example.com',
      phone: '+966500000002',
      password: 'password123',
    });

    const json = user.toPublicJSON();
    expect(json.password).toBeUndefined();
    expect(json.name).toBe('Test User 3');
    expect(json.email).toBe('test3@example.com');
  });

  test('should require name, email, phone, password', async () => {
    const user = new User({});
    const err = user.validateSync();
    expect(err.errors.name).toBeDefined();
    expect(err.errors.email).toBeDefined();
    expect(err.errors.phone).toBeDefined();
    expect(err.errors.password).toBeDefined();
  });

  test('should default role to client', async () => {
    const user = new User({ name: 'A', email: 'a@b.com', phone: '123', password: '12345678' });
    expect(user.role).toBe('client');
  });

  test('should default isVerified to false', async () => {
    const user = new User({ name: 'A', email: 'a@b.com', phone: '123', password: '12345678' });
    expect(user.isVerified).toBe(false);
  });
});
