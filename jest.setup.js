'use strict';
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
const testBackupDir = path.join(__dirname, '..', 'data', '.test-backup');

beforeAll(function() {
  if (!fs.existsSync(testBackupDir)) fs.mkdirSync(testBackupDir, { recursive: true });
  const files = fs.readdirSync(dataDir).filter(function(f) { return f.endsWith('.json'); });
  files.forEach(function(f) {
    fs.copyFileSync(path.join(dataDir, f), path.join(testBackupDir, f));
  });
});

afterAll(function() {
  const files = fs.readdirSync(testBackupDir).filter(function(f) { return f.endsWith('.json'); });
  files.forEach(function(f) {
    fs.copyFileSync(path.join(testBackupDir, f), path.join(dataDir, f));
  });
  fs.rmSync(testBackupDir, { recursive: true, force: true });
});
