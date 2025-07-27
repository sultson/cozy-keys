import express from "npm:express";
const app = express();
// CORS middleware
app.use((req, res, next)=>{
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "*");
  if (req.method === "OPTIONS") {
    res.sendStatus(200);
  } else {
    next();
  }
});
app.get("/cora/conversation-token", async (req, res)=>{
  const agentId = Deno.env.get("ELEVENLABS_AGENT_ID");
  const response = await fetch(`https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${agentId}`, {
    headers: {
      // Requesting a conversation token requires your ElevenLabs API key
      // Do NOT expose your API key to the client!
      "xi-api-key": Deno.env.get("ELEVENLABS_API_KEY")
    }
  });
  if (!response.ok) {
    return res.status(500).send("Failed to get conversation token");
  }
  const body = await response.json();
  res.send(body.token);
});

app.listen(3000);
