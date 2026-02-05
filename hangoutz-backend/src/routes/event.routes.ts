import { Router } from "express";
import authMiddleware from "../middleware/auth.middleware";
import { faceRequired } from "../middleware/faceRequired.middleware";

const router = Router();

router.post("/create", authMiddleware, faceRequired, (req, res) => {
  res.json({ success: true, message: "Event created" });
});

router.post("/join", authMiddleware, faceRequired, (req, res) => {
  res.json({ success: true, message: "Joined event" });
});

export default router;
