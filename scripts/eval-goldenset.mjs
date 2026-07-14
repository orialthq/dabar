// 골든셋 top-4 적중률 평가 (SPEC-M5 §3)
// 사용법: node scripts/eval-goldenset.mjs [--dir public/embeddings]
// 런타임(semantic.ts)과 동일한 절차를 재현한다: query 프리픽스 → top-8 → 같은 장 중복 억제 → top-4

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

// 샤드 전체 로드
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
  throw new Error(`인덱스 범위 밖: ${globalIdx}`);
}

// 본문 로드 (리포트 표시용)
const bookData = new Map();
async function verseText(ref) {
  if (!bookData.has(ref.bookId)) {
    bookData.set(ref.bookId, JSON.parse(await readFile(path.resolve(`public/bible/${ref.bookId}.json`), "utf8")));
  }
  return bookData.get(ref.bookId).chapters[ref.chapter - 1][ref.verse - 1];
}

const TOP_POOL = 8;
const TOP_K = 4;

function search(q) {
  const scored = [];
  for (let i = 0; i < total; i++) {
    let dot = 0;
    const base = i * dim;
    for (let d = 0; d < dim; d++) dot += q[d] * vectors[base + d];
    const score = dot * scales[i];
    if (scored.length < TOP_POOL) {
      scored.push({ idx: i, score });
      scored.sort((a, b) => b.score - a.score);
    } else if (score > scored[TOP_POOL - 1].score) {
      scored[TOP_POOL - 1] = { idx: i, score };
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
    if (out.length >= TOP_K) break;
  }
  return out;
}

console.log(`평가: ${dir} (variant=${meta.variant}) · 골든셋 ${golden.length}건\n`);
const extractor = await pipeline("feature-extraction", meta.model, { dtype: "fp32" });

let hits = 0;
for (const g of golden) {
  const out = await extractor(`${meta.queryPrefix}${g.query}`, { pooling: "mean", normalize: true });
  const results = search(out.data);
  out.dispose?.();
  const hit = results.some((r) =>
    g.expect.some((e) => e.bookId === r.bookId && e.chapter === r.chapter && e.verses.includes(r.verse))
  );
  if (hit) hits++;
  console.log(`${hit ? "✓" : "✗"} [${g.id}] ${g.query}`);
  for (const r of results) {
    const text = await verseText(r);
    const mark = g.expect.some((e) => e.bookId === r.bookId && e.chapter === r.chapter && e.verses.includes(r.verse)) ? "★" : " ";
    console.log(`   ${mark} ${r.score.toFixed(3)} ${r.name} ${r.chapter}:${r.verse} — ${text.slice(0, 60)}`);
  }
  console.log();
}
console.log(`top-4 적중률: ${hits}/${golden.length}`);
