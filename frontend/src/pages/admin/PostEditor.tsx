import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Save, Bold, Italic, Link2,
  Heading2, Heading3, Quote, Image, Loader2, AlertCircle,
  Eye, Edit3, Globe
} from 'lucide-react';
import { apiFetch } from '../../services/api';
import MarkdownRenderer from '../../components/MarkdownRenderer';
import { useToastStore } from '../../store/useToastStore';
import Dropdown from '../../components/Dropdown';

interface PostEditorProps {
  postId: string | null;
  onClose: () => void;
}

export default function PostEditor({ postId, onClose }: PostEditorProps) {
  const queryClient = useQueryClient();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { addToast } = useToastStore();

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

  // Fetch currently pinned published posts to validate carousel limits
  const { data: featuredPosts } = useQuery({
    queryKey: ['admin-featured-posts-count'],
    queryFn: async () => {
      const res = await apiFetch('/posts?featured=true&status=PUBLISHED');
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Query details if editing an existing post
  const [activePostId, setActivePostId] = useState<string | null>(postId);
  const [originalStatus, setOriginalStatus] = useState<'DRAFT' | 'PUBLISHED' | null>(null);
  const [isAutosaved, setIsAutosaved] = useState(false);

  // Keep track of the initially loaded or first-saved values to detect dirty state
  const initialDataRef = useRef<any>(null);

  // Flag to block background autosaves when the form is explicitly submitted
  const isSavingRef = useRef(false);

  // Cover image and content drag-and-drop upload states
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [dragActiveCover, setDragActiveCover] = useState(false);
  const [isTextareaDragActive, setIsTextareaDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadCoverFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      addToast('कृपया एक छवि (इमेज) फ़ाइल अपलोड करें।', 'error');
      return;
    }

    setIsUploadingCover(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await apiFetch('/media/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        throw new Error('Upload failed');
      }

      const data = await res.json();
      setFeaturedImage(data.url);
    } catch (err) {
      console.error(err);
      addToast('छवि अपलोड करने में विफल। कृपया पुनः प्रयास करें।', 'error');
    } finally {
      setIsUploadingCover(false);
    }
  };

  const handleDragCover = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActiveCover(true);
    } else if (e.type === "dragleave") {
      setDragActiveCover(false);
    }
  };

  const handleDropCover = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActiveCover(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await handleUploadCoverFile(e.dataTransfer.files[0]);
    }
  };

  const handleTextareaDragOver = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) {
      setIsTextareaDragActive(true);
    }
  };

  const handleTextareaDragLeave = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsTextareaDragActive(false);
  };

  const handleTextareaDrop = async (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsTextareaDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      const file = files[0];
      if (!file.type.startsWith('image/')) {
        addToast('कृपया एक छवि (इमेज) फ़ाइल ही ड्रॉप करें।', 'error');
        return;
      }

      const textarea = textareaRef.current;
      if (!textarea) return;

      const startPos = textarea.selectionStart;
      const endPos = textarea.selectionEnd;
      const originalValue = textarea.value;

      const placeholder = `![अपलोड हो रहा है ${file.name}...]()`;
      const newValue =
        originalValue.substring(0, startPos) +
        placeholder +
        originalValue.substring(endPos);

      setContent(newValue);

      try {
        const formData = new FormData();
        formData.append('file', file);

        const res = await apiFetch('/media/upload', {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) {
          throw new Error('Upload failed');
        }

        const data = await res.json();

        setContent((prevContent) => {
          const formattedImage = `![${file.name}](${data.url} "${file.name}")`;
          return prevContent.replace(placeholder, formattedImage);
        });
      } catch (err) {
        console.error(err);
        addToast('ड्रॉप की गई छवि को अपलोड करने में विफल।', 'error');
        setContent((prevContent) => prevContent.replace(placeholder, ''));
      }
    }
  };

  // Sync activePostId with postId prop
  useEffect(() => {
    setActivePostId(postId);
  }, [postId]);

  useEffect(() => {
    if (!postId) {
      initialDataRef.current = {
        title: '',
        slug: '',
        excerpt: '',
        content: '',
        featuredImage: '',
        categoryId: '',
        selectedTagIds: [],
        status: 'DRAFT',
        featured: false,
        seoTitle: '',
        seoDescription: '',
      };
      setOriginalStatus('DRAFT');
    }
  }, [postId]);

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
      setOriginalStatus(data.status || 'DRAFT');
      setFeatured(data.featured || false);
      setSeoTitle(data.seoTitle || '');
      setSeoDescription(data.seoDescription || '');

      initialDataRef.current = {
        title: data.title || '',
        slug: data.slug || '',
        excerpt: data.excerpt || '',
        content: data.content || '',
        featuredImage: data.featuredImage || '',
        categoryId: data.categoryId || '',
        selectedTagIds: data.tags?.map((pt: any) => pt.tagId) || [],
        status: data.status || 'DRAFT',
        featured: data.featured || false,
        seoTitle: data.seoTitle || '',
        seoDescription: data.seoDescription || '',
      };

      return data;
    },
    enabled: !!postId,
  });

  // Autosave mutation
  const autosaveMutation = useMutation({
    mutationFn: async () => {
      if (isSavingRef.current) {
        throw new Error('Skipping autosave: manual save/publish in progress');
      }
      const autosaveStatus = (activePostId && originalStatus === 'PUBLISHED') ? 'PUBLISHED' : 'DRAFT';
      const bodyPayload = {
        title: title.trim() !== '' ? title : 'Untitled Draft',
        slug: slug.trim() !== '' ? slug : undefined,
        excerpt,
        content,
        featuredImage: featuredImage.trim() !== '' ? featuredImage : null,
        categoryId: categoryId !== '' ? categoryId : null,
        tagIds: selectedTagIds,
        status: autosaveStatus,
        featured,
        seoTitle: seoTitle.trim() !== '' ? seoTitle : null,
        seoDescription: seoDescription.trim() !== '' ? seoDescription : null,
      };

      const path = activePostId ? `/posts/${activePostId}` : '/posts';
      const method = activePostId ? 'PATCH' : 'POST';

      const res = await apiFetch(path, {
        method,
        body: JSON.stringify(bodyPayload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Autosave failed');
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-posts'] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });

      if (!activePostId && data.id) {
        setActivePostId(data.id);
        setOriginalStatus('DRAFT');
      }

      setIsAutosaved(true);
      const timer = setTimeout(() => setIsAutosaved(false), 2000);
      return () => clearTimeout(timer);
    },
  });

  // Dirty state checker helper
  const checkIsDirty = () => {
    if (!initialDataRef.current) return false;
    const init = initialDataRef.current;

    const tagsChanged =
      selectedTagIds.length !== init.selectedTagIds.length ||
      !selectedTagIds.every((id) => init.selectedTagIds.includes(id));

    return (
      title !== init.title ||
      slug !== init.slug ||
      excerpt !== init.excerpt ||
      content !== init.content ||
      featuredImage !== init.featuredImage ||
      categoryId !== init.categoryId ||
      status !== init.status ||
      featured !== init.featured ||
      seoTitle !== init.seoTitle ||
      seoDescription !== init.seoDescription ||
      tagsChanged
    );
  };

  // Debounced autosave effect
  useEffect(() => {
    if (activePostId && isFetchingPost) return;
    if (!checkIsDirty()) return;

    const hasContent = title.trim() || excerpt.trim() || content.trim();
    if (!hasContent) return;

    const timer = setTimeout(() => {
      autosaveMutation.mutate();
      initialDataRef.current = {
        title,
        slug,
        excerpt,
        content,
        featuredImage,
        categoryId,
        selectedTagIds,
        status,
        featured,
        seoTitle,
        seoDescription,
      };
    }, 3000);

    return () => clearTimeout(timer);
  }, [
    title, slug, excerpt, content, featuredImage, categoryId,
    selectedTagIds, status, featured, seoTitle, seoDescription,
    activePostId, isFetchingPost
  ]);

  // Mutate save handler
  const saveMutation = useMutation({
    mutationFn: async () => {
      const bodyPayload = {
        title: title.trim() !== '' ? title : 'Untitled Draft',
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

      const path = activePostId ? `/posts/${activePostId}` : '/posts';
      const method = activePostId ? 'PATCH' : 'POST';

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
      if (activePostId) {
        queryClient.invalidateQueries({ queryKey: ['post', slug] });
        queryClient.invalidateQueries({ queryKey: ['admin-post-edit', activePostId] });
      }
      onClose();
    },
    onError: () => {
      isSavingRef.current = false;
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
    if (status === 'PUBLISHED') {
      if (!title.trim() || title === 'Untitled Draft') {
        addToast('लेख को लाइव प्रकाशित करने के लिए एक शीर्षक (Title) आवश्यक है।', 'error');
        return;
      }
      if (!categoryId) {
        addToast('लेख को लाइव प्रकाशित करने के लिए एक श्रेणी (Category) चुनना आवश्यक है।', 'error');
        return;
      }
      if (!featuredImage.trim()) {
        addToast('लेख को लाइव प्रकाशित करने के लिए एक कवर चित्र (Cover Image) आवश्यक है।', 'error');
        return;
      }
      if (!content.trim()) {
        addToast('लेख को लाइव प्रकाशित करने के लिए सामग्री (Content) आवश्यक है।', 'error');
        return;
      }

      const confirmed = confirm("क्या आप वाकई इस लेख को लाइव प्रकाशित करना चाहते हैं? यह तुरंत सभी पाठकों को दिखाई देने लगेगा।");
      if (!confirmed) return;
    }
    
    isSavingRef.current = true;
    saveMutation.mutate();
  };

  if (activePostId && isFetchingPost) {
    return (
      <div className="flex flex-col justify-center items-center py-24 text-sautuk-dark">
        <Loader2 className="w-8 h-8 animate-spin text-sautuk-accent mb-3" />
        <p className="text-sm font-semibold">लेख का विवरण लोड हो रहा है...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSaveSubmit} className="space-y-8">
      {/* Editor top navigation bar */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-white dark:bg-sautuk-card border border-sautuk-dark/5 p-6 rounded-3xl shadow-sm">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="p-2.5 rounded-full hover:bg-slate-100 dark:hover:bg-sautuk-bg/20 transition-colors cursor-pointer text-sautuk-dark"
            title="सूची पर वापस जाएं"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="font-display font-black text-xl text-sautuk-dark">
              {postId ? 'लेख संपादित करें' : 'नया लेख लिखें'}
            </h2>
            <p className="text-xs text-sautuk-muted mt-0.5">
              लेख का मसौदा तैयार करें और पाठकों के लिए मेटाडेटा निर्दिष्ट करें
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isAutosaved && (
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/20 px-2.5 py-1.5 rounded-full border border-emerald-100 dark:border-emerald-900/30 shrink-0 flex items-center gap-1.5 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              मसौदा स्वतः सहेजा गया
            </span>
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-3 rounded-full text-xs font-bold text-sautuk-dark hover:bg-slate-100 dark:hover:bg-sautuk-bg/20 transition-colors shrink-0"
          >
            रद्द करें
          </button>

          <button
            type="submit"
            disabled={saveMutation.isPending}
            className="flex items-center gap-1.5 bg-sautuk-dark dark:bg-sautuk-accent text-sautuk-bg hover:opacity-90 hover:scale-[1.03] active:scale-95 font-bold px-7 py-3 rounded-full text-xs transition-all shadow-md cursor-pointer shrink-0 disabled:opacity-50"
          >
            {saveMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            प्रकाशित करें
          </button>
        </div>
      </div>

      {saveMutation.isError && (
        <div className="bg-sautuk-cta/10 border border-sautuk-cta/20 text-sautuk-cta text-xs rounded-xl p-4 flex items-start gap-2.5 max-w-3xl">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-sm mb-1">लेख सहेजने में त्रुटि</h4>
            <p>{saveMutation.error.message || 'इनपुट की जांच करें और पुनः प्रयास करें।'}</p>
          </div>
        </div>
      )}

      {/* Main Form Fields */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Write columns: Main text details */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-sautuk-card border border-sautuk-dark/5 p-6 lg:p-8 rounded-3xl shadow-sm space-y-5">
            {/* Title */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-sautuk-dark mb-1.5">लेख का शीर्षक (हेडलाइन)</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="उदा. उप-सहारन अफ्रीका में जलवायु पूंजी के भू-राजनीतिक बदलाव"
                className="w-full bg-slate-50 dark:bg-sautuk-bg/20 border border-slate-200 dark:border-sautuk-dark/15 text-sautuk-dark text-sm rounded-xl px-4 py-3 outline-none focus:border-sautuk-accent transition-colors font-semibold font-display text-lg"
              />
            </div>

            {/* Slug URL */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-sautuk-dark mb-1.5">कस्टम यूआरएल स्लग (वैकल्पिक)</label>
              <div className="flex rounded-xl overflow-hidden border border-slate-200 dark:border-sautuk-dark/15 bg-slate-50 dark:bg-sautuk-bg/20 focus-within:border-sautuk-accent transition-colors">
                <span className="bg-slate-100 dark:bg-sautuk-bg/30 border-r border-slate-200 dark:border-sautuk-dark/15 text-sautuk-muted px-4 py-3 text-xs font-mono font-bold flex items-center select-none">
                  sautuk.com/posts/
                </span>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^\p{L}\p{M}\p{N}-]/gu, ''))}
                  placeholder="खाली छोड़ने पर शीर्षक से स्वतः उत्पन्न होगा"
                  className="w-full bg-transparent text-sautuk-dark text-sm px-4 py-3 outline-none font-mono"
                />
              </div>
              <p className="text-[10px] text-sautuk-muted mt-1 px-1 font-semibold">केवल अक्षरों, अंकों और हाइफ़न/अंडरस्कोर की अनुमति है।</p>
            </div>

            {/* Excerpt Summary */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-sautuk-dark mb-1.5">संक्षिप्त सारांश / टीज़र</label>
              <textarea
                rows={3}
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                placeholder="एक संक्षिप्त विवरण जो लेख सूचियों और फ़ीड में दिखाई देगा..."
                className="w-full bg-slate-50 dark:bg-sautuk-bg/20 border border-slate-200 dark:border-sautuk-dark/15 text-sautuk-dark text-sm rounded-xl px-4 py-3 outline-none focus:border-sautuk-accent transition-colors resize-none font-sans leading-relaxed"
              />
            </div>
          </div>

          {/* Interactive Markdown Editor Container */}
          <div className="bg-white dark:bg-sautuk-card border border-sautuk-dark/5 rounded-3xl shadow-sm overflow-hidden">
            {/* Editor header tab switcher */}
            <div className="bg-slate-50 dark:bg-sautuk-bg/10 border-b border-slate-100 dark:border-sautuk-dark/15 px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="flex gap-2 text-xs font-bold uppercase tracking-wide">
                <button
                  type="button"
                  onClick={() => setEditorTab('write')}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg transition-colors cursor-pointer ${editorTab === 'write'
                      ? 'bg-sautuk-dark dark:bg-sautuk-accent text-white dark:text-sautuk-bg'
                      : 'text-sautuk-muted hover:text-sautuk-dark'
                    }`}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  लेख लिखें
                </button>
                <button
                  type="button"
                  onClick={() => setEditorTab('preview')}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg transition-colors cursor-pointer ${editorTab === 'preview'
                      ? 'bg-sautuk-dark dark:bg-sautuk-accent text-white dark:text-sautuk-bg'
                      : 'text-sautuk-muted hover:text-sautuk-dark'
                    }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  लाइव पूर्वावलोकन
                </button>
              </div>

              {/* Formatting Toolbar - Only visible in Write mode */}
              {editorTab === 'write' && (
                <div className="flex items-center gap-1 bg-white dark:bg-sautuk-bg/20 border border-slate-200 dark:border-sautuk-dark/15 rounded-lg p-1">
                  <button
                    type="button"
                    onClick={() => insertMarkdown('**', '**')}
                    className="p-2 text-sautuk-muted hover:text-sautuk-dark hover:bg-slate-50 rounded-md transition-colors"
                    title="बोल्ड (**)"
                  >
                    <Bold className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => insertMarkdown('*', '*')}
                    className="p-2 text-sautuk-muted hover:text-sautuk-dark hover:bg-slate-50 rounded-md transition-colors"
                    title="इटैलिक (*)"
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
                    title="उद्धरण (>)"
                  >
                    <Quote className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-px h-4 bg-slate-200 dark:bg-sautuk-dark/20 mx-1"></span>
                  <button
                    type="button"
                    onClick={() => insertMarkdown('[Link Text](', ')')}
                    className="p-2 text-sautuk-muted hover:text-sautuk-dark hover:bg-slate-50 rounded-md transition-colors"
                    title="हाइपरलिंक"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => insertMarkdown('![Image Alt Text](', ' "Image Caption")')}
                    className="p-2 text-sautuk-muted hover:text-sautuk-dark hover:bg-slate-50 rounded-md transition-colors"
                    title="छवि संलग्न करें"
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
                rows={16}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onDragOver={handleTextareaDragOver}
                onDragLeave={handleTextareaDragLeave}
                onDrop={handleTextareaDrop}
                placeholder="मार्कडाउन का उपयोग करके लेख की मुख्य सामग्री लिखें। उपशीर्षक, उद्धरण और लिंक का उपयोग करें..."
                className={`w-full bg-slate-50 dark:bg-sautuk-bg/20 border border-slate-200 dark:border-sautuk-dark/15 text-sautuk-dark text-sm rounded-xl px-4.5 py-4 outline-none focus:border-sautuk-accent transition-colors font-mono leading-relaxed resize-y min-h-[350px] ${isTextareaDragActive ? 'border-sautuk-accent bg-sautuk-accent/5 dark:bg-sautuk-accent/5' : ''
                  }`}
              />
            </div>

            {/* Live Preview Panel */}
            <div className={`p-6 lg:p-8 max-h-[600px] overflow-y-auto ${editorTab === 'preview' ? 'block bg-sautuk-bg/60' : 'hidden'}`}>
              {content.trim() ? (
                <div className="border border-sautuk-dark/5 p-6 bg-white dark:bg-sautuk-card rounded-2xl shadow-inner font-serif">
                  <MarkdownRenderer content={content} />
                </div>
              ) : (
                <div className="text-center py-16 text-sautuk-muted">
                  <p className="font-semibold text-sm italic">पूर्वावलोकन के लिए कुछ नहीं है। पहले लेख की सामग्री लिखें।</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Configurations: Sidebar metadata options */}
        <div className="space-y-6">
          {/* Metadata Card */}
          <div className="bg-white dark:bg-sautuk-card border border-sautuk-dark/5 p-6 rounded-3xl shadow-sm space-y-5">
            <h3 className="font-display font-black text-sm text-sautuk-dark border-b border-slate-100 dark:border-sautuk-dark/15 pb-3 uppercase tracking-wider">
              प्रकाशन सेटिंग्स
            </h3>

            {/* Status (DRAFT vs PUBLISHED) */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-sautuk-dark mb-1.5">प्रकाशन की स्थिति</label>
              <Dropdown
                value={status}
                onChange={(val) => setStatus(val as 'DRAFT' | 'PUBLISHED')}
                options={[
                  { value: 'DRAFT', label: 'मसौदा (ड्राफ्ट)' },
                  { value: 'PUBLISHED', label: 'लाइव प्रकाशित' }
                ]}
              />
            </div>

            {/* Featured PIN checkbox */}
            <div className="flex items-center gap-3 bg-slate-50 dark:bg-sautuk-bg/10 border border-slate-200 dark:border-sautuk-dark/15 p-4 rounded-2xl">
              <input
                type="checkbox"
                id="featured-checkbox"
                checked={featured}
                onChange={(e) => {
                  const checkVal = e.target.checked;
                  if (checkVal) {
                    const alreadyPinnedCount = featuredPosts?.filter((p: any) => p.id !== activePostId).length || 0;
                    if (alreadyPinnedCount >= 5) {
                      addToast('होमपेज कैरोसेल पर पहले से ही 5 लेख पिन हैं। नया लेख पिन करने के लिए किसी पुराने लेख को अनपिन करें।', 'error');
                      return;
                    }
                  }
                  setFeatured(checkVal);
                }}
                className="w-4.5 h-4.5 text-sautuk-accent accent-sautuk-accent border-slate-300 rounded focus:ring-sautuk-accent cursor-pointer"
              />
              <label htmlFor="featured-checkbox" className="font-bold text-xs text-sautuk-dark cursor-pointer select-none">
                होमपेज कैरोसेल पर पिन करें
                <span className="block text-[10px] text-sautuk-muted font-normal mt-0.5">इस लेख को शीर्ष स्लाइड कैरोसेल में प्रदर्शित करें।</span>
              </label>
            </div>

            {/* Category selection */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-sautuk-dark mb-1.5">श्रेणी का विषय</label>
              <Dropdown
                value={categoryId}
                onChange={(val) => setCategoryId(val)}
                options={[
                  { value: '', label: '-- श्रेणी चुनें --' },
                  ...(categories?.map((cat: any) => ({ value: cat.id, label: cat.name })) || [])
                ]}
                placeholder="-- श्रेणी चुनें --"
              />
            </div>

            {/* Featured Image Link */}
            <div className="space-y-3">
              <label className="block text-xs font-bold uppercase tracking-wider text-sautuk-dark mb-1">मुख्य कवर छवि</label>

              {featuredImage.trim() ? (
                <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-sautuk-dark/15 aspect-[16/9] bg-slate-50 dark:bg-sautuk-bg/10 group">
                  {isUploadingCover ? (
                    <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-2 z-10">
                      <Loader2 className="w-5 h-5 animate-spin text-white" />
                      <span className="text-[10px] text-white font-semibold">नई छवि अपलोड हो रही है...</span>
                    </div>
                  ) : (
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 z-10">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="bg-white text-slate-800 text-[10px] font-bold px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-all cursor-pointer"
                      >
                        बदलें
                      </button>
                      <button
                        type="button"
                        onClick={() => setFeaturedImage('')}
                        className="bg-rose-600 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg hover:bg-rose-700 transition-all cursor-pointer"
                      >
                        हटाएं
                      </button>
                    </div>
                  )}
                  <img
                    src={featuredImage}
                    alt="Cover Preview"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://placehold.co/600x400/png?text=Invalid+Image+URL';
                    }}
                  />
                </div>
              ) : (
                <div
                  onDragEnter={handleDragCover}
                  onDragOver={handleDragCover}
                  onDragLeave={handleDragCover}
                  onDrop={handleDropCover}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[140px] ${dragActiveCover
                      ? 'border-sautuk-accent bg-sautuk-accent/5 dark:bg-sautuk-accent/5'
                      : 'border-slate-200 dark:border-sautuk-dark/15 hover:border-sautuk-accent'
                    }`}
                >
                  {isUploadingCover ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin text-sautuk-accent" />
                      <span className="text-[10px] text-sautuk-dark/70 dark:text-sautuk-bg/70 font-semibold">छवि अपलोड हो रही है...</span>
                    </div>
                  ) : (
                    <>
                      <Image className="w-6 h-6 text-sautuk-dark/40 mb-1.5" />
                      <p className="text-[10px] font-bold uppercase tracking-wider text-sautuk-dark">छवि यहाँ खींचें और छोड़ें</p>
                      <p className="text-[9px] text-sautuk-dark/60 mt-0.5">या स्थानीय फ़ाइलें ब्राउज़ करने के लिए क्लिक करें</p>
                    </>
                  )}
                </div>
              )}

              {/* Hidden file input */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => e.target.files?.[0] && handleUploadCoverFile(e.target.files[0])}
                accept="image/*"
                className="hidden"
              />

              {/* URL Fallback Input */}
              <div className="pt-1">
                <input
                  type="url"
                  value={featuredImage}
                  onChange={(e) => setFeaturedImage(e.target.value)}
                  placeholder="या सीधे छवि का यूआरएल पेस्ट करें (https://...)"
                  className="w-full bg-slate-50 dark:bg-sautuk-bg/20 border border-slate-200 dark:border-sautuk-dark/15 text-sautuk-dark text-xs rounded-xl px-4 py-2.5 outline-none focus:border-sautuk-accent transition-colors font-mono"
                />
              </div>
            </div>
          </div>

          {/* Tags Manager Card */}
          <div className="bg-white dark:bg-sautuk-card border border-sautuk-dark/5 p-6 rounded-3xl shadow-sm space-y-4">
            <h3 className="font-display font-black text-sm text-sautuk-dark border-b border-slate-100 dark:border-sautuk-dark/15 pb-3 uppercase tracking-wider">
              लेख के टैग
            </h3>

            {!tags || tags.length === 0 ? (
              <p className="text-xs text-sautuk-muted italic">अभी तक कोई टैग नहीं बनाया गया है। वर्गीकरण (Taxonomy) टैब में टैग जोड़ें।</p>
            ) : (
              <div className="flex flex-wrap gap-2 max-h-52 overflow-y-auto p-1 border border-slate-100 dark:border-sautuk-dark/15 rounded-xl">
                {tags.map((tag: any) => {
                  const isSelected = selectedTagIds.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => handleTagToggle(tag.id)}
                      className={`text-xs font-bold px-3 py-1.5 rounded-full border transition-all cursor-pointer ${isSelected
                          ? 'bg-sautuk-dark dark:bg-sautuk-accent text-white dark:text-sautuk-bg border-sautuk-dark dark:border-sautuk-accent'
                          : 'bg-white dark:bg-sautuk-bg/20 text-sautuk-muted border-slate-200 dark:border-sautuk-dark/15 hover:border-slate-300'
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
          <div className="bg-white dark:bg-sautuk-card border border-sautuk-dark/5 p-6 rounded-3xl shadow-sm space-y-4">
            <h3 className="font-display font-black text-sm text-sautuk-dark border-b border-slate-100 dark:border-sautuk-dark/15 pb-3 uppercase tracking-wider flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-sautuk-cta" />
              एसईओ (SEO) कस्टम मेटाडेटा
            </h3>

            {/* SEO Title */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-sautuk-dark mb-1.5">कस्टम एसईओ शीर्षक</label>
              <input
                type="text"
                value={seoTitle}
                onChange={(e) => setSeoTitle(e.target.value)}
                placeholder="अनुशंसित: अधिकतम 60 वर्ण"
                maxLength={100}
                className="w-full bg-slate-50 dark:bg-sautuk-bg/20 border border-slate-200 dark:border-sautuk-dark/15 text-sautuk-dark text-sm rounded-xl px-4 py-3 outline-none focus:border-sautuk-accent transition-colors"
              />
            </div>

            {/* SEO Description */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-sautuk-dark mb-1.5">कस्टम एसईओ विवरण</label>
              <textarea
                rows={4}
                value={seoDescription}
                onChange={(e) => setSeoDescription(e.target.value)}
                placeholder="अनुशंसित: खोज परिणामों के लिए अधिकतम 160 वर्ण..."
                maxLength={200}
                className="w-full bg-slate-50 dark:bg-sautuk-bg/20 border border-slate-200 dark:border-sautuk-dark/15 text-sautuk-dark text-sm rounded-xl px-4 py-3 outline-none focus:border-sautuk-accent transition-colors resize-none leading-relaxed text-xs"
              />
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
