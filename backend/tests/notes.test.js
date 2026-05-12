process.env.JWT_SECRET = 'test-secret';

jest.mock('../src/db');

const request = require('supertest');
const app = require('../src/app');
const db  = require('../src/db');
const jwt = require('jsonwebtoken');

const token = (userId, username = 'user') =>
  jwt.sign({ userId, username }, 'test-secret');

const fakeNote = (overrides = {}) => ({
  id: 1, user_id: 1, title: 'Notatka', content: 'Treść',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

// ── GET /api/notes
describe('GET /api/notes', () => {
  test('401 bez tokena', async () => {
    const res = await request(app).get('/api/notes');
    expect(res.status).toBe(401);
  });

  test('401 z nieprawidłowym tokenem', async () => {
    const res = await request(app)
      .get('/api/notes')
      .set('Authorization', 'Bearer invalid.token.here');
    expect(res.status).toBe(401);
  });

  test('zwraca listę notatek zalogowanego użytkownika', async () => {
    db.query.mockResolvedValue({ rows: [fakeNote()] });

    const res = await request(app)
      .get('/api/notes')
      .set('Authorization', `Bearer ${token(1)}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    // zapytanie filtruje po user_id = 1
    expect(db.query.mock.calls[0][1]).toEqual([1]);
  });

  test('użytkownik 2 nie widzi notatek użytkownika 1', async () => {
    db.query.mockResolvedValue({ rows: [] });

    const res = await request(app)
      .get('/api/notes')
      .set('Authorization', `Bearer ${token(2)}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
    // zapytanie filtruje po user_id = 2
    expect(db.query.mock.calls[0][1]).toEqual([2]);
  });
});

// ── POST /api/notes
describe('POST /api/notes', () => {
  test('401 bez tokena', async () => {
    const res = await request(app).post('/api/notes').send({ title: 'Test' });
    expect(res.status).toBe(401);
  });

  test('400 gdy brak tytułu', async () => {
    const res = await request(app)
      .post('/api/notes')
      .set('Authorization', `Bearer ${token(1)}`)
      .send({ content: 'bez tytułu' });
    expect(res.status).toBe(400);
  });

  test('400 gdy tytuł jest pustym stringiem', async () => {
    const res = await request(app)
      .post('/api/notes')
      .set('Authorization', `Bearer ${token(1)}`)
      .send({ title: '   ' });
    expect(res.status).toBe(400);
  });

  test('201 tworzy notatkę przypisaną do zalogowanego użytkownika', async () => {
    const note = fakeNote({ title: 'Nowa notatka' });
    db.query.mockResolvedValue({ rows: [note] });

    const res = await request(app)
      .post('/api/notes')
      .set('Authorization', `Bearer ${token(7)}`)
      .send({ title: 'Nowa notatka', content: 'treść' });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Nowa notatka');

    // user_id w zapytaniu musi być 7 (z tokena, nie z body)
    const queryParams = db.query.mock.calls[0][1];
    expect(queryParams[0]).toBe(7);
  });
});

// ── PUT /api/notes/:id
describe('PUT /api/notes/:id', () => {
  test('401 bez tokena', async () => {
    const res = await request(app).put('/api/notes/1').send({ title: 'x' });
    expect(res.status).toBe(401);
  });

  test('400 gdy brak tytułu', async () => {
    const res = await request(app)
      .put('/api/notes/1')
      .set('Authorization', `Bearer ${token(1)}`)
      .send({ content: 'bez tytułu' });
    expect(res.status).toBe(400);
  });

  test('404 gdy notatka nie istnieje lub należy do innego użytkownika', async () => {
    db.query.mockResolvedValue({ rows: [] });

    const res = await request(app)
      .put('/api/notes/99')
      .set('Authorization', `Bearer ${token(1)}`)
      .send({ title: 'Update', content: '' });

    expect(res.status).toBe(404);
    // zapytanie zawiera user_id = 1 (izolacja danych)
    expect(db.query.mock.calls[0][1]).toContain(1);
  });

  test('200 aktualizuje notatkę', async () => {
    const updated = fakeNote({ title: 'Zaktualizowana', content: 'Nowa treść' });
    db.query.mockResolvedValue({ rows: [updated] });

    const res = await request(app)
      .put('/api/notes/1')
      .set('Authorization', `Bearer ${token(1)}`)
      .send({ title: 'Zaktualizowana', content: 'Nowa treść' });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Zaktualizowana');
  });
});

// ── DELETE /api/notes/:id
describe('DELETE /api/notes/:id', () => {
  test('401 bez tokena', async () => {
    const res = await request(app).delete('/api/notes/1');
    expect(res.status).toBe(401);
  });

  test('404 gdy notatka nie istnieje', async () => {
    db.query.mockResolvedValue({ rowCount: 0 });

    const res = await request(app)
      .delete('/api/notes/99')
      .set('Authorization', `Bearer ${token(1)}`);

    expect(res.status).toBe(404);
  });

  test('204 usuwa notatkę', async () => {
    db.query.mockResolvedValue({ rowCount: 1 });

    const res = await request(app)
      .delete('/api/notes/1')
      .set('Authorization', `Bearer ${token(1)}`);

    expect(res.status).toBe(204);
  });

  test('użytkownik 2 nie może usunąć notatki użytkownika 1', async () => {
    db.query.mockResolvedValue({ rowCount: 0 });

    const res = await request(app)
      .delete('/api/notes/1')
      .set('Authorization', `Bearer ${token(2)}`);

    expect(res.status).toBe(404);
    // zapytanie filtruje po user_id = 2, więc nie znajdzie notatki usera 1
    const queryParams = db.query.mock.calls[0][1];
    expect(queryParams).toContain(2);
    expect(queryParams).not.toContain(1);
  });
});
