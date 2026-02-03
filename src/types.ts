
export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN'
}

export type VerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';

export interface PeerReview {
  _id: string;
  reviewerId: string;
  reviewerName: string;
  rating: number; // 1-5
  comment: string;
  timestamp: string;
}

// Mongoose-like Schema for User
export interface User {
  _id: string; // ObjectId
  name: string;
  phone: string;
  email?: string;
  age: number; // Calculated from dob
  dob: string; // ISO Date String (YYYY-MM-DD)
  gender?: 'Male' | 'Female';
  photoURL: string; // Primary photo (thumbnail)
  photos: string[]; // Gallery (max 5)
  interests: string[]; // User interests/tags
  bio: string;
  verified: boolean; // computed from verificationStatus for backward compat
  verificationStatus: VerificationStatus;
  verificationPhotoURL?: string; // Private photo for identity check
  trustScore: number;
  missedEventsCount: number;
  reviews: PeerReview[];
  role: UserRole;
  createdAt: string; // ISO Date string
  blockedUserIds: string[]; // List of IDs this user has blocked
  privacySettings: {
    showAge: boolean;
    showGender: boolean;
  };
}

export enum EventStatus {
  UPCOMING = 'UPCOMING',
  HAPPENING = 'HAPPENING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

// Mongoose-like Schema for Event
export interface SocialEvent {
  _id: string; // ObjectId
  host: {
    _id: string;
    name: string;
    photoURL: string;
  };
  title: string;
  description: string;
  location: string;
  category: string; // e.g. 'Sports', 'Food', etc.
  imageURL?: string; // Cover image for the event
  dateTime: string; // ISO Date
  maxParticipants: number;
  status: EventStatus;
  participants: string[]; // Array of User ObjectIds
  coordinates?: { lat: number, lng: number };
}

// Schema for 1-on-1 Conversations
export interface Conversation {
  _id: string; // ObjectId
  participants: User[]; // Array of 2 Users
  lastMessage: string;
  lastMessageTime: string;
  type: 'DM';
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  requesterId: string; // ID of the user who sent the request
}

// Mongoose-like Schema for Chat
export interface ChatMessage {
  _id: string; // ObjectId
  channelId: string; // Ref to Event._id OR Conversation._id
  sender: {
    _id: string;
    name: string;
    photoURL?: string;
  };
  message: string;
  timestamp: string; // ISO Date
  isSystem?: boolean;
}

// Mongoose-like Schema for Report
export interface Report {
  _id: string; // ObjectId
  reporterId: string; // Ref to User
  reportedUserId: string; // Ref to User
  eventId?: string; // Ref to Event
  reason: string;
  timestamp: string; // ISO Date
  status: 'PENDING' | 'RESOLVED';
}
