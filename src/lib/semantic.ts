import type { VerseRef } from "../types/journal";

/**
 * 하이브리드 말씀 추천 (M5a).
 * ① 주제 앵커 분류: 기록 임베딩 → 주제별 일기체 앵커 문장과 코사인 매칭 → 큐레이션 구절 추천
 * ② 발견 슬롯: 31,102절 전체 임베딩 샤드에서 시맨틱 top-1을 보조로 병행
 * 순수 시맨틱 검색만으로는 일기→약속 구절 매칭이 안 된다는 실측(골든셋 0/10)에 따른 구조.
 * 구절 본문은 여기서 다루지 않는다 — 참조(bookId/장/절)만 반환하고 렌더링은 로컬 DB가 담당.
 */

const BASE = import.meta.env.BASE_URL;

interface ShardMeta {
  file: string;
  start: number;
  count: number;
}

interface BookIndex {
  id: string;
  name: string;
  start: number;
  chapters: number[];
}

interface EmbeddingsMeta {
  model: string;
  dim: number;
  total: number;
  variant: string;
  passagePrefix: string;
  queryPrefix: string;
  shards: ShardMeta[];
  books: BookIndex[];
}

export interface Suggestion {
  ref: VerseRef;
  score: number;
  /** curated = 주제 큐레이션 · discovery = 전 절 시맨틱 검색 */
  kind: "curated" | "discovery";
  /** 큐레이션 추천의 근거 주제 라벨 (예: "불안과 염려") */
  themeLabel?: string;
}

interface ThemeVerse {
  bookId: string;
  chapter: number;
  verse: number;
}

interface ThemesIndex {
  dim: number;
  queryPrefix: string;
  themes: { id: string; label: string; verses: ThemeVerse[] }[];
  anchorTheme: number[];
  anchorVectors: Int8Array;
  anchorScales: Float32Array;
}

export type SemanticProgress =
  | { kind: "model"; loaded: number; total: number }
  | { kind: "index" };

type Embedder = (texts: string[], opts: { pooling: "mean"; normalize: boolean }) => Promise<{
  data: Float32Array;
  dispose?: () => void;
}>;

interface Index {
  meta: EmbeddingsMeta;
  vectors: Int8Array; // total × dim
  scales: Float32Array; // total (f16 → f32 복원값)
}

let embedderPromise: Promise<Embedder> | null = null;
let indexPromise: Promise<Index> | null = null;
let themesPromise: Promise<ThemesIndex> | null = null;

/** float16 비트 → float32 (샤드의 벡터별 스케일 복원) */
function f16decode(h: number): number {
  const sign = (h & 0x8000) << 16;
  const exp = (h >> 10) & 0x1f;
  const mant = h & 0x3ff;
  let bits: number;
  if (exp === 0) {
    if (mant === 0) bits = sign;
    else {
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

export function isSemanticSupported(): boolean {
  return typeof WebAssembly !== "undefined";
}

// 임베딩 모델과 리비전 — 코퍼스(빌드 타임)와 반드시 동일해야 한다. scripts/embed-bible.mjs와 짝.
const EMBED_MODEL = "Xenova/multilingual-e5-small";
const EMBED_REVISION = "761b726dd34fb83930e26aab4e9ac3899aa1fa78";
const EMBED_DTYPE = "q8";

/** 모델 파일 다운로드의 일시적 네트워크 오류를 짧은 재시도로 흡수 */
function retryFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const attempt = async (left: number): Promise<Response> => {
    try {
      return await fetch(input, init);
    } catch (e) {
      if (left <= 0) throw e;
      await new Promise((r) => setTimeout(r, 1500));
      return attempt(left - 1);
    }
  };
  return attempt(2);
}

/** 모델이 이미 브라우저 캐시에 있는지 — 있으면 다운로드 동의 없이 바로 사용 */
export async function isSemanticCached(): Promise<boolean> {
  try {
    const { ModelRegistry } = await import("@huggingface/transformers");
    return await ModelRegistry.is_pipeline_cached("feature-extraction", EMBED_MODEL, {
      dtype: EMBED_DTYPE,
      revision: EMBED_REVISION,
    });
  } catch {
    return false;
  }
}

/** 모델 로드 (최초 1회 다운로드 ~110MB, 이후 브라우저 캐시). WebGPU 실패 시 WASM 폴백. */
function loadEmbedder(onProgress?: (p: SemanticProgress) => void): Promise<Embedder> {
  if (!embedderPromise) {
    embedderPromise = (async () => {
      const { pipeline, env } = await import("@huggingface/transformers");
      (env as { fetch?: typeof fetch }).fetch = retryFetch;
      const progress = (info: { status: string; progress?: number; loaded?: number; total?: number }) => {
        // v4의 전체 진행률 이벤트 하나로 통일 (파일별 수동 합산 제거)
        if (info.status === "progress_total" && typeof info.progress === "number") {
          onProgress?.({ kind: "model", loaded: info.progress, total: 100 });
        }
      };
      const hasWebGpu = "gpu" in navigator;
      try {
        if (!hasWebGpu) throw new Error("WebGPU 미지원");
        return (await pipeline("feature-extraction", EMBED_MODEL, {
          device: "webgpu",
          dtype: EMBED_DTYPE,
          revision: EMBED_REVISION,
          progress_callback: progress,
        })) as unknown as Embedder;
      } catch {
        return (await pipeline("feature-extraction", EMBED_MODEL, {
          device: "wasm",
          dtype: EMBED_DTYPE,
          revision: EMBED_REVISION,
          progress_callback: progress,
        })) as unknown as Embedder;
      }
    })();
    embedderPromise.catch(() => {
      embedderPromise = null; // 실패 시 재시도 가능하게
    });
  }
  return embedderPromise;
}

/** 임베딩 샤드 로드 (총 ~12MB, 병렬 fetch) */
function loadIndex(): Promise<Index> {
  if (!indexPromise) {
    indexPromise = (async () => {
      const metaRes = await fetch(`${BASE}embeddings/meta.json`);
      if (!metaRes.ok) throw new Error("임베딩 메타를 불러오지 못했습니다");
      const meta = (await metaRes.json()) as EmbeddingsMeta;
      const vectors = new Int8Array(meta.total * meta.dim);
      const scales = new Float32Array(meta.total);
      await Promise.all(
        meta.shards.map(async (s) => {
          const res = await fetch(`${BASE}embeddings/${s.file}`);
          if (!res.ok) throw new Error(`임베딩 샤드를 불러오지 못했습니다: ${s.file}`);
          const buf = await res.arrayBuffer();
          const vecBytes = s.count * meta.dim;
          if (buf.byteLength !== vecBytes + s.count * 2)
            throw new Error(`임베딩 샤드 크기 불일치: ${s.file}`);
          vectors.set(new Int8Array(buf, 0, vecBytes), s.start * meta.dim);
          const bits = new Uint16Array(buf, vecBytes, s.count);
          for (let i = 0; i < s.count; i++) scales[s.start + i] = f16decode(bits[i]);
        })
      );
      return { meta, vectors, scales };
    })();
    indexPromise.catch(() => {
      indexPromise = null;
    });
  }
  return indexPromise;
}

/** 주제 앵커 인덱스 로드 (~54KB) */
function loadThemes(): Promise<ThemesIndex> {
  if (!themesPromise) {
    themesPromise = (async () => {
      const res = await fetch(`${BASE}embeddings/themes.json`);
      if (!res.ok) throw new Error("주제 인덱스를 불러오지 못했습니다");
      const raw = (await res.json()) as {
        dim: number;
        queryPrefix: string;
        themes: { id: string; label: string; verses: ThemeVerse[] }[];
        anchors: { count: number; theme: number[]; vectors: string; scales: string };
      };
      const vecBytes = Uint8Array.from(atob(raw.anchors.vectors), (c) => c.charCodeAt(0));
      const scaleBytes = Uint8Array.from(atob(raw.anchors.scales), (c) => c.charCodeAt(0));
      const bits = new Uint16Array(scaleBytes.buffer, 0, raw.anchors.count);
      const scales = new Float32Array(raw.anchors.count);
      for (let i = 0; i < raw.anchors.count; i++) scales[i] = f16decode(bits[i]);
      return {
        dim: raw.dim,
        queryPrefix: raw.queryPrefix,
        themes: raw.themes,
        anchorTheme: raw.anchors.theme,
        anchorVectors: new Int8Array(vecBytes.buffer, 0, raw.anchors.count * raw.dim),
        anchorScales: scales,
      };
    })();
    themesPromise.catch(() => {
      themesPromise = null;
    });
  }
  return themesPromise;
}

/** 모델 + 인덱스 사전 준비 (VerseSuggest의 "준비하기" 버튼에서 호출) */
export async function prepareSemantic(onProgress?: (p: SemanticProgress) => void): Promise<void> {
  onProgress?.({ kind: "index" });
  await Promise.all([loadEmbedder(onProgress), loadIndex(), loadThemes()]);
}

export function isSemanticReady(): boolean {
  return embedderPromise !== null && indexPromise !== null && themesPromise !== null;
}

function indexToRef(meta: EmbeddingsMeta, globalIdx: number): VerseRef {
  for (let i = meta.books.length - 1; i >= 0; i--) {
    const b = meta.books[i];
    if (globalIdx >= b.start) {
      let rem = globalIdx - b.start;
      for (let c = 0; c < b.chapters.length; c++) {
        if (rem < b.chapters[c]) return { bookId: b.id, chapter: c + 1, verse: rem + 1 };
        rem -= b.chapters[c];
      }
    }
  }
  throw new Error(`임베딩 인덱스 범위 밖: ${globalIdx}`);
}

const CURATED_TOP = 2; // 1위 주제에서 가져올 구절 수
const CURATED_SECOND = 1; // 2위 주제에서 가져올 구절 수
const DISCOVERY = 1; // 전 절 시맨틱 검색 보조 슬롯
const DENSE_POOL = 8;

/** int8 코퍼스에 대한 내적 top-k (코사인 ≈ scale × Σ q[d]·int8[d]) */
function denseTopK(
  q: Float32Array,
  vectors: Int8Array,
  scales: Float32Array,
  total: number,
  dim: number,
  k: number
): { idx: number; score: number }[] {
  const scored: { idx: number; score: number }[] = [];
  for (let i = 0; i < total; i++) {
    let dot = 0;
    const base = i * dim;
    for (let d = 0; d < dim; d++) dot += q[d] * vectors[base + d];
    const score = dot * scales[i];
    if (scored.length < k) {
      scored.push({ idx: i, score });
      scored.sort((a, b) => b.score - a.score);
    } else if (score > scored[k - 1].score) {
      scored[k - 1] = { idx: i, score };
      scored.sort((a, b) => b.score - a.score);
    }
  }
  return scored;
}

/**
 * 기록에 닿는 말씀 추천: 주제 큐레이션 3건(1위 주제 2 + 2위 주제 1) + 발견 1건.
 * 주제 점수는 해당 주제 앵커들과의 코사인 최대값.
 */
export async function suggestVerses(
  text: string,
  onProgress?: (p: SemanticProgress) => void
): Promise<Suggestion[]> {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const [embed, index, themes] = await Promise.all([
    loadEmbedder(onProgress),
    loadIndex(),
    loadThemes(),
  ]);

  const out = await embed([`${themes.queryPrefix}${trimmed}`], {
    pooling: "mean",
    normalize: true,
  });
  const q = out.data;

  // ① 주제 분류: 앵커별 코사인 → 주제별 최대값
  const themeScores = new Array<number>(themes.themes.length).fill(-Infinity);
  for (let a = 0; a < themes.anchorTheme.length; a++) {
    let dot = 0;
    const base = a * themes.dim;
    for (let d = 0; d < themes.dim; d++) dot += q[d] * themes.anchorVectors[base + d];
    const score = dot * themes.anchorScales[a];
    const t = themes.anchorTheme[a];
    if (score > themeScores[t]) themeScores[t] = score;
  }
  const order = themeScores
    .map((score, t) => ({ t, score }))
    .sort((a, b) => b.score - a.score);

  const result: Suggestion[] = [];
  const usedVerse = new Set<string>();
  const usedChapter = new Set<string>();
  const take = (t: number, score: number, limit: number) => {
    let taken = 0;
    for (const v of themes.themes[t].verses) {
      if (taken >= limit) break;
      const key = `${v.bookId}:${v.chapter}:${v.verse}`;
      if (usedVerse.has(key)) continue;
      usedVerse.add(key);
      usedChapter.add(`${v.bookId}:${v.chapter}`);
      result.push({ ref: v, score, kind: "curated", themeLabel: themes.themes[t].label });
      taken++;
    }
  };
  take(order[0].t, order[0].score, CURATED_TOP);
  take(order[1].t, order[1].score, CURATED_SECOND);

  // ② 발견: 전 절 시맨틱 top-8 중 큐레이션과 장이 겹치지 않는 첫 절
  const { meta, vectors, scales } = index;
  const dense = denseTopK(q, vectors, scales, meta.total, meta.dim, DENSE_POOL);
  let found = 0;
  for (const { idx, score } of dense) {
    if (found >= DISCOVERY) break;
    const ref = indexToRef(meta, idx);
    if (usedChapter.has(`${ref.bookId}:${ref.chapter}`)) continue;
    usedChapter.add(`${ref.bookId}:${ref.chapter}`);
    result.push({ ref, score, kind: "discovery" });
    found++;
  }
  out.dispose?.();
  return result;
}

/**
 * 돌아보기(M7)용 텍스트 분석: 임베딩 벡터 + 최고 점수 주제.
 * 모델이 준비/캐시된 경우에만 호출할 것 (게이트는 호출부 책임).
 */
export async function analyzeText(
  text: string
): Promise<{ vec: Float32Array; themeId: string; themeLabel: string }> {
  const [embed, themes] = await Promise.all([loadEmbedder(), loadThemes()]);
  const out = await embed([`${themes.queryPrefix}${text.trim()}`], {
    pooling: "mean",
    normalize: true,
  });
  const vec = new Float32Array(out.data);
  out.dispose?.();
  const themeScores = new Array<number>(themes.themes.length).fill(-Infinity);
  for (let a = 0; a < themes.anchorTheme.length; a++) {
    let dot = 0;
    const base = a * themes.dim;
    for (let d = 0; d < themes.dim; d++) dot += vec[d] * themes.anchorVectors[base + d];
    const score = dot * themes.anchorScales[a];
    const t = themes.anchorTheme[a];
    if (score > themeScores[t]) themeScores[t] = score;
  }
  let best = 0;
  for (let t = 1; t < themeScores.length; t++) if (themeScores[t] > themeScores[best]) best = t;
  return { vec, themeId: themes.themes[best].id, themeLabel: themes.themes[best].label };
}

/**
 * 묻다(M5b) 역전 RAG용 검색: 1위 주제 큐레이션 3건 + 전 절 시맨틱 상위(장 중복 억제) 5건.
 * 참조만 반환 — 본문 해석과 프롬프트 구성은 ask.ts 담당.
 */
export async function retrieveForAsk(question: string): Promise<VerseRef[]> {
  const trimmed = question.trim();
  if (!trimmed) return [];
  const [embed, index, themes] = await Promise.all([loadEmbedder(), loadIndex(), loadThemes()]);
  const out = await embed([`${themes.queryPrefix}${trimmed}`], {
    pooling: "mean",
    normalize: true,
  });
  const q = out.data;

  const themeScores = new Array<number>(themes.themes.length).fill(-Infinity);
  for (let a = 0; a < themes.anchorTheme.length; a++) {
    let dot = 0;
    const base = a * themes.dim;
    for (let d = 0; d < themes.dim; d++) dot += q[d] * themes.anchorVectors[base + d];
    const score = dot * themes.anchorScales[a];
    const t = themes.anchorTheme[a];
    if (score > themeScores[t]) themeScores[t] = score;
  }
  let best = 0;
  for (let t = 1; t < themeScores.length; t++) if (themeScores[t] > themeScores[best]) best = t;

  const refs: VerseRef[] = [];
  const usedVerse = new Set<string>();
  const usedChapter = new Set<string>();
  for (const v of themes.themes[best].verses.slice(0, 3)) {
    usedVerse.add(`${v.bookId}:${v.chapter}:${v.verse}`);
    usedChapter.add(`${v.bookId}:${v.chapter}`);
    refs.push(v);
  }
  const { meta, vectors, scales } = index;
  const dense = denseTopK(q, vectors, scales, meta.total, meta.dim, 12);
  out.dispose?.();
  for (const { idx } of dense) {
    if (refs.length >= 8) break;
    const ref = indexToRef(meta, idx);
    if (usedChapter.has(`${ref.bookId}:${ref.chapter}`)) continue;
    usedChapter.add(`${ref.bookId}:${ref.chapter}`);
    refs.push(ref);
  }
  return refs;
}
