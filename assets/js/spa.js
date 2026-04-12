/* ashwingopalsamy.in -- spa.js (client-side navigation) */

(function() {
  var cache = {};
  var prefetchTimer = null;
  var scrollPositions = {};

  function isInternalLink(a) {
    if (!a || !a.href) return false;
    if (a.target === '_blank') return false;
    if (a.hasAttribute('download')) return false;
    if (a.origin !== window.location.origin) return false;
    if (a.pathname === window.location.pathname && a.hash) return false;
    return true;
  }

  function parsePage(html) {
    var doc = new DOMParser().parseFromString(html, 'text/html');
    var main = doc.querySelector('main');
    var title = doc.querySelector('title');
    return {
      mainContent: main ? main.cloneNode(true) : null,
      title: title ? title.textContent : document.title,
      doc: doc
    };
  }

  function fetchPage(url) {
    if (cache[url]) return Promise.resolve(cache[url]);
    return fetch(url, { credentials: 'same-origin' }).then(function(res) {
      if (!res.ok) return null;
      var ct = res.headers.get('content-type') || '';
      if (!ct.includes('text/html')) return null;
      return res.text().then(function(html) {
        var parsed = parsePage(html);
        if (parsed.mainContent) cache[url] = parsed;
        return parsed;
      });
    }).catch(function() { return null; });
  }

  function updateNav(pathname) {
    document.querySelectorAll('.desktop-nav-link').forEach(function(link) {
      var href = link.getAttribute('href');
      var isActive = (href === pathname) ||
        (href !== '/' && pathname.indexOf(href) === 0) ||
        (href === '/writing/' && pathname.indexOf('/tags/') === 0);
      link.classList.toggle('active', isActive);
      if (isActive) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });

    document.querySelectorAll('.capsule-bar .cap').forEach(function(cap) {
      var href = cap.getAttribute('href');
      var isActive = (href === pathname) ||
        (href !== '/' && pathname.indexOf(href) === 0);
      cap.classList.toggle('on', isActive);
      if (isActive) cap.setAttribute('aria-current', 'page');
      else cap.removeAttribute('aria-current');
    });
  }

  function updateProgressBar(pathname) {
    var bar = document.getElementById('reading-progress');
    if (bar) bar.style.display = (pathname === '/') ? 'none' : '';
  }

  function replaceMain(parsed) {
    var main = document.querySelector('main');
    // Use DOM replacement instead of innerHTML for safety
    while (main.firstChild) main.removeChild(main.firstChild);
    var children = parsed.mainContent.childNodes;
    for (var i = 0; i < children.length; i++) {
      main.appendChild(document.importNode(children[i], true));
    }
  }

  function navigate(url, isPop) {
    var doSwap = cache[url] ? Promise.resolve(cache[url]) : fetchPage(url);

    doSwap.then(function(parsed) {
      if (!parsed || !parsed.mainContent) {
        window.location.href = url;
        return;
      }

      if (!isPop) scrollPositions[window.location.href] = window.scrollY;

      function swap() {
        replaceMain(parsed);
        document.title = parsed.title;

        var newMeta = parsed.doc.querySelector('meta[name="description"]');
        var curMeta = document.querySelector('meta[name="description"]');
        if (newMeta && curMeta) curMeta.setAttribute('content', newMeta.getAttribute('content'));

        var newCanon = parsed.doc.querySelector('link[rel="canonical"]');
        var curCanon = document.querySelector('link[rel="canonical"]');
        if (newCanon && curCanon) curCanon.setAttribute('href', newCanon.getAttribute('href'));

        var pathname = new URL(url, window.location.origin).pathname;
        updateNav(pathname);
        updateProgressBar(pathname);

        // Update topbar actions (share btn changes per page)
        var topbarActions = document.querySelector('.topbar-actions');
        var newActions = parsed.doc.querySelector('.topbar-actions');
        if (topbarActions && newActions) {
          while (topbarActions.firstChild) topbarActions.removeChild(topbarActions.firstChild);
          for (var i = 0; i < newActions.childNodes.length; i++) {
            topbarActions.appendChild(document.importNode(newActions.childNodes[i], true));
          }
          // Re-bind theme toggle on new buttons
          topbarActions.querySelectorAll('[data-theme-toggle]').forEach(function(btn) {
            btn.addEventListener('click', function() {
              // Trigger theme change via the same code path
              var html = document.documentElement;
              var current = html.getAttribute('data-theme') || 'light';
              var next = current === 'dark' ? 'light' : 'dark';
              html.setAttribute('data-theme', next);
              localStorage.setItem('theme', next);
            });
          });
          topbarActions.querySelectorAll('[data-search-trigger]').forEach(function(btn) {
            btn.addEventListener('click', function() {
              var modal = document.getElementById('search-modal');
              if (modal) modal.classList.toggle('open');
            });
          });
        }

        if (!isPop) {
          history.pushState({ spa: true }, '', url);
          window.scrollTo(0, 0);
        } else {
          window.scrollTo(0, scrollPositions[url] || 0);
        }

        var searchModal = document.getElementById('search-modal');
        if (searchModal) searchModal.classList.remove('open');

        if (typeof window.initPage === 'function') window.initPage();
      }

      if (document.startViewTransition) {
        document.startViewTransition(swap);
      } else {
        swap();
      }
    });
  }

  // Click interception
  document.addEventListener('click', function(e) {
    if (e.defaultPrevented) return;
    if (e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    var a = e.target.closest('a');
    if (!isInternalLink(a)) return;
    if (a.pathname === window.location.pathname) return;

    e.preventDefault();
    navigate(a.href, false);
  });

  // Popstate (back/forward)
  window.addEventListener('popstate', function() {
    navigate(window.location.href, true);
  });

  history.replaceState({ spa: true }, '', window.location.href);

  // Prefetch on hover (65ms delay)
  document.addEventListener('mouseover', function(e) {
    var a = e.target.closest('a');
    if (!isInternalLink(a)) return;
    if (cache[a.href]) return;
    clearTimeout(prefetchTimer);
    prefetchTimer = setTimeout(function() { fetchPage(a.href); }, 65);
  });

  document.addEventListener('mouseout', function(e) {
    if (e.target.closest('a')) clearTimeout(prefetchTimer);
  });

  // Prefetch on touchstart (mobile, no delay)
  document.addEventListener('touchstart', function(e) {
    var a = e.target.closest('a');
    if (isInternalLink(a) && !cache[a.href]) fetchPage(a.href);
  }, { passive: true });
})();
