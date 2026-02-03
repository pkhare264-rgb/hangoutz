// services/ai.ts (or whatever this file is named)
// AI FEATURES TEMPORARILY DISABLED FOR MVP
// This stub prevents browser crashes caused by server-only Gemini SDK

export interface ModerationResult {
  flagged: boolean;
  reason?: string;
}

/**
 * Text moderation stub
 * Always allows content for MVP
 */
export const moderateText = async (
  _text: string
): Promise<ModerationResult> => {
  return {
    flagged: false,
  };
};

/**
 * AI chatbot stub
 */
export const getChatResponse = async (
  _history?: any,
  _message?: string
): Promise<string> => {
  return "Hangoutz AI is temporarily unavailable.";
};

/**
 * AI place suggestion stub
 */
export const findPlacesWithAI = async (
  _query?: string,
  _location?: { lat: number; lng: number }
): Promise<{ text: string; chunks: any[] }> => {
  return {
    text: "AI place suggestions are currently disabled.",
    chunks: [],
  };
};
