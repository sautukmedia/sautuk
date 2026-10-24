#!/usr/bin/env bash
set -Eeuo pipefail

revision="${1:?An exact verified Git revision is required}"
[[ "$revision" =~ ^[0-9a-f]{40}$ ]] || exit 2
[[ "$(git rev-parse HEAD)" == "$revision" ]] || exit 2
exec 9>"$HOME/.sautuk-deploy.lock"
flock -w 600 9
cd backend

image="sautuk-backend:$revision"
candidate="sautuk-candidate-$revision"
replaced=false
cleanup() { docker rm -f "$candidate" >/dev/null 2>&1 || true; }
rollback() {
  if [[ "$replaced" == true ]]; then
    docker rm -f sautuk-api >/dev/null 2>&1 || true
    if docker inspect sautuk-previous >/dev/null 2>&1; then
      docker rename sautuk-previous sautuk-api
      docker start sautuk-api
    fi
  fi
}
trap cleanup EXIT
trap rollback ERR

wait_ready() {
  local name="$1"
  for attempt in $(seq 1 60); do
    local state
    state="$(docker inspect --format '{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{end}}' "$name")"
    [[ "$state" == 'running healthy' ]] && return 0
    [[ "$state" == exited* || "$state" == dead* ]] && return 1
    sleep 2
  done
  echo 'Replacement did not become ready' >&2
  return 1
}

docker build --target runner -t "$image" .
docker build --target migrations -t "sautuk-migrations:$revision" .
# Migrations must be backward compatible with the currently running revision.
docker run --rm --env-file .env "sautuk-migrations:$revision"
cleanup
docker run -d --name "$candidate" --env-file .env \
  -e NODE_ENV=production -e RESET_ADMIN_CREDENTIALS=false -e PORT=3000 "$image"
wait_ready "$candidate"

# Keep the previous container for rollback; stop it only after the candidate passes.
if docker inspect sautuk-api >/dev/null 2>&1; then
  docker rm -f sautuk-previous >/dev/null 2>&1 || true
  docker rename sautuk-api sautuk-previous
  replaced=true
  docker stop --time 30 sautuk-previous
else
  replaced=true
fi
docker run -d --name sautuk-api -p 80:3000 --restart always --env-file .env \
  -e NODE_ENV=production -e RESET_ADMIN_CREDENTIALS=false -e PORT=3000 "$image"
wait_ready sautuk-api
replaced=false
