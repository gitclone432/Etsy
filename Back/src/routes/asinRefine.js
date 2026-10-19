import { Router } from 'express';
import crypto from 'crypto';
import mongoose from 'mongoose';
import AsinRefineItem from '../models/AsinRefineItem.js';
import EtsyStore from '../models/EtsyStore.js';
import User from '../models/User.js';
import { requireAuth, requirePageAccess } from '../middleware/auth.js';
import { scrapeAmazonProductWithScrapingdog } from '../utils/scrapingdogProduct.js';
import { generateWithGemini } from '../utils/gemini.js';

const router = Router();
const guard = [requireAuth, requirePageAccess('AsinRefine')];

const ASIN_RE = /^[A-Z0-9]{10}$/;
const MAX_ASINS_PER_REQUEST = 25;
const MAX_REFINE_PER_REQUEST = 25;
const REGIONS = new Set(['US', 'UK', 'CA', 'AU']);
// No 0/O/1/I so SKUs can be read back without ambiguity.
const SKU_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const EDITABLE_FIELDS = [
  'title', 'description', 'price', 'brand', 'sku',
  'refinedTitle', 'refinedDescription', 'material', 'color', 'tags', 'warning',
];

const OUTPUT_INSTRUCTIONS = `

Return ONLY a JSON object (no markdown fences, no commentary) with these string keys:
"title": the listing title,
"description": the full listing description with all its sections, headings and bullet points, using \\n for line breaks,
"material": the material,
"color": the color,
"tags": the tags as one comma-separated line,
"warning": the warning / safety text, or "" if none applies.`;

function parseAsins(input) {
  const tokens = Array.isArray(input) ? input : String(input ?? '').split(/[\s,;]+/);
  const seen = new Set();
  const asins = [];
  for (const token of tokens) {
    const asin = String(token ?? '').trim().toUpperCase();
    if (!ASIN_RE.test(asin) || seen.has(asin)) continue;
    seen.add(asin);
    asins.push(asin);
  }
  return asins;
}

function skuPrefixFromStore(store) {
  const fromSubname = String(store?.subname || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (fromSubname) return fromSubname.slice(0, 4);
  const fromName = String(store?.name || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (fromName) return fromName.slice(0, 4);
  const bytes = crypto.randomBytes(4);
  return Array.from(bytes, (b) => SKU_ALPHABET[b % SKU_ALPHABET.length]).join('');
}

async function allocateSku(asin, store, excludeId = null) {
  const prefix = skuPrefixFromStore(store);
  const tail = String(asin || '').slice(-5).toUpperCase();
  const filter = excludeId ? { sku: '', _id: { $ne: excludeId } } : { sku: '' };

  for (let n = 0; n < 20; n += 1) {
    const sku = n === 0 ? `${prefix}-${tail}` : `${prefix}-${tail}-${n + 1}`;
    filter.sku = sku;
    const taken = await AsinRefineItem.exists(filter);
    if (!taken) return sku;
  }
  throw new Error('Could not generate a unique SKU');
}

function galleryImages(scraped) {
  const gallery = scraped?.rawData?.images_of_specified_asin;
  const list = Array.isArray(gallery) && gallery.length > 0 ? gallery : scraped?.images || [];
  return [...new Set(list.filter((url) => typeof url === 'string' && url.trim()))];
}

function scrapeErrorMessage(err) {
  if (err?.message === 'NO_PRICE_FOUND') return 'No price found (item may be unavailable)';
  const status = err?.response?.status;
  if (status === 404 || status === 410) return 'ASIN not found on Amazon';
  if (status === 429) return 'Scrapingdog rate limit — try again shortly';
  return err?.message || 'Scrape failed';
}

async function actorFor(req) {
  const actor = await User.findById(req.user.userId).select('username').lean();
  return { createdBy: req.user.userId, createdByName: actor?.username || '' };
}

router.get('/', ...guard, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const search = String(req.query.search || '').trim();
    const status = String(req.query.status || '').trim();
    const storeId = String(req.query.storeId || '').trim();

    const filter = {};
    if (storeId && storeId !== 'all' && mongoose.isValidObjectId(storeId)) {
      filter.store = storeId;
    }
    if (search) {
      const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ asin: rx }, { sku: rx }, { title: rx }, { refinedTitle: rx }, { brand: rx },
        { material: rx }, { color: rx }, { tags: rx }, { storeName: rx }];
    }
    if (status) filter.status = status;

    const [items, total] = await Promise.all([
      AsinRefineItem.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      AsinRefineItem.countDocuments(filter),
    ]);
    res.json({ items, total, page, limit });
  } catch (err) {
    console.error('[ASIN Refine] list failed:', err);
    res.status(500).json({ error: 'Failed to load items' });
  }
});

// Scrapes up to MAX_ASINS_PER_REQUEST ASINs. Re-pasting an ASIN refreshes its
// scraped data but keeps its SKU and any refined text.
router.post('/scrape', ...guard, async (req, res) => {
  const asins = parseAsins(req.body?.asins);
  const region = REGIONS.has(String(req.body?.region).toUpperCase()) ? String(req.body.region).toUpperCase() : 'US';
  const storeId = String(req.body?.storeId || '').trim();

  if (!mongoose.isValidObjectId(storeId)) {
    return res.status(400).json({ error: 'Select an Etsy store first' });
  }
  if (asins.length === 0) return res.status(400).json({ error: 'No valid ASINs provided' });
  if (asins.length > MAX_ASINS_PER_REQUEST) {
    return res.status(400).json({ error: `Send at most ${MAX_ASINS_PER_REQUEST} ASINs per request` });
  }

  try {
    const store = await EtsyStore.findById(storeId).lean();
    if (!store) return res.status(400).json({ error: 'Etsy store not found' });

    const actor = await actorFor(req);
    const items = await Promise.all(asins.map(async (asin) => {
      let item = await AsinRefineItem.findOne({ asin, region, store: storeId });
      if (!item) {
        item = new AsinRefineItem({
          asin,
          region,
          store: storeId,
          storeName: store.name,
          sku: await allocateSku(asin, store),
          ...actor,
        });
      } else if (item.storeName !== store.name) {
        item.storeName = store.name;
      }

      try {
        const scraped = await scrapeAmazonProductWithScrapingdog(asin, region);
        item.title = scraped.title || '';
        item.description = scraped.description || '';
        item.price = scraped.price ? String(scraped.price) : '';
        item.brand = scraped.detectedBrand || (scraped.brand !== 'Unbranded' ? scraped.brand : '') || '';
        item.images = galleryImages(scraped);
        item.status = item.refinedTitle || item.refinedDescription ? 'refined' : 'scraped';
        item.error = '';
      } catch (err) {
        item.status = 'error';
        item.error = scrapeErrorMessage(err);
      }

      await item.save();
      return item.toObject();
    }));

    res.json({ items });
  } catch (err) {
    console.error('[ASIN Refine] scrape failed:', err);
    res.status(500).json({ error: err.message || 'Scrape failed' });
  }
});

function buildPrompt(template, item) {
  const data = {
    asin: item.asin,
    title: item.title,
    description: item.description,
    brand: item.brand,
    price: item.price,
  };
  const hasPlaceholder = /\{(asin|title|description|brand|price)\}/i.test(template);
  let prompt = template.replace(/\{(asin|title|description|brand|price)\}/gi, (_, key) => data[key.toLowerCase()] || '');

  if (!hasPlaceholder) {
    prompt += `\n\nTitle: ${item.title}\n\nProduct Description:\n${item.description}`;
  }
  return prompt + OUTPUT_INSTRUCTIONS;
}

function asText(value) {
  if (Array.isArray(value)) return value.map((v) => String(v ?? '').trim()).filter(Boolean).join(', ');
  return String(value ?? '').trim();
}

function parseListingOutput(raw) {
  const text = String(raw || '').trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    const json = JSON.parse(text.slice(start, end + 1));
    return {
      refinedTitle: asText(json.title).replace(/^["']|["']$/g, ''),
      refinedDescription: asText(json.description),
      material: asText(json.material),
      color: asText(json.color),
      tags: asText(json.tags).replace(/\s*,\s*/g, ', '),
      warning: asText(json.warning),
    };
  } catch {
    return null;
  }
}

router.post('/refine', ...guard, async (req, res) => {
  const ids = (Array.isArray(req.body?.ids) ? req.body.ids : []).filter((id) => mongoose.isValidObjectId(id));
  const promptTemplate = String(req.body?.prompt || '').trim();

  if (ids.length === 0) return res.status(400).json({ error: 'Select at least one row' });
  if (ids.length > MAX_REFINE_PER_REQUEST) {
    return res.status(400).json({ error: `Refine at most ${MAX_REFINE_PER_REQUEST} rows per request` });
  }
  if (!promptTemplate) return res.status(400).json({ error: 'Enter a prompt first' });

  try {
    const docs = await AsinRefineItem.find({ _id: { $in: ids } });

    const items = await Promise.all(docs.map(async (item) => {
      if (!item.title && !item.description) {
        item.error = 'Nothing to refine — scrape this ASIN first';
        await item.save();
        return item.toObject();
      }
      try {
        const output = await generateWithGemini(buildPrompt(promptTemplate, item), {
          userId: req.user.userId,
          fieldType: 'asin-refine',
          fieldName: 'listing',
          asin: item.asin,
          maxTokens: 6000,
        });
        const parsed = parseListingOutput(output);
        if (parsed) {
          Object.assign(item, parsed);
          item.error = '';
        } else {
          // Keep whatever came back so nothing is lost; the reviewer can split it by hand.
          item.refinedDescription = output.trim();
          item.error = 'OpenAI reply was not in the expected format — full text saved to the description';
        }
        item.refinedAt = new Date();
        item.status = 'refined';
      } catch (err) {
        item.error = err.message || 'OpenAI request failed';
      }
      await item.save();
      return item.toObject();
    }));

    res.json({ items });
  } catch (err) {
    console.error('[ASIN Refine] refine failed:', err);
    res.status(500).json({ error: err.message || 'Refine failed' });
  }
});

router.patch('/:id', ...guard, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });

  const update = {};
  for (const field of EDITABLE_FIELDS) {
    if (req.body?.[field] !== undefined) update[field] = String(req.body[field] ?? '');
  }
  if (update.sku !== undefined) {
    update.sku = update.sku.trim();
    if (!update.sku) return res.status(400).json({ error: 'SKU cannot be empty' });
    const clash = await AsinRefineItem.exists({ sku: update.sku, _id: { $ne: req.params.id } });
    if (clash) return res.status(409).json({ error: 'That SKU is already used by another row' });
  }

  try {
    const item = await AsinRefineItem.findByIdAndUpdate(req.params.id, { $set: update }, { new: true }).lean();
    if (!item) return res.status(404).json({ error: 'Item not found' });
    res.json({ item });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Update failed' });
  }
});

router.post('/:id/regenerate-sku', ...guard, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
  try {
    const item = await AsinRefineItem.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    const store = item.store ? await EtsyStore.findById(item.store).lean() : null;
    item.sku = await allocateSku(item.asin, store, item._id);
    await item.save();
    res.json({ item: item.toObject() });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to regenerate SKU' });
  }
});

router.post('/delete', ...guard, async (req, res) => {
  const ids = (Array.isArray(req.body?.ids) ? req.body.ids : []).filter((id) => mongoose.isValidObjectId(id));
  if (ids.length === 0) return res.status(400).json({ error: 'Select at least one row' });
  try {
    const { deletedCount } = await AsinRefineItem.deleteMany({ _id: { $in: ids } });
    res.json({ deletedCount });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Delete failed' });
  }
});

export default router;
