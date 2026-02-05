import express, { Application, Request, Response } from "express";
import cors from "cors";

// IMPORT ROUTES
import authRoutes from "./routes/auth.routes";
import eventRoutes from "./routes/event.routes"; // <--- 1. Import the new Event routes

const app: Application = express();

// Middlewares
app.use(cors());
app.use(express.json());

// USE ROUTES
app.use("/auth", authRoutes);
app.use("/events", eventRoutes); // <--- 2. Wire them to the "/events" URL

// Health check (important for deployment)
app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({ status: "ok" });
});

export default app;