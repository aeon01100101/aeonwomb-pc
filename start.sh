#!/bin/sh
cd "$(dirname "$0")"
echo "Aeon Womb PC: http://localhost:8907/launcher.html"
(command -v xdg-open >/dev/null && xdg-open http://localhost:8907/launcher.html >/dev/null 2>&1 &) || (command -v open >/dev/null && open http://localhost:8907/launcher.html >/dev/null 2>&1 &) || true
exec python3 -m http.server 8907
