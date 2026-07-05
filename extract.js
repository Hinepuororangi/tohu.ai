// api/extract.js — Vercel serverless function
// Reads hui minutes (PDF or photo) with Claude and returns draft resolutions + actions.
// API key lives in Vercel env var ANTHROPIC_API_KEY — never in client code.

export const config = { api: { bodyParser: { sizeLimit: "10mb" } } };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(500).json({ error: "ANTHROPIC_API_KEY not set in Vercel env vars" });

  const { fileBase64, mediaType, trustees } = req.body || {};
  if (!fileBase64 || !mediaType) return res.status(400).json({ error: "fileBase64 and mediaType required" });

  const isPdf = mediaType === "application/pdf";
  const block = isPdf
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: fileBase64 } }
    : { type: "image", source: { type: "base64", media_type: mediaType, data: fileBase64 } };

  const prompt = `These are minutes from a marae trust hui. Extract every resolution (decision made) and every action item (task assigned to someone).

Trustees for assignment matching: ${(trustees || []).map(t => `${t.name} (id: ${t.id})`).join(", ")}

Respond ONLY with JSON, no markdown fences, in exactly this shape:
{
  "resolutions": [{ "title": "...", "description": "...", "status": "Open" }],
  "actions": [{ "title": "...", "assigned_to": "<trustee id or empty string>", "due_date": "<YYYY-MM-DD or empty string>", "status": "Not Started", "notes": "" }]
}
Match assigned_to to a trustee id ONLY when the minutes clearly name that person; otherwise leave it "". Keep titles short; put detail in description/notes. If handwriting is unclear, extract what you can and note uncertainty in the description.`;

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 3000,
        messages: [{ role: "user", content: [block, { type: "text", text: prompt }] }],
      }),
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data.error?.message || "Anthropic API error" });

    const text = (data.content || []).map(c => c.text || "").join("");
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    return res.status(200).json(parsed);
  } catch (e) {
    return res.status(500).json({ error: "Extraction failed: " + e.message });
  }
}
