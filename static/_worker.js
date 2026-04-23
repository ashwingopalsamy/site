function generateNonce() {
  var bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  var binary = '';
  for (var i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function buildCsp(nonce) {
  return [
    "default-src 'self'",
    "script-src 'self' 'nonce-" + nonce + "' https://plausible.io",
    "style-src 'self' 'unsafe-inline' 'nonce-" + nonce + "'",
    "img-src 'self' data:",
    "font-src 'self'",
    "frame-src 'none'",
    "connect-src 'self' https://plausible.io",
    "form-action 'self' https://buttondown.com",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "worker-src 'self'",
    "upgrade-insecure-requests"
  ].join('; ');
}

// RFC 8288 Link header — protocol-level resource pointers for agents and crawlers
const LINK_HEADER = [
  '</.well-known/api-catalog>; rel="api-catalog"',
  '</openapi.json>; rel="service-desc"; type="application/vnd.oai.openapi+json"',
  '</llms.txt>; rel="describedby"; type="text/plain"',
  '</.well-known/mcp-server-card>; rel="https://modelcontextprotocol.io/rel/server-card"'
].join(', ');

// SEP-2127 MCP Server Card — served inline with CORS per spec requirement
const MCP_SERVER_CARD = JSON.stringify({
  "$schema": "https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json",
  "name": "in.ashwingopalsamy/site",
  "version": "1.0.0",
  "title": "Ashwin Gopalsamy",
  "description": "Knowledge graph, LLM-optimized content, and technical writing by Ashwin Gopalsamy — Staff Software Engineer specializing in distributed systems and fintech infrastructure at Visa's Pismo platform.",
  "websiteUrl": "https://ashwingopalsamy.in"
});

// RFC 9727 API Catalog — linkset+json discovery document for this domain's APIs
const API_CATALOG = JSON.stringify({
  linkset: [
    {
      anchor: "https://ashwingopalsamy.in",
      "service-desc": [
        { href: "https://ashwingopalsamy.in/openapi.json", type: "application/vnd.oai.openapi+json;version=3.1" }
      ],
      "service-doc": [
        { href: "https://ashwingopalsamy.in/llms.txt", type: "text/plain" }
      ],
      describedby: [
        { href: "https://ashwingopalsamy.in/knowledge.json", type: "application/json" }
      ]
    }
  ]
});

class StyleNonceInjector {
  constructor(nonce) {
    this.nonce = nonce;
  }
  element(el) {
    if (!el.getAttribute('nonce')) {
      el.setAttribute('nonce', this.nonce);
    }
  }
}

class ScriptNonceInjector {
  constructor(nonce) {
    this.nonce = nonce;
  }
  element(el) {
    var type = el.getAttribute('type');
    if (type && type !== 'text/javascript' && type !== 'module') return;
    if (!el.getAttribute('nonce')) {
      el.setAttribute('nonce', this.nonce);
    }
  }
}

export default {
  async fetch(request, env) {
    var url = new URL(request.url);
    var pathname = url.pathname;

    // SEP-2127 MCP Server Card — canonical path per spec, CORS required
    if (pathname === '/.well-known/mcp-server-card') {
      return new Response(MCP_SERVER_CARD, {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Cache-Control': 'public, max-age=3600',
          'Link': LINK_HEADER
        }
      });
    }

    // RFC 9727 API Catalog — served inline to avoid content-type mismatch on extensionless path
    if (pathname === '/.well-known/api-catalog') {
      return new Response(API_CATALOG, {
        status: 200,
        headers: {
          'Content-Type': 'application/linkset+json',
          'Link': LINK_HEADER,
          'Cache-Control': 'public, max-age=86400',
          'Vary': 'Accept'
        }
      });
    }

    var response;

    var acceptHeader = request.headers.get('Accept') || '';
    if (acceptHeader.includes('text/markdown')) {
      var mdUrl = new URL(request.url);
      var mdPathname = mdUrl.pathname;
      if (!mdPathname.endsWith('/')) mdPathname += '/';
      mdUrl.pathname = mdPathname + 'index.md';
      try {
        var mdAsset = await env.ASSETS.fetch(new Request(mdUrl.toString(), { method: 'GET' }));
        if (mdAsset.ok) {
          var mdHeaders = new Headers();
          mdHeaders.set('Content-Type', 'text/markdown; charset=utf-8');
          mdHeaders.set('Vary', 'Accept');
          mdHeaders.set('Link', LINK_HEADER);
          mdHeaders.set('Cache-Control', mdAsset.headers.get('Cache-Control') || 'public, max-age=3600');
          return new Response(mdAsset.body, { status: 200, headers: mdHeaders });
        }
      } catch (e) {
        // fall through to HTML
      }
    }

    try {
      response = await env.ASSETS.fetch(request);
    } catch (e) {
      return new Response('<!doctype html><html><head><title>502</title></head><body><h1>Service unavailable</h1></body></html>', {
        status: 502,
        headers: {
          'Content-Type': 'text/html;charset=utf-8',
          'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'",
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY'
        }
      });
    }
    var contentType = response.headers.get('content-type') || '';

    if (!contentType.includes('text/html')) {
      var nonHtmlHeaders = new Headers(response.headers);
      nonHtmlHeaders.set('Vary', 'Accept');
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers: nonHtmlHeaders });
    }

    var nonce = generateNonce();

    var rewritten = new HTMLRewriter()
      .on('script', new ScriptNonceInjector(nonce))
      .on('style', new StyleNonceInjector(nonce))
      .transform(response);

    var headers = new Headers(rewritten.headers);
    headers.set('Content-Security-Policy', buildCsp(nonce));
    headers.set('Vary', 'Accept');
    headers.set('Link', LINK_HEADER);

    return new Response(rewritten.body, {
      status: rewritten.status,
      statusText: rewritten.statusText,
      headers: headers
    });
  }
};
