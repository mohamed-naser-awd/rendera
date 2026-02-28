/**
 * Runs the FastAPI server using the server's .venv.
 * Usage: node scripts/run-server.js [--reload] [--port 8000]
 */
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

const serverDir = path.join(__dirname, '..', 'server');
const isWin = process.platform === 'win32';
const venvPython = path.join(
  serverDir,
  '.venv',
  isWin ? 'Scripts' : 'bin',
  isWin ? 'python.exe' : 'python'
);

if (!fs.existsSync(venvPython)) {
  console.error('Server venv not found. Run: npm run setup:server');
  process.exit(1);
}

const args = process.argv.slice(2);
const uvicornArgs = ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', ...args];
// Default port for dev:server when not specified
if (!args.some((a) => a === '--port' || a.startsWith('--port='))) {
  uvicornArgs.push('--port', '8000');
}

const child = spawn(venvPython, uvicornArgs, {
  cwd: serverDir,
  stdio: 'inherit',
  env: { ...process.env },
});

child.on('error', (err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
