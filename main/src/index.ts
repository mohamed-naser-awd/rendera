import { app, BrowserWindow, ipcMain, Menu } from 'electron';
import path from 'path';
import fs from 'fs';
import net from 'net';
import { spawn, ChildProcess } from 'child_process';

let apiUrl = process.env.RENDERA_API_URL || '';
let serverProcess: ChildProcess | null = null;
const isDev = !app.isPackaged || process.env.NODE_ENV === 'development';
let projectsWindow: BrowserWindow | null = null;
let recorderWindow: BrowserWindow | null = null;
let editorWindow: BrowserWindow | null = null;

/** Get a random free port. */
function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = addr && typeof addr === 'object' ? addr.port : 0;
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}

/** Resolve Python executable: use server/.venv if present, else system Python. */
function getServerPython(serverPath: string): string {
  const isWin = process.platform === 'win32';
  const venvPython = path.join(
    serverPath,
    '.venv',
    isWin ? 'Scripts' : 'bin',
    isWin ? 'python.exe' : 'python'
  );
  if (fs.existsSync(venvPython)) return venvPython;
  return process.platform === 'win32' ? 'python' : 'python3';
}

/** Spawn FastAPI server first (before any windows). Uses a random free port. */
async function spawnFastAPI(): Promise<void> {
  const port = await getFreePort();
  apiUrl = `http://127.0.0.1:${port}`;

  const serverPath = path.join(__dirname, '../../server');
  const pythonCmd = getServerPython(serverPath);
  serverProcess = spawn(
    pythonCmd,
    ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', String(port)],
    {
      cwd: serverPath,
      stdio: 'inherit',
      env: { ...process.env, RENDERA_API_URL: apiUrl },
    }
  );
  serverProcess.on('error', (err) => console.error('FastAPI spawn error:', err));
  await new Promise((r) => setTimeout(r, 2000));
}

function createProjectsWindow(): void {
  if (projectsWindow) {
    projectsWindow.focus();
    return;
  }
  projectsWindow = new BrowserWindow({
    width: 720,
    height: 600,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true },
  });

  const projectsUrl = isDev
    ? 'http://localhost:5173/projects.html'
    : `file://${path.join(__dirname, '../../apps/projects/dist/projects.html')}`;

  let loadRetries = 0;
  function loadProjects() {
    projectsWindow?.loadURL(projectsUrl);
  }

  if (isDev) {
    projectsWindow.webContents.on('did-fail-load', (_event, errorCode, _desc, failedUrl) => {
      if (failedUrl === projectsUrl && errorCode !== -3 && loadRetries < 10) {
        loadRetries++;
        setTimeout(loadProjects, 2000);
      }
    });
  }

  loadProjects();
  projectsWindow.on('closed', () => { projectsWindow = null; });
}

function createRecorderWindow(projectId?: string): void {
  if (recorderWindow) {
    recorderWindow.focus();
    if (projectId) recorderWindow.webContents.send('set-project-id', projectId);
    return;
  }
  recorderWindow = new BrowserWindow({
    width: 400,
    height: 120,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true },
  });
  const base = isDev
    ? 'http://localhost:5175/recorder.html'
    : `file://${path.join(__dirname, '../../apps/recorder/dist/recorder.html')}`;
  recorderWindow.loadURL(projectId ? `${base}?projectId=${projectId}` : base);
  recorderWindow.on('closed', () => { recorderWindow = null; });
}

function createEditorWindow(projectId?: string, openNewProject = false): void {
  if (editorWindow) {
    editorWindow.focus();
    if (projectId) editorWindow.webContents.send('open-project', projectId);
    if (openNewProject) editorWindow.webContents.send('menu:new-project');
    return;
  }
  editorWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true },
  });
  const url = isDev
    ? 'http://localhost:5174/editor.html'
    : `file://${path.join(__dirname, '../../apps/editor/dist/editor.html')}`;
  let loadUrl = url;
  if (projectId) loadUrl += `?projectId=${projectId}`;
  else if (openNewProject) loadUrl += '?newProject=1';
  editorWindow.loadURL(loadUrl);
  if (openNewProject) {
    editorWindow.webContents.once('did-finish-load', () => {
      editorWindow?.webContents.send('menu:new-project');
    });
  }
  editorWindow.on('closed', () => { editorWindow = null; });
}

ipcMain.handle('recorder:done', async (_, projectId: string) => {
  createEditorWindow(projectId);
});

ipcMain.handle('get-api-url', () => apiUrl);

ipcMain.handle('open-editor', async (_, projectId: string) => {
  createEditorWindow(projectId);
});

ipcMain.handle('open-recorder', async (_, projectId: string) => {
  createRecorderWindow(projectId);
});

function getEditorWindow(): BrowserWindow | null {
  const win = BrowserWindow.getFocusedWindow();
  if (win && win.webContents.getURL().includes('editor')) return win;
  return editorWindow;
}

function setupApplicationMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Project',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            const win = getEditorWindow();
            if (win) {
              win.focus();
              win.webContents.send('menu:new-project');
            } else {
              createEditorWindow(undefined, true);
            }
          },
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Theme',
          submenu: [
            { label: 'Light', click: () => getEditorWindow()?.webContents.send('menu:set-theme', 'light') },
            { label: 'Dark', click: () => getEditorWindow()?.webContents.send('menu:set-theme', 'dark') },
          ],
        },
        { type: 'separator' },
        {
          label: 'Language',
          submenu: [
            { label: 'English', click: () => getEditorWindow()?.webContents.send('menu:set-language', 'en') },
            { label: 'العربية', click: () => getEditorWindow()?.webContents.send('menu:set-language', 'ar') },
          ],
        },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' as const },
        { role: 'zoom' as const },
        { type: 'separator' as const },
        { role: 'close' as const },
      ],
    },
    {
      label: 'Help',
      submenu: [{ role: 'about' as const }],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(async () => {
  await spawnFastAPI();
  setupApplicationMenu();
  createProjectsWindow();
});

app.on('window-all-closed', () => {
  if (serverProcess) serverProcess.kill();
  app.quit();
});
