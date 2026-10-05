// 共通の整形ロジック（content.js から読み込まれます）

const PARAGRAPH_GAP = "\n\n"; // 段落の区切りで残す改行。空行を入れるなら "\n\n"、詰めるなら "\n"
const LINE_GAP = "\n"; // 箇条書き・台詞が続くときの改行（空行なし）
// 文末とみなす終端（この文字で終わる行の改行は残す）
const SENTENCE_END = /(?:[。！？!?》]|[。！？!?][」』）)】])$/;
// 段落の終わりとみなす終端（短い行がこれで終わっていれば見出しではなく段落末）
const PARAGRAPH_END = /[。！？!?」』）)】〕》…―]$/;
// 見出し行（＜…＞、《…》、【…】 など、括弧で始まり括弧で閉じる1行）は独立行として扱う
const HEADING = /^[＜<《【〈［〔\[].*[＞>》】〉］〕\]]$/;
// 字下げ（段落の書き出し）
const INDENT = /^[　\t ]/;
// 箇条書き・番号付きの項目の書き出し
const ITEM_START =
  /^(?:[・●○◎■□◆◇▲△▼▽★☆※♪→⇒①-⑳⑴-⒇❶-❿]|[-*＊－]\s|[0-9０-９]{1,2}[.．)）](?![0-9０-９])|[(（][0-9０-９]{1,2}[)）]|第[0-9０-９一二三四五六七八九十]+[章節話幕項条])/;
// 行頭に来ない文字（禁則）。PDFでこれが行頭にあるなら、前の行の続き
const NO_LINE_START = /^[、。，．,」』）)】〕〉》ゝゞーぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ々！？!?：；]/;
// 行末に来ない文字（開き括弧）。これで終わる行は次の行に続く
const OPEN_END = /[「『（(【〔〈《［\[]$/;

// 表示幅の概算（全角=1、半角=0.5）
function width(s) {
  let w = 0;
  for (const ch of s) w += /[ -~｡-ﾟ]/.test(ch) ? 0.5 : 1;
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

// PDFの折り返し幅の推定。
// 折り返された行はほぼ同じ幅（±1文字：禁則の追い出し・ぶら下がり）に揃うので、
// 「最も多くの行が集まっている幅」を折り返し幅とみなす。
// 最長の行をそのまま使うと、URLや表など1行だけ長い行があったときに全体が狂うため。
function estimateWrapWidth(widths) {
  const ws = widths.filter((w) => w > 0);
  if (ws.length === 0) return 0;
  const max = Math.max(...ws);
  if (ws.length < 4) return max; // 行が少ないと集まりが見えないので最長行で代用

  let best = max;
  let bestCount = 0;
  for (const c of ws) {
    if (c < max * 0.5) continue; // 見出しや段落末の短い行は候補にしない
    let n = 0;
    for (const w of ws) if (Math.abs(w - c) <= 1) n++;
    if (n > bestCount || (n === bestCount && c > best)) {
      best = c;
      bestCount = n;
    }
  }
  return bestCount >= 2 ? best : max;
}

// options:
//   ratio            推定した折り返し幅に対して、この割合より短い行の後ろでは改行を残す
//   removeSpaces     日本語中の不要な半角スペースを削除する
//   headingBlankLine 見出し行の後に空行を入れる（false なら改行1つ）
// 互換のため formatText(text, ratio, removeSpaces) の形でも呼べます。
function formatText(text, options = {}, legacyRemoveSpaces) {
  if (typeof options === "number") options = { ratio: options, removeSpaces: legacyRemoveSpaces };
  const ratio = options.ratio ?? 0.8;
  const removeSpaces = options.removeSpaces ?? true;
  const headingGap = options.headingBlankLine ?? true ? "\n\n" : "\n";

  // 改行コードを統一（CR, LS, PS, VT, FF, NEL も改行扱い）
  text = text.replace(/\r\n|[\r\u2028\u2029\u000b\u000c\u0085]/g, "\n");

  // 日本語中の不要な半角スペースを削除（行の幅を測る前に行う）
  if (removeSpaces) text = removeJaSpaces(text);

  const allLines = text.split("\n").map((l) => l.replace(/[ \t　]+$/, ""));
  const wrapW = estimateWrapWidth(allLines.map(width));
  // 字下げで段落を始める文章か（それなら、字下げのない行は前の段落の続き）
  const usesIndent = allLines.filter((l) => INDENT.test(l) && l.trim()).length >= 2;

  // prev の後ろの改行をどうするか：null なら繋げる、文字列ならその改行を残す
  function gapAfter(prev, next) {
    if (HEADING.test(prev)) return headingGap; // 見出しの後
    if (HEADING.test(next)) return PARAGRAPH_GAP; // 見出しの前
    if (NO_LINE_START.test(next)) return null; // 「、」「。」などで始まる行は続き
    if (OPEN_END.test(prev)) return null; // 開き括弧で終わる行は続き

    const nextBody = next.replace(/^[　\t ]+/, "");
    if (ITEM_START.test(nextBody)) return LINE_GAP; // 箇条書きの項目
    if (/[」』]$/.test(prev) && /^[「『]/.test(nextBody)) return LINE_GAP; // 台詞が続く
    if (INDENT.test(next)) return PARAGRAPH_GAP; // 字下げ＝新しい段落

    if (width(prev) < wrapW * ratio) {
      // 折り返し幅より明らかに短い行：段落末か見出し
      return PARAGRAPH_END.test(prev) ? PARAGRAPH_GAP : headingGap;
    }
    if (SENTENCE_END.test(prev)) {
      // 折り返し幅いっぱいで文が終わっている行。
      // 字下げのある文章なら、次が字下げされていない限り同じ段落の続き
      return usesIndent ? null : PARAGRAPH_GAP;
    }
    return null; // 文の途中の改行
  }

  const paragraphs = text.split(/\n[ \t　]*(?=\n)/); // 空行で段落分割
  const result = [];

  for (const para of paragraphs) {
    const lines = para
      .split("\n")
      .map((l) => l.replace(/[ \t　]+$/, "")) // 行末の空白を除去
      .filter((l) => l.length > 0);
    if (lines.length === 0) continue;

    let out = lines[0];
    for (let i = 1; i < lines.length; i++) {
      const prev = lines[i - 1]; // 直前の「元の行」
      const next = lines[i];
      const gap = gapAfter(prev, next);
      if (gap !== null) out += gap + next;
      else if (needsSpace(prev, next)) out += " " + next;
      else out += next;
    }
    result.push(out);
  }
  return result.join("\n\n");
}
