import { Node } from '@tiptap/react';
import { DOMSerializer, type DOMOutputSpec } from '@tiptap/pm/model';
import { Plugin } from '@tiptap/pm/state';

export function imageUrl(value: unknown): string {
  if (typeof value !== 'string') return '';
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
  } catch { return ''; }
}
const placement = (value: unknown) => value === 'left' || value === 'right' ? value : 'full';
export const figureWidth = (value: unknown) => Math.max(25, Math.min(100, Math.round(Number(value) || 100)));

export const ArticleFigure = Node.create({
  name: 'articleFigure', group: 'block', atom: true, draggable: true,
  addAttributes() {
    return {
      src: { default: '', parseHTML: el => imageUrl((el.matches('img') ? el : el.querySelector('img'))?.getAttribute('src')) },
      alt: { default: '', parseHTML: el => (el.matches('img') ? el : el.querySelector('img'))?.getAttribute('alt') || '' },
      caption: { default: '', parseHTML: el => el.querySelector('[data-caption]')?.textContent || '' },
      credit: { default: '', parseHTML: el => el.querySelector('[data-credit]')?.textContent || '' },
      placement: { default: 'full', parseHTML: el => placement(el.dataset.placement) },
      width: { default: 100, parseHTML: el => figureWidth(el.dataset.width) },
      number: { default: 1, parseHTML: el => Number(el.dataset.number) || 1 },
    };
  },
  parseHTML() {
    return [
      { tag: 'figure[data-article-figure]' },
      // Images in newly pasted/imported documents become editable figures too.
      { tag: 'img[src]', getAttrs: element => ({ src: imageUrl(element.getAttribute('src')), alt: element.getAttribute('alt') || '' }) },
    ];
  },
  renderHTML({ node }): DOMOutputSpec {
    const a = node.attrs;
    const width = figureWidth(a.width);
    return ['figure', {
      'data-article-figure': '', 'data-placement': placement(a.placement),
      'data-width': width, 'data-number': a.number,
      style: `--figure-width: ${width}%`,
    },
    ['img', { src: imageUrl(a.src), alt: a.alt, loading: 'lazy', decoding: 'async' }],
    ['figcaption', {}, ['span', { class: 'figure-number' }, `चित्र ${a.number} — `],
      ['span', { 'data-caption': '' }, String(a.caption)],
      ['span', { 'data-credit': '' }, String(a.credit)],
    ]];
  },
  addProseMirrorPlugins() {
    return [new Plugin({
      appendTransaction: (transactions, _oldState, state) => {
        if (!transactions.some(tr => tr.docChanged)) return null;
        const tr = state.tr;
        let number = 0;
        state.doc.descendants((node, pos) => {
          if (node.type.name !== 'articleFigure') return;
          number++;
          if (node.attrs.number !== number) tr.setNodeMarkup(pos, undefined, { ...node.attrs, number });
        });
        return tr.docChanged ? tr : null;
      },
    })];
  },
  addNodeView() {
    return ({ node: initialNode, editor, getPos }) => {
      let node = initialNode;
      const dom = document.createElement('figure');
      let resizing = false;
      let startX = 0;
      let startWidth = 100;
      let containerWidth = 1;
      let pendingWidth = 100;
      const render = () => {
        const serialized = DOMSerializer.fromSchema(editor.schema).serializeNode(node) as HTMLElement;
        dom.replaceChildren(...Array.from(serialized.childNodes));
        for (const attr of Array.from(serialized.attributes)) dom.setAttribute(attr.name, attr.value);
        dom.classList.add('editor-figure');
        dom.querySelector('img')?.setAttribute('draggable', 'false');
        const grip = document.createElement('span');
        grip.className = 'figure-drag-handle';
        grip.textContent = '⠿';
        grip.setAttribute('data-drag-handle', '');
        grip.title = 'चित्र और कैप्शन को साथ खींचें';
        dom.append(grip);
        const handle = document.createElement('button');
        handle.type = 'button';
        handle.className = 'figure-resize-handle';
        handle.setAttribute('aria-label', 'चित्र का आकार बदलें');
        handle.title = 'खींचकर आकार बदलें; कीबोर्ड के लिए चौड़ाई नियंत्रण का उपयोग करें';
        handle.addEventListener('pointerdown', event => {
          event.preventDefault(); event.stopPropagation();
          resizing = true; startX = event.clientX; startWidth = figureWidth(node.attrs.width);
          pendingWidth = startWidth;
          containerWidth = dom.parentElement?.clientWidth || 1;
          handle.setPointerCapture(event.pointerId);
        });
        handle.addEventListener('pointermove', event => {
          if (!resizing) return;
          const direction = node.attrs.placement === 'right' ? -1 : 1;
          pendingWidth = Math.min(node.attrs.placement === 'full' ? 100 : 65, figureWidth(startWidth + direction * (event.clientX - startX) / containerWidth * 100));
          dom.style.setProperty('--figure-width', `${pendingWidth}%`);
        });
        const finish = () => {
          if (!resizing) return;
          resizing = false;
          const pos = getPos();
          if (typeof pos === 'number' && !editor.isDestroyed) {
            editor.view.dispatch(editor.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, width: pendingWidth }));
          }
        };
        handle.addEventListener('pointerup', finish);
        handle.addEventListener('lostpointercapture', finish);
        handle.addEventListener('pointercancel', () => { resizing = false; dom.style.setProperty('--figure-width', `${node.attrs.width}%`); });
        dom.append(handle);
      };
      render();
      return {
        dom,
        update(updated) {
          if (updated.type !== node.type) return false;
          node = updated; render(); return true;
        },
        selectNode() { dom.classList.add('ProseMirror-selectednode'); },
        deselectNode() { dom.classList.remove('ProseMirror-selectednode'); },
        stopEvent: event => (event.target as HTMLElement).closest?.('.figure-resize-handle') !== null,
        ignoreMutation: () => true,
      };
    };
  },
});
