import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import mongoSanitize from 'express-mongo-sanitize';
import { setServers } from 'dns';
// Set DNS to use Google's DNS servers to resolve MongoDB Atlas
setServers(['8.8.8.8', '8.8.4.4']);

// Load environment variables FIRST before any other imports
dotenv.config();
// Load Back/.env regardless of current working directory (e.g. repo root vs Back/)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.join(__dirname, '..');
// override: true — Windows user env had an old SCRAPER_API_KEY that blocked Back/.env
dotenv.config({ path: path.join(serverRoot, '.env'), override: true });

const scraperProvider = String(process.env.SCRAPER_PROVIDER || 'scraperapi').trim().toLowerCase();
const scraperKeyRaw = String(process.env.SCRAPER_API_KEY || '').trim();
const scraperKeyLen = scraperKeyRaw.length;
const scraperKeyHint = scraperKeyLen >= 8
  ? `${scraperKeyRaw.slice(0, 4)}…${scraperKeyRaw.slice(-4)}`
  : '(missing or too short)';
const gmailUser = String(process.env.GMAIL_IMAP_USER || '').trim();
const gmailPassLen = String(process.env.GMAIL_IMAP_APP_PASSWORD || '').trim().length;
console.log(
  `[env] Loaded ${path.join(serverRoot, '.env')} | scraper=${scraperProvider} keyLen=${scraperKeyLen} key=${scraperKeyHint} | gmail=${gmailUser && gmailPassLen ? 'configured' : 'missing'}`
);

import { connectToDatabase } from './lib/db.js';
import User from './models/User.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import amazonAccountRoutes from './routes/amazonAccounts.js';
import { loadEtsyApiSettings } from './utils/etsyOpenApi.js';
import etsyOrderFulfilmentRoutes from './routes/etsyOrderFulfilment.js';
import etsyProfitSheetRoutes from './routes/etsyProfitSheet.js';
import etsyTrackingRoutes from './routes/etsyTracking.js';
import etsyProductsRoutes from './routes/etsyProducts.js';
import etsyStoresRoutes from './routes/etsyStores.js';
import etsyDailyOrdersRoutes from './routes/etsyDailyOrders.js';
import asinRefineRoutes from './routes/asinRefine.js';
import etsyApiRoutes from './routes/etsyApi.js';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './swagger.js';
import http from 'http';
import { initSocket } from './lib/socket.js';

const localEtsyOnly = String(process.env.RUNNER_ID || 'local').trim().toLowerCase() === 'local';

const app = express();

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      // Allow item images from eBay/Amazon/etc. (and any https host) — the default
      // 'self' data: img-src blocks all external product/order images in the UI.
      imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
    },
  },
}));
app.use(compression({
  filter: (req, res) => {
    // Gzip buffers the whole response, which blocks EventSource item-by-item updates
    // and leaves Review Generated Listings stuck on "loading".
    const accept = String(req.headers.accept || '');
    const contentType = String(res.getHeader('Content-Type') || '');
    if (accept.includes('text/event-stream') || contentType.includes('text/event-stream')) {
      return false;
    }
    return compression.filter(req, res);
  },
}));
// CORS: allowed origins are driven by CLIENT_ORIGIN env var (comma-separated) + localhost defaults
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
  ...((process.env.CLIENT_ORIGIN || '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean)),
];
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS: origin '${origin}' not allowed`));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Disposition']
}));
app.use(express.json({ limit: '10mb' })); // Increased limit for bulk operations
app.use(mongoSanitize()); // Sanitize user input to prevent NoSQL injection (strips $ and . from req.body/query/params)
app.use(morgan('dev'));

// Serve static uploads — browser-cacheable for 1 day (ETag enables conditional revalidation)
app.use('/uploads', express.static(path.join(process.cwd(), 'public/uploads'), {
  maxAge: '1d',
  etag: true,
  lastModified: true,
}));

// Disable caching globally for all API routes
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

// API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'Grow – Buyer Chat API Docs',
  swaggerOptions: { persistAuthorization: true }
}));
app.get('/api-docs.json', (req, res) => res.json(swaggerSpec));;



app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/amazon-accounts', amazonAccountRoutes);
app.use('/api/etsy/order-fulfilment', etsyOrderFulfilmentRoutes);
app.use('/api/etsy/profit-sheet', etsyProfitSheetRoutes);
app.use('/api/etsy/tracking', etsyTrackingRoutes);
app.use('/api/etsy/products', etsyProductsRoutes);
app.use('/api/etsy/stores', etsyStoresRoutes);
app.use('/api/etsy/asin-refine', asinRefineRoutes);
app.use('/api/etsy-api', etsyApiRoutes);
app.use('/api/etsy', etsyDailyOrdersRoutes);

if (!localEtsyOnly) {
  const { mountFullRoutes } = await import('./mountFullRoutes.js');
  mountFullRoutes(app);
} else {
  console.log('[boot] Local Etsy mode: eBay, Amazon, finance, and HR routes are not loaded');
}

// Optional: same-origin production — serve Vite build (see Dockerfile / deployment-plan.md)
if (process.env.SERVE_FRONTEND === 'true') {
  const frontDist = path.resolve(process.cwd(), (process.env.FRONTEND_DIST_PATH || 'public/app').trim());
  if (fs.existsSync(path.join(frontDist, 'index.html'))) {
    console.log(`[static] Serving SPA from ${frontDist}`);
    app.use(express.static(frontDist, { index: false }));
    app.get('*', (req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      if (req.path.startsWith('/api')) return next();
      if (req.path.startsWith('/uploads')) return next();
      if (req.path === '/health' || req.path.startsWith('/api-docs')) return next();
      res.sendFile(path.join(frontDist, 'index.html'), (err) => (err ? next(err) : undefined));
    });
  } else {
    console.warn(`[static] SERVE_FRONTEND=true but no index.html at ${frontDist} — skipping SPA mount`);
  }
}

// ── Global error handler ─────────────────────────────────────────────────────
// Must be registered AFTER all routes. Catches any error passed via next(err)
// or thrown inside an asyncHandler-wrapped route.
app.use((err, req, res, _next) => {
  // CORS errors surfaced from the cors() middleware
  if (err.message?.startsWith('CORS:')) {
    return res.status(403).json({ error: err.message });
  }
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal server error';
  if (status >= 500) {
    console.error(`[${req.method}] ${req.path}`, err);
  }
  return res.status(status).json({ error: message });
});

const port = process.env.PORT || 5000;

connectToDatabase()
  .then(async () => {
    // Ensure email index is sparse unique to allow multiple nulls
    try {
      // Drop existing non-sparse unique index if present
      await User.collection.dropIndex('email_1');
    } catch (e) {
      // Ignore if index does not exist
    }
    try {
      await User.collection.createIndex({ email: 1 }, { unique: true, sparse: true });
    } catch (e) {
      console.error('Failed to create sparse unique index on email:', e?.message || e);
    }

    await loadEtsyApiSettings();

    if (!localEtsyOnly) {
      const { startFullBackgroundWork } = await import('./mountFullRoutes.js');
      await startFullBackgroundWork();
    } else {
      console.log('[CRON] Local runner: scheduled jobs are not started');
    }

    const server = http.createServer(app);
    initSocket(server, ALLOWED_ORIGINS);

    server.listen(port, () => {
      console.log(`API listening on :${port} (Socket.IO attached)`);
    });
  })
  .catch((err) => {
    console.error('Failed to start server', err);
    process.exit(1);
  });
