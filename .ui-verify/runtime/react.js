
let currentKey = "";
let hookIndex = 0;
const hooks = new Map();
export const StrictMode = ({ children }) => children;
export function __resetHooks() { hooks.clear(); currentKey = ""; hookIndex = 0; }
export function __withComponent(key, fn) {
  const previousKey = currentKey;
  const previousIndex = hookIndex;
  currentKey = key;
  hookIndex = 0;
  try { return fn(); } finally { currentKey = previousKey; hookIndex = previousIndex; }
}
function bucket() {
  if (!hooks.has(currentKey)) hooks.set(currentKey, []);
  return hooks.get(currentKey);
}
export function useState(initial) {
  const store = bucket();
  const index = hookIndex++;
  if (!(index in store)) store[index] = typeof initial === "function" ? initial() : initial;
  return [store[index], () => {}];
}
export function useMemo(factory) { hookIndex++; return factory(); }
export function useCallback(fn) { hookIndex++; return fn; }
export function useRef(initial) {
  const store = bucket();
  const index = hookIndex++;
  if (!(index in store)) store[index] = { current: initial };
  return store[index];
}
export function useEffect() { hookIndex++; }
export const Children = { toArray(value) { if (value == null) return []; return Array.isArray(value) ? value.flat(Infinity).filter((item) => item != null && item !== false) : [value]; } };
export function isValidElement(value) { return Boolean(value && typeof value === "object" && "type" in value && "props" in value); }
