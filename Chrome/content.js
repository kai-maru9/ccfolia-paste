// ココフォリア PDF貼り付け整形
// Ctrl+V        : 整形して貼り付け
// Ctrl+Shift+V  : 無加工で貼り付け（ココフォリア標準の動作）
// 整形ロジックは format.js（formatText）にあります。

// 値は拡張機能アイコンのポップアップ（スライダー）で変更でき、即座に反映されます。
const settings = {
  enabled: true, // 整形ペースト自体のオン/オフ
  shortLineRatio: 0.8,
  removeSpaces: true, // 日本語中の不要な半角スペースを削除するか
  headingBlankLine: true, // 見出し行の後に空行を入れるか
};
chrome.storage.sync.get(settings, (r) => Object.assign(settings, r));
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync") return;
  for (const key of Object.keys(settings)) {
    if (changes[key]) settings[key] = changes[key].newValue;
  }
});

let rawNext = false;

document.addEventListener(
  "keydown",
  (e) => {
    // Ctrl+Shift+V / Cmd+Shift+V は無加工貼り付け
    rawNext = (e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "v";
  },
  true
);

function insertText(el, text) {
  el.focus();
  // React管理のtextareaでも動き、Ctrl+Zで戻せる
  if (document.execCommand && document.execCommand("insertText", false, text)) return;

  // フォールバック
  const start = el.selectionStart;
  const end = el.selectionEnd;
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
  setter.call(el, el.value.slice(0, start) + text + el.value.slice(end));
  el.selectionStart = el.selectionEnd = start + text.length;
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

// いあきゃら等のキャラクターデータ（JSON）は整形せず、ココフォリア標準の処理に任せる
function isStructuredData(text) {
  const t = text.trim();
  if (!(t.startsWith("{") && t.endsWith("}"))) return false;
  try {
    JSON.parse(t);
    return true;
  } catch {
    return false;
  }
}

document.addEventListener(
  "paste",
  (e) => {
    const wasRaw = rawNext;
    rawNext = false;

    // テキスト入力欄にカーソルがある（フォーカスされている）ときだけ動作する
    const el = e.target;
    if (!(el instanceof HTMLTextAreaElement)) return;
    if (el.readOnly || el.disabled || document.activeElement !== el) return;

    if (!settings.enabled) return; // ポップアップでオフにされている
    if (wasRaw) return; // Ctrl+Shift+V は無加工貼り付け

    const text = e.clipboardData && e.clipboardData.getData("text/plain");
    if (!text || isStructuredData(text)) return;

    // 整形に失敗したら横取りせず、ココフォリア標準の貼り付けに任せる
    let formatted;
    try {
      formatted = formatText(text, {
        ratio: settings.shortLineRatio,
        removeSpaces: settings.removeSpaces,
        headingBlankLine: settings.headingBlankLine,
      });
    } catch (err) {
      console.error("[ccfolia-paste-fix] 整形に失敗しました:", err);
      return;
    }

    e.preventDefault();
    e.stopImmediatePropagation();
    insertText(el, formatted);
  },
  true
);
