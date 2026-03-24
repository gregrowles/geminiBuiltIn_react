## Gemini Nano (Built-In) for DHIS2 Reports

Client-side wrapper around Chrome's built-in **Gemini Nano** `LanguageModel` API.  
Designed for use in **React** (or any bundler-based) projects – no DOM manipulation, no `window` globals.

---

### Requirements

- **Chrome** with the Prompt API flag enabled:  
  `chrome://flags/#prompt-api-for-gemini-nano` → **Enabled**, then relaunch.
- **22 GB+** of free storage on the Chrome profile volume.
- macOS 13+, Windows 10/11, or Linux (not supported on Android/iOS/ChromeOS).

### Installation

```bash
npm install markdown-it
```

Copy `geminiApp.js` and `geminiPrompt.js` into your project.

---

### API

#### `createGeminiApp()` → `GeminiApp`

Factory function. Create one instance per session (component, context, or store).

#### `GeminiApp`

| Method | Description |
|---|---|
| `init(onStatus?, opts?)` | Initialise the LanguageModel session. Safe to call multiple times. |
| `destroy()` | Destroy the session and free resources. |
| `runPrompt(text, onComplete?)` | Single-shot prompt. Returns `Promise<string>`. |
| `runPromptStream(text, onChunk, onComplete?)` | Streaming prompt. `onChunk(accumulatedText)` fires on every token. |
| `runPromptStreamFromObject(obj, onChunk, onComplete?, opts?)` | Streaming prompt from a structured object (supports `defaultPrompt` override). |
| `renderMarkdown(text)` | Render a markdown string to HTML. |
| `aboutGemini()` | Returns a markdown string listing available Gemini Nano APIs. |
| `characters` | Array of built-in public-health persona definitions. |
| `systemPrompt` | Get/set the default system prompt. |

#### Named exports

```js
import { createGeminiApp, GeminiApp, GeminiPrompt, renderMarkdown, generateId } from './geminiApp';
```

---

### React Usage

```jsx
import { useState, useEffect, useRef } from 'react';
import { createGeminiApp } from './geminiApp';

export function GeminiPanel() {
  const gemini = useRef(createGeminiApp());
  const [output, setOutput] = useState('');
  const [status, setStatus] = useState('');

  async function handleAsk(promptText) {
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

```js
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
