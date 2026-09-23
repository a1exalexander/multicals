import { join } from 'path'
import { app, BrowserWindow } from 'electron'
import { IPC } from '@shared/ipc'
import { registerApi } from './ipc/register'
import { createMockApi } from './mock/mockApi'
import { createApi } from './ipc/api'
import { AccountStore } from './accounts/store'
import { SyncEngine } from './sync/engine'
import { createCaldavProvider } from './providers/caldav'
import { createGoogleProvider } from './providers/google'

// Unit 5 owns this file: menu, CSP, window polish.
const MOCK = process.env.MULTICALS_MOCK === '1'

function broadcast(accountId: string): void {
  for (const w of BrowserWindow.getAllWindows()) w.webContents.send(IPC.changed, accountId)
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 500,
    show: false,
    titleBarStyle: 'hiddenInset',
    vibrancy: 'sidebar',
    webPreferences: { preload: join(__dirname, '../preload/index.js'), contextIsolation: true, sandbox: true }
  })
  win.once('ready-to-show', () => win.show())
  if (process.env.ELECTRON_RENDERER_URL) win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else win.loadFile(join(__dirname, '../renderer/index.html'))
}

app.whenReady().then(() => {
  if (MOCK) {
    registerApi(createMockApi(broadcast))
  } else {
    const store = new AccountStore(app.getPath('userData'), { caldav: createCaldavProvider, google: createGoogleProvider })
    const sync = new SyncEngine(store, broadcast)
    try {
      registerApi(createApi(store, sync))
      sync.start()
    } catch (e) {
      console.error('backend not ready', e)
    }
  }
  createWindow()
  app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow())
})

app.on('window-all-closed', () => process.platform !== 'darwin' && app.quit())
