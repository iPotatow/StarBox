
import { jsx, Fragment } from "file:///Users/apple/Documents/ChatGPT/StarBox/.ui-verify/runtime/jsx-runtime.js";
const passthrough = ({ children }) => children ?? null;
const mergeClassNames = (...values) => values.filter(Boolean).join(" ");
export function mergeProps(...values) {
  const out = {};
  for (const value of values) {
    if (!value) continue;
    if (out.className && value.className) out.className = mergeClassNames(out.className, value.className);
    Object.assign(out, value);
  }
  return out;
}
export function useRender({ defaultTagName, props = {}, render }) {
  if (render && typeof render === "object") return { ...render, props: mergeProps(render.props || {}, props) };
  return jsx(defaultTagName, props);
}
const renderControl = ({ render, children, ...props } = {}) => typeof render === "function" ? render(props) : render && typeof render === "object" ? { ...render, props: mergeProps(render.props || {}, props) } : children ?? null;
const primitive = (tag) => function Primitive(props = {}) { return jsx(tag, props); };
const button = primitive("button");
const input = primitive("input");
const span = primitive("span");
const div = primitive("div");
const section = primitive("section");
const label = primitive("label");
const p = primitive("p");
const h2 = primitive("h2");
export const Button = button;
export const Input = input;
export const Field = { Root: div, Label: label, Description: p, Error: p, Item: div, Control: renderControl, Validity: passthrough };
export const Dialog = { Root: passthrough, Portal: passthrough, Backdrop: div, Viewport: div, Popup: section, Title: h2, Description: p, Close: button, Trigger: button };
export const Select = { Root: passthrough, Trigger: button, Value: span, Icon: span, Portal: passthrough, Positioner: div, Popup: div, List: div, Item: div, ItemIndicator: span, ItemText: span, Separator: div, Group: div, Label: label, GroupLabel: label };
export const Checkbox = { Root: button, Indicator: span };
export const Switch = { Root: button, Thumb: span };
export const Tooltip = { Provider: passthrough, Root: passthrough, Trigger: renderControl, Portal: passthrough, Positioner: div, Popup: div, Arrow: span };
export const Menu = { Root: passthrough, Portal: passthrough, Trigger: renderControl, Positioner: div, Popup: div, Item: div, Group: div, GroupLabel: div, Separator: div };
export const Tabs = { Root: div, List: div, Tab: button, Panel: div, Indicator: div };
const toastStore = [];
export const Toast = { createToastManager() { return { add(value) { toastStore.push({ id: String(toastStore.length + 1), ...value }); } }; }, useToastManager() { return { toasts: toastStore }; }, Provider: passthrough, Portal: passthrough, Viewport: div, Root: div, Content: div, Title: div, Description: div, Action: button };
export const Autocomplete = { Root: div, Input: input, List: div, Item: div, Empty: div, Group: div, Separator: div };
