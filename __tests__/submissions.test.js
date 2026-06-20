'use strict';
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());
app.use('/api/submissions', require('../routes/submissions'));

require('dotenv').config();
function getAuthToken(am, role) {
  return jwt.sign({ am, role }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

describe('Submissions Routes', function() {
  describe('GET /api/submissions', function() {
    it('should return submissions list', async function() {
      const res = await request(app).get('/api/submissions');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should filter by AM', async function() {
      const res = await request(app).get('/api/submissions?am=Raman');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should filter by day', async function() {
      const res = await request(app).get('/api/submissions?day=monday');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('POST /api/submissions', function() {
    it('should require auth token', async function() {
      const res = await request(app)
        .post('/api/submissions')
        .send({ am: 'Raman', store: 'TH T3D', day: 'monday' });
      expect(res.status).toBe(401);
    });

    it('should reject invalid token', async function() {
      const res = await request(app)
        .post('/api/submissions')
        .set('Authorization', 'Bearer invalid-token')
        .send({ am: 'Raman', store: 'TH T3D', day: 'monday' });
      expect(res.status).toBe(401);
    });

    it('should accept valid submission with token', async function() {
      const token = getAuthToken('Raman', 'am');
      const res = await request(app)
        .post('/api/submissions')
        .set('Authorization', 'Bearer ' + token)
        .send({ am: 'Raman', store: 'TH T3D', day: 'monday', score: 85 });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should reject submission without required fields', async function() {
      const token = getAuthToken('Raman', 'am');
      const res = await request(app)
        .post('/api/submissions')
        .set('Authorization', 'Bearer ' + token)
        .send({ am: 'Raman' });
      expect(res.status).toBe(400);
    });

    it('should reject invalid day value', async function() {
      const token = getAuthToken('Raman', 'am');
      const res = await request(app)
        .post('/api/submissions')
        .set('Authorization', 'Bearer ' + token)
        .send({ am: 'Raman', store: 'TH T3D', day: 'invalid-day' });
      expect(res.status).toBe(400);
    });

    it('should reject score > 100', async function() {
      const token = getAuthToken('Raman', 'am');
      const res = await request(app)
        .post('/api/submissions')
        .set('Authorization', 'Bearer ' + token)
        .send({ am: 'Raman', store: 'TH T3D', day: 'monday', score: 150 });
      expect(res.status).toBe(400);
    });
  });
});
