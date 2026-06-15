document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const password = document.getElementById('password').value;
  const errorEl = document.getElementById('error');

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    
    const data = await res.json();
    
    if (data.success) {
      window.location.href = '/';
    } else {
      errorEl.classList.remove('hidden');
    }
  } catch (err) {
    errorEl.textContent = 'Connection error.';
    errorEl.classList.remove('hidden');
  }
});
