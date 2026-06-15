const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const db = require('./db');
const { initAdblocker } = require('./adblock');
const proxyRouter = require('./proxy');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Make io accessible globally if needed, or via app.get
app.set('io', io);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Proxy Route
app.use('/proxy', proxyRouter);

// Database API Routes
app.get('/api/history', (req, res) => {
  const history = db.prepare('SELECT * FROM history ORDER BY timestamp DESC LIMIT 50').all();
  res.json(history);
});

app.post('/api/history', (req, res) => {
  const { url, title } = req.body;
  db.prepare('INSERT INTO history (url, title) VALUES (?, ?)').run(url, title);
  res.json({ success: true });
});

app.get('/api/settings', (req, res) => {
  const adblock = db.prepare('SELECT value FROM settings WHERE key = ?').get('adblock_enabled');
  res.json({ adblock_enabled: adblock ? adblock.value === 'true' : true });
});

app.post('/api/settings', (req, res) => {
  const { key, value } = req.body;
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
  res.json({ success: true });
});

app.post('/api/domain_rules', (req, res) => {
  const { domain, is_blocked } = req.body;
  db.prepare('INSERT INTO domain_rules (domain, is_blocked) VALUES (?, ?) ON CONFLICT(domain) DO UPDATE SET is_blocked = excluded.is_blocked').run(domain, is_blocked ? 1 : 0);
  res.json({ success: true });
});

app.get('/api/domain_rules/:domain', (req, res) => {
  const rule = db.prepare('SELECT is_blocked FROM domain_rules WHERE domain = ?').get(req.params.domain);
  res.json({ is_blocked: rule ? rule.is_blocked === 1 : null });
});


// WebSockets
io.on('connection', (socket) => {
  console.log('Client connected for WebSocket updates');
});

const PORT = process.env.PORT || 5800;

initAdblocker().then(() => {
  server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
});
