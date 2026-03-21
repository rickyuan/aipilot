/**
 * Intent types for voice command classification.
 *
 * Voice input flows through: ASR → NLU (Claude API) → Intent → Command → Executor
 */

export type IntentType =
  | 'code.create'
  | 'code.edit'
  | 'code.explain'
  | 'file.create'
  | 'file.navigate'
  | 'editor.action'
  | 'shell.exec'
  | 'browser.open'
  | 'system.status'
  | 'confirm.yes'
  | 'confirm.no';

export type ExecutorType = 'claude-code' | 'vscode' | 'shell' | 'browser';

/** Mapping from intent type to the executor that handles it */
export const INTENT_EXECUTOR_MAP: Record<IntentType, ExecutorType | null> = {
  'code.create': 'claude-code',
  'code.edit': 'claude-code',
  'code.explain': 'claude-code',
  'file.create': 'shell',
  'file.navigate': 'vscode',
  'editor.action': 'vscode',
  'shell.exec': 'shell',
  'browser.open': 'browser',
  'system.status': 'shell',
  'confirm.yes': null,
  'confirm.no': null,
};

/** Result of intent classification from the NLU pipeline */
export interface ClassifiedIntent {
  /** The classified intent type */
  type: IntentType;
  /** Confidence score from 0 to 1 */
  confidence: number;
  /** Extracted parameters from the utterance */
  parameters: Record<string, unknown>;
  /** The original raw utterance text */
  rawUtterance: string;
}
