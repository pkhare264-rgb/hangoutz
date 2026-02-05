import mongoose, { Schema, Document } from "mongoose";

export interface IEvent extends Document {
  title: string;
  description: string;
  location: string;
  coordinates?: { lat: number; lng: number };
  dateTime: Date;
  category: string;
  imageURL: string;
  host: mongoose.Types.ObjectId; // Reference to User model
  participants: mongoose.Types.ObjectId[]; // Array of User IDs
  createdAt: Date;
}

const EventSchema: Schema = new Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  location: { type: String, required: true },
  coordinates: {
    lat: { type: Number },
    lng: { type: Number }
  },
  dateTime: { type: Date, required: true },
  category: { type: String, required: true },
  imageURL: { type: String, default: "https://via.placeholder.com/500" }, // Default image
  host: { type: Schema.Types.ObjectId, ref: "User", required: true },
  participants: [{ type: Schema.Types.ObjectId, ref: "User" }]
}, {
  timestamps: true
});

export default mongoose.model<IEvent>("Event", EventSchema);