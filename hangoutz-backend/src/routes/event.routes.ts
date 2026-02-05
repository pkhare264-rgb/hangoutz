import { Router, Request, Response } from "express";
import Event from "../models/event";
import jwt from "jsonwebtoken";

const router = Router();

// MIDDLEWARE: Verify Token
// This ensures only logged-in users can create or join events
const authenticate = (req: any, res: Response, next: any) => {
  const token = req.header("Authorization")?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Access denied" });

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET as string);
    req.user = verified;
    next();
  } catch (err) {
    res.status(400).json({ error: "Invalid Token" });
  }
};

// 1. GET ALL EVENTS
router.get("/", async (req: Request, res: Response) => {
  try {
    // We populate 'host' to get the creator's name and photo
    const events = await Event.find().populate("host", "name photos verified trustScore").sort({ dateTime: 1 });
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch events" });
  }
});

// 2. CREATE EVENT
router.post("/create", authenticate, async (req: any, res: Response) => {
  try {
    const { title, description, location, dateTime, category, coordinates, imageURL } = req.body;
    
    // Create new event linked to the logged-in user (req.user.id)
    const newEvent = await Event.create({
      title,
      description,
      location,
      dateTime,
      category,
      coordinates,
      imageURL,
      host: req.user.id, 
      participants: [req.user.id] // Host joins automatically
    });

    res.json(newEvent);
  } catch (err) {
    console.error("Create Event Error:", err);
    res.status(500).json({ error: "Failed to create event" });
  }
});

// 3. JOIN EVENT
router.post("/:id/join", authenticate, async (req: any, res: Response): Promise<any> => {
    try {
        const event = await Event.findById(req.params.id);
        if (!event) return res.status(404).json({ error: "Event not found" });

        // Check if already joined
        if (event.participants.includes(req.user.id)) {
            return res.status(400).json({ error: "Already joined" });
        }

        event.participants.push(req.user.id);
        await event.save();

        res.json({ message: "Joined successfully", event });
    } catch (err) {
        res.status(500).json({ error: "Failed to join event" });
    }
});

export default router;