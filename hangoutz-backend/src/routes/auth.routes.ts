import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import User from "../models/user";
// Make sure you created the config/firebase.ts file I gave you earlier!
import { verifyToken } from "../config/firebase"; 

const router = Router();

// --- LOGIN ROUTE ---
// 1. Receives a Firebase Token (Proof of ID)
// 2. Checks if the user exists in MongoDB
// 3. Returns a Session Token OR 404 (User needs to Signup)
router.post("/login", async (req: Request, res: Response): Promise<any> => {
  try {
    const { firebaseToken } = req.body;

    if (!firebaseToken) {
      return res.status(400).json({ error: "Token required" });
    }

    // VERIFY: Ask Firebase "Is this token real?"
    const decoded = await verifyToken(firebaseToken);
    if (!decoded) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    // CHECK DB: Do we have this user?
    const user = await User.findOne({ firebaseUid: decoded.uid });

    if (!user) {
      // 404 means: "Valid phone number, but no profile yet. Go to Signup."
      return res.status(404).json({ message: "User not found" });
    }

    // SUCCESS: Issue backend token
    const token = jwt.sign(
      { id: user._id, uid: user.firebaseUid },
      process.env.JWT_SECRET as string,
      { expiresIn: "30d" }
    );

    return res.json({ token, user });
  } catch (error) {
    console.error("Login Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// --- SIGNUP ROUTE ---
// 1. Receives Firebase Token + Profile Data
// 2. Creates the User in MongoDB
// 3. Returns Session Token
router.post("/signup", async (req: Request, res: Response): Promise<any> => {
  try {
    const { firebaseToken, name, dob, gender, bio, photos, interests } = req.body;

    // VERIFY: Security check again
    const decoded = await verifyToken(firebaseToken);
    if (!decoded) {
      return res.status(401).json({ error: "Invalid Token" });
    }

    // DOUBLE CHECK: Does user already exist?
    let existingUser = await User.findOne({ firebaseUid: decoded.uid });
    if (existingUser) {
      return res.status(400).json({ error: "User already exists" });
    }

    // CREATE: Save all the profile fields
    const user = await User.create({
      firebaseUid: decoded.uid,
      phone: decoded.phone_number || "",
      name,
      dob,
      gender,
      bio,
      photos,     // Now saving the array of photos
      interests,  // Now saving interests
      verified: false,
      trustScore: 50
    });

    // SUCCESS: Issue backend token
    const token = jwt.sign(
      { id: user._id, uid: user.firebaseUid },
      process.env.JWT_SECRET as string,
      { expiresIn: "30d" }
    );

    return res.json({ token, user });

  } catch (error) {
    console.error("Signup Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;