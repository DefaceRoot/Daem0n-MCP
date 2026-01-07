/**
 * Post-Edit Hook - Significance detection after file modifications
 * 
 * Ported from: hooks/daem0n_post_edit_hook.py
 * 
 * Features:
 * - Detects significant changes (architecture, security, API, database)
 * - Tracks modified files in session state
 * - Suggests calling remember() for weighty changes
 */

import type { SessionState, FileModification } from "../types"
import { SIGNIFICANT_PATTERNS, SIGNIFICANT_EXTENSIONS } from "../types"

/**
 * Determine if a file change is significant enough to suggest remembering
 * 
 * Checks:
 * 1. File extension (is it a significant file type?)
 * 2. Pattern matching (does the change contain significant patterns?)
 * 3. Change size (large changes are usually significant)
 */
export function isSignificantChange(filePath: string, changeContent: string): boolean {
  if (!filePath) {
    return false
  }

  // Check file extension
  const lastDot = filePath.lastIndexOf(".")
  if (lastDot === -1) {
    return false
  }
  
  const ext = filePath.slice(lastDot).toLowerCase()
  if (!SIGNIFICANT_EXTENSIONS.has(ext)) {
    return false
  }

  // Check for significant patterns in the change
  const changeLower = changeContent.toLowerCase()
  for (const pattern of SIGNIFICANT_PATTERNS) {
    if (changeLower.includes(pattern.toLowerCase())) {
      return true
    }
  }

  // Large changes are usually significant
  if (changeContent.length > 500) {
    return true
  }

  return false
}

/**
 * Create a file modification record
 */
export function createFileModification(
  filePath: string,
  oldContent: string,
  newContent: string
): FileModification {
  return {
    path: filePath,
    lastModified: new Date(),
    changeSize: Math.abs(newContent.length - oldContent.length),
  }
}

/**
 * Get the filename from a path
 */
function getFileName(filePath: string): string {
  return filePath.split(/[/\\]/).pop() || filePath
}

/**
 * Handle post-edit suggestions
 * 
 * Called after file edit/write tools complete.
 * Detects significant changes and suggests remembering them.
 * 
 * @param filePath - Path to the file that was edited
 * @param oldString - Original content (before edit)
 * @param newString - New content (after edit)
 * @param state - Current session state
 * @returns Suggestion message, or null if change is not significant
 */
export async function handlePostEdit(
  filePath: string,
  oldString: string,
  newString: string,
  state: SessionState
): Promise<string | null> {
  if (!filePath) {
    return null
  }

  // Combine old and new for pattern matching
  const changeContent = `${oldString} -> ${newString}`

  // Check if this is a significant change
  if (!isSignificantChange(filePath, changeContent)) {
    return null
  }

  // Track the modification in session state
  const modification = createFileModification(filePath, oldString, newString)
  state.modifiedFiles.set(filePath, modification)

  // Return suggestion message
  const fileName = getFileName(filePath)
  return `[Daem0n suggests] Significant change to ${fileName}. Consider:
mcp__daem0nmcp__remember(category='decision', content='...', file_path='${filePath}')`
}

/**
 * Get statistics about modified files in the current session
 */
export function getModifiedFilesStats(state: SessionState): {
  count: number
  totalChangeSize: number
  files: string[]
} {
  let totalChangeSize = 0
  const files: string[] = []

  for (const [path, mod] of state.modifiedFiles) {
    totalChangeSize += mod.changeSize
    files.push(path)
  }

  return {
    count: state.modifiedFiles.size,
    totalChangeSize,
    files,
  }
}
