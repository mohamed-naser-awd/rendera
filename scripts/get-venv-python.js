/**
 * Resolves the Python executable path for the server's venv.
 * Used by the Electron main process and run-server.js.
 * Returns null if venv does not exist.
 */
const path = require('path');
const fs = require('fs');

const serverDir = path.join(__dirname, '..', 'server');
const isWin = process.platform === 'win32';
const venvPython = path.join(
  serverDir,
  '.venv',
  isWin ? 'Scripts' : 'bin',
  isWin ? 'python.exe' : 'python'
);

if (fs.existsSync(venvPython)) {
  console.log(venvPython);
} else {
  process.exit(1);
}
