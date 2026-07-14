// 골든셋 기대 구절의 실제 랭크 진단 (근접 실패인지 원거리 실패인지 판별)
// 사용법: node scripts/rank-goldenset.mjs [--dir public/embeddings]

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

function refToIndex(bookId, chapter, verse) {
  const b = books.find((x) => x.id === bookId);
  if (!b) throw new Error(`책 없음: ${bookId}`);
  let idx = b.start;
  for (let c = 0; c < chapter - 1; c++) idx += b.chapters[c];
  return idx + verse - 1;
}

const extractor = await pipeline("feature-extraction", meta.model, { dtype: "fp32" });
console.log(`진단: ${dir} (variant=${meta.variant})\n`);

for (const g of golden) {
  const out = await extractor(`${meta.queryPrefix}${g.query}`, { pooling: "mean", normalize: true });
  const q = out.data;
  const scores = new Float32Array(total);
  for (let i = 0; i < total; i++) {
    let dot = 0;
    const base = i * dim;
    for (let d = 0; d < dim; d++) dot += q[d] * vectors[base + d];
    scores[i] = dot * scales[i];
  }
  out.dispose?.();
  console.log(`[${g.id}] ${g.query}`);
  for (const e of g.expect) {
    for (const v of e.verses) {
      const idx = refToIndex(e.bookId, e.chapter, v);
      const s = scores[idx];
      let rank = 1;
      for (let i = 0; i < total; i++) if (scores[i] > s) rank++;
      const b = books.find((x) => x.id === e.bookId);
      console.log(`   ${b.name} ${e.chapter}:${v} → rank ${rank} (score ${s.toFixed(3)})`);
    }
  }
  console.log();
}
