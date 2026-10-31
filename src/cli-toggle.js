const http = require('http');

const action = process.argv[2] || 'toggle';

const req = http.get(`http://127.0.0.1:49152/${action}`, (res) => {
  res.on('data', () => {});
  res.on('end', () => {
    process.exit(0);
  });
});

req.on('error', (err) => {
  // Silent exit if server not up yet
  process.exit(1);
});

req.setTimeout(1000, () => {
  req.destroy();
  process.exit(1);
});
