import type { Taxonomy, PostSummary } from '../../services/types';
import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Save, Image as ImageIcon, Loader2, AlertCircle,
  FileText, X, Eye
} from 'lucide-react';
import { apiFetch } from '../../services/api';
import { useToastStore } from '../../store/useToastStore';
import Dropdown from '../../components/Dropdown';
import ConfirmModal from '../../components/ConfirmModal';
import TiptapEditor from '../../components/TiptapEditor';
import DOMPurify from 'dompurify';
import { uploadImportedImages } from '../../services/imported-images';

interface PostEditorProps {
  postId: string | null;
  onClose: () => void;
}

interface EditorSnapshot {
  baseUpdatedAt?: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  featuredImage: string;
  categoryId: string;
  selectedTagIds: string[];
  status: 'DRAFT' | 'PUBLISHED';
  featured: boolean;
  seoTitle: string;
  seoDescription: string;
}

function readEditingCopy(id: string): EditorSnapshot | null {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(`sautuk:editing:${id}`) || 'null');
    if (!saved || typeof saved !== 'object') return null;
    const value = saved as Record<string, unknown>;
    const strings = ['title', 'slug', 'excerpt', 'content', 'featuredImage', 'categoryId', 'seoTitle', 'seoDescription'];
    if (!strings.every(key => typeof value[key] === 'string') || !Array.isArray(value.selectedTagIds) || !value.selectedTagIds.every(id => typeof id === 'string') || typeof value.featured !== 'boolean' || !['DRAFT', 'PUBLISHED'].includes(String(value.status))) return null;
    return value as unknown as EditorSnapshot;
  } catch {
    return null;
  }
}

const emptySnapshot = (): EditorSnapshot => ({
  title: '', slug: '', excerpt: '', content: '', featuredImage: '', categoryId: '',
  selectedTagIds: [], status: 'DRAFT', featured: false, seoTitle: '', seoDescription: '',
});

export default function PostEditor(props: PostEditorProps) {
  return <PostEditorSession key={props.postId ?? 'new'} {...props} />;
}

function PostEditorSession({ postId, onClose }: PostEditorProps) {
  const queryClient = useQueryClient();
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
  const [showPreview, setShowPreview] = useState(false);

  // Custom modal state
  const [confirmModalConfig, setConfirmModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    isDestructive?: boolean;
    confirmText?: string;
    intent?: 'leave';
  } | null>(null);

  // Fetch categories for selection dropdown
  const { data: categories, isError: categoriesFailed, refetch: retryCategories } = useQuery({
    queryKey: ['admin-categories-select'],
    queryFn: async () => {
      const res = await apiFetch('/categories');
      if (!res.ok) throw new Error('Categories unavailable');
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error('Invalid categories');
      return data;
    },
  });

  // Fetch tags for checkbox selectors
  const { data: tags, isError: tagsFailed, refetch: retryTags } = useQuery({
    queryKey: ['admin-tags-select'],
    queryFn: async () => {
      const res = await apiFetch('/tags');
      if (!res.ok) throw new Error('Tags unavailable');
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error('Invalid tags');
      return data;
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
  const [originalStatus, setOriginalStatus] = useState<'DRAFT' | 'PUBLISHED' | null>(() => postId ? null : 'DRAFT');
  const [isAutosaved, setIsAutosaved] = useState(false);
  const [saveRevision, setSaveRevision] = useState(0);
  const storageWarningRef = useRef(false);
  const versionRef = useRef<string | undefined>(undefined);
  const [recoveryCopy, setRecoveryCopy] = useState<EditorSnapshot | null>(null);
  const [hydratedPostId, setHydratedPostId] = useState<string | null>(null);

  // Keep track of the initially loaded or first-saved values to detect dirty state
  const initialDataRef = useRef<EditorSnapshot | null>(postId ? null : emptySnapshot());

  // Flag to block background autosaves when the form is explicitly submitted
  const isSavingRef = useRef(false);

  // Cover image and content drag-and-drop upload states
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [dragActiveCover, setDragActiveCover] = useState(false);
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

  const { isLoading: loadingPost, isError: postLoadFailed, refetch: retryPostLoad } = useQuery({
    queryKey: ['admin-post-edit', postId],
    queryFn: async ({ signal }) => {
      const res = await apiFetch(`/posts/${postId}`, { signal });
      if (!res.ok) throw new Error('लेख लोड नहीं हो सका। फिर से प्रयास करें।');
      const data = await res.json();
      if (signal.aborted) throw new Error('Article request cancelled');
      if (!data.id || typeof data.title !== 'string' || typeof data.content !== 'string') throw new Error('लेख का विवरण अधूरा है।');

      // Populate form fields
      versionRef.current = data.updatedAt;
      setTitle(data.title || '');
      setSlug(data.slug || '');
      setExcerpt(data.excerpt || '');
      setContent(data.content || '');
      setFeaturedImage(data.featuredImage || '');
      setCategoryId(data.categoryId || '');
      setSelectedTagIds(data.tags?.map((pt: { tagId: string }) => pt.tagId) || []);
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
        selectedTagIds: data.tags?.map((pt: { tagId: string }) => pt.tagId) || [],
        status: data.status || 'DRAFT',
        featured: data.featured || false,
        seoTitle: data.seoTitle || '',
        seoDescription: data.seoDescription || '',
      };

      // Published edits are a browser-local working copy, never a background PATCH.
      const editingCopy = data.status === 'PUBLISHED' ? readEditingCopy(data.id) : null;
      if (editingCopy && (!data.updatedAt || editingCopy.baseUpdatedAt === data.updatedAt)) {
        setTitle(editingCopy.title);
        setSlug(editingCopy.slug);
        setExcerpt(editingCopy.excerpt);
        setContent(editingCopy.content);
        setFeaturedImage(editingCopy.featuredImage);
        setCategoryId(editingCopy.categoryId);
        setSelectedTagIds(editingCopy.selectedTagIds);
        setStatus(editingCopy.status);
        setFeatured(editingCopy.featured);
        setSeoTitle(editingCopy.seoTitle);
        setSeoDescription(editingCopy.seoDescription);
      } else if (editingCopy) {
        setRecoveryCopy(editingCopy);
      }
      setHydratedPostId(postId);
      return data;
    },
    enabled: !!postId,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const isFetchingPost = loadingPost || Boolean(postId && hydratedPostId !== postId);

  // Autosave mutation
  const autosaveMutation = useMutation({
    mutationFn: async (snapshot: EditorSnapshot) => {
      if (isSavingRef.current) {
        throw new Error('Skipping autosave: manual save/publish in progress');
      }
      if (originalStatus === 'PUBLISHED') throw new Error('Published changes require confirmation');
      const autosaveStatus = 'DRAFT';
      const bodyPayload = {
        expectedUpdatedAt: versionRef.current,
        title: snapshot.title.trim() !== '' ? snapshot.title : 'Untitled Draft',
        slug: snapshot.slug.trim() !== '' ? snapshot.slug : undefined,
        excerpt: snapshot.excerpt,
        content: snapshot.content,
        featuredImage: snapshot.featuredImage.trim() !== '' ? snapshot.featuredImage : null,
        categoryId: snapshot.categoryId !== '' ? snapshot.categoryId : null,
        tagIds: snapshot.selectedTagIds,
        status: autosaveStatus,
        featured: snapshot.featured,
        seoTitle: snapshot.seoTitle.trim() !== '' ? snapshot.seoTitle : null,
        seoDescription: snapshot.seoDescription.trim() !== '' ? snapshot.seoDescription : null,
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
    onSuccess: (data, snapshot) => {
      versionRef.current = data.updatedAt;
      initialDataRef.current = snapshot;
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
    onError: () => setIsAutosaved(false),
  });

  // Dirty state checker helper
  const checkIsDirty = useCallback(() => {
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
  }, [title, slug, excerpt, content, featuredImage, categoryId, selectedTagIds, status, featured, seoTitle, seoDescription]);

  const snapshot = useCallback((): EditorSnapshot => ({ title, slug, excerpt, content, featuredImage, categoryId, selectedTagIds, status, featured, seoTitle, seoDescription }), [title, slug, excerpt, content, featuredImage, categoryId, selectedTagIds, status, featured, seoTitle, seoDescription]);
  const latestSnapshotRef = useRef<EditorSnapshot>(snapshot());
  useLayoutEffect(() => { latestSnapshotRef.current = snapshot(); }, [snapshot]);

  useEffect(() => {
    if (originalStatus !== 'PUBLISHED' || !activePostId || isFetchingPost || recoveryCopy) return;
    try {
      const key = `sautuk:editing:${activePostId}`;
      if (checkIsDirty()) localStorage.setItem(key, JSON.stringify({ ...snapshot(), baseUpdatedAt: versionRef.current }));
      else localStorage.removeItem(key);
      storageWarningRef.current = false;
    } catch {
      if (!storageWarningRef.current) addToast('इस ब्राउज़र में संपादन सहेजा नहीं जा सका। पृष्ठ छोड़ने से पहले अपने बदलाव कॉपी कर लें। लाइव लेख नहीं बदला है।', 'error');
      storageWarningRef.current = true;
    }
  }, [activePostId, originalStatus, isFetchingPost, checkIsDirty, snapshot, addToast, recoveryCopy, saveRevision]);

  useEffect(() => {
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      if (checkIsDirty()) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warnBeforeLeaving);
    return () => window.removeEventListener('beforeunload', warnBeforeLeaving);
  }, [checkIsDirty]);

  const { mutate: autosave, isPending: isAutosaving, isError: autosaveFailed } = autosaveMutation;

  // Debounced autosave effect
  useEffect(() => {
    if (activePostId && (isFetchingPost || postLoadFailed)) return;
    if (originalStatus === 'PUBLISHED') return;
    if (isAutosaving || autosaveFailed || isSavingRef.current) return;
    if (!checkIsDirty()) return;

    const current = snapshot();
    const hasContent = current.title.trim() || current.excerpt.trim() || current.content.trim();
    if (!hasContent) return;

    const timer = setTimeout(() => {
      setIsAutosaved(false);
      autosave(current);
    }, 3000);

    return () => clearTimeout(timer);
  }, [
    activePostId, originalStatus, isFetchingPost, postLoadFailed, isAutosaving, autosaveFailed, autosave, snapshot, checkIsDirty, saveRevision
  ]);

  // Mutate save handler
  const saveMutation = useMutation({
    mutationFn: async (saved: EditorSnapshot) => {
      const bodyPayload = {
        expectedUpdatedAt: versionRef.current,
        title: saved.title.trim() !== '' ? saved.title : 'Untitled Draft',
        slug: saved.slug.trim() !== '' ? saved.slug : undefined,
        excerpt: saved.excerpt,
        content: saved.content,
        featuredImage: saved.featuredImage.trim() !== '' ? saved.featuredImage : null,
        categoryId: saved.categoryId !== '' ? saved.categoryId : null,
        tagIds: saved.selectedTagIds,
        status: saved.status,
        featured: saved.featured,
        seoTitle: saved.seoTitle.trim() !== '' ? saved.seoTitle : null,
        seoDescription: saved.seoDescription.trim() !== '' ? saved.seoDescription : null,
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
    onSuccess: (data, saved) => {
      versionRef.current = data.updatedAt;
      setSaveRevision(value => value + 1);
      initialDataRef.current = saved;
      isSavingRef.current = false;
      queryClient.invalidateQueries({ queryKey: ['admin-posts'] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      if (JSON.stringify(latestSnapshotRef.current) !== JSON.stringify(saved)) {
        // Acknowledge only the submitted version. Newer input still needs saving.
        setOriginalStatus(saved.status);
        if (!activePostId && data.id) setActivePostId(data.id);
        addToast('पिछला संस्करण सहेजा गया। नए बदलाव अभी प्रकाशित नहीं हुए हैं।', 'info');
        return;
      }
      if (activePostId) {
        try { localStorage.removeItem(`sautuk:editing:${activePostId}`); } catch { /* Leaving still warns about unsaved edits. */ }
      }
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

  const handleTagToggle = (tagId: string) => {
    setSelectedTagIds(prev =>
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  const handleDocxUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    addToast('Word दस्तावेज़ पार्स किया जा रहा है...', 'info');

    try {
      const mammoth = (await import('mammoth')).default;
      const arrayBuffer = await file.arrayBuffer();

      const result = await mammoth.convertToHtml({ arrayBuffer }, {
        convertImage: mammoth.images.imgElement(function (image) {
          return image.read("base64").then(function (imageBuffer) {
            return {
              src: "data:" + image.contentType + ";base64," + imageBuffer
            };
          });
        })
      });

      const html = await uploadImportedImages(result.value);
      setContent(html);
      addToast('दस्तावेज़ सफलतापूर्वक आयात किया गया!', 'success');

      if (result.messages.length > 0) {
        console.warn('Mammoth messages:', result.messages);
      }
    } catch (err) {
      console.error('Docx upload error:', err);
      addToast('दस्तावेज़ पार्स करने में विफल', 'error');
    }

    // Clear input so same file can be uploaded again if needed
    e.target.value = '';
  };

  const handleSaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (postId && (postLoadFailed || isFetchingPost)) return;
    if (recoveryCopy) {
      addToast('पहले पुरानी संपादन प्रति सुरक्षित करके नए संस्करण से जारी रखें।', 'error');
      return;
    }

    // Check if moving from Published to Draft (Unpublishing)
    if (originalStatus === 'PUBLISHED' && status === 'DRAFT') {
      setConfirmModalConfig({
        isOpen: true,
        title: 'लेख को ड्राफ्ट में बदलें?',
        message: 'यह लेख वर्तमान में लाइव है। इसे ड्राफ्ट में बदलने से यह तुरंत वेबसाइट से हट जाएगा और पाठकों को दिखाई नहीं देगा। क्या आप वाकई ऐसा करना चाहते हैं?',
        isDestructive: true,
        confirmText: 'हां, ड्राफ्ट बनाएं (Unpublish)'
      });
      return;
    }

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

      // If it's going from Draft -> Published
      if (originalStatus !== 'PUBLISHED') {
        setConfirmModalConfig({
          isOpen: true,
          title: 'लेख प्रकाशित करें?',
          message: 'क्या आप वाकई इस लेख को लाइव प्रकाशित करना चाहते हैं? यह तुरंत सभी पाठकों को दिखाई देने लगेगा।',
          isDestructive: false,
          confirmText: 'प्रकाशित करें (Publish)'
        });
        return;
      }
      setConfirmModalConfig({
        isOpen: true,
        title: 'बदलाव लाइव प्रकाशित करें?',
        message: 'यह पुराने लाइव लेख की जगह आपके संपादित संस्करण को प्रकाशित करेगा। पुष्टि करने के बाद ये बदलाव सभी पाठकों को दिखाई देंगे।',
        confirmText: 'हाँ, बदलाव लाइव करें',
      });
      return;
    }

    executeSave();
  };

  const executeSave = () => {
    isSavingRef.current = true;
    saveMutation.mutate(snapshot());
    setConfirmModalConfig(null);
  };

  const requestClose = () => {
    if (!checkIsDirty()) return onClose();
    setConfirmModalConfig({
      isOpen: true,
      intent: 'leave',
      title: 'संपादन से बाहर जाएँ?',
      message: originalStatus === 'PUBLISHED'
        ? 'ये बदलाव लाइव प्रकाशित नहीं हुए हैं। ब्राउज़र में सहेजी गई संपादन प्रति अगली बार उपलब्ध होगी। यदि स्थानीय संग्रहण में त्रुटि दिखी है, पहले अपने बदलाव कॉपी कर लें।'
        : 'कुछ बदलाव अभी सर्वर पर सहेजे नहीं गए हैं। बाहर जाने से वे खो सकते हैं।',
      confirmText: 'हाँ, बाहर जाएँ',
    });
  };

  if (postId && postLoadFailed) {
    return <div role="alert" className="rounded-2xl border border-red-200 p-6 text-sautuk-dark">
      <p>लेख लोड नहीं हो सका। आपके लेख में कोई बदलाव नहीं किया गया है।</p>
      <button type="button" onClick={() => retryPostLoad()} className="mt-4 font-bold underline">फिर से प्रयास करें</button>
      <button type="button" onClick={onClose} className="ml-6 underline">सूची पर वापस जाएं</button>
    </div>;
  }
  if (activePostId && isFetchingPost) {
    return (
      <div className="flex flex-col justify-center items-center py-24 text-sautuk-dark">
        <Loader2 className="w-8 h-8 animate-spin text-sautuk-accent mb-3" />
        <p className="text-sm font-semibold">लेख का विवरण लोड हो रहा है...</p>
      </div>
    );
  }

  return (
    <>
      {(categoriesFailed || tagsFailed) && <div role="alert" className="rounded-xl border border-amber-300 p-4 text-sautuk-dark">
        श्रेणियाँ या टैग लोड नहीं हो सके। आपका लेख संपादन के लिए उपलब्ध है।{' '}
        <button type="button" onClick={() => { retryCategories(); retryTags(); }} className="font-bold underline">श्रेणियाँ और टैग फिर लोड करें</button>
      </div>}
      {recoveryCopy && <div role="alert" className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-slate-900">
        <p>ब्राउज़र की पुरानी संपादन प्रति नए लाइव संस्करण से अलग है। नीचे से अपने पुराने बदलाव कॉपी करके सुरक्षित रखें। संपादक में नया लाइव संस्करण खुला है।</p>
        <details><summary>पुरानी संपादन प्रति देखें</summary><textarea aria-label="पुरानी संपादन प्रति" readOnly value={JSON.stringify(recoveryCopy, null, 2)} className="w-full h-48 p-3" /></details>
        <button type="button" onClick={() => setRecoveryCopy(null)} className="mt-3 font-bold underline">पुराने बदलाव सुरक्षित हैं, नए संस्करण से जारी रखें</button>
      </div>}
      <form onSubmit={handleSaveSubmit} className="space-y-8">
        {/* Editor top navigation bar */}
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-5 bg-white dark:bg-sautuk-card border border-sautuk-dark/5 p-6 rounded-3xl shadow-sm">
          <div className="flex items-start sm:items-center gap-3">
            <button
              type="button"
              onClick={requestClose}
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

          <div className="flex flex-wrap items-center gap-3 mt-2 sm:mt-0">
            {originalStatus === 'PUBLISHED' && <span className="text-xs text-sautuk-accent font-bold">संपादन जारी (Editing) · पुराना संस्करण लाइव है</span>}
            {isAutosaved && (
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/20 px-2.5 py-1.5 rounded-full border border-emerald-100 dark:border-emerald-900/30 shrink-0 flex items-center gap-1.5 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                मसौदा स्वतः सहेजा गया
              </span>
            )}

            <button
              type="button"
              onClick={requestClose}
              className="px-5 py-3 rounded-full text-xs font-bold text-sautuk-dark hover:bg-slate-100 dark:hover:bg-sautuk-bg/20 transition-colors shrink-0"
            >
              रद्द करें
            </button>

            <button
              type="submit"
              disabled={saveMutation.isPending || autosaveMutation.isPending}
              className="flex items-center gap-1.5 bg-sautuk-dark dark:bg-sautuk-accent text-sautuk-bg hover:opacity-90 hover:scale-[1.03] active:scale-95 font-bold px-7 py-3 rounded-full text-xs transition-all shadow-md cursor-pointer shrink-0 disabled:opacity-50"
            >
              {saveMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {originalStatus === 'PUBLISHED' ? 'बदलाव प्रकाशित करें' : 'प्रकाशित करें'}
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

        {autosaveMutation.isError && (
          <div role="alert" className="bg-sautuk-cta/10 border border-sautuk-cta/20 text-sautuk-cta text-xs rounded-xl p-4 flex flex-wrap items-center gap-3">
            <span>मसौदा सहेजा नहीं गया। आपके बदलाव अभी इस पृष्ठ पर हैं।</span>
            <button type="button" className="font-bold underline" onClick={() => autosaveMutation.mutate({ title, slug, excerpt, content, featuredImage, categoryId, selectedTagIds, status, featured, seoTitle, seoDescription })}>फिर से सहेजें</button>
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

            {/* Interactive WYSIWYG Editor Container */}
            <div className="bg-white dark:bg-sautuk-card border border-sautuk-dark/5 rounded-3xl shadow-sm overflow-hidden flex flex-col min-h-[500px]">
              <div className="bg-slate-50 dark:bg-sautuk-bg/10 border-b border-slate-100 dark:border-sautuk-dark/15 px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <h3 className="font-display font-black text-sm text-sautuk-dark uppercase tracking-wider">
                  मुख्य सामग्री
                </h3>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowPreview(true)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 dark:bg-white/5 text-sautuk-dark dark:text-white rounded-lg text-xs font-bold uppercase tracking-wide cursor-pointer hover:bg-slate-200 dark:hover:bg-white/10 transition-colors shadow-sm"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Preview
                  </button>
                </div>
              </div>

              <div className="flex-grow flex flex-col quill-container">
                <TiptapEditor
                  content={content}
                  onChange={setContent}
                  placeholder="यहाँ टाइप करें या ऊपर से Word Document अपलोड करें..."
                  onDocxUpload={handleDocxUpload}
                />
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
                      const alreadyPinnedCount = featuredPosts?.filter((p: PostSummary) => p.id !== activePostId).length || 0;
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
                    ...(categories?.map((cat: Taxonomy) => ({ value: cat.id, label: cat.name })) || [])
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
                        <ImageIcon className="w-6 h-6 text-sautuk-dark/40 mb-1.5" />
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
                  {tags.map((tag: Taxonomy) => {
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
                <FileText className="w-4 h-4 text-sautuk-cta" />
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

      {/* Modals */}
      {confirmModalConfig && (
        <ConfirmModal
          isOpen={confirmModalConfig.isOpen}
          title={confirmModalConfig.title}
          message={confirmModalConfig.message}
          confirmText={confirmModalConfig.confirmText}
          onConfirm={confirmModalConfig?.intent === 'leave' ? onClose : executeSave}
          onCancel={() => setConfirmModalConfig(null)}
        />
      )}

      {/* Fullscreen Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 z-[100] bg-white dark:bg-sautuk-bg overflow-y-auto flex flex-col font-sans">
          <div className="border-b border-sautuk-dark/10 bg-white/85 dark:bg-sautuk-bg/85 backdrop-blur-md sticky top-0 z-50 px-4 lg:px-8 py-4 shadow-sm flex justify-between items-center">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setShowPreview(false)}
                className="p-2 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 rounded-full text-sautuk-dark dark:text-white transition-colors"
                title="Close Preview"
              >
                <X className="w-5 h-5" />
              </button>
              <span className="font-bold text-sm text-sautuk-dark/60 uppercase tracking-widest">
                Preview Mode
              </span>
            </div>
            <button
              onClick={() => setShowPreview(false)}
              className="px-5 py-2 rounded-full text-xs font-bold bg-sautuk-dark dark:bg-sautuk-accent text-white transition-colors"
            >
              Continue Editing
            </button>
          </div>

          <main className="max-w-4xl mx-auto px-4 py-8 lg:py-16 w-full flex-grow flex flex-col">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-display font-black text-sautuk-dark tracking-tight leading-tight mb-6">
              {title || 'Untitled Draft'}
            </h1>

            {excerpt && (
              <p className="text-lg lg:text-xl text-sautuk-muted leading-relaxed font-sans font-medium mb-8 border-l-2 border-sautuk-accent/30 pl-4 py-1 italic">
                {excerpt}
              </p>
            )}

            {featuredImage && (
              <div className="w-full mb-10">
                <img 
                  src={featuredImage} 
                  alt="Featured" 
                  className="rounded-3xl w-full max-h-[500px] object-cover shadow-md border border-sautuk-dark/5"
                />
              </div>
            )}

            <article 
              className="article-content text-sautuk-dark text-lg leading-relaxed mb-16 prose prose-lg dark:prose-invert prose-headings:font-display prose-headings:font-black prose-p:font-sans prose-a:text-sautuk-accent max-w-none"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content) }}
            />
          </main>
        </div>
      )}
    </>
  );
}
