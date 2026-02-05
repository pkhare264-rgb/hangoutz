import axios from 'axios';
import { auth } from './firebase'; 
import { User, SocialEvent, ChatMessage, Conversation, EventStatus } from '../types';

// 🔴 CHANGE THIS to your Render URL after deployment!
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

// --- HELPERS ---
const getAuthHeaders = async () => {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error("Not authenticated");
    return { headers: { Authorization: `Bearer ${localStorage.getItem('hangoutz_token')}` } }; 
};

// Raipur Geofencing
const RAIPUR_COORDS = { lat: 21.2514, lng: 81.6296 };
const MAX_CITY_DISTANCE_KM = 30;

export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

// --- INITIALIZATION ---
export const initDB = () => {
    console.log(`🚀 Connecting to Backend: ${API_URL}`);
};

// --- AUTHENTICATION ---
export const loginWithFirebaseUid = async (uid: string, phone: string): Promise<User | null> => {
    try {
        const firebaseToken = await auth.currentUser?.getIdToken(true);
        const res = await axios.post(`${API_URL}/auth/login`, { firebaseToken });
        localStorage.setItem('hangoutz_token', res.data.token);
        localStorage.setItem('hangoutz_user', JSON.stringify(res.data.user));
        return res.data.user;
    } catch (error: any) {
        if (error.response && error.response.status === 404) {
            return null; 
        }
        console.error("Login Failed:", error);
        throw error;
    }
};

export const signUpWithFirebaseUid = async (userData: any): Promise<User> => {
    try {
        const firebaseToken = await auth.currentUser?.getIdToken(true);
        const res = await axios.post(`${API_URL}/auth/signup`, {
            firebaseToken,
            ...userData
        });
        localStorage.setItem('hangoutz_token', res.data.token);
        localStorage.setItem('hangoutz_user', JSON.stringify(res.data.user));
        return res.data.user;
    } catch (error) {
        console.error("Signup Failed:", error);
        throw error;
    }
};

export const getCurrentUser = (): User | null => {
    const data = localStorage.getItem('hangoutz_user');
    return data ? JSON.parse(data) : null;
};

export const logout = () => {
    auth.signOut();
    localStorage.removeItem('hangoutz_token');
    localStorage.removeItem('hangoutz_user');
    window.location.reload();
};

// --- EVENTS ---
export const getEvents = async (currentUserId?: string): Promise<SocialEvent[]> => {
    try {
        const res = await axios.get(`${API_URL}/events`);
        return res.data;
    } catch (error) {
        console.error("Fetch Events Failed:", error);
        return [];
    }
};

export const createEvent = async (eventData: Partial<SocialEvent>, host: User, coords: {lat: number, lng: number}): Promise<SocialEvent> => {
    const distance = calculateDistance(coords.lat, coords.lng, RAIPUR_COORDS.lat, RAIPUR_COORDS.lng);
    if (distance > MAX_CITY_DISTANCE_KM) {
        throw new Error(`Location Restricted: Hangoutz is only available in Raipur (30km). You are ${distance.toFixed(1)}km away.`);
    }

    const headers = await getAuthHeaders();
    const payload = {
        ...eventData,
        coordinates: coords,
        imageURL: eventData.imageURL || 'https://images.unsplash.com/photo-1511632765486-a4a920224d29?q=80&w=800&auto=format&fit=crop'
    };

    const res = await axios.post(`${API_URL}/events/create`, payload, headers);
    return res.data;
};

export const joinEvent = async (eventId: string, userId: string): Promise<void> => {
    const headers = await getAuthHeaders();
    await axios.post(`${API_URL}/events/${eventId}/join`, {}, headers);
};

// --- STUBS ---
export const getUserById = async (userId: string): Promise<User | null> => { return null; };

export const updateUser = async (userId: string, updates: Partial<User>): Promise<User> => {
    console.warn("Backend update not implemented yet. Updating local session only.");
    const current = getCurrentUser();
    if (!current) throw new Error("No user");
    const updated = { ...current, ...updates };
    localStorage.setItem('hangoutz_user', JSON.stringify(updated));
    return updated;
};

export const getMyConversations = async (userId: string): Promise<Conversation[]> => [];
export const startConversation = async (currentUser: User, targetUser: User): Promise<Conversation | null> => null;
export const getMessages = async (channelId: string): Promise<ChatMessage[]> => [];
export const sendMessage = async (payload: any) => console.log("Message sent (simulated)");
export const acceptConversation = async (id: string) => {};
export const rejectConversation = async (id: string) => {};
export const blockUser = async (myId: string, otherId: string) => getCurrentUser()!;
export const unblockUser = async (myId: string, otherId: string) => getCurrentUser()!;
export const getBlockedUsers = async (ids: string[]) => [];
export const deleteAccount = async (id: string) => logout();
export const submitVerification = async (id: string, img: string) => getCurrentUser()!;
export const submitUserReview = async (targetId: string, review: any) => {};

// Only ONE export of this function!
export const getAllUsers = async (): Promise<User[]> => {
    const u = getCurrentUser();
    return u ? [u] : [];
};