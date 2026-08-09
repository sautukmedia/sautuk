import React, { useCallback, useState, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Superscript from '@tiptap/extension-superscript';
import Subscript from '@tiptap/extension-subscript';
import { 
  Bold, Italic, Strikethrough, Link as LinkIcon, 
  Image as ImageIcon, Heading2, Heading3, Quote, List,
  Undo, Redo, Unlink, Superscript as SuperscriptIcon, Subscript as SubscriptIcon,
  MoreHorizontal, FileText
} from 'lucide-react';
import { apiFetch } from '../services/api';
import { useToastStore } from '../store/useToastStore';

interface TiptapEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  onDocxUpload?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export default function TiptapEditor({ content, onChange, placeholder = 'यहाँ टाइप करें...', onDocxUpload }: TiptapEditorProps) {
  const { addToast } = useToastStore();
  const [isUploading, setIsUploading] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [, setSelectionUpdate] = useState(0);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3],
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
      Image.configure({
        inline: true,
        allowBase64: true,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-sautuk-accent underline decoration-sautuk-accent/30 underline-offset-4',
        },
      }),
      Superscript,
      Subscript,
    ],
    content,
    editorProps: {
      attributes: {
        class: 'prose prose-slate dark:prose-invert max-w-none focus:outline-none min-h-[400px] p-6 text-sautuk-dark',
      },
    },
    onTransaction: () => {
      // Force a re-render on transaction so toolbar button highlighting is instantaneous
      setSelectionUpdate(prev => prev + 1);
    }
  });

  // Ensure onChange uses the latest closure so Autosave Draft works perfectly
  useEffect(() => {
    if (!editor) return;
    const handleUpdate = () => {
      onChange(editor.getHTML());
    };
    editor.on('update', handleUpdate);
    return () => {
      editor.off('update', handleUpdate);
    };
  }, [editor, onChange]);

  const uploadImage = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      addToast('कृपया एक छवि (इमेज) फ़ाइल अपलोड करें।', 'error');
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await apiFetch('/media/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('Upload failed');

      const data = await res.json();
      
      if (editor) {
        editor.chain().focus().setImage({ src: data.url }).run();
      }
    } catch (err) {
      addToast('छवि अपलोड करने में विफल।', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleImageUploadClick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const target = e.target as HTMLInputElement;
      if (target.files && target.files[0]) {
        uploadImage(target.files[0]);
      }
    };
    input.click();
  };

  const toggleBlockNode = (
    action: (chain: any) => any,
    isActive: boolean
  ) => {
    if (!editor) return;
    
    if (editor.state.selection.empty) {
      const { $from } = editor.state.selection;
      // If there is text on the current line, and the formatting is not already active,
      // split it to a new block so the previously typed text remains unaffected.
      if ($from.parent.textContent.length > 0 && !isActive) {
        action(editor.chain().focus().splitBlock()).run();
        return;
      }
    }
    action(editor.chain().focus()).run();
  };

  // Custom Link State
  const [linkMenuOpen, setLinkMenuOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  const [isTextSelected, setIsTextSelected] = useState(false);

  const toggleLink = useCallback(() => {
    if (!editor) return;

    if (editor.isActive('link')) {
      editor.chain().focus().unsetLink().run();
      return;
    }

    const previousUrl = editor.getAttributes('link').href;
    const { empty } = editor.state.selection;
    
    setLinkUrl(previousUrl || '');
    setLinkText('');
    setIsTextSelected(!empty);
    setLinkMenuOpen(true);
  }, [editor]);

  const applyLink = () => {
    if (!editor) return;
    
    const validUrl = /^https?:\/\//.test(linkUrl) ? linkUrl : `https://${linkUrl}`;

    if (!isTextSelected && linkText.trim()) {
      editor.chain().focus().insertContent(`<a href="${validUrl}">${linkText}</a> `).run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: validUrl }).run();
    }
    
    setLinkMenuOpen(false);
    setLinkUrl('');
    setLinkText('');
  };

  if (!editor) {
    return null;
  }

  const ToolbarButton = ({ 
    onClick, 
    isActive = false, 
    disabled = false, 
    children, 
    title 
  }: { 
    onClick: () => void, 
    isActive?: boolean, 
    disabled?: boolean, 
    children: React.ReactNode, 
    title: string 
  }) => (
    <button
      type="button"
      title={title}
      onClick={(e) => { e.preventDefault(); onClick(); }}
      disabled={disabled}
      className={`p-2 rounded-lg transition-colors flex items-center justify-center
        ${isActive 
          ? 'bg-sautuk-accent/10 text-sautuk-accent dark:bg-white/10 dark:text-white' 
          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-sautuk-dark dark:hover:text-white'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      {children}
    </button>
  );

  return (
    <div className="flex flex-col w-full h-full relative">
      {/* Static Toolbar */}
      <div className="sticky top-0 z-20 flex flex-wrap items-center gap-1 p-2 bg-slate-50 dark:bg-sautuk-bg/95 backdrop-blur-sm border-b border-slate-200 dark:border-sautuk-dark/15 rounded-t-3xl">
        <div className="flex items-center gap-1 pr-2 border-r border-slate-200 dark:border-sautuk-dark/15">
          <ToolbarButton
            title="Bold"
            onClick={() => editor.chain().focus().toggleBold().run()}
            isActive={editor.isActive('bold')}
          >
            <Bold className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            title="Italic"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            isActive={editor.isActive('italic')}
          >
            <Italic className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            title="Strikethrough"
            onClick={() => editor.chain().focus().toggleStrike().run()}
            isActive={editor.isActive('strike')}
          >
            <Strikethrough className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            title="Superscript"
            onClick={() => editor.chain().focus().toggleSuperscript().run()}
            isActive={editor.isActive('superscript')}
          >
            <SuperscriptIcon className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            title="Subscript"
            onClick={() => editor.chain().focus().toggleSubscript().run()}
            isActive={editor.isActive('subscript')}
          >
            <SubscriptIcon className="w-4 h-4" />
          </ToolbarButton>
        </div>

        <div className="flex items-center gap-1 px-2 border-r border-slate-200 dark:border-sautuk-dark/15">
          <ToolbarButton
            title="Heading 2"
            onClick={() => toggleBlockNode((chain) => chain.toggleHeading({ level: 2 }), editor.isActive('heading', { level: 2 }))}
            isActive={editor.isActive('heading', { level: 2 })}
          >
            <Heading2 className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            title="Heading 3"
            onClick={() => toggleBlockNode((chain) => chain.toggleHeading({ level: 3 }), editor.isActive('heading', { level: 3 }))}
            isActive={editor.isActive('heading', { level: 3 })}
          >
            <Heading3 className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            title="Quote"
            onClick={() => toggleBlockNode((chain) => chain.toggleBlockquote(), editor.isActive('blockquote'))}
            isActive={editor.isActive('blockquote')}
          >
            <Quote className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            title="Bullet List"
            onClick={() => toggleBlockNode((chain) => chain.toggleBulletList(), editor.isActive('bulletList'))}
            isActive={editor.isActive('bulletList')}
          >
            <List className="w-4 h-4" />
          </ToolbarButton>
        </div>

        <div className="flex items-center gap-1 px-2 border-r border-slate-200 dark:border-sautuk-dark/15">
          <ToolbarButton
            title="Link"
            onClick={toggleLink}
            isActive={editor.isActive('link')}
          >
            <LinkIcon className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            title="Insert Image"
            onClick={handleImageUploadClick}
          >
            <ImageIcon className="w-4 h-4" />
          </ToolbarButton>
          
          {onDocxUpload && (
            <div className="relative">
              <ToolbarButton
                title="More Options"
                onClick={() => setShowMoreMenu(!showMoreMenu)}
                isActive={showMoreMenu}
              >
                <MoreHorizontal className="w-4 h-4" />
              </ToolbarButton>

              {showMoreMenu && (
                <div className="absolute top-full left-0 mt-2 w-56 bg-white dark:bg-sautuk-card border border-slate-200 dark:border-sautuk-dark/15 shadow-xl rounded-xl p-1.5 z-50 animate-in fade-in slide-in-from-top-2">
                  <input
                    type="file"
                    id="docx-upload-toolbar"
                    accept=".docx"
                    className="hidden"
                    onChange={(e) => {
                      onDocxUpload(e);
                      setShowMoreMenu(false);
                    }}
                  />
                  <label
                    htmlFor="docx-upload-toolbar"
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-sautuk-dark hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg cursor-pointer transition-colors font-bold"
                  >
                    <FileText className="w-4 h-4" />
                    Word (.docx) Upload
                  </label>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 pl-2 ml-auto">
          <ToolbarButton
            title="Undo"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
          >
            <Undo className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            title="Redo"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
          >
            <Redo className="w-4 h-4" />
          </ToolbarButton>
        </div>
      </div>

      {isUploading && (
        <div className="absolute top-16 left-0 right-0 z-10 flex justify-center">
          <div className="bg-sautuk-accent text-white text-xs px-4 py-2 rounded-full font-bold shadow-md animate-pulse">
            छवि अपलोड हो रही है...
          </div>
        </div>
      )}

      {/* Custom Link Popover */}
      {linkMenuOpen && (
        <div className="absolute z-30 left-1/2 top-16 -translate-x-1/2 bg-white dark:bg-sautuk-card border border-slate-200 dark:border-sautuk-dark/15 shadow-xl rounded-xl p-4 w-72 flex flex-col gap-3">
          <div className="font-bold text-sm text-sautuk-dark">Create a link</div>
          
          {!isTextSelected && (
            <input 
              type="text" 
              placeholder="Enter text..." 
              value={linkText}
              onChange={(e) => setLinkText(e.target.value)}
              className="w-full bg-slate-50 dark:bg-sautuk-bg/20 border border-slate-200 dark:border-sautuk-dark/15 focus:border-sautuk-accent rounded-xl px-4 py-2.5 text-sm outline-none text-sautuk-dark transition-colors"
              autoFocus
            />
          )}
          
          <input 
            type="text" 
            placeholder="Enter URL..." 
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            className="w-full bg-slate-50 dark:bg-sautuk-bg/20 border border-slate-200 dark:border-sautuk-dark/15 focus:border-sautuk-accent rounded-xl px-4 py-2.5 text-sm outline-none text-sautuk-dark transition-colors"
            autoFocus={isTextSelected}
            onKeyDown={(e) => {
              if (e.key === 'Enter') applyLink();
            }}
          />
          
          <div className="flex items-center gap-3 mt-1">
            <button 
              onClick={applyLink}
              className="bg-sautuk-dark dark:bg-sautuk-accent text-sautuk-bg font-bold text-sm px-6 py-2 rounded-xl hover:opacity-90 hover:scale-[1.02] active:scale-95 transition-all shadow-sm"
            >
              Link
            </button>
            <button 
              onClick={() => {
                setLinkMenuOpen(false);
                editor.chain().focus().run();
              }}
              className="bg-slate-100 dark:bg-white/10 text-sautuk-dark dark:text-white font-bold text-sm px-6 py-2 rounded-xl hover:bg-slate-200 dark:hover:bg-white/20 transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Bubble Menu for highlighted text */}
      <BubbleMenu editor={editor} className="flex overflow-hidden rounded-xl bg-slate-900 shadow-xl border border-white/10 p-1">
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-2 text-sm transition-colors rounded-lg ${editor.isActive('bold') ? 'text-white bg-white/20' : 'text-slate-300 hover:text-white hover:bg-white/10'}`}
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-2 text-sm transition-colors rounded-lg ${editor.isActive('italic') ? 'text-white bg-white/20' : 'text-slate-300 hover:text-white hover:bg-white/10'}`}
        >
          <Italic className="w-4 h-4" />
        </button>
        <button
          onClick={toggleLink}
          className={`p-2 text-sm transition-colors rounded-lg ${editor.isActive('link') ? 'text-blue-400 bg-white/20' : 'text-slate-300 hover:text-white hover:bg-white/10'}`}
        >
          {editor.isActive('link') ? <Unlink className="w-4 h-4" /> : <LinkIcon className="w-4 h-4" />}
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`p-2 text-sm font-bold transition-colors rounded-lg ${editor.isActive('heading', { level: 2 }) ? 'text-white bg-white/20' : 'text-slate-300 hover:text-white hover:bg-white/10'}`}
        >
          H2
        </button>
        <button
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`p-2 text-sm transition-colors rounded-lg ${editor.isActive('blockquote') ? 'text-white bg-white/20' : 'text-slate-300 hover:text-white hover:bg-white/10'}`}
        >
          <Quote className="w-4 h-4" />
        </button>
      </BubbleMenu>

      {/* Editor Content Area */}
      <div 
        className="flex-grow overflow-y-auto cursor-text bg-white dark:bg-sautuk-card"
        onClick={() => {
          if (!editor.isFocused) {
            editor.commands.focus();
          }
        }}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
