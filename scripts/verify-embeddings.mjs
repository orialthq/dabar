// 임베딩 산출물 검증 (SPEC-M5 §3)
// 사용법: node scripts/verify-embeddings.mjs [--dir public/embeddings] [--sample 100]
//   1. 절 수 = 성경 DB 절 수 (전체 실행 시 31,102)
//   2. meta 매핑 전수 일치 (인덱스 ↔ bookId/장/절 ↔ 실제 DB 본문 존재)
//   3. 무작위 N절 재임베딩 → 역양자화 벡터와 코사인 유사도 대조 (양자화 왕복 오차)

import { pipeline } from "@huggingface/transformers";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { f16decode } from "./embed-bible.mjs";

const args = process.argv.slice(2);
function opt(name, fallback) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
}
const dir = opt("dir", "public/embeddings");
const sampleN = parseInt(opt("sample", "100"), 10);

const meta = JSON.parse(await readFile(path.join(dir, "meta.json"), "utf8"));
const { dim, total, shards, books, variant } = meta;
console.log(`검증 대상: ${dir} · ${total}절 · dim=${dim} · variant=${variant}`);

// ---- 1) 절 수 + meta 매핑 전수 일치 ----
const bibleDir = path.resolve("public/bible");
let dbTotal = 0;
let mappingErrors = 0;
const bookData = new Map();
for (const b of books) {
  const data = JSON.parse(await readFile(path.join(bibleDir, `${b.id}.json`), "utf8"));
  bookData.set(b.id, data);
  if (data.chapters.length !== b.chapters.length) {
    console.error(`✗ ${b.id}: 장 수 불일치 (meta ${b.chapters.length} vs DB ${data.chapters.length})`);
    mappingErrors++;
  }
  let idx = b.start;
  for (let c = 0; c < b.chapters.length; c++) {
    if (data.chapters[c].length !== b.chapters[c]) {
      console.error(`✗ ${b.id} ${c + 1}장: 절 수 불일치`);
      mappingErrors++;
    }
    idx += b.chapters[c];
    dbTotal += data.chapters[c]?.length ?? 0;
  }
  const next = books[books.indexOf(b) + 1];
  const expectedEnd = next ? next.start : total;
  if (idx !== expectedEnd) {
    console.error(`✗ ${b.id}: 전역 인덱스 연속성 위반 (${idx} != ${expectedEnd})`);
    mappingErrors++;
  }
}
console.log(
  dbTotal === total && mappingErrors === 0
    ? `✓ 절 수 ${total} = DB ${dbTotal}, meta 매핑 전수 일치`
    : `✗ 절 수/매핑 오류: DB ${dbTotal} vs meta ${total}, 오류 ${mappingErrors}건`
);
if (total === 31102) console.log("✓ 전권 기준 절 수 31,102 충족");

// ---- 샤드 로드 + 역양자화 헬퍼 ----
const shardBufs = [];
let shardTotal = 0;
for (const s of shards) {
  const buf = await readFile(path.join(dir, s.file));
  const expected = s.count * dim + s.count * 2;
  if (buf.length !== expected) {
    console.error(`✗ ${s.file}: 크기 불일치 (${buf.length} != ${expected})`);
    process.exit(1);
  }
  shardBufs.push({ ...s, buf });
  shardTotal += s.count;
}
console.log(shardTotal === total ? `✓ 샤드 합계 ${shardTotal}절 일치` : `✗ 샤드 합계 ${shardTotal} != ${total}`);

function dequantize(globalIdx) {
  const s = shardBufs.find((sh) => globalIdx >= sh.start && globalIdx < sh.start + sh.count);
  const local = globalIdx - s.start;
  const vecs = new Int8Array(s.buf.buffer, s.buf.byteOffset, s.count * dim);
  const scaleBits = new Uint16Array(
    s.buf.buffer.slice(s.buf.byteOffset + s.count * dim, s.buf.byteOffset + s.count * dim + s.count * 2)
  );
  const scale = f16decode(scaleBits[local]);
  const v = new Float32Array(dim);
  for (let d = 0; d < dim; d++) v[d] = vecs[local * dim + d] * scale;
  return v;
}

function indexToRef(globalIdx) {
  for (let i = books.length - 1; i >= 0; i--) {
    if (globalIdx >= books[i].start) {
      let rem = globalIdx - books[i].start;
      for (let c = 0; c < books[i].chapters.length; c++) {
        if (rem < books[i].chapters[c]) return { book: books[i], chapter: c + 1, verse: rem + 1 };
        rem -= books[i].chapters[c];
      }
    }
  }
  throw new Error(`인덱스 범위 밖: ${globalIdx}`);
}

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let d = 0; d < a.length; d++) {
    dot += a[d] * b[d];
    na += a[d] * a[d];
    nb += b[d] * b[d];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// ---- 3) 무작위 재임베딩 대조 ----
console.log(`모델 로드 후 무작위 ${sampleN}절 재계산 대조...`);
const extractor = await pipeline("feature-extraction", meta.model, { dtype: "fp32" });
const picked = new Set();
while (picked.size < Math.min(sampleN, total)) picked.add(Math.floor(Math.random() * total));

let minCos = 1, sumCos = 0, worst = null;
for (const idx of picked) {
  const { book, chapter, verse } = indexToRef(idx);
  const ch = bookData.get(book.id).chapters[chapter - 1];
  let body = ch[verse - 1];
  if (variant === "context") {
    const prev = verse > 1 ? ch[verse - 2] : "";
    const next = verse < ch.length ? ch[verse] : "";
    body = [prev, ch[verse - 1], next].filter(Boolean).join(" ");
  }
  const text = `${meta.passagePrefix}${book.name} ${chapter}:${verse} ${body}`;
  const out = await extractor(text, { pooling: "mean", normalize: true });
  const fresh = Array.from(out.data);
  out.dispose?.();
  const c = cosine(fresh, dequantize(idx));
  sumCos += c;
  if (c < minCos) {
    minCos = c;
    worst = `${book.name} ${chapter}:${verse}`;
  }
}
const n = picked.size;
console.log(`재계산 대조 ${n}절: 평균 코사인 ${(sumCos / n).toFixed(6)}, 최소 ${minCos.toFixed(6)} (${worst})`);
console.log(minCos >= 0.995 ? "✓ 양자화 왕복 오차 허용 범위 (min ≥ 0.995)" : "✗ 왕복 오차 과다 — 양자화 방식 재검토 필요");
