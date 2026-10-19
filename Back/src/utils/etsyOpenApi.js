import crypto from 'crypto';
import axios from 'axios';
import EtsyApiSettings from '../models/EtsyApiSettings.js';

const settingsCache = {
  keystring: '',
  sharedSecret: '',
  redirectUri: '',
  loaded: false,
};

export const ETSY_AUTH_URL = 'https://www.etsy.com/oauth/connect';
export const ETSY_TOKEN_URL = 'https://api.etsy.com/v3/public/oauth/token';
export const ETSY_API_BASE = 'https://api.etsy.com/v3';

export const DEFAULT_ETSY_SCOPES = [
  'shops_r',
  'shops_w',
  'listings_r',
  'listings_w',
  'transactions_r',
  'transactions_w',
  'profile_r',
  'address_r',
  'email_r',
];

function base64Url(buffer) {
  return Buffer.from(buffer)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

export function createPkcePair() {
  const verifier = base64Url(crypto.randomBytes(32));
  const challenge = base64Url(crypto.createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

export function normalizeEtsyCredential(value) {
  return String(value || '')
    .replace(/^\uFEFF/, '')
    .replace(/^(keystring|shared\s*secret|client[_ ]?(id|secret))\s*[:=]\s*/i, '')
    .replace(/[\s"'`]+/g, '')
    .trim();
}

function envCredentials() {
  return {
    keystring: normalizeEtsyCredential(process.env.ETSY_API_KEYSTRING || process.env.ETSY_CLIENT_ID),
    sharedSecret: normalizeEtsyCredential(process.env.ETSY_API_SHARED_SECRET || process.env.ETSY_CLIENT_SECRET),
    redirectUri: String(process.env.ETSY_OAUTH_REDIRECT_URI || '').trim()
      || 'http://localhost:5000/api/etsy-api/callback',
  };
}

export async function loadEtsyApiSettings() {
  const env = envCredentials();
  try {
    const doc = await EtsyApiSettings.findOne({ settingsKey: 'global' }).select('+sharedSecret').lean();
    settingsCache.keystring = normalizeEtsyCredential(env.keystring || doc?.keystring);
    settingsCache.sharedSecret = normalizeEtsyCredential(env.sharedSecret || doc?.sharedSecret);
    settingsCache.redirectUri = String(env.redirectUri || doc?.redirectUri || '').trim();
  } catch {
    settingsCache.keystring = env.keystring;
    settingsCache.sharedSecret = env.sharedSecret;
    settingsCache.redirectUri = env.redirectUri;
  }
  settingsCache.loaded = true;
  return etsyCredentials();
}

export async function saveEtsyApiSettings({ keystring, sharedSecret, redirectUri }) {
  const current = await EtsyApiSettings.findOne({ settingsKey: 'global' }).select('+sharedSecret');
  const next = {
    keystring: normalizeEtsyCredential(keystring ?? current?.keystring),
    sharedSecret: normalizeEtsyCredential(sharedSecret || current?.sharedSecret),
    redirectUri: String(redirectUri ?? current?.redirectUri ?? envCredentials().redirectUri).trim(),
  };
  await EtsyApiSettings.findOneAndUpdate(
    { settingsKey: 'global' },
    { $set: next },
    { upsert: true, new: true }
  );
  settingsCache.keystring = next.keystring;
  settingsCache.sharedSecret = next.sharedSecret;
  settingsCache.redirectUri = next.redirectUri || envCredentials().redirectUri;
  settingsCache.loaded = true;
  return etsyCredentials();
}

export function etsyCredentials() {
  if (!settingsCache.loaded) {
    const env = envCredentials();
    settingsCache.keystring = env.keystring;
    settingsCache.sharedSecret = env.sharedSecret;
    settingsCache.redirectUri = env.redirectUri;
  }
  const scopesRaw = String(process.env.ETSY_OAUTH_SCOPES || '').trim();
  const scopes = scopesRaw
    ? scopesRaw.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean)
    : DEFAULT_ETSY_SCOPES;
  return {
    keystring: settingsCache.keystring,
    sharedSecret: settingsCache.sharedSecret,
    redirectUri: settingsCache.redirectUri || envCredentials().redirectUri,
    scopes,
  };
}

function maskSecret(value) {
  const text = String(value || '');
  if (!text) return '';
  if (text.length <= 8) return `${text.slice(0, 2)}…${text.slice(-2)}`;
  return `${text.slice(0, 4)}…${text.slice(-4)}`;
}

export function etsyConfigStatus() {
  const { keystring, sharedSecret, redirectUri, scopes } = etsyCredentials();
  return {
    configured: Boolean(keystring && sharedSecret && redirectUri),
    redirectUri,
    scopes,
    keystringMasked: maskSecret(keystring),
    hasSecret: Boolean(sharedSecret),
    missing: {
      ETSY_API_KEYSTRING: !keystring,
      ETSY_API_SHARED_SECRET: !sharedSecret,
      ETSY_OAUTH_REDIRECT_URI: !redirectUri,
    },
  };
}

export function buildEtsyAuthorizeUrl({ state, challenge }) {
  const { keystring, redirectUri, scopes } = etsyCredentials();
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: keystring,
    redirect_uri: redirectUri,
    scope: scopes.join(' '),
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });
  return `${ETSY_AUTH_URL}?${params.toString()}`;
}

function etsyApiKeyHeader() {
  const { keystring, sharedSecret } = etsyCredentials();
  if (!keystring || !sharedSecret) {
    throw Object.assign(new Error('Both keystring and shared secret are required in x-api-key as keystring:secret'), { status: 400 });
  }
  return `${keystring}:${sharedSecret}`;
}

export async function pingEtsyApi() {
  const headers = {
    'x-api-key': etsyApiKeyHeader(),
    Accept: 'application/json',
  };
  const urls = [
    `${ETSY_API_BASE}/application/openapi-ping`,
    'https://openapi.etsy.com/v3/application/openapi-ping',
  ];
  let lastError = null;
  for (const url of urls) {
    try {
      const { data } = await axios.get(url, { headers, timeout: 15000 });
      return data;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

function etsyTokenHeaders() {
  return {
    'Content-Type': 'application/x-www-form-urlencoded',
    Accept: 'application/json',
    'x-api-key': etsyApiKeyHeader(),
  };
}

export async function exchangeEtsyAuthCode({ code, codeVerifier }) {
  const { keystring, redirectUri } = etsyCredentials();
  const { data } = await axios.post(
    ETSY_TOKEN_URL,
    new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: keystring,
      redirect_uri: redirectUri,
      code,
      code_verifier: codeVerifier,
    }).toString(),
    { headers: etsyTokenHeaders(), timeout: 20000 }
  );
  return data;
}

export async function refreshEtsyAccessToken(refreshToken) {
  const { keystring } = etsyCredentials();
  const { data } = await axios.post(
    ETSY_TOKEN_URL,
    new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: keystring,
      refresh_token: refreshToken,
    }).toString(),
    { headers: etsyTokenHeaders(), timeout: 20000 }
  );
  return data;
}

export function etsyApiHeaders(accessToken) {
  const headers = {
    'x-api-key': etsyApiKeyHeader(),
    Accept: 'application/json',
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return headers;
}

export async function etsyGet(path, accessToken, params) {
  const { data } = await axios.get(`${ETSY_API_BASE}${path}`, {
    headers: etsyApiHeaders(accessToken),
    params,
    timeout: 20000,
  });
  return data;
}

export function normalizeEtsyShop(payload) {
  if (!payload) return null;
  if (payload.shop_id) return payload;
  if (Array.isArray(payload.results) && payload.results[0]) return payload.results[0];
  if (Array.isArray(payload) && payload[0]) return payload[0];
  return null;
}

export async function fetchEtsyUserAndShop(accessToken) {
  const tokenUserId = String(accessToken || '').split('.')[0];
  let user = null;
  if (tokenUserId) {
    try {
      user = await etsyGet(`/application/users/${tokenUserId}`, accessToken);
    } catch {
      user = null;
    }
  }
  if (!user) {
    try {
      user = await etsyGet('/application/users/me', accessToken);
    } catch {
      user = null;
    }
  }
  const userId = user?.user_id || tokenUserId;
  let shop = null;
  if (userId) {
    try {
      shop = normalizeEtsyShop(await etsyGet(`/application/users/${userId}/shops`, accessToken));
    } catch {
      shop = null;
    }
  }
  if (!shop && userId) {
    try {
      shop = normalizeEtsyShop(await etsyGet('/application/shops', accessToken, { user_id: userId }));
    } catch {
      shop = null;
    }
  }
  return { user, shop };
}

export function tokensFromEtsyResponse(tokenRes) {
  const expiresIn = Number(tokenRes?.expires_in || 3600);
  return {
    accessToken: String(tokenRes?.access_token || ''),
    refreshToken: String(tokenRes?.refresh_token || ''),
    expiresAt: new Date(Date.now() + Math.max(expiresIn - 60, 60) * 1000),
    scopes: String(tokenRes?.scope || '')
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean),
  };
}
