import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// CRITICAL: App server must listen on port 3000 (nginx listens on 8080 and proxies to 3000)
function getAppPort(): number {
  const portArgIdx = process.argv.indexOf('--port');
  if (portArgIdx !== -1 && process.argv[portArgIdx + 1]) {
    const parsed = parseInt(process.argv[portArgIdx + 1], 10);
    if (!isNaN(parsed) && parsed > 0 && parsed !== 8080) return parsed;
  }
  if (process.env.PORT && process.env.PORT !== '8080') {
    const parsed = parseInt(process.env.PORT, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return 3000;
}
const PORT = getAppPort();

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const serverSupabase = (SUPABASE_URL && SUPABASE_ANON_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const TRIPS_FILE = path.join(DATA_DIR, 'trips.json');
const BRAND_FILE = path.join(DATA_DIR, 'brand.json');
const DELETED_TRIPS_FILE = path.join(DATA_DIR, 'deleted_trips.json');
const PHOTOS_DIR = path.join(DATA_DIR, 'photos');
if (!fs.existsSync(PHOTOS_DIR)) {
  fs.mkdirSync(PHOTOS_DIR, { recursive: true });
}

function savePhotoToDisk(photoId: string, dataUrl: string): string | null {
  try {
    if (!photoId || !dataUrl || typeof dataUrl !== 'string') return null;
    const cleanId = photoId.replace(/^photo:\/\//, '').replace(/[^a-zA-Z0-9_-]/g, '_');
    if (!dataUrl.startsWith('data:image/')) return null;
    const matches = dataUrl.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
    if (!matches) return null;
    const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');
    const filePath = path.join(PHOTOS_DIR, `${cleanId}.${ext}`);
    fs.writeFileSync(filePath, buffer);
    const rawPath = path.join(PHOTOS_DIR, cleanId);
    fs.writeFileSync(rawPath, buffer);
    return `/api/photos/${cleanId}`;
  } catch (err) {
    console.error('Error saving photo to disk:', err);
    return null;
  }
}

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

function preserveTripPhotos(targetTrip: any, sourceTrip: any) {
  if (!targetTrip || !sourceTrip) return targetTrip;
  if (!sourceTrip.souvenirTabs) return targetTrip;

  const sourcePhotos = new Map<string, { imageUrl?: string; images?: string[] }>();
  const sourcePhotosByTitle = new Map<string, { imageUrl?: string; images?: string[] }>();
  for (const tab of sourceTrip.souvenirTabs || []) {
    for (const itm of tab.items || []) {
      if (itm && (itm.imageUrl || (itm.images && itm.images.length > 0))) {
        if (itm.id) {
          sourcePhotos.set(itm.id, { imageUrl: itm.imageUrl, images: itm.images });
        }
        if (itm.title && itm.title.trim()) {
          sourcePhotosByTitle.set(itm.title.trim(), { imageUrl: itm.imageUrl, images: itm.images });
        }
      }
    }
  }

  if (sourcePhotos.size === 0 && sourcePhotosByTitle.size === 0) return targetTrip;

  if (targetTrip.souvenirTabs && Array.isArray(targetTrip.souvenirTabs)) {
    targetTrip.souvenirTabs = targetTrip.souvenirTabs.map((tab: any) => ({
      ...tab,
      items: (tab.items || []).map((itm: any) => {
        const src = (itm.id ? sourcePhotos.get(itm.id) : null) || (itm.title ? sourcePhotosByTitle.get(itm.title.trim()) : null);
        const hasImg = Boolean(itm.imageUrl && itm.imageUrl.trim()) ||
          (itm.images && itm.images.length > 0 && itm.images.some((i: string) => Boolean(i && i.trim())));
        if (!hasImg && src) {
          return {
            ...itm,
            imageUrl: src.imageUrl || (src.images && src.images[0]),
            images: src.images || (src.imageUrl ? [src.imageUrl] : [])
          };
        }
        return itm;
      })
    }));
  }
  return targetTrip;
}

function writeTripsFile(trips: any[], preserveGivenOrder = false) {
  try {
    const deletedSet = new Set(readDeletedTrips());
    const existing = fs.existsSync(TRIPS_FILE) ? JSON.parse(fs.readFileSync(TRIPS_FILE, 'utf-8')) : [];
    const existingMap = new Map((Array.isArray(existing) ? existing : []).map((t: any) => [t.id, t]));

    const valid = Array.isArray(trips)
      ? trips
          .filter((t) => t && t.id && !deletedSet.has(t.id))
          .map((t) => preserveTripPhotos(t, existingMap.get(t.id)))
      : [];

    if (!preserveGivenOrder) {
      const brand = readBrandFile();
      if (brand && Array.isArray(brand.tripOrder) && brand.tripOrder.length > 0) {
        const orderMap = new Map(brand.tripOrder.map((id: string, idx: number) => [id, idx]));
        valid.sort((a, b) => {
          const idxA = orderMap.has(a.id) ? (orderMap.get(a.id) as number) : 9999;
          const idxB = orderMap.has(b.id) ? (orderMap.get(b.id) as number) : 9999;
          return idxA - idxB;
        });
      }
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

app.get('/api/sync/trips', async (_req, res) => {
  if (serverSupabase) {
    try {
      const { data, error } = await serverSupabase
        .from('trips')
        .select('*')
        .order('updated_at', { ascending: false });
      if (!error && Array.isArray(data) && data.length > 0) {
        const deletedSet = new Set(readDeletedTrips());
        const validTrips: any[] = [];
        const existing = readTripsFile();
        const existingMap = new Map((Array.isArray(existing) ? existing : []).map((t: any) => [t.id, t]));

        data.forEach((row: any) => {
          if (row.is_deleted) return;
          if (!deletedSet.has(row.id)) {
            const t = row.data && typeof row.data === 'object' ? row.data : row;
            validTrips.push(preserveTripPhotos(t, existingMap.get(t.id)));
          }
        });
        if (validTrips.length > 0) {
          writeTripsFile(validTrips);
          const currentTrips = readTripsFile();
          return res.json({
            trips: currentTrips,
            updatedAt: currentTrips.reduce((max, t) => Math.max(max, t.updatedAt || 0), 0)
          });
        }
      }
    } catch (e) {
      console.warn('[Server] Supabase trips fetch notice:', e);
    }
  }
  const trips = readTripsFile();
  res.json({
    trips,
    updatedAt: trips.reduce((max, t) => Math.max(max, t.updatedAt || 0), 0)
  });
});

app.get('/api/sync/deleted_trips', (_req, res) => {
  res.json({ deletedTripIds: readDeletedTrips() });
});

// Photo Storage APIs - permanent server-side file hosting
app.post('/api/photos', async (req, res) => {
  try {
    const { photoId, dataUrl } = req.body || {};
    if (!photoId || !dataUrl) {
      return res.status(400).json({ error: 'photoId and dataUrl are required' });
    }
    const cleanId = String(photoId).replace(/^photo:\/\//, '').replace(/[^a-zA-Z0-9_-]/g, '_');
    const localUrl = savePhotoToDisk(cleanId, dataUrl);
    let publicUrl = localUrl;

    if (serverSupabase && typeof dataUrl === 'string' && dataUrl.startsWith('data:image/')) {
      try {
        const matches = dataUrl.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
        if (matches) {
          const buffer = Buffer.from(matches[2], 'base64');
          const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
          const storagePath = `general/${cleanId}.${ext}`;
          const { data: upData, error: upErr } = await serverSupabase.storage
            .from('jplan-photos')
            .upload(storagePath, buffer, { contentType: `image/${matches[1]}`, upsert: true });
          if (!upErr && upData) {
            const { data: pubData } = serverSupabase.storage.from('jplan-photos').getPublicUrl(storagePath);
            if (pubData?.publicUrl) {
              publicUrl = pubData.publicUrl;
            }
          }
        }
      } catch (e) {
        console.warn('Supabase storage upload notice in server:', e);
      }
    }

    res.json({ success: true, photoId: cleanId, url: localUrl, publicUrl });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to save photo' });
  }
});

app.get('/api/photos/:photoId', (req, res) => {
  const cleanId = String(req.params.photoId).replace(/^photo:\/\//, '').replace(/[^a-zA-Z0-9_-]/g, '_');
  const candidates = [
    path.join(PHOTOS_DIR, `${cleanId}.jpg`),
    path.join(PHOTOS_DIR, `${cleanId}.jpeg`),
    path.join(PHOTOS_DIR, `${cleanId}.png`),
    path.join(PHOTOS_DIR, `${cleanId}.webp`),
    path.join(PHOTOS_DIR, cleanId)
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      return res.sendFile(c);
    }
  }
  res.status(404).json({ error: 'Photo not found' });
});

// Direct backup download routes - 100% reliable across all browsers, iframes & mobile
app.post('/api/backup/download', (req, res) => {
  try {
    const filename = req.body?.filename || 'backup.json';
    const content = req.body?.content || '{}';
    const encodedFilename = encodeURIComponent(filename);

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${encodedFilename}"; filename*=UTF-8''${encodedFilename}`);
    res.send(typeof content === 'string' ? content : JSON.stringify(content, null, 2));
  } catch (err: any) {
    res.status(500).send('Download failed: ' + (err?.message || 'Server error'));
  }
});

app.get('/api/backup/all', (_req, res) => {
  try {
    const trips = readTripsFile();
    const brand = readBrandFile();
    const payload = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      trips,
      localStorage: {
        jplanner_trips_cache: trips,
        jplanner_brand_settings_cache: brand || undefined
      },
      jplanner_brand_settings_cache: brand || undefined
    };
    const filename = encodeURIComponent(`J플래너_전체여행_통합백업_${new Date().toISOString().split('T')[0]}.json`);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"; filename*=UTF-8''${filename}`);
    res.send(JSON.stringify(payload, null, 2));
  } catch (err: any) {
    res.status(500).send('Failed to generate full backup');
  }
});

app.get('/api/backup/trip/:tripId', (req, res) => {
  try {
    const trips = readTripsFile();
    const trip = trips.find((t) => t.id === req.params.tripId);
    if (!trip) return res.status(404).send('Trip not found');
    const cleanTitle = (trip.title || '여행').replace(/[/\\?%*:|"<>]/g, '_');
    const filename = encodeURIComponent(`${cleanTitle}_데이터_백업.json`);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"; filename*=UTF-8''${filename}`);
    res.send(JSON.stringify(trip, null, 2));
  } catch (err: any) {
    res.status(500).send('Failed to generate trip backup');
  }
});

app.post('/api/sync/trips', async (req, res) => {
  const incoming = req.body;
  if (!Array.isArray(incoming)) {
    return res.status(400).json({ error: 'Expected an array of trips' });
  }
  const deletedSet = new Set(readDeletedTrips());
  const valid = incoming.filter((t) => t && t.id && !deletedSet.has(t.id));

  // 1. Synchronize brand.tripOrder with the explicit incoming trips order
  const newOrderIds = valid.map((t) => t.id);
  const brand = readBrandFile() || {};
  brand.tripOrder = newOrderIds;
  if (!brand.activeTripId || !newOrderIds.includes(brand.activeTripId)) {
    brand.activeTripId = newOrderIds[0] || '';
  }
  brand.updatedAt = Date.now();
  writeBrandFile(brand);

  // 2. Persist to trips.json preserving this exact incoming order
  writeTripsFile(valid, true);

  if (serverSupabase) {
    for (const t of valid) {
      try {
        await serverSupabase.from('trips').upsert({
          id: t.id,
          title: t.title || '',
          destination: t.destination || '',
          start_date: t.startDate || '',
          end_date: t.endDate || '',
          data: t,
          is_deleted: false,
          updated_at: t.updatedAt || Date.now(),
        }, { onConflict: 'id' });
      } catch {}
    }
  }

  broadcastSSE({ type: 'trips_updated', trips: valid, updatedAt: Date.now() });
  broadcastSSE({ type: 'brand_updated', brand, updatedAt: brand.updatedAt });
  res.json({ success: true, count: valid.length });
});

app.post('/api/sync/trip', async (req, res) => {
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

  if (serverSupabase) {
    try {
      await serverSupabase.from('trips').upsert({
        id: singleTrip.id,
        title: singleTrip.title || '',
        destination: singleTrip.destination || '',
        start_date: singleTrip.startDate || '',
        end_date: singleTrip.endDate || '',
        data: singleTrip,
        is_deleted: false,
        updated_at: singleTrip.updatedAt || Date.now(),
      }, { onConflict: 'id' });
    } catch (sbErr) {
      console.warn('[Server] Supabase upsert error:', sbErr);
    }
  }

  broadcastSSE({ type: 'trips_updated', trips, updatedAt: Date.now() });
  res.json({ success: true, id: singleTrip.id });
});

app.delete('/api/sync/trip/:id', async (req, res) => {
  const tripId = req.params.id;
  const deleted = readDeletedTrips();
  if (!deleted.includes(tripId)) {
    deleted.push(tripId);
    writeDeletedTrips(deleted);
  }
  const trips = readTripsFile().filter((t) => t.id !== tripId);
  writeTripsFile(trips);

  if (serverSupabase) {
    try {
      await serverSupabase.from('trips').update({ is_deleted: true, updated_at: Date.now() }).eq('id', tripId);
    } catch {}
  }

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

  // Synchronize trips.json on disk to reflect brand.tripOrder if provided
  if (Array.isArray(brand.tripOrder) && brand.tripOrder.length > 0) {
    try {
      const trips = readTripsFile();
      fs.writeFileSync(TRIPS_FILE, JSON.stringify(trips, null, 2), 'utf-8');
      broadcastSSE({ type: 'trips_updated', trips, updatedAt: Date.now() });
    } catch (err) {
      console.error('Error syncing trips.json to new brand tripOrder:', err);
    }
  }

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
  const hasDist = fs.existsSync(path.join(__dirname, 'dist', 'index.html'));
  const isDevCommand = process.env.npm_lifecycle_event === 'dev';
  const isProduction = process.env.NODE_ENV === 'production' ||
    process.env.npm_lifecycle_event === 'start' ||
    (hasDist && !isDevCommand);

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
    console.log(`[J-Planner Server] Running on http://0.0.0.0:${PORT} (${isProduction ? 'production' : 'development'})`);
  });
}

startServer();
