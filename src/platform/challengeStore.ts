// Meydan okuma linkini kısaltmak için hayalet kaydı Firestore'da kısa bir kodla saklanır (REST, SDK yok).
// Kural: herkes yeni kayıt ekleyebilir, kodu bilen tek kaydı okuyabilir; listeleme, değiştirme ve silme kapalı.
// Yazılamazsa (internet yok, kural yok) null döner ve oyun uzun linke geri döner.

import { ANALYTICS } from '../config/analytics';
import { randomId } from './analytics';

const COLLECTION = 'ch';
const TIMEOUT_MS = 5000;

function root(): string {
  return `https://firestore.googleapis.com/v1/projects/${ANALYTICS.projectId}/databases/(default)/documents`;
}

async function withTimeout(url: string, init: RequestInit): Promise<Response> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctl.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Kaydı saklar, kısa kodu döndürür */
export async function saveChallenge(payload: string): Promise<string | null> {
  if (!ANALYTICS.projectId) return null;
  const id = randomId(8);
  const name = `projects/${ANALYTICS.projectId}/databases/(default)/documents/${COLLECTION}/${id}`;
  try {
    const r = await withTimeout(`${root()}:commit?key=${ANALYTICS.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        writes: [
          {
            update: { name, fields: { p: { stringValue: payload } } },
            updateTransforms: [{ fieldPath: 'at', setToServerValue: 'REQUEST_TIME' }],
            currentDocument: { exists: false },
          },
        ],
      }),
    });
    return r.ok ? id : null;
  } catch {
    return null;
  }
}

/** Kısa koddan kaydı okur */
export async function loadChallenge(id: string): Promise<string | null> {
  if (!ANALYTICS.projectId || !/^[a-z0-9]{6,12}$/.test(id)) return null;
  try {
    const r = await withTimeout(`${root()}/${COLLECTION}/${id}?key=${ANALYTICS.apiKey}`, { method: 'GET' });
    if (!r.ok) return null;
    const doc = (await r.json()) as { fields?: { p?: { stringValue?: string } } };
    return doc.fields?.p?.stringValue ?? null;
  } catch {
    return null;
  }
}
