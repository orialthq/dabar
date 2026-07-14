// 주제 앵커 임베딩 파이프라인 (M5a 하이브리드)
// scripts/themes.json의 앵커 문장을 임베딩해 public/embeddings/themes.json 생성.
// 앵커 벡터는 int8 양자화(벡터별 f16 스케일) 후 base64로 동봉 — 총 ~50KB.
// 사용법: node scripts/embed-themes.mjs

import { pipeline } from "@huggingface/transformers";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { f16encode, f16decode } from "./embed-bible.mjs";

const MODEL = "Xenova/multilingual-e5-small";
const OUT = "public/embeddings/themes.json";

const src = JSON.parse(await readFile(path.resolve("scripts/themes.json"), "utf8"));

// 큐레이션 참조 전수 검증 — 존재하지 않는 절이 섞이면 빌드 실패
const books = JSON.parse(await readFile(path.resolve("public/bible/books.json"), "utf8"));
const cache = new Map();
for (const t of src.themes) {
  for (const v of t.verses) {
    if (!cache.has(v.bookId)) {
      cache.set(v.bookId, JSON.parse(await readFile(path.resolve(`public/bible/${v.bookId}.json`), "utf8")));
    }
    const text = cache.get(v.bookId).chapters[v.chapter - 1]?.[v.verse - 1];
    if (!books.some((b) => b.id === v.bookId) || text === undefined) {
      console.error(`✗ 존재하지 않는 참조: ${v.bookId} ${v.chapter}:${v.verse} (${t.id})`);
      process.exit(1);
    }
  }
}

const anchorTexts = [];
const anchorTheme = []; // 앵커 → 주제 인덱스
src.themes.forEach((t, ti) => {
  for (const a of t.anchors) {
    anchorTexts.push(`passage: ${a}`);
    anchorTheme.push(ti);
  }
});

console.log(`주제 ${src.themes.length}개 · 앵커 ${anchorTexts.length}개 임베딩...`);
const extractor = await pipeline("feature-extraction", MODEL, { dtype: "fp32" });
const out = await extractor(anchorTexts, { pooling: "mean", normalize: true });
const dim = out.dims[out.dims.length - 1];

const n = anchorTexts.length;
const int8 = new Int8Array(n * dim);
const scaleBits = new Uint16Array(n);
for (let i = 0; i < n; i++) {
  let maxAbs = 0;
  for (let d = 0; d < dim; d++) {
    const a = Math.abs(out.data[i * dim + d]);
    if (a > maxAbs) maxAbs = a;
  }
  const scale = maxAbs / 127 || 1;
  const stored = f16decode(f16encode(scale));
  scaleBits[i] = f16encode(scale);
  for (let d = 0; d < dim; d++) {
    const q = Math.round(out.data[i * dim + d] / stored);
    int8[i * dim + d] = Math.max(-127, Math.min(127, q));
  }
}
out.dispose?.();

const payload = {
  model: MODEL,
  dim,
  queryPrefix: "query: ",
  themes: src.themes.map((t) => ({ id: t.id, label: t.label, verses: t.verses })),
  anchors: {
    count: n,
    theme: anchorTheme,
    vectors: Buffer.from(int8.buffer).toString("base64"),
    scales: Buffer.from(scaleBits.buffer).toString("base64"),
  },
};
await writeFile(path.resolve(OUT), JSON.stringify(payload));
const kb = (JSON.stringify(payload).length / 1024).toFixed(0);
console.log(`✓ ${OUT} (${kb}KB, dim=${dim})`);
