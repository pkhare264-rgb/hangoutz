import * as admin from 'firebase-admin';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

// Try to load the service account file
try {
  // You must put 'firebase-service-account.json' in your root folder
  const serviceAccount = require(path.resolve(__dirname, '../../firebase-service-account.json'));
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log("✅ Firebase Admin Initialized");
} catch (error) {
  console.error("❌ Firebase Admin Init Failed. Missing 'firebase-service-account.json' in root?", error);
}

export const verifyToken = async (token: string) => {
  try {
    return await admin.auth().verifyIdToken(token);
  } catch (error) {
    console.error("Token verification failed:", error);
    return null;
  }
};