const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const mime = require('mime-types');
const fs = require('fs');
const path = require('path');
const { shouldBlockRequest } = require('./adblock');
const { io } = require('./server'); // We will export io from server.js

const router = express.Router();
const storageDir = process.env.NODE_ENV === 'production' ? '/media_hdd' : path.join(__dirname, 'downloads');

if (!fs.existsSync(storageDir)) {
  fs.mkdirSync(storageDir, { recursive: true });
}

router.all('/', async (req, res) => {
  const targetUrl = req.query.url;
  const sourceUrl = req.headers.referer ? new URL(req.headers.referer).searchParams.get('url') : targetUrl;

  if (!targetUrl) return res.status(400).send('No URL provided');

  try {
    // AdBlock Check
    if (shouldBlockRequest(targetUrl, sourceUrl || targetUrl, req.query.type || 'document')) {
      return res.status(403).send(''); // Blocked
    }

    const axiosConfig = {
      method: req.method,
      url: targetUrl,
      headers: { ...req.headers },
      responseType: 'stream',
      validateStatus: () => true, // Don't throw on 404/500
    };

    // Remove headers that might cause issues
    delete axiosConfig.headers['host'];
    delete axiosConfig.headers['referer'];
    delete axiosConfig.headers['cookie']; // We'd need a cookie jar for complex sites

    if (['POST', 'PUT', 'PATCH'].includes(req.method) && Object.keys(req.body || {}).length > 0) {
      axiosConfig.data = req.body;
    }

    const response = await axios(axiosConfig);

    // Strip restrictive headers
    const headers = { ...response.headers };
    delete headers['x-frame-options'];
    delete headers['content-security-policy'];
    delete headers['content-security-policy-report-only'];
    delete headers['access-control-allow-origin'];
    
    // Set CORS headers so the iframe can access it if needed
    headers['access-control-allow-origin'] = '*';

    const contentType = headers['content-type'] || '';
    const contentDisposition = headers['content-disposition'] || '';

    // Detect file download
    const isAttachment = contentDisposition.includes('attachment');
    const isBinary = !contentType.includes('text/') && !contentType.includes('application/json') && !contentType.includes('application/javascript');
    const isImageOrFont = contentType.includes('image/') || contentType.includes('font/');

    if (isAttachment || (isBinary && !isImageOrFont)) {
      // It's a download
      let filename = 'download';
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match) filename = match[1];
      } else {
        const ext = mime.extension(contentType);
        filename = \`file_\${Date.now()}.\${ext || 'bin'}\`;
      }

      const filePath = path.join(storageDir, filename);
      const writer = fs.createWriteStream(filePath);
      
      const totalLength = response.headers['content-length'] || 0;
      let downloaded = 0;

      // Broadcast download start
      const ioInstance = req.app.get('io');
      if (ioInstance) {
        ioInstance.emit('download_start', { filename, total: totalLength });
      }

      response.data.on('data', (chunk) => {
        downloaded += chunk.length;
        if (ioInstance) {
          ioInstance.emit('download_progress', { filename, downloaded, total: totalLength });
        }
      });

      response.data.pipe(writer);

      writer.on('finish', () => {
        if (ioInstance) ioInstance.emit('download_complete', { filename });
      });

      return res.send(\`<script>alert('Downloading \${filename} to storage directory...'); window.history.back();</script>\`);
    }

    // Rewrite HTML
    if (contentType.includes('text/html')) {
      let html = '';
      response.data.on('data', chunk => html += chunk.toString('utf-8'));
      response.data.on('end', () => {
        const $ = cheerio.load(html);
        const baseUrl = new URL(targetUrl);

        const rewriteUrl = (attrUrl) => {
          if (!attrUrl || attrUrl.startsWith('data:') || attrUrl.startsWith('javascript:')) return attrUrl;
          try {
            const absoluteUrl = new URL(attrUrl, baseUrl.href).href;
            return \`/proxy?url=\${encodeURIComponent(absoluteUrl)}\`;
          } catch (e) {
            return attrUrl;
          }
        };

        $('[href]').each((_, el) => { $(el).attr('href', rewriteUrl($(el).attr('href'))); });
        $('[src]').each((_, el) => { $(el).attr('src', rewriteUrl($(el).attr('src'))); });
        $('[action]').each((_, el) => { $(el).attr('action', rewriteUrl($(el).attr('action'))); });
        
        // Inject script to intercept window.fetch and XHR if needed
        $('head').prepend(\`<script>
          const originalFetch = window.fetch;
          window.fetch = function() {
            if (typeof arguments[0] === 'string' && !arguments[0].startsWith('/proxy?')) {
               const absolute = new URL(arguments[0], '\${baseUrl.href}').href;
               arguments[0] = '/proxy?url=' + encodeURIComponent(absolute);
            }
            return originalFetch.apply(this, arguments);
          };
        </script>\`);

        res.set(headers);
        res.send($.html());
      });
      return;
    }

    // For non-HTML text/binary streaming
    res.set(headers);
    response.data.pipe(res);

  } catch (error) {
    console.error('Proxy Error:', error.message);
    res.status(500).send('Proxy Error: ' + error.message);
  }
});

module.exports = router;
