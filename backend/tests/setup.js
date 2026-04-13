const mongoose = require('mongoose');

beforeAll(async () => {
  const mongoUri = process.env.MONGO_TEST_URI || 'mongodb://localhost:27017/sondos-test';
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
  await mongoose.connection.close();
});
