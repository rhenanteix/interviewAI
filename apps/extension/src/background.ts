import { captureStart, captureStop } from '@interviewia/shared';

const capturas = new Map<number, { tabId: number }>();

function status(texto: string): void {
  void chrome.runtime.sendMessage({ type: 'status', text: texto }).catch(() => {});
}

function erro(texto: string): void {
  void chrome.runtime
    .sendMessage({ type: 'extension.error', message: texto })
    .catch(() => {});
}

async function iniciarCaptura(tabId: number): Promise<void> {
  if (capturas.has(tabId)) {
    status('Captura já está ativa nesta aba.');
    return;
  }
  let streamId: string;
  try {
    streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId });
  } catch (e) {
    erro(`Não foi possível capturar a aba: ${e instanceof Error ? e.message : String(e)}`);
    return;
  }
  try {
    await chrome.offscreen.createDocument({
      url: chrome.runtime.getURL('offscreen.html'),
      reasons: ['AUDIO_PLAYBACK'],
      justification: 'Captura de áudio da aba para legendas ao vivo (STT local)',
    });
  } catch (e) {
    erro(`Não foi possível criar documento offscreen: ${e instanceof Error ? e.message : String(e)}`);
    return;
  }

  capturas.set(tabId, { tabId });
  void chrome.runtime.sendMessage({ type: 'offscreen.start', streamId, tabId });
  status('Conectando à API...');
}

async function pararCaptura(tabId: number): Promise<void> {
  capturas.delete(tabId);
  await chrome.offscreen.closeDocument().catch(() => {});
  status('Captura parada.');
}

chrome.runtime.onMessage.addListener((mensagem) => {
  void (async () => {
    try {
      if (captureStart.safeParse(mensagem).success) {
        const { tabId } = captureStart.parse(mensagem);
        await iniciarCaptura(tabId);
        return;
      }
      if (captureStop.safeParse(mensagem).success) {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const tabId = tabs[0]?.id;
        if (tabId === undefined) throw new Error('Nenhuma aba ativa');
        await pararCaptura(tabId);
        return;
      }
    } catch (e) {
      erro(e instanceof Error ? e.message : String(e));
    }
  })();
});
