import React, { useState, useEffect, useRef } from 'react';
import { User, SocialEvent, ChatMessage, Conversation, Report, PeerReview } from './types';
import * as DB from './services/db';
import { moderateText, getChatResponse } from './services/ai';
import { App as CapacitorApp } from '@capacitor/app';
// FIREBASE IMPORTS
import { signInWithPhoneNumber, RecaptchaVerifier, ConfirmationResult } from "firebase/auth";
import { auth } from "./services/firebase";

// --- GLOBAL DECLARATION FOR RECAPTCHA ---
declare global {
  interface Window {
    recaptchaVerifier: any;
  }
}

// --- Constants ---
const CATEGORIES = [
    '⚽ Sports', '🎵 Music', '🎨 Art', '💻 Tech', 
    '✈️ Travel', '🍔 Food', '🎮 Gaming', '📚 Reading',
    '🎬 Movies', '🧘 Wellness', '📸 Photography', '👗 Fashion', '♟️ Chess'
];

// Raipur Center for Map Defaults
const DEFAULT_CENTER = { lat: 21.2514, lng: 81.6296 };

// --- Utils ---
const compressImage = (file: File | string, maxWidth = 500, quality = 0.6): Promise<string> => {
    return new Promise((resolve) => {
        const process = (src: string) => {
            const img = new Image();
            img.src = src;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const scale = maxWidth / img.width;
                const finalScale = scale < 1 ? scale : 1;
                
                canvas.width = img.width * finalScale;
                canvas.height = img.height * finalScale;
                
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    resolve(canvas.toDataURL('image/jpeg', quality));
                } else {
                    resolve(src); // Fallback
                }
            };
            img.onerror = () => resolve(src);
        };

        if (typeof file === 'string') {
            process(file);
        } else {
            const reader = new FileReader();
            reader.onloadend = () => process(reader.result as string);
            reader.readAsDataURL(file);
        }
    });
};

const calculateAge = (dob: string): number => {
    const today = new Date();
    const birthDate = new Date(dob);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;
};

const Icon = ({ name, className = "" }: { name: string, className?: string, key?: React.Key }) => (
  <i className={`fas fa-${name} ${className}`}></i>
);

const TrustBadge = ({ score }: { score: number }) => {
    let color = "text-red-500 bg-red-50";
    let label = "Caution";
    if (score >= 90) { color = "text-emerald-600 bg-emerald-50"; label = "Elite"; }
    else if (score >= 70) { color = "text-blue-600 bg-blue-50"; label = "Trusted"; }
    else if (score >= 40) { color = "text-orange-600 bg-orange-50"; label = "Fair"; }
    
    return (
        <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-tight ${color}`}>
            {label} ({score})
        </span>
    );
};

// --- Reusable Components ---

const GoogleMap = ({ 
    center = DEFAULT_CENTER, 
    zoom = 13, 
    markers = [], 
    onMapClick, 
}: { 
    center?: { lat: number, lng: number }, 
    zoom?: number, 
    markers?: { lat: number, lng: number, title?: string, id?: string }[], 
    onMapClick?: (lat: number, lng: number) => void,
}) => {
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstance = useRef<any>(null);
    const markersRef = useRef<any[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState(false);

    useEffect(() => {
        if ((window as any).google && (window as any).google.maps) {
            setLoaded(true);
            return;
        }
        
        const existingScript = document.getElementById('google-maps-script');
        if (existingScript) {
            existingScript.addEventListener('load', () => setLoaded(true));
            existingScript.addEventListener('error', () => setError(true));
            return;
        }

        const script = document.createElement('script');
        script.id = 'google-maps-script';
        // Using ImportMeta env safely (requires vite-env.d.ts or similar config)
        script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&libraries=places`;
        script.async = true;
        script.defer = true;
        script.onload = () => setLoaded(true);
        script.onerror = () => setError(true);
        document.body.appendChild(script);
        
        return () => {};
    }, []);

    useEffect(() => {
        if (!loaded || !mapRef.current) return;

        try {
            if (!mapInstance.current) {
                mapInstance.current = new (window as any).google.maps.Map(mapRef.current, {
                    center: center,
                    zoom: zoom,
                    disableDefaultUI: true,
                    zoomControl: true,
                    styles: [
                        { "featureType": "all", "elementType": "geometry.fill", "stylers": [{"weight": "2.00"}] },
                        { "featureType": "all", "elementType": "geometry.stroke", "stylers": [{"color": "#9c9c9c"}] },
                        { "featureType": "all", "elementType": "labels.text", "stylers": [{"visibility": "on"}] },
                        { "featureType": "landscape", "elementType": "all", "stylers": [{"color": "#f2f2f2"}] },
                        { "featureType": "landscape", "elementType": "geometry.fill", "stylers": [{"color": "#ffffff"}] },
                        { "featureType": "poi", "elementType": "all", "stylers": [{"visibility": "off"}] },
                        { "featureType": "road", "elementType": "geometry.fill", "stylers": [{"color": "#eeeeee"}] },
                        { "featureType": "road", "elementType": "labels.text.fill", "stylers": [{"color": "#7b7b7b"}] },
                        { "featureType": "water", "elementType": "all", "stylers": [{"color": "#c8d7d4"},{"visibility": "on"}] },
                    ]
                });

                if (onMapClick) {
                    mapInstance.current.addListener('click', (e: any) => {
                        onMapClick(e.latLng.lat(), e.latLng.lng());
                    });
                }
            }

            markersRef.current.forEach(m => m.setMap(null));
            markersRef.current = [];

            markers.forEach(m => {
                const marker = new (window as any).google.maps.Marker({
                    position: { lat: m.lat, lng: m.lng },
                    map: mapInstance.current,
                    title: m.title,
                    animation: (window as any).google.maps.Animation.DROP
                });
                markersRef.current.push(marker);
            });
        } catch (e) {
            console.error("Map initialization error", e);
            setError(true);
        }

    }, [loaded, center, zoom, markers]);

    if (error) return <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-500 text-xs">Map Error. Check API Key.</div>;
    if (!loaded) return <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-500 text-xs animate-pulse">Loading Map...</div>;

    return <div ref={mapRef} style={{ width: '100%', height: '100%' }} className="w-full h-full rounded-3xl overflow-hidden shadow-inner bg-gray-100 z-0" />;
}


const VerificationGate = ({ user, children, fallback }: { user: User, children?: React.ReactNode, fallback?: React.ReactNode }) => {
  if (user.verified) return <>{children}</>;
  
  return fallback ? <>{fallback}</> : (
    <div className="relative group overflow-hidden rounded-full md:rounded-2xl">
      <div className="pointer-events-none filter grayscale opacity-40 select-none">{children}</div>
      <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-gray-50/10 backdrop-blur-[2px]">
        <div className="bg-black/90 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 transform transition-transform animate-scale-in">
          <Icon name="shield-alt" className="text-orange-400" /> 
          <span className="text-xs font-bold">Verification Required</span>
        </div>
      </div>
    </div>
  );
};

function CameraCapture({ onCapture, mode = 'VERIFICATION' }: { onCapture: (img: string) => void, mode?: 'VERIFICATION' | 'PHOTO' }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState('');
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    startCamera();
    return () => { stopCamera(); };
  }, []);

  const startCamera = async () => {
    try {
      if (streamRef.current) stopCamera(); 
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 } }, audio: false });
      streamRef.current = s;
      if (videoRef.current) videoRef.current.srcObject = s;
    } catch (e) {
      setError("Camera access denied. Please enable camera permissions.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
    }
    if (videoRef.current) {
        videoRef.current.srcObject = null;
    }
  };

  const takePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    const w = videoRef.current.videoWidth;
    const h = videoRef.current.videoHeight;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx?.drawImage(videoRef.current, 0, 0, w, h);
    const base64 = canvas.toDataURL('image/jpeg', 0.6);
    onCapture(base64);
    stopCamera();
  };

  return (
    <div className={`w-full bg-black overflow-hidden relative shadow-inner flex flex-col ${mode === 'VERIFICATION' ? 'aspect-[3/4] rounded-2xl' : 'h-full rounded-none'}`}>
      {error ? (
        <div className="flex flex-col items-center justify-center h-full text-white/50 p-6 text-center">
           <Icon name="eye-slash" className="text-3xl mb-3" />
           <p className="text-sm font-medium">{error}</p>
        </div>
      ) : (
        <>
          <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover transform scale-x-[-1]" />
          {mode === 'VERIFICATION' && (
            <>
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                 <div className="w-40 h-56 border-[3px] border-white/40 rounded-[50%] shadow-[0_0_100px_rgba(0,0,0,0.5)_inset]"></div>
              </div>
              <div className="absolute top-4 w-full text-center pointer-events-none">
                 <span className="bg-black/50 text-white text-[10px] px-3 py-1 rounded-full backdrop-blur-md">Position face in oval</span>
              </div>
            </>
          )}
          <div className="absolute bottom-6 left-0 right-0 flex justify-center z-10 pointer-events-auto">
            <button 
              onClick={(e) => { e.preventDefault(); takePhoto(); }} 
              className="w-16 h-16 rounded-full border-[4px] border-white/50 flex items-center justify-center hover:bg-white/10 transition active:scale-95 cursor-pointer"
            >
              <div className="w-12 h-12 bg-white rounded-full shadow-lg"></div>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// --- Screens ---
function BlockedUsersScreen({ currentUser, onBack, onUpdate }: { currentUser: User, onBack: () => void, onUpdate: (u: User) => void }) {
    const [blockedList, setBlockedList] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        DB.getBlockedUsers(currentUser.blockedUserIds || []).then(users => {
            setBlockedList(users);
            setLoading(false);
        });
    }, [currentUser.blockedUserIds]);

    const handleUnblock = async (id: string) => {
        const updated = await DB.unblockUser(currentUser._id, id);
        onUpdate(updated);
    };

    return (
        <div className="animate-slide-up pb-20">
            <div className="flex items-center gap-4 mb-6">
                <button onClick={onBack} className="w-10 h-10 bg-white rounded-full shadow-sm flex items-center justify-center"><Icon name="arrow-left" /></button>
                <h2 className="text-2xl font-black">Blocked Users</h2>
            </div>
            <div className="space-y-3">
                {loading ? <p className="text-gray-400">Loading...</p> : 
                 blockedList.length === 0 ? <p className="text-gray-400">No blocked users.</p> :
                 blockedList.map(u => (
                    <div key={u._id} className="flex items-center justify-between p-4 bg-white rounded-2xl border border-gray-100">
                        <div className="flex items-center gap-3">
                            <img src={u.photoURL} className="w-10 h-10 rounded-full object-cover" />
                            <span className="font-bold">{u.name}</span>
                        </div>
                        <button onClick={() => handleUnblock(u._id)} className="text-xs font-bold text-blue-600">Unblock</button>
                    </div>
                ))}
            </div>
        </div>
    );
}

function PrivacyScreen({ user, onBack, onLogout, onUpdateUser, onBlockedUsers }: any) {
    const [settings, setSettings] = useState(user.privacySettings || { showAge: true, showGender: true });

    const toggle = async (key: 'showAge' | 'showGender') => {
        const newSettings = { ...settings, [key]: !settings[key] };
        setSettings(newSettings);
        const updated = await DB.updateUser(user._id, { privacySettings: newSettings });
        onUpdateUser(updated);
    };

    const handleDelete = async () => {
        if(window.confirm("Are you sure you want to delete your account? This cannot be undone and you will lose all data.")) {
            await DB.deleteAccount(user._id);
            onLogout();
        }
    }

    return (
         <div className="animate-slide-up pb-20">
            <div className="flex items-center gap-4 mb-8">
                <button onClick={onBack} className="w-10 h-10 bg-white rounded-full shadow-sm flex items-center justify-center"><Icon name="arrow-left" /></button>
                <h2 className="text-2xl font-black">Privacy & Security</h2>
            </div>

            <div className="space-y-6">
                <div className="bg-white rounded-[2rem] p-6 shadow-soft border border-white space-y-4">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Profile Visibility</h3>
                    
                    <div className="flex items-center justify-between p-2">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center"><Icon name="birthday-cake" /></div>
                            <div><div className="font-bold text-sm">Show Age</div><div className="text-xs text-gray-400">Visible on public profile</div></div>
                        </div>
                        <button onClick={() => toggle('showAge')} className={`w-12 h-7 rounded-full transition relative ${settings.showAge ? 'bg-black' : 'bg-gray-200'}`}>
                            <div className={`w-5 h-5 bg-white rounded-full absolute top-1 transition-all ${settings.showAge ? 'left-6' : 'left-1'}`}></div>
                        </button>
                    </div>

                    <div className="flex items-center justify-between p-2">
                         <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-purple-50 text-purple-500 rounded-full flex items-center justify-center"><Icon name="venus-mars" /></div>
                            <div><div className="font-bold text-sm">Show Gender</div><div className="text-xs text-gray-400">Visible on public profile</div></div>
                        </div>
                        <button onClick={() => toggle('showGender')} className={`w-12 h-7 rounded-full transition relative ${settings.showGender ? 'bg-black' : 'bg-gray-200'}`}>
                            <div className={`w-5 h-5 bg-white rounded-full absolute top-1 transition-all ${settings.showGender ? 'left-6' : 'left-1'}`}></div>
                        </button>
                    </div>
                </div>

                <div className="bg-white rounded-[2rem] p-6 shadow-soft border border-white space-y-4">
                     <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Safety</h3>
                     <button onClick={onBlockedUsers} className="w-full flex items-center justify-between p-2 group">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gray-100 text-gray-500 rounded-full flex items-center justify-center"><Icon name="ban" /></div>
                            <div className="text-left"><div className="font-bold text-sm">Blocked Users</div><div className="text-xs text-gray-400">Manage blocked accounts</div></div>
                        </div>
                        <Icon name="chevron-right" className="text-gray-300" />
                     </button>
                </div>

                 <div className="bg-red-50 rounded-[2rem] p-6 border border-red-100 space-y-4">
                     <h3 className="text-xs font-bold text-red-400 uppercase tracking-widest ml-1">Danger Zone</h3>
                     <button onClick={handleDelete} className="w-full py-4 bg-white text-red-500 font-bold rounded-2xl border border-red-100 shadow-sm">Delete Account</button>
                </div>
            </div>
        </div>
    );
}

function ReviewModal({ targetUser, onClose, onSuccess }: { targetUser: User, onClose: () => void, onSuccess: () => void }) {
    const [rating, setRating] = useState(5);
    const [comment, setComment] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        setLoading(true);
        const current = DB.getCurrentUser();
        if (current) {
            const mod = await moderateText(comment);
            if (mod.flagged) {
                alert(`Content restricted: ${mod.reason}`);
                setLoading(false);
                return;
            }
            await DB.submitUserReview(targetUser._id, {
                reviewerId: current._id,
                reviewerName: current.name,
                rating,
                comment
            });
            onSuccess();
        }
        setLoading(false);
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
            <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl animate-scale-in">
                <h3 className="text-xl font-black mb-2">Review {targetUser.name}</h3>
                <p className="text-gray-500 text-sm mb-6">How was your interaction? Your feedback affects their trust score.</p>
                <div className="flex justify-center gap-2 mb-8">
                    {[1,2,3,4,5].map(star => (
                        <button key={star} onClick={() => setRating(star)} className={`text-2xl ${star <= rating ? 'text-yellow-400' : 'text-gray-200'}`}><Icon name="star" /></button>
                    ))}
                </div>
                <textarea className="w-full bg-gray-50 rounded-2xl p-4 text-sm mb-6 outline-none focus:ring-2 focus:ring-black transition h-24" placeholder="Describe your experience..." value={comment} onChange={e => setComment(e.target.value)} />
                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 py-3 font-bold text-gray-400">Cancel</button>
                    <button onClick={handleSubmit} disabled={loading} className="flex-1 py-3 bg-black text-white rounded-2xl font-bold">{loading ? 'Submitting...' : 'Submit'}</button>
                </div>
            </div>
        </div>
    );
}

// --- Main App ---
type View = 'AUTH' | 'HOME' | 'CREATE_EVENT' | 'EVENT_DETAILS' | 'PROFILE' | 'EDIT_PROFILE' | 'BLOCKED_LIST' | 'ADMIN' | 'MESSAGES' | 'CHAT_ROOM' | 'USER_PROFILE' | 'PRIVACY';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<View>('AUTH');
  const [activeEvent, setActiveEvent] = useState<SocialEvent | null>(null);
  const [activeConvo, setActiveConvo] = useState<Conversation | null>(null);
  const [targetUser, setTargetUser] = useState<User | null>(null);
  const [showChatbot, setShowChatbot] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [verificationLoading, setVerificationLoading] = useState(false);

  useEffect(() => {
    DB.initDB();
    const user = DB.getCurrentUser();
    if (user) { setCurrentUser(user); setCurrentView('HOME'); }
  }, []);

  // --- NATIVE BACK BUTTON HANDLING ---
  useEffect(() => {
    const handleBackButton = async () => {
        try {
            await CapacitorApp.addListener('backButton', ({ canGoBack }) => {
                if (currentView === 'HOME' || currentView === 'AUTH') {
                    CapacitorApp.exitApp();
                } else if (['EVENT_DETAILS', 'CREATE_EVENT', 'USER_PROFILE', 'MESSAGES', 'PROFILE', 'ADMIN'].includes(currentView)) {
                    setCurrentView('HOME');
                } else if (['CHAT_ROOM'].includes(currentView)) {
                    setCurrentView('MESSAGES');
                } else if (['EDIT_PROFILE', 'PRIVACY', 'BLOCKED_LIST'].includes(currentView)) {
                    setCurrentView('PROFILE');
                } else {
                    setCurrentView('HOME');
                }
            });
        } catch (e) {
            // Capacitor not installed or running in browser - ignore
        }
    };
    handleBackButton();

    return () => {
        try { CapacitorApp.removeAllListeners(); } catch(e) {}
    }
  }, [currentView]);

  const handleLogout = () => { DB.logout(); setCurrentUser(null); setCurrentView('AUTH'); setActiveEvent(null); };
  const openUserProfile = (user: User) => { setTargetUser(user); setCurrentView('USER_PROFILE'); }

  const handleVerification = async (img: string) => {
      if(!currentUser) return;
      setVerificationLoading(true);
      try {
          const updatedUser = await DB.submitVerification(currentUser._id, img);
          setCurrentUser(updatedUser);
          setShowVerificationModal(false);
          alert("Verification Successful! You can now join events.");
      } catch(e) { alert("Verification failed. Please try again."); }
      setVerificationLoading(false);
  };

  const renderView = () => {
    if (currentView === 'AUTH') return <AuthScreen onSuccess={(u) => { setCurrentUser(u); setCurrentView('HOME'); }} />;

    return (
      <div className="min-h-screen bg-background text-primary flex flex-col font-sans selection:bg-black pt-safe">
        {showVerificationModal && (
            <div className="fixed inset-0 z-[100] bg-black flex flex-col animate-fade-in">
                <div className="relative flex-1 w-full max-w-lg mx-auto flex items-center justify-center p-4">
                    {verificationLoading ? (
                        <div className="text-white flex flex-col items-center">
                            <Icon name="spinner" className="fa-spin text-4xl mb-4" />
                            <p>Verifying Identity...</p>
                        </div>
                    ) : (
                        <div className="w-full">
                            <h2 className="text-white text-center mb-4 font-bold text-xl">Verify Identity</h2>
                            <CameraCapture onCapture={handleVerification} mode="VERIFICATION" />
                        </div>
                    )}
                </div>
                <button onClick={() => setShowVerificationModal(false)} className="absolute top-6 right-6 text-white w-10 h-10 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-md z-50 hover:bg-white/20"><Icon name="times" /></button>
            </div>
        )}

        {showChatbot && <AIChatModal onClose={() => setShowChatbot(false)} />}

        {currentUser && !currentUser.verified && (
            <div onClick={() => setShowVerificationModal(true)} className="bg-orange-50/90 backdrop-blur-md border-b border-orange-100 p-3 text-center text-xs font-bold text-orange-800 uppercase tracking-wide flex items-center justify-center gap-2 sticky top-0 z-50 shadow-sm cursor-pointer hover:bg-orange-100 transition">
                <Icon name="shield-alt" /> Unverified - Tap to Verify
            </div>
        )}

        <main className="flex-1 w-full max-w-lg mx-auto p-4 md:p-6 pb-28 relative h-screen flex flex-col">
          {currentView === 'HOME' && <HomeScreen currentUser={currentUser!} onEventClick={(e: SocialEvent) => { setActiveEvent(e); setCurrentView('EVENT_DETAILS'); }} onCreateClick={() => setCurrentView('CREATE_EVENT')} onHostClick={openUserProfile} onVerify={() => setShowVerificationModal(true)} onOpenChat={() => setShowChatbot(true)} />}
          {currentView === 'CREATE_EVENT' && <CreateEventScreen currentUser={currentUser!} onCancel={() => setCurrentView('HOME')} onSuccess={() => setCurrentView('HOME')} onVerify={() => setShowVerificationModal(true)} />}
          {currentView === 'EVENT_DETAILS' && activeEvent && <EventDetailScreen event={activeEvent} currentUser={currentUser!} onBack={() => setCurrentView('HOME')} onHostClick={openUserProfile} onVerify={() => setShowVerificationModal(true)} />}
          {currentView === 'PROFILE' && <ProfileScreen user={currentUser!} onLogout={handleLogout} onBack={() => setCurrentView('HOME')} onVerify={() => setShowVerificationModal(true)} onEdit={() => setCurrentView('EDIT_PROFILE')} onPrivacy={() => setCurrentView('PRIVACY')} />}
          {currentView === 'PRIVACY' && <PrivacyScreen user={currentUser!} onBack={() => setCurrentView('PROFILE')} onLogout={handleLogout} onUpdateUser={setCurrentUser} onBlockedUsers={() => setCurrentView('BLOCKED_LIST')} />}
          {currentView === 'EDIT_PROFILE' && <EditProfileScreen user={currentUser!} onCancel={() => setCurrentView('PROFILE')} onSuccess={(u) => { setCurrentUser(u); setCurrentView('PROFILE'); }} />}
          {currentView === 'BLOCKED_LIST' && <BlockedUsersScreen currentUser={currentUser!} onBack={() => setCurrentView('PRIVACY')} onUpdate={(u) => setCurrentUser(u)} />}
          {currentView === 'USER_PROFILE' && targetUser && <PublicUserProfile currentUser={currentUser!} targetUser={targetUser} onBack={() => setCurrentView('HOME')} onMessage={async () => { const convo = await DB.startConversation(currentUser!, targetUser); setActiveConvo(convo); setCurrentView('CHAT_ROOM'); }} onVerify={() => setShowVerificationModal(true)} onBlockUpdate={(u: User) => setCurrentUser(u)} />}
          {currentView === 'MESSAGES' && <MessagesList currentUser={currentUser!} onSelectConvo={(c) => { setActiveConvo(c); setCurrentView('CHAT_ROOM'); }} />}
          {currentView === 'CHAT_ROOM' && activeConvo && <DirectChatRoom convo={activeConvo} currentUser={currentUser!} onBack={() => setCurrentView('MESSAGES')} onBlockUpdate={(u) => { setCurrentUser(u); setCurrentView('MESSAGES'); }} />}
          {currentView === 'ADMIN' && <AdminDashboard onBack={() => setCurrentView('HOME')} />}
        </main>
        <FloatingNav currentView={currentView} setView={setCurrentView} />
      </div>
    );
  };
  return renderView();
}

function HomeScreen({ currentUser, onEventClick, onCreateClick, onHostClick, onOpenChat }: any) {
  const [events, setEvents] = useState<SocialEvent[]>([]);
  const [viewMode, setViewMode] = useState<'LIST' | 'MAP'>('LIST');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState<'ALL' | 'TODAY' | 'UPCOMING'>('ALL');

  useEffect(() => { DB.getEvents(currentUser?._id).then(setEvents); }, [currentUser?._id]);

  const filteredEvents = events.filter(e => {
      const catMatch = categoryFilter === 'All' || e.category === categoryFilter || (!e.category && categoryFilter === 'All');
      const eventDate = new Date(e.dateTime);
      const today = new Date();
      const isToday = eventDate.getDate() === today.getDate() && eventDate.getMonth() === today.getMonth() && eventDate.getFullYear() === today.getFullYear();
      let dateMatch = true;
      if (dateFilter === 'TODAY') dateMatch = isToday;
      else if (dateFilter === 'UPCOMING') dateMatch = eventDate > today;
      return catMatch && dateMatch;
  });

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex justify-between items-center shrink-0">
          <h1 className="text-3xl font-black">Happening.</h1>
          <div className="flex gap-2">
            <button onClick={onCreateClick} className="w-10 h-10 bg-black text-white rounded-full flex items-center justify-center shadow-lg transform transition active:scale-95"><Icon name="plus" /></button>
            <button onClick={onOpenChat} className="w-10 h-10 bg-white border border-gray-100 text-black rounded-full flex items-center justify-center shadow-lg transform transition active:scale-95"><Icon name="robot" /></button>
          </div>
      </div>
      <div className="bg-gray-100 p-1 rounded-2xl flex shrink-0">
          {['ALL', 'TODAY', 'UPCOMING'].map(f => (
              <button key={f} onClick={() => setDateFilter(f as any)} className={`flex-1 py-2 text-xs font-bold rounded-xl transition ${dateFilter === f ? 'bg-white shadow-sm text-black' : 'text-gray-400'}`}>{f}</button>
          ))}
      </div>
      <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-2 shrink-0 pr-4 pl-1">
          <button onClick={() => setCategoryFilter('All')} className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition border ${categoryFilter === 'All' ? 'bg-black text-white border-black' : 'bg-white border-gray-100 text-gray-500 hover:border-gray-200'}`}>All</button>
          {CATEGORIES.map(cat => (
              <button key={cat} onClick={() => setCategoryFilter(cat)} className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition border ${categoryFilter === cat ? 'bg-black text-white border-black' : 'bg-white border-gray-100 text-gray-500 hover:border-gray-200'}`}>{cat}</button>
          ))}
      </div>
      <div className="flex justify-end shrink-0">
         <div className="flex bg-gray-100 rounded-full p-1">
            <button onClick={() => setViewMode('LIST')} className={`w-8 h-8 rounded-full flex items-center justify-center transition ${viewMode === 'LIST' ? 'bg-white shadow-sm text-black' : 'text-gray-400'}`}><Icon name="list" /></button>
            <button onClick={() => setViewMode('MAP')} className={`w-8 h-8 rounded-full flex items-center justify-center transition ${viewMode === 'MAP' ? 'bg-white shadow-sm text-black' : 'text-gray-400'}`}><Icon name="map" /></button>
         </div>
      </div>
      {viewMode === 'LIST' ? (
        <div className="grid gap-6 pb-20 overflow-y-auto">
            {filteredEvents.length === 0 ? <p className="text-gray-400 text-center py-10">No events found.</p> : (
                <>
                    {filteredEvents.map((event) => (
                        <div key={event._id} className="group bg-white rounded-3xl p-4 shadow-soft border border-white cursor-pointer overflow-hidden" onClick={() => onEventClick(event)}>
                        <div className="relative aspect-video rounded-2xl overflow-hidden mb-4">
                            <img src={event.imageURL} className="w-full h-full object-cover transition group-hover:scale-105" />
                            <div className="absolute top-3 right-3 bg-white/90 backdrop-blur px-3 py-1 rounded-full text-[10px] font-black shadow-sm">{new Date(event.dateTime).toDateString()}</div>
                            <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur px-3 py-1 rounded-full text-[10px] text-white font-bold shadow-sm">{event.category || 'General'}</div>
                        </div>
                        <h3 className="text-lg font-bold mb-1">{event.title}</h3>
                        <div className="flex items-center justify-between text-xs text-gray-500">
                            <span className="flex items-center gap-1"><Icon name="map-marker-alt" className="text-red-400"/> {event.location}</span>
                            <div className="flex items-center gap-2" onClick={(e) => { e.stopPropagation(); DB.getUserById(event.host._id).then(u => u && onHostClick(u)); }}>
                            <img src={event.host.photoURL} className="w-5 h-5 rounded-full object-cover" />
                            <span className="font-bold text-black">{event.host.name}</span>
                            </div>
                        </div>
                        </div>
                    ))}
                    <div className="py-8 text-center space-y-4">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto text-2xl animate-bounce">🎉</div>
                        <div><h3 className="font-bold text-lg">You're all caught up!</h3><p className="text-gray-500 text-xs max-w-[200px] mx-auto mt-1">No more events to show based on your filters. Why not start something new?</p></div>
                        <button onClick={onCreateClick} className="px-8 py-3 bg-black text-white rounded-2xl font-bold text-sm shadow-xl transform transition active:scale-95 hover:scale-105">Create an Event</button>
                    </div>
                </>
            )}
        </div>
      ) : (
          <div className="flex-1 w-full rounded-3xl overflow-hidden shadow-soft border border-gray-100 relative min-h-[300px]">
              <GoogleMap markers={filteredEvents.filter(e => e.coordinates).map(e => ({ lat: e.coordinates!.lat, lng: e.coordinates!.lng, title: e.title, id: e._id }))} onMapClick={() => {}} />
              <div className="absolute bottom-4 left-4 right-4 bg-white/90 backdrop-blur p-3 rounded-2xl text-xs text-center shadow-lg pointer-events-none z-[400]">Found {filteredEvents.length} events nearby</div>
          </div>
      )}
    </div>
  );
}

function CreateEventScreen({ currentUser, onCancel, onSuccess, onVerify }: any) {
    const [title, setTitle] = useState('');
    const [desc, setDesc] = useState('');
    const [loc, setLoc] = useState('');
    const [date, setDate] = useState('');
    const [category, setCategory] = useState(CATEGORIES[0]);
    const [coords, setCoords] = useState<{lat: number, lng: number} | null>(null);
    const [loading, setLoading] = useState(false);
    const [showMap, setShowMap] = useState(false);

    const handleSubmit = async () => {
        if(!currentUser.verified) return onVerify();
        if (!title || !desc || !loc || !date || !category) return alert("Fill all fields");
        setLoading(true);
        const mod = await moderateText(`${title} ${desc}`);
        if (mod.flagged) { alert(`Content restricted: ${mod.reason}`); setLoading(false); return; }
        
        if (coords) {
             try {
                await DB.createEvent({ title, description: desc, location: loc, dateTime: date, category }, currentUser, coords);
                onSuccess();
            } catch (e: any) { alert(e.message); }
            setLoading(false);
        } else {
            navigator.geolocation.getCurrentPosition(
                async (pos) => {
                    try {
                        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                        await DB.createEvent({ title, description: desc, location: loc, dateTime: date, category }, currentUser, c);
                        onSuccess();
                    } catch (e: any) { alert(e.message); }
                    setLoading(false);
                },
                () => { alert("Location required to verify you are in Raipur."); setLoading(false); }
            );
        }
    };

    return (
        <div className="animate-slide-up pb-20">
            {showMap && (
                <div className="fixed inset-0 z-[60] bg-black flex flex-col animate-fade-in">
                    <div className="relative flex-1">
                        <GoogleMap 
                            onMapClick={(lat, lng) => { setCoords({ lat, lng }); setShowMap(false); setLoc(`Pinned Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`); }} 
                            markers={coords ? [{...coords, title: "Selected"}] : []}
                        />
                         <div className="absolute top-4 left-0 right-0 text-center pointer-events-none z-[1000]">
                            <span className="bg-black/80 text-white text-xs px-4 py-2 rounded-full backdrop-blur-md">Tap to select location</span>
                        </div>
                    </div>
                    <button onClick={() => setShowMap(false)} className="absolute top-6 right-6 text-black bg-white w-10 h-10 flex items-center justify-center rounded-full shadow-lg z-[1000]"><Icon name="times" /></button>
                </div>
            )}
            <div className="flex items-center gap-4 mb-6"><button onClick={onCancel} className="w-10 h-10 bg-white rounded-full shadow-sm flex items-center justify-center"><Icon name="arrow-left" /></button><h2 className="text-2xl font-black">Post Meeting</h2></div>
            <div className="bg-white rounded-[2.5rem] p-8 space-y-4 shadow-soft">
                <input placeholder="What's happening?" className="w-full p-4 bg-gray-50 rounded-2xl outline-none font-bold" value={title} onChange={e=>setTitle(e.target.value)} />
                <textarea placeholder="Tell us more..." className="w-full p-4 bg-gray-50 rounded-2xl outline-none min-h-[120px]" value={desc} onChange={e=>setDesc(e.target.value)} />
                <div><label className="text-xs font-bold text-gray-400 uppercase ml-2 mb-1 block">Category</label><select className="w-full p-4 bg-gray-50 rounded-2xl outline-none appearance-none font-bold" value={category} onChange={e=>setCategory(e.target.value)}>{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                <div className="flex gap-2"><input placeholder="Landmark in Raipur" className="flex-1 p-4 bg-gray-50 rounded-2xl outline-none" value={loc} onChange={e=>setLoc(e.target.value)} /><button onClick={() => setShowMap(true)} className="w-14 bg-gray-100 rounded-2xl flex items-center justify-center text-gray-500 hover:bg-gray-200"><Icon name="map-marker-alt" /></button></div>
                <input type="datetime-local" className="w-full p-4 bg-gray-50 rounded-2xl outline-none font-medium text-gray-500" value={date} onChange={e=>setDate(e.target.value)} />
                <VerificationGate user={currentUser} fallback={<button onClick={onVerify} className="w-full py-4 bg-orange-100 text-orange-600 font-bold rounded-2xl">Verify to Post</button>}>
                    <button onClick={handleSubmit} disabled={loading} className="w-full py-4 bg-black text-white font-bold rounded-2xl shadow-xl">{loading ? 'Verifying...' : 'Create in Raipur'}</button>
                </VerificationGate>
            </div>
        </div>
    );
}

function EventDetailScreen({ event, currentUser, onBack, onHostClick, onVerify }: any) {
    const [joined, setJoined] = useState(event.participants.includes(currentUser._id));
    const handleJoin = async () => {
        if(!currentUser.verified) return onVerify();
        await DB.joinEvent(event._id, currentUser._id);
        setJoined(true);
    }
    return (
        <div className="animate-slide-up pb-20">
             <div className="relative h-80 -mx-6 -mt-6 rounded-b-[3rem] overflow-hidden shadow-lg mb-6">
                <img src={event.imageURL} className="w-full h-full object-cover" />
                <button onClick={onBack} className="absolute top-6 left-6 w-10 h-10 bg-white/20 text-white rounded-full flex items-center justify-center backdrop-blur-md"><Icon name="arrow-left" /></button>
                <div className="absolute bottom-6 left-6"><span className="bg-black/60 text-white backdrop-blur px-3 py-1 rounded-full text-xs font-bold shadow-sm mb-2 inline-block">{event.category || 'Event'}</span></div>
             </div>
             <div className="space-y-6">
                <h1 className="text-3xl font-black leading-tight">{event.title}</h1>
                <div className="flex items-center gap-2 text-gray-500 font-medium"><Icon name="map-marker-alt" /> {event.location}</div>
                <div className="flex items-center justify-between p-4 bg-white rounded-2xl shadow-sm border border-gray-100" onClick={() => onHostClick(event.host)}>
                    <div className="flex items-center gap-3"><img src={event.host.photoURL} className="w-12 h-12 rounded-full object-cover" /><div><div className="text-xs text-gray-400 font-bold uppercase">Hosted by</div><div className="font-bold">{event.host.name}</div></div></div>
                </div>
                <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100"><p className="text-gray-600 leading-relaxed">{event.description}</p></div>
                <div className="fixed bottom-6 left-6 right-6">
                    <VerificationGate user={currentUser} fallback={<button onClick={onVerify} className="w-full py-4 bg-orange-500 text-white font-bold rounded-2xl shadow-xl">Verify to Join</button>}>
                        <button onClick={handleJoin} disabled={joined} className={`w-full py-4 font-bold rounded-2xl shadow-xl transition ${joined ? 'bg-gray-100 text-gray-500' : 'bg-black text-white'}`}>{joined ? 'Joined' : 'Join Event'}</button>
                    </VerificationGate>
                </div>
             </div>
        </div>
    )
}

function ProfileScreen({ user, onLogout, onBack, onVerify, onEdit, onPrivacy }: any) {
    return (
        <div className="animate-slide-up">
             <div className="flex justify-between items-center mb-8">
                <button onClick={onBack} className="w-10 h-10 bg-white rounded-full shadow-sm flex items-center justify-center"><Icon name="arrow-left" /></button>
                <div className="flex gap-2">
                    <button onClick={onEdit} className="w-10 h-10 bg-white rounded-full shadow-sm flex items-center justify-center"><Icon name="pen" /></button>
                    <button onClick={onLogout} className="w-10 h-10 bg-red-50 text-red-500 rounded-full flex items-center justify-center"><Icon name="power-off" /></button>
                </div>
             </div>
             <div className="text-center mb-10">
                <div className="relative inline-block mb-4">
                    <img src={user.photoURL} className="w-32 h-32 rounded-full object-cover border-4 border-white shadow-2xl" />
                    <div className={`absolute bottom-0 right-0 w-8 h-8 rounded-full border-4 border-white flex items-center justify-center ${user.verified ? 'bg-emerald-500 text-white' : 'bg-orange-500 text-white'}`}><Icon name={user.verified ? "check" : "exclamation"} className="text-xs" /></div>
                </div>
                <h1 className="text-3xl font-black">{user.name}</h1>
                <div className="mt-2"><TrustBadge score={user.trustScore} /></div>
             </div>
             <div className="grid gap-3">
                 <button onClick={onPrivacy} className="flex items-center justify-between p-5 bg-white rounded-3xl border border-gray-100 font-bold group hover:border-black transition">
                    <div className="flex items-center gap-3"><Icon name="shield-alt" className="text-gray-400 group-hover:text-black"/> Privacy & Security</div>
                    <Icon name="chevron-right" className="text-gray-300"/>
                 </button>
                 <div className="mt-6 p-6 bg-orange-50 rounded-3xl border border-orange-100">
                    <div className="flex items-center gap-3 text-orange-800 font-black text-xs uppercase tracking-widest mb-2"><Icon name="exclamation-triangle" /> Performance Note</div>
                    <p className="text-orange-700 text-xs leading-relaxed">1 Missed Event = -20 Score.</p>
                 </div>
             </div>
        </div>
    );
}

function PublicUserProfile({ currentUser, targetUser, onBack, onMessage, onBlockUpdate }: any) {
    const [showReview, setShowReview] = useState(false);
    const [blocking, setBlocking] = useState(false);
    const isBlocked = currentUser.blockedUserIds?.includes(targetUser._id);
    const handleBlock = async () => {
        setBlocking(true);
        const updated = isBlocked ? await DB.unblockUser(currentUser._id, targetUser._id) : await DB.blockUser(currentUser._id, targetUser._id);
        onBlockUpdate(updated);
        setBlocking(false);
    };
    return (
        <div className="animate-slide-up pb-24">
             {showReview && <ReviewModal targetUser={targetUser} onClose={() => setShowReview(false)} onSuccess={() => { setShowReview(false); window.location.reload(); }} />}
             <div className="flex items-center justify-between mb-8">
                <button onClick={onBack} className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm"><Icon name="arrow-left" /></button>
                <div className="flex gap-2">
                    <button onClick={handleBlock} className="px-4 py-2 bg-red-50 text-red-600 rounded-full text-xs font-black uppercase">{blocking ? '...' : isBlocked ? 'Unblock' : 'Block'}</button>
                    {!isBlocked && <button onClick={onMessage} className="px-4 py-2 bg-black text-white rounded-full text-xs font-black uppercase">Message</button>}
                </div>
             </div>
             <div className="flex flex-col items-center text-center mb-10">
                <img src={targetUser.photoURL} className="w-28 h-28 rounded-full object-cover border-4 border-white shadow-xl mb-4" />
                <h1 className="text-3xl font-black mb-1">{targetUser.name}{(targetUser.privacySettings?.showAge ?? true) && `, ${targetUser.age}`}</h1>
                <div className="flex items-center gap-2 mb-4">
                    {(targetUser.privacySettings?.showGender ?? true) && targetUser.gender && <span className="bg-gray-100 text-gray-500 px-2 py-1 rounded-full text-[10px] font-bold uppercase">{targetUser.gender}</span>}
                    <TrustBadge score={targetUser.trustScore} />
                    {targetUser.verified && <span className="bg-blue-50 text-blue-600 px-2 py-1 rounded-full text-[10px] font-black uppercase">Verified</span>}
                </div>
                <p className="text-gray-500 max-w-xs">{targetUser.bio}</p>
             </div>
             <div className="bg-white rounded-[2.5rem] p-6 shadow-soft border border-white space-y-6">
                 <div className="flex justify-between items-center"><h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Community Feedback</h3><button onClick={() => setShowReview(true)} className="text-[10px] font-black text-blue-600 uppercase underline">Add Review</button></div>
                 <div className="space-y-4">
                    {targetUser.reviews?.length === 0 ? <p className="text-gray-400 text-sm">No reviews yet.</p> : targetUser.reviews?.map((r: any) => (
                        <div key={r._id} className="p-4 bg-gray-50 rounded-2xl">
                            <div className="flex justify-between items-center mb-2"><span className="font-bold text-xs">{r.reviewerName}</span><div className="flex text-yellow-400 text-[10px]">{[...Array(r.rating)].map((_, i) => <Icon key={i} name="star" />)}</div></div>
                            <p className="text-xs text-gray-600 italic">"{r.comment}"</p>
                        </div>
                     ))}
                 </div>
             </div>
        </div>
    );
}

function MessagesList({ currentUser, onSelectConvo }: any) {
    const [convos, setConvos] = useState<Conversation[]>([]);
    const [tab, setTab] = useState<'PRIMARY' | 'REQUESTS'>('PRIMARY');

    useEffect(() => { DB.getMyConversations(currentUser._id).then(setConvos); }, [currentUser._id]);
    
    const primaryConvos = convos.filter(c => c.status === 'ACCEPTED' || c.requesterId === currentUser._id);
    const requestConvos = convos.filter(c => c.status === 'PENDING' && c.requesterId !== currentUser._id);
    const displayConvos = tab === 'PRIMARY' ? primaryConvos : requestConvos;

    return (
        <div className="animate-slide-up">
            <h2 className="text-2xl font-black mb-6">Chat.</h2>
            <div className="flex gap-6 mb-6 border-b border-gray-100">
                <button onClick={() => setTab('PRIMARY')} className={`pb-2 text-sm font-bold ${tab === 'PRIMARY' ? 'text-black border-b-2 border-black' : 'text-gray-400'}`}>Primary</button>
                <button onClick={() => setTab('REQUESTS')} className={`pb-2 text-sm font-bold flex items-center gap-2 ${tab === 'REQUESTS' ? 'text-black border-b-2 border-black' : 'text-gray-400'}`}>Requests{requestConvos.length > 0 && <span className="w-2 h-2 bg-red-500 rounded-full"></span>}</button>
            </div>
            <div className="space-y-4">
                {displayConvos.length === 0 ? <p className="text-gray-400 text-center py-10">No messages in {tab.toLowerCase()}.</p> : displayConvos.map(c => {
                    const other = c.participants.find(p => p._id !== currentUser._id) || c.participants[0];
                    return (
                        <div key={c._id} onClick={() => onSelectConvo(c)} className="flex items-center gap-4 p-4 bg-white rounded-2xl shadow-soft cursor-pointer relative overflow-hidden">
                            {c.status === 'PENDING' && c.requesterId !== currentUser._id && <div className="absolute top-0 right-0 w-3 h-3 bg-blue-500 rounded-full m-3"></div>}
                            <img src={other.photoURL} className="w-12 h-12 rounded-full object-cover" />
                            <div><h4 className="font-bold">{other.name}</h4><p className="text-xs text-gray-500 line-clamp-1">{c.lastMessage || 'Started a conversation'}</p></div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function DirectChatRoom({ convo, currentUser, onBack, onBlockUpdate }: any) {
     const [messages, setMessages] = useState<ChatMessage[]>([]);
     const [text, setText] = useState('');
     const [localConvo, setLocalConvo] = useState(convo);

     const other = localConvo.participants.find((p: any) => p._id !== currentUser._id) || localConvo.participants[0];
     const isBlocked = currentUser.blockedUserIds?.includes(other._id);
     const isRequest = localConvo.status === 'PENDING' && localConvo.requesterId !== currentUser._id;

     useEffect(() => { DB.getMessages(localConvo._id).then(setMessages); }, [localConvo._id]);
     
     const send = async () => {
         if(!text.trim() || isBlocked) return;
         const mod = await moderateText(text);
         if (mod.flagged) { alert(`Message restricted: ${mod.reason}`); return; }
         await DB.sendMessage({ channelId: localConvo._id, sender: { _id: currentUser._id, name: currentUser.name }, message: text });
         setText('');
         DB.getMessages(localConvo._id).then(setMessages);
     };

     const handleAccept = async () => {
         const updated = await DB.acceptConversation(localConvo._id);
         setLocalConvo(updated);
     };

     const handleReject = async () => {
         await DB.rejectConversation(localConvo._id);
         onBack();
     };

     return (
         <div className="flex flex-col h-[80vh] animate-slide-up">
            <div className="flex items-center justify-between p-4 bg-white rounded-t-3xl border-b z-10">
                <div className="flex items-center gap-3"><button onClick={onBack}><Icon name="arrow-left" /></button><span className="font-bold">{other.name}</span></div>
                <button onClick={async () => { const u = await DB.blockUser(currentUser._id, other._id); onBlockUpdate(u); }} className="text-xs text-red-500 font-bold">Block</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 relative">
                {messages.map(m => (<div key={m._id} className={`flex ${m.sender._id === currentUser._id ? 'justify-end' : 'justify-start'}`}><div className={`p-3 rounded-2xl max-w-[80%] text-sm ${m.sender._id === currentUser._id ? 'bg-black text-white rounded-br-none' : 'bg-white shadow-sm rounded-bl-none'}`}>{m.message}</div></div>))}
                {isBlocked && <p className="text-center text-[10px] text-red-500 font-bold">Blocked. Unblock to continue chatting.</p>}
                {isRequest && (
                    <div className="absolute inset-x-0 bottom-0 p-6 bg-white/95 backdrop-blur-md border-t shadow-lg flex flex-col gap-3 items-center text-center">
                        <p className="text-sm font-bold text-gray-800">{other.name} wants to send you a message.</p>
                        <p className="text-xs text-gray-500">Do you want to accept this request?</p>
                        <div className="flex gap-4 w-full">
                            <button onClick={handleReject} className="flex-1 py-3 rounded-xl bg-gray-100 font-bold text-red-500">Delete</button>
                            <button onClick={handleAccept} className="flex-1 py-3 rounded-xl bg-black text-white font-bold">Accept</button>
                        </div>
                    </div>
                )}
            </div>
            {!isBlocked && !isRequest && (<div className="p-4 bg-white rounded-b-3xl border-t flex gap-2"><input className="flex-1 bg-gray-100 p-3 rounded-xl outline-none" value={text} onChange={e=>setText(e.target.value)} placeholder="Type..." /><button onClick={send} className="w-12 h-12 bg-black text-white rounded-xl"><Icon name="paper-plane"/></button></div>)}
         </div>
     );
}

function FloatingNav({ currentView, setView }: any) {
    if (['EVENT_DETAILS', 'CHAT_ROOM', 'CREATE_EVENT', 'USER_PROFILE', 'EDIT_PROFILE', 'PRIVACY'].includes(currentView)) return null;
    return (
        <div className="fixed bottom-6 left-0 right-0 flex justify-center px-6 z-50 pb-safe">
            <nav className="glass bg-white/80 backdrop-blur-xl border border-white/20 p-2 rounded-full shadow-float flex items-center justify-around w-full max-w-sm">
                <button onClick={() => setView('HOME')} className={`w-12 h-12 rounded-full flex items-center justify-center transition ${currentView === 'HOME' ? 'bg-black text-white' : 'text-gray-400 hover:text-black'}`}><Icon name="home"/></button>
                <button onClick={() => setView('MESSAGES')} className={`w-12 h-12 rounded-full flex items-center justify-center transition ${currentView === 'MESSAGES' ? 'bg-black text-white' : 'text-gray-400 hover:text-black'}`}><Icon name="comment-alt"/></button>
                <button onClick={() => setView('PROFILE')} className={`w-12 h-12 rounded-full flex items-center justify-center transition ${currentView === 'PROFILE' ? 'bg-black text-white' : 'text-gray-400 hover:text-black'}`}><Icon name="user"/></button>
            </nav>
        </div>
    );
}

function AIChatModal({ onClose }: any) {
    const [msg, setMsg] = useState('');
    const [history, setHistory] = useState<{role: string, parts: {text: string}[]}[]>([]);
    const [loading, setLoading] = useState(false);
    const handleSend = async () => {
        if (!msg.trim() || loading) return;
        const currentMsg = msg; setMsg(''); setLoading(true);
        const aiResponse = await getChatResponse(history, currentMsg);
        setHistory(prev => [...prev, { role: 'user', parts: [{ text: currentMsg }] }, { role: 'model', parts: [{ text: aiResponse || 'Connection issue.' }] }]);
        setLoading(false);
    };
    return (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur flex items-center justify-center p-6">
            <div className="bg-white w-full max-w-md rounded-[2.5rem] p-8 animate-scale-in flex flex-col h-[500px]">
                <div className="flex justify-between mb-4 flex-shrink-0"><h3 className="font-black">Raipur AI Guide</h3><button onClick={onClose}><Icon name="times"/></button></div>
                <div className="bg-gray-50 p-4 rounded-2xl text-sm mb-4 flex-1 overflow-y-auto space-y-3">
                    {history.length === 0 && <p className="text-gray-400 text-center italic py-10">Ask me about events in Raipur!</p>}
                    {history.map((h, i) => (<div key={i} className={`flex ${h.role === 'user' ? 'justify-end' : 'justify-start'}`}><div className={`p-3 rounded-2xl max-w-[85%] ${h.role === 'user' ? 'bg-black text-white rounded-br-none' : 'bg-white shadow-sm rounded-bl-none'}`}>{h.parts[0].text}</div></div>))}
                    {loading && <div className="text-gray-400 text-xs animate-pulse">Hangoutz AI is thinking...</div>}
                </div>
                <div className="flex gap-2 flex-shrink-0"><input className="flex-1 bg-gray-100 p-3 rounded-xl outline-none text-sm" value={msg} onChange={e=>setMsg(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} placeholder="Type message..." /><button onClick={handleSend} disabled={loading} className="w-12 h-12 bg-black text-white rounded-xl flex items-center justify-center"><Icon name="arrow-right"/></button></div>
            </div>
        </div>
    );
}

function EditProfileScreen({ user, onCancel, onSuccess }: any) {
    const [name, setName] = useState(user.name);
    const [bio, setBio] = useState(user.bio);
    const [photos, setPhotos] = useState<string[]>(user.photos || []);
    const [interests, setInterests] = useState<string[]>(user.interests || []);
    const [loading, setLoading] = useState(false);
    const [showCamera, setShowCamera] = useState(false);
    const handleSave = async () => {
        setLoading(true);
        const updated = await DB.updateUser(user._id, { name, bio, photos, interests });
        setLoading(false); onSuccess(updated);
    };
    const handleFileSelect = async (e: any) => { if (e.target.files?.[0]) setPhotos([...photos, await compressImage(e.target.files[0])]); }
    return (
        <div className="animate-slide-up pb-20">
             {showCamera && <div className="fixed inset-0 z-[60] bg-black flex flex-col animate-fade-in"><div className="relative flex-1 flex items-center justify-center"><CameraCapture onCapture={(img) => { setPhotos([...photos, img]); setShowCamera(false); }} mode="PHOTO" /></div><button onClick={() => setShowCamera(false)} className="absolute top-6 right-6 text-white w-10 h-10 flex items-center justify-center bg-white/10 rounded-full backdrop-blur-md z-50"><Icon name="times" /></button></div>}
             <div className="flex items-center gap-4 mb-6"><button onClick={onCancel} className="w-10 h-10 bg-white rounded-full shadow-sm flex items-center justify-center"><Icon name="arrow-left" /></button><h2 className="text-2xl font-black">Edit Profile</h2></div>
             <div className="bg-white rounded-[2.5rem] p-8 shadow-soft border border-white space-y-6">
                 <div>
                    <label className="text-xs font-bold text-secondary uppercase tracking-widest ml-1 mb-2 block">Photos</label>
                    <div className="flex gap-3 overflow-x-auto pb-4 hide-scrollbar px-1">{photos.map((p, i) => (<div key={i} className="relative w-20 h-24 shrink-0 rounded-2xl overflow-hidden"><img src={p} className="w-full h-full object-cover" /><button onClick={() => setPhotos(photos.filter((_, idx) => idx !== i))} className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px]"><Icon name="times"/></button></div>))}{photos.length < 5 && (<><label className="w-20 h-24 shrink-0 bg-subtle rounded-2xl flex flex-col items-center justify-center"><Icon name="image" /><input type="file" className="hidden" accept="image/*" onChange={handleFileSelect} /></label><button onClick={() => setShowCamera(true)} className="w-20 h-24 shrink-0 bg-subtle rounded-2xl flex flex-col items-center justify-center"><Icon name="camera" /></button></>)}</div>
                 </div>
                 <input className="w-full p-4 bg-gray-50 rounded-2xl outline-none" value={name} onChange={e => setName(e.target.value)} />
                 <textarea className="w-full p-4 bg-gray-50 rounded-2xl outline-none" value={bio} onChange={e => setBio(e.target.value)} />
                 <button onClick={handleSave} disabled={loading} className="w-full py-4 bg-black text-white rounded-2xl font-bold">{loading ? 'Saving...' : 'Save'}</button>
            </div>
        </div>
    )
}

function AdminDashboard({ onBack }: any) {
    const [users, setUsers] = useState<User[]>([]);
    useEffect(() => { DB.getAllUsers().then(setUsers); }, []);
    return (
        <div className="animate-slide-up pb-20">
             <div className="flex items-center gap-4 mb-6"><button onClick={onBack} className="w-10 h-10 bg-white rounded-full shadow-sm flex items-center justify-center"><Icon name="arrow-left" /></button><h2 className="text-2xl font-black">Admin</h2></div>
             <div className="space-y-4">{users.map(u => (<div key={u._id} className="flex justify-between items-center bg-white p-4 rounded-2xl"><div className="flex items-center gap-3"><img src={u.photoURL} className="w-10 h-10 rounded-full" /><div className="font-bold text-sm">{u.name}</div></div><span className={`text-xs font-bold ${u.verified ? 'text-green-500' : 'text-orange-500'}`}>{u.verified ? 'Verified' : 'Unverified'}</span></div>))}</div>
        </div>
    )
}

function AuthScreen({ onSuccess }: { onSuccess: (user: User) => void }) {
  const [step, setStep] = useState<'PHONE' | 'OTP' | 'PROFILE'>('PHONE');
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  
  // Profile State
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState<'Male' | 'Female' | ''>('');
  const [bio, setBio] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [verificationImage, setVerificationImage] = useState<string | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCamera, setShowCamera] = useState(false);
  const [firebaseUid, setFirebaseUid] = useState<string | null>(null);

  useEffect(() => {
    // 1. Cleanup existing instance first (prevent ghost verifiers)
    const initRecaptcha = () => {
        if (window.recaptchaVerifier) {
          try { window.recaptchaVerifier.clear(); } catch(e) {}
          window.recaptchaVerifier = null;
        }

        // 2. Wait for DOM
        const container = document.getElementById('recaptcha-container');
        if (container) {
            try {
                // 3. Initialize fresh instance
                window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
                    'size': 'invisible',
                    'callback': () => {
                        console.log("reCAPTCHA solved automatically");
                    }
                });
            } catch (e) {
                console.error("Recaptcha Init Error", e);
            }
        }
    };

    // Small delay to ensure DOM is ready in strict mode
    const timer = setTimeout(initRecaptcha, 500);

    return () => {
        clearTimeout(timer);
        try {
            if (window.recaptchaVerifier) window.recaptchaVerifier.clear();
        } catch (e) {}
        window.recaptchaVerifier = null;
    };
  }, []);

  const handlePhone = async () => {
    if (phone.length < 10) {
      setError("Enter a valid phone number");
      return;
    }
  
    try {
      setLoading(true);
      setError("");

      // --- FAILSAFE: Check if verifier exists, if not recreate it ---
      if (!window.recaptchaVerifier) {
          try {
             window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
                'size': 'invisible',
                'callback': () => console.log("reCAPTCHA solved")
             });
          } catch(e) {
             console.error("Recovery failed", e);
             setError("Please refresh the page.");
             setLoading(false);
             return;
          }
      }
  
      const phoneNumber = phone.startsWith("+") ? phone : `+91${phone}`;

      const result = await signInWithPhoneNumber(
        auth,
        phoneNumber,
        window.recaptchaVerifier
      );
  
      setConfirmation(result);
      setStep("OTP");
    } catch (err: any) {
      console.error("Phone Auth Error:", err);
      setError("Failed to send OTP. Try again.");
      
      // Force reset on error so user can click again
      if (window.recaptchaVerifier) {
          try { window.recaptchaVerifier.clear(); } catch(e){}
          window.recaptchaVerifier = null;
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOtp = async () => {
    if (!confirmation) {
      setError("OTP session expired. Try again.");
      return;
    }
    if (otp.length !== 6) {
      setError("Enter 6-digit code");
      return;
    }
  
    try {
      setLoading(true);
      setError("");
  
      const result = await confirmation.confirm(otp);
      const uid = result.user.uid;
      setFirebaseUid(uid);
  
      const user = await DB.loginWithFirebaseUid(uid, phone);
      
      if (user) {
        onSuccess(user);
      } else {
        setStep("PROFILE");
      }
  
    } catch (err) {
      console.error(err);
      setError("Invalid OTP. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!name || !dob || !gender) return setError('Fields required');
    if (calculateAge(dob) < 18) return setError('Must be 18+');
    if (photos.length === 0) return setError('Photo required');
    if (!firebaseUid) return setError("Authentication error. Please restart.");

    setLoading(true);
    const mod = await moderateText(bio);
    if (mod.flagged) { setLoading(false); return setError(`Bio flagged: ${mod.reason}`); }
    
    const user = await DB.signUpWithFirebaseUid({ 
        firebaseUid,
        name, 
        phone, 
        dob, 
        gender, 
        bio, 
        photos, 
        interests, 
        verificationPhotoURL: verificationImage || undefined 
    });
    
    onSuccess(user);
  };

  const handleFileSelect = async (e: any) => { if (e.target.files?.[0]) setPhotos([...photos, await compressImage(e.target.files[0])]); }
  const toggleInterest = (cat: string) => setInterests(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      {/* REQUIRED by Firebase: Invisible Recaptcha Container */}
      <div id="recaptcha-container"></div>

      <div className="w-full max-w-md animate-slide-up">
        {showCamera && <div className="fixed inset-0 z-[60] bg-black flex flex-col animate-fade-in"><div className="relative flex-1 flex items-center justify-center"><CameraCapture onCapture={(img) => { setPhotos([...photos, img]); setShowCamera(false); }} mode="PHOTO" /></div><button onClick={() => setShowCamera(false)} className="absolute top-6 right-6 text-white w-10 h-10 flex items-center justify-center bg-white/10 rounded-full backdrop-blur-md z-50"><Icon name="times" /></button></div>}
        
        <div className="text-center mb-10">
            <div className="w-16 h-16 bg-black rounded-2xl flex items-center justify-center text-white text-3xl mb-6 shadow-soft mx-auto rotate-3"><Icon name="layer-group" /></div>
            <h1 className="text-4xl font-extrabold tracking-tight text-primary mb-2">Hangoutz.</h1>
            <p className="text-secondary font-medium uppercase text-xs tracking-widest">Raipur Community Only</p>
        </div>
        
        <div className="bg-white p-8 rounded-[2rem] shadow-soft border border-white">
            {error && <div className="p-3 bg-red-50 text-red-600 rounded-xl text-xs font-bold mb-6 text-center">{error}</div>}
            
            {step === 'PHONE' ? (
                <div className="space-y-6 animate-fade-in">
                    <div>
                        <label className="text-xs font-bold text-secondary uppercase tracking-widest ml-1 mb-2 block">Phone Number</label>
                        <input type="tel" placeholder="+91" className="w-full px-6 py-4 bg-subtle rounded-2xl input-field outline-none font-medium text-lg" value={phone} onChange={e => setPhone(e.target.value)} autoFocus />
                    </div>
                    <button onClick={handlePhone} disabled={loading} className="w-full py-4 bg-black text-white rounded-2xl font-bold text-lg shadow-lg hover:scale-[1.02] transition-all disabled:opacity-50">
                        {loading ? <Icon name="spinner" className="fa-spin" /> : 'Send Code'}
                    </button>
                </div>
            ) : step === 'OTP' ? (
                <div className="space-y-6 animate-fade-in">
                    <div className="text-center mb-2"><p className="text-secondary text-sm">Sent to <strong>{phone}</strong></p></div>
                    <input type="text" maxLength={6} placeholder="123456" className="w-full px-6 py-4 bg-subtle rounded-2xl input-field outline-none font-bold text-2xl text-center tracking-[0.5em]" value={otp} onChange={e => setOtp(e.target.value)} autoFocus />
                    <button onClick={handleOtp} disabled={loading} className="w-full py-4 bg-black text-white rounded-2xl font-bold text-lg shadow-lg hover:scale-[1.02] transition-all disabled:opacity-50">
                        {loading ? <Icon name="spinner" className="fa-spin" /> : 'Verify'}
                    </button>
                </div>
            ) : (
                <div className="space-y-8 animate-fade-in">
                    <div>
                        <div className="flex justify-between items-end mb-3"><label className="text-xs font-bold text-secondary uppercase tracking-widest ml-1 block">Photos ({photos.length}/5)</label></div>
                        <div className="flex gap-3 overflow-x-auto pb-4 hide-scrollbar px-1">
                            {photos.map((p, i) => (<div key={i} className="relative w-20 h-24 shrink-0 rounded-2xl overflow-hidden"><img src={p} className="w-full h-full object-cover" /></div>))}
                            {photos.length < 5 && (<><label className="w-20 h-24 shrink-0 bg-subtle rounded-2xl flex flex-col items-center justify-center"><Icon name="image" /><input type="file" className="hidden" accept="image/*" onChange={handleFileSelect} /></label><button onClick={() => setShowCamera(true)} className="w-20 h-24 shrink-0 bg-subtle rounded-2xl flex flex-col items-center justify-center"><Icon name="camera" /></button></>)}
                        </div>
                    </div>
                    <div className="space-y-4">
                        <input type="text" placeholder="Full Name" className="w-full px-6 py-4 bg-subtle rounded-2xl input-field outline-none font-medium" value={name} onChange={e => setName(e.target.value)} />
                        <div className="flex gap-4"><input type="date" className="flex-1 px-6 py-4 bg-subtle rounded-2xl input-field outline-none" value={dob} onChange={e => setDob(e.target.value)} /><select className="flex-1 px-4 py-4 bg-subtle rounded-2xl input-field outline-none" value={gender} onChange={e => setGender(e.target.value as any)}><option value="">Gender</option><option value="Male">Male</option><option value="Female">Female</option></select></div>
                        <textarea placeholder="Your bio..." className="w-full px-6 py-4 bg-subtle rounded-2xl input-field outline-none font-medium min-h-[100px]" value={bio} onChange={e => setBio(e.target.value)} />
                        <div><label className="text-xs font-bold text-secondary uppercase tracking-widest ml-1 mb-2 block">Interests</label><div className="flex flex-wrap gap-2">{CATEGORIES.map(cat => (<button key={cat} onClick={() => toggleInterest(cat)} className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${interests.includes(cat) ? 'bg-black text-white' : 'bg-white text-gray-500'}`}>{cat}</button>))}</div></div>
                    </div>
                    <div className="bg-gray-50 border border-gray-100 p-5 rounded-3xl">
                        <div className="flex justify-between items-center mb-2 px-1"><span className="text-xs font-bold text-black uppercase tracking-widest flex items-center gap-1"><Icon name="shield-alt" /> Verification (Optional)</span></div>
                        {verificationImage ? <div className="text-green-500 font-bold text-xs text-center p-4 border-2 border-green-500 rounded-xl">Photo Captured</div> : <CameraCapture onCapture={setVerificationImage} mode="VERIFICATION" />}
                    </div>
                    <button onClick={handleRegister} disabled={loading} className="w-full py-4 bg-black text-white rounded-2xl font-bold text-lg shadow-lg hover:scale-[1.02] transition-all">{loading ? <Icon name="spinner" className="fa-spin" /> : 'Create Account'}</button>
                </div>
            )}
        </div>
      </div>
    </div>
  );
}