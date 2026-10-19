import mongoose from 'mongoose';

/**
 * One ASIN on the ASIN Refine page: the Amazon data scraped via Scrapingdog,
 * the OpenAI-rewritten title/description, and a generated SKU.
 */
const AsinRefineItemSchema = new mongoose.Schema(
  {
    asin: { type: String, required: true, trim: true, uppercase: true },
    region: { type: String, default: 'US' },
    status: {
      type: String,
      enum: ['pending', 'scraped', 'refined', 'error'],
      default: 'pending',
    },
    error: { type: String, default: '' },

    title: { type: String, default: '' },
    description: { type: String, default: '' },
    price: { type: String, default: '' },
    brand: { type: String, default: '' },
    images: { type: [String], default: [] },

    refinedTitle: { type: String, default: '' },
    refinedDescription: { type: String, default: '' },
    material: { type: String, default: '' },
    color: { type: String, default: '' },
    // One comma-separated line, as Etsy's tag field takes it.
    tags: { type: String, default: '' },
    warning: { type: String, default: '' },
    refinedAt: { type: Date, default: null },

    sku: { type: String, required: true, unique: true, trim: true },

    store: { type: mongoose.Schema.Types.ObjectId, ref: 'EtsyStore', default: null, index: true },
    storeName: { type: String, default: '', trim: true },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    createdByName: { type: String, default: '' },
  },
  { timestamps: true }
);

AsinRefineItemSchema.index({ createdAt: -1 });
AsinRefineItemSchema.index({ asin: 1 });
AsinRefineItemSchema.index({ store: 1, asin: 1, region: 1 });

export default mongoose.model('AsinRefineItem', AsinRefineItemSchema);
