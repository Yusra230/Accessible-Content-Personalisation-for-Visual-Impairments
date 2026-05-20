/**
 * background.js — AccessAI Extension Background Service Worker
 *
 * Receives user stats from content.js and stores for popup to use.
 */

let latestStats = {};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "USER_STATS") {
    latestStats[sender.tab?.id] = message.payload;
  }
  if (message.type === "GET_STATS") {
    sendResponse(latestStats[message.tabId] || {});
  }
});
