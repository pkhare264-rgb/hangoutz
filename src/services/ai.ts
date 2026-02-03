// src/services/ai.ts
export async function moderateText(text: string): Promise<{ flagged: boolean; reason?: string }> {
  return { flagged: false };
}

export async function getChatResponse(
  history: { role: string; parts: { text: string }[] }[],
  message: string
): Promise<string> {
  return "AI features will be enabled soon.";
}

export async function findPlacesWithAI(query: string) {
  return { text: "", chunks: [] };
}