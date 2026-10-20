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
const DELETED_TRIPS_FILE = path.join(DATA_DIR, 'deleted_trips.json');

function readDeletedTrips(): string[] {
  try {
    if (fs.existsSync(DELETED_TRIPS_FILE)) {
      const content = fs.readFileSync(DELETED_TRIPS_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.error('Error reading deleted_trips.json:', err);
  }
  return [];
}

function writeDeletedTrips(ids: string[]) {
  try {
    const unique = Array.from(new Set(ids));
    fs.writeFileSync(DELETED_TRIPS_FILE, JSON.stringify(unique, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing deleted_trips.json:', err);
  }
}

function readTripsFile(): any[] {
  try {
    if (fs.existsSync(TRIPS_FILE)) {
      const content = fs.readFileSync(TRIPS_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        const deletedSet = new Set(readDeletedTrips());
        const valid = parsed.filter((t) => t && t.id && !deletedSet.has(t.id));
        const brand = readBrandFile();
        if (brand && Array.isArray(brand.tripOrder) && brand.tripOrder.length > 0) {
          const orderMap = new Map(brand.tripOrder.map((id: string, idx: number) => [id, idx]));
          return valid.sort((a, b) => {
            const idxA = orderMap.has(a.id) ? (orderMap.get(a.id) as number) : 9999;
            const idxB = orderMap.has(b.id) ? (orderMap.get(b.id) as number) : 9999;
            return idxA - idxB;
          });
        }
        return valid;
      }
    }
  } catch (err) {
    console.error('Error reading trips.json:', err);
  }
  return [];
}

function writeTripsFile(trips: any[]) {
  try {
    const deletedSet = new Set(readDeletedTrips());
    const valid = Array.isArray(trips) ? trips.filter((t) => t && t.id && !deletedSet.has(t.id)) : [];
    const brand = readBrandFile();
    if (brand && Array.isArray(brand.tripOrder) && brand.tripOrder.length > 0) {
      const orderMap = new Map(brand.tripOrder.map((id: string, idx: number) => [id, idx]));
      valid.sort((a, b) => {
        const idxA = orderMap.has(a.id) ? (orderMap.get(a.id) as number) : 9999;
        const idxB = orderMap.has(b.id) ? (orderMap.get(b.id) as number) : 9999;
        return idxA - idxB;
      });
    }
    fs.writeFileSync(TRIPS_FILE, JSON.stringify(valid, null, 2), 'utf-8');
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
  res.write(`data: ${JSON.stringify({ type: 'initial', trips, brand, deletedTripIds: readDeletedTrips(), updatedAt: Date.now() })}\n\n`);

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

app.get('/api/sync/deleted_trips', (_req, res) => {
  res.json({ deletedTripIds: readDeletedTrips() });
});

app.post('/api/sync/trips', (req, res) => {
  const incoming = req.body;
  if (!Array.isArray(incoming)) {
    return res.status(400).json({ error: 'Expected an array of trips' });
  }
  const deletedSet = new Set(readDeletedTrips());
  const valid = incoming.filter((t) => t && t.id && !deletedSet.has(t.id));
  writeTripsFile(valid);
  broadcastSSE({ type: 'trips_updated', trips: valid, updatedAt: Date.now() });
  res.json({ success: true, count: valid.length });
});

app.post('/api/sync/trip', (req, res) => {
  const singleTrip = req.body;
  if (!singleTrip || !singleTrip.id) {
    return res.status(400).json({ error: 'Invalid trip payload' });
  }
  const deletedSet = new Set(readDeletedTrips());
  if (deletedSet.has(singleTrip.id)) {
    return res.json({ success: false, ignored: true, reason: 'Trip was permanently deleted' });
  }
  const trips = readTripsFile();
  const index = trips.findIndex((t) => t.id === singleTrip.id);
  if (index >= 0) {
    trips[index] = singleTrip;
  } else {
    trips.push(singleTrip);
  }
  writeTripsFile(trips);
  broadcastSSE({ type: 'trips_updated', trips, updatedAt: Date.now() });
  res.json({ success: true, id: singleTrip.id });
});

app.delete('/api/sync/trip/:id', (req, res) => {
  const tripId = req.params.id;
  const deleted = readDeletedTrips();
  if (!deleted.includes(tripId)) {
    deleted.push(tripId);
    writeDeletedTrips(deleted);
  }
  const trips = readTripsFile().filter((t) => t.id !== tripId);
  writeTripsFile(trips);

  // Synchronize brand tripOrder
  const brand = readBrandFile();
  if (brand && Array.isArray(brand.tripOrder)) {
    brand.tripOrder = brand.tripOrder.filter((id: string) => id !== tripId);
    if (brand.activeTripId === tripId) {
      brand.activeTripId = trips[0]?.id || '';
    }
    writeBrandFile(brand);
  }

  broadcastSSE({ type: 'trips_updated', trips, deletedTripId: tripId, updatedAt: Date.now() });
  res.json({ success: true, remaining: trips.length });
});

app.get('/api/sync/brand', (_req, res) => {
  const brand = readBrandFile();
  res.json(brand || {});
});

app.post('/api/sync/brand', (req, res) => {
  const brand = req.body || {};
  if (!brand.updatedAt) {
    brand.updatedAt = Date.now();
  }
  writeBrandFile(brand);
  broadcastSSE({ type: 'brand_updated', brand, updatedAt: brand.updatedAt });
  res.json({ success: true });
});

app.get('/api/config/supabase', (_req, res) => {
  res.json({
    supabaseUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '',
  });
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
