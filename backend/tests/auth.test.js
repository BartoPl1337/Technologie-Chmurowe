process.env.JWT_SECRET = 'test-secret';

jest.mock('../src/db');
jest.mock('bcrypt');

const request = require('supertest');
const app     = require('../src/app');
const db      = require('../src/db');
const bcrypt  = require('bcrypt');
const jwt     = require('jsonwebtoken');

describe('POST /api/auth/register', () => {
  test('400 gdy brak pól', async () => {
    const res = await request(app).post('/api/auth/register').send({ username: 'test' });
    expect(res.status).toBe(400);
  });

  test('400 gdy username za krótki', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'ab', password: '123456' });
    expect(res.status).toBe(400);
  });

  test('400 gdy hasło za krótkie', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'testuser', password: '123' });
    expect(res.status).toBe(400);
  });

  test('201 + JWT przy sukcesie, hasło przechowywane jako hash', async () => {
    bcrypt.hash.mockResolvedValue('$2b$12$hashedpassword');
    db.query.mockResolvedValue({ rows: [{ id: 1, username: 'testuser' }] });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'testuser', password: 'haslo123' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('token');
    expect(res.body.username).toBe('testuser');

    // bcrypt.hash wywołane z czystym hasłem
    expect(bcrypt.hash).toHaveBeenCalledWith('haslo123', 12);

    // do bazy trafia hash, NIE czyste hasło
    const queryArgs = db.query.mock.calls[0][1];
    expect(queryArgs[1]).toBe('$2b$12$hashedpassword');
    expect(queryArgs[1]).not.toBe('haslo123');

    // token jest poprawnym JWT
    const decoded = jwt.verify(res.body.token, 'test-secret');
    expect(decoded.userId).toBe(1);
    expect(decoded.username).toBe('testuser');
  });

  test('409 gdy username zajęty', async () => {
    bcrypt.hash.mockResolvedValue('hash');
    db.query.mockRejectedValue({ code: '23505' });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'existing', password: 'haslo123' });

    expect(res.status).toBe(409);
  });
});

describe('POST /api/auth/login', () => {
  test('400 gdy brak pól', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'test' });
    expect(res.status).toBe(400);
  });

  test('401 gdy użytkownik nie istnieje', async () => {
    db.query.mockResolvedValue({ rows: [] });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'nobody', password: 'haslo123' });

    expect(res.status).toBe(401);
  });

  test('401 gdy błędne hasło', async () => {
    db.query.mockResolvedValue({
      rows: [{ id: 1, username: 'user', password_hash: '$2b$12$hash' }],
    });
    bcrypt.compare.mockResolvedValue(false);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'user', password: 'zle_haslo' });

    expect(res.status).toBe(401);
  });

  test('200 + JWT przy poprawnych danych', async () => {
    db.query.mockResolvedValue({
      rows: [{ id: 5, username: 'user', password_hash: '$2b$12$hash' }],
    });
    bcrypt.compare.mockResolvedValue(true);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'user', password: 'dobre_haslo' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');

    const decoded = jwt.verify(res.body.token, 'test-secret');
    expect(decoded.userId).toBe(5);
  });
});
