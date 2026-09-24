#!/usr/bin/env bash
# Runs Tutoring Quiz with one command on macOS, Linux or Windows (Git Bash, WSL): builds and starts it in Docker,
# waits until it answers, then prints the address for this computer and for a phone on the same Wi-Fi.
#   ./run.sh           start, or rebuild after an update (your data is kept)
#   ./run.sh --reset   start over with fresh sample data
#   ./run.sh --stop    stop it (your data is kept)
# Same as `docker compose up --build`, plus the checks. Another port: APP_PORT=9090 ./run.sh; no browser: TQ_NO_BROWSER=1
set -euo pipefail
cd "$(dirname "$0")"

fail() { printf '\n  %s\n\n' "$*" >&2; exit 1; }

mode=start
case "${1:-}" in
  "") ;;
  --reset) mode=reset ;;
  --stop) mode=stop ;;
  -h | --help) sed -n '2,7p' "$0" | cut -c3-; exit 0 ;;
  *) fail "Unknown option: $1 (use --reset, --stop or --help)" ;;
esac

command -v docker >/dev/null 2>&1 ||
  fail "Docker isn't installed. Install Docker Desktop (https://www.docker.com/products/docker-desktop/), start it, then run ./run.sh again."
docker info >/dev/null 2>&1 ||
  fail "Docker isn't running. Start Docker Desktop, wait until it says it's running, then run ./run.sh again."
docker compose version >/dev/null 2>&1 ||
  fail "Docker Compose v2 is missing. Update Docker Desktop, or install the docker-compose-plugin package."

if [[ $mode == stop ]]; then
  docker compose stop
  printf '\n  Stopped. Your data is kept: ./run.sh starts it again.\n\n'
  exit 0
fi
[[ $mode == reset ]] && docker compose down --volumes

# The port of a copy that's already running, else the first free one from 8080.
listening() { (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null; }
port=${APP_PORT:-}
if [[ -z $port ]]; then
  port=$(docker compose port app 8080 2>/dev/null | sed -n 's/.*://p' || true)
fi
if [[ -z $port ]]; then
  for candidate in 8080 8081 8082 8083 8084 8085 8086 8087 8088 8089; do
    listening "$candidate" || { port=$candidate; break; }
  done
fi
[[ -n $port ]] || fail "Ports 8080-8089 are all in use. Pick another one: APP_PORT=9090 ./run.sh"

printf '\n  Building and starting Tutoring Quiz on port %s. The first build takes a few minutes.\n\n' "$port"
APP_PORT=$port docker compose up --detach --build

url=http://localhost:$port
printf '\n  Waiting for the app to answer'
ready=false
for _ in $(seq 1 90); do
  if curl -fsS --max-time 3 "$url/api/health" >/dev/null 2>&1; then ready=true; break; fi
  printf '.'
  sleep 2
done
printf '\n'
if [[ $ready != true ]]; then
  docker compose logs --tail 40 app >&2 || true
  fail "The app didn't start within 3 minutes. The log is above; ./run.sh --reset starts over with fresh data."
fi

# This computer's Wi-Fi/LAN address: the source address the system would use to reach the internet (nothing is
# sent). Under WSL that's a virtual address a phone can't reach, so it's left out.
lan_ip=""
case "$(uname -s)" in
  Darwin) lan_ip=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true) ;;
  Linux)
    grep -qi microsoft /proc/version 2>/dev/null ||
      lan_ip=$(ip route get 1.1.1.1 2>/dev/null | awk '{for (i = 1; i < NF; i++) if ($i == "src") { print $(i + 1); exit }}' || true)
    ;;
  MINGW* | MSYS* | CYGWIN*)
    lan_ip=$(powershell.exe -NoProfile -Command '$s = New-Object Net.Sockets.Socket([Net.Sockets.AddressFamily]::InterNetwork, [Net.Sockets.SocketType]::Dgram, [Net.Sockets.ProtocolType]::Udp); $s.Connect("8.8.8.8", 53); $s.LocalEndPoint.Address.ToString()' 2>/dev/null | tr -d '' || true)
    ;;
esac
phone=http://$lan_ip:$port
[[ -n $lan_ip ]] || phone="http://<this computer's Wi-Fi IP>:$port"

cat <<EOF

  Tutoring Quiz is running.

    On this computer:         $url
    On a phone (same Wi-Fi):  $phone

    Student:  10a-01 / Student@2026      Teacher:  teacher.reem / Teacher@2026
    (all sample accounts are listed in README.md)

    Stop:  ./run.sh --stop      Fresh data:  ./run.sh --reset      Log:  docker compose logs -f app

EOF

# Open the browser where that's simple; the address above always works.
[[ -n ${TQ_NO_BROWSER:-} ]] && exit 0
case "$(uname -s)" in
  Darwin) open "$url" >/dev/null 2>&1 || true ;;
  MINGW* | MSYS* | CYGWIN*) cmd.exe //c start "" "$url" >/dev/null 2>&1 || true ;;
  Linux) [[ -n ${DISPLAY:-}${WAYLAND_DISPLAY:-} ]] && command -v xdg-open >/dev/null && xdg-open "$url" >/dev/null 2>&1 || true ;;
esac
