import { join } from 'path'
import { readFileSync, writeFileSync } from 'fs'
import { app, BrowserWindow, Menu, shell } from 'electron'
import { IPC } from '@shared/ipc'
import { registerApi } from './ipc/register'
import { createMockApi } from './mock/mockApi'
import { createApi } from './ipc/api'
import { buildMenu } from './menu'
import { AccountStore } from './accounts/store'
import { SyncEngine } from './sync/engine'
import { createCaldavProvider, verifyCaldav } from './providers/caldav'
import { createGoogleProvider, googleSignIn } from './providers/google'

const MOCK = process.env.MULTICALS_MOCK === '1'

function broadcast(accountId: string): void {
  for (const w of BrowserWindow.getAllWindows()) w.webContents.send(IPC.changed, accountId)
}

const stateFile = (): string => join(app.getPath('userData'), 'window-state.json')

function loadSize(): { width: number; height: number } {
  try {
    const { width, height } = JSON.parse(readFileSync(stateFile(), 'utf8'))
    if (Number.isInteger(width) && Number.isInteger(height)) return { width, height }
  } catch {
    // first launch or unreadable file
  }
  return { width: 1200, height: 800 }
}

function createWindow(): void {
  const win = new BrowserWindow({
    ...loadSize(),
    minWidth: 800,
    minHeight: 500,
    show: false,
    titleBarStyle: 'hiddenInset',
    vibrancy: 'sidebar',
    trafficLightPosition: { x: 16, y: 18 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false
    }
  })
  win.once('ready-to-show', () => win.show())

  // The renderer never navigates or opens windows; external https links go to the system browser.
  win.webContents.on('will-navigate', (e) => e.preventDefault())
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })

  // Mock runs (e2e) must not touch the real window state.
  if (!MOCK)
    win.on('close', () => {
      const { width, height } = win.getNormalBounds()
      try {
        writeFileSync(stateFile(), JSON.stringify({ width, height }))
      } catch (e) {
        console.error('failed to save window state', e)
      }
    })

  if (process.env.ELECTRON_RENDERER_URL) win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else win.loadFile(join(__dirname, '../renderer/index.html'))
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(buildMenu())
  if (MOCK) {
    registerApi(createMockApi(broadcast))
  } else {
    const store = new AccountStore(app.getPath('userData'), { caldav: createCaldavProvider, google: createGoogleProvider })
    const sync = new SyncEngine(store, broadcast)
    try {
      registerApi(createApi(store, sync, { verifyCaldav, googleSignIn, onChanged: broadcast }))
      sync.start()
    } catch (e) {
      console.error('backend not ready', e)
    }
  }
  createWindow()
  app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow())
})

app.on('window-all-closed', () => process.platform !== 'darwin' && app.quit())
