// 성경 전 절 임베딩 파이프라인 (M5a)
// 사용법:
//   node scripts/embed-bible.mjs                 # 66권 전체, 절 단독
//   node scripts/embed-bible.mjs --book gen      # 창세기만 (e2e 검증용)
//   node scripts/embed-bible.mjs --variant context --out tmp/embeddings-context
//
// 출력: {out}/verses-{n}.bin + {out}/meta.json
//   .bin 레이아웃: [count×384 int8 벡터] 뒤에 [count×uint16 float16 스케일]
//   벡터는 L2 정규화된 임베딩을 벡터별 scale(max|v|/127)로 int8 양자화한 것

import { pipeline } from "@huggingface/transformers";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const MODEL = "Xenova/multilingual-e5-small";
const DIM = 384;
const BATCH = 32;
const SHARDS = 4;

// ---- CLI ----
const args = process.argv.slice(2);
function opt(name, fallback) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
}
const onlyBook = opt("book", null);
const variant = opt("variant", "verse"); // verse | context
const outDir = opt("out", "public/embeddings");
if (!["verse", "context"].includes(variant)) {
  console.error(`알 수 없는 variant: ${variant}`);
  process.exit(1);
}

// ---- float16 인코딩 (스케일 저장용) ----
export function f16encode(x) {
  const f32 = new Float32Array([x]);
  const bits = new Uint32Array(f32.buffer)[0];
  const sign = (bits >>> 16) & 0x8000;
  let exp = (bits >>> 23) & 0xff;
  let mant = bits & 0x7fffff;
  if (exp === 0xff) return sign | 0x7c00 | (mant ? 1 : 0); // Inf/NaN
  let e = exp - 127 + 15;
  if (e >= 31) return sign | 0x7c00; // overflow → Inf
  if (e <= 0) {
    if (e < -10) return sign; // underflow → 0
    mant = (mant | 0x800000) >> (1 - e + 13);
    return sign | mant;
  }
  return sign | (e << 10) | (mant >> 13);
}

export function f16decode(h) {
  const sign = (h & 0x8000) << 16;
  const exp = (h >> 10) & 0x1f;
  const mant = h & 0x3ff;
  let bits;
  if (exp === 0) {
    if (mant === 0) bits = sign;
    else {
      // subnormal
      let e = -1;
      let m = mant;
      do {
        e++;
        m <<= 1;
      } while ((m & 0x400) === 0);
      bits = sign | ((127 - 15 - e) << 23) | ((m & 0x3ff) << 13);
    }
  } else if (exp === 31) {
    bits = sign | 0x7f800000 | (mant << 13);
  } else {
    bits = sign | ((exp - 15 + 127) << 23) | (mant << 13);
  }
  const u32 = new Uint32Array([bits]);
  return new Float32Array(u32.buffer)[0];
}

// ---- 절 목록 구성 (books.json 순서 = 전역 인덱스 순서) ----
async function loadVerses() {
  const bibleDir = path.resolve("public/bible");
  const books = JSON.parse(await readFile(path.join(bibleDir, "books.json"), "utf8"));
  const selected = onlyBook ? books.filter((b) => b.id === onlyBook) : books;
  if (onlyBook && selected.length === 0) {
    console.error(`책을 찾을 수 없습니다: ${onlyBook}`);
    process.exit(1);
  }
  const verses = []; // { text: 임베딩 입력, bookId, chapter, verse }
  const bookMeta = [];
  for (const b of selected) {
    const data = JSON.parse(await readFile(path.join(bibleDir, `${b.id}.json`), "utf8"));
    const start = verses.length;
    const chapterCounts = [];
    for (let c = 0; c < data.chapters.length; c++) {
      const ch = data.chapters[c];
      chapterCounts.push(ch.length);
      for (let v = 0; v < ch.length; v++) {
        let body = ch[v];
        if (variant === "context") {
          // 같은 장 안의 앞뒤 1절을 문맥으로 포함 (표시 대상은 여전히 현재 절)
          const prev = v > 0 ? ch[v - 1] : "";
          const next = v < ch.length - 1 ? ch[v + 1] : "";
          body = [prev, ch[v], next].filter(Boolean).join(" ");
        }
        verses.push({
          text: `passage: ${b.name} ${c + 1}:${v + 1} ${body}`,
          bookId: b.id,
          chapter: c + 1,
          verse: v + 1,
        });
      }
    }
    bookMeta.push({ id: b.id, name: b.name, start, chapters: chapterCounts });
  }
  return { verses, bookMeta };
}

// ---- 임베딩 + int8 양자화 ----
async function main() {
  const { verses, bookMeta } = await loadVerses();
  const total = verses.length;
  console.log(`대상: ${onlyBook ?? "66권 전체"} · ${total}절 · variant=${variant}`);

  console.log(`모델 로드 중: ${MODEL}`);
  const extractor = await pipeline("feature-extraction", MODEL, { dtype: "fp32" });

  const int8 = new Int8Array(total * DIM);
  const scales = new Uint16Array(total); // float16 비트
  const t0 = Date.now();

  for (let i = 0; i < total; i += BATCH) {
    const batch = verses.slice(i, i + BATCH).map((v) => v.text);
    const out = await extractor(batch, { pooling: "mean", normalize: true });
    const data = out.data; // Float32Array [batch × DIM]
    for (let j = 0; j < batch.length; j++) {
      const off = j * DIM;
      let maxAbs = 0;
      for (let d = 0; d < DIM; d++) {
        const a = Math.abs(data[off + d]);
        if (a > maxAbs) maxAbs = a;
      }
      const scale = maxAbs / 127 || 1;
      // scale은 f16으로 저장되므로, 저장될 값 기준으로 양자화해 왕복 오차 최소화
      const storedScale = f16decode(f16encode(scale));
      scales[i + j] = f16encode(scale);
      const base = (i + j) * DIM;
      for (let d = 0; d < DIM; d++) {
        const q = Math.round(data[off + d] / storedScale);
        int8[base + d] = Math.max(-127, Math.min(127, q));
      }
    }
    out.dispose?.();
    if ((i / BATCH) % 10 === 0) {
      const done = Math.min(i + BATCH, total);
      const rate = done / ((Date.now() - t0) / 1000);
      const eta = Math.round((total - done) / rate);
      process.stdout.write(`\r${done}/${total} (${rate.toFixed(0)}절/s, ETA ${eta}s)   `);
    }
  }
  console.log(`\n임베딩 완료: ${((Date.now() - t0) / 1000).toFixed(0)}s`);

  // ---- 샤드 출력 ----
  await mkdir(outDir, { recursive: true });
  const shardCount = total < 5000 ? 1 : SHARDS;
  const per = Math.ceil(total / shardCount);
  const shards = [];
  for (let s = 0; s < shardCount; s++) {
    const start = s * per;
    const count = Math.min(per, total - start);
    const buf = Buffer.concat([
      Buffer.from(int8.buffer, start * DIM, count * DIM),
      Buffer.from(scales.buffer, start * 2, count * 2),
    ]);
    const file = `verses-${s}.bin`;
    await writeFile(path.join(outDir, file), buf);
    shards.push({ file, start, count });
    console.log(`${file}: ${count}절, ${(buf.length / 1024 / 1024).toFixed(2)}MB`);
  }

  const meta = {
    model: MODEL,
    dim: DIM,
    total,
    variant,
    passagePrefix: "passage: ",
    queryPrefix: "query: ",
    quantization: { type: "int8", scale: "f16-per-vector" },
    shards,
    books: bookMeta,
  };
  await writeFile(path.join(outDir, "meta.json"), JSON.stringify(meta));
  console.log(`meta.json: ${total}절, ${bookMeta.length}권 → ${outDir}`);
}

// 다른 스크립트(verify)에서 f16 헬퍼만 import할 수 있게 실행 가드
import { fileURLToPath } from "node:url";
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
