'use strict';
require('dotenv').config();
const request = require('supertest');
const express = require('express');

// Create test app with available middleware
const app = express();
app.use(express.json());
app.use('/api/auth', require('../routes/auth'));
app.use('/api/submissions', require('../routes/submissions'));
app.use('/api/stores', require('../routes/stores'));
app.use('/api/tasks', require('../routes/tasks'));
app.use('/api/events', require('../routes/events'));
app.use('/api/posts', require('../routes/posts'));

// 404 handler for unknown routes
app.use('/api', function(req, res) {
  res.status(404).json({ success: false, error: 'API endpoint not found: ' + req.method + ' ' + req.originalUrl });
});

describe('Error Handling Edge Cases', function() {

  describe('404 - Unknown endpoints', function() {
    it('should return 404 for unknown GET endpoint', async function() {
      const res = await request(app).get('/api/nonexistent');
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('not found');
    });

    it('should return 404 for unknown POST endpoint', async function() {
      const res = await request(app)
        .post('/api/nonexistent')
        .send({ data: 'test' });
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('should return 404 for wrong HTTP method', async function() {
      const res = await request(app)
        .put('/api/auth/verify-pin')
        .send({ pin: '1040' });
      expect(res.status).toBe(404);
    });
  });

  describe('400 - Validation errors', function() {
    it('should reject empty JSON body', async function() {
      const res = await request(app)
        .post('/api/auth/verify-pin')
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject invalid JSON', async function() {
      const res = await request(app)
        .post('/api/auth/verify-pin')
        .set('Content-Type', 'application/json')
        .send('{invalid json}');
      expect(res.status).toBe(400);
    });

    it('should reject missing required fields', async function() {
      const res = await request(app)
        .post('/api/auth/verify-pin')
        .send({ pin: null });
      expect(res.status).toBe(400);
    });
  });

  describe('Input sanitization', function() {
    it('should handle SQL injection attempts', async function() {
      const res = await request(app)
        .post('/api/auth/verify-pin')
        .send({ pin: "'; DROP TABLE users;--" });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should handle XSS attempts in PIN', async function() {
      const res = await request(app)
        .post('/api/auth/verify-pin')
        .send({ pin: '<script>alert(1)</script>' });
      expect(res.status).toBe(400);
    });

    it('should handle very long input', async function() {
      const longPin = 'A'.repeat(10000);
      const res = await request(app)
        .post('/api/auth/verify-pin')
        .send({ pin: longPin });
      expect(res.status).toBe(400);
    });
  });

  describe('Auth - Edge cases', function() {
    it('should reject PIN with special characters', async function() {
      const res = await request(app)
        .post('/api/auth/verify-pin')
        .send({ pin: '!@#$%' });
      expect(res.status).toBe(400);
    });

    it('should reject PIN with letters', async function() {
      const res = await request(app)
        .post('/api/auth/verify-pin')
        .send({ pin: 'abcd' });
      expect(res.status).toBe(400);
    });

    it('should reject empty string PIN', async function() {
      const res = await request(app)
        .post('/api/auth/verify-pin')
        .send({ pin: '' });
      expect(res.status).toBe(400);
    });

    it('should handle undefined PIN gracefully', async function() {
      const res = await request(app)
        .post('/api/auth/verify-pin')
        .send({ pin: undefined });
      expect(res.status).toBe(400);
    });

    it('should return correct role for each PIN type', async function() {
      // AM
      let res = await request(app)
        .post('/api/auth/verify-pin')
        .send({ pin: '1040' });
      expect(res.body.role).toBe('am');

      // HOD
      res = await request(app)
        .post('/api/auth/verify-pin')
        .send({ pin: '8410' });
      expect(res.body.role).toBe('hod');

      // CEO
      res = await request(app)
        .post('/api/auth/verify-pin')
        .send({ pin: '9147' });
      expect(res.body.role).toBe('ceo');
    });
  });

  describe('Stores - Edge cases', function() {
    it('should return stores list', async function() {
      const res = await request(app).get('/api/stores');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should handle invalid AM filter', async function() {
      const res = await request(app).get('/api/stores/am/NonExistentAM');
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });
  });

  describe('Rate limiting', function() {
    it('should allow requests under limit', async function() {
      const res = await request(app)
        .post('/api/auth/verify-pin')
        .send({ pin: '1040' });
      expect(res.status).toBe(200);
    });
  });

  describe('Response format consistency', function() {
    it('should always return success field', async function() {
      const res = await request(app).get('/api/stores');
      expect(res.body).toHaveProperty('success');
    });

    it('should return error message on failure', async function() {
      const res = await request(app)
        .post('/api/auth/verify-pin')
        .send({ pin: '0000' });
      expect(res.body.success).toBe(false);
    });

    it('should return data field on success', async function() {
      const res = await request(app).get('/api/stores');
      expect(res.body).toHaveProperty('data');
    });
  });
});
