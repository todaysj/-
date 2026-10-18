import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const TRIPS_FILE = path.join(DATA_DIR, 'trips.json');
const BRAND_FILE = path.join(DATA_DIR, 'brand.json');

function readTripsFile(): any[] {
  try {
    if (fs.existsSync(TRIPS_FILE)) {
      const content = fs.readFileSync(TRIPS_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.error('Error reading trips.json:', err);
  }
  return [];
}

function writeTripsFile(trips: any[]) {
  try {
    fs.writeFileSync(TRIPS_FILE, JSON.stringify(trips, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing trips.json:', err);
  }
}

function readBrandFile(): any {
  try {
    if (fs.existsSync(BRAND_FILE)) {
      const content = fs.readFileSync(BRAND_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.error('Error reading brand.json:', err);
  }
  return null;
}

function writeBrandFile(brand: any) {
  try {
    fs.writeFileSync(BRAND_FILE, JSON.stringify(brand, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing brand.json:', err);
  }
}

// ---------------------------------------------------------------------------
// Real-Time Full-Stack Sync API Routes (100% immune to external quota limits)
// ---------------------------------------------------------------------------

// Active SSE client connections for instant cross-device live updates
const sseClients = new Set<express.Response>();

function broadcastSSE(data: any) {
  const message = `data: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(message);
    } catch {
      sseClients.delete(client);
    }
  }
}

// Live SSE Stream for mobile, desktop, and all shared devices
app.get('/api/sync/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  sseClients.add(res);

  // Immediately send initial payload
  const trips = readTripsFile();
  const brand = readBrandFile();
  res.write(`data: ${JSON.stringify({ type: 'initial', trips, brand, updatedAt: Date.now() })}\n\n`);

  const keepAlive = setInterval(() => {
    try {
      res.write(':keep-alive\n\n');
    } catch {
      clearInterval(keepAlive);
      sseClients.delete(res);
    }
  }, 20000);

  req.on('close', () => {
    clearInterval(keepAlive);
    sseClients.delete(res);
  });
});

app.get('/api/sync/trips', (_req, res) => {
  const trips = readTripsFile();
  res.json({
    trips,
    updatedAt: trips.reduce((max, t) => Math.max(max, t.updatedAt || 0), 0)
  });
});

app.post('/api/sync/trips', (req, res) => {
  const incoming = req.body;
  if (!Array.isArray(incoming)) {
    return res.status(400).json({ error: 'Expected an array of trips' });
  }
  writeTripsFile(incoming);
  broadcastSSE({ type: 'trips_updated', trips: incoming, updatedAt: Date.now() });
  res.json({ success: true, count: incoming.length });
});

app.post('/api/sync/trip', (req, res) => {
  const singleTrip = req.body;
  if (!singleTrip || !singleTrip.id) {
    return res.status(400).json({ error: 'Invalid trip payload' });
  }
  const trips = readTripsFile();
  const index = trips.findIndex((t) => t.id === singleTrip.id);
  if (index >= 0) {
    trips[index] = singleTrip;
  } else {
    trips.unshift(singleTrip);
  }
  writeTripsFile(trips);
  broadcastSSE({ type: 'trips_updated', trips, updatedAt: Date.now() });
  res.json({ success: true, id: singleTrip.id });
});

app.delete('/api/sync/trip/:id', (req, res) => {
  const tripId = req.params.id;
  const trips = readTripsFile();
  const filtered = trips.filter((t) => t.id !== tripId);
  writeTripsFile(filtered);
  broadcastSSE({ type: 'trips_updated', trips: filtered, updatedAt: Date.now() });
  res.json({ success: true, remaining: filtered.length });
});

app.get('/api/sync/brand', (_req, res) => {
  const brand = readBrandFile();
  res.json(brand || {});
});

app.post('/api/sync/brand', (req, res) => {
  const brand = req.body;
  writeBrandFile(brand);
  broadcastSSE({ type: 'brand_updated', brand, updatedAt: Date.now() });
  res.json({ success: true });
});

// ---------------------------------------------------------------------------
// Server Bootstrap: Express + Vite Middlewares in Dev, Static in Prod
// ---------------------------------------------------------------------------
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[J-Planner Server] Running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
