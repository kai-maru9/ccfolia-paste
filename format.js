// 共通の整形ロジック（content.js と popup.js の両方から読み込まれます）

const PARAGRAPH_GAP = "\n\n"; // 文末で改行を残すとき、空行を入れるなら "\n\n"、詰めるなら "\n"
// 文末とみなす終端（この文字で終わる行の改行は残す）
const SENTENCE_END = /(?:[。！？!?》]|[。！？!?][」』）)】])$/;
// 見出し行（＜…＞、《…》、【…】 など、括弧で始まり括弧で閉じる1行）は独立行として扱う
const HEADING = /^[＜<《【〈［〔\[].*[＞>》】〉］〕\]]$/;

// 表示幅の概算（全角=1、半角=0.5）
function width(s) {
  let w = 0;
  for (const ch of s) w += /[\u0020-\u007e\uff61-\uff9f]/.test(ch) ? 0.5 : 1;
  return w;
}

// 日本語の文字（ひらがな・カタカナ・漢字・全角記号/句読点・半角カナ）
const JA = "\\u3000-\\u303f\\u3040-\\u309f\\u30a0-\\u30ff\\u3400-\\u4dbf\\u4e00-\\u9fff\\uf900-\\ufaff\\uff00-\\uffef";
// 日本語文字に隣接する半角スペース(U+0020)にマッチ（両側が英数字などの場合はマッチしない）
const JA_SPACE = new RegExp(` +(?=[${JA}])|(?<=[${JA}]) +`, "g");

// PDF/OCR由来の日本語中の不要な半角スペースを削除（英文の単語間スペースは残す）
function removeJaSpaces(text) {
  return text.replace(JA_SPACE, "");
}

function needsSpace(prev, next) {
  // 英数字どうしの改行は半角スペースで繋ぐ
  return /[A-Za-z0-9,.;:]$/.test(prev) && /^[A-Za-z0-9]/.test(next);
}

// ratio: 全文中で最も長い行（＝PDFの折り返し幅）に対して、この割合より短い行は
// 「そこで文章が終わっている行（見出し・段落末）」とみなして改行を残す
function formatText(text, ratio, removeSpaces = true) {
  // 改行コードを統一（CR, LS, PS, VT, FF, NEL も改行扱い）
  text = text.replace(/\r\n|[\r\u2028\u2029\u000b\u000c\u0085]/g, "\n");

  // 日本語中の不要な半角スペースを削除（行の幅を測る前に行う）
  if (removeSpaces) text = removeJaSpaces(text);

  // PDFの折り返し幅の推定：全行のうち最も長い行の幅
  const maxW = text
    .split("\n")
    .reduce((m, l) => Math.max(m, width(l.replace(/[ \t\u3000]+$/, ""))), 0);

  const paragraphs = text.split(/\n[ \t\u3000]*(?=\n)/); // 空行で段落分割
  const result = [];

  for (const para of paragraphs) {
    const lines = para
      .split("\n")
      .map((l) => l.replace(/[ \t\u3000]+$/, "")) // 行末の空白を除去
      .filter((l) => l.length > 0);
    if (lines.length === 0) continue;

    let out = lines[0];
    let prev = lines[0]; // 直前の「元の行」
    for (let i = 1; i < lines.length; i++) {
      const next = lines[i];
      const isShort = width(prev) < maxW * ratio;
      if (SENTENCE_END.test(prev) || HEADING.test(prev) || HEADING.test(next) || isShort) {
        out += PARAGRAPH_GAP + next; // 文末・見出しの前後は改行を残す
      } else if (needsSpace(prev, next)) {
        out += " " + next;
      } else {
        out += next; // 文の途中の改行は削除
      }
      prev = next;
    }
    result.push(out);
  }
  return result.join("\n\n");
}
