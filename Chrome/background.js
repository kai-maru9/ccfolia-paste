// 整形ペーストがオフのとき、ツールバーのアイコンに「OFF」と表示します。
function updateBadge(enabled) {
  chrome.action.setBadgeText({ text: enabled ? "" : "OFF" });
  chrome.action.setBadgeBackgroundColor({ color: "#888" });
}

chrome.storage.sync.get({ enabled: true }, (r) => updateBadge(r.enabled));
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.enabled) updateBadge(changes.enabled.newValue);
});
