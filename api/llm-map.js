export default async function handler(req, res) {

  // ✅ CORS 헤더 (가장 중요)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }


  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { text } = req.body || {};

    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "Missing or invalid text" });
    }

    const prompt = `
You are an ontology-mapping assistant for POR (Proofence Ontology Reasoner).

Your task:
- Extract ontology-relevant information from user input
- DO NOT reason or infer beyond the text
- DO NOT guess missing information
- ONLY map what is clearly implied

Return ONLY valid JSON in the following schema:

{
  "features": string[],
  "literals": {
    "property": string,
    "value": string
  }[],
  "classes": string[],
  "confidence": number
}

Rules:
- features: boolean-like properties (e.g. "isLiving", "isAnimal", "canBePet")
- literals: concrete values (sound, color, size, material, etc.)
- classes: conceptual categories if explicitly implied
- confidence: 0.0 ~ 1.0 (how confident you are in the mapping)
- If nothing is found, return empty arrays with low confidence
- NO extra text, NO markdown, JSON ONLY

User input:
"""
${text}
"""
`;

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a strict JSON generator. Never include explanations or formatting."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.2
      })
    });

    const raw = await r.text();

    if (!r.ok) {
      return res.status(500).send(raw);
    }

    let parsed;
    try {
      parsed = JSON.parse(JSON.parse(raw).choices[0].message.content);
    } catch (e) {
      return res.status(500).send("Model returned non-JSON");
    }

    // 최소 스키마 검증
    if (
      !parsed ||
      !Array.isArray(parsed.features) ||
      !Array.isArray(parsed.literals) ||
      !Array.isArray(parsed.classes) ||
      typeof parsed.confidence !== "number"
    ) {
      return res.status(500).send("Invalid mapping schema");
    }

    return res.status(200).json(parsed);

  } catch (e) {
    return res.status(500).send(e.message);
  }
}
