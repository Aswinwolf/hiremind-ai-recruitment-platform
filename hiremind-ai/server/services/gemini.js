const { geminiModel } = require("../config/gemini");
const logger = require("../config/logger");

const FORBIDDEN_OUT = [
  /api[_\s-]?key/i,
  /AIza[0-9A-Za-z\-_]{20,}/,
  /sk-[a-zA-Z0-9]{20,}/,
  /BEGIN (RSA|OPENSSH) PRIVATE KEY/,
  /mongodb\+srv:\/\//i,
];

function sanitizeOut(text) {
  let t = String(text || "");
  for (const re of FORBIDDEN_OUT) t = t.replace(re, "[REDACTED]");
  return t;
}

async function callJSON(prompt, { maxOutputTokens = 1024, fallback = null } = {}) {
  try {
    const r = await geminiModel.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens, temperature: 0.7, topK: 40, topP: 0.95 },
    });
    const text = sanitizeOut(r.response.text())
      .trim()
      .replace(/```json|```/g, "")
      .trim();
    return JSON.parse(text);
  } catch (e) {
    logger.error("Gemini callJSON failed: " + e.message);
    return fallback;
  }
}

async function callText(prompt, { maxOutputTokens = 512 } = {}) {
  try {
    const r = await geminiModel.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens, temperature: 0.7, topK: 40, topP: 0.95 },
    });
    return sanitizeOut(r.response.text()).trim();
  } catch (e) {
    logger.error("Gemini callText failed: " + e.message);
    return "";
  }
}

module.exports = { callJSON, callText, sanitizeOut };
