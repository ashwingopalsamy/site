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

/**
 * RFC 7231 Compliant Content Negotiation
 * Picks the best media type from 'supported' based on the 'Accept' header.
 * Respects q-values, specificity, and client preference order.
 */
function negotiate(header, supported) {
  if (!header) return supported[0];
  
  const preferences = header.split(',')
    .map((part, index) => {
      const [type, ...params] = part.split(';').map(s => s.trim());
      const qParam = params.find(p => p.startsWith('q='));
      const qValue = qParam ? parseFloat(qParam.split('=')[1]) : 1.0;
      const q = isNaN(qValue) ? 1.0 : qValue;
      
      const [main, sub] = type.split('/');
      let specificity = 0;
      if (main !== '*' && sub !== '*') specificity = 2;
      else if (main !== '*') specificity = 1;
      
      return { type: type.toLowerCase(), q, specificity, index };
    })
    .filter(p => p.q > 0)
    .sort((a, b) => (b.q - a.q) || (b.specificity - a.specificity) || (a.index - b.index));

  for (const pref of preferences) {
    if (pref.type === '*/*' || pref.type === 'text/*') {
      return supported[0]; // Default to HTML for generic requests
    }
    const match = supported.find(s => s === pref.type);
    if (match) return match;
  }
  return null;
}

/**
 * Checks if a specific type is acceptable at all (q > 0)
 */
function isAcceptable(header, type) {
  if (!header) return true;
  const parts = header.split(',').map(p => {
     const [t, ...params] = p.split(';').map(s => s.trim());
     const qParam = params.find(pr => pr.startsWith('q='));
     const q = qParam ? parseFloat(qParam.split('=')[1]) : 1.0;
     return { type: t.toLowerCase(), q: isNaN(q) ? 1.0 : q };
  });
  const match = parts.find(p => p.type === type || p.type === '*/*' || p.type === 'text/*');
  return match ? match.q > 0 : false;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;

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

    // RFC 9727 API Catalog — discovery document
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

    const acceptHeader = request.headers.get('Accept');
    const supported = ['text/html', 'text/markdown'];
    const bestType = negotiate(acceptHeader, supported);

    // 406 Not Acceptable if client explicitly requests something we don't have
    if (acceptHeader && bestType === null) {
      return new Response('406 Not Acceptable: Only text/html and text/markdown are supported', { 
        status: 406,
        headers: { 'Vary': 'Accept' }
      });
    }

    // Handle Markdown Negotiation
    if (bestType === 'text/markdown') {
      let mdUrl = new URL(request.url);
      if (!mdUrl.pathname.endsWith('/')) {
        // If it's a file-like path (has extension), don't append index.md unless it's known content
        if (!mdUrl.pathname.includes('.')) mdUrl.pathname += '/';
      }
      if (mdUrl.pathname.endsWith('/')) mdUrl.pathname += 'index.md';
      else if (!mdUrl.pathname.endsWith('.md')) mdUrl.pathname += '.md';

      try {
        const mdAsset = await env.ASSETS.fetch(new Request(mdUrl.toString(), { method: 'GET' }));
        if (mdAsset.ok) {
          const mdHeaders = new Headers(mdAsset.headers);
          mdHeaders.set('Content-Type', 'text/markdown; charset=utf-8');
          mdHeaders.set('Vary', 'Accept');
          mdHeaders.set('Link', LINK_HEADER);
          return new Response(mdAsset.body, { status: 200, headers: mdHeaders });
        }
        
        // Fallback to HTML ONLY if acceptable
        if (!isAcceptable(acceptHeader, 'text/html')) {
          return new Response('406 Not Acceptable: Markdown version not found for this resource', { 
            status: 406,
            headers: { 'Vary': 'Accept' }
          });
        }
      } catch (e) {
        if (!isAcceptable(acceptHeader, 'text/html')) {
          return new Response('Error fetching markdown asset', { status: 500 });
        }
      }
    }

    // Standard HTML Path
    let response;
    try {
      response = await env.ASSETS.fetch(request);
    } catch (e) {
      return new Response('<!doctype html><html><head><title>502</title></head><body><h1>Service unavailable</h1></body></html>', {
        status: 502,
        headers: {
          'Content-Type': 'text/html;charset=utf-8',
          'Vary': 'Accept'
        }
      });
    }

    const contentType = response.headers.get('content-type') || '';

    // Non-HTML assets (CSS, JS, Images, etc.)
    if (!contentType.includes('text/html')) {
      const assetHeaders = new Headers(response.headers);
      assetHeaders.set('Vary', 'Accept');
      return new Response(response.body, { status: response.status, headers: assetHeaders });
    }

    // HTML Rewriting (CSP + Nonce)
    const nonce = generateNonce();
    const rewritten = new HTMLRewriter()
      .on('script', new ScriptNonceInjector(nonce))
      .on('style', new StyleNonceInjector(nonce))
      .transform(response);

    const htmlHeaders = new Headers(rewritten.headers);
    htmlHeaders.set('Content-Security-Policy', buildCsp(nonce));
    htmlHeaders.set('Vary', 'Accept');
    htmlHeaders.set('Link', LINK_HEADER);
    htmlHeaders.set('Content-Type', 'text/html; charset=utf-8');

    return new Response(rewritten.body, {
      status: rewritten.status,
      headers: htmlHeaders
    });
  }
};
