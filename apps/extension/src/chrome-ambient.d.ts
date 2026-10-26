declare const chrome: {
  runtime: {
    sendMessage(message: unknown, options?: unknown, responseCallback?: (response: unknown) => void): Promise<unknown>;
    onMessage: {
      addListener(listener: (message: unknown, sender: unknown, sendResponse: (response: unknown) => void) => boolean | void): void;
    };
    getURL(path: string): string;
    readonly id: string;
  };
  tabCapture: {
    getMediaStreamId(options: { targetTabId: number }): Promise<string>;
  };
  offscreen: {
    createDocument(details: { url: string; reasons: string[]; justification: string }): Promise<void>;
    closeDocument(): Promise<void>;
  };
  sidePanel: {
    setOptions(options: { path: string }): Promise<void>;
  };
  tabs: {
    query(queryInfo: { active?: boolean; currentWindow?: boolean }): Promise<Array<{ id: number; url?: string }>>;
    sendMessage(tabId: number, message: unknown): Promise<unknown>;
  };
};
