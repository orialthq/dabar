// 실험: 쿼리 템플릿 재구성이 골든셋 적중률에 미치는 영향 (재임베딩 불필요)
// 사용법: node scripts/exp-query-reframe.mjs [--dir public/embeddings]

import { pipeline } from "@huggingface/transformers";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { f16decode } from "./embed-bible.mjs";

const args = process.argv.slice(2);
const dirIdx = args.indexOf("--dir");
const dir = dirIdx >= 0 ? args[dirIdx + 1] : "public/embeddings";

const meta = JSON.parse(await readFile(path.join(dir, "meta.json"), "utf8"));
const golden = JSON.parse(await readFile(path.resolve("scripts/goldenset.json"), "utf8"));
const { dim, total, books } = meta;

const vectors = new Int8Array(total * dim);
const scales = new Float32Array(total);
for (const s of meta.shards) {
  const buf = await readFile(path.join(dir, s.file));
  vectors.set(new Int8Array(buf.buffer, buf.byteOffset, s.count * dim), s.start * dim);
  const bits = new Uint16Array(buf.buffer.slice(buf.byteOffset + s.count * dim, buf.byteOffset + s.count * dim + s.count * 2));
  for (let i = 0; i < s.count; i++) scales[s.start + i] = f16decode(bits[i]);
}

function indexToRef(globalIdx) {
  for (let i = books.length - 1; i >= 0; i--) {
    const b = books[i];
    if (globalIdx >= b.start) {
      let rem = globalIdx - b.start;
      for (let c = 0; c < b.chapters.length; c++) {
        if (rem < b.chapters[c]) return { bookId: b.id, name: b.name, chapter: c + 1, verse: rem + 1 };
        rem -= b.chapters[c];
      }
    }
  }
}

const TEMPLATES = [
  ["raw", (q) => `query: ${q}`],
  ["comfort-suffix", (q) => `query: ${q} 이 마음에 닿는 위로와 권면의 말씀`],
  ["comfort-prefix", (q) => `query: 다음 상황에 하나님이 주시는 위로와 약속의 말씀: ${q}`],
  ["exhort", (q) => `query: ${q} 이럴 때 붙들 성경의 약속과 권면`],
];

const extractor = await pipeline("feature-extraction", meta.model, { dtype: "fp32" });

function search(q, pool = 8, k = 4) {
  const scored = [];
  for (let i = 0; i < total; i++) {
    let dot = 0;
    const base = i * dim;
    for (let d = 0; d < dim; d++) dot += q[d] * vectors[base + d];
    const score = dot * scales[i];
    if (scored.length < pool) {
      scored.push({ idx: i, score });
      scored.sort((a, b) => b.score - a.score);
    } else if (score > scored[pool - 1].score) {
      scored[pool - 1] = { idx: i, score };
      scored.sort((a, b) => b.score - a.score);
    }
  }
  const seen = new Set();
  const out = [];
  for (const { idx, score } of scored) {
    const r = indexToRef(idx);
    const key = `${r.bookId}:${r.chapter}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...r, score });
    if (out.length >= k) break;
  }
  return out;
}

for (const [name, tpl] of TEMPLATES) {
  let hits = 0;
  const detail = [];
  for (const g of golden) {
    const out = await extractor(tpl(g.query), { pooling: "mean", normalize: true });
    const results = search(out.data);
    out.dispose?.();
    const hit = results.some((r) =>
      g.expect.some((e) => e.bookId === r.bookId && e.chapter === r.chapter && e.verses.includes(r.verse))
    );
    if (hit) hits++;
    detail.push(`${hit ? "○" : "·"}${g.id}`);
  }
  console.log(`${name.padEnd(16)} ${hits}/10  ${detail.join(" ")}`);
}
