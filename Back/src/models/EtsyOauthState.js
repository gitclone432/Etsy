import mongoose from 'mongoose';

const EtsyOauthStateSchema = new mongoose.Schema({
  state: { type: String, required: true, unique: true, index: true },
  codeVerifier: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'EtsyStore', default: null },
  createdAt: { type: Date, default: Date.now, expires: 600 },
});

export default mongoose.model('EtsyOauthState', EtsyOauthStateSchema);
