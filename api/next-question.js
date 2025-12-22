export default async function handler(req, res) {

  // ✅ CORS 헤더 (가장 중요)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // ✅ Preflight 요청 처리
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { intent, language = "ko" } = req.body || {};

    if (!intent || !intent.type) {
      return res.status(400).json({ error: "Missing intent" });
    }

    let instruction = "";

    if (intent.type === "FEATURE") {
      instruction = `Determine whether the target has the feature "${intent.feature}".`;
    }

    if (intent.type === "LITERAL") {
      instruction = `Determine whether the target's "${intent.property}" equals "${intent.value}".`;
    }

    if (!instruction) {
      return res.status(400).json({ error: "Unsupported intent type" });
    }

    const prompt = `
You generate a single yes/no question for a POR ontology engine.

Rules:
- Output ONLY valid JSON
- JSON format:
{
  "questionText": string
}
- No explanations
- Language: ${language}

${instruction}
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

    if (!parsed.questionText) {
      return res.status(500).send("Invalid LLM response");
    }

    return res.status(200).json(parsed);

  } catch (e) {
    return res.status(500).send(e.message);
  }
}
