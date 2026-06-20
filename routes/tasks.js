'use strict';
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { readJSON, writeJSON } = require('../services/store');
const { authMiddleware } = require('../middleware/auth');
const { validate, schemas } = require('../services/validation');

const proofUpload = multer({
  storage: multer.diskStorage({
    destination: function(req, file, cb) {
      var d = 'uploads/task-proof/';
      if (!require('fs').existsSync(d)) require('fs').mkdirSync(d, { recursive: true });
      cb(null, d);
    },
    filename: function(req, file, cb) { cb(null, Date.now() + '-' + Math.random().toString(36).substr(2,8) + '.jpg'); }
  }),
  limits: { fileSize: 10 * 1024 * 1024 }
});

router.get('/', function(req, res) {
  try {
    var tasks = readJSON('tasks.json', []);
    var am = req.query.am || '';
    var status = req.query.status || '';
    var prio = req.query.priority || '';
    var isHOD = req.query.hod === '1';
    if (!isHOD && am) tasks = tasks.filter(function(t) { return t.am === am; });
    if (status) tasks = tasks.filter(function(t) { return t.status === status; });
    if (prio) tasks = tasks.filter(function(t) { return t.priority === prio; });
    var PRIO = { P1: 0, P2: 1, P3: 2 };
    tasks.sort(function(a, b) {
      var pd = (PRIO[a.priority] || 2) - (PRIO[b.priority] || 2);
      if (pd !== 0) return pd;
      return (a.dueDate || '9999') < (b.dueDate || '9999') ? -1 : 1;
    });
    res.json({ success: true, data: tasks, total: tasks.length });
  } catch(err) { res.status(500).json({ success: false, error: err.message }); }
});

router.post('/', authMiddleware, validate(schemas.task), function(req, res) {
  try {
    var tasks = readJSON('tasks.json', []);
    var task = {
      id: Date.now().toString(),
      title: req.body.title || '',
      description: req.body.description || '',
      store: req.body.store || '',
      am: req.body.am || '',
      priority: req.body.priority || 'P3',
      status: 'open',
      dueDate: req.body.dueDate || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      resolvedAt: null, resolvedBy: null, proofPhoto: null,
      blockedReason: null, blockedAt: null, escalatedTo: null, comments: []
    };
    tasks.unshift(task);
    writeJSON('tasks.json', tasks);
    res.json({ success: true, data: task });
  } catch(err) { res.status(500).json({ success: false, error: err.message }); }
});

router.patch('/:id', validate(schemas.taskUpdate), function(req, res) {
  try {
    var tasks = readJSON('tasks.json', []);
    var task = tasks.find(function(t) { return t.id === req.params.id; });
    if (!task) return res.status(404).json({ success: false, error: 'Task not found' });
    var allowed = ['title', 'description', 'priority', 'dueDate', 'status'];
    allowed.forEach(function(k) { if (req.body[k] !== undefined) task[k] = req.body[k]; });
    task.updatedAt = new Date().toISOString();
    writeJSON('tasks.json', tasks);
    res.json({ success: true, data: task });
  } catch(err) { res.status(500).json({ success: false, error: err.message }); }
});

router.post('/:id/resolve', proofUpload.single('proof'), function(req, res) {
  try {
    var tasks = readJSON('tasks.json', []);
    var task = tasks.find(function(t) { return t.id === req.params.id; });
    if (!task) return res.status(404).json({ success: false, error: 'Task not found' });
    task.status = 'resolved';
    task.resolvedAt = new Date().toISOString();
    task.resolvedBy = req.body.resolvedBy || task.am;
    task.proofPhoto = req.file ? '/uploads/task-proof/' + req.file.filename : null;
    task.updatedAt = new Date().toISOString();
    writeJSON('tasks.json', tasks);
    res.json({ success: true, data: task });
  } catch(err) { res.status(500).json({ success: false, error: err.message }); }
});

router.post('/:id/block', function(req, res) {
  try {
    var tasks = readJSON('tasks.json', []);
    var task = tasks.find(function(t) { return t.id === req.params.id; });
    if (!task) return res.status(404).json({ success: false, error: 'Task not found' });
    task.status = 'blocked';
    task.blockedReason = req.body.reason || '';
    task.blockedAt = new Date().toISOString();
    task.escalatedTo = 'Jahid';
    task.updatedAt = new Date().toISOString();
    writeJSON('tasks.json', tasks);
    res.json({ success: true, data: task });
  } catch(err) { res.status(500).json({ success: false, error: err.message }); }
});

router.post('/:id/comment', function(req, res) {
  try {
    var tasks = readJSON('tasks.json', []);
    var task = tasks.find(function(t) { return t.id === req.params.id; });
    if (!task) return res.status(404).json({ success: false, error: 'Not found' });
    if (!task.comments) task.comments = [];
    task.comments.push({ by: req.body.by || '', text: req.body.text || '', at: new Date().toISOString() });
    task.updatedAt = new Date().toISOString();
    writeJSON('tasks.json', tasks);
    res.json({ success: true });
  } catch(err) { res.status(500).json({ success: false, error: err.message }); }
});

router.delete('/:id', function(req, res) {
  try {
    var tasks = readJSON('tasks.json', []);
    var filtered = tasks.filter(function(t) { return t.id !== req.params.id; });
    if (filtered.length === tasks.length) return res.status(404).json({ success: false, error: 'Not found' });
    writeJSON('tasks.json', filtered);
    res.json({ success: true });
  } catch(err) { res.status(500).json({ success: false, error: err.message }); }
});

module.exports = router;
