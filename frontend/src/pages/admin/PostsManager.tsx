import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  FileText, Star, Plus, Trash2, Eye, 
  Loader2, AlertCircle, Calendar, Tag, CheckCircle2, FileEdit,
  Globe, Archive, PinOff
} from 'lucide-react';
import { getPosts, deletePost, apiFetch } from '../../services/api';
import { useToastStore } from '../../store/useToastStore';
import Dropdown from '../../components/Dropdown';

interface PostsManagerProps {
  onCreateClick: () => void;
  onEditClick: (id: string) => void;
}

export default function PostsManager({ onCreateClick, onEditClick }: PostsManagerProps) {
  const queryClient = useQueryClient();
  const { addToast } = useToastStore();

  // Query to fetch all posts (admin defaults to fetching drafts + published)
  const { data: posts, isLoading, isError, error } = useQuery({
    queryKey: ['admin-posts'],
    queryFn: () => getPosts(),
  });

  // Published pagination and search states
  const [pubSearch, setPubSearch] = useState('');
  const [pubPageSize, setPubPageSize] = useState(10);
  const [pubPage, setPubPage] = useState(1);

  // Mutation to delete a post
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deletePost(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-posts'] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
    },
  });

  // Mutation to toggle post status (Publish / Revert to Draft)
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'DRAFT' | 'PUBLISHED' }) => {
      const res = await apiFetch(`/posts/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to update post status');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-posts'] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
    },
    onError: (err: any) => {
      addToast(`प्रकाशन की स्थिति बदलने में विफल: ${err.message}`, 'error');
    },
  });

  // Mutation to toggle post carousel featured status
  const toggleFeaturedMutation = useMutation({
    mutationFn: async ({ id, featured }: { id: string; featured: boolean }) => {
      const res = await apiFetch(`/posts/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ featured }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to update featured status');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-posts'] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      addToast('होमपेज पिन स्थिति सफलतापूर्वक अपडेट की गई।', 'success');
    },
    onError: (err: any) => {
      addToast(`कैरोसेल पिन अपडेट विफल: ${err.message}`, 'error');
    },
  });

  const handleDelete = (id: string, title: string) => {
    if (confirm(`क्या आप वाकई लेख "${title}" को हटाना चाहते हैं? यह कार्रवाई स्थाई होगी।`)) {
      deleteMutation.mutate(id);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('hi-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col justify-center items-center py-20 text-sautuk-dark">
        <Loader2 className="w-8 h-8 animate-spin text-sautuk-accent mb-3" />
        <p className="text-sm font-semibold">Loading editorial publications...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-sautuk-cta/10 border border-sautuk-cta/20 text-sautuk-cta text-xs rounded-xl p-4.5 flex items-start gap-2.5 max-w-2xl my-6">
        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
        <div>
          <h4 className="font-bold text-sm mb-1">Failed to fetch posts</h4>
          <p>{(error as Error).message || 'Server returned an error. Please try again.'}</p>
        </div>
      </div>
    );
  }

  const publishedPosts = posts?.filter((post: any) => post.status === 'PUBLISHED') || [];
  const draftPosts = posts?.filter((post: any) => post.status !== 'PUBLISHED') || [];
  const pinnedPosts = posts?.filter((post: any) => post.featured && post.status === 'PUBLISHED') || [];

  // Filter published posts by search query (title or category name)
  const filteredPublished = publishedPosts.filter((post: any) => {
    const term = pubSearch.toLowerCase().trim();
    if (!term) return true;
    const titleMatch = post.title.toLowerCase().includes(term);
    const categoryMatch = post.category?.name?.toLowerCase().includes(term) || false;
    return titleMatch || categoryMatch;
  });

  // Paginated published posts calculation
  const totalPubPages = Math.ceil(filteredPublished.length / pubPageSize) || 1;
  const activePubPage = Math.min(pubPage, totalPubPages);
  const startIndex = (activePubPage - 1) * pubPageSize;
  const paginatedPublished = filteredPublished.slice(startIndex, startIndex + pubPageSize);

  const renderPostTable = (postsList: any[], isDraft: boolean) => {
    if (postsList.length === 0) {
      return (
        <div className="text-center py-8 bg-slate-50/50 dark:bg-sautuk-bg/5 border border-dashed border-slate-200 dark:border-sautuk-dark/10 rounded-2xl p-6">
          <p className="text-xs text-sautuk-muted italic font-semibold">
            {isDraft ? "कोई ड्राफ्ट या सहेजे नहीं गए लेख नहीं हैं।" : "कोई प्रकाशित लेख नहीं हैं।"}
          </p>
        </div>
      );
    }

    return (
      <div className="bg-white dark:bg-sautuk-card border border-sautuk-dark/5 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-slate-50 dark:bg-sautuk-bg/10 border-b border-slate-100 dark:border-sautuk-dark/15 text-xs font-bold uppercase tracking-wider text-sautuk-muted">
                <th className="py-4 px-6 w-[35%] min-w-[280px]">लेख की जानकारी</th>
                <th className="py-4 px-6 w-[15%] min-w-[120px]">श्रेणी</th>
                <th className="py-4 px-6 w-[15%] min-w-[120px]">स्थिति</th>
                <th className="py-4 px-6 w-[10%] min-w-[80px]">दृश्य</th>
                <th className="py-4 px-6 w-[15%] min-w-[130px]">निर्माण तिथि</th>
                <th className="py-4 px-6 w-[10%] min-w-[110px] text-right">कार्रवाई</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-sautuk-dark/15 text-sm">
              {postsList.map((post: any) => (
                <tr 
                  key={post.id} 
                  onClick={() => onEditClick(post.id)}
                  className="hover:bg-slate-50/50 dark:hover:bg-sautuk-bg/10 transition-colors cursor-pointer group"
                >
                  {/* Title and features */}
                  <td className="py-4.5 px-6 max-w-md">
                    <div className="flex items-center gap-3 min-w-0 w-full">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (post.featured) {
                            toggleFeaturedMutation.mutate({ id: post.id, featured: false });
                          } else {
                            if (post.status !== 'PUBLISHED') {
                              addToast('केवल प्रकाशित लेख ही कैरोसेल पर पिन किए जा सकते हैं।', 'error');
                              return;
                            }
                            if (pinnedPosts.length >= 5) {
                              addToast('होमपेज कैरोसेल पर पहले से ही 5 लेख पिन हैं। नया लेख पिन करने के लिए किसी पुराने लेख को अनपिन करें।', 'error');
                              return;
                            }
                            toggleFeaturedMutation.mutate({ id: post.id, featured: true });
                          }
                        }}
                        disabled={toggleFeaturedMutation.isPending}
                        className={`flex items-center justify-center w-8 h-8 rounded-full border transition-all cursor-pointer disabled:opacity-50 shrink-0 ${
                          post.featured
                            ? 'bg-amber-50 border-amber-200/60 dark:bg-amber-950/20 dark:border-amber-900/30'
                            : 'bg-slate-50 dark:bg-sautuk-bg/15 border-slate-100 dark:border-sautuk-dark/10 hover:border-sautuk-accent/30'
                        }`}
                        title={post.featured ? 'कैरोसेल से अनपिन करें' : 'कैरोसेल पर पिन करें'}
                      >
                        {toggleFeaturedMutation.isPending && toggleFeaturedMutation.variables?.id === post.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-sautuk-accent" />
                        ) : post.featured ? (
                          <Star className="w-4 h-4 fill-amber-400 text-amber-500 shrink-0" />
                        ) : (
                          <FileText className="w-4 h-4 text-sautuk-muted shrink-0" />
                        )}
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-sautuk-dark leading-normal truncate py-0.5 group-hover:text-sautuk-accent transition-colors">
                          {post.title}
                        </div>
                        <div className="text-[11px] text-sautuk-muted font-mono mt-1 font-semibold truncate">
                          /{post.slug}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Category column */}
                  <td className="py-4.5 px-6">
                    {post.category ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-sautuk-cta bg-sautuk-cta/5 px-2.5 py-1 rounded-full border border-sautuk-cta/10">
                        <Tag className="w-3 h-3" />
                        {post.category.name}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400 font-semibold italic">बिना श्रेणी के</span>
                    )}
                  </td>

                  {/* Status Badge */}
                  <td className="py-4.5 px-6">
                    {post.status === 'PUBLISHED' ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/20 px-2.5 py-1 rounded-full border border-emerald-100 dark:border-emerald-900/30">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        प्रकाशित
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-50 dark:bg-amber-950/20 px-2.5 py-1 rounded-full border border-amber-100 dark:border-amber-900/30">
                        <FileEdit className="w-3.5 h-3.5" />
                        ड्राफ्ट
                      </span>
                    )}
                  </td>

                  {/* Views */}
                  <td className="py-4.5 px-6 text-xs text-sautuk-muted font-semibold" onClick={(e) => e.stopPropagation()}>
                    <span className="flex items-center gap-1">
                      <Eye className="w-3.5 h-3.5 text-sautuk-accent" />
                      {post.analytics?.reduce((sum: number, item: any) => sum + item.views, 0) || 0}
                    </span>
                  </td>

                  {/* Date */}
                  <td className="py-4.5 px-6 text-xs text-sautuk-muted font-semibold">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-sautuk-accent" />
                      {formatDate(post.createdAt)}
                    </span>
                  </td>

                  {/* Action buttons */}
                  <td className="py-4.5 px-6 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1.5">
                      {/* Preview page link */}
                      <a
                        href={`/posts/${post.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-sautuk-muted hover:text-sautuk-cta hover:bg-slate-100 dark:hover:bg-sautuk-bg/20 rounded-lg transition-colors cursor-pointer"
                        title="लेख देखें"
                      >
                        <Eye className="w-4 h-4" />
                      </a>

                      {/* Quick Status Toggle */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleStatusMutation.mutate({
                            id: post.id,
                            status: post.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED'
                          });
                        }}
                        disabled={toggleStatusMutation.isPending}
                        className={`p-2 rounded-lg transition-colors cursor-pointer ${
                          post.status === 'PUBLISHED' 
                            ? 'text-sautuk-muted hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/20' 
                            : 'text-sautuk-muted hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20'
                        }`}
                        title={post.status === 'PUBLISHED' ? 'प्रकाशन रोकें (ड्राफ्ट बनाएं)' : 'लाइव प्रकाशित करें'}
                      >
                        {toggleStatusMutation.isPending && toggleStatusMutation.variables?.id === post.id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-sautuk-accent" />
                        ) : post.status === 'PUBLISHED' ? (
                          <Archive className="w-4 h-4" />
                        ) : (
                          <Globe className="w-4 h-4" />
                        )}
                      </button>

                      {/* Delete post action */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(post.id, post.title);
                        }}
                        disabled={deleteMutation.isPending && deleteMutation.variables === post.id}
                        className="p-2 text-sautuk-muted hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                        title="लेख हटाएं"
                      >
                        {deleteMutation.isPending && deleteMutation.variables === post.id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-red-500" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Header and Add Action */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-white dark:bg-sautuk-card border border-sautuk-dark/5 p-6 rounded-3xl shadow-sm">
        <div>
          <h2 className="font-display font-black text-xl text-sautuk-dark">पत्रिका प्रकाशन</h2>
          <p className="text-xs text-sautuk-muted mt-0.5">कॉलम लिखें, ड्राफ्ट की समीक्षा करें और मुख्य पृष्ठ की विशेषताओं को कॉन्फ़िगर करें</p>
        </div>
        <button
          onClick={onCreateClick}
          className="flex items-center justify-center gap-1.5 bg-sautuk-dark dark:bg-sautuk-accent text-sautuk-bg hover:opacity-90 hover:scale-[1.03] active:scale-95 font-bold px-6 py-3 rounded-full text-xs transition-all shadow-md cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          नया लेख लिखें
        </button>
      </div>

      {/* Grid list or empty status */}
      {!posts || posts.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-sautuk-card border border-dashed border-slate-200 dark:border-sautuk-dark/15 rounded-3xl p-8">
          <FileText className="w-12 h-12 text-sautuk-muted/30 mx-auto mb-4" />
          <h3 className="font-display font-bold text-lg text-sautuk-dark">कोई लेख नहीं मिला</h3>
          <p className="text-xs text-sautuk-muted max-w-sm mx-auto mt-1 mb-6">
            जलवायु, राजनीति या अर्थशास्त्र पर अपना पहला लेख बनाकर शुरुआत करें।
          </p>
          <button
            onClick={onCreateClick}
            className="bg-sautuk-dark/5 text-sautuk-dark font-bold px-6 py-2.5 rounded-full text-xs hover:bg-sautuk-dark/10 transition-colors"
          >
            पहला लेख बनाएं
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Draft Columns Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="font-display font-black text-base text-sautuk-dark flex items-center gap-2">
                <span>ड्राफ्ट और सहेजे नहीं गए लेख</span>
                <span className="text-xs bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 font-bold px-2 py-0.5 rounded-full border border-amber-100 dark:border-amber-900/30">
                  {draftPosts.length}
                </span>
              </h3>
            </div>
            {renderPostTable(draftPosts, true)}
          </div>

          {/* Published Columns Section */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-1">
              <h3 className="font-display font-black text-base text-sautuk-dark flex items-center gap-2 shrink-0">
                <span>प्रकाशित लेख</span>
                <span className="text-xs bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 font-bold px-2 py-0.5 rounded-full border border-emerald-100 dark:border-emerald-900/30">
                  {filteredPublished.length}
                </span>
              </h3>

              {/* Search and Page Size controls */}
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <input
                  type="text"
                  value={pubSearch}
                  onChange={(e) => {
                    setPubSearch(e.target.value);
                    setPubPage(1);
                  }}
                  placeholder="प्रकाशित लेख खोजें..."
                  className="w-full sm:w-60 bg-slate-50 dark:bg-sautuk-bg/15 border border-slate-200 dark:border-sautuk-dark/15 text-sautuk-dark text-xs rounded-xl px-4 py-2.5 outline-none focus:border-sautuk-accent/60 transition-all font-semibold placeholder-sautuk-dark/40"
                />

                <Dropdown
                  value={String(pubPageSize)}
                  onChange={(val) => {
                    setPubPageSize(Number(val));
                    setPubPage(1);
                  }}
                  options={[
                    { value: '5', label: '5 लेख' },
                    { value: '10', label: '10 लेख' },
                    { value: '15', label: '15 लेख' },
                    { value: '20', label: '20 लेख' },
                    { value: '25', label: '25 लेख' }
                  ]}
                  className="w-32 shrink-0"
                  buttonClassName="pl-4 pr-3.5 py-2.5 text-xs"
                />
              </div>
            </div>

            {renderPostTable(paginatedPublished, false)}

            {/* Pagination Controls */}
            {totalPubPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-sautuk-card border border-sautuk-dark/5 px-6 py-4 rounded-3xl shadow-sm text-xs font-bold text-sautuk-dark">
                <span>
                  पृष्ठ {activePubPage} / {totalPubPages} (कुल {filteredPublished.length} लेख)
                </span>
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    onClick={() => setPubPage((prev) => Math.max(prev - 1, 1))}
                    disabled={activePubPage === 1}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-sautuk-dark/15 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed"
                  >
                    पिछला
                  </button>
                  <button
                    onClick={() => setPubPage((prev) => Math.min(prev + 1, totalPubPages))}
                    disabled={activePubPage === totalPubPages}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-sautuk-dark/15 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed"
                  >
                    अगला
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Pinned Carousel Articles widget */}
          <div className="bg-white dark:bg-sautuk-card border border-sautuk-dark/5 p-6 rounded-3xl shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-sautuk-dark/15 pb-3">
              <h3 className="font-display font-black text-sm text-sautuk-dark flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-500 fill-amber-500 animate-pulse" />
                <span>होमपेज कैरोसेल पर पिन किए गए लेख ({pinnedPosts.length} / 5)</span>
              </h3>
              <span className="text-[10px] font-bold text-sautuk-muted uppercase tracking-wider">अधिकतम 5 लेख</span>
            </div>

            {pinnedPosts.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-xs text-sautuk-muted italic font-semibold">कोई भी लेख कैरोसेल पर पिन नहीं किया गया है। कैरोसेल खाली है।</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pinnedPosts.map((post: any) => (
                  <div 
                    key={post.id} 
                    className="flex items-center gap-3 bg-slate-50 dark:bg-sautuk-bg/10 border border-slate-200 dark:border-sautuk-dark/15 p-3 rounded-2xl relative group"
                  >
                    {post.featuredImage ? (
                      <img 
                        src={post.featuredImage} 
                        alt={post.title} 
                        className="w-12 h-12 rounded-xl object-cover border border-sautuk-dark/10 shrink-0" 
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-sautuk-accent/10 flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5 text-sautuk-accent" />
                      </div>
                    )}
                    <div className="flex-grow min-w-0 pr-6">
                      {post.category && (
                        <span className="text-[9px] font-bold text-sautuk-accent uppercase tracking-wider block mb-0.5">
                          {post.category.name}
                        </span>
                      )}
                      <h4 className="text-xs font-bold text-sautuk-dark truncate leading-snug">
                        {post.title}
                      </h4>
                    </div>
                    <button
                      onClick={() => toggleFeaturedMutation.mutate({ id: post.id, featured: false })}
                      disabled={toggleFeaturedMutation.isPending}
                      className="absolute right-3 top-3.5 p-1.5 rounded-lg text-sautuk-muted hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all cursor-pointer disabled:opacity-50"
                      title="कैरोसेल से अनपिन करें"
                    >
                      <PinOff className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
