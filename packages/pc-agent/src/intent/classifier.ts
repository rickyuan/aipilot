/**
 * Intent classifier — uses Claude Code CLI to classify voice utterances.
 *
 * Instead of the Anthropic API, we use the `claude` CLI (available with
 * Claude Max subscription) to perform NLU intent classification.
 *
 * Uses spawn (not exec) because Claude Code streams to stdout.
 */

import { spawn } from 'node:child_process';
import type { ClassifiedIntent, IntentType } from '@deskpilot/shared';

const CLASSIFICATION_PROMPT = `You are an intent classifier for a voice-controlled remote desktop app called DeskPilot.

Given a user's voice utterance, classify it into ONE of these intents and extract parameters.

Intent types:
- code.create: User wants to create new code (e.g. "Create a React login component")
- code.edit: User wants to edit existing code (e.g. "Fix the bug on line 42")
- code.explain: User wants code explained (e.g. "Explain what this function does")
- file.create: User wants to create a file (e.g. "Create a file called utils.ts")
- file.navigate: User wants to open/navigate to a file/folder (e.g. "Open the src folder")
- editor.action: User wants a VS Code action (e.g. "Run the current file")
- shell.exec: User wants to run a shell command (e.g. "Install express with npm")
- browser.open: User wants to open a URL (e.g. "Open localhost:3000")
- system.status: User wants system info (e.g. "What's running on port 8080")
- confirm.yes: User confirms an action (e.g. "Yes, go ahead")
- confirm.no: User cancels an action (e.g. "No, cancel that")

Respond ONLY with valid JSON in this exact format, no other text:
{"type":"<intent_type>","confidence":<0.0-1.0>,"parameters":{<relevant_params>}}

Parameters to extract (when applicable):
- For code intents: {"description": "what to create/edit/explain"}
- For file intents: {"path": "file or folder path", "filename": "name"}
- For shell.exec: {"command": "the shell command"}
- For browser.open: {"url": "the URL"}
- For system.status: {"query": "what to check"}
- For confirm: {}

User utterance: `;

/**
 * Classifies a voice utterance into an intent using Claude Code CLI.
 * @param utterance - The raw voice utterance text
 * @returns The classified intent with confidence and parameters
 */
export async function classifyIntent(utterance: string): Promise<ClassifiedIntent> {
  const prompt = CLASSIFICATION_PROMPT + JSON.stringify(utterance);

  try {
    const output = await runClaude(prompt);
    const parsed = parseClassification(output, utterance);
    return parsed;
  } catch (err: unknown) {
    console.error('[Classifier] Classification failed:', err);
    // Fallback: try to infer from simple keyword matching
    return fallbackClassify(utterance);
  }
}

/**
 * Runs the Claude CLI with --print flag and returns stdout.
 */
function runClaude(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('claude', ['--print', prompt], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
      timeout: 15000,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(`Claude CLI exited with code ${String(code)}: ${stderr}`));
      }
    });

    child.on('error', (err: Error) => {
      reject(new Error(`Failed to spawn claude: ${err.message}`));
    });
  });
}

/**
 * Parses the JSON output from Claude into a ClassifiedIntent.
 */
function parseClassification(output: string, utterance: string): ClassifiedIntent {
  // Extract JSON from the output (Claude might add extra text)
  const jsonMatch = output.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`No JSON found in classifier output: ${output.slice(0, 200)}`);
  }

  const parsed = JSON.parse(jsonMatch[0]) as {
    type: string;
    confidence: number;
    parameters: Record<string, unknown>;
  };

  // Validate intent type
  const validTypes: IntentType[] = [
    'code.create', 'code.edit', 'code.explain',
    'file.create', 'file.navigate',
    'editor.action', 'shell.exec', 'browser.open', 'system.status',
    'confirm.yes', 'confirm.no',
  ];

  if (!validTypes.includes(parsed.type as IntentType)) {
    throw new Error(`Invalid intent type: ${parsed.type}`);
  }

  return {
    type: parsed.type as IntentType,
    confidence: Math.min(1, Math.max(0, parsed.confidence)),
    parameters: parsed.parameters ?? {},
    rawUtterance: utterance,
  };
}

/**
 * Fallback classifier using simple keyword matching.
 * Used when Claude CLI is unavailable or fails.
 */
function fallbackClassify(utterance: string): ClassifiedIntent {
  const lower = utterance.toLowerCase();

  const rules: Array<{ keywords: string[]; type: IntentType; params: Record<string, unknown> }> = [
    { keywords: ['yes', 'go ahead', 'confirm', 'do it', '好的', '确认', '是的'], type: 'confirm.yes', params: {} },
    { keywords: ['no', 'cancel', 'stop', 'don\'t', '不', '取消', '停'], type: 'confirm.no', params: {} },
    { keywords: ['create', 'new', 'make', '创建', '新建'], type: 'code.create', params: { description: utterance } },
    { keywords: ['fix', 'edit', 'change', 'update', 'modify', '修改', '修复'], type: 'code.edit', params: { description: utterance } },
    { keywords: ['explain', 'what does', 'how does', '解释', '什么意思'], type: 'code.explain', params: { description: utterance } },
    { keywords: ['open file', 'go to', 'navigate', '打开文件', '跳转'], type: 'file.navigate', params: { path: utterance } },
    { keywords: ['run', 'execute', 'start', '运行', '执行'], type: 'editor.action', params: { action: utterance } },
    { keywords: ['install', 'npm', 'pnpm', 'pip', 'brew', 'git', '安装'], type: 'shell.exec', params: { command: utterance } },
    { keywords: ['open', 'browser', 'localhost', 'http', '浏览器'], type: 'browser.open', params: { url: utterance } },
    { keywords: ['status', 'port', 'running', 'process', '状态', '端口'], type: 'system.status', params: { query: utterance } },
  ];

  for (const rule of rules) {
    if (rule.keywords.some((kw) => lower.includes(kw))) {
      return {
        type: rule.type,
        confidence: 0.6,
        parameters: rule.params,
        rawUtterance: utterance,
      };
    }
  }

  // Default to shell.exec with low confidence
  return {
    type: 'shell.exec',
    confidence: 0.3,
    parameters: { command: utterance },
    rawUtterance: utterance,
  };
}
