export default async function handler(req, res) {
  // ✅ CORS 헤더 (필요하면 "*" 대신 너 도메인으로 제한 가능)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // ✅ 프리플라이트 요청 처리
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  // POST만 허용
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

    if (!Array.isArray(allowedFeatures) || allowedFeatures.length === 0) {
      return res.status(400).json({ error: "allowedFeatures required" });
    }

    const prompt = `
Return ONLY a valid JSON object. Do not include any extra text.

JSON format:
{
  "questionText": string,
  "feature": string
}

Constraints:
${JSON.stringify(constraints, null, 2)}

Already asked:
${askedFeatures.join(", ")}

Allowed feature list:
${allowedFeatures.map(f => `- ${f}`).join("\n")}

Language: ${language}
`;

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2
      })
    });

    const rawText = await openaiRes.text();

    if (!openaiRes.ok) {
      return res.status(500).send(`OpenAI error: ${rawText}`);
    }

    const parsedOuter = JSON.parse(rawText);
    const content = parsedOuter?.choices?.[0]?.message?.content ?? "";

    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");
    if (start === -1 || end === -1) {
      return res.status(500).send(`Model returned non-JSON: ${content}`);
    }

    const jsonOnly = content.slice(start, end + 1);
    const result = JSON.parse(jsonOnly);

    if (!result.questionText || !result.feature) {
      return res.status(500).send(`Incomplete JSON: ${jsonOnly}`);
    }

    return res.status(200).json(result);
  } catch (e) {
    return res.status(500).send(`Server error: ${e.message}`);
  }
}
