const http = require('http');
const Logger = require('./logger');

class LocalServer {
  constructor(options = {}) {
    this.port = options.port || 49152;
    this.onToggle = options.onToggle || (() => {});
    this.onStart = options.onStart || (() => {});
    this.onStop = options.onStop || (() => {});
    this.getStatus = options.getStatus || (() => ({ isRecording: false, status: 'idle' }));
    this.server = null;
  }

  start() {
    if (this.server) return;

    this.server = http.createServer((req, res) => {
      const url = req.url ? req.url.split('?')[0] : '/';

      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Content-Type', 'application/json');

      if (url === '/toggle') {
        Logger.log('[LocalServer] Received /toggle trigger');
        try {
          this.onToggle();
          res.writeHead(200);
          res.end(JSON.stringify({ success: true, action: 'toggle' }));
        } catch (e) {
          res.writeHead(500);
          res.end(JSON.stringify({ success: false, error: e.message }));
        }
      } else if (url === '/start') {
        Logger.log('[LocalServer] Received /start trigger');
        try {
          this.onStart();
          res.writeHead(200);
          res.end(JSON.stringify({ success: true, action: 'start' }));
        } catch (e) {
          res.writeHead(500);
          res.end(JSON.stringify({ success: false, error: e.message }));
        }
      } else if (url === '/stop') {
        Logger.log('[LocalServer] Received /stop trigger');
        try {
          this.onStop();
          res.writeHead(200);
          res.end(JSON.stringify({ success: true, action: 'stop' }));
        } catch (e) {
          res.writeHead(500);
          res.end(JSON.stringify({ success: false, error: e.message }));
        }
      } else if (url === '/status') {
        res.writeHead(200);
        res.end(JSON.stringify(this.getStatus()));
      } else {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Not found' }));
      }
    });

    this.server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        Logger.warn(`LocalServer port ${this.port} is already in use. Another instance might be running.`);
      } else {
        Logger.error('LocalServer error:', err);
      }
    });

    this.server.listen(this.port, '127.0.0.1', () => {
      Logger.success(`[LocalServer] Listening on http://127.0.0.1:${this.port} for global OS hotkey triggers`);
    });
  }

  stop() {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }
}

module.exports = LocalServer;
