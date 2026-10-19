import mongoose from 'mongoose';

const EtsyStoreSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, unique: true },
  subname: { type: String, default: '', trim: true },
}, { timestamps: true });

export default mongoose.model('EtsyStore', EtsyStoreSchema);
