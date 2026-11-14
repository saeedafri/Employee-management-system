#!/bin/sh
# Forced command for the GitHub Actions deploy key. Installed once at
# /usr/local/sbin/ems-deploy-shim and wired in /root/.ssh/authorized_keys as:
#   restrict,command="/usr/local/sbin/ems-deploy-shim" ssh-ed25519 AAAA... ems-github-deploy
# The key can do exactly one thing: "deploy <40-hex sha>" with the release tar.gz on stdin.
set -euf
# shellcheck disable=SC2086 # word-splitting the requested command is the point; globbing is off (-f)
set -- ${SSH_ORIGINAL_COMMAND:-}
if [ "$#" -ne 2 ] || [ "$1" != deploy ] || ! printf %s "$2" | grep -Eqx '[0-9a-f]{40}'; then
  echo "refused: expected 'deploy <commit sha>'" >&2
  exit 2
fi
SHA=$2
REL=/opt/ems/releases/$SHA
exec 9>/run/ems-deploy.lock
flock 9 # one deploy at a time; a second push waits instead of interleaving
rm -rf "$REL"
mkdir -p "$REL"
tar xzf - -C "$REL"
exec sh "$REL/deploy/hostinger/deploy.sh" "$REL" "$SHA"
