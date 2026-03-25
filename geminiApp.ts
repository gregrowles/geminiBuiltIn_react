/**
 * geminiApp.ts
 * High-level helpers built on top of GeminiPrompt.
 * Designed for React (or any bundler-based project) – no DOM manipulation,
 * no window globals.  All functions are pure async / callback-based so they
 * drop straight into React state hooks.
 *
 * Install peer dependencies:
 *   npm install markdown-it
 *   npm install --save-dev @types/markdown-it
 *
 * --------------------------------------------------------------------------
 * React quick-start
 * --------------------------------------------------------------------------
 *
 *   import { createGeminiApp } from './geminiApp';
 *
 *   // Create one instance per component (or share via context / zustand etc.)
 *   const gemini = createGeminiApp();
 *
 *   // Inside a component:
 *   const [output, setOutput] = useState('');
 *
 *   async function handleSubmit(text: string) {
 *     await gemini.init((status) => console.log(status));
 *     await gemini.runPromptStream(text, setOutput);   // setOutput called on each token
 *   }
 *
 *   // Render markdown:
 *   <div dangerouslySetInnerHTML={{ __html: gemini.renderMarkdown(output) }} />
 *
 * --------------------------------------------------------------------------
 */

import {
  GeminiPrompt,
  Character,
  LanguageModelCreateOptions,
  StatusCallback,
  ChunkCallback,
} from './geminiPrompt.js';
import MarkdownIt from 'markdown-it';

// ---------------------------------------------------------------------------
// Markdown helper (stateless – safe to call from anywhere)
// ---------------------------------------------------------------------------

const md = new MarkdownIt();

/**
 * Render a markdown string to an HTML string.
 * Use with React's dangerouslySetInnerHTML.
 */
export function renderMarkdown(markdownText: string): string {
  return md.render(markdownText ?? '');
}

// ---------------------------------------------------------------------------
// ID helper
// ---------------------------------------------------------------------------

/**
 * Generate a random alphanumeric ID.
 */
export function generateId(length: number = 15): string {
  return Math.random().toString(36).substring(2, length + 2);
}

// ---------------------------------------------------------------------------
// Shared result types
// ---------------------------------------------------------------------------

export interface PromptResult {
  id: string;
  type: 'P' | 'Ps';
  input: string;
  response: string;
}

export type OnCompleteCallback = (result: PromptResult) => void;

export interface PromptInputObject {
  prompt: string;
  defaultPrompt?: string;
  [key: string]: unknown;
}

export interface PromptObjectResult extends PromptInputObject {
  id: string;
  type: 'Ps';
  response: string;
}

export type OnObjectCompleteCallback = (result: PromptObjectResult) => void;

// ---------------------------------------------------------------------------
// Factory – creates a self-contained Gemini app instance
// ---------------------------------------------------------------------------

/**
 * Create a self-contained Gemini Nano app instance.
 * Instantiate once per logical "session" (e.g. per component or per context).
 */
export function createGeminiApp(): GeminiApp {
  return new GeminiApp();
}

export class GeminiApp {
  private _model: GeminiPrompt;

  constructor() {
    this._model = new GeminiPrompt();
  }

  // ── Accessors ─────────────────────────────────────────────────────────────

  /** Available persona characters. */
  get characters(): Character[] {
    return this._model.characters;
  }

  /** Current system-prompt default. */
  get systemPrompt(): string {
    return this._model.defaults.systemPrompt;
  }

  set systemPrompt(value: string) {
    this._model.defaults.systemPrompt = value;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  /**
   * Initialise (or re-initialise) the LanguageModel session.
   *
   * @param onStatus  Optional status callback (message: string) => void
   * @param opts      Passed directly to LanguageModel.create()
   */
  async init(onStatus?: StatusCallback, opts: LanguageModelCreateOptions = {}): Promise<void> {
    await this._model.init(opts, onStatus);
  }

  /** Destroy the current session (frees GPU/memory resources). */
  async destroy(): Promise<void> {
    await this._model.destroy();
  }

  // ── Prompt API ────────────────────────────────────────────────────────────

  /**
   * Single-shot prompt. Returns the full response string.
   *
   * @param promptText
   * @param onComplete  Optional callback receiving the full result object
   */
  async runPrompt(promptText: string, onComplete?: OnCompleteCallback): Promise<string> {
    const response = await this._model.prompt(promptText);

    if (typeof onComplete === 'function') {
      onComplete({ id: generateId(), type: 'P', input: promptText, response });
    }

    return response;
  }

  /**
   * Streaming prompt.
   * onChunk is called with the growing accumulated text on every token –
   * pass a React setState setter directly.
   *
   * @param promptText
   * @param onChunk      Called with accumulated text on each token
   * @param onComplete   Optional callback receiving the full result object
   */
  async runPromptStream(
    promptText: string,
    onChunk: ChunkCallback,
    onComplete?: OnCompleteCallback,
  ): Promise<void> {
    await this._model.promptStream(
      promptText,
      onChunk,
      (fullText: string) => {
        if (typeof onComplete === 'function') {
          onComplete({ id: generateId(), type: 'Ps', input: promptText, response: fullText });
        }
      },
    );
  }

  /**
   * Streaming prompt driven by a structured input object.
   * Useful when you want to pass system-prompt overrides alongside the prompt.
   *
   * @param inputObj     Must include a `prompt` string; optionally a `defaultPrompt`
   * @param onChunk      Called with accumulated text on each token
   * @param onComplete   Optional callback receiving the enriched result object
   * @param opts         Passed to LanguageModel.create() via init()
   */
  async runPromptStreamFromObject(
    inputObj: PromptInputObject,
    onChunk: ChunkCallback,
    onComplete?: OnObjectCompleteCallback,
    opts: LanguageModelCreateOptions = {},
  ): Promise<void> {
    if (inputObj?.defaultPrompt) {
      this._model.defaults.systemPrompt = inputObj.defaultPrompt;
    }

    // Re-init if options differ from current session
    if (Object.keys(opts).length) {
      await this._model.destroy();
    }

    await this._model.init(opts);

    await this._model.promptStream(
      inputObj.prompt,
      onChunk,
      (fullText: string) => {
        if (typeof onComplete === 'function') {
          const result: PromptObjectResult = {
            ...inputObj,
            id: generateId(),
            type: 'Ps',
            response: fullText,
          };
          onComplete(result);
        }
      },
    );
  }

  // ── Utility ───────────────────────────────────────────────────────────────

  /**
   * Render markdown to HTML. Convenience wrapper around the module-level
   * renderMarkdown() so consumers only need one import.
   */
  renderMarkdown(markdownText: string): string {
    return renderMarkdown(markdownText);
  }

  /**
   * Return an info string describing which Gemini Nano APIs are available
   * in the current browser, rendered as a markdown string.
   */
  aboutGemini(): string {
    const check = (api: string): string => (api in self ? '✓' : '–');

    return [
      '## Gemini Nano – Feature Availability\n',
      '| Feature | Available | Purpose |',
      '| --- | :---: | --- |',
      `| Summarizer | ${check('Summarizer')} | Summarise narratives, articles or messages |`,
      `| Translator | ${check('Translator')} | Translate text between languages |`,
      `| Rewriter   | ${check('Rewriter')}   | Rewrite text to sound more formal or polite |`,
      `| LanguageModel (Prompt) | ${check('LanguageModel')} | General Q&A and report analysis |`,
      '',
      '### Getting Started',
      'Gemini Nano is an experimental Chrome feature.',
      '',
      '1. Open a new tab and navigate to `chrome://flags/#prompt-api-for-gemini-nano`',
      '2. Set the flag to **Enabled** and relaunch Chrome.',
      '',
      '> **System requirements:** Windows 10/11, macOS 13+ (Ventura), or Linux.',
      '> At least **22 GB** of free storage on the Chrome profile volume.',
      '> Chrome for Android, iOS, and ChromeOS are not yet supported.',
    ].join('\n');
  }
}

// ---------------------------------------------------------------------------
// Named re-export for projects that only need the lower-level class
// ---------------------------------------------------------------------------
export { GeminiPrompt };
