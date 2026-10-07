// Dokumente zu Verträgen (PDF, Fotos …) in IndexedDB – localStorage wäre für Dateien zu klein.
// Für die Sicherung werden die Dateien als Base64 in die JSON-Datei geschrieben.

const DB_NAME = 'nebenkostencheck-files';
const STORE = 'files';
export const MAX_FILE_MB = 25;

let dbPromise = null;
function db() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const os = req.result.createObjectStore(STORE, { keyPath: 'id' });
        os.createIndex('contractId', 'contractId');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

async function tx(mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction(STORE, mode);
    const os = t.objectStore(STORE);
    let result;
    Promise.resolve(fn(os)).then((r) => { result = r; });
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('Speichern abgebrochen (Speicher voll?)'));
  });
}
const req2p = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

// Metadaten ohne Blob (für Listen)
const meta = ({ blob, ...m }) => m;

export const files = {
  async add(contractId, file) {
    if (file.size > MAX_FILE_MB * 1024 * 1024) throw new Error(`„${file.name}“ ist größer als ${MAX_FILE_MB} MB`);
    const rec = { id: newId(), contractId, name: file.name, type: file.type || 'application/octet-stream',
      size: file.size, addedAt: new Date().toISOString(), blob: file };
    await tx('readwrite', (os) => os.put(rec));
    navigator.storage?.persist?.().catch(() => {});
    return meta(rec);
  },
  async list(contractId) {
    const all = await tx('readonly', (os) => req2p(contractId ? os.index('contractId').getAll(contractId) : os.getAll()));
    return all.map(meta).sort((a, b) => b.addedAt.localeCompare(a.addedAt));
  },
  async get(id) { return tx('readonly', (os) => req2p(os.get(id))); },
  async remove(id) { return tx('readwrite', (os) => os.delete(id)); },
  async removeForContract(contractId) {
    const ids = (await this.list(contractId)).map((f) => f.id);
    return tx('readwrite', (os) => ids.forEach((id) => os.delete(id)));
  },
  async clear() { return tx('readwrite', (os) => os.clear()); },
  async stats() {
    const all = await this.list();
    return { count: all.length, bytes: all.reduce((a, f) => a + f.size, 0) };
  },

  // Sicherung: alle Dateien als Base64
  async exportAll() {
    const all = await tx('readonly', (os) => req2p(os.getAll()));
    return Promise.all(all.map(async (f) => ({ ...meta(f), data: await blobToBase64(f.blob) })));
  },
  async importAll(list = []) {
    await this.clear();
    const recs = list.filter((f) => f && f.id && f.data).map((f) => ({
      id: f.id, contractId: f.contractId, name: f.name, type: f.type, size: f.size, addedAt: f.addedAt,
      blob: base64ToBlob(f.data, f.type),
    }));
    await tx('readwrite', (os) => recs.forEach((r) => os.put(r)));
    return recs.length;
  },
};

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}
function base64ToBlob(b64, type) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: type || 'application/octet-stream' });
}

export const fmtSize = (b) => (b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1048576).toFixed(1).replace('.', ',')} MB`);
