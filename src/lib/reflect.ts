import type { Entry } from "../types/journal";
import { analyzeText, isSemanticCached, isSemanticReady } from "./semantic";

/**
 * 돌아보기 (M7①): 쌓인 새김이 사용자에게 되돌아오는 층.
 * - 기념일 회상: 1년/6개월/1개월/1주 전 같은 날의 새김 (순수 날짜 계산, 의존성 없음)
 * - 닮은 새김·주제 뱃지: 새김 임베딩을 로컬 캐시에 쌓아 유사도·주제 연대기 제공
 *   (임베딩 모델이 준비된 경우에만 — 없으면 조용히 생략)
 * 벡터는 int8 양자화해 localStorage에 저장. 본문은 저장물에 넣지 않는다(새김 원문은 entries에 이미 있음).
 */

const VEC_KEY = "dabar:entryvec:v1";
const DIM = 384;

interface CachedVec {
  v: string; // base64 int8[384]
  s: number; // scale (f32)
  t: string; // themeId
  l: string; // themeLabel
  u: string; // 원본 entry.updatedAt — 불일치 시 재계산
}

type VecStore = Record<string, CachedVec>;

function loadStore(): VecStore {
  try {
    return JSON.parse(localStorage.getItem(VEC_KEY) ?? "{}") as VecStore;
  } catch {
    return {};
  }
}

function saveStore(s: VecStore): void {
  localStorage.setItem(VEC_KEY, JSON.stringify(s));
}

function encodeVec(vec: Float32Array): { v: string; s: number } {
  let maxAbs = 0;
  for (let d = 0; d < vec.length; d++) maxAbs = Math.max(maxAbs, Math.abs(vec[d]));
  const scale = maxAbs / 127 || 1;
  const q = new Uint8Array(vec.length);
  for (let d = 0; d < vec.length; d++) {
    q[d] = (Math.max(-127, Math.min(127, Math.round(vec[d] / scale))) + 256) & 0xff;
  }
  let bin = "";
  for (let i = 0; i < q.length; i += 4096) bin += String.fromCharCode(...q.subarray(i, i + 4096));
  return { v: btoa(bin), s: scale };
}

function decodeVec(c: CachedVec): Float32Array {
  const bin = atob(c.v);
  const out = new Float32Array(DIM);
  for (let d = 0; d < DIM; d++) {
    let b = bin.charCodeAt(d);
    if (b > 127) b -= 256;
    out[d] = b * c.s;
  }
  return out;
}

function cosine(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let d = 0; d < a.length; d++) {
    dot += a[d] * b[d];
    na += a[d] * a[d];
    nb += b[d] * b[d];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

// ---- 기념일 회상 ----

export interface Anniversary {
  entry: Entry;
  label: string; // "1년 전 오늘"
}

function localDateKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** 오늘 기준 1년/6개월/1개월/1주 전 같은 날의 새김 */
export function anniversaries(entries: Entry[], now: Date = new Date()): Anniversary[] {
  const marks: { label: string; date: Date }[] = [];
  const back = (label: string, fn: (d: Date) => void) => {
    const d = new Date(now);
    fn(d);
    marks.push({ label, date: d });
  };
  back("1년 전 오늘", (d) => d.setFullYear(d.getFullYear() - 1));
  back("6개월 전 오늘", (d) => d.setMonth(d.getMonth() - 6));
  back("한 달 전 오늘", (d) => d.setMonth(d.getMonth() - 1));
  back("한 주 전 오늘", (d) => d.setDate(d.getDate() - 7));

  const out: Anniversary[] = [];
  for (const m of marks) {
    const key = `${m.date.getFullYear()}-${m.date.getMonth()}-${m.date.getDate()}`;
    for (const e of entries) {
      if (localDateKey(e.createdAt) === key) {
        out.push({ entry: e, label: m.label });
        break; // 표식당 하나면 충분
      }
    }
  }
  return out;
}

// ---- 새김 임베딩 캐시 ----

/** 분석 가능 상태인가 (모델 준비 또는 캐시 존재) */
export async function canReflect(): Promise<boolean> {
  return isSemanticReady() || (await isSemanticCached());
}

/**
 * 벡터가 없는(또는 수정된) 새김을 한 번에 limit개까지 분석해 캐시.
 * 새로 계산한 개수를 반환 — 0이면 전부 최신.
 */
export async function ensureVectors(entries: Entry[], limit = 8): Promise<number> {
  const store = loadStore();
  let done = 0;
  for (const e of entries) {
    if (done >= limit) break;
    if (!e.body.trim()) continue;
    const c = store[e.id];
    if (c && c.u === e.updatedAt) continue;
    const { vec, themeId, themeLabel } = await analyzeText(e.body);
    const { v, s } = encodeVec(vec);
    store[e.id] = { v, s, t: themeId, l: themeLabel, u: e.updatedAt };
    done++;
  }
  if (done > 0) {
    // 삭제된 새김의 벡터 정리
    const ids = new Set(entries.map((e) => e.id));
    for (const id of Object.keys(store)) if (!ids.has(id)) delete store[id];
    saveStore(store);
  }
  return done;
}

/** 캐시된 주제 라벨 (없으면 null) */
export function themeOf(entryId: string): { id: string; label: string } | null {
  const c = loadStore()[entryId];
  return c ? { id: c.t, label: c.l } : null;
}

/** 캐시 기준, 주어진 새김과 닮은 지난 새김 top-k */
export function similarEntries(entryId: string, entries: Entry[], k = 2): Entry[] {
  const store = loadStore();
  const me = store[entryId];
  if (!me) return [];
  const myVec = decodeVec(me);
  const scored: { e: Entry; score: number }[] = [];
  for (const e of entries) {
    if (e.id === entryId) continue;
    const c = store[e.id];
    if (!c) continue;
    scored.push({ e, score: cosine(myVec, decodeVec(c)) });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k).map((s) => s.e);
}
