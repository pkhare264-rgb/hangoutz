export enum UserRole { USER = 'USER', ADMIN = 'ADMIN' }
export type VerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';

export interface PeerReview {
  _id: string;
  reviewerId: string;
  reviewerName: string;
  rating: number; 
  comment: string;
  timestamp: string;
}

export interface User {
  _id: string; 
  firebaseUid: string; 
  name: string;
  phone: string;
  email?: string;
  age?: number; 
  dob?: string; 
  gender?: string;
  photoURL: string; 
  photos: string[]; 
  interests: string[]; 
  bio: string;
  verified: boolean; 
  trustScore: number;
  missedEventsCount?: number; 
  reviews?: PeerReview[]; 
  role?: UserRole;
  createdAt?: string; 
  blockedUserIds?: string[]; 
  privacySettings?: { showAge: boolean; showGender: boolean; };
}

export enum EventStatus {
  UPCOMING = 'UPCOMING',
  HAPPENING = 'HAPPENING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

export interface SocialEvent {
  _id: string;
  host: User; 
  title: string;
  description: string;
  location: string;
  category: string;
  imageURL: string;
  dateTime: string;
  maxParticipants?: number;
  status: EventStatus;
  participants: string[]; 
  coordinates?: { lat: number, lng: number };
}

export interface Conversation {
  _id: string;
  participants: User[];
  lastMessage: string;
  lastMessageTime: string;
  type: 'DM';
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  requesterId: string;
}

export interface ChatMessage {
  _id: string;
  channelId: string;
  sender: { _id: string; name: string; photoURL?: string; };
  message: string;
  timestamp: string;
}

export interface Report {
  _id: string;
  reporterId: string;
  reportedUserId: string;
  reason: string;
  timestamp: string;
  status: 'PENDING' | 'RESOLVED';
}