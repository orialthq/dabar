// 골든셋 평가 — 하이브리드 경로 (semantic.ts의 suggestVerses 로직을 Node에서 재현)
// 큐레이션 3건(1위 주제 2 + 2위 주제 1) + 발견 1건 = top-4
// 사용법: node scripts/eval-goldenset-hybrid.mjs

import { pipeline } from "@huggingface/transformers";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { f16decode } from "./embed-bible.mjs";

const dir = "public/embeddings";
const meta = JSON.parse(await readFile(path.join(dir, "meta.json"), "utf8"));
const themesRaw = JSON.parse(await readFile(path.join(dir, "themes.json"), "utf8"));
const golden = JSON.parse(await readFile(path.resolve("scripts/goldenset.json"), "utf8"));

// 전 절 인덱스
const { dim, total, books } = meta;
const vectors = new Int8Array(total * dim);
const scales = new Float32Array(total);
for (const s of meta.shards) {
  const buf = await readFile(path.join(dir, s.file));
  vectors.set(new Int8Array(buf.buffer, buf.byteOffset, s.count * dim), s.start * dim);
  const bits = new Uint16Array(buf.buffer.slice(buf.byteOffset + s.count * dim, buf.byteOffset + s.count * dim + s.count * 2));
  for (let i = 0; i < s.count; i++) scales[s.start + i] = f16decode(bits[i]);
}

// 주제 앵커 인덱스 (base64 복원)
const anchorVecBytes = Buffer.from(themesRaw.anchors.vectors, "base64");
const anchorScaleBytes = Buffer.from(themesRaw.anchors.scales, "base64");
const anchorCount = themesRaw.anchors.count;
const anchorVectors = new Int8Array(anchorVecBytes.buffer, anchorVecBytes.byteOffset, anchorCount * themesRaw.dim);
const anchorBits = new Uint16Array(anchorScaleBytes.buffer.slice(anchorScaleBytes.byteOffset, anchorScaleBytes.byteOffset + anchorCount * 2));
const anchorScales = new Float32Array(anchorCount);
for (let i = 0; i < anchorCount; i++) anchorScales[i] = f16decode(anchorBits[i]);

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

const bookData = new Map();
async function verseText(ref) {
  if (!bookData.has(ref.bookId))
    bookData.set(ref.bookId, JSON.parse(await readFile(path.resolve(`public/bible/${ref.bookId}.json`), "utf8")));
  return bookData.get(ref.bookId).chapters[ref.chapter - 1][ref.verse - 1];
}
const bookName = (id) => books.find((b) => b.id === id)?.name ?? id;

// semantic.ts와 동일한 선택 규칙
function suggest(q) {
  const themeScores = new Array(themesRaw.themes.length).fill(-Infinity);
  for (let a = 0; a < anchorCount; a++) {
    let dot = 0;
    for (let d = 0; d < themesRaw.dim; d++) dot += q[d] * anchorVectors[a * themesRaw.dim + d];
    const score = dot * anchorScales[a];
    const t = themesRaw.anchors.theme[a];
    if (score > themeScores[t]) themeScores[t] = score;
  }
  const order = themeScores.map((score, t) => ({ t, score })).sort((a, b) => b.score - a.score);

  const result = [];
  const usedVerse = new Set();
  const usedChapter = new Set();
  const take = (t, score, limit) => {
    let taken = 0;
    for (const v of themesRaw.themes[t].verses) {
      if (taken >= limit) break;
      const key = `${v.bookId}:${v.chapter}:${v.verse}`;
      if (usedVerse.has(key)) continue;
      usedVerse.add(key);
      usedChapter.add(`${v.bookId}:${v.chapter}`);
      result.push({ ...v, score, kind: "curated", label: themesRaw.themes[t].label });
      taken++;
    }
  };
  take(order[0].t, order[0].score, 2);
  take(order[1].t, order[1].score, 1);

  const scored = [];
  for (let i = 0; i < total; i++) {
    let dot = 0;
    for (let d = 0; d < dim; d++) dot += q[d] * vectors[i * dim + d];
    const score = dot * scales[i];
    if (scored.length < 8) {
      scored.push({ idx: i, score });
      scored.sort((a, b) => b.score - a.score);
    } else if (score > scored[7].score) {
      scored[7] = { idx: i, score };
      scored.sort((a, b) => b.score - a.score);
    }
  }
  for (const { idx, score } of scored) {
    const ref = indexToRef(idx);
    if (usedChapter.has(`${ref.bookId}:${ref.chapter}`)) continue;
    result.push({ ...ref, score, kind: "discovery" });
    break;
  }
  return result;
}

const extractor = await pipeline("feature-extraction", themesRaw.model, { dtype: "fp32" });
let hits = 0;
for (const g of golden) {
  const out = await extractor(`${themesRaw.queryPrefix}${g.query}`, { pooling: "mean", normalize: true });
  const results = suggest(out.data);
  out.dispose?.();
  const hit = results.some((r) =>
    g.expect.some((e) => e.bookId === r.bookId && e.chapter === r.chapter && e.verses.includes(r.verse))
  );
  if (hit) hits++;
  console.log(`${hit ? "✓" : "✗"} [${g.id}] ${g.query}`);
  for (const r of results) {
    const star = g.expect.some((e) => e.bookId === r.bookId && e.chapter === r.chapter && e.verses.includes(r.verse)) ? "★" : " ";
    const tag = r.kind === "curated" ? r.label : "발견";
    console.log(`   ${star} [${tag}] ${bookName(r.bookId)} ${r.chapter}:${r.verse} — ${(await verseText(r)).slice(0, 50)}`);
  }
  console.log();
}
console.log(`top-4 적중률: ${hits}/${golden.length}`);
