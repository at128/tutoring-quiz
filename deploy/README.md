# Live demo: https://quiz.just-atta.site

The server deploys itself. Every minute, a systemd timer checks `main`. When the head is a new commit
whose **CI** run (backend, frontend, Docker build) has succeeded, the server builds it and swaps it in. GitHub holds
no SSH key, no server address and no secret for this. Nothing connects in to deploy, and nothing new is exposed.

This is optional hosting for reviewers. The required way to run the project is still `docker compose up --build`
(see the root README); nothing in this folder changes that.

## How it fits on the server

The server already runs other apps behind Coolify's Traefik (`coolify-proxy`, ports 80/443). The demo is a separate
compose project (`tutoring-quiz`) that only **adds** things:

| What | Where |
|---|---|
| App container | joins the existing `coolify` network; Traefik routes `Host(quiz.just-atta.site)` to port 8080. **No host port is published.** HTTP redirects to HTTPS; the certificate comes from Traefik's existing `letsencrypt` resolver. |
| Data | named volume `tutoring-quiz_tq-data` (SQLite + Data Protection keys, so sign-ins survive redeploys) |
| Code | `/opt/tutoring-quiz/src`, a clone of this public repo, checked out at the live commit |
| Script | `/opt/tutoring-quiz/bin/tq-deploy`, a root-owned copy of `deploy/server/tq-deploy` |
| Timer | `tutoring-quiz-deploy.timer` → `tutoring-quiz-deploy.service` (`tq-deploy poll`) |
| State and log | `/opt/tutoring-quiz/state/{current,last-attempt,deploy.log}`, plus `journalctl -u tutoring-quiz-deploy` |

`deploy/compose.server.yml` overrides the root compose file: no published port, Traefik labels, the `coolify`
network, `ASPNETCORE_FORWARDEDHEADERS_ENABLED=true` (TLS ends at Traefik, so the auth cookie stays `Secure` and
the login rate limit sees the real client IP) and one image tag per commit.

## What a check does (`tq-deploy poll`)

1. Reads `main`'s head with `git ls-remote`, which uses no API quota. Stops if that commit is already live, or was
   already tried.
2. Asks GitHub's public API for that commit's `CI` run: still running means try again next minute; failed means
   the commit is skipped for good.
3. Once CI has succeeded, deploys:
   - builds `tutoring-quiz:<sha>` on the server (arm64, built natively);
   - starts it and polls `/api/health` through Traefik;
   - when healthy, records the commit and removes older images, keeping the previous one;
   - when unhealthy, saves the container log to `deploy.log` and restarts the previous commit.

Only one check or deploy runs at a time (`flock`). A commit that fails to build or start isn't retried every minute;
the next push, or a manual `deploy`, moves things on.

## Operating it (on the server, as an admin)

| Task | Command |
|---|---|
| Status | `sudo /opt/tutoring-quiz/bin/tq-deploy status` |
| Log | `sudo tail -50 /opt/tutoring-quiz/state/deploy.log` · `journalctl -u tutoring-quiz-deploy -n 50` · `sudo docker logs tutoring-quiz-app-1` |
| Reset demo data (reseed; quiz times are seeded relative to now) | `sudo /opt/tutoring-quiz/bin/tq-deploy reset-demo` |
| Deploy or roll back to a commit of `main` by hand | `sudo /opt/tutoring-quiz/bin/tq-deploy deploy <sha>` |
| Pause / resume automatic deploys | `sudo systemctl stop tutoring-quiz-deploy.timer` / `start` |

## One-time setup / updating the script

```sh
scp -r deploy/server <admin>@<server>:/tmp/tq-server
ssh <admin>@<server> 'sudo bash /tmp/tq-server/install.sh && rm -r /tmp/tq-server'
```

`install.sh` is idempotent. It checks that docker, git, curl, jq, flock and the `coolify` network are there,
installs the script and the timer, and clones the repo. Re-run it after changing `deploy/server/*`, because the
installed copy doesn't update itself.

## Removing it

```sh
sudo systemctl disable --now tutoring-quiz-deploy.timer
sudo rm /etc/systemd/system/tutoring-quiz-deploy.{service,timer} && sudo systemctl daemon-reload
cd /opt/tutoring-quiz/src
sudo TQ_IMAGE_TAG=x docker compose -p tutoring-quiz -f docker-compose.yml -f deploy/compose.server.yml down -v
sudo rm -r /opt/tutoring-quiz
```
