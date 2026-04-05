var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// workers/csp-nonce.js
function generateNonce() {
  var bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  var binary = "";
  for (var i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
__name(generateNonce, "generateNonce");
function buildCsp(nonce) {
  return [
    "default-src 'self'",
    "script-src 'self' 'nonce-" + nonce + "' https://plausible.io https://giscus.app",
    "style-src 'self' 'nonce-" + nonce + "'",
    "img-src 'self' data:",
    "font-src 'self'",
    "frame-src https://giscus.app",
    "connect-src 'self' https://plausible.io",
    "form-action 'self' https://buttondown.com",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "worker-src 'none'",
    "require-trusted-types-for 'script'",
    "upgrade-insecure-requests"
  ].join("; ");
}
__name(buildCsp, "buildCsp");
var StyleNonceInjector = class {
  static {
    __name(this, "StyleNonceInjector");
  }
  constructor(nonce) {
    this.nonce = nonce;
  }
  element(el) {
    if (!el.getAttribute("nonce")) {
      el.setAttribute("nonce", this.nonce);
    }
  }
};
var ScriptNonceInjector = class {
  static {
    __name(this, "ScriptNonceInjector");
  }
  constructor(nonce) {
    this.nonce = nonce;
  }
  element(el) {
    var type = el.getAttribute("type");
    if (type && type !== "text/javascript" && type !== "module") return;
    if (!el.getAttribute("nonce")) {
      el.setAttribute("nonce", this.nonce);
    }
  }
};
var csp_nonce_default = {
  async fetch(request, env) {
    var response;
    try {
      response = await env.ASSETS.fetch(request);
    } catch (e) {
      return new Response("<!doctype html><html><head><title>502</title></head><body><h1>Service unavailable</h1></body></html>", {
        status: 502,
        headers: {
          "Content-Type": "text/html;charset=utf-8",
          "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
          "X-Content-Type-Options": "nosniff",
          "X-Frame-Options": "DENY"
        }
      });
    }
    var contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) {
      return response;
    }
    var nonce = generateNonce();
    var rewritten = new HTMLRewriter().on("script", new ScriptNonceInjector(nonce)).on("style", new StyleNonceInjector(nonce)).transform(response);
    var headers = new Headers(rewritten.headers);
    headers.set("Content-Security-Policy", buildCsp(nonce));
    return new Response(rewritten.body, {
      status: rewritten.status,
      statusText: rewritten.statusText,
      headers
    });
  }
};
export {
  csp_nonce_default as default
};
//# sourceMappingURL=csp-nonce.js.map
