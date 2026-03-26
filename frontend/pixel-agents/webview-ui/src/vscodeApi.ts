import { isBrowserRuntime } from './runtime';

declare function acquireVsCodeApi(): { postMessage(msg: unknown): void };

export const vscode: { postMessage(msg: unknown): void } = isBrowserRuntime
  ? {
      postMessage: (msg: unknown) => {
        // Forward to parent window so Next.js page can handle saveLayout etc.
        if (window.parent !== window) {
          window.parent.postMessage({ source: 'pixel-office', payload: msg }, '*');
        }
      },
    }
  : (acquireVsCodeApi() as { postMessage(msg: unknown): void });
