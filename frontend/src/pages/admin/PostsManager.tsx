import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  FileText, Star, Plus, Edit2, Trash2, Eye, 
  Loader2, AlertCircle, Calendar, Tag, CheckCircle2, FileEdit
} from 'lucide-react';
import { getPosts, deletePost } from '../../services/api';

interface PostsManagerProps {
  onCreateClick: () => void;
  onEditClick: (id: string) => void;
}

export default function PostsManager({ onCreateClick, onEditClick }: PostsManagerProps) {
  const queryClient = useQueryClient();

  // Query to fetch all posts (admin defaults to fetching drafts + published)
  const { data: posts, isLoading, isError, error } = useQuery({
    queryKey: ['admin-posts'],
    queryFn: () => getPosts(),
  });

  // Mutation to delete a post
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deletePost(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-posts'] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
    },
  });

  const handleDelete = (id: string, title: string) => {
    if (confirm(`Are you sure you want to delete the post "${title}"? This action is permanent.`)) {
      deleteMutation.mutate(id);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
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

  return (
    <div className="space-y-6">
      {/* Header and Add Action */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-white dark:bg-sautuk-card border border-sautuk-dark/5 p-6 rounded-3xl shadow-sm">
        <div>
          <h2 className="font-display font-black text-xl text-sautuk-dark">Journal Publications</h2>
          <p className="text-xs text-sautuk-muted mt-0.5">Write columns, review drafts, and configure front-page features</p>
        </div>
        <button
          onClick={onCreateClick}
          className="flex items-center justify-center gap-1.5 bg-sautuk-dark dark:bg-sautuk-accent text-sautuk-bg hover:opacity-90 hover:scale-[1.03] active:scale-95 font-bold px-6 py-3 rounded-full text-xs transition-all shadow-md cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          New Column Article
        </button>
      </div>

      {/* Grid list or empty status */}
      {!posts || posts.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-sautuk-card border border-dashed border-slate-200 dark:border-sautuk-dark/15 rounded-3xl p-8">
          <FileText className="w-12 h-12 text-sautuk-muted/30 mx-auto mb-4" />
          <h3 className="font-display font-bold text-lg text-sautuk-dark">No publications found</h3>
          <p className="text-xs text-sautuk-muted max-w-sm mx-auto mt-1 mb-6">
            Get started by creating your first journalistic piece on climate, politics, or economics.
          </p>
          <button
            onClick={onCreateClick}
            className="bg-sautuk-dark/5 text-sautuk-dark font-bold px-6 py-2.5 rounded-full text-xs hover:bg-sautuk-dark/10 transition-colors"
          >
            Create Initial Post
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-sautuk-card border border-sautuk-dark/5 rounded-3xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-slate-50 dark:bg-sautuk-bg/10 border-b border-slate-100 dark:border-sautuk-dark/15 text-xs font-bold uppercase tracking-wider text-sautuk-muted">
                  <th className="py-4 px-6">Article Info</th>
                  <th className="py-4 px-6">Category</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6">Created Date</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-sautuk-dark/15 text-sm">
                {posts.map((post: any) => (
                  <tr key={post.id} className="hover:bg-slate-50/50 dark:hover:bg-sautuk-bg/10 transition-colors">
                    {/* Title and features */}
                    <td className="py-4.5 px-6 max-w-md">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5" title={post.featured ? "Featured Carousel Post" : undefined}>
                          {post.featured ? (
                            <Star className="w-4 h-4 fill-amber-400 text-amber-500 shrink-0" />
                          ) : (
                            <FileText className="w-4 h-4 text-sautuk-muted shrink-0" />
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-sautuk-dark leading-tight line-clamp-1">
                            {post.title}
                          </div>
                          <div className="text-[11px] text-sautuk-muted font-mono mt-1 font-semibold">
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
                        <span className="text-xs text-slate-400 font-semibold italic">Uncategorized</span>
                      )}
                    </td>

                    {/* Status Badge */}
                    <td className="py-4.5 px-6">
                      {post.status === 'PUBLISHED' ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Published
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-100">
                          <FileEdit className="w-3.5 h-3.5" />
                          Draft
                        </span>
                      )}
                    </td>

                    {/* Date */}
                    <td className="py-4.5 px-6 text-xs text-sautuk-muted font-semibold">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-sautuk-accent" />
                        {formatDate(post.createdAt)}
                      </span>
                    </td>

                    {/* Action buttons */}
                    <td className="py-4.5 px-6 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Preview page link (only active if published, or routes to preview) */}
                        <a
                          href={`/posts/${post.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-sautuk-muted hover:text-sautuk-cta hover:bg-slate-100 dark:hover:bg-sautuk-bg/20 rounded-lg transition-colors cursor-pointer"
                          title="Open Post View"
                        >
                          <Eye className="w-4 h-4" />
                        </a>

                        {/* Edit post action */}
                        <button
                          onClick={() => onEditClick(post.id)}
                          className="p-2 text-sautuk-muted hover:text-sautuk-accent hover:bg-slate-100 dark:hover:bg-sautuk-bg/20 rounded-lg transition-colors cursor-pointer"
                          title="Edit Article Content"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        {/* Delete post action */}
                        <button
                          onClick={() => handleDelete(post.id, post.title)}
                          disabled={deleteMutation.isPending && deleteMutation.variables === post.id}
                          className="p-2 text-sautuk-muted hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                          title="Delete Post"
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
      )}
    </div>
  );
}
