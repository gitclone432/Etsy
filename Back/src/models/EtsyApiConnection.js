import mongoose from 'mongoose';

const EtsyApiConnectionSchema = new mongoose.Schema({
  shopId: { type: Number, required: true, unique: true, index: true },
  shopName: { type: String, default: '', trim: true },
  shopUrl: { type: String, default: '', trim: true },
  etsyUserId: { type: Number, default: null, index: true },
  etsyEmail: { type: String, default: '', trim: true },
  currencyCode: { type: String, default: '', trim: true },
  listingActiveCount: { type: Number, default: null },
  store: { type: mongoose.Schema.Types.ObjectId, ref: 'EtsyStore', default: null, index: true },
  accessToken: { type: String, default: '', select: false },
  refreshToken: { type: String, default: '', select: false },
  expiresAt: { type: Date, default: null },
  scopes: { type: [String], default: [] },
  connected: { type: Boolean, default: false, index: true },
  lastRefreshedAt: { type: Date, default: null },
  lastCheckedAt: { type: Date, default: null },
  lastError: { type: String, default: '' },
  connectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

export default mongoose.model('EtsyApiConnection', EtsyApiConnectionSchema);
