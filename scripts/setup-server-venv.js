/**
 * Creates server/.venv and installs requirements.txt.
 * Run from repo root: node scripts/setup-server-venv.js
 */
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const serverDir = path.join(__dirname, '..', 'server');
const venvDir = path.join(serverDir, '.venv');
const requirementsPath = path.join(serverDir, 'requirements.txt');
const isWin = process.platform === 'win32';

if (!fs.existsSync(requirementsPath)) {
  console.error('server/requirements.txt not found');
  process.exit(1);
}

const systemPython = isWin ? 'python' : 'python3';
const venvPython = path.join(venvDir, isWin ? 'Scripts' : 'bin', isWin ? 'python.exe' : 'python');
const venvPip = path.join(venvDir, isWin ? 'Scripts' : 'bin', isWin ? 'pip.exe' : 'pip');

if (fs.existsSync(venvDir)) {
  console.log('Server venv already exists at server/.venv');
  process.exit(0);
}

console.log('Creating server/.venv...');
execSync(`${systemPython} -m venv "${venvDir}"`, {
  cwd: serverDir,
  stdio: 'inherit',
});

console.log('Installing server requirements...');
execSync(`"${venvPip}" install -r "${path.basename(requirementsPath)}"`, {
  cwd: serverDir,
  stdio: 'inherit',
});

console.log('Server venv ready at server/.venv');
console.log('Run the app with npm run dev (or npm run dev:server for server only).');
