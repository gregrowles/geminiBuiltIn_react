## Gemini Nano (Built-In) for React Projects

Client-side TypeScript helpers built on top of Chrome's built-in **Gemini Nano** `LanguageModel` API.  
Designed for **React** (or any bundler-based TypeScript project) – no DOM manipulation, no `window` globals.

---

### Requirements

- **Chrome** with the Prompt API flag enabled:  
  `chrome://flags/#prompt-api-for-gemini-nano` → **Enabled**, then relaunch.
- **22 GB+** of free storage on the Chrome profile volume.
- macOS 13+ (Ventura), Windows 10/11, or Linux — Chrome for Android/iOS/ChromeOS is not yet supported.

---

### Installation

Copy `geminiApp.ts` and `geminiPrompt.ts` into your project, then install the peer dependency:

```bash
npm install markdown-it
npm install --save-dev @types/markdown-it
```

To type-check the library on its own:

```bash
npm run typecheck
```

---

### API

#### `createGeminiApp()` → `GeminiApp`

Factory function — create one instance per logical session (component, context, or store).

#### `GeminiApp`

| Method / Property | Description |
|---|---|
| `init(onStatus?, opts?)` | Initialise the `LanguageModel` session. Safe to call multiple times (no-op if already active). |
| `destroy()` | Destroy the session and free GPU/memory resources. |
| `runPrompt(text, onComplete?)` | Single-shot prompt. Returns `Promise<string>`. |
| `runPromptStream(text, onChunk, onComplete?)` | Streaming prompt. `onChunk(accumulatedText)` fires on every token. |
| `runPromptStreamFromObject(obj, onChunk, onComplete?, opts?)` | Streaming prompt from a structured object — supports a `defaultPrompt` system-prompt override. |
| `renderMarkdown(text)` | Render a markdown string to an HTML string. |
| `aboutGemini()` | Returns a markdown string describing which Gemini Nano APIs are available in the current browser. |
| `characters` | Array of built-in public-health persona definitions (use as system prompts). |
| `systemPrompt` | Get / set the active system prompt. |

#### Named exports

```ts
import {
  createGeminiApp,
  GeminiApp,
  GeminiPrompt,
  renderMarkdown,
  generateId,
} from './geminiApp';
```

---

### React Usage

```tsx
import { useState, useEffect, useRef } from 'react';
import { createGeminiApp } from './geminiApp';

export function GeminiPanel() {
  const gemini = useRef(createGeminiApp());
  const [output, setOutput] = useState('');
  const [status, setStatus] = useState('');

  async function handleAsk(promptText: string) {
    await gemini.current.init(setStatus);
    await gemini.current.runPromptStream(promptText, setOutput);
  }

  useEffect(() => () => { gemini.current.destroy(); }, []);

  return (
    <div>
      <p>{status}</p>
      <div
        dangerouslySetInnerHTML={{
          __html: gemini.current.renderMarkdown(output),
        }}
      />
    </div>
  );
}
```

#### Structured input with system-prompt override

```ts
await gemini.current.runPromptStreamFromObject(
  {
    prompt: 'Analyse the attached malaria data.',
    defaultPrompt: 'You are an epidemiologist. Be precise and evidence-based.',
    reportId: 'abc123',
  },
  (chunk) => setOutput(chunk),
  (result) => console.log('Done', result),
);
```

#### Lower-level usage via `GeminiPrompt`

```ts
import { GeminiPrompt } from './geminiPrompt';

const model = new GeminiPrompt();
await model.init();

// Single-shot
const response = await model.prompt('Summarise this report...');

// Streaming
await model.promptStream('Explain malaria trends', (chunk) => setOutput(chunk));

await model.destroy();
```
