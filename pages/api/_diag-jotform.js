export default function handler(req, res) {
  const apiKey = process.env.JOTFORM_API_KEY || "";
  const API = process.env.JOTFORM_API || "https://api.jotform.com";
  const WEB = process.env.JOTFORM_WEB || "https://www.jotform.com";

  res.status(200).json({
    hasApiKey: apiKey.length > 8,
    apiKeyLen: apiKey.length,
    apiBase: API,
    webBase: WEB,
    nodeEnv: process.env.NODE_ENV,
  });
}
