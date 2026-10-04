import { pathToFileURL } from "url";

export async function askGemma(prompt, model = process.env.GEMMA_MODEL || "gemma4") {
  const res = await fetch("http://localhost:11434/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt,
      format: "json",
      stream: true,          // words arrive as they're written, so no 300s timeout
      think: false,          // skip hidden reasoning: much faster
      keep_alive: "30m",     // stay loaded between requests
      options: { num_ctx: 8192, temperature: 0.7 },
    }),
  });
  if (!res.ok) throw new Error(`Ollama error ${res.status}: ${await res.text()}`);

  // Ollama streams one JSON object per line
  const decoder = new TextDecoder();
  let buf = "", text = "", chars = 0;
  for await (const chunk of res.body) {
    buf += decoder.decode(chunk, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop();
    for (const line of lines) {
      if (!line.trim()) continue;
      const msg = JSON.parse(line);
      if (msg.error) throw new Error(msg.error);
      text += msg.response || "";
      if ((chars += (msg.response || "").length) > 200) { process.stdout.write("."); chars = 0; }
    }
  }
  process.stdout.write("\n");
  return JSON.parse(text);
}

// quick test: node src/gemma.js
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const t = Date.now();
  const out = await askGemma('Return JSON: {"places": [3 hill destinations within 8 hours of Delhi]}');
  console.log(out, `\n${((Date.now() - t) / 1000).toFixed(0)}s`);
}
