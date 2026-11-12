#!/bin/sh
# macOS. NOT YET RUN ON A MAC. Usage: listener.sh PORT URL
# Opens URL in the browser, then waits for one browser request to
# http://127.0.0.1:PORT/callback?... and prints its path and query.
# Exit codes: 0 got the callback, 3 gave up (port taken, or nobody came).
# It has no clock of its own: the mod's exec timeout ends it when nobody comes.
PORT=$1
URL=$2
BODY='<html><body style="font-family:sans-serif"><h3>Signed in. You can close this tab and go back to Herdr.</h3></body></html>'

# Give nc a moment to start listening before the browser can redirect back.
(sleep 1; open "$URL") &

# nc answers one connection and exits, so loop past the ones that are not the callback
# (a favicon request, a spare connection). An empty read may mean the port is taken,
# so those are counted and limited.
EMPTY=0
while [ "$EMPTY" -lt 30 ]; do
  LINE=$(printf 'HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nConnection: close\r\n\r\n%s' "$BODY" | nc -l 127.0.0.1 "$PORT" | head -n 1)
  case "$LINE" in
    "GET /callback?"*) printf '%s\n' "$LINE" | cut -d' ' -f2; exit 0 ;;
    "") EMPTY=$((EMPTY + 1)); sleep 1 ;;
  esac
done
echo "gave up" >&2
exit 3
