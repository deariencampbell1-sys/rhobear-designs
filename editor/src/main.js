import { bootShell } from './app/shell.js';

const shell = bootShell();

// Test/automation handle.
window.__RB_EDITOR__ = { shell, ready: true };
