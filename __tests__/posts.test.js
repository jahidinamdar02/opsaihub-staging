'use strict';
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());
app.use('/api/posts', require('../routes/posts'));

require('dotenv').config();
function getAuthToken(am, role) {
  return jwt.sign({ am, role }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

describe('Posts Routes', function() {
  describe('GET /api/posts', function() {
    it('should return posts list', async function() {
      const res = await request(app).get('/api/posts');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('POST /api/posts', function() {
    it('should require auth token', async function() {
      const res = await request(app)
        .post('/api/posts')
        .send({ author: 'Test', caption: 'Hello' });
      expect(res.status).toBe(401);
    });

    it('should accept valid post with token', async function() {
      const token = getAuthToken('Raman', 'am');
      const res = await request(app)
        .post('/api/posts')
        .set('Authorization', 'Bearer ' + token)
        .send({ author: 'Raman', caption: 'Great week!' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should reject post without caption', async function() {
      const token = getAuthToken('Raman', 'am');
      const res = await request(app)
        .post('/api/posts')
        .set('Authorization', 'Bearer ' + token)
        .send({ author: 'Raman' });
      expect(res.status).toBe(400);
    });

    it('should reject caption > 5000 chars', async function() {
      const token = getAuthToken('Raman', 'am');
      const res = await request(app)
        .post('/api/posts')
        .set('Authorization', 'Bearer ' + token)
        .send({ author: 'Raman', caption: 'x'.repeat(5001) });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/posts/comment', function() {
    it('should add comment to post', async function() {
      const posts = require('../services/store').readJSON('posts.json', []);
      if (posts.length === 0) return;
      const postId = posts[0].id;
      const res = await request(app)
        .post('/api/posts/comment')
        .send({ postId: postId, comment: { author: 'Test', text: 'Nice!' } });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should reject comment without text', async function() {
      const res = await request(app)
        .post('/api/posts/comment')
        .send({ postId: '123', comment: { author: 'Test' } });
      expect(res.status).toBe(400);
    });
  });
});
