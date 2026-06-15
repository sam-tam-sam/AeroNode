const { FiltersEngine } = require('@ghostery/adblocker');
const fetch = require('cross-fetch');
const db = require('./db');

let engine = null;

async function initAdblocker() {
  try {
    console.log('Loading AdBlock Engine with EasyList...');
    engine = await FiltersEngine.fromLists(fetch, [
      'https://easylist.to/easylist/easylist.txt',
      'https://easylist.to/easylist/easyprivacy.txt'
    ]);
    console.log('AdBlock Engine Loaded.');
  } catch (err) {
    console.error('Failed to load AdBlock engine:', err);
  }
}

// Global toggle state from DB
function isAdblockEnabled() {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('adblock_enabled');
  return row ? row.value === 'true' : true; // Default true
}

// Site-specific rules
function getDomainRule(domain) {
  const row = db.prepare('SELECT is_blocked FROM domain_rules WHERE domain = ?').get(domain);
  return row ? row.is_blocked === 1 : null;
}

function shouldBlockRequest(url, sourceUrl, type = 'script') {
  if (!engine || !isAdblockEnabled()) return false;

  try {
    const targetUrlObj = new URL(url);
    const targetDomain = targetUrlObj.hostname;
    
    // Check site-specific rule first
    const sourceUrlObj = new URL(sourceUrl);
    const sourceDomain = sourceUrlObj.hostname;
    
    const domainRule = getDomainRule(sourceDomain);
    if (domainRule === false) return false; // Whitelisted

    const { match } = engine.match(url, sourceUrl, type);
    return match;
  } catch (e) {
    return false;
  }
}

module.exports = {
  initAdblocker,
  shouldBlockRequest
};
