/**
 * GeminiPrompt
 * Wraps the Chrome built-in LanguageModel (Gemini Nano) API.
 * Framework-agnostic – works in plain JS and React (client-side only).
 *
 * Install markdown-it in your project:
 *   npm install markdown-it
 *
 * Basic React usage:
 *
 *   import { GeminiPrompt } from './geminiPrompt';
 *
 *   const model = new GeminiPrompt();
 *   await model.init();
 *
 *   // Streaming (recommended for React state updates):
 *   await model.promptStream('Explain malaria trends', (chunk) => setOutput(chunk));
 *
 *   // Single-shot:
 *   const result = await model.prompt('Summarise this report...');
 */
export class GeminiPrompt {
  /** @type {any} Chrome LanguageModel session */
  promptLanguageModel = null;

  /** @type {boolean} True while a prompt is in flight */
  running = false;

  /** Persona definitions available for use as system prompts */
  characters = [
    {
      id: 'public_health_manager',
      name: 'Public Health Manager',
      style: 'Pragmatic, action-oriented, focused on implementation',
      approach:
        'Highlights resource allocation, workforce capacity, operational challenges, and feasible interventions',
      tone: 'Clear, managerial, with recommendations suitable for health departments.',
    },
    {
      id: 'politician',
      name: 'Politician / Policy Maker',
      style: 'Strategic, persuasive, people-focused',
      approach:
        'Frames information for public trust, political feasibility, and stakeholder interests',
      tone: 'Accessible, motivational, sometimes high-level rather than technical.',
    },
    {
      id: 'epidemiologist',
      name: 'Epidemiologist',
      style: 'Analytical, evidence-driven, methodical',
      approach:
        'Focuses on patterns, transmission dynamics, risk factors, and causal inference',
      tone: 'Technical but structured, emphasizing methodology and validity.',
    },
    {
      id: 'statistician',
      name: 'Statistician',
      style: 'Precise, cautious, detail-oriented',
      approach:
        'Explains uncertainty, assumptions, confidence intervals, and robustness of findings',
      tone: 'Neutral, focused on rigor and limitations of data.',
    },
    {
      id: 'research_scientist',
      name: 'Research Scientist',
      style: 'Curious, exploratory, academic',
      approach: 'Connects findings to theories, literature, and future studies',
      tone: 'In-depth, hypothesis-driven, often includes reference-like framing.',
    },
    {
      id: 'news_desk',
      name: 'News Desk Analyst',
      style: 'Fast, digestible, narrative-driven',
      approach: 'Converts data into headlines, stories, and simplified comparisons',
      tone: 'Clear, engaging, avoids jargon, but may sacrifice nuance.',
    },
    {
      id: 'community_advocate',
      name: 'Community Advocate',
      style: 'Empathetic, grassroots-oriented',
      approach: 'Frames data in terms of lived experiences, equity, and local impact',
      tone: 'Inclusive, people-centered, calls for fairness and accessibility.',
    },
    {
      id: 'health_economist',
      name: 'Health Economist',
      style: 'Value-focused, comparative, budget-conscious',
      approach: 'Links interventions to cost-effectiveness, ROI, and trade-offs',
      tone: 'Rational, structured, with an emphasis on efficiency.',
    },
    {
      id: 'risk_communicator',
      name: 'Risk Communicator',
      style: 'Simplifier, transparent, public-facing',
      approach:
        'Explains uncertainty, risks, and probabilities in ways ordinary people can understand',
      tone: 'Calm, relatable, reassuring but honest.',
    },
    {
      id: 'systems_thinker',
      name: 'Systems Thinker',
      style: 'Holistic, big-picture, interconnected',
      approach:
        'Examines interactions across health, economy, society, and environment',
      tone: 'Strategic, conceptual, emphasizes complexity and ripple effects.',
    },
  ];

  defaults = {
    systemPrompt:
      'You are a Public Health Manager; your style is Pragmatic, action-oriented, focused on implementation; ' +
      'your approach: Highlights resource allocation, workforce capacity, operational challenges, and feasible interventions; ' +
      'your tone: Clear, managerial, with recommendations suitable for health departments.',
  };

  /**
   * Initialise the underlying LanguageModel session.
   * Safe to call multiple times – no-ops if already initialised.
   *
   * @param {object}   [opts={}]   Options forwarded to LanguageModel.create()
   * @param {function} [onStatus]  Optional (message: string) => void status callback
   * @throws {Error} if the LanguageModel API is unavailable or creation fails
   */
  async init(opts = {}, onStatus) {
    if (this.promptLanguageModel) return;

    if (typeof LanguageModel === 'undefined') {
      const msg =
        'LanguageModel API not available. ' +
        'Enable it via chrome://flags/#prompt-api-for-gemini-nano and restart Chrome.';
      if (onStatus) onStatus(msg);
      throw new Error(msg);
    }

    const options = {
      initialPrompts: [{ role: 'system', content: this.defaults.systemPrompt }],
      ...opts,
    };

    try {
      this.promptLanguageModel = await LanguageModel.create(options);
    } catch (e) {
      const msg = `LanguageModel failed to initialise: ${e.message}`;
      if (onStatus) onStatus(msg);
      throw e;
    }

    if (onStatus) onStatus('LanguageModel initialised.');
  }

  /**
   * Destroy and release the underlying model session.
   * The instance can be re-initialised with init() afterwards.
   */
  async destroy() {
    if (this.promptLanguageModel) {
      await this.promptLanguageModel.destroy();
      this.promptLanguageModel = null;
    }
  }

  /**
   * Send a single (non-streaming) prompt and return the full response.
   *
   * @param {string} promptInput
   * @returns {Promise<string>}
   */
  async prompt(promptInput) {
    this._assertReady();
    try {
      this.running = true;
      const result = await this.promptLanguageModel.prompt(promptInput);
      return result?.summary ?? result;
    } finally {
      this.running = false;
    }
  }

  /**
   * Stream a prompt response.
   * onChunk is called with the full accumulated text on every token so that
   * React state can simply be set to the latest value:
   *   await model.promptStream(text, (chunk) => setOutput(chunk));
   *
   * @param {string}   promptInput
   * @param {function} onChunk      (accumulatedText: string) => void
   * @param {function} [onComplete] (fullText: string) => void  – called once when done
   */
  async promptStream(promptInput, onChunk, onComplete) {
    this._assertReady();

    let accumulatedText = '';

    try {
      this.running = true;
      const stream = await this.promptLanguageModel.promptStreaming(promptInput);

      for await (const chunk of stream) {
        accumulatedText += chunk;
        if (typeof onChunk === 'function') onChunk(accumulatedText);
      }
    } finally {
      this.running = false;
    }

    if (typeof onComplete === 'function') onComplete(accumulatedText);
  }

  /** @private */
  _assertReady() {
    if (!this.promptLanguageModel) {
      throw new Error('LanguageModel not initialised. Call init() first.');
    }
  }
}

