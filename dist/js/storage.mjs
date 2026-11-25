const isLocalServer = ['127.0.0.1', 'localhost'].includes(location.hostname);
const endpoint = '/api/workspace';

async function databaseStore() {
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open('resume-matching', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('workspace');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return {
    label: 'Saved in this browser',
    async load() {
      return new Promise((resolve, reject) => {
        const request = db.transaction('workspace').objectStore('workspace').get('current');
        request.onsuccess = () => resolve(request.result ?? {revision: 0, data: null});
        request.onerror = () => reject(request.error);
      });
    },
    async save(data, revision) {
      return new Promise((resolve, reject) => {
        const operation = db.transaction('workspace', 'readwrite');
        const store = operation.objectStore('workspace');
        const request = store.get('current');
        request.onsuccess = () => {
          if ((request.result?.revision ?? 0) !== revision) {
            reject(new Error('This workspace changed in another tab. Reload to see the saved version.'));
            operation.abort();
            return;
          }
          store.put({revision: revision + 1, data}, 'current');
        };
        operation.oncomplete = () => resolve(revision + 1);
        operation.onerror = () => reject(operation.error);
        operation.onabort = () => reject(operation.error ?? new Error('The save was interrupted.'));
      });
    }
  };
}

export async function openWorkspace() {
  if (isLocalServer) {
    const response = await fetch(endpoint, {cache: 'no-store'});
    if (response.status !== 404) {
      if (!response.ok) throw new Error('The workspace server could not be reached.');
      const initial = await response.json();
      return {
        label: 'Saved to the local database',
        load: () => initial,
        async save(data, revision) {
          const saved = await fetch(endpoint, {
            method: 'PUT', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({revision, data})
          });
          if (saved.status === 409) throw new Error('This workspace changed in another tab. Reload to see the saved version.');
          if (!saved.ok) throw new Error('The database could not save the workspace.');
          return (await saved.json()).revision;
        }
      };
    }
  }
  return databaseStore();
}
