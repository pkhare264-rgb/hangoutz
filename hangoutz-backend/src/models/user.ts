import mongoose, { Schema, Document } from "mongoose";

// 1. Define the Interface (For TypeScript)
export interface IUser extends Document {
  firebaseUid: string;
  phone: string;
  name?: string;
  bio?: string;
  gender?: string;
  dob?: string;
  photos?: string[];
  interests?: string[];
  verified: boolean;
  trustScore: number;
  blockedUserIds: string[];
  role: string;
  createdAt: Date;
}

// 2. Define the Schema (For MongoDB)
const UserSchema: Schema = new Schema({
  // SECURITY: Critical for linking Firebase Auth to MongoDB
  firebaseUid: { type: String, required: true, unique: true, index: true },
  
  // IDENTITY
  phone: { type: String, required: true, unique: true },
  name: { type: String },
  role: { type: String, default: "user" },
  
  // PROFILE DATA (Matches your Frontend App.tsx)
  bio: { type: String },
  gender: { type: String },
  dob: { type: String },
  photos: { type: [String], default: [] },     // Array of image URLs
  interests: { type: [String], default: [] },  // Array of strings
  
  // SYSTEM / TRUST
  verified: { type: Boolean, default: false }, // Matches 'user.verified' in frontend
  trustScore: { type: Number, default: 50 },
  blockedUserIds: { type: [String], default: [] },
}, {
  timestamps: true // Adds createdAt and updatedAt automatically
});

export default mongoose.model<IUser>("User", UserSchema);