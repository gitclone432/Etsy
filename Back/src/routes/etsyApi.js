import { Router } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { requireAuth, requirePageAccess } from '../middleware/auth.js';
import EtsyApiConnection from '../models/EtsyApiConnection.js';
import EtsyOauthState from '../models/EtsyOauthState.js';
import EtsyStore from '../models/EtsyStore.js';
import {
  buildEtsyAuthorizeUrl,
  createPkcePair,
  etsyConfigStatus,
  etsyCredentials,
  etsyGet,
  exchangeEtsyAuthCode,
  fetchEtsyUserAndShop,
  loadEtsyApiSettings,
  normalizeEtsyCredential,
  pingEtsyApi,
  refreshEtsyAccessToken,
  saveEtsyApiSettings,
  tokensFromEtsyResponse,
} from '../utils/etsyOpenApi.js';

const router = Router();
const pageAuth = [requireAuth, requirePageAccess('EtsyApiConnect')];
const TOKEN_FIELDS = '+accessToken +refreshToken';

function clientOrigin() {
  const raw = String(process.env.CLIENT_ORIGIN || '').split(',')[0].trim();
  if (raw) return raw.replace(/\/$/, '');
  return 'http://localhost:5173';
}

function frontPageUrl() {
  return `${clientOrigin()}/admin/etsy/connect-stores`;
}

function oauthErrorMessage(err) {
  return err.response?.data?.error_description
    || err.response?.data?.error
    || err.message
    || 'Etsy API request failed';
}

function serializeConnection(doc) {
  const store = doc.store && typeof doc.store === 'object' && doc.store.name
    ? { id: String(doc.store._id), name: doc.store.name, subname: doc.store.subname || '' }
    : doc.store
      ? { id: String(doc.store), name: '', subname: '' }
      : null;
  return {
    id: String(doc._id),
    shopId: doc.shopId,
    shopName: doc.shopName || '',
    shopUrl: doc.shopUrl || '',
    etsyUserId: doc.etsyUserId || null,
    etsyEmail: doc.etsyEmail || '',
    currencyCode: doc.currencyCode || '',
    listingActiveCount: doc.listingActiveCount ?? null,
    store,
    connected: Boolean(doc.connected),
    expiresAt: doc.expiresAt || null,
    scopes: doc.scopes || [],
    lastRefreshedAt: doc.lastRefreshedAt || null,
    lastCheckedAt: doc.lastCheckedAt || null,
    lastError: doc.lastError || '',
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

async function findOrCreateLocalStore(shopName, preferredStoreId) {
  if (preferredStoreId && mongoose.isValidObjectId(preferredStoreId)) {
    const preferred = await EtsyStore.findById(preferredStoreId);
    if (preferred) return preferred;
  }
  const name = String(shopName || '').replace(/\s+/g, ' ').trim();
  if (!name) return null;
  const existing = await EtsyStore.findOne({ name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });
  if (existing) return existing;
  try {
    return await EtsyStore.create({
      name,
      subname: name.replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase(),
    });
  } catch (err) {
    if (err.code === 11000) {
      return EtsyStore.findOne({ name });
    }
    throw err;
  }
}

async function applyTokens(connection, tokenRes) {
  const tokens = tokensFromEtsyResponse(tokenRes);
  if (!tokens.accessToken) throw new Error('Etsy did not return an access token');
  connection.accessToken = tokens.accessToken;
  if (tokens.refreshToken) connection.refreshToken = tokens.refreshToken;
  connection.expiresAt = tokens.expiresAt;
  if (tokens.scopes.length) connection.scopes = tokens.scopes;
  connection.connected = true;
  connection.lastRefreshedAt = new Date();
  connection.lastError = '';
  return tokens;
}

async function getFreshAccessToken(connection) {
  const now = Date.now();
  const expiresAt = connection.expiresAt ? new Date(connection.expiresAt).getTime() : 0;
  if (connection.accessToken && expiresAt && now < expiresAt - 2 * 60 * 1000) {
    return connection.accessToken;
  }
  if (!connection.refreshToken) {
    throw Object.assign(new Error('This shop has no refresh token. Connect it again.'), { status: 401 });
  }
  const tokenRes = await refreshEtsyAccessToken(connection.refreshToken);
  await applyTokens(connection, tokenRes);
  await connection.save();
  return connection.accessToken;
}

router.get('/status', ...pageAuth, async (_req, res) => {
  await loadEtsyApiSettings();
  const oauth = etsyConfigStatus();
  if (!oauth.configured) {
    return res.json({ oauth, ping: { ok: false, error: 'API keys are not set' } });
  }
  try {
    const ping = await pingEtsyApi();
    return res.json({
      oauth,
      ping: {
        ok: true,
        applicationId: ping?.application_id || null,
      },
    });
  } catch (err) {
    return res.json({
      oauth,
      ping: {
        ok: false,
        error: err.response?.data?.error || err.message || 'Etsy ping failed',
      },
    });
  }
});

async function saveEtsySettingsHandler(req, res) {
  const keystring = normalizeEtsyCredential(req.body?.keystring);
  const sharedSecret = normalizeEtsyCredential(req.body?.sharedSecret);
  const redirectUri = String(req.body?.redirectUri || '').trim();
  if (!keystring || !sharedSecret) {
    return res.status(400).json({ error: 'Paste both the keystring and the shared secret. Etsy requires x-api-key as keystring:secret.' });
  }
  try {
    await saveEtsyApiSettings({
      keystring,
      sharedSecret,
      redirectUri: redirectUri || undefined,
    });
    const oauth = etsyConfigStatus();
    try {
      const ping = await pingEtsyApi();
      return res.json({
        oauth,
        ping: { ok: true, applicationId: ping?.application_id || null },
      });
    } catch (err) {
      return res.json({
        oauth,
        ping: {
          ok: false,
          error: err.response?.data?.error || err.message || 'Etsy ping failed',
        },
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to save Etsy API settings' });
  }
}

router.put('/settings', ...pageAuth, saveEtsySettingsHandler);
router.post('/settings', ...pageAuth, saveEtsySettingsHandler);

router.get('/connections', ...pageAuth, async (_req, res) => {
  try {
    const rows = await EtsyApiConnection.find({})
      .select('+refreshToken')
      .populate('store', 'name subname')
      .sort({ shopName: 1 })
      .lean();
    res.json({
      connections: rows.map((row) => ({
        ...serializeConnection(row),
        connected: Boolean(row.connected && row.refreshToken),
      })),
    });
  } catch (err) {
    console.error('[Etsy API] list failed:', err.message);
    res.status(500).json({ error: 'Failed to load connected Etsy stores' });
  }
});

router.get('/connect', async (req, res) => {
  const { token, storeId } = req.query;
  if (!token) return res.status(400).send('Missing authentication token');

  let userId = null;
  try {
    const decoded = jwt.verify(String(token), process.env.JWT_SECRET);
    userId = decoded.userId || decoded.id || null;
  } catch {
    return res.status(401).send('Invalid authentication token');
  }

  const { keystring, redirectUri } = etsyCredentials();
  if (!keystring || !redirectUri) {
    return res.status(500).json({
      error: 'Etsy API is not configured',
      missing: etsyConfigStatus().missing,
    });
  }

  const { verifier, challenge } = createPkcePair();
  const state = crypto.randomBytes(24).toString('hex');
  await EtsyOauthState.create({
    state,
    codeVerifier: verifier,
    userId,
    storeId: storeId && mongoose.isValidObjectId(storeId) ? storeId : null,
  });

  res.redirect(buildEtsyAuthorizeUrl({ state, challenge }));
});

router.get('/callback', async (req, res) => {
  const front = frontPageUrl();
  const { code, state, error, error_description: errorDescription } = req.query;
  try {
    if (error) throw new Error(errorDescription || error);
    if (!code) throw new Error('Etsy did not return an authorization code');
    if (!state) throw new Error('Missing OAuth state');

    const oauthState = await EtsyOauthState.findOne({ state: String(state) });
    if (!oauthState) throw new Error('OAuth state expired. Click Connect Store and try again.');

    const tokenRes = await exchangeEtsyAuthCode({
      code: String(code),
      codeVerifier: oauthState.codeVerifier,
    });
    const tokens = tokensFromEtsyResponse(tokenRes);
    if (!tokens.accessToken) throw new Error('Etsy did not return an access token');

    const { user, shop } = await fetchEtsyUserAndShop(tokens.accessToken);
    const shopId = Number(shop?.shop_id);
    if (!shopId) throw new Error('Could not load the Etsy shop for this account');

    const localStore = await findOrCreateLocalStore(shop.shop_name, oauthState.storeId);

    const connection = await EtsyApiConnection.findOne({ shopId }).select(TOKEN_FIELDS)
      || new EtsyApiConnection({ shopId });

    connection.shopName = shop.shop_name || connection.shopName || '';
    connection.shopUrl = shop.url || connection.shopUrl || '';
    connection.etsyUserId = Number(user?.user_id || shop.user_id || 0) || connection.etsyUserId;
    connection.etsyEmail = user?.primary_email || connection.etsyEmail || '';
    connection.currencyCode = shop.currency_code || connection.currencyCode || '';
    connection.listingActiveCount = shop.listing_active_count ?? connection.listingActiveCount;
    if (localStore) connection.store = localStore._id;
    if (oauthState.userId) connection.connectedBy = oauthState.userId;
    await applyTokens(connection, tokenRes);
    await connection.save();
    await EtsyOauthState.deleteOne({ _id: oauthState._id });

    return res.redirect(`${front}?connected=${encodeURIComponent(connection.shopName || shopId)}`);
  } catch (err) {
    console.error('[Etsy API] OAuth callback failed:', oauthErrorMessage(err));
    return res.redirect(`${front}?etsyConnectError=${encodeURIComponent(oauthErrorMessage(err))}`);
  }
});

router.post('/connections/:id/refresh', ...pageAuth, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: 'Invalid connection id' });
  }
  try {
    const connection = await EtsyApiConnection.findById(req.params.id).select(TOKEN_FIELDS);
    if (!connection) return res.status(404).json({ error: 'Connection not found' });
    await getFreshAccessToken(connection);
    const populated = await connection.populate('store', 'name subname');
    res.json({ connection: serializeConnection(populated) });
  } catch (err) {
    const message = oauthErrorMessage(err);
    await EtsyApiConnection.updateOne({ _id: req.params.id }, { $set: { lastError: message } });
    res.status(err.status || 500).json({ error: message });
  }
});

router.post('/connections/:id/ping', ...pageAuth, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: 'Invalid connection id' });
  }
  try {
    const connection = await EtsyApiConnection.findById(req.params.id).select(TOKEN_FIELDS);
    if (!connection) return res.status(404).json({ error: 'Connection not found' });
    const accessToken = await getFreshAccessToken(connection);
    const shop = await etsyGet(`/application/shops/${connection.shopId}`, accessToken);
    connection.shopName = shop.shop_name || connection.shopName;
    connection.shopUrl = shop.url || connection.shopUrl;
    connection.currencyCode = shop.currency_code || connection.currencyCode;
    connection.listingActiveCount = shop.listing_active_count ?? connection.listingActiveCount;
    connection.lastCheckedAt = new Date();
    connection.lastError = '';
    await connection.save();
    const populated = await connection.populate('store', 'name subname');
    res.json({
      connection: serializeConnection(populated),
      shop: {
        shopId: shop.shop_id,
        shopName: shop.shop_name,
        url: shop.url,
        currencyCode: shop.currency_code,
        listingActiveCount: shop.listing_active_count,
      },
    });
  } catch (err) {
    const message = oauthErrorMessage(err);
    await EtsyApiConnection.updateOne({ _id: req.params.id }, { $set: { lastError: message, lastCheckedAt: new Date() } });
    res.status(err.status || 500).json({ error: message });
  }
});

router.post('/connections/:id/link-store', ...pageAuth, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: 'Invalid connection id' });
  }
  const storeId = req.body?.storeId;
  if (storeId && !mongoose.isValidObjectId(storeId)) {
    return res.status(400).json({ error: 'Invalid store id' });
  }
  try {
    const connection = await EtsyApiConnection.findById(req.params.id);
    if (!connection) return res.status(404).json({ error: 'Connection not found' });
    if (storeId) {
      const store = await EtsyStore.findById(storeId);
      if (!store) return res.status(404).json({ error: 'Local store not found' });
      connection.store = store._id;
    } else {
      connection.store = null;
    }
    await connection.save();
    const populated = await connection.populate('store', 'name subname');
    res.json({ connection: serializeConnection(populated) });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to link store' });
  }
});

router.post('/connections/:id/disconnect', ...pageAuth, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: 'Invalid connection id' });
  }
  try {
    const connection = await EtsyApiConnection.findById(req.params.id).select(TOKEN_FIELDS);
    if (!connection) return res.status(404).json({ error: 'Connection not found' });
    connection.accessToken = '';
    connection.refreshToken = '';
    connection.connected = false;
    connection.lastError = '';
    await connection.save();
    const populated = await connection.populate('store', 'name subname');
    res.json({ connection: serializeConnection(populated) });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to disconnect store' });
  }
});

router.delete('/connections/:id', ...pageAuth, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: 'Invalid connection id' });
  }
  try {
    const connection = await EtsyApiConnection.findByIdAndDelete(req.params.id).lean();
    if (!connection) return res.status(404).json({ error: 'Connection not found' });
    res.json({ deleted: true, id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to delete connection' });
  }
});

export default router;
