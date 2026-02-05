import "dotenv/config";
import app from "./app";
import connectDB from "./config/db";
 // adjust path if db.ts is in a folder

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

const startServer = async (): Promise<void> => {
  try {
    await connectDB(); // 🔴 THIS is what actually connects MongoDB

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("❌ Server failed to start:", error);
    process.exit(1);
  }
};

startServer();
