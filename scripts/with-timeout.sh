#!/bin/sh
# Runs a command with a wall-clock limit, then kills it. Exits 142 on timeout.
#
#   sh scripts/with-timeout.sh 120 ./node_modules/.bin/lingui extract --clean
#
# macOS ships no timeout(1), and the git hooks need one: a pre-commit command that hangs takes the
# commit with it, with no output and nothing to kill but the whole terminal.
#
# A supervisor, not `alarm` + `exec`. Exec-ing the command and arming an alarm on it means the
# command has to handle SIGALRM itself, and a Node process that never yields to its event loop
# does not: the signal stays pending and the limit passes unenforced. That is how a hook ran for
# 313 seconds under a two-minute cap. The parent below stays a few kilobytes of perl doing
# nothing, so its alarm always fires, and it answers with SIGKILL, which nothing can ignore.
#
# The child gets its own process group so the kill reaches what it spawned. Orphaning esbuild's
# service process would leave it holding the pipe the next run has to open.
exec perl -e '
  my $limit = shift;
  my $pid = fork();
  die "with-timeout: cannot fork: $!\n" unless defined $pid;

  if ($pid == 0) {
    setpgrp(0, 0);
    exec @ARGV;
    print STDERR "with-timeout: cannot run $ARGV[0]: $!\n";
    exit 127;
  }

  $SIG{ALRM} = sub {
    kill("KILL", -$pid) or kill("KILL", $pid);
    waitpid($pid, 0);
    exit 142;
  };

  alarm $limit;
  waitpid($pid, 0);
  alarm 0;

  my $status = $?;
  exit($status & 127 ? 128 + ($status & 127) : $status >> 8);
' "$@"
