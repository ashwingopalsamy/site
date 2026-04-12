/* ashwingopalsamy.in -- main.js */

// Safe SVG parser — avoids innerHTML (blocked by require-trusted-types-for 'script' CSP)
function parseSvgString(svgStr) {
  var doc = new DOMParser().parseFromString(svgStr, 'image/svg+xml');
  var svgEl = doc.documentElement;
  var frag = document.createDocumentFragment();
  frag.appendChild(document.importNode(svgEl, true));
  return frag;
}

// Theme toggle with radial reveal (View Transitions API + Web Animations)
document.querySelectorAll('[data-theme-toggle]').forEach(function(btn) {
  btn.addEventListener('click', function() {
    var html = document.documentElement;
    var current = html.getAttribute('data-theme') || 'light';
    var next = current === 'dark' ? 'light' : 'dark';

    function applyTheme() {
      html.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);
      if (typeof mermaid !== 'undefined') {
        mermaid.initialize({ theme: next === 'dark' ? 'dark' : 'default' });
        document.querySelectorAll('.mermaid').forEach(function(el) {
          var orig = el.getAttribute('data-original');
          if (orig) { el.removeAttribute('data-processed'); el.textContent = orig; }
        });
        mermaid.run();
      }
      var giscusFrame = document.querySelector('iframe.giscus-frame');
      if (giscusFrame) {
        giscusFrame.contentWindow.postMessage(
          { giscus: { setConfig: { theme: next === 'dark' ? 'noborder_dark' : 'noborder_light' } } },
          'https://giscus.app'
        );
      }
    }

    if (!document.startViewTransition) {
      applyTheme();
      return;
    }

    var rect = btn.getBoundingClientRect();
    var x = rect.left + rect.width / 2;
    var y = rect.top + rect.height / 2;
    var endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );

    var lightsOff = next === 'dark';
    var transition = document.startViewTransition(applyTheme);

    transition.ready.then(function() {
      if (lightsOff) {
        // Lights off: old (light) layer on top, shrinks toward button
        document.documentElement.animate(
          { zIndex: [9999, 9999] },
          { duration: 280, pseudoElement: '::view-transition-old(root)', fill: 'both' }
        );
        document.documentElement.animate(
          { zIndex: [1, 1] },
          { duration: 280, pseudoElement: '::view-transition-new(root)', fill: 'both' }
        );
        document.documentElement.animate(
          [
            { clipPath: 'circle(' + endRadius + 'px at ' + x + 'px ' + y + 'px)' },
            { clipPath: 'circle(0px at ' + x + 'px ' + y + 'px)' }
          ],
          {
            duration: 280,
            easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
            pseudoElement: '::view-transition-old(root)',
            fill: 'forwards'
          }
        );
      } else {
        // Lights on: new (light) layer on top, expands from button
        document.documentElement.animate(
          [
            { clipPath: 'circle(0px at ' + x + 'px ' + y + 'px)' },
            { clipPath: 'circle(' + endRadius + 'px at ' + x + 'px ' + y + 'px)' }
          ],
          {
            duration: 280,
            easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
            pseudoElement: '::view-transition-new(root)'
          }
        );
      }
    });
  });
});

// Reading progress (only on article pages)
var progressFill = document.querySelector('.reading-progress-fill');
if (progressFill) {
  window.addEventListener('scroll', function() {
    var docHeight = document.documentElement.scrollHeight - window.innerHeight;
    var scrolled = Math.min(Math.round((window.scrollY / docHeight) * 100), 100);
    progressFill.style.width = scrolled + '%';
  }, { passive: true });
}

// Code copy buttons (icon + tick animation)
function createCopyIcon() {
  var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '14');
  svg.setAttribute('height', '14');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  var rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  rect.setAttribute('x', '9'); rect.setAttribute('y', '9');
  rect.setAttribute('width', '13'); rect.setAttribute('height', '13');
  rect.setAttribute('rx', '2'); rect.setAttribute('ry', '2');
  var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1');
  svg.appendChild(rect);
  svg.appendChild(path);
  return svg;
}

function createCheckIcon() {
  var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '14');
  svg.setAttribute('height', '14');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2.5');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.classList.add('check-icon');
  var poly = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  poly.setAttribute('points', '20 6 9 17 4 12');
  svg.appendChild(poly);
  return svg;
}

document.querySelectorAll('pre').forEach(function(pre) {
  var btn = document.createElement('button');
  btn.className = 'copy-btn';
  btn.appendChild(createCopyIcon());
  btn.setAttribute('aria-label', 'Copy code');
  pre.style.position = 'relative';
  pre.appendChild(btn);
  btn.addEventListener('click', function() {
    var code = pre.querySelector('code');
    var text = code ? code.textContent : pre.textContent;
    navigator.clipboard.writeText(text).then(function() {
      btn.replaceChildren(createCheckIcon());
      btn.classList.add('copied');
      setTimeout(function() {
        btn.replaceChildren(createCopyIcon());
        btn.classList.remove('copied');
      }, 1500);
    });
  });
});

// Text selection share popup
(function() {
  var articleBody = document.querySelector('.article-body');
  if (!articleBody) return;

  var popup = document.createElement('div');
  popup.className = 'selection-share';
  popup.setAttribute('role', 'toolbar');
  popup.setAttribute('aria-label', 'Share selection');
  document.body.appendChild(popup);

  var pageUrl = encodeURIComponent(window.location.href);
  var hideTimeout;

  function showPopup(selectedText, rect) {
    var encoded = encodeURIComponent('"' + selectedText + '"');
    var x = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>';
    var li = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>';
    var rd = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/></svg>';

    popup.replaceChildren();
    var links = [
      { icon: x, url: 'https://x.com/intent/tweet?text=' + encoded + '&url=' + pageUrl, label: 'Share on X' },
      { icon: li, url: 'https://www.linkedin.com/sharing/share-offsite/?url=' + pageUrl, label: 'Share on LinkedIn' },
      { icon: rd, url: 'https://reddit.com/submit?url=' + decodeURIComponent(pageUrl) + '&title=' + encoded, label: 'Share on Reddit' }
    ];
    links.forEach(function(link) {
      var a = document.createElement('a');
      a.href = link.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.className = 'selection-share-btn';
      a.setAttribute('aria-label', link.label);
      var span = document.createElement('span');
      span.textContent = link.icon;
      a.replaceChildren();
      a.appendChild(parseSvgString(link.icon));
      popup.appendChild(a);
    });

    var popupWidth = 120;
    var left = rect.left + rect.width / 2 - popupWidth / 2 + window.scrollX;
    var top = rect.top - 44 + window.scrollY;

    left = Math.max(8, Math.min(left, window.innerWidth - popupWidth - 8));

    popup.style.left = left + 'px';
    popup.style.top = top + 'px';
    popup.classList.add('visible');
    clearTimeout(hideTimeout);
  }

  function hidePopup() {
    popup.classList.remove('visible');
  }

  articleBody.addEventListener('mouseup', function() {
    setTimeout(function() {
      var sel = window.getSelection();
      if (!sel || sel.isCollapsed) { hidePopup(); return; }
      var text = sel.toString().trim();
      if (text.length < 10 || text.length > 280) { hidePopup(); return; }
      var range = sel.getRangeAt(0);
      var rect = range.getBoundingClientRect();
      showPopup(text, rect);
    }, 10);
  });

  document.addEventListener('mousedown', function(e) {
    if (!popup.contains(e.target)) {
      hideTimeout = setTimeout(hidePopup, 150);
    }
  });

  window.addEventListener('scroll', hidePopup, { passive: true });
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') hidePopup();
  });
})();

// Scroll reveal
if ('IntersectionObserver' in window) {
  var revealObserver = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });
  document.querySelectorAll('.scroll-reveal').forEach(function(el) {
    revealObserver.observe(el);
  });
}

// Scroll-aware nav chrome
(function() {
  var topbarWrap = document.querySelector('.topbar-wrap');
  var capsuleBar = document.querySelector('.capsule-bar');
  if (!topbarWrap && !capsuleBar) return;
  window.addEventListener('scroll', function() {
    if (topbarWrap) topbarWrap.classList.toggle('scrolled', window.scrollY > 2);
    if (capsuleBar) {
      var atBottom = (window.innerHeight + window.scrollY) >= (document.documentElement.scrollHeight - 4);
      capsuleBar.classList.toggle('at-edge', atBottom);
    }
  }, { passive: true });
})();

// Back to top with scroll percentage
var btt = document.getElementById('back-to-top');
var bttPct = document.getElementById('bttPct');
if (btt) {
  window.addEventListener('scroll', function() {
    var docHeight = document.documentElement.scrollHeight - window.innerHeight;
    var halfway = document.documentElement.scrollHeight * 0.5;
    btt.classList.toggle('visible', window.scrollY > halfway);
    if (bttPct && docHeight > 0) {
      bttPct.textContent = Math.min(Math.round((window.scrollY / docHeight) * 100), 100) + '%';
    }
  }, { passive: true });
  btt.querySelector('button').addEventListener('click', function() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

// Blockquote border draw + image clip-reveal (IntersectionObserver)
if ('IntersectionObserver' in window) {
  var drawObserver = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add(entry.target.tagName === 'BLOCKQUOTE' ? 'scroll-drawn' : 'scroll-revealed');
        drawObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.3 });
  document.querySelectorAll('.article-body blockquote, .article-body img').forEach(function(el) {
    drawObserver.observe(el);
  });
}

// Reading time count-up
(function() {
  var badge = document.querySelector('.reading-time-badge');
  if (!badge) return;
  var text = badge.textContent;
  var match = text.match(/(\d+)/);
  if (!match) return;
  var target = parseInt(match[1], 10);
  if (target <= 1) return;
  var start = performance.now();
  badge.textContent = text.replace(/\d+/, '0');
  requestAnimationFrame(function tick(now) {
    var p = Math.min((now - start) / 200, 1);
    badge.textContent = text.replace(/\d+/, String(Math.round(p * target)));
    if (p < 1) requestAnimationFrame(tick);
  });
})();

// TOC active tracking + smooth scroll + heading flash
var tocLinks = document.querySelectorAll('.toc a');
if (tocLinks.length > 0) {
  var headings = [];
  var topBarHeight = 72;
  tocLinks.forEach(function(link) {
    var id = link.getAttribute('href').replace('#', '');
    var heading = document.getElementById(id);
    if (heading) headings.push({ el: heading, link: link.parentElement });
  });

  var tocObserver = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        tocLinks.forEach(function(l) { l.parentElement.classList.remove('active'); });
        var match = headings.find(function(h) { return h.el === entry.target; });
        if (match) match.link.classList.add('active');
      }
    });
  }, { rootMargin: '-80px 0px -60% 0px' });
  headings.forEach(function(h) { tocObserver.observe(h.el); });

  tocLinks.forEach(function(link) {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      var id = link.getAttribute('href').replace('#', '');
      var target = document.getElementById(id);
      if (!target) return;

      var y = target.getBoundingClientRect().top + window.scrollY - topBarHeight - 16;
      window.scrollTo({ top: y, behavior: 'smooth' });

      target.classList.remove('heading-flash');
      void target.offsetWidth;
      target.classList.add('heading-flash');
      setTimeout(function() { target.classList.remove('heading-flash'); }, 1400);

      history.replaceState(null, '', '#' + id);
    });
  });
}

// Share / Copy link
document.querySelectorAll('[data-copy-url]').forEach(function(btn) {
  btn.addEventListener('click', function() {
    var url = btn.getAttribute('data-copy-url') || window.location.href;
    navigator.clipboard.writeText(url).then(function() {
      var textEl = btn.querySelector('.share-btn-text');
      if (textEl) {
        var orig = textEl.textContent;
        textEl.textContent = 'Copied!';
        btn.classList.add('copied');
        setTimeout(function() { textEl.textContent = orig; btn.classList.remove('copied'); }, 1500);
      }
    });
  });
});

document.querySelectorAll('[data-share-native]').forEach(function(btn) {
  btn.addEventListener('click', function() {
    if (navigator.share) {
      navigator.share({
        title: btn.getAttribute('data-share-title') || document.title,
        url: btn.getAttribute('data-share-native')
      });
    }
  });
});

// Search shortcut
function openSearch() {
  var modal = document.getElementById('search-modal');
  if (!modal) return;
  modal.classList.add('open');
  var input = modal.querySelector('input');
  if (input) setTimeout(function() { input.focus(); }, 50);
}

function closeSearch() {
  var modal = document.getElementById('search-modal');
  if (!modal) return;
  modal.classList.remove('open');
}

document.addEventListener('keydown', function(e) {
  if ((e.key === '/' && !e.ctrlKey && !e.metaKey) || (e.key === 'k' && (e.metaKey || e.ctrlKey))) {
    if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
    e.preventDefault();
    var inlineSearch = document.getElementById('writing-search');
    if (inlineSearch) {
      var input = inlineSearch.querySelector('input[type="text"]');
      if (input) { input.focus(); return; }
    }
    var modal = document.getElementById('search-modal');
    if (!modal) return;
    modal.classList.contains('open') ? closeSearch() : openSearch();
  }
  var modal = document.getElementById('search-modal');
  if (e.key === 'Escape' && modal && modal.classList.contains('open')) {
    closeSearch();
  }
});

document.querySelectorAll('[data-search-trigger]').forEach(function(btn) {
  btn.addEventListener('click', function() {
    var inlineSearch = document.getElementById('writing-search');
    if (inlineSearch) {
      var input = inlineSearch.querySelector('input[type="text"]');
      if (input) { input.focus(); return; }
    }
    var modal = document.getElementById('search-modal');
    if (!modal) return;
    modal.classList.contains('open') ? closeSearch() : openSearch();
  });
});

var _searchBackdrop = document.getElementById('search-modal-backdrop');
if (_searchBackdrop) _searchBackdrop.addEventListener('click', closeSearch);

// === Module 9: Plausible Custom Events ===
(function() {
  // Only run if plausible is available
  var p = window.plausible || function() {};

  // Scroll depth tracking (25/50/75/100%)
  var scrollFired = {};
  window.addEventListener('scroll', function() {
    var docHeight = document.documentElement.scrollHeight - window.innerHeight;
    if (docHeight <= 0) return;
    var pct = Math.round((window.scrollY / docHeight) * 100);
    [25, 50, 75, 100].forEach(function(threshold) {
      if (pct >= threshold && !scrollFired[threshold]) {
        scrollFired[threshold] = true;
        p('Article Read ' + threshold + '%');
      }
    });
  }, { passive: true });

  // Code copy event (listen for clicks on .copy-btn)
  document.addEventListener('click', function(e) {
    if (e.target.classList.contains('copy-btn') || e.target.classList.contains('copied')) {
      p('Code Block Copy');
    }
  });

  // Share / copy link
  document.addEventListener('click', function(e) {
    var btn = e.target.closest('[data-copy-url]');
    if (btn) p('Article Share');
    var share = e.target.closest('[data-share-native]');
    if (share) p('Article Share');
  });

  // External link clicks
  document.addEventListener('click', function(e) {
    var link = e.target.closest('a[href^="http"]');
    if (link && !link.href.includes(window.location.hostname)) {
      p('External Link Click', { props: { url: link.href } });
    }
  });

  // RSS link clicks
  document.addEventListener('click', function(e) {
    var link = e.target.closest('a[href*="feed.xml"], a[href*="/feed"]');
    if (link) p('RSS Subscribe');
  });

  // Search used
  var searchModal = document.getElementById('search-modal');
  if (searchModal) {
    var observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(m) {
        if (m.attributeName === 'class' && searchModal.classList.contains('open')) {
          p('Search Used');
        }
      });
    });
    observer.observe(searchModal, { attributes: true, attributeFilter: ['class'] });
  }
})();


// Mobile tap shimmer + peek on hero name
(function() {
  var heroName = document.querySelector('.hero-name');
  if (!heroName || !('ontouchstart' in window)) return;
  heroName.addEventListener('touchstart', function() {
    heroName.style.backgroundPosition = '-100% 0';
    heroName.style.letterSpacing = '0.5px';
    heroName.classList.add('peek-active');
    setTimeout(function() {
      heroName.style.backgroundPosition = '';
      heroName.style.letterSpacing = '';
      heroName.classList.remove('peek-active');
    }, 2000);
  }, { passive: true });
})();


(function() {
  var highlights = document.querySelectorAll('.hero-highlight[data-tip]');
  if (!highlights.length) return;

  highlights.forEach(function(el) {
    var card = document.createElement('span');
    card.className = 'hero-tip';
    var label = document.createElement('span');
    label.className = 'hero-tip-label';
    label.textContent = el.getAttribute('data-tip-label') || '';
    var text = document.createElement('span');
    text.className = 'hero-tip-text';
    text.textContent = el.getAttribute('data-tip') || '';
    card.appendChild(label);
    card.appendChild(text);
    el.appendChild(card);
  });

  if ('ontouchstart' in window) {
    document.addEventListener('touchstart', function(e) {
      var target = e.target.closest('.hero-highlight');
      highlights.forEach(function(el) {
        if (el !== target) el.classList.remove('tip-visible');
      });
      if (target) {
        target.classList.toggle('tip-visible');
      }
    });
  }
})();

// Idle auto-shimmer + peek after 8s of inactivity (homepage only)
(function() {
  var heroName = document.querySelector('.hero-name');
  var heroDivider = document.querySelector('.hero-divider');
  if (!heroName || !heroDivider) return;
  var timer;
  var isMobile = 'ontouchstart' in window;
  function triggerIdle() {
    heroName.style.backgroundPosition = '-100% 0';
    if (!isMobile) heroName.style.letterSpacing = '0.5px';
    heroDivider.style.width = '60px';
    heroName.classList.add('peek-active');
    setTimeout(function() {
      heroName.style.backgroundPosition = '';
      if (!isMobile) heroName.style.letterSpacing = '';
      heroDivider.style.width = '';
    }, 800);
    setTimeout(function() {
      heroName.classList.remove('peek-active');
    }, 1500);
    timer = setTimeout(triggerIdle, 8000);
  }
  function resetIdle() {
    clearTimeout(timer);
    heroName.classList.remove('peek-active');
    timer = setTimeout(triggerIdle, 8000);
  }
  resetIdle();
  document.addEventListener('mousemove', resetIdle);
  document.addEventListener('click', resetIdle);
  document.addEventListener('touchstart', resetIdle);
})();

// Type filter pills (Writing and tag pages)
(function() {
  var filterBtns = document.querySelectorAll('[data-filter-type]');
  if (!filterBtns.length) return;
  var rows = document.querySelectorAll('.article-row[data-type]');
  var groups = document.querySelectorAll('.writing-group[data-group]');

  filterBtns.forEach(function(btn) {
    btn.addEventListener('click', function() {
      var type = btn.getAttribute('data-filter-type');

      filterBtns.forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');

      rows.forEach(function(row) {
        row.style.display = (type === 'all' || row.getAttribute('data-type') === type) ? '' : 'none';
      });

      // Toggle section group visibility when groups exist
      groups.forEach(function(group) {
        group.style.display = (type === 'all' || group.getAttribute('data-group') === type) ? '' : 'none';
      });
    });
  });
})();

// Diagram lightbox
(function() {
  var lightbox = document.getElementById('diagram-lightbox');
  if (!lightbox) return;
  var lbBody = document.getElementById('lightbox-body');
  var currentSvg = null;

  function openWithSvg(svgEl) {
    currentSvg = svgEl.cloneNode(true);
    currentSvg.removeAttribute('width');
    currentSvg.removeAttribute('height');
    currentSvg.removeAttribute('style');
    currentSvg.style.width = '100%';
    currentSvg.style.height = 'auto';
    while (lbBody.firstChild) lbBody.removeChild(lbBody.firstChild);
    lbBody.appendChild(currentSvg);
    lightbox.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function openWithImg(imgEl) {
    var clone = imgEl.cloneNode(true);
    clone.style.maxWidth = '100%';
    clone.style.cursor = 'default';
    while (lbBody.firstChild) lbBody.removeChild(lbBody.firstChild);
    lbBody.appendChild(clone);
    currentSvg = null;
    lightbox.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    lightbox.hidden = true;
    document.body.style.overflow = '';
    currentSvg = null;
  }

  document.addEventListener('click', function(e) {
    var container = e.target.closest('.diagram-container');
    var action = e.target.closest('[data-action]');
    if (container && !action) {
      var svg = container.querySelector('svg');
      var img = container.querySelector('img');
      if (svg) openWithSvg(svg);
      else if (img) openWithImg(img);
    }
  });

  document.addEventListener('click', function(e) {
    var btn = e.target.closest('[data-action="expand"]');
    if (btn) {
      var container = btn.closest('.diagram-container');
      if (container) {
        var svg = container.querySelector('svg');
        if (svg) openWithSvg(svg);
      }
    }
  });

  lightbox.addEventListener('click', function(e) {
    var action = e.target.closest('[data-action]');
    if (!action) {
      if (e.target.closest('.lightbox-backdrop')) closeLightbox();
      return;
    }
    var act = action.getAttribute('data-action');
    if (act === 'close') closeLightbox();
    if (act === 'download-svg' && currentSvg) {
      var svgData = new XMLSerializer().serializeToString(currentSvg);
      var blob = new Blob([svgData], { type: 'image/svg+xml' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'diagram.svg';
      a.click();
      URL.revokeObjectURL(a.href);
    }
    if (act === 'download-png' && currentSvg) {
      var svgData2 = new XMLSerializer().serializeToString(currentSvg);
      var canvas = document.createElement('canvas');
      var ctx = canvas.getContext('2d');
      var pngImg = new Image();
      pngImg.onload = function() {
        canvas.width = pngImg.width * 2;
        canvas.height = pngImg.height * 2;
        ctx.scale(2, 2);
        ctx.drawImage(pngImg, 0, 0);
        var a = document.createElement('a');
        a.href = canvas.toDataURL('image/png');
        a.download = 'diagram.png';
        a.click();
      };
      pngImg.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData2)));
    }
    if (act === 'share') {
      if (navigator.share) {
        navigator.share({ title: document.title, url: window.location.href });
      } else {
        navigator.clipboard.writeText(window.location.href);
      }
    }
  });

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && !lightbox.hidden) closeLightbox();
  });
})();

// Heading anchor links
(function() {
  var articleBody = document.querySelector('.article-body');
  if (!articleBody) return;
  var linkSvg = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>';
  articleBody.querySelectorAll('h2[id], h3[id]').forEach(function(heading) {
    var link = document.createElement('a');
    link.href = '#' + heading.id;
    link.className = 'heading-anchor';
    link.setAttribute('aria-label', 'Link to section');
    link.appendChild(parseSvgString(linkSvg));
    link.addEventListener('click', function(e) {
      e.preventDefault();
      navigator.clipboard.writeText(window.location.origin + window.location.pathname + '#' + heading.id);
      window.location.hash = heading.id;
    });
    heading.style.position = 'relative';
    heading.appendChild(link);
  });
})();

// Image lightbox (reuses diagram lightbox, image mode = full-screen on dark backdrop)
(function() {
  var articleBody = document.querySelector('.article-body');
  if (!articleBody) return;
  articleBody.querySelectorAll('img').forEach(function(img) {
    img.style.cursor = 'zoom-in';
    img.addEventListener('click', function() {
      var lightbox = document.getElementById('diagram-lightbox');
      var lbBody = document.getElementById('lightbox-body');
      if (!lightbox || !lbBody) return;
      var clone = img.cloneNode(true);
      clone.style.cursor = 'default';
      while (lbBody.firstChild) lbBody.removeChild(lbBody.firstChild);
      lbBody.appendChild(clone);
      lightbox.setAttribute('data-mode', 'image');
      lightbox.hidden = false;
      document.body.style.overflow = 'hidden';
    });
  });

  // Clear image mode when lightbox closes (restore diagram mode for next open)
  var lightbox = document.getElementById('diagram-lightbox');
  if (lightbox) {
    var origClose = lightbox.addEventListener;
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && !lightbox.hidden) lightbox.removeAttribute('data-mode');
    });
    lightbox.addEventListener('click', function(e) {
      if (e.target.closest('[data-action="close"]') || e.target.closest('.lightbox-backdrop')) {
        lightbox.removeAttribute('data-mode');
      }
    });
  }
})();

// Footnote hover preview
(function() {
  var refs = document.querySelectorAll('a[href^="#fn:"], sup a[href^="#fn"]');
  refs.forEach(function(ref) {
    var targetId = ref.getAttribute('href').substring(1);
    var footnote = document.getElementById(targetId);
    if (!footnote) return;

    var tooltip = document.createElement('div');
    tooltip.className = 'footnote-tooltip';
    Array.from(footnote.childNodes).forEach(function(node) {
      if (node.nodeType === 1 && node.tagName === 'A' && node.getAttribute('href') && node.getAttribute('href').indexOf('#fnref') === 0) return;
      tooltip.appendChild(node.cloneNode(true));
    });
    document.body.appendChild(tooltip);

    ref.addEventListener('mouseenter', function() {
      var rect = ref.getBoundingClientRect();
      tooltip.style.left = Math.max(8, rect.left - 100) + 'px';
      tooltip.style.top = (rect.bottom + window.scrollY + 8) + 'px';
      tooltip.classList.add('visible');
    });

    ref.addEventListener('mouseleave', function() {
      tooltip.classList.remove('visible');
    });
  });
})();

// Writing page: activate filter from ?type= query param (from tag page navigation)
(function() {
  if (!document.getElementById('article-list')) return;
  var params = new URLSearchParams(window.location.search);
  var filterType = params.get('type');
  var allowed = { all: 1, article: 1, note: 1 };
  if (!filterType || !allowed[filterType]) return;
  var btn = document.querySelector('[data-filter-type="' + filterType + '"]');
  if (btn) {
    btn.click();
    history.replaceState(null, null, '/writing/');
  }
})();

// Populate type filter count badges (writing page and tag pages).
// Counts reflect the current page's article-list — tag pages show tag-specific counts.
(function() {
  var articleList = document.getElementById('article-list');
  if (!articleList) return;

  var articleCount = articleList.querySelectorAll('.article-row[data-type="article"]').length;
  var noteCount = articleList.querySelectorAll('.article-row[data-type="note"]').length;

  var pillArticles = document.getElementById('filter-pill-articles');
  var pillNotes = document.getElementById('filter-pill-notes');

  if (pillArticles && articleCount > 0) pillArticles.textContent = 'Articles ' + articleCount;
  if (pillNotes && noteCount > 0) pillNotes.textContent = 'Notes ' + noteCount;
})();
