import { afterEach, expect, it } from 'vitest';
import { Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import DOMPurify from 'dompurify';
import { closeHistory } from '@tiptap/pm/history';
import { ArticleFigure } from '../src/components/editor/ArticleFigure';

const editors: Editor[] = [];
function create(content = '<p>Before</p><p>After</p>') {
  const editor = new Editor({ extensions: [StarterKit, ArticleFigure], content });
  editors.push(editor);
  return editor;
}
afterEach(() => editors.splice(0).forEach(editor => editor.destroy()));

it('round trips a complete figure through sanitized HTML without losing placement or caption', () => {
  const editor = create();
  editor.commands.insertContentAt(8, { type: 'articleFigure', attrs: {
    src: 'https://images.example/news.jpg', alt: 'Reference image', caption: '<script>Caption</script>',
    credit: 'Photographer', placement: 'right', width: 40,
  } });
  const html = DOMPurify.sanitize(editor.getHTML());
  const reopened = create(html);
  const figure = reopened.getJSON().content?.find(node => node.type === 'articleFigure');
  expect(figure?.attrs).toMatchObject({ placement: 'right', width: 40, caption: '<script>Caption</script>', credit: 'Photographer', alt: 'Reference image', number: 1 });
  expect(html).toContain('<figcaption>');
  expect(html).not.toContain('<script>');
});

it('renumbers figures after deleting and undoing without losing their captions', () => {
  const editor = create();
  editor.commands.insertContentAt(0, [
    { type: 'articleFigure', attrs: { src: 'https://images.example/a.jpg', caption: 'First' } },
    { type: 'articleFigure', attrs: { src: 'https://images.example/b.jpg', caption: 'Second' } },
  ]);
  expect(editor.getJSON().content?.filter(n => n.type === 'articleFigure').map(n => n.attrs?.number)).toEqual([1, 2]);
  editor.view.dispatch(closeHistory(editor.state.tr));
  editor.commands.deleteRange({ from: 0, to: 1 });
  expect(editor.getJSON().content?.[0].attrs).toMatchObject({ caption: 'Second', number: 1 });
  editor.commands.undo();
  expect(editor.getJSON().content?.filter(n => n.type === 'articleFigure').map(n => n.attrs?.caption)).toEqual(['First', 'Second']);
});

it('normalizes invalid layout values and rejects unsafe image URLs', () => {
  const editor = create('<figure data-article-figure data-placement="evil" data-width="999"><img src="javascript:alert(1)"><figcaption>Caption</figcaption></figure>');
  expect(editor.getHTML()).not.toContain('javascript:');
  expect(editor.getJSON().content?.[0].attrs).toMatchObject({ placement: 'full', width: 100 });
});

it('makes newly pasted image HTML editable as a figure', () => {
  const editor = create('<p>Text</p><img src="https://images.example/imported.jpg" alt="Imported image"><p>More text</p>');
  expect(editor.getJSON().content?.find(n => n.type === 'articleFigure')?.attrs).toMatchObject({ src: 'https://images.example/imported.jpg', alt: 'Imported image' });
});
