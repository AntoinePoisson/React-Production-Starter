#!/bin/sh
# Runs a command with a wall-clock limit, then kills it. Exits 142 on timeout.
#
#   sh scripts/with-timeout.sh 120 ./node_modules/.bin/lingui extract --clean
#
# macOS ships no timeout(1), and the git hooks need one: a pre-commit command that hangs takes
# the commit with it, with no output and nothing to kill but the whole terminal. perl's alarm
# survives exec, so the timer still applies to the command that replaces it.
exec perl -e 'alarm shift; exec @ARGV or die "with-timeout: cannot run $ARGV[0]: $!\n"' "$@"
