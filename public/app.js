import RFB from 'https://cdn.jsdelivr.net/npm/@novnc/novnc@1.3.0/core/rfb.js';

// --- noVNC Setup ---
const vncContainer = document.getElementById('vnc-container');
const vncStatus = document.getElementById('vnc-status');
let rfb;

function connectVNC() {
    vncStatus.textContent = 'Connecting to WebKitGTK Engine...';
    vncStatus.classList.remove('hidden');

    // The websocket URL for websockify
    const wsUrl = `ws://${window.location.hostname}:6080`;

    rfb = new RFB(vncContainer, wsUrl, {
        credentials: { password: '' }
    });

    rfb.addEventListener('connect', () => {
        vncStatus.classList.add('hidden');
        console.log("noVNC Connected!");
    });

    rfb.addEventListener('disconnect', (e) => {
        vncStatus.classList.remove('hidden');
        vncStatus.textContent = `Disconnected. Reconnecting...`;
        setTimeout(connectVNC, 2000);
    });

    rfb.scaleViewport = true;
    rfb.resizeSession = true;
}

// Connect after a slight delay to let backend start
setTimeout(connectVNC, 1000);


// --- API Communication ---

async function navigateTo(url) {
    document.getElementById('url-input').value = url;
    try {
        await fetch('/api/browser/navigate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });
        document.getElementById('home-screen').classList.add('hidden');
    } catch (e) {
        console.error('Navigate error:', e);
    }
}

async function goBack() {
    await fetch('/api/browser/back', { method: 'POST' });
}

async function goForward() {
    await fetch('/api/browser/forward', { method: 'POST' });
}

async function reload() {
    await fetch('/api/browser/reload', { method: 'POST' });
}


// --- UI Event Listeners ---

document.getElementById('url-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const val = document.getElementById('url-input').value.trim();
    if (val) navigateTo(val);
});

document.getElementById('btn-back').addEventListener('click', goBack);
document.getElementById('btn-forward').addEventListener('click', goForward);
document.getElementById('btn-refresh').addEventListener('click', reload);

document.getElementById('btn-home').addEventListener('click', () => {
    document.getElementById('home-screen').classList.remove('hidden');
    document.getElementById('url-input').value = '';
});

window.navigateHomeUrl = (url) => {
    navigateTo(url);
};

// Side Panel Logic
const sidePanelOverlay = document.getElementById('side-panel-overlay');
const sidePanel = document.getElementById('side-panel');
const sidePanelTitle = document.getElementById('side-panel-title');
const sidePanelList = document.getElementById('side-panel-list');

function openSidePanel(title) {
    sidePanelTitle.textContent = title;
    sidePanelOverlay.classList.remove('hidden');
    sidePanelOverlay.classList.add('flex');
    setTimeout(() => sidePanel.classList.remove('translate-x-full'), 10);
}

document.getElementById('close-side-panel').addEventListener('click', () => {
    sidePanel.classList.add('translate-x-full');
    setTimeout(() => {
        sidePanelOverlay.classList.add('hidden');
        sidePanelOverlay.classList.remove('flex');
    }, 300);
});

document.getElementById('btn-history').addEventListener('click', async () => {
    openSidePanel('History');
    sidePanelList.innerHTML = '<div class="text-center text-gray-500 py-4">Loading...</div>';
    try {
        const res = await fetch('/api/history');
        const history = await res.json();
        sidePanelList.innerHTML = history.map(item => `
            <div class="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer flex justify-between items-center group transition-colors" onclick="navigateHomeUrl('${item.url}')">
                <div class="overflow-hidden">
                    <div class="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">${item.title || item.url}</div>
                    <div class="text-xs text-gray-500 truncate">${item.url}</div>
                </div>
            </div>
        `).join('') || '<div class="text-sm text-gray-500 text-center">No history yet.</div>';
    } catch (err) {
        sidePanelList.innerHTML = '<div class="text-sm text-red-500 text-center">Failed to load history.</div>';
    }
});
