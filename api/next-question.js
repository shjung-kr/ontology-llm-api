export default async function handler(req, res) {
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

    // 안전장치
    if (!Array.isArray(allowedFeatures) || allowedFeatures.length === 0) {
      return res.status(400).json({ error: "allowedFeatures required" });
    }

    // 프롬프트 (JSON 강제)
    const prompt = `
You are generating the NEXT best yes/no question for a 20-questions game.

STRICT RULES:
- Output ONLY a valid JSON object
- Do NOT add any explanation or text
- JSON format EXACTLY:
{
  "questionText": string,
  "feature": string
}

Constraints so far:
${JSON.stringify(constraints, null, 2)}

Already asked features:
${askedFeatures.join(", ")}

Allowed feature list:
${allowedFeatures.map(f => `- ${f}`).join("\n")}

Language: ${language}
`;

    // OpenAI 호출
    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
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

    const rawText = await openaiRes.text();

    if (!openaiRes.ok) {
      return res.status(500).send(`OpenAI error: ${rawText}`);
    }

    // JSON 추출기 (모델이 말 섞어도 대비)
    const parsedOuter = JSON.parse(rawText);
    const content = parsedOuter?.choices?.[0]?.message?.content ?? "";

    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");
    if (start === -1 || end === -1) {
      return res.status(500).send(`Model returned non-JSON: ${content}`);
    }

    const jsonOnly = content.slice(start, end + 1);

    let result;
    try {
      result = JSON.parse(jsonOnly);
    } catch {
      return res.status(500).send(`Invalid JSON from model: ${jsonOnly}`);
    }

    if (!result.questionText || !result.feature) {
      return res.status(500).send(`Incomplete JSON: ${jsonOnly}`);
    }

    return res.status(200).json(result);

  } catch (e) {
    return res.status(500).send(`Server error: ${e.message}`);
  }
}
