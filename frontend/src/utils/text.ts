// src/utils/text.ts
export function stripInlineCitations(text: string): string {
  if (!text) return "";
  // Removes patterns like: [Doc#1 chunk 0], [Doc#12 chunk 3]
  return text.replace(/\s*\[Doc#\d+\s+chunk\s+\d+\]\s*/g, " ").replace(/\s+/g, " ").trim();
}
