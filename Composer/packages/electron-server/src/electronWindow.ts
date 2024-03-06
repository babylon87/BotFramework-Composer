// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
//

import { join } from 'path';

import { app, BrowserWindow, screen, shell, HandlerDetails } from 'electron';

import { isLinux } from './utility/platform';
import { isDevelopment } from './utility/env';
import logger from './utility/logger';
const log = logger.extend('electron-window');

export default class ElectronWindow {
  private static instance: ElectronWindow | undefined;
  private currentBrowserWindow: BrowserWindow;

  get browserWindow(): BrowserWindow | undefined {
    if (ElectronWindow.instance) {
      return ElectronWindow.instance.currentBrowserWindow;
    }
  }

  private constructor() {
    // Create the browser window.
    const { height, width } = screen.getPrimaryDisplay().workAreaSize;
    log(`Raw screen dimensions: ${height} x ${width}`);
    const adjustedHeight = Math.floor(height * 0.9); // take up 90% of screen height
    // aim to maintain 4:3 ratio while trying to expose window to at least 1080px wide
    const adjustedWidth = Math.max(Math.floor((4 / 3) * adjustedHeight), Math.min(1080, Math.floor(width * 0.9)));
    log(`Electron window dimensions: ${adjustedHeight} x ${adjustedWidth}`);
    const browserWindowOptions: Electron.BrowserWindowConstructorOptions = {
      width: adjustedWidth,
      height: adjustedHeight,
      webPreferences: {
        nodeIntegrationInWorker: false,
        nodeIntegration: false,
        preload: join(__dirname, 'preload.js'),
      },
      show: false,
      title: `Bot Framework Composer (v${app.getVersion()})`,
    };
    if (isLinux() && !isDevelopment) {
      // workaround for broken .AppImage icons since electron-builder@21.0.1 removed .AppImage desktop integration
      // (https://github.com/electron-userland/electron-builder/releases/tag/v21.0.1)
      browserWindowOptions.icon = join(__dirname, '../resources/composerIcon_1024x1024.png');
    }
    this.currentBrowserWindow = new BrowserWindow(browserWindowOptions);
    this.currentBrowserWindow.on('page-title-updated', (ev) => ev.preventDefault()); // preserve explicit window title
    this.currentBrowserWindow.webContents.setWindowOpenHandler(this.onOpenNewWindow);
    log('Rendered Electron window dimensions: ', this.currentBrowserWindow.getSize());
  }

  public static destroy() {
    ElectronWindow.instance = undefined;
  }

  public static get isBrowserWindowCreated() {
    return !!ElectronWindow.instance;
  }

  public static getInstance(): ElectronWindow {
    if (!ElectronWindow.instance) {
      ElectronWindow.instance = new ElectronWindow();
    }
    return ElectronWindow.instance;
  }

  /** Returns true if the url starts with http or https */
  private isExternalLink(url: string): boolean {
    return /^http(s)?:\/\//.test(url);
  }

  /** Intercepts any requests to open a new browser window (window.open or <a target="_blank">) */
  private onOpenNewWindow = (details: HandlerDetails) => {
    if (this.isExternalLink(details.url)) {
      // do not open a new Electron browser window, and instead open in the user's default browser
      shell.openExternal(details.url, { activate: true });
      return { action: 'deny' } as const;
    }
    return { action: 'allow' } as const;
  };
}
