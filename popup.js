const DEFAULT_RATIO = 0.8;
const slider = document.getElementById("slider");
const label = document.getElementById("value");

function show(v) {
  label.textContent = Number(v).toFixed(2);
}

chrome.storage.sync.get({ shortLineRatio: DEFAULT_RATIO }, (r) => {
  slider.value = r.shortLineRatio;
  show(r.shortLineRatio);
});

slider.addEventListener("input", () => {
  const v = parseFloat(slider.value);
  show(v);
  chrome.storage.sync.set({ shortLineRatio: v });
});

document.getElementById("reset").addEventListener("click", () => {
  slider.value = DEFAULT_RATIO;
  show(DEFAULT_RATIO);
  chrome.storage.sync.set({ shortLineRatio: DEFAULT_RATIO });
});

// ---- スペース削除スイッチ ----
const removeSpacesBox = document.getElementById("removeSpaces");
chrome.storage.sync.get({ removeSpaces: true }, (r) => {
  removeSpacesBox.checked = r.removeSpaces;
});
removeSpacesBox.addEventListener("change", () => {
  chrome.storage.sync.set({ removeSpaces: removeSpacesBox.checked });
});

// ---- メモ帳 ----
const memo = document.getElementById("memo");
const copyStatus = document.getElementById("copyStatus");

// ポップアップは他をクリックすると閉じるので、内容を保存しておく
chrome.storage.local.get({ memo: "" }, (r) => {
  memo.value = r.memo;
});
memo.addEventListener("input", () => {
  chrome.storage.local.set({ memo: memo.value });
});

function flash(msg) {
  copyStatus.textContent = msg;
  setTimeout(() => (copyStatus.textContent = ""), 1500);
}

document.getElementById("copy").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(memo.value);
  } catch {
    memo.select();
    document.execCommand("copy");
  }
  flash("コピーしました");
});

document.getElementById("clear").addEventListener("click", () => {
  memo.value = "";
  chrome.storage.local.set({ memo: "" });
  memo.focus();
});
