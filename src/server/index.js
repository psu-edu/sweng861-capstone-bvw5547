// Campus Works API. Placeholder for the Week 2 check in.
// Express and DynamoDB replace this once real work starts.

const http = require('http');

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok', service: 'campusworks-api' }));
});

server.listen(PORT, () => {
  console.log(`Campus Works API listening on http://localhost:${PORT}`);
});
