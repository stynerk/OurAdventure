const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const html = path.join(__dirname, 'index.html');
const server = http.createServer((req, res) => {
  if (!['/', '/index.html'].includes(req.url.split('?')[0])) {
    res.writeHead(404); res.end('Not found'); return;
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  fs.createReadStream(html).pipe(res);
});
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
server.listen(4173, '127.0.0.1', () => console.log('Our Adventures mockup: http://127.0.0.1:4173'));
