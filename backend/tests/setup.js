// Shared test helpers
const request = require('supertest');
const app = require('../src/server');

async function login(email, password) {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  if (res.status !== 200) throw new Error(`Login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  return { token: res.body.token, user: res.body.user };
}

function auth(req, token) {
  return req.set('Authorization', `Bearer ${token}`);
}

module.exports = { app, login, auth, request };
