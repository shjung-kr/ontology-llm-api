export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      constraints = [],
      askedFeatures = [],
      allowedFeatures = [],
      language = "ko"
    } = req.body || {};

    const prompt = `
You are generating the next best yes/no question for a 20-questions game.

Rules:
- Output MUST be valid JSON
- JSON shape:
  {
    "questionText": string,
    "feature": string
  }
- feature MUST be one of:
${allowedFeatures.map(f => `- ${f}`).join("\n")}
- Do NOT repeat features already asked:
${askedFeatures.join(", ")}

Current constraints:
${JSON.stringify(constraints, null, 2)}

Language: ${language}
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

    const text = await r.text();

    if (!r.ok) {
      return res.status(500).send(`OpenAI error: ${text}`);
    }

    let parsed;
    try {
      parsed = JSON.parse(JSON.parse(text).choices[0].message.content);
    } catch {
      return res.status(500).send("Model returned non-JSON");
    }

    if (!parsed.questionText || !parsed.feature) {
      return res.status(500).send("Invalid LLM response");
    }

    return res.status(200).json(parsed);

  } catch (e) {
    return res.status(500).send(e.message);
  }
}
