const express = require('express');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');
const fetch = require('cross-fetch');
const db = require('./db');

const app = express();
const server = http.createServer(app);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// --- Process Management ---
const processes = [];

function spawnProcess(name, command, args, envVars = {}) {
    console.log(`Starting ${name}...`);
    const proc = spawn(command, args, {
        env: { ...process.env, ...envVars },
        stdio: 'inherit'
    });
    
    proc.on('error', (err) => {
        console.error(`${name} error:`, err);
    });
    
    proc.on('close', (code) => {
        console.log(`${name} exited with code ${code}`);
    });
    
    processes.push(proc);
    return proc;
}

// 1. Start Xvfb (Virtual Screen 1280x800)
spawnProcess('Xvfb', 'Xvfb', [':99', '-screen', '0', '1280x800x24']);

// Wait a bit for Xvfb to start before starting GTK app
setTimeout(() => {
    // 2. Start WebKitGTK Python Wrapper
    spawnProcess('BrowserCore', 'python3', ['browser_core.py'], { DISPLAY: ':99' });
    
    // 3. Start x11vnc to capture the screen
    spawnProcess('x11vnc', 'x11vnc', ['-display', ':99', '-forever', '-nopw', '-shared', '-quiet']);
    
    // 4. Start websockify to convert VNC to WebSockets for noVNC
    spawnProcess('websockify', 'websockify', ['6080', 'localhost:5900']);
}, 2000);

// Ensure child processes are killed when node exits
process.on('SIGINT', () => {
    processes.forEach(p => p.kill('SIGKILL'));
    process.exit();
});
process.on('SIGTERM', () => {
    processes.forEach(p => p.kill('SIGKILL'));
    process.exit();
});

// --- UI to Browser API Bridge ---

const PYTHON_API = 'http://127.0.0.1:5000';

app.post('/api/browser/navigate', async (req, res) => {
    try {
        const response = await fetch(`${PYTHON_API}/navigate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body)
        });
        const data = await response.json();
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Failed to communicate with Browser Core' });
    }
});

app.post('/api/browser/back', async (req, res) => {
    try {
        await fetch(`${PYTHON_API}/go_back`, { method: 'POST' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Error' });
    }
});

app.post('/api/browser/forward', async (req, res) => {
    try {
        await fetch(`${PYTHON_API}/go_forward`, { method: 'POST' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Error' });
    }
});

app.post('/api/browser/reload', async (req, res) => {
    try {
        await fetch(`${PYTHON_API}/reload`, { method: 'POST' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Error' });
    }
});

// Database endpoints for history/bookmarks remain here
app.get('/api/history', (req, res) => {
    const history = db.prepare('SELECT * FROM history ORDER BY timestamp DESC LIMIT 50').all();
    res.json(history);
});
app.post('/api/history', (req, res) => {
    const { url, title } = req.body;
    db.prepare('INSERT INTO history (url, title) VALUES (?, ?)').run(url, title);
    res.json({ success: true });
});

const PORT = process.env.PORT || 5800;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`AeroNode Desktop UI running on port ${PORT}`);
    console.log(`VNC WebSocket running on port 6080`);
});
