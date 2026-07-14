// 실험: 모델 후보 스크리닝 — 전 코퍼스 재임베딩 없이 추정 랭크로 비교
// 골든셋 기대 절 + 무작위 표본 N절만 임베딩해, 표본 내 랭크 × (31102/N)으로 전체 랭크를 추정한다.
// 사용법: node scripts/exp-model-screen.mjs --model Xenova/multilingual-e5-base [--sample 3000] [--seed 42]

import { pipeline } from "@huggingface/transformers";
import { readFile } from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
function opt(name, fallback) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
}
const model = opt("model", "Xenova/multilingual-e5-small");
const sampleN = parseInt(opt("sample", "3000"), 10);
const seed = parseInt(opt("seed", "42"), 10);
const dtype = opt("dtype", "fp32");
const plain = args.includes("--plain"); // passage에 책·장·절 헤더 미포함 ablation
const noPrefix = args.includes("--no-prefix"); // bge 계열: query:/passage: 프리픽스 미사용
const pooling = opt("pooling", "mean"); // e5: mean · bge: cls

// 시드 고정 PRNG (모델 간 동일 표본 보장)
function mulberry32(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const bibleDir = path.resolve("public/bible");
const books = JSON.parse(await readFile(path.join(bibleDir, "books.json"), "utf8"));
const golden = JSON.parse(await readFile(path.resolve("scripts/goldenset.json"), "utf8"));

// 전 절 텍스트 로드
const all = [];
for (const b of books) {
  const data = JSON.parse(await readFile(path.join(bibleDir, `${b.id}.json`), "utf8"));
  for (let c = 0; c < data.chapters.length; c++)
    for (let v = 0; v < data.chapters[c].length; v++)
      all.push({ bookId: b.id, name: b.name, chapter: c + 1, verse: v + 1, text: data.chapters[c][v] });
}

const keyOf = (r) => `${r.bookId} ${r.chapter}:${r.verse}`;
const goldenKeys = new Set();
for (const g of golden)
  for (const e of g.expect) for (const v of e.verses) goldenKeys.add(`${e.bookId} ${e.chapter}:${v}`);

// 무작위 표본 (골든 절 제외) + 골든 절
const rand = mulberry32(seed);
const pool = all.filter((r) => !goldenKeys.has(keyOf(r)));
for (let i = pool.length - 1; i > 0; i--) {
  const j = Math.floor(rand() * (i + 1));
  [pool[i], pool[j]] = [pool[j], pool[i]];
}
const sample = pool.slice(0, sampleN);
const goldenVerses = all.filter((r) => goldenKeys.has(keyOf(r)));
const corpus = [...sample, ...goldenVerses];

console.log(`모델: ${model} (dtype=${dtype}) · 표본 ${sample.length} + 골든 ${goldenVerses.length}절`);
const extractor = await pipeline("feature-extraction", model, { dtype });

const BATCH = 32;
const t0 = Date.now();
let mat = null;
let dim = 0;
for (let i = 0; i < corpus.length; i += BATCH) {
  const pp = noPrefix ? "" : "passage: ";
  const texts = corpus
    .slice(i, i + BATCH)
    .map((r) => (plain ? `${pp}${r.text}` : `${pp}${r.name} ${r.chapter}:${r.verse} ${r.text}`));
  const out = await extractor(texts, { pooling, normalize: true });
  if (!mat) {
    dim = out.dims[out.dims.length - 1];
    mat = new Float32Array(corpus.length * dim);
  }
  mat.set(out.data, i * dim);
  out.dispose?.();
}
console.log(`코퍼스 임베딩: ${((Date.now() - t0) / 1000).toFixed(0)}s · dim=${dim} · ${(corpus.length / ((Date.now() - t0) / 1000)).toFixed(0)}절/s`);

const scale = 31102 / sample.length;
let sumBest = 0;
let estHits = 0;
for (const g of golden) {
  const out = await extractor(noPrefix ? g.query : `query: ${g.query}`, {
    pooling,
    normalize: true,
  });
  const q = out.data;
  out.dispose?.();
  const scores = new Float32Array(corpus.length);
  for (let i = 0; i < corpus.length; i++) {
    let dot = 0;
    for (let d = 0; d < dim; d++) dot += q[d] * mat[i * dim + d];
    scores[i] = dot;
  }
  // 골든 절별 추정 랭크: (표본 중 자기보다 높은 것 수) × scale + 1
  let best = Infinity;
  let bestKey = "";
  for (const e of g.expect) {
    for (const v of e.verses) {
      const gi = corpus.findIndex((r) => r.bookId === e.bookId && r.chapter === e.chapter && r.verse === v);
      let above = 0;
      for (let i = 0; i < sample.length; i++) if (scores[i] > scores[gi]) above++;
      const est = Math.round(above * scale) + 1;
      if (est < best) {
        best = est;
        bestKey = `${e.bookId} ${e.chapter}:${v}`;
      }
    }
  }
  sumBest += Math.min(best, 31102);
  if (best <= 8) estHits++; // top-8 풀 진입 추정 → 장 억제 후 top-4 근사
  console.log(`  [${g.id}] 최고 골든 추정랭크 ${best} (${bestKey})`);
}
console.log(`\n요약: 추정 top-8 진입 ${estHits}/10 · 최고랭크 평균 ${(sumBest / golden.length).toFixed(0)}`);
