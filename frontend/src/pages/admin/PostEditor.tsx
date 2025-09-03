import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  ArrowLeft, Save, Bold, Italic, Link2, 
  Heading2, Heading3, Quote, Image, Loader2, AlertCircle, 
  Eye, Edit3, Globe
} from 'lucide-react';
import { apiFetch } from '../../services/api';
import MarkdownRenderer from '../../components/MarkdownRenderer';

interface PostEditorProps {
  postId: string | null;
  onClose: () => void;
}

export default function PostEditor({ postId, onClose }: PostEditorProps) {
  const queryClient = useQueryClient();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Active form fields state
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [content, setContent] = useState('');
  const [featuredImage, setFeaturedImage] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [status, setStatus] = useState<'DRAFT' | 'PUBLISHED'>('DRAFT');
  const [featured, setFeatured] = useState(false);
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');

  // Editor modes: 'write' or 'preview'
  const [editorTab, setEditorTab] = useState<'write' | 'preview'>('write');

  // Fetch categories for selection dropdown
  const { data: categories } = useQuery({
    queryKey: ['admin-categories-select'],
    queryFn: async () => {
      const res = await apiFetch('/categories');
      return res.json();
    },
  });

  // Fetch tags for checkbox selectors
  const { data: tags } = useQuery({
    queryKey: ['admin-tags-select'],
    queryFn: async () => {
      const res = await apiFetch('/tags');
      return res.json();
    },
  });

  // Query details if editing an existing post
  const { isLoading: isFetchingPost } = useQuery({
    queryKey: ['admin-post-edit', postId],
    queryFn: async () => {
      const res = await apiFetch(`/posts/${postId}`);
      const data = await res.json();
      
      // Populate form fields
      setTitle(data.title || '');
      setSlug(data.slug || '');
      setExcerpt(data.excerpt || '');
      setContent(data.content || '');
      setFeaturedImage(data.featuredImage || '');
      setCategoryId(data.categoryId || '');
      setSelectedTagIds(data.tags?.map((pt: any) => pt.tagId) || []);
      setStatus(data.status || 'DRAFT');
      setFeatured(data.featured || false);
      setSeoTitle(data.seoTitle || '');
      setSeoDescription(data.seoDescription || '');
      
      return data;
    },
    enabled: !!postId,
  });

  // Mutate save handler
  const saveMutation = useMutation({
    mutationFn: async () => {
      const bodyPayload = {
        title,
        slug: slug.trim() !== '' ? slug : undefined,
        excerpt,
        content,
        featuredImage: featuredImage.trim() !== '' ? featuredImage : null,
        categoryId: categoryId !== '' ? categoryId : null,
        tagIds: selectedTagIds,
        status,
        featured,
        seoTitle: seoTitle.trim() !== '' ? seoTitle : null,
        seoDescription: seoDescription.trim() !== '' ? seoDescription : null,
      };

      const path = postId ? `/posts/${postId}` : '/posts';
      const method = postId ? 'PATCH' : 'POST';

      const res = await apiFetch(path, {
        method,
        body: JSON.stringify(bodyPayload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Saving post failed');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-posts'] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      if (postId) {
        queryClient.invalidateQueries({ queryKey: ['post', slug] });
        queryClient.invalidateQueries({ queryKey: ['admin-post-edit', postId] });
      }
      onClose();
    },
  });

  // Cursor-aware markdown helper inserter
  const insertMarkdown = (syntaxBefore: string, syntaxAfter = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;

    const selectedText = text.substring(start, end);
    const replacement = syntaxBefore + selectedText + syntaxAfter;

    setContent(
      text.substring(0, start) +
      replacement +
      text.substring(end)
    );

    // Return focus to textarea and select modified segment
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + syntaxBefore.length,
        start + syntaxBefore.length + selectedText.length
      );
    }, 0);
  };

  const handleTagToggle = (tagId: string) => {
    setSelectedTagIds(prev => 
      prev.includes(tagId) 
        ? prev.filter(id => id !== tagId) 
        : [...prev, tagId]
    );
  };

  const handleSaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !excerpt.trim() || !content.trim()) return;
    saveMutation.mutate();
  };

  if (postId && isFetchingPost) {
    return (
      <div className="flex flex-col justify-center items-center py-24 text-sautuk-dark">
        <Loader2 className="w-8 h-8 animate-spin text-sautuk-accent mb-3" />
        <p className="text-sm font-semibold">Fetching publication details...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSaveSubmit} className="space-y-8">
      {/* Editor top navigation bar */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-white border border-sautuk-dark/5 p-6 rounded-3xl shadow-sm">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="p-2.5 rounded-full hover:bg-slate-100 transition-colors cursor-pointer text-sautuk-dark"
            title="Go back to list"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="font-display font-black text-xl text-sautuk-dark">
              {postId ? 'Edit Editorial Column' : 'Compose New Column'}
            </h2>
            <p className="text-xs text-sautuk-muted mt-0.5">
              Draft analysis parameters and specify metadata for reading views
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-3 rounded-full text-xs font-bold text-sautuk-dark hover:bg-slate-100 transition-colors shrink-0"
          >
            Cancel
          </button>
          
          <button
            type="submit"
            disabled={saveMutation.isPending || !title.trim() || !excerpt.trim() || !content.trim()}
            className="flex items-center gap-1.5 bg-sautuk-dark dark:bg-sautuk-accent text-sautuk-bg hover:opacity-90 hover:scale-[1.03] active:scale-95 font-bold px-7 py-3 rounded-full text-xs transition-all shadow-md cursor-pointer shrink-0 disabled:opacity-50"
          >
            {saveMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save Publication
          </button>
        </div>
      </div>

      {saveMutation.isError && (
        <div className="bg-sautuk-cta/10 border border-sautuk-cta/20 text-sautuk-cta text-xs rounded-xl p-4 flex items-start gap-2.5 max-w-3xl">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-sm mb-1">Error saving publication</h4>
            <p>{saveMutation.error.message || 'Verify input constraints and try again.'}</p>
          </div>
        </div>
      )}

      {/* Main Form Fields */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Write columns: Main text details */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-sautuk-dark/5 p-6 lg:p-8 rounded-3xl shadow-sm space-y-5">
            {/* Title */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-sautuk-dark mb-1.5">Article Headline Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. The Geopolitical Shifts of Climate Capital in Sub-Saharan Africa"
                className="w-full bg-slate-50 border border-slate-200 text-sautuk-dark text-sm rounded-xl px-4 py-3 outline-none focus:border-sautuk-accent transition-colors font-semibold font-display text-lg"
              />
            </div>

            {/* Slug URL */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-sautuk-dark mb-1.5">Custom Indexing Slug (Optional)</label>
              <div className="flex rounded-xl overflow-hidden border border-slate-200 bg-slate-50 focus-within:border-sautuk-accent transition-colors">
                <span className="bg-slate-100 border-r border-slate-200 text-sautuk-muted px-4 py-3 text-xs font-mono font-bold flex items-center select-none">
                  sautuk.com/posts/
                </span>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ''))}
                  placeholder="auto-generated-from-title-if-empty"
                  className="w-full bg-transparent text-sautuk-dark text-sm px-4 py-3 outline-none font-mono"
                />
              </div>
              <p className="text-[10px] text-sautuk-muted mt-1 px-1 font-semibold">Only alphanumeric characters and hyphens/underscores allowed.</p>
            </div>

            {/* Excerpt Summary */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-sautuk-dark mb-1.5">Excerpt Summary / Teaser</label>
              <textarea
                required
                rows={3}
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                placeholder="A concise, paragraph summary that appears in publication feeds and lists..."
                className="w-full bg-slate-50 border border-slate-200 text-sautuk-dark text-sm rounded-xl px-4 py-3 outline-none focus:border-sautuk-accent transition-colors resize-none font-sans leading-relaxed"
              />
            </div>
          </div>

          {/* Interactive Markdown Editor Container */}
          <div className="bg-white border border-sautuk-dark/5 rounded-3xl shadow-sm overflow-hidden">
            {/* Editor header tab switcher */}
            <div className="bg-slate-50 border-b border-slate-100 px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="flex gap-2 text-xs font-bold uppercase tracking-wide">
                <button
                  type="button"
                  onClick={() => setEditorTab('write')}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg transition-colors cursor-pointer ${
                    editorTab === 'write'
                      ? 'bg-sautuk-dark text-white'
                      : 'text-sautuk-muted hover:text-sautuk-dark'
                  }`}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Write Column
                </button>
                <button
                  type="button"
                  onClick={() => setEditorTab('preview')}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg transition-colors cursor-pointer ${
                    editorTab === 'preview'
                      ? 'bg-sautuk-dark text-white'
                      : 'text-sautuk-muted hover:text-sautuk-dark'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  Live Editorial Preview
                </button>
              </div>

              {/* Formatting Toolbar - Only visible in Write mode */}
              {editorTab === 'write' && (
                <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1">
                  <button
                    type="button"
                    onClick={() => insertMarkdown('**', '**')}
                    className="p-2 text-sautuk-muted hover:text-sautuk-dark hover:bg-slate-50 rounded-md transition-colors"
                    title="Bold (**)"
                  >
                    <Bold className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => insertMarkdown('*', '*')}
                    className="p-2 text-sautuk-muted hover:text-sautuk-dark hover:bg-slate-50 rounded-md transition-colors"
                    title="Italic (*)"
                  >
                    <Italic className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => insertMarkdown('## ')}
                    className="p-2 text-sautuk-muted hover:text-sautuk-dark hover:bg-slate-50 rounded-md transition-colors font-bold font-mono text-xs"
                    title="H2"
                  >
                    <Heading2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => insertMarkdown('### ')}
                    className="p-2 text-sautuk-muted hover:text-sautuk-dark hover:bg-slate-50 rounded-md transition-colors font-bold font-mono text-xs"
                    title="H3"
                  >
                    <Heading3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => insertMarkdown('> ')}
                    className="p-2 text-sautuk-muted hover:text-sautuk-dark hover:bg-slate-50 rounded-md transition-colors"
                    title="Blockquote (>)"
                  >
                    <Quote className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-px h-4 bg-slate-200 mx-1"></span>
                  <button
                    type="button"
                    onClick={() => insertMarkdown('[Link Text](', ')')}
                    className="p-2 text-sautuk-muted hover:text-sautuk-dark hover:bg-slate-50 rounded-md transition-colors"
                    title="Hyperlink"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => insertMarkdown('![Image Alt Text](', ' "Image Caption")')}
                    className="p-2 text-sautuk-muted hover:text-sautuk-dark hover:bg-slate-50 rounded-md transition-colors"
                    title="Image attachment"
                  >
                    <Image className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Write Panel */}
            <div className={`p-6 ${editorTab === 'write' ? 'block' : 'hidden'}`}>
              <textarea
                ref={textareaRef}
                required
                rows={16}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Compose article body using markdown. Utilize pull quotes, sub-headings, and links to present comprehensive reporting..."
                className="w-full bg-slate-50 border border-slate-200 text-sautuk-dark text-sm rounded-xl px-4.5 py-4 outline-none focus:border-sautuk-accent transition-colors font-mono leading-relaxed resize-y min-h-[350px]"
              />
            </div>

            {/* Live Preview Panel */}
            <div className={`p-6 lg:p-8 max-h-[600px] overflow-y-auto ${editorTab === 'preview' ? 'block bg-[#FCFBF9]' : 'hidden'}`}>
              {content.trim() ? (
                <div className="border border-sautuk-dark/5 p-6 bg-white rounded-2xl shadow-inner font-serif">
                  <MarkdownRenderer content={content} />
                </div>
              ) : (
                <div className="text-center py-16 text-sautuk-muted">
                  <p className="font-semibold text-sm italic">Nothing to preview. Write some column content first.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Configurations: Sidebar metadata options */}
        <div className="space-y-6">
          {/* Metadata Card */}
          <div className="bg-white border border-sautuk-dark/5 p-6 rounded-3xl shadow-sm space-y-5">
            <h3 className="font-display font-black text-sm text-sautuk-dark border-b border-slate-100 pb-3 uppercase tracking-wider">
              Publication Settings
            </h3>

            {/* Status (DRAFT vs PUBLISHED) */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-sautuk-dark mb-1.5">Publication Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'DRAFT' | 'PUBLISHED')}
                className="w-full bg-slate-50 border border-slate-200 text-sautuk-dark text-sm rounded-xl px-4 py-3 outline-none focus:border-sautuk-accent transition-colors font-bold"
              >
                <option value="DRAFT">Draft Column</option>
                <option value="PUBLISHED">Published Live</option>
              </select>
            </div>

            {/* Featured PIN checkbox */}
            <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 p-4 rounded-2xl">
              <input
                type="checkbox"
                id="featured-checkbox"
                checked={featured}
                onChange={(e) => setFeatured(e.target.checked)}
                className="w-4.5 h-4.5 text-sautuk-accent accent-sautuk-accent border-slate-300 rounded focus:ring-sautuk-accent cursor-pointer"
              />
              <label htmlFor="featured-checkbox" className="font-bold text-xs text-sautuk-dark cursor-pointer select-none">
                Pin to Homepage Carousel
                <span className="block text-[10px] text-sautuk-muted font-normal mt-0.5">Show this article in the top slide carousel.</span>
              </label>
            </div>

            {/* Category selection */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-sautuk-dark mb-1.5">Category Topic</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-sautuk-dark text-sm rounded-xl px-4 py-3 outline-none focus:border-sautuk-accent transition-colors"
              >
                <option value="">-- Select Category --</option>
                {categories?.map((cat: any) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Featured Image Link */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-sautuk-dark mb-1.5">Featured Image URL</label>
              <input
                type="url"
                value={featuredImage}
                onChange={(e) => setFeaturedImage(e.target.value)}
                placeholder="https://images.unsplash.com/..."
                className="w-full bg-slate-50 border border-slate-200 text-sautuk-dark text-sm rounded-xl px-4 py-3 outline-none focus:border-sautuk-accent transition-colors font-mono text-xs"
              />
              {featuredImage.trim() && (
                <div className="mt-2.5 rounded-xl overflow-hidden border border-slate-200 aspect-[16/9] bg-slate-50">
                  <img
                    src={featuredImage}
                    alt="Preview"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://placehold.co/600x400/png?text=Invalid+Image+URL';
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Tags Manager Card */}
          <div className="bg-white border border-sautuk-dark/5 p-6 rounded-3xl shadow-sm space-y-4">
            <h3 className="font-display font-black text-sm text-sautuk-dark border-b border-slate-100 pb-3 uppercase tracking-wider">
              Article Tags
            </h3>

            {!tags || tags.length === 0 ? (
              <p className="text-xs text-sautuk-muted italic">No tags created yet. Add tags in the Taxonomy tab.</p>
            ) : (
              <div className="flex flex-wrap gap-2 max-h-52 overflow-y-auto p-1 border border-slate-100 rounded-xl">
                {tags.map((tag: any) => {
                  const isSelected = selectedTagIds.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => handleTagToggle(tag.id)}
                      className={`text-xs font-bold px-3 py-1.5 rounded-full border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-sautuk-dark text-white border-sautuk-dark'
                          : 'bg-white text-sautuk-muted border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* SEO Metadata Card */}
          <div className="bg-white border border-sautuk-dark/5 p-6 rounded-3xl shadow-sm space-y-4">
            <h3 className="font-display font-black text-sm text-sautuk-dark border-b border-slate-100 pb-3 uppercase tracking-wider flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-sautuk-cta" />
              SEO Custom Metadata
            </h3>
            
            {/* SEO Title */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-sautuk-dark mb-1.5">Custom SEO Title</label>
              <input
                type="text"
                value={seoTitle}
                onChange={(e) => setSeoTitle(e.target.value)}
                placeholder="Recommended: max 60 chars"
                maxLength={100}
                className="w-full bg-slate-50 border border-slate-200 text-sautuk-dark text-sm rounded-xl px-4 py-3 outline-none focus:border-sautuk-accent transition-colors"
              />
            </div>

            {/* SEO Description */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-sautuk-dark mb-1.5">Custom SEO Description</label>
              <textarea
                rows={4}
                value={seoDescription}
                onChange={(e) => setSeoDescription(e.target.value)}
                placeholder="Recommended: max 160 chars for search result fragments..."
                maxLength={200}
                className="w-full bg-slate-50 border border-slate-200 text-sautuk-dark text-sm rounded-xl px-4 py-3 outline-none focus:border-sautuk-accent transition-colors resize-none leading-relaxed text-xs"
              />
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
