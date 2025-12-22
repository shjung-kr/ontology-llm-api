export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { text } = req.body || {};
    if (!text) {
      return res.status(400).json({ error: "Missing text" });
    }

    const prompt = `
You are an ontology-mapping assistant for POR (Proofence Ontology Reasoner).

Return ONLY valid JSON in this schema:
{
  "features": string[],
  "literals": {
    "property": string,
    "value": string
  }[],
  "classes": string[],
  "confidence": number
}

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
        messages: [{ role: "user", content: prompt }],
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
    } catch {
      return res.status(500).send("Model returned non-JSON");
    }

    // 최소 스키마 검증
    if (
      !Array.isArray(parsed.features) ||
      !Array.isArray(parsed.literals) ||
      !Array.isArray(parsed.classes)
    ) {
      return res.status(500).send("Invalid mapping schema");
    }

    return res.status(200).json(parsed);

  } catch (e) {
    return res.status(500).send(e.message);
  }
}
