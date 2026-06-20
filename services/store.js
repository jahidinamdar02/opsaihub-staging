'use strict';
const fs = require('fs');
const path = require('path');

const jsonCache = new Map();
const CACHE_TTL = 5000;

function readJSON(filename, fallback) {
  if (fallback === undefined) fallback = [];
  const filepath = path.join(__dirname, '..', 'data', filename);
  const cacheKey = filepath;
  const cached = jsonCache.get(cacheKey);
  if (cached && (Date.now() - cached.ts) < CACHE_TTL) return cached.data;
  try {
    if (!fs.existsSync(filepath)) return fallback;
    const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
    jsonCache.set(cacheKey, { data, ts: Date.now() });
    return data;
  } catch (err) { return fallback; }
}

function writeJSON(filename, data) {
  try {
    const filepath = path.join(__dirname, '..', 'data', filename);
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf8');
    jsonCache.delete(filepath);
    return true;
  } catch (err) { return false; }
}

module.exports = { readJSON, writeJSON };
