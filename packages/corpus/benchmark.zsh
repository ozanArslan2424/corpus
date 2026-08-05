#!/usr/bin/env zsh

profile() {
    NODE_ENV=production bun --cpu-prof --cpu-prof-dir=./prof ./test/other/benchmark.ts $1 &
    PID=$!
    sleep 1
    wrk -t 6 -c 600 -d 10s http://localhost:3000
    kill -INT $PID
    wait $PID 2>/dev/null

    bun -e '
  const { readdirSync, statSync } = require("fs");
  const dir = "./prof";
  const latest = readdirSync(dir)
    .filter(f => f.endsWith(".cpuprofile"))
    .map(f => ({ f, t: statSync(`${dir}/${f}`).mtimeMs }))
    .sort((a, b) => b.t - a.t)[0];
  if (!latest) { console.log("no profile found"); process.exit(1); }
  const p = JSON.parse(await Bun.file(`${dir}/${latest.f}`).text());
  const grand = p.nodes.reduce((s, n) => s + (n.hitCount || 0), 0);
  const rows = p.nodes
    .filter(n => (n.hitCount || 0) > 0)
    .sort((a, b) => b.hitCount - a.hitCount)
    .slice(0, 25)
    .map(n => ({
      hits: n.hitCount,
      pct: (n.hitCount / grand * 100).toFixed(1) + "%",
      fn: n.callFrame.functionName || "(anon)",
      file: n.callFrame.url.split("/").pop() || "",
    }));
  console.log(latest.f);
  console.table(rows);
  '
}

profile corpus
profile elysia
profile express

rm -rf ./prof
