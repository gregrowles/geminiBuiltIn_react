/**
 * geminiApp.js
 * High-level helpers built on top of GeminiPrompt.
 * Designed for React (or any bundler-based project) – no DOM manipulation,
 * no window globals.  All functions are pure async / callback-based so they
 * drop straight into React state hooks.
 *
 * Install peer dependencies:
 *   npm install markdown-it
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
 *   async function handleSubmit(text) {
 *     await gemini.init((status) => console.log(status));
 *     await gemini.runPromptStream(text, setOutput);   // setOutput called on each token
 *   }
 *
 *   // Render markdown:
 *   <div dangerouslySetInnerHTML={{ __html: gemini.renderMarkdown(output) }} />
 *
 * --------------------------------------------------------------------------
 */

import { GeminiPrompt } from './geminiPrompt.js';
import MarkdownIt from 'markdown-it';

// ---------------------------------------------------------------------------
// Markdown helper (stateless – safe to call from anywhere)
// ---------------------------------------------------------------------------

const md = new MarkdownIt();

/**
 * Render a markdown string to an HTML string.
 * Use with React's dangerouslySetInnerHTML.
 * @param {string} markdownText
 * @returns {string} HTML string
 */
export function renderMarkdown(markdownText) {
  return md.render(markdownText ?? '');
}

// ---------------------------------------------------------------------------
// ID helper
// ---------------------------------------------------------------------------

/**
 * Generate a random alphanumeric ID.
 * @param {number} [length=15]
 * @returns {string}
 */
export function generateId(length = 15) {
  return Math.random().toString(36).substring(2, length + 2);
}

// ---------------------------------------------------------------------------
// Factory – creates a self-contained Gemini app instance
// ---------------------------------------------------------------------------

/**
 * Create a self-contained Gemini Nano app instance.
 * Instantiate once per logical "session" (e.g. per component or per context).
 *
 * @returns {GeminiApp}
 */
export function createGeminiApp() {
  return new GeminiApp();
}

export class GeminiApp {
  constructor() {
    this._model = new GeminiPrompt();
  }

  // ── Accessors ─────────────────────────────────────────────────────────────

  /** Available persona characters. */
  get characters() {
    return this._model.characters;
  }

  /** Current system-prompt default. */
  get systemPrompt() {
    return this._model.defaults.systemPrompt;
  }

  set systemPrompt(value) {
    this._model.defaults.systemPrompt = value;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  /**
   * Initialise (or re-initialise) the LanguageModel session.
   *
   * @param {function} [onStatus]  (message: string) => void
   * @param {object}   [opts={}]   Passed directly to LanguageModel.create()
   */
  async init(onStatus, opts = {}) {
    await this._model.init(opts, onStatus);
  }

  /** Destroy the current session (frees GPU/memory resources). */
  async destroy() {
    await this._model.destroy();
  }

  // ── Prompt API ────────────────────────────────────────────────────────────

  /**
   * Single-shot prompt.  Returns the full response string.
   *
   * @param {string}   promptText
   * @param {function} [onComplete]  ({ id, type, input, response }) => void
   * @returns {Promise<string>}
   */
  async runPrompt(promptText, onComplete) {
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
   * @param {string}   promptText
   * @param {function} onChunk     (accumulatedText: string) => void
   * @param {function} [onComplete] ({ id, type, input, response }) => void
   */
  async runPromptStream(promptText, onChunk, onComplete) {
    await this._model.promptStream(
      promptText,
      onChunk,
      (fullText) => {
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
   * @param {{ prompt: string, defaultPrompt?: string, [key: string]: any }} inputObj
   * @param {function} onChunk      (accumulatedText: string) => void
   * @param {function} [onComplete] (enrichedInputObj) => void
   * @param {object}   [opts={}]    Passed to LanguageModel.create() via init()
   */
  async runPromptStreamFromObject(inputObj, onChunk, onComplete, opts = {}) {
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
      (fullText) => {
        if (typeof onComplete === 'function') {
          const result = { ...inputObj, id: generateId(), type: 'Ps', response: fullText };
          onComplete(result);
        }
      },
    );
  }

  // ── Utility ───────────────────────────────────────────────────────────────

  /**
   * Render markdown to HTML.  Convenience wrapper around the module-level
   * renderMarkdown() so consumers only need one import.
   * @param {string} markdownText
   * @returns {string}
   */
  renderMarkdown(markdownText) {
    return renderMarkdown(markdownText);
  }

  /**
   * Return an info string describing which Gemini Nano APIs are available
   * in the current browser, rendered as a markdown string.
   * @returns {string} Markdown
   */
  aboutGemini() {
    const check = (api) => (api in self ? '✓' : '–');

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
