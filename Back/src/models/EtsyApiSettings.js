import mongoose from 'mongoose';

const EtsyApiSettingsSchema = new mongoose.Schema({
  settingsKey: { type: String, default: 'global', unique: true },
  keystring: { type: String, default: '', trim: true },
  sharedSecret: { type: String, default: '', trim: true, select: false },
  redirectUri: { type: String, default: '', trim: true },
}, { timestamps: true });

export default mongoose.model('EtsyApiSettings', EtsyApiSettingsSchema);
