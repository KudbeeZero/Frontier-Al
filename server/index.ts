import express from "express";
import path from "path";

const app = express();

const API_PORT = Number(process.env.API_PORT || 5001);

app.use(express.json());
app.use(express.static(path.resolve("client/public")));

app.get("/api/health", (_, res) => {
  res.json({ ok: true });
});

app.listen(API_PORT, "0.0.0.0", () => {
  console.log(`API running on ${API_PORT}`);
});