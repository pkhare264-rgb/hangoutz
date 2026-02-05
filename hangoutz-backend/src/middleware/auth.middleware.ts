import { Request, Response, NextFunction } from "express";
import User from "../models/user";

const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Example placeholder logic
    // const token = req.headers.authorization;

    // if (!token) {
    //   res.status(401).json({ message: "Unauthorized" });
    //   return;
    // }

    // const user = await User.findOne({ token });
    // if (!user) {
    //   res.status(401).json({ message: "Invalid user" });
    //   return;
    // }

    next();
  } catch (error) {
    res.status(500).json({ message: "Auth middleware error" });
  }
};

export default authMiddleware;
