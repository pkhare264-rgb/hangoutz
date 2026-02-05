import express, { Application, Request, Response } from "express";
import cors from "cors";

import authRoutes from "./routes/auth.routes";

const app: Application = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Routes
app.use("/auth", authRoutes);

// Health check (important for deployment)
app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({ status: "ok" });
});

export default app;
