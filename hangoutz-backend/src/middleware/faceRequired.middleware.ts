import { Request, Response, NextFunction } from "express";

export const faceRequired = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    // Example placeholder check
    // if (!req.body.faceVerified) {
    //   res.status(403).json({ message: "Face verification required" });
    //   return;
    // }

    next();
  } catch (error) {
    res.status(500).json({ message: "Face verification middleware error" });
  }
};
