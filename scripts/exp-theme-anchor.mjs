// 실험: 주제 앵커 가설 검증 — 일기 쿼리 → 주제(앵커 문장) 분류 정확도
// 앵커는 골든셋 쿼리의 표절이 아니라 같은 주제의 다른 상황·표현으로 작성했다.
// 사용법: node scripts/exp-theme-anchor.mjs

import { pipeline } from "@huggingface/transformers";
import { readFile } from "node:fs/promises";
import path from "node:path";

const THEMES = [
  {
    id: "anxiety",
    anchors: [
      "걱정이 많아서 마음이 불안하고 초조하다",
      "앞으로 일이 어떻게 될지 몰라 두렵다",
      "결과를 기다리는데 마음이 조마조마하다",
    ],
  },
  {
    id: "grief-care",
    anchors: [
      "가족이 아파서 마음이 아프고 걱정된다",
      "사랑하는 사람이 아프다. 간호하며 마음이 무너진다",
      "슬픔이 깊어 눈물이 난다",
    ],
  },
  {
    id: "gratitude",
    anchors: [
      "바라던 일이 이루어져서 감사하다",
      "기도가 응답되어 기쁘고 감사한 마음이다",
      "좋은 소식을 들었다. 감사가 넘친다",
    ],
  },
  {
    id: "conflict",
    anchors: [
      "사람과 다투고 나서 화가 나고 마음이 상했다",
      "관계가 틀어져서 미움과 분노가 올라온다",
      "누군가와 싸웠다. 용서가 안 된다",
    ],
  },
  {
    id: "decision",
    anchors: [
      "중요한 선택을 앞두고 어떻게 해야 할지 모르겠다",
      "갈림길에 서 있다. 지혜가 필요하다",
      "결정을 내려야 하는데 확신이 없다",
    ],
  },
  {
    id: "fatigue",
    anchors: [
      "일이 많아서 지치고 피곤하다",
      "쉬고 싶다. 힘이 하나도 없다",
      "몸과 마음이 소진되어 무기력하다",
    ],
  },
  {
    id: "loneliness",
    anchors: [
      "혼자인 것 같아 외롭다",
      "새로운 환경에서 적응하기 힘들고 쓸쓸하다",
      "곁에 아무도 없는 것처럼 느껴진다",
    ],
  },
  {
    id: "finance",
    anchors: [
      "돈이 부족해서 걱정이 크다",
      "경제적인 어려움으로 마음이 눌린다",
      "먹고사는 문제가 막막하다",
    ],
  },
  {
    id: "guilt",
    anchors: [
      "잘못을 저질러서 마음이 괴롭다",
      "죄책감에 마음이 무겁다. 용서받고 싶다",
      "부끄러운 일을 했다. 후회가 된다",
    ],
  },
  {
    id: "wonder",
    anchors: [
      "아이를 보며 생명의 신비를 느낀다",
      "놀랍고 경이로운 순간을 경험했다",
      "작은 것에서 큰 감동을 받았다",
    ],
  },
];

const golden = JSON.parse(await readFile(path.resolve("scripts/goldenset.json"), "utf8"));
const extractor = await pipeline("feature-extraction", "Xenova/multilingual-e5-small", { dtype: "fp32" });

async function embed(texts, prefix) {
  const out = await extractor(texts.map((t) => `${prefix}${t}`), { pooling: "mean", normalize: true });
  const dim = out.dims[out.dims.length - 1];
  const arr = [];
  for (let i = 0; i < texts.length; i++) arr.push(Array.from(out.data.slice(i * dim, (i + 1) * dim)));
  out.dispose?.();
  return arr;
}

// 앵커는 passage 취급 (검색 대상), 쿼리는 query
const anchorTexts = THEMES.flatMap((t) => t.anchors);
const anchorThemes = THEMES.flatMap((t) => t.anchors.map(() => t.id));
const anchorVecs = await embed(anchorTexts, "passage: ");

let top1 = 0;
for (const g of golden) {
  const [q] = await embed([g.query], "query: ");
  const scored = anchorVecs
    .map((a, i) => ({ theme: anchorThemes[i], text: anchorTexts[i], score: a.reduce((s, x, d) => s + x * q[d], 0) }))
    .sort((a, b) => b.score - a.score);
  const hit = scored[0].theme === g.id;
  if (hit) top1++;
  console.log(`${hit ? "✓" : "✗"} [${g.id}] → ${scored[0].theme} (${scored[0].score.toFixed(3)}) / 2위 ${scored[1].theme} (${scored[1].score.toFixed(3)})`);
}
console.log(`\n주제 top-1 정확도: ${top1}/${golden.length}`);
