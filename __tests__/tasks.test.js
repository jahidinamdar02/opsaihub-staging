'use strict';
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());
app.use('/api/tasks', require('../routes/tasks'));

require('dotenv').config();
function getAuthToken(am, role) {
  return jwt.sign({ am, role }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

describe('Tasks Routes', function() {
  describe('GET /api/tasks', function() {
    it('should return tasks list', async function() {
      const res = await request(app).get('/api/tasks');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should filter by status', async function() {
      const res = await request(app).get('/api/tasks?status=open');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should filter by priority', async function() {
      const res = await request(app).get('/api/tasks?priority=P1');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('POST /api/tasks', function() {
    it('should require auth token', async function() {
      const res = await request(app)
        .post('/api/tasks')
        .send({ title: 'Test task' });
      expect(res.status).toBe(401);
    });

    it('should create task with valid data', async function() {
      const token = getAuthToken('Raman', 'am');
      const res = await request(app)
        .post('/api/tasks')
        .set('Authorization', 'Bearer ' + token)
        .send({ title: 'Fix coffee machine', store: 'TH T3D', am: 'Raman', priority: 'P1' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Fix coffee machine');
      expect(res.body.data.priority).toBe('P1');
    });

    it('should reject task without title', async function() {
      const token = getAuthToken('Raman', 'am');
      const res = await request(app)
        .post('/api/tasks')
        .set('Authorization', 'Bearer ' + token)
        .send({ store: 'TH T3D' });
      expect(res.status).toBe(400);
    });

    it('should reject invalid priority', async function() {
      const token = getAuthToken('Raman', 'am');
      const res = await request(app)
        .post('/api/tasks')
        .set('Authorization', 'Bearer ' + token)
        .send({ title: 'Test', priority: 'urgent' });
      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /api/tasks/:id', function() {
    it('should update task status', async function() {
      const tasks = require('../services/store').readJSON('tasks.json', []);
      if (tasks.length === 0) return;
      const taskId = tasks[0].id;
      const res = await request(app)
        .patch('/api/tasks/' + taskId)
        .send({ status: 'in_progress' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 404 for unknown task', async function() {
      const res = await request(app)
        .patch('/api/tasks/nonexistent')
        .send({ status: 'open' });
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/tasks/:id', function() {
    it('should return 404 for unknown task', async function() {
      const res = await request(app).delete('/api/tasks/nonexistent');
      expect(res.status).toBe(404);
    });
  });
});
