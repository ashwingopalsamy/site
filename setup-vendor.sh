#!/bin/bash
set -e

KATEX_VERSION="0.16.21"
MERMAID_VERSION="11.4.1"

mkdir -p static/vendor/katex/fonts static/vendor/katex/contrib static/vendor/mermaid

echo "Downloading KaTeX ${KATEX_VERSION}..."
curl -sL "https://cdn.jsdelivr.net/npm/katex@${KATEX_VERSION}/dist/katex.min.css" -o static/vendor/katex/katex.min.css
curl -sL "https://cdn.jsdelivr.net/npm/katex@${KATEX_VERSION}/dist/katex.min.js" -o static/vendor/katex/katex.min.js
curl -sL "https://cdn.jsdelivr.net/npm/katex@${KATEX_VERSION}/dist/contrib/auto-render.min.js" -o static/vendor/katex/contrib/auto-render.min.js

FONTS="KaTeX_AMS-Regular KaTeX_Caligraphic-Bold KaTeX_Caligraphic-Regular KaTeX_Fraktur-Bold KaTeX_Fraktur-Regular KaTeX_Main-Bold KaTeX_Main-BoldItalic KaTeX_Main-Italic KaTeX_Main-Regular KaTeX_Math-BoldItalic KaTeX_Math-Italic KaTeX_SansSerif-Bold KaTeX_SansSerif-Italic KaTeX_SansSerif-Regular KaTeX_Script-Regular KaTeX_Size1-Regular KaTeX_Size2-Regular KaTeX_Size3-Regular KaTeX_Size4-Regular KaTeX_Typewriter-Regular"

for font in $FONTS; do
  curl -sL "https://cdn.jsdelivr.net/npm/katex@${KATEX_VERSION}/dist/fonts/${font}.woff2" -o "static/vendor/katex/fonts/${font}.woff2"
done
echo "KaTeX done ($(ls static/vendor/katex/fonts/*.woff2 | wc -l | tr -d ' ') fonts)"

echo "Downloading Mermaid ${MERMAID_VERSION}..."
curl -sL "https://cdn.jsdelivr.net/npm/mermaid@${MERMAID_VERSION}/dist/mermaid.min.js" -o static/vendor/mermaid/mermaid.min.js
echo "Mermaid done"

echo "KaTeX ${KATEX_VERSION}, Mermaid ${MERMAID_VERSION}" > static/vendor/VERSION.md
echo "All vendor libs installed. Run: hugo server -D"