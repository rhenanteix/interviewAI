import './options.css';
const form = document.querySelector<HTMLFormElement>('#form')!;
const apiUrl = document.querySelector<HTMLInputElement>('#apiUrl')!;
const sourceLang = document.querySelector<HTMLSelectElement>('#sourceLang')!;
const targetLang = document.querySelector<HTMLSelectElement>('#targetLang')!;
const msg = document.querySelector<HTMLElement>('#msg')!;

async function carregar() {
  const itens = await chrome.storage.local.get(['apiUrl', 'sourceLang', 'targetLang']);
  apiUrl.value = (itens.apiUrl ?? 'http://localhost:3001') as string;
  sourceLang.value = (itens.sourceLang ?? 'pt-BR') as string;
  targetLang.value = (itens.targetLang ?? 'en') as string;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  await chrome.storage.local.set({
    apiUrl: apiUrl.value,
    sourceLang: sourceLang.value as 'pt-BR' | 'en' | 'es',
    targetLang: targetLang.value as 'pt-BR' | 'en' | 'es',
  });
  msg.textContent = 'Salvo com sucesso.';
  setTimeout(() => (msg.textContent = ''), 3000);
});

carregar();
