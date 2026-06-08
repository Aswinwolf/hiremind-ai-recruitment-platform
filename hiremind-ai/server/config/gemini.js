const { GoogleGenerativeAI } = require("@google/generative-ai");

if (!process.env.GEMINI_API_KEY) {
  console.warn("GEMINI_API_KEY not set — interview AI calls will fail until configured.");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "missing");

const geminiModel = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
  generationConfig: {
    temperature: 0.7,
    topK: 40,
    topP: 0.95,
    maxOutputTokens: 1024,
  },
});

module.exports = { geminiModel, genAI };
