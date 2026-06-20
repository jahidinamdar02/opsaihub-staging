'use strict';
const request = require('supertest');
const express = require('express');

const app = express();
app.use(express.json());
app.use('/api/stores', require('../routes/stores'));

describe('Stores Routes', function() {
  describe('GET /api/stores', function() {
    it('should return stores list', async function() {
      const res = await request(app).get('/api/stores');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('GET /api/stores/am/:amName', function() {
    it('should filter stores by AM name', async function() {
      const res = await request(app).get('/api/stores/am/Raman');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should return empty for unknown AM', async function() {
      const res = await request(app).get('/api/stores/am/UnknownPerson');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });
  });

  describe('GET /api/stores/trend', function() {
    it('should return trend data', async function() {
      const res = await request(app).get('/api/stores/trend');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should filter by AM', async function() {
      const res = await request(app).get('/api/stores/trend?am=Raman');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
