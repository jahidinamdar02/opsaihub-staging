'use strict';
require('dotenv').config();
const request = require('supertest');
const express = require('express');

const app = express();
app.use(express.json());
app.use('/api/auth', require('../routes/auth'));

describe('Auth Routes', function() {
  describe('POST /api/auth/verify-pin', function() {
    it('should return token for valid PIN', async function() {
      const res = await request(app)
        .post('/api/auth/verify-pin')
        .send({ pin: '1040' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.am).toBe('Raman');
      expect(res.body.role).toBe('am');
      expect(res.body.token).toBeDefined();
    });

    it('should return failure for invalid PIN', async function() {
      const res = await request(app)
        .post('/api/auth/verify-pin')
        .send({ pin: '0000' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(false);
    });

    it('should reject non-4-digit PIN', async function() {
      const res = await request(app)
        .post('/api/auth/verify-pin')
        .send({ pin: '123' });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject missing PIN', async function() {
      const res = await request(app)
        .post('/api/auth/verify-pin')
        .send({});
      expect(res.status).toBe(400);
    });

    it('should return HOD role for HOD PIN', async function() {
      const res = await request(app)
        .post('/api/auth/verify-pin')
        .send({ pin: '8410' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.role).toBe('hod');
    });
  });
});
