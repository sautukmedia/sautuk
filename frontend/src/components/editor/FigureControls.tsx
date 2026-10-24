import type { Editor } from '@tiptap/react';
import { NodeSelection } from '@tiptap/pm/state';
import { figureWidth } from './ArticleFigure';

export default function FigureControls({ editor }: { editor: Editor }) {
  const selection = editor.state.selection;
  if (!(selection instanceof NodeSelection) || selection.node.type.name !== 'articleFigure') return null;
  const { attrs } = selection.node;
  const maxWidth = attrs.placement === 'full' ? 100 : 65;
  const update = (attributes: Record<string, unknown>) => editor.chain().updateAttributes('articleFigure', attributes).run();
  const move = (direction: -1 | 1) => {
    const { $from, from, to, node } = selection;
    const sibling = direction === -1 ? $from.nodeBefore : editor.state.doc.resolve(to).nodeAfter;
    if (!sibling) return;
    const target = direction === -1 ? from - sibling.nodeSize : to + sibling.nodeSize;
    const tr = editor.state.tr.delete(from, to);
    const mapped = tr.mapping.map(target);
    tr.insert(mapped, node).setSelection(NodeSelection.create(tr.doc, mapped));
    editor.view.dispatch(tr);
    editor.view.focus();
  };
  return <section className="figure-controls" aria-label="चित्र की सेटिंग्स" onMouseDown={e => e.stopPropagation()}>
    <div className="figure-controls-heading"><strong>चित्र {attrs.number}</strong><span>चित्र चुनें, फिर उसकी जगह और कैप्शन तय करें।</span></div>
    <div className="figure-controls-row">
      <label>टेक्स्ट का बहाव<select aria-label="चित्र की स्थिति" value={attrs.placement} onChange={e => update({ placement: e.target.value, width: e.target.value === 'full' ? 100 : 40 })}>
        <option value="full">पूरी पंक्ति / Full width</option><option value="left">बाईं ओर / Wrap left</option><option value="right">दाईं ओर / Wrap right</option>
      </select></label>
      <label>चौड़ाई<select aria-label="चित्र की चौड़ाई" value={attrs.width} onChange={e => update({ width: Number(e.target.value) })}>
        {Array.from(new Set([25, 40, 50, 65, 75, 100, figureWidth(attrs.width)])).filter(width => width <= maxWidth).sort((a, b) => a - b).map(width => <option key={width} value={width}>{width}%</option>)}
      </select></label>
      <label className="figure-width-slider">आकार<input type="range" aria-label="चित्र का आकार" min={25} max={maxWidth} value={attrs.width} onChange={e => update({ width: Number(e.target.value) })} /></label>
    </div>
    <div className="figure-controls-fields">
      <label>कैप्शन<input aria-label="चित्र का कैप्शन" value={attrs.caption} maxLength={1000} onChange={e => update({ caption: e.target.value })} placeholder="चित्र में क्या दिख रहा है?" /></label>
      <label>चित्र का श्रेय<input aria-label="चित्र का श्रेय" value={attrs.credit} maxLength={500} onChange={e => update({ credit: e.target.value })} placeholder="फ़ोटो: नाम / स्रोत" /></label>
      <label>वैकल्पिक विवरण (Alt text)<input aria-label="चित्र का वैकल्पिक विवरण" value={attrs.alt} maxLength={1000} onChange={e => update({ alt: e.target.value })} placeholder="स्क्रीन रीडर के लिए चित्र का विवरण" /></label>
    </div>
    <div className="figure-controls-actions">
      <button type="button" onClick={() => move(-1)} disabled={selection.from === 0}>ऊपर ले जाएँ</button>
      <button type="button" onClick={() => move(1)} disabled={selection.to === editor.state.doc.content.size}>नीचे ले जाएँ</button>
      <button type="button" onClick={() => editor.chain().focus().deleteSelection().run()}>लेख से हटाएँ</button>
    </div>
    <p>चित्र के कोने को खींचकर आकार बदलें। छोटे स्क्रीन पर चित्र और टेक्स्ट अलग पंक्तियों में दिखेंगे।</p>
  </section>;
}
