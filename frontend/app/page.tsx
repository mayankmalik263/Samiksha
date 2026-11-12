"use client";
import { useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function Home() {
  const [ticker, setTicker] = useState("TCS");
  const [out, setOut] = useState("");
  const [busy, setBusy] = useState(false);

  async function analyze(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await fetch(`${API}/analyze`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticker }) });
      setOut(JSON.stringify(await r.json(), null, 2));
    } catch (err) {
      setOut(String(err));
    }
    setBusy(false);
  }

  return (
    <main>
      <h1>🪔 Samiksha</h1>
      <p>Every stock, reviewed — both sides, with sources.</p>
      <form onSubmit={analyze}>
        <label htmlFor="t">NSE ticker </label>
        <input id="t" value={ticker} onChange={(e) => setTicker(e.target.value)} />
        <button disabled={busy}>{busy ? "Analysing…" : "Analyse"}</button>
      </form>
      {out && <pre style={{ whiteSpace: "pre-wrap" }}>{out}</pre>}
      <small>Educational. Not investment advice.</small>
    </main>
  );
}
