/**
 * LLM service — calls Groq (OpenAI-compatible) for intent classification
 * and TTS response generation.
 *
 * Takes raw ASR text, returns classified intent + a spoken response.
 */

import { config } from '../config.js';
import type { IntentType, ExecutorType } from '@deskpilot/shared';
import { INTENT_EXECUTOR_MAP } from '@deskpilot/shared';

/** Result from LLM classification */
export interface LLMClassification {
  /** Classified intent type */
  intentType: IntentType;
  /** Which executor handles this */
  executor: ExecutorType | null;
  /** Executable instruction for the PC Agent */
  instruction: string;
  /** Extracted parameters */
  parameters: Record<string, unknown>;
  /** Natural language response for TTS */
  ttsResponse: string;
  /** Confidence score 0-1 */
  confidence: number;
}

const SYSTEM_PROMPT = `You are DeskPilot, a voice-controlled AI assistant that helps users control their PC.

When the user gives a voice command, you must:
1. Classify their intent
2. Extract the executable instruction
3. Generate a short, natural spoken response (1-2 sentences, will be read aloud via TTS)

Respond ONLY with valid JSON in this exact format:
{
  "intentType": "<one of the intent types below>",
  "instruction": "<the actual command/instruction to execute>",
  "parameters": {<relevant parameters>},
  "ttsResponse": "<short natural response for TTS, e.g. 'Sure, installing express now.'>",
  "confidence": <0.0-1.0>
}

Intent types and what to put in "instruction":
- "shell.exec": Extract the shell command. E.g. utterance "install express" → instruction "npm install express"
- "system.status": Build a status command. E.g. "what's on port 3000" → instruction "lsof -i :3000"
- "code.create": Description of what to create. E.g. "create a login component" → instruction "Create a React login component with email and password fields"
- "code.edit": Description of the edit. E.g. "fix the bug on line 42" → instruction "Fix the bug on line 42 of the current file"
- "code.explain": What to explain. E.g. "explain this function" → instruction "Explain the current function"
- "file.create": Shell command to create. E.g. "create utils.ts" → instruction "touch utils.ts"
- "file.navigate": File/folder path. E.g. "open the src folder" → instruction "src/"
- "editor.action": VS Code action. E.g. "run this file" → instruction "workbench.action.debug.run"
- "browser.open": URL to open. E.g. "open localhost 3000" → instruction "http://localhost:3000"
- "confirm.yes": User confirms. instruction ""
- "confirm.no": User cancels. instruction ""

Parameters to extract:
- shell.exec: {"command": "the shell command"}
- system.status: {"query": "what to check"}
- code.*: {"description": "what to do"}
- file.create: {"filename": "name"}
- file.navigate: {"path": "path"}
- browser.open: {"url": "url"}
- editor.action: {"action": "action name"}
- confirm.*: {}

Keep ttsResponse short and conversational. Use the user's language (if they speak Chinese, respond in Chinese).`;

interface OpenAIChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAIChatChoice {
  message: { content: string };
}

interface OpenAIChatResponse {
  choices: OpenAIChatChoice[];
}

/**
 * Classifies a voice utterance using Groq LLM.
 * @param utterance - The raw ASR text from the user
 * @returns Classification result with intent, instruction, and TTS response
 */
export async function classifyWithLLM(utterance: string): Promise<LLMClassification> {
  const apiKey = config.GROQ_API_KEY;
  const apiUrl = config.GROQ_API_URL ?? 'https://api.groq.com/openai/v1/chat/completions';
  const model = config.GROQ_MODEL ?? 'openai/gpt-oss-120b';

  if (!apiKey) {
    console.log('[LLM] No GROQ_API_KEY, using fallback classifier');
    return fallbackClassify(utterance);
  }

  const messages: OpenAIChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: utterance },
  ];

  try {
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, messages, temperature: 0.1 }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Groq API error ${String(res.status)}: ${errText.slice(0, 200)}`);
    }

    const data = await res.json() as OpenAIChatResponse;
    const content = data.choices[0]?.message?.content ?? '';

    return parseLLMResponse(content, utterance);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[LLM] Classification failed: ${message}`);
    return fallbackClassify(utterance);
  }
}

/**
 * Parses the JSON response from the LLM.
 * @param content - Raw LLM response text
 * @param utterance - Original utterance for fallback
 * @returns Parsed classification
 */
function parseLLMResponse(content: string, utterance: string): LLMClassification {
  // Extract JSON from response (LLM might wrap it in markdown code blocks)
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error(`[LLM] No JSON in response: ${content.slice(0, 200)}`);
    return fallbackClassify(utterance);
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as {
      intentType: string;
      instruction: string;
      parameters: Record<string, unknown>;
      ttsResponse: string;
      confidence: number;
    };

    const validTypes: IntentType[] = [
      'code.create', 'code.edit', 'code.explain',
      'file.create', 'file.navigate',
      'editor.action', 'shell.exec', 'browser.open', 'system.status',
      'confirm.yes', 'confirm.no',
    ];

    const intentType = validTypes.includes(parsed.intentType as IntentType)
      ? (parsed.intentType as IntentType)
      : 'shell.exec';

    return {
      intentType,
      executor: INTENT_EXECUTOR_MAP[intentType],
      instruction: parsed.instruction || utterance,
      parameters: parsed.parameters ?? {},
      ttsResponse: parsed.ttsResponse || 'OK.',
      confidence: Math.min(1, Math.max(0, parsed.confidence ?? 0.8)),
    };
  } catch {
    console.error(`[LLM] Failed to parse JSON: ${jsonMatch[0].slice(0, 200)}`);
    return fallbackClassify(utterance);
  }
}

/**
 * Fallback classifier using keyword matching when LLM is unavailable.
 * @param utterance - The raw utterance
 * @returns A best-effort classification
 */
function fallbackClassify(utterance: string): LLMClassification {
  const lower = utterance.toLowerCase();

  const rules: Array<{
    keywords: string[];
    intentType: IntentType;
    instruction: (u: string) => string;
    ttsResponse: string;
  }> = [
    { keywords: ['yes', 'go ahead', 'confirm', 'do it', '好的', '确认', '是的', '可以'], intentType: 'confirm.yes', instruction: () => '', ttsResponse: 'OK, executing now.' },
    { keywords: ['no', 'cancel', 'stop', 'don\'t', '不', '取消', '停', '算了'], intentType: 'confirm.no', instruction: () => '', ttsResponse: 'Cancelled.' },
    { keywords: ['install', 'npm', 'pnpm', 'pip', 'brew', 'yarn', '安装'], intentType: 'shell.exec', instruction: (u) => u, ttsResponse: 'Running the install command.' },
    { keywords: ['create', 'new file', '创建文件', '新建文件'], intentType: 'file.create', instruction: (u) => u, ttsResponse: 'Creating the file.' },
    { keywords: ['open localhost', 'open http', '打开浏览器'], intentType: 'browser.open', instruction: (u) => u, ttsResponse: 'Opening in the browser.' },
    { keywords: ['status', 'port', 'running', 'process', '状态', '端口'], intentType: 'system.status', instruction: (u) => u, ttsResponse: 'Checking system status.' },
    { keywords: ['explain', 'what does', 'how does', '解释', '什么意思'], intentType: 'code.explain', instruction: (u) => u, ttsResponse: 'Let me explain that.' },
    { keywords: ['fix', 'edit', 'change', 'update', 'modify', '修改', '修复'], intentType: 'code.edit', instruction: (u) => u, ttsResponse: 'Working on the edit.' },
    { keywords: ['create', 'make', 'build', 'write', '创建', '写'], intentType: 'code.create', instruction: (u) => u, ttsResponse: 'Creating that for you.' },
    { keywords: ['open', 'go to', 'navigate', '打开', '跳转'], intentType: 'file.navigate', instruction: (u) => u, ttsResponse: 'Opening the file.' },
    { keywords: ['run', 'execute', 'start', '运行', '执行'], intentType: 'shell.exec', instruction: (u) => u, ttsResponse: 'Running the command.' },
  ];

  for (const rule of rules) {
    if (rule.keywords.some((kw) => lower.includes(kw))) {
      return {
        intentType: rule.intentType,
        executor: INTENT_EXECUTOR_MAP[rule.intentType],
        instruction: rule.instruction(utterance),
        parameters: {},
        ttsResponse: rule.ttsResponse,
        confidence: 0.6,
      };
    }
  }

  return {
    intentType: 'shell.exec',
    executor: 'shell',
    instruction: utterance,
    parameters: { command: utterance },
    ttsResponse: "I'll try running that.",
    confidence: 0.4,
  };
}
