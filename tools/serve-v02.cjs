/** 原型静态预览服务：供 Docker 内运行，仅提供原型文件，不执行任何业务 API。 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
http.createServer((request, response) => {
  let file;
  try { file = path.resolve(root, '.' + decodeURIComponent(new URL(request.url, 'http://localhost').pathname)); }
  catch (_) { response.writeHead(400).end('Invalid URL'); return; }
  if ((file !== root && !file.startsWith(root + path.sep)) || path.relative(root, file).split(path.sep).some(part => part.startsWith('.'))) {
    response.writeHead(403).end('Forbidden'); return;
  }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  fs.readFile(file, (error, data) => {
    if (error) { response.writeHead(404).end('Not found'); return; }
    response.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
    response.setHeader('Cache-Control', 'no-cache');
    response.end(data);
  });
}).listen(4173, '0.0.0.0', () => console.log('Prototype ready at http://localhost:4173'));
