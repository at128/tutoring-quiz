#!/usr/bin/env bash
# One-time (re-runnable) server setup for the live demo. Run as root on the server from a copy of deploy/server:
#   sudo bash install.sh
# It only adds things: /opt/tutoring-quiz and two systemd timers (deploy, daily backup). No user, key or open port.
# See deploy/README.md.
set -euo pipefail

readonly HERE=$(cd "$(dirname "$0")" && pwd)
readonly ROOT=/opt/tutoring-quiz
readonly REPO=https://github.com/at128/tutoring-quiz.git
readonly UNIT=tutoring-quiz-deploy
readonly BACKUP_UNIT=tutoring-quiz-backup

[[ $EUID -eq 0 ]] || { echo "run as root" >&2; exit 1; }
for tool in docker git curl jq flock gzip; do command -v "$tool" >/dev/null || { echo "missing: $tool" >&2; exit 1; }; done
docker network inspect coolify >/dev/null || { echo "the Traefik network 'coolify' is missing" >&2; exit 1; }

# The script is installed root-owned outside the checkout, so a deploy can't rewrite the code that runs it.
install -d -o root -g root -m 755 "$ROOT" "$ROOT/bin"
install -d -o root -g root -m 700 "$ROOT/state" "$ROOT/backups"
install -o root -g root -m 755 "$HERE/tq-deploy" "$ROOT/bin/tq-deploy"
[[ -d $ROOT/src/.git ]] || git clone --quiet "$REPO" "$ROOT/src"
# The backup runs SQLite from this small image (see tq-deploy backup); pulled now, not at 00:30.
docker pull --quiet python:3.13-alpine >/dev/null

install -o root -g root -m 644 "$HERE/$UNIT.service" "$HERE/$UNIT.timer"   "$HERE/$BACKUP_UNIT.service" "$HERE/$BACKUP_UNIT.timer" /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now "$UNIT.timer" "$BACKUP_UNIT.timer"

echo "installed: $ROOT, $UNIT.timer ($(systemctl is-active "$UNIT.timer")), $BACKUP_UNIT.timer ($(systemctl is-active "$BACKUP_UNIT.timer"))"
