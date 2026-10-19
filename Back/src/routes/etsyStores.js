import { Router } from 'express';
import mongoose from 'mongoose';
import { requireAuth, requirePageAccess } from '../middleware/auth.js';
import EtsyStore from '../models/EtsyStore.js';
import EtsyOrderFulfilment from '../models/EtsyOrderFulfilment.js';
import EtsyProfitSheet from '../models/EtsyProfitSheet.js';
import EtsyProduct from '../models/EtsyProduct.js';
import EtsyDailyOrder from '../models/EtsyDailyOrder.js';
import AsinRefineItem from '../models/AsinRefineItem.js';
import EtsyApiConnection from '../models/EtsyApiConnection.js';

const router = Router();
const LIST_PAGES = [
  'EtsyStoresPage',
  'EtsyOrderFulfilment',
  'EtsyProfitSheet',
  'EtsyTracking',
  'EtsyProducts',
  'EtsyDailyOrders',
  'AsinRefine',
  'EtsyApiConnect',
];

function normalizeName(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

async function relatedCounts(storeId) {
  const [fulfilment, profitSheet, products, dailyOrders, asinRefine] = await Promise.all([
    EtsyOrderFulfilment.countDocuments({ store: storeId }),
    EtsyProfitSheet.countDocuments({ store: storeId }),
    EtsyProduct.countDocuments({ store: storeId }),
    EtsyDailyOrder.countDocuments({ storeId }),
    AsinRefineItem.countDocuments({ store: storeId }),
  ]);
  return { fulfilment, profitSheet, products, dailyOrders, asinRefine };
}

// GET /api/etsy/stores
router.get('/', requireAuth, requirePageAccess(LIST_PAGES), async (req, res) => {
  try {
    const stores = await EtsyStore.find({}).sort({ name: 1 }).lean();
    res.json({ stores });
  } catch (err) {
    console.error('[Etsy Stores] list failed:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/etsy/stores
router.post('/', requireAuth, requirePageAccess('EtsyStoresPage'), async (req, res) => {
  try {
    const name = normalizeName(req.body.name);
    if (!name) {
      return res.status(400).json({ error: 'Store name is required' });
    }

    const existing = await EtsyStore.findOne({ name }).lean();
    if (existing) {
      return res.json({ store: existing, created: false });
    }

    const store = await EtsyStore.create({ name, subname: normalizeName(req.body.subname) });
    res.status(201).json({ store: store.toObject(), created: true });
  } catch (err) {
    if (err.code === 11000) {
      const store = await EtsyStore.findOne({ name: normalizeName(req.body.name) }).lean();
      return res.json({ store, created: false });
    }
    console.error('[Etsy Stores] create failed:', err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/etsy/stores/:id
router.patch('/:id', requireAuth, requirePageAccess('EtsyStoresPage'), async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: 'Invalid store id' });
  }

  const hasName = req.body.name !== undefined;
  const hasSubname = req.body.subname !== undefined;
  const name = hasName ? normalizeName(req.body.name) : '';
  const subname = hasSubname ? normalizeName(req.body.subname) : '';

  if (hasName && !name) {
    return res.status(400).json({ error: 'Store name is required' });
  }
  if (!hasName && !hasSubname) {
    return res.status(400).json({ error: 'Nothing to update' });
  }

  try {
    const update = {};
    if (hasName) {
      const clash = await EtsyStore.findOne({ name, _id: { $ne: req.params.id } }).lean();
      if (clash) {
        return res.status(409).json({ error: `A store named "${name}" already exists` });
      }
      update.name = name;
    }
    if (hasSubname) update.subname = subname;

    const store = await EtsyStore.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { new: true }
    ).lean();
    if (!store) return res.status(404).json({ error: 'Store not found' });

    if (hasName) {
      await AsinRefineItem.updateMany({ store: store._id }, { $set: { storeName: name } });
    }
    res.json({ store });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: `A store named "${name}" already exists` });
    }
    console.error('[Etsy Stores] rename failed:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/etsy/stores/:id
router.delete('/:id', requireAuth, requirePageAccess('EtsyStoresPage'), async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: 'Invalid store id' });
  }

  try {
    const store = await EtsyStore.findById(req.params.id).lean();
    if (!store) return res.status(404).json({ error: 'Store not found' });

    const counts = await relatedCounts(store._id);
    await Promise.all([
      EtsyOrderFulfilment.updateMany({ store: store._id }, { $set: { store: null } }),
      EtsyProfitSheet.updateMany({ store: store._id }, { $set: { store: null } }),
      EtsyProduct.updateMany({ store: store._id }, { $set: { store: null } }),
      AsinRefineItem.updateMany({ store: store._id }, { $set: { store: null } }),
      EtsyApiConnection.updateMany({ store: store._id }, { $set: { store: null } }),
      EtsyDailyOrder.deleteMany({ storeId: store._id }),
    ]);
    await EtsyStore.deleteOne({ _id: store._id });

    res.json({ deleted: true, store, counts });
  } catch (err) {
    console.error('[Etsy Stores] delete failed:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
