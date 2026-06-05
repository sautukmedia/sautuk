import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../services/api';
import { Plus, Edit2, Trash2, Check, X, Loader2, Tag as TagIcon, FolderOpen, AlertCircle } from 'lucide-react';

interface TaxonomyItem {
  id: string;
  name: string;
  slug: string;
}

export default function CategoriesTagsManager() {
  const queryClient = useQueryClient();
  const [catName, setCatName] = useState('');
  const [catSlug, setCatSlug] = useState('');
  const [tagName, setTagName] = useState('');
  const [tagSlug, setTagSlug] = useState('');

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editSlug, setEditSlug] = useState('');
  const [editType, setEditType] = useState<'category' | 'tag' | null>(null);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Queries
  const { data: categories = [], isLoading: loadingCats } = useQuery<TaxonomyItem[]>({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await apiFetch('/categories');
      return res.json();
    },
  });

  const { data: tags = [], isLoading: loadingTags } = useQuery<TaxonomyItem[]>({
    queryKey: ['tags'],
    queryFn: async () => {
      const res = await apiFetch('/tags');
      return res.json();
    },
  });

  // Mutators
  const createMutation = useMutation({
    mutationFn: async ({ type, name, slug }: { type: 'categories' | 'tags'; name: string; slug?: string }) => {
      const res = await apiFetch(`/${type}`, {
        method: 'POST',
        body: JSON.stringify({ name, slug }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Creation failed');
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [variables.type] });
      if (variables.type === 'categories') {
        setCatName('');
        setCatSlug('');
      } else {
        setTagName('');
        setTagSlug('');
      }
      setErrorMsg(null);
    },
    onError: (err) => {
      setErrorMsg(err.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ type, id, name, slug }: { type: 'categories' | 'tags'; id: string; name: string; slug: string }) => {
      const res = await apiFetch(`/${type}/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name, slug }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Update failed');
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [variables.type] });
      cancelEdit();
      setErrorMsg(null);
    },
    onError: (err) => {
      setErrorMsg(err.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ type, id }: { type: 'categories' | 'tags'; id: string }) => {
      const res = await apiFetch(`/${type}/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Deletion failed');
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [variables.type] });
      setErrorMsg(null);
    },
    onError: (err) => {
      setErrorMsg(err.message);
    },
  });

  const startEdit = (item: TaxonomyItem, type: 'category' | 'tag') => {
    setEditingId(item.id);
    setEditName(item.name);
    setEditSlug(item.slug);
    setEditType(type);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditSlug('');
    setEditType(null);
  };

  const saveEdit = (id: string) => {
    if (!editType) return;
    const type = editType === 'category' ? 'categories' : 'tags';
    updateMutation.mutate({ type, id, name: editName, slug: editSlug });
  };

  return (
    <div className="space-y-6">
      {/* Alert Error Box */}
      {errorMsg && (
        <div className="bg-sautuk-cta/15 border border-sautuk-cta/25 text-sautuk-cta text-xs rounded-2xl p-4 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
          <button className="ml-auto text-sautuk-cta font-bold hover:underline text-[10px] uppercase" onClick={() => setErrorMsg(null)}>
            Dismiss
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Categories Section */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-sautuk-dark/5">
          <div className="flex items-center gap-2 text-sautuk-dark mb-4 pb-2 border-b border-slate-100">
            <FolderOpen className="w-5 h-5 text-sautuk-accent" />
            <h3 className="font-display font-black text-lg">Category Taxonomy</h3>
          </div>

          {/* Quick Create Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate({ type: 'categories', name: catName, slug: catSlug });
            }}
            className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6 bg-slate-50 p-4 rounded-2xl border border-slate-100"
          >
            <div className="md:col-span-1">
              <input
                type="text"
                required
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                placeholder="Category Name"
                className="w-full bg-white border border-slate-200 text-sautuk-dark text-xs rounded-xl px-3 py-2.5 outline-none focus:border-sautuk-accent"
              />
            </div>
            <div className="md:col-span-1">
              <input
                type="text"
                value={catSlug}
                onChange={(e) => setCatSlug(e.target.value)}
                placeholder="slug-optional"
                className="w-full bg-white border border-slate-200 text-sautuk-dark text-xs rounded-xl px-3 py-2.5 outline-none focus:border-sautuk-accent"
              />
            </div>
            <button
              type="submit"
              disabled={createMutation.isPending && createMutation.variables?.type === 'categories'}
              className="w-full bg-sautuk-dark text-white font-bold py-2.5 rounded-xl hover:bg-sautuk-dark/90 text-xs transition-colors flex justify-center items-center gap-1 disabled:opacity-50"
            >
              {createMutation.isPending && createMutation.variables?.type === 'categories' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
              Add Category
            </button>
          </form>

          {/* Categories Table/List */}
          {loadingCats ? (
            <div className="text-center py-8 text-sautuk-muted text-xs flex justify-center items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-sautuk-accent" /> Loading categories...
            </div>
          ) : categories.length === 0 ? (
            <div className="text-center py-8 text-sautuk-muted text-xs">No categories found. Create one above.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-sautuk-muted font-bold">
                    <th className="py-2.5 px-2">Name</th>
                    <th className="py-2.5 px-2">Slug URL</th>
                    <th className="py-2.5 px-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 font-medium">
                  {categories.map((cat) => (
                    <tr key={cat.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-2">
                        {editingId === cat.id && editType === 'category' ? (
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="bg-white border border-slate-200 rounded px-2 py-1 outline-none text-xs w-full max-w-[120px]"
                          />
                        ) : (
                          <span className="text-sautuk-dark font-bold">{cat.name}</span>
                        )}
                      </td>
                      <td className="py-3 px-2">
                        {editingId === cat.id && editType === 'category' ? (
                          <input
                            type="text"
                            value={editSlug}
                            onChange={(e) => setEditSlug(e.target.value)}
                            className="bg-white border border-slate-200 rounded px-2 py-1 outline-none text-xs w-full max-w-[120px]"
                          />
                        ) : (
                          <span className="text-sautuk-muted font-mono">{cat.slug}</span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-right">
                        {editingId === cat.id && editType === 'category' ? (
                          <div className="flex gap-1.5 justify-end">
                            <button
                              onClick={() => saveEdit(cat.id)}
                              className="text-emerald-600 hover:bg-emerald-50 p-1.5 rounded-lg transition-colors"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="text-slate-500 hover:bg-slate-100 p-1.5 rounded-lg transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-1 justify-end">
                            <button
                              onClick={() => startEdit(cat, 'category')}
                              className="text-slate-500 hover:text-sautuk-dark hover:bg-slate-100 p-1.5 rounded-lg transition-colors"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => deleteMutation.mutate({ type: 'categories', id: cat.id })}
                              disabled={deleteMutation.isPending && deleteMutation.variables?.id === cat.id}
                              className="text-sautuk-cta hover:bg-red-50 p-1.5 rounded-lg transition-colors disabled:opacity-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Tags Section */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-sautuk-dark/5">
          <div className="flex items-center gap-2 text-sautuk-dark mb-4 pb-2 border-b border-slate-100">
            <TagIcon className="w-5 h-5 text-sautuk-cta" />
            <h3 className="font-display font-black text-lg">Tag Taxonomy</h3>
          </div>

          {/* Quick Create Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate({ type: 'tags', name: tagName, slug: tagSlug });
            }}
            className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6 bg-slate-50 p-4 rounded-2xl border border-slate-100"
          >
            <div className="md:col-span-1">
              <input
                type="text"
                required
                value={tagName}
                onChange={(e) => setTagName(e.target.value)}
                placeholder="Tag Name"
                className="w-full bg-white border border-slate-200 text-sautuk-dark text-xs rounded-xl px-3 py-2.5 outline-none focus:border-sautuk-accent"
              />
            </div>
            <div className="md:col-span-1">
              <input
                type="text"
                value={tagSlug}
                onChange={(e) => setTagSlug(e.target.value)}
                placeholder="slug-optional"
                className="w-full bg-white border border-slate-200 text-sautuk-dark text-xs rounded-xl px-3 py-2.5 outline-none focus:border-sautuk-accent"
              />
            </div>
            <button
              type="submit"
              disabled={createMutation.isPending && createMutation.variables?.type === 'tags'}
              className="w-full bg-sautuk-dark text-white font-bold py-2.5 rounded-xl hover:bg-sautuk-dark/90 text-xs transition-colors flex justify-center items-center gap-1 disabled:opacity-50"
            >
              {createMutation.isPending && createMutation.variables?.type === 'tags' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
              Add Tag
            </button>
          </form>

          {/* Tags Table/List */}
          {loadingTags ? (
            <div className="text-center py-8 text-sautuk-muted text-xs flex justify-center items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-sautuk-cta" /> Loading tags...
            </div>
          ) : tags.length === 0 ? (
            <div className="text-center py-8 text-sautuk-muted text-xs">No tags found. Create one above.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-sautuk-muted font-bold">
                    <th className="py-2.5 px-2">Name</th>
                    <th className="py-2.5 px-2">Slug URL</th>
                    <th className="py-2.5 px-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 font-medium">
                  {tags.map((tag) => (
                    <tr key={tag.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-2">
                        {editingId === tag.id && editType === 'tag' ? (
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="bg-white border border-slate-200 rounded px-2 py-1 outline-none text-xs w-full max-w-[120px]"
                          />
                        ) : (
                          <span className="text-sautuk-dark font-bold">{tag.name}</span>
                        )}
                      </td>
                      <td className="py-3 px-2">
                        {editingId === tag.id && editType === 'tag' ? (
                          <input
                            type="text"
                            value={editSlug}
                            onChange={(e) => setEditSlug(e.target.value)}
                            className="bg-white border border-slate-200 rounded px-2 py-1 outline-none text-xs w-full max-w-[120px]"
                          />
                        ) : (
                          <span className="text-sautuk-muted font-mono">{tag.slug}</span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-right">
                        {editingId === tag.id && editType === 'tag' ? (
                          <div className="flex gap-1.5 justify-end">
                            <button
                              onClick={() => saveEdit(tag.id)}
                              className="text-emerald-600 hover:bg-emerald-50 p-1.5 rounded-lg transition-colors"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="text-slate-500 hover:bg-slate-100 p-1.5 rounded-lg transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-1 justify-end">
                            <button
                              onClick={() => startEdit(tag, 'tag')}
                              className="text-slate-500 hover:text-sautuk-dark hover:bg-slate-100 p-1.5 rounded-lg transition-colors"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => deleteMutation.mutate({ type: 'tags', id: tag.id })}
                              disabled={deleteMutation.isPending && deleteMutation.variables?.id === tag.id}
                              className="text-sautuk-cta hover:bg-red-50 p-1.5 rounded-lg transition-colors disabled:opacity-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
