import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(path, imports) {
  const context = { exports: {}, require: name => {
    if (!(name in imports)) throw Error(name);
    return imports[name];
  }, requestAnimationFrame: fn => fn() };
  vm.runInNewContext(ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, context);
  return context.exports;
}
const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
const search = load('app/components/products/location-search.ts', {});
const locations = [
  { id: '39c4760f-2089-4d29-b512-a8b7d6c0d259', code: 'HL07-01-A', zone_id: 'hl', location_purpose: 'PICK' },
  { id: '56232b20-46b6-4f80-b136-9cccbd551ef2', code: 'SB01', zone_id: 'sb', location_purpose: 'BUFFER' },
  { id: 'invalid', code: 'NO-ZONE', zone_id: null },
];
function nodes(node) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  return [node, ...nodes(node.props?.children)];
}
function harness() {
  let index = 0, value = '';
  const state = [];
  const component = load('app/components/products/LocationPicker.tsx', {
    'react/jsx-runtime': jsx, './location-search': search,
    react: { useId: () => 'test', useRef: () => ({ current: null }), useState(initial) {
      const i = index++;
      if (!(i in state)) state[i] = typeof initial === 'function' ? initial() : initial;
      return [state[i], next => state[i] = next];
    } },
  });
  function render() { index = 0; return nodes(component.LocationPicker({ locations, zones: [], value, onChange: next => value = next })); }
  return { render, value: () => value, input: () => render().find(n => n.type === 'input'),
    key(key) { let prevented = false; this.input().props.onKeyDown({ key, preventDefault() { prevented = true; } }); return prevented; },
    type(text) { this.input().props.onChange({ target: { value: text } }); } };
}
test('exact code and arrow selection return UUIDs, Enter is consumed including repeat', () => {
  const h = harness(); h.type(' hl07-01-a ');
  assert.equal(h.key('Enter'), true); assert.equal(h.value(), locations[0].id);
  assert.equal(h.key('Enter'), true); assert.equal(h.value(), locations[0].id);
  h.type('SB'); assert.equal(h.value(), ''); h.key('ArrowDown'); h.key('Enter');
  assert.equal(h.value(), locations[1].id);
});
test('partial, invalid, zone-less and zone-conflicting input cannot silently select', () => {
  const h = harness();
  for (const code of ['HL07', 'UNKNOWN', 'NO-ZONE']) { h.type(code); h.key('Enter'); assert.equal(h.value(), ''); }
  h.render().find(n => n.type === 'select').props.onChange({ target: { value: 'hl' } });
  h.type('SB01'); h.key('Enter'); assert.equal(h.value(), '');
});
test('Escape and blur close results without removing their reserved layout space', () => {
  const h = harness();
  const slot = () => h.render().find(n => 'data-location-results' in n.props);
  assert.equal(slot().props.className, 'mt-2 h-44');
  assert.equal(h.key('Escape'), true);
  assert.equal(h.input().props['aria-expanded'], false);
  assert.equal(slot().props.className, 'mt-2 h-44');
  h.input().props.onFocus();
  h.input().props.onBlur({ currentTarget: { parentElement: { contains: () => false } }, relatedTarget: {} });
  assert.equal(h.input().props['aria-expanded'], false);
  assert.equal(slot().props.className, 'mt-2 h-44');
});
test('modal only calls save explicitly and rejects missing eligible UUID', () => {
  const { default: Modal } = load('app/components/products/EditPlacementModal.tsx', {
    'react/jsx-runtime': jsx, './LocationPicker': { LocationPicker() {} },
  });
  let saves = 0;
  const render = newLocation => nodes(Modal({ editing: { sku: 'synthetic' }, locations, zones: [],
    newLocation, newQuantity: '0', saveSaving: false, onSave: () => saves++, onClose() {} }));
  for (const value of ['', 'unknown', 'invalid']) assert.equal(render(value).find(n => n.type === 'button' && n.props.children === 'Lagre').props.disabled, true);
  const valid = render(locations[0].id);
  assert.equal(valid.some(n => n.type === 'form'), false);
  assert.equal(saves, 0);
  const save = valid.find(n => n.type === 'button' && n.props.children === 'Lagre');
  assert.equal(save.props.disabled, false); save.props.onClick(); assert.equal(saves, 1);
});
