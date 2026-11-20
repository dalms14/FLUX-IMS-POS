import axios from 'axios';
import { getSessionId } from './session';

const FRESH_FOR_MS = 30000;
let catalog = { sessionId: null, entries: new Map() };

function currentCatalog() {
    const sessionId = getSessionId();
    if (catalog.sessionId !== sessionId) {
        catalog = { sessionId, entries: new Map() };
    }
    // Only retain data for a valid login, and keep large images out of storage.
    return sessionId ? catalog : { entries: new Map() };
}

export function readProductCatalog(archived = false) {
    return readEntry(archived);
}

export function invalidateProductCatalog() {
    catalog = { sessionId: getSessionId(), entries: new Map() };
}

function readEntry(key) {
    return currentCatalog().entries.get(key)?.data ?? null;
}

function fetchEntry(key, load) {
    const { entries } = currentCatalog();
    let entry = entries.get(key);
    if (!entry) {
        entry = { data: null, updatedAt: 0, pending: null };
        entries.set(key, entry);
    }
    if (entry.pending) return entry.pending;
    if (entry.data !== null && Date.now() - entry.updatedAt < FRESH_FOR_MS) {
        return Promise.resolve(entry.data);
    }

    entry.pending = load()
        .then(data => {
            entry.data = data;
            entry.updatedAt = Date.now();
            return data;
        })
        .finally(() => { entry.pending = null; });
    return entry.pending;
}

export function fetchProductCatalog(archived = false) {
    return fetchEntry(archived, () => axios.get(`http://localhost:5000/api/products?includeImages=true${archived ? '&archived=true' : ''}`)
        .then(({ data }) => {
            if (!Array.isArray(data)) throw new Error('Invalid product catalog response');
            // Also support older backends that do not filter archived products.
            return data.filter(product => archived
                ? product.archived === true
                : product.archived !== true);
        }));
}

export const readPosProductCatalog = () => readEntry('pos');
export const fetchPosProductCatalog = load => fetchEntry('pos', load);
export const invalidatePosProductCatalog = () => currentCatalog().entries.delete('pos');

export function updatePosProductCatalog(previousProduct, product) {
    const entry = currentCatalog().entries.get('pos');
    // A late selection refresh must not overwrite a newer catalog or login.
    if (entry?.data?.includes(previousProduct)) {
        entry.data = entry.data.map(item => item === previousProduct ? product : item);
    }
}

export function readProductImage(id) {
    const product = readProductCatalog()?.find(item => item._id === id);
    return product ? product.image || '' : readEntry(`image:${id}`);
}

export function fetchProductImage(id) {
    const entry = currentCatalog().entries.get(false);
    const product = entry?.data?.find(item => item._id === id);
    if (product && Date.now() - entry.updatedAt < FRESH_FOR_MS) {
        return Promise.resolve(product.image || '');
    }
    return fetchEntry(`image:${id}`, () => axios.get(`http://localhost:5000/api/products/${id}`)
        .then(({ data }) => data.image || ''));
}
