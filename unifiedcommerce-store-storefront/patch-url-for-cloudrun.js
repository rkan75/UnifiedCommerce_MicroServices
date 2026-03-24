/**
 * Cloud Run decodes URL paths before forwarding; Next.js 15 encodes @ in parallel
 * routes as %40. Re-encode so chunk requests succeed (Next.js #71626).
 * Run: node -r ./patch-url-for-cloudrun.js server.js
 */
const http = require("http");
const https = require("https");
const originalHttpCreate = http.createServer.bind(http);
const originalHttpsCreate = https.createServer.bind(https);

function wrapListener(listener) {
  return (req, res) => {
    if (req.url && req.url.startsWith("/_next/static/chunks/")) {
      // Cloud Run decodes %40→@, %5B→[, %5D→]; Next.js expects encoded form
      let fixed = req.url.replace(/@/g, "%40").replace(/\[/g, "%5B").replace(/\]/g, "%5D");
      if (fixed !== req.url) req.url = fixed;
    }
    return listener(req, res);
  };
}

function patchedCreate(original) {
  return function (a, b) {
    if (typeof a === "function") {
      return original(wrapListener(a));
    }
    if (typeof b === "function") {
      return original(a, wrapListener(b));
    }
    return original.apply(this, arguments);
  };
}

http.createServer = patchedCreate(originalHttpCreate);
https.createServer = patchedCreate(originalHttpsCreate);
