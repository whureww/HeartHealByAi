#!/usr/bin/env node
/**
 * XinYu backend daemon: supervisor shell
 *
 * Pulls up dist/index.js as a child process (fork):
 * - Auto-restart on crash with exponential backoff (1s -> 2s -> 4s ... capped at 15s)
 * - Crash counter resets after the child process has been stable for 60s; gives up and exits if MAX_RESTARTS is exceeded
 * - On SIGINT/SIGTERM: sends SIGTERM to the child process, escalates to SIGKILL after grace period timeout
 * - Logs pass through to stdout, with timestamps added by this layer
 */
import { fork } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ENTRY = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../dist/index.js'
);
const STABLE_MS = 60_000; // If the child process runs stably for this long, reset the crash counter
const MAX_RESTARTS = 5; // Max allowed consecutive crashes within the stable window
const BACKOFF_BASE_MS = 1_000;
const BACKOFF_MAX_MS = 15_000;
const KILL_GRACE_MS = 8_000; // Grace period after SIGTERM before escalating to SIGKILL

let child = null;
let stopping = false;
let crashes = 0;
let restarts = 0;
let startedAt = 0;
let backoffTimer = null;

function log(msg) {
  process.stdout.write(`[daemon ${new Date().toISOString()}] ${msg}\n`);
}

function start() {
  if (stopping) return;
  child = fork(ENTRY, { stdio: 'inherit' });
  startedAt = Date.now();
  log(`backend started (pid=${child.pid}, restarts=${restarts})`);

  child.on('exit', (code, signal) => {
    child = null;
    if (stopping) {
      log('backend stopped, daemon exiting');
      process.exit(0);
    }
    if (Date.now() - startedAt >= STABLE_MS) crashes = 0;
    crashes += 1;
    if (crashes > MAX_RESTARTS) {
      log(`backend crashed ${crashes} times in a row, giving up and exiting`);
      process.exit(1);
    }
    const delay = Math.min(BACKOFF_BASE_MS * 2 ** (crashes - 1), BACKOFF_MAX_MS);
    restarts += 1;
    log(
      `backend exited (code=${code}, signal=${signal}), restarting in ${delay}ms (${crashes}/${MAX_RESTARTS})`
    );
    backoffTimer = setTimeout(start, delay);
  });
}

function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  clearTimeout(backoffTimer);
  log(`received ${signal}, stopping backend`);
  if (!child) process.exit(0);
  child.kill('SIGTERM');
  const killTimer = setTimeout(() => {
    log('grace period expired, sending SIGKILL');
    if (child) child.kill('SIGKILL');
  }, KILL_GRACE_MS);
  child.once('exit', () => clearTimeout(killTimer));
  // Final fallback to prevent the daemon from lingering
  setTimeout(() => process.exit(0), KILL_GRACE_MS + 4_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

log(`XinYu backend daemon, entry=${ENTRY}`);
start();
