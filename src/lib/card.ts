/**
 * 말씀 카드 (v0.8.0) — 구절을 고서 디자인 그대로 PNG로.
 * 전부 로컬 캔버스 렌더링. 본문은 호출부가 로컬 DB에서 해석해 넘긴다 (절대 규칙 1).
 * 모바일에서는 공유 시트, 그 외에는 PNG 다운로드.
 */

const W = 1080;
const H = 1350;
const MARGIN = 96;
const FRAME_GAP = 14; // 사주쌍변 — 바깥 선과 안쪽 선 사이

const INK = "#10151F";
const HANJI = "#F7F3EA";
const DAWN = "#B77425"; // 인쇄물 기준 살짝 어두운 dawn (밝은 배경 대비 확보)
const SEAL = "#B6402F";
const MIST = "#8A94A6";

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  const pushWord = (w: string) => {
    const tryLine = line ? `${line} ${w}` : w;
    if (ctx.measureText(tryLine).width <= maxWidth) {
      line = tryLine;
      return;
    }
    if (line) lines.push(line);
    // 한 어절이 너무 길면 글자 단위로 쪼갠다
    if (ctx.measureText(w).width > maxWidth) {
      let chunk = "";
      for (const ch of w) {
        if (ctx.measureText(chunk + ch).width > maxWidth) {
          lines.push(chunk);
          chunk = ch;
        } else {
          chunk += ch;
        }
      }
      line = chunk;
    } else {
      line = w;
    }
  };
  for (const w of words) pushWord(w);
  if (line) lines.push(line);
  return lines;
}

function drawCard(text: string, label: string): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("카드를 그릴 수 없습니다");

  // 한지 바탕 + 은은한 얼룩
  ctx.fillStyle = HANJI;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "rgba(16, 21, 31, 0.018)";
  for (let i = 0; i < 2600; i++) {
    ctx.fillRect(Math.random() * W, Math.random() * H, 1.6, 1.6);
  }

  // 계선(사주쌍변)
  ctx.strokeStyle = "rgba(16, 21, 31, 0.32)";
  ctx.lineWidth = 2.5;
  ctx.strokeRect(MARGIN, MARGIN, W - MARGIN * 2, H - MARGIN * 2);
  ctx.lineWidth = 1.2;
  const g = MARGIN + FRAME_GAP;
  ctx.strokeRect(g, g, W - g * 2, H - g * 2);

  // 본문 — 길이에 맞춰 크기 조절
  const maxWidth = W - (MARGIN + 72) * 2;
  const maxHeight = H - MARGIN * 2 - 420;
  let fontSize = 56;
  let lines: string[] = [];
  for (; fontSize >= 26; fontSize -= 4) {
    ctx.font = `600 ${fontSize}px "Noto Serif KR", serif`;
    lines = wrapText(ctx, text, maxWidth);
    if (lines.length * fontSize * 1.72 <= maxHeight) break;
  }
  const lineH = fontSize * 1.72;
  const blockH = lines.length * lineH;
  const startY = MARGIN + 150 + (maxHeight - blockH) / 2 + lineH / 2;
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  lines.forEach((l, i) => ctx.fillText(l, W / 2, startY + i * lineH));

  // 출처
  ctx.font = `400 34px "Noto Serif KR", serif`;
  ctx.fillStyle = DAWN;
  const srcY = startY + blockH + 40;
  ctx.fillText(`— ${label} (개역한글)`, W / 2, srcY);

  // 기록 줄 — 출처와 최소 간격 확보
  const lineY = Math.max(H - MARGIN - 170, srcY + 70);
  ctx.strokeStyle = "rgba(16, 21, 31, 0.22)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 120, lineY);
  ctx.lineTo(W / 2 + 120, lineY);
  ctx.stroke();

  // 낙관 — 오른쪽 아래
  const sealSize = 88;
  const sx = W - MARGIN - FRAME_GAP - 60 - sealSize / 2;
  const sy = H - MARGIN - FRAME_GAP - 60 - sealSize / 2;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate((-3 * Math.PI) / 180);
  ctx.globalAlpha = 0.92;
  ctx.fillStyle = SEAL;
  const r = 8;
  ctx.beginPath();
  ctx.roundRect(-sealSize / 2, -sealSize / 2, sealSize, sealSize, r);
  ctx.fill();
  ctx.fillStyle = HANJI;
  ctx.font = `700 34px "Noto Serif KR", serif`;
  ctx.fillText("דבר", 0, 2);
  ctx.restore();

  // 워드마크
  ctx.fillStyle = MIST;
  ctx.font = `500 26px Pretendard, sans-serif`;
  ctx.fillText("다바르 · 말씀, 그리고 일어난 일", W / 2, H - MARGIN - 62);

  return canvas;
}

/** 구절 카드를 공유(모바일)하거나 PNG로 저장 */
export async function shareVerseCard(text: string, label: string): Promise<void> {
  await Promise.all([
    document.fonts.load('600 56px "Noto Serif KR"'),
    document.fonts.load('400 34px "Noto Serif KR"'),
    document.fonts.load("500 26px Pretendard"),
  ]).catch(() => {});
  const canvas = drawCard(text, label);
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
  if (!blob) throw new Error("카드를 만들지 못했습니다");
  const filename = `dabar-${label.replace(/[\s:]/g, "-")}.png`;

  const file = new File([blob], filename, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "다바르 말씀 카드" });
      return;
    } catch {
      // 사용자가 공유를 닫으면 저장으로 넘어가지 않고 조용히 끝
      return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
