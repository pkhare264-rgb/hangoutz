import { User, SocialEvent, ChatMessage, Conversation, UserRole, EventStatus, Report, PeerReview } from '../types';

// Raipur Coordinates
const RAIPUR_COORDS = { lat: 21.2514, lng: 81.6296 };
const MAX_CITY_DISTANCE_KM = 30;

// --- MongoDB Simulation Utilities ---
const generateObjectId = (): string => {
  return [...Array(24)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const KEYS = {
  USERS: 'cg_mongo_users',
  VERIFICATIONS: 'cg_mongo_verifications',
  EVENTS: 'cg_mongo_events',
  CHATS: 'cg_mongo_chats',
  CONVOS: 'cg_mongo_convos',
  REPORTS: 'cg_mongo_reports',
  CURRENT_USER: 'cg_mongo_session'
};

// --- Helpers ---
const getCollection = <T>(key: string): T[] => {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : [];
};

const saveCollection = <T>(key: string, data: T[]) => {
  localStorage.setItem(key, JSON.stringify(data));
};

const calculateAge = (dob: string): number => {
    const today = new Date();
    const birthDate = new Date(dob);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) { age--; }
    return age;
};

// Ensure User object has all array fields to prevent "undefined.length" errors
const sanitizeUser = (u: User): User => ({
  ...u,
  photos: u.photos || [],
  interests: u.interests || [],
  reviews: u.reviews || [],
  blockedUserIds: u.blockedUserIds || [],
  privacySettings: u.privacySettings || { showAge: true, showGender: true }
});

// Haversine Formula for Geofencing
export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// --- Initialization ---
export const initDB = () => {
    let users = getCollection<User>(KEYS.USERS);
    let events = getCollection<SocialEvent>(KEYS.EVENTS);

    // Sanitize existing users immediately to fix any stale data
    if (users.length > 0) {
        users = users.map(sanitizeUser);
        saveCollection(KEYS.USERS, users);
    }

    const hasSeedData = users.some(u => u._id === 'u_aryan');

    if (hasSeedData) return;

    // Seed Users
    const u1: User = {
        _id: 'u_sarah',
        name: 'Sarah Jenkins',
        phone: '+919999999991',
        email: 'sarah@demo.com',
        dob: '2000-05-15',
        age: 24,
        gender: 'Female',
        photoURL: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=200&auto=format&fit=crop',
        photos: ['https://images.unsplash.com/photo-1494790108377-be9c29b29330'],
        interests: ['🎨 Art', '✈️ Travel'],
        bio: 'Digital nomad loving Raipur!',
        verified: true,
        verificationStatus: 'VERIFIED',
        trustScore: 95,
        missedEventsCount: 0,
        reviews: [],
        role: UserRole.USER,
        createdAt: new Date().toISOString(),
        blockedUserIds: [],
        privacySettings: { showAge: true, showGender: true }
    };

    const u2: User = {
        _id: 'u_aryan',
        name: 'Aryan Verma',
        phone: '+919999999992',
        email: 'aryan@demo.com',
        dob: '1996-08-20',
        age: 28,
        gender: 'Male',
        photoURL: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=200&auto=format&fit=crop',
        photos: ['https://images.unsplash.com/photo-1500648767791-00dcc994a43e'],
        interests: ['📸 Photography', '💻 Tech'],
        bio: 'Capturing moments. Tech enthusiast.',
        verified: true,
        verificationStatus: 'VERIFIED',
        trustScore: 88,
        missedEventsCount: 1,
        reviews: [
            { _id: 'r1', reviewerId: 'u_sarah', reviewerName: 'Sarah Jenkins', rating: 5, comment: 'Great host!', timestamp: new Date().toISOString() }
        ],
        role: UserRole.USER,
        createdAt: new Date().toISOString(),
        blockedUserIds: [],
        privacySettings: { showAge: true, showGender: true }
    };

    const u3: User = {
        _id: 'u_priya',
        name: 'Priya Sharma',
        phone: '+919999999993',
        email: 'priya@demo.com',
        dob: '2002-02-10',
        age: 22,
        gender: 'Female',
        photoURL: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&auto=format&fit=crop',
        photos: ['https://images.unsplash.com/photo-1534528741775-53994a69daeb'],
        interests: ['🎵 Music', '🍔 Food'],
        bio: 'Foodie and music lover.',
        verified: false,
        verificationStatus: 'PENDING',
        trustScore: 60,
        missedEventsCount: 0,
        reviews: [],
        role: UserRole.USER,
        createdAt: new Date().toISOString(),
        blockedUserIds: [],
        privacySettings: { showAge: true, showGender: true }
    };

    const u4: User = {
        _id: 'u_vikram',
        name: 'Vikram Singh',
        phone: '+919999999994',
        email: 'vikram@demo.com',
        dob: '1990-11-05',
        age: 34,
        gender: 'Male',
        photoURL: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=200&auto=format&fit=crop',
        photos: ['https://images.unsplash.com/photo-1472099645785-5658abf4ff4e'],
        interests: ['🏏 Cricket', '♟️ Chess', '💼 Business'],
        bio: 'Entrepreneur. Organizing local chess meetups.',
        verified: true,
        verificationStatus: 'VERIFIED',
        trustScore: 92,
        missedEventsCount: 0,
        reviews: [],
        role: UserRole.USER,
        createdAt: new Date().toISOString(),
        blockedUserIds: [],
        privacySettings: { showAge: true, showGender: true }
    };

    // Merge existing users with new seeds to avoid overwriting current user
    const existingIds = users.map(u => u._id);
    const newUsers = [u1, u2, u3, u4].filter(u => !existingIds.includes(u._id));
    users = [...users, ...newUsers];
    saveCollection(KEYS.USERS, users);

    // Seed Events
    const e1: SocialEvent = {
        _id: 'e_1',
        host: { _id: u1._id, name: u1.name, photoURL: u1.photoURL },
        title: 'Weekend Art Workshop',
        description: 'Join us for a relaxing painting session at Marine Drive. Bring your own supplies!',
        location: 'Marine Drive, Raipur',
        category: '🎨 Art',
        imageURL: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?q=80&w=800&auto=format&fit=crop',
        dateTime: new Date(Date.now() + 86400000 * 2).toISOString(), // 2 days later
        maxParticipants: 10,
        status: EventStatus.UPCOMING,
        participants: [u1._id, u2._id],
        coordinates: { lat: 21.2514, lng: 81.6296 }
    };

    const e2: SocialEvent = {
        _id: 'e_2',
        host: { _id: u2._id, name: u2.name, photoURL: u2.photoURL },
        title: 'Tech Talk & Coffee',
        description: 'Discussing the latest in AI and Web3 over good coffee.',
        location: 'Civil Lines, Raipur',
        category: '💻 Tech',
        imageURL: 'https://images.unsplash.com/photo-1515187029135-18ee286d815b?q=80&w=800&auto=format&fit=crop',
        dateTime: new Date(Date.now() + 86400000 * 5).toISOString(),
        maxParticipants: 5,
        status: EventStatus.UPCOMING,
        participants: [u2._id],
        coordinates: { lat: 21.244, lng: 81.635 }
    };

    const e3: SocialEvent = {
        _id: 'e_3',
        host: { _id: u3._id, name: u3.name, photoURL: u3.photoURL },
        title: 'Street Food Walk',
        description: 'Exploring the best chaat in Telibandha.',
        location: 'Telibandha Talab',
        category: '🍔 Food',
        imageURL: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=800&auto=format&fit=crop',
        dateTime: new Date(Date.now() + 86400000 * 1).toISOString(),
        maxParticipants: 15,
        status: EventStatus.UPCOMING,
        participants: [u3._id, u1._id],
        coordinates: { lat: 21.233, lng: 81.650 }
    };

    const e4: SocialEvent = {
        _id: 'e_4',
        host: { _id: u4._id, name: u4.name, photoURL: u4.photoURL },
        title: 'Sunday Chess Club',
        description: 'Open for all skill levels. Bring a board if you have one!',
        location: 'Magneto Mall Food Court',
        category: '♟️ Chess',
        imageURL: 'https://images.unsplash.com/photo-1529699211952-734e80c4d42b?q=80&w=800&auto=format&fit=crop',
        dateTime: new Date(Date.now() + 86400000 * 3).toISOString(),
        maxParticipants: 8,
        status: EventStatus.UPCOMING,
        participants: [u4._id, u1._id],
        coordinates: { lat: 21.238, lng: 81.670 }
    };

    const existingEventIds = events.map(e => e._id);
    const newEvents = [e1, e2, e3, e4].filter(e => !existingEventIds.includes(e._id));
    events = [...events, ...newEvents];
    saveCollection(KEYS.EVENTS, events);
};

// --- Auth & User ---

export const requestOtp = async (phone: string): Promise<void> => {
  await delay(1000);
  console.log(`[Auth] OTP sent to ${phone}: 123456`);
};

export const verifyOtp = async (phone: string, code: string): Promise<boolean> => {
  await delay(1000);
  return code === '123456';
};

export const loginWithFirebaseUid = async (firebaseUid: string, phone: string): Promise<User | null> => {
  const users = getCollection<User>(KEYS.USERS);
  const user = users.find(u => (u as any).firebaseUid === firebaseUid || u.phone === phone);
  
  if (user) {
    const sanitized = sanitizeUser(user);
    // Update local storage to remember this user
    localStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(sanitized));
    return sanitized;
  }
  return null;
};

export const signUpWithFirebaseUid = async (userData: any): Promise<User> => {
  const users = getCollection<User>(KEYS.USERS);
  
  const newUser: User = {
    _id: generateObjectId(),
    // @ts-ignore: Assuming firebaseUid is added to the User type or stored dynamically
    firebaseUid: userData.firebaseUid,
    phone: userData.phone,
    name: userData.name || 'User',
    email: userData.email || '',
    // Use helper to calc age or fallback to 18
    age: userData.dob ? calculateAge(userData.dob) : 18,
    dob: userData.dob || '2000-01-01',
    gender: userData.gender || 'Other',
    photoURL: userData.photoURL || '',
    photos: userData.photos || [],
    interests: userData.interests || [],
    bio: userData.bio || '',
    // Default system values
    verified: false,
    verificationStatus: 'PENDING',
    trustScore: 50,
    missedEventsCount: 0,
    reviews: [],
    role: UserRole.USER,
    createdAt: new Date().toISOString(),
    blockedUserIds: [],
    privacySettings: { showAge: true, showGender: true },
    
    ...userData // Allow overrides if specific properties are passed
  };

  users.push(newUser);
  saveCollection(KEYS.USERS, users);
  
  // Set as the current active session
  localStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(newUser));
  
  return newUser;
};

export const mockLogin = async (phone: string): Promise<User | null> => {
  await delay(600);
  const users = getCollection<User>(KEYS.USERS);
  const user = users.find(u => u.phone === phone);
  if (user) {
    const sanitized = sanitizeUser(user);
    localStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(sanitized));
    return sanitized;
  }
  return null;
};

export const mockSignUp = async (profile: Partial<User>): Promise<User> => {
  await delay(1000);
  const users = getCollection<User>(KEYS.USERS);
  const userId = generateObjectId();
  const newUserPublic: User = {
    _id: userId,
    name: profile.name || 'User',
    phone: profile.phone || '',
    email: profile.email || '',
    age: profile.dob ? calculateAge(profile.dob) : 18,
    dob: profile.dob || '2000-01-01',
    gender: profile.gender,
    photoURL: profile.photos?.[0] || '',
    photos: profile.photos || [],
    interests: profile.interests || [],
    bio: profile.bio || '',
    verified: !!profile.verificationPhotoURL,
    verificationStatus: profile.verificationPhotoURL ? 'VERIFIED' : 'PENDING',
    trustScore: 100,
    missedEventsCount: 0,
    reviews: [],
    role: UserRole.USER,
    createdAt: new Date().toISOString(),
    blockedUserIds: [],
    privacySettings: { showAge: true, showGender: true }
  };
  users.push(newUserPublic);
  saveCollection(KEYS.USERS, users);
  localStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(newUserPublic));
  return newUserPublic;
};

export const deleteAccount = async (userId: string): Promise<void> => {
    // Remove user
    let users = getCollection<User>(KEYS.USERS);
    users = users.filter(u => u._id !== userId);
    saveCollection(KEYS.USERS, users);
    
    // Cleanup events hosted by user
    let events = getCollection<SocialEvent>(KEYS.EVENTS);
    events = events.filter(e => e.host._id !== userId);
    saveCollection(KEYS.EVENTS, events);

    // Logout
    logout();
};

export const blockUser = async (currentUserId: string, targetUserId: string): Promise<User> => {
    const users = getCollection<User>(KEYS.USERS);
    const userIdx = users.findIndex(u => u._id === currentUserId);
    if (!users[userIdx].blockedUserIds) users[userIdx].blockedUserIds = [];
    if (!users[userIdx].blockedUserIds.includes(targetUserId)) {
        users[userIdx].blockedUserIds.push(targetUserId);
        saveCollection(KEYS.USERS, users);
    }
    const updated = sanitizeUser(users[userIdx]);
    localStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(updated));
    return updated;
};

export const unblockUser = async (currentUserId: string, targetUserId: string): Promise<User> => {
    const users = getCollection<User>(KEYS.USERS);
    const userIdx = users.findIndex(u => u._id === currentUserId);
    users[userIdx].blockedUserIds = (users[userIdx].blockedUserIds || []).filter(id => id !== targetUserId);
    saveCollection(KEYS.USERS, users);
    const updated = sanitizeUser(users[userIdx]);
    localStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(updated));
    return updated;
};

export const getBlockedUsers = async (userIds: string[]): Promise<User[]> => {
    const users = getCollection<User>(KEYS.USERS);
    return users.filter(u => userIds.includes(u._id)).map(sanitizeUser);
};

// --- Trust & Feedback Logic ---

export const markMissedEvent = async (userId: string): Promise<void> => {
    const users = getCollection<User>(KEYS.USERS);
    const idx = users.findIndex(u => u._id === userId);
    if (idx !== -1) {
        users[idx].missedEventsCount += 1;
        // 1 missed event = -20 score
        users[idx].trustScore = Math.max(0, users[idx].trustScore - 20);
        saveCollection(KEYS.USERS, users);
        const current = getCurrentUser();
        if (current?._id === userId) {
            localStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(users[idx]));
        }
    }
};

export const submitUserReview = async (targetUserId: string, review: Omit<PeerReview, '_id' | 'timestamp'>): Promise<void> => {
    const users = getCollection<User>(KEYS.USERS);
    const idx = users.findIndex(u => u._id === targetUserId);
    if (idx !== -1) {
        if (!users[idx].reviews) users[idx].reviews = [];
        const newReview: PeerReview = {
            ...review,
            _id: generateObjectId(),
            timestamp: new Date().toISOString()
        };
        users[idx].reviews.push(newReview);
        
        // Recalculate trust score: Base 100 + (Avg Rating impact) - Missed Event Penalties
        const count = users[idx].reviews.length;
        const avgRating = count > 0 ? users[idx].reviews.reduce((sum, r) => sum + r.rating, 0) / count : 0;
        const ratingImpact = (avgRating - 3) * 5; // e.g., 5 star avg adds +10, 1 star avg subtracts -10
        
        users[idx].trustScore = Math.max(0, 100 + ratingImpact - (users[idx].missedEventsCount * 20));
        saveCollection(KEYS.USERS, users);
    }
};

// --- Events ---

export const createEvent = async (eventData: Partial<SocialEvent>, host: User, coords: {lat: number, lng: number}): Promise<SocialEvent> => {
  const distance = calculateDistance(coords.lat, coords.lng, RAIPUR_COORDS.lat, RAIPUR_COORDS.lng);
  if (distance > MAX_CITY_DISTANCE_KM) {
      throw new Error(`Location Restricted: Hangoutz is only available in Raipur city radius (30km). You are currently ${distance.toFixed(1)}km away.`);
  }

  const events = getCollection<SocialEvent>(KEYS.EVENTS);
  const newEvent: SocialEvent = {
    _id: generateObjectId(),
    host: { _id: host._id, name: host.name, photoURL: host.photoURL },
    title: eventData.title!,
    description: eventData.description!,
    location: eventData.location!,
    category: eventData.category!,
    imageURL: eventData.imageURL || 'https://images.unsplash.com/photo-1511632765486-a4a920224d29?q=80&w=800&auto=format&fit=crop',
    dateTime: eventData.dateTime!,
    maxParticipants: eventData.maxParticipants || 10,
    status: EventStatus.UPCOMING,
    participants: [host._id],
    coordinates: coords
  };
  events.push(newEvent);
  saveCollection(KEYS.EVENTS, events);
  return newEvent;
};

export const getEvents = async (currentUserId?: string): Promise<SocialEvent[]> => {
  const events = getCollection<SocialEvent>(KEYS.EVENTS);
  const users = getCollection<User>(KEYS.USERS);
  const currentUser = currentUserId ? users.find(u => u._id === currentUserId) : null;
  const blockedByMe = currentUser?.blockedUserIds || [];
  const blockedMe = users.filter(u => u.blockedUserIds?.includes(currentUserId || '')).map(u => u._id);

  return events
    .filter(e => !blockedByMe.includes(e.host._id) && !blockedMe.includes(e.host._id))
    .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
};

export const getCurrentUser = (): User | null => {
  const data = localStorage.getItem(KEYS.CURRENT_USER);
  return data ? sanitizeUser(JSON.parse(data)) : null;
};

export const logout = async () => { localStorage.removeItem(KEYS.CURRENT_USER); };

export const getUserById = async (userId: string): Promise<User | null> => {
    const users = getCollection<User>(KEYS.USERS);
    const u = users.find(u => u._id === userId);
    return u ? sanitizeUser(u) : null;
};

export const submitVerification = async (userId: string, img: string): Promise<User> => {
    const users = getCollection<User>(KEYS.USERS);
    const userIndex = users.findIndex(u => u._id === userId);
    if (userIndex > -1) {
        users[userIndex].verificationPhotoURL = img;
        users[userIndex].verificationStatus = 'VERIFIED';
        users[userIndex].verified = true;
        saveCollection(KEYS.USERS, users);
        const sanitized = sanitizeUser(users[userIndex]);
        localStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(sanitized));
        return sanitized;
    }
    throw new Error("User not found");
};

export const startConversation = async (currentUser: User, targetUser: User): Promise<Conversation> => {
    const convos = getCollection<Conversation>(KEYS.CONVOS);
    let convo = convos.find(c => 
        (c.participants[0]._id === currentUser._id && c.participants[1]._id === targetUser._id) ||
        (c.participants[0]._id === targetUser._id && c.participants[1]._id === currentUser._id)
    );
    if (!convo) {
        convo = {
            _id: generateObjectId(),
            participants: [sanitizeUser(currentUser), sanitizeUser(targetUser)],
            lastMessage: '',
            lastMessageTime: new Date().toISOString(),
            type: 'DM',
            status: 'PENDING', // Default to PENDING for message requests
            requesterId: currentUser._id
        };
        convos.push(convo);
        saveCollection(KEYS.CONVOS, convos);
    }
    return convo;
};

export const acceptConversation = async (convoId: string): Promise<Conversation> => {
    const convos = getCollection<Conversation>(KEYS.CONVOS);
    const idx = convos.findIndex(c => c._id === convoId);
    if (idx > -1) {
        convos[idx].status = 'ACCEPTED';
        saveCollection(KEYS.CONVOS, convos);
        return convos[idx];
    }
    throw new Error("Conversation not found");
};

export const rejectConversation = async (convoId: string): Promise<void> => {
    const convos = getCollection<Conversation>(KEYS.CONVOS);
    const newConvos = convos.filter(c => c._id !== convoId);
    saveCollection(KEYS.CONVOS, newConvos);
};

export const joinEvent = async (eventId: string, userId: string): Promise<void> => {
    const events = getCollection<SocialEvent>(KEYS.EVENTS);
    const eventIndex = events.findIndex(e => e._id === eventId);
    if (eventIndex > -1) {
        if (!events[eventIndex].participants) events[eventIndex].participants = [];
        if (!events[eventIndex].participants.includes(userId)) {
            events[eventIndex].participants.push(userId);
            saveCollection(KEYS.EVENTS, events);
        }
    }
};

export const getMyConversations = async (userId: string): Promise<Conversation[]> => {
    const convos = getCollection<Conversation>(KEYS.CONVOS);
    return convos.filter(c => c.participants.some(p => p._id === userId));
};

export const getMessages = async (channelId: string): Promise<ChatMessage[]> => {
    const chats = getCollection<ChatMessage>(KEYS.CHATS);
    return chats.filter(c => c.channelId === channelId);
};

export const sendMessage = async (payload: { channelId: string; sender: { _id: string; name: string; }; message: string; }): Promise<void> => {
    const chats = getCollection<ChatMessage>(KEYS.CHATS);
    const msg: ChatMessage = {
        _id: generateObjectId(),
        channelId: payload.channelId,
        sender: payload.sender,
        message: payload.message,
        timestamp: new Date().toISOString()
    };
    chats.push(msg);
    saveCollection(KEYS.CHATS, chats);
    
    // Update conversation last message
    const convos = getCollection<Conversation>(KEYS.CONVOS);
    const convoIndex = convos.findIndex(c => c._id === payload.channelId);
    if (convoIndex > -1) {
        convos[convoIndex].lastMessage = payload.message;
        convos[convoIndex].lastMessageTime = msg.timestamp;
        saveCollection(KEYS.CONVOS, convos);
    }
};

export const updateUser = async (userId: string, updates: Partial<User>): Promise<User> => {
    const users = getCollection<User>(KEYS.USERS);
    const userIndex = users.findIndex(u => u._id === userId);
    if (userIndex > -1) {
        users[userIndex] = { ...users[userIndex], ...updates };
        saveCollection(KEYS.USERS, users);
        const sanitized = sanitizeUser(users[userIndex]);
        localStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(sanitized));
        return sanitized;
    }
    throw new Error("User not found");
};

export const getAllUsers = async (): Promise<User[]> => {
    return getCollection<User>(KEYS.USERS).map(sanitizeUser);
};