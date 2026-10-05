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

// ---- スイッチ（整形ペースト本体・見出しの後の空行・スペース削除） ----
const formatSettings = document.getElementById("formatSettings");
const enabledState = document.getElementById("enabledState");

function showEnabled(on) {
  enabledState.textContent = on ? "オン" : "オフ";
  formatSettings.classList.toggle("off", !on);
}

function bindSwitch(key, defaultValue, onChange) {
  const box = document.getElementById(key);
  chrome.storage.sync.get({ [key]: defaultValue }, (r) => {
    box.checked = r[key];
    if (onChange) onChange(r[key]);
  });
  box.addEventListener("change", () => {
    chrome.storage.sync.set({ [key]: box.checked });
    if (onChange) onChange(box.checked);
  });
}

bindSwitch("enabled", true, showEnabled);
bindSwitch("headingBlankLine", true);
bindSwitch("removeSpaces", true);

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
