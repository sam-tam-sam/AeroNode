const socket = io();

let tabs = [];
let activeTabId = null;
let tabCounter = 0;

const tabBar = document.getElementById('tab-bar');
const webviewContainer = document.getElementById('webview-container');
const urlInput = document.getElementById('url-input');
const urlForm = document.getElementById('url-form');
const newTabBtn = document.getElementById('new-tab-btn');

function createTab(url = 'about:blank') {
  const id = \`tab-\${tabCounter++}\`;
  
  // Create Tab UI
  const tabEl = document.createElement('div');
  tabEl.className = 'group flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-t-md cursor-pointer border-t-2 border-transparent max-w-[200px] min-w-[120px] transition-colors';
  tabEl.id = \`ui-\${id}\`;
  tabEl.innerHTML = \`
    <div class="w-4 h-4 rounded-full bg-slate-600 animate-pulse hidden" id="spinner-\${id}"></div>
    <img src="https://www.google.com/s2/favicons?domain=\${url}&sz=32" class="w-4 h-4" id="fav-\${id}" onerror="this.style.display='none'">
    <span class="truncate text-sm flex-1" id="title-\${id}">New Tab</span>
    <button class="p-0.5 rounded-full hover:bg-slate-600 text-slate-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity" onclick="closeTab('\${id}', event)">
      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
    </button>
  \`;
  
  tabEl.onclick = () => switchTab(id);
  tabBar.insertBefore(tabEl, newTabBtn);

  // Create Iframe
  const iframe = document.createElement('iframe');
  iframe.id = id;
  iframe.className = 'hidden-tab';
  webviewContainer.appendChild(iframe);

  tabs.push({ id, url, title: 'New Tab' });
  
  if (url !== 'about:blank') {
    navigate(id, url);
  }
  
  switchTab(id);
}

function switchTab(id) {
  if (activeTabId) {
    document.getElementById(activeTabId).classList.add('hidden-tab');
    const oldUi = document.getElementById(\`ui-\${activeTabId}\`);
    if(oldUi) {
      oldUi.classList.remove('bg-slate-700', 'border-blue-500');
      oldUi.classList.add('bg-slate-800');
    }
  }
  
  activeTabId = id;
  const iframe = document.getElementById(id);
  iframe.classList.remove('hidden-tab');
  
  const ui = document.getElementById(\`ui-\${id}\`);
  ui.classList.remove('bg-slate-800');
  ui.classList.add('bg-slate-700', 'border-blue-500');

  const tab = tabs.find(t => t.id === id);
  urlInput.value = tab.url === 'about:blank' ? '' : tab.url;
}

window.closeTab = function(id, event) {
  event.stopPropagation();
  const tabIndex = tabs.findIndex(t => t.id === id);
  tabs.splice(tabIndex, 1);
  
  document.getElementById(\`ui-\${id}\`).remove();
  document.getElementById(id).remove();

  if (tabs.length === 0) {
    createTab();
  } else if (activeTabId === id) {
    switchTab(tabs[Math.max(0, tabIndex - 1)].id);
  }
};

function formatUrl(rawUrl) {
  if (!rawUrl.includes('://') && !rawUrl.startsWith('about:')) {
    if (rawUrl.includes('.') && !rawUrl.includes(' ')) {
      return \`https://\${rawUrl}\`;
    }
    return \`https://duckduckgo.com/html/?q=\${encodeURIComponent(rawUrl)}\`;
  }
  return rawUrl;
}

function navigate(id, url) {
  const tab = tabs.find(t => t.id === id);
  tab.url = url;
  
  const iframe = document.getElementById(id);
  const spinner = document.getElementById(\`spinner-\${id}\`);
  const fav = document.getElementById(\`fav-\${id}\`);
  
  spinner.classList.remove('hidden');
  fav.classList.add('hidden');
  
  iframe.src = \`/proxy?url=\${encodeURIComponent(url)}\`;
  
  // Basic title extraction since iframe cross-origin limits access
  document.getElementById(\`title-\${id}\`).textContent = new URL(url).hostname || 'Loading...';
  if(id === activeTabId) urlInput.value = url;

  // We can't perfectly detect iframe onload reliably due to proxy rewrites sometimes, but we try
  iframe.onload = () => {
    spinner.classList.add('hidden');
    fav.classList.remove('hidden');
    
    // We would fetch real title via our API if we wanted to be precise
    fetch('/api/history', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ url, title: url })
    });
  };
}

urlForm.onsubmit = (e) => {
  e.preventDefault();
  const url = formatUrl(urlInput.value);
  if (activeTabId) {
    navigate(activeTabId, url);
  }
};

newTabBtn.onclick = () => createTab();

document.getElementById('btn-back').onclick = () => {
  if(activeTabId) document.getElementById(activeTabId).contentWindow.history.back();
};
document.getElementById('btn-forward').onclick = () => {
  if(activeTabId) document.getElementById(activeTabId).contentWindow.history.forward();
};
document.getElementById('btn-refresh').onclick = () => {
  if(activeTabId) document.getElementById(activeTabId).contentWindow.location.reload();
};

// Downloads WebSocket
const downloadOverlay = document.getElementById('download-overlay');
const downloadList = document.getElementById('download-list');
const activeDownloads = {};

socket.on('download_start', (data) => {
  downloadOverlay.classList.remove('hidden');
  downloadOverlay.classList.add('flex');
  
  const el = document.createElement('div');
  el.id = \`dl-\${data.filename}\`;
  el.className = 'bg-slate-800 p-2 rounded text-sm';
  el.innerHTML = \`
    <div class="flex justify-between mb-1 truncate"><span>\${data.filename}</span> <span id="pct-\${data.filename}">0%</span></div>
    <div class="w-full bg-slate-700 rounded-full h-1.5">
      <div class="bg-blue-500 h-1.5 rounded-full" id="bar-\${data.filename}" style="width: 0%"></div>
    </div>
  \`;
  downloadList.appendChild(el);
  activeDownloads[data.filename] = true;
});

socket.on('download_progress', (data) => {
  if(activeDownloads[data.filename]) {
    const pct = Math.round((data.downloaded / data.total) * 100) || 0;
    document.getElementById(\`pct-\${data.filename}\`).textContent = \`\${pct}%\`;
    document.getElementById(\`bar-\${data.filename}\`).style.width = \`\${pct}%\`;
  }
});

socket.on('download_complete', (data) => {
  if(activeDownloads[data.filename]) {
    document.getElementById(\`pct-\${data.filename}\`).textContent = 'Done';
    document.getElementById(\`pct-\${data.filename}\`).classList.add('text-green-400');
    delete activeDownloads[data.filename];
  }
});

document.getElementById('close-downloads').onclick = () => {
  downloadOverlay.classList.add('hidden');
  downloadOverlay.classList.remove('flex');
};

// Settings
const settingsBtn = document.getElementById('btn-settings');
const settingsModal = document.getElementById('settings-modal');
const closeSettings = document.getElementById('close-settings');
const globalAdblockToggle = document.getElementById('global-adblock');

settingsBtn.onclick = async () => {
  const res = await fetch('/api/settings');
  const data = await res.json();
  globalAdblockToggle.checked = data.adblock_enabled;
  settingsModal.classList.remove('hidden');
  settingsModal.classList.add('flex');
};

closeSettings.onclick = () => {
  settingsModal.classList.add('hidden');
  settingsModal.classList.remove('flex');
};

globalAdblockToggle.onchange = async (e) => {
  await fetch('/api/settings', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ key: 'adblock_enabled', value: e.target.checked ? 'true' : 'false' })
  });
};

// Init
createTab();
