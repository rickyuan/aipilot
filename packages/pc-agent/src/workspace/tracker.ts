/**
 * Workspace tracker — detects recently opened VS Code projects.
 *
 * Reads VS Code's storage.json to find the user's recent workspaces,
 * enabling "continue last project" and workspace-aware commands.
 */

import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

/** A recently opened workspace */
export interface RecentWorkspace {
  /** Absolute path to the workspace folder */
  path: string;
  /** Display name (last path segment) */
  name: string;
}

/** Paths where VS Code stores recent workspace data (by platform) */
const VSCODE_STORAGE_PATHS = {
  darwin: join(homedir(), 'Library/Application Support/Code/User/globalStorage/storage.json'),
  linux: join(homedir(), '.config/Code/User/globalStorage/storage.json'),
  win32: join(homedir(), 'AppData/Roaming/Code/User/globalStorage/storage.json'),
};

/**
 * Returns the most recently opened VS Code workspaces.
 * @param limit - Max number of workspaces to return (default 5)
 * @returns Array of recent workspaces, most recent first
 */
export async function getRecentWorkspaces(limit = 5): Promise<RecentWorkspace[]> {
  const platform = process.platform as 'darwin' | 'linux' | 'win32';
  const storagePath = VSCODE_STORAGE_PATHS[platform];

  if (!storagePath || !existsSync(storagePath)) {
    console.log('[Workspace] VS Code storage.json not found');
    return [];
  }

  try {
    const raw = await readFile(storagePath, 'utf-8');
    const storage = JSON.parse(raw) as Record<string, unknown>;

    // VS Code stores recent entries under different keys depending on version
    const recentEntries = extractRecentPaths(storage);

    return recentEntries
      .filter((p) => existsSync(p))
      .slice(0, limit)
      .map((p) => ({
        path: p,
        name: p.split('/').pop() ?? p,
      }));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[Workspace] Failed to read VS Code storage: ${message}`);
    return [];
  }
}

/**
 * Extracts recent folder/workspace paths from VS Code's storage.json.
 * Handles multiple VS Code versions and storage formats.
 */
function extractRecentPaths(storage: Record<string, unknown>): string[] {
  const paths: string[] = [];

  // Format 1: lastKnownMenubarData.menus.recent (older VS Code)
  const menubar = storage['lastKnownMenubarData'] as Record<string, unknown> | undefined;
  if (menubar) {
    const menus = menubar['menus'] as Record<string, unknown> | undefined;
    const recent = menus?.['Recent'] as Record<string, unknown> | undefined;
    const items = recent?.['items'] as Array<{ uri?: { path?: string } }> | undefined;
    if (items) {
      for (const item of items) {
        if (item.uri?.path) {
          paths.push(decodeURIComponent(item.uri.path));
        }
      }
    }
  }

  // Format 2: openedPathsList.entries (newer VS Code)
  const openedPaths = storage['openedPathsList'] as Record<string, unknown> | undefined;
  if (openedPaths) {
    const entries = openedPaths['entries'] as Array<{ folderUri?: string; workspace?: { configPath?: string } }> | undefined;
    if (entries) {
      for (const entry of entries) {
        if (entry.folderUri) {
          try {
            const url = new URL(entry.folderUri);
            paths.push(decodeURIComponent(url.pathname));
          } catch {
            // Skip invalid URIs
          }
        }
      }
    }
  }

  // Format 3: windowsState.lastActiveWindow / openedWindows
  const windowsState = storage['windowsState'] as Record<string, unknown> | undefined;
  if (windowsState) {
    const extractFromWindow = (win: Record<string, unknown> | undefined) => {
      const folder = win?.['folder'] as string | undefined;
      if (folder) {
        try {
          const url = new URL(folder);
          paths.push(decodeURIComponent(url.pathname));
        } catch {
          // Skip
        }
      }
    };

    extractFromWindow(windowsState['lastActiveWindow'] as Record<string, unknown> | undefined);

    const openedWindows = windowsState['openedWindows'] as Array<Record<string, unknown>> | undefined;
    if (openedWindows) {
      for (const win of openedWindows) {
        extractFromWindow(win);
      }
    }
  }

  // Deduplicate while preserving order
  return [...new Set(paths)];
}

/**
 * Returns the most recently opened workspace (first in the list).
 * @returns The most recent workspace, or null if none found
 */
export async function getCurrentWorkspace(): Promise<RecentWorkspace | null> {
  const workspaces = await getRecentWorkspaces(1);
  return workspaces[0] ?? null;
}
