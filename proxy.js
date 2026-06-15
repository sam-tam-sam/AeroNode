const express = require('express');
const { createProxyMiddleware, responseInterceptor } = require('http-proxy-middleware');
const cheerio = require('cheerio');
const { shouldBlockRequest } = require('./adblock');
const router = express.Router();

const proxyOptions = {
  target: 'https://example.com', // Fallback, overridden by router
  router: (req) => {
    if (!req.query.url) return 'http://localhost';
    try {
      return new URL(req.query.url).origin;
    } catch(e) {
      return 'http://localhost';
    }
  },
  pathRewrite: (path, req) => {
    if (!req.query.url) return '/';
    try {
      const u = new URL(req.query.url);
      return u.pathname + u.search;
    } catch(e) {
      return '/';
    }
  },
  changeOrigin: true,
  ws: true,
  secure: false, // Accept invalid certs
  cookieDomainRewrite: '*', // Keep cookies valid inside the proxy
  selfHandleResponse: true, // Crucial for responseInterceptor
  on: {
    proxyReq: (proxyReq, req, res) => {
      // Force identity encoding to prevent decompression issues in interceptor
      proxyReq.removeHeader('accept-encoding');
      proxyReq.removeHeader('x-forwarded-for');
      proxyReq.removeHeader('x-forwarded-proto');
      proxyReq.removeHeader('x-forwarded-host');
    },
    proxyRes: responseInterceptor(async (responseBuffer, proxyRes, req, res) => {
      // Strip restrictive headers from the actual response object
      res.removeHeader('x-frame-options');
      res.removeHeader('content-security-policy');
      res.removeHeader('content-security-policy-report-only');
      res.setHeader('access-control-allow-origin', '*');

      // Intercept and rewrite redirects (Location headers) so they don't escape the proxy
      const location = res.getHeader('location');
      if (location) {
        try {
          const absoluteLocation = new URL(location, req.query.url).href;
          res.setHeader('location', `/proxy?url=${encodeURIComponent(absoluteLocation)}`);
        } catch(e) {}
      }

      const contentType = res.getHeader('content-type') || proxyRes.headers['content-type'] || '';
      if (contentType.includes('text/html')) {
        const html = responseBuffer.toString('utf8');
        const $ = cheerio.load(html);
        const targetUrl = req.query.url;
        let baseUrlHref = '';
        try {
          baseUrlHref = new URL(targetUrl).href;
        } catch(e) {}

        // Rewrite URLs inside DOM
        const rewriteUrl = (attrUrl) => {
          if (!attrUrl || attrUrl.startsWith('data:') || attrUrl.startsWith('javascript:')) return attrUrl;
          try {
            const absoluteUrl = new URL(attrUrl, baseUrlHref).href;
            return `/proxy?url=${encodeURIComponent(absoluteUrl)}`;
          } catch (e) {
            return attrUrl;
          }
        };

        $('[href]').each((_, el) => { $(el).attr('href', rewriteUrl($(el).attr('href'))); });
        $('[src]').each((_, el) => { $(el).attr('src', rewriteUrl($(el).attr('src'))); });
        $('[action]').each((_, el) => { $(el).attr('action', rewriteUrl($(el).attr('action'))); });

        $('head').prepend(`<base href="${baseUrlHref}">
        <script>
          const originalFetch = window.fetch;
          window.fetch = function() {
            if (typeof arguments[0] === 'string' && !arguments[0].startsWith('/proxy?')) {
               try {
                 const absolute = new URL(arguments[0], '${baseUrlHref}').href;
                 arguments[0] = '/proxy?url=' + encodeURIComponent(absolute);
               } catch(e) {}
            }
            return originalFetch.apply(this, arguments);
          };

          const originalXhrOpen = XMLHttpRequest.prototype.open;
          XMLHttpRequest.prototype.open = function(method, url) {
             if (typeof url === 'string' && !url.startsWith('/proxy?')) {
               try {
                 const absolute = new URL(url, '${baseUrlHref}').href;
                 url = '/proxy?url=' + encodeURIComponent(absolute);
               } catch(e) {}
             }
             return originalXhrOpen.call(this, method, url, arguments[2], arguments[3], arguments[4]);
          };

          document.addEventListener('click', function(e) {
            const a = e.target.closest('a');
            if (a && a.href && !a.href.startsWith('javascript:')) {
              e.preventDefault();
              e.stopPropagation();
              if (a.hasAttribute('target')) a.removeAttribute('target');
              let href = a.getAttribute('href');
              if (href && href.startsWith('/proxy?url=')) {
                window.location.href = href;
                return;
              }
              try {
                const absoluteUrl = new URL(href, '${baseUrlHref}').href;
                window.location.href = '/proxy?url=' + encodeURIComponent(absoluteUrl);
              } catch(err) {
                window.location.href = href;
              }
            }
          }, true);

          document.addEventListener('submit', function(e) {
            const form = e.target;
            if (form && form.action) {
              e.preventDefault();
              if (form.hasAttribute('target')) form.removeAttribute('target');
              let action = form.getAttribute('action');
              if (action && !action.startsWith('/proxy?url=')) {
                try {
                  const absoluteUrl = new URL(action, '${baseUrlHref}').href;
                  form.action = '/proxy?url=' + encodeURIComponent(absoluteUrl);
                } catch(err) {}
              }
              form.submit();
            }
          }, true);
        </script>`);

        return Buffer.from($.html());
      }

      return responseBuffer;
    })
  }
};

const proxyMiddleware = createProxyMiddleware(proxyOptions);

router.use('/', (req, res, next) => {
  if (!req.query.url) return res.status(400).send('No URL provided');
  
  const targetUrl = req.query.url;
  const sourceUrl = req.headers.referer ? (new URL(req.headers.referer).searchParams.get('url') || targetUrl) : targetUrl;
  
  if (shouldBlockRequest(targetUrl, sourceUrl, 'document')) {
    return res.status(403).send('Blocked by AdBlocker');
  }
  
  proxyMiddleware(req, res, next);
});

module.exports = router;
