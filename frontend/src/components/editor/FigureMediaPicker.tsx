import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../services/api';
import { imageUrl } from './ArticleFigure';

interface MediaItem { id: string; filename: string; url: string }
interface MediaPage { items: MediaItem[]; nextCursor: string | null }

export default function FigureMediaPicker({ onSelect, onClose }: {
  onSelect: (src: string, filename: string) => void; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const queryClient = useQueryClient();
  const uploadRequest = useRef<AbortController | null>(null);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const cursor = cursors[cursors.length - 1];
  const media = useQuery<MediaPage>({
    queryKey: ['figure-media', query, cursor],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams({ limit: '24', search: query });
      if (cursor) params.set('cursor', cursor);
      const res = await apiFetch(`/media?${params}`, { signal });
      if (!res.ok) throw new Error('मीडिया संग्रह लोड नहीं हुआ।');
      return res.json();
    },
    staleTime: 30_000,
  });
  useEffect(() => {
    dialog.current?.showModal();
    return () => { uploadRequest.current?.abort(); };
  }, []);
  const upload = async (file?: File) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type) || file.size > 10 * 1024 * 1024) {
      setError('JPG, PNG, WebP या GIF चुनें (अधिकतम 10 MB)।'); return;
    }
    const request = new AbortController();
    uploadRequest.current = request;
    setUploading(true); setError('');
    try {
      const body = new FormData(); body.append('file', file);
      const res = await apiFetch('/media/upload', { method: 'POST', body, signal: request.signal });
      if (!res.ok) throw new Error('छवि अपलोड नहीं हुई। फिर से प्रयास करें।');
      const data = await res.json();
      if (!imageUrl(data.url)) throw new Error('छवि का URL सही नहीं है।');
      if (!request.signal.aborted) {
        void queryClient.invalidateQueries({ queryKey: ['figure-media'] });
        onSelect(data.url, file.name);
      }
    } catch (err) {
      if (!request.signal.aborted) setError(err instanceof Error ? err.message : 'छवि अपलोड नहीं हुई।');
    } finally { if (!request.signal.aborted) setUploading(false); }
  };
  return createPortal(
    <dialog ref={dialog} className="figure-media-picker" aria-labelledby="figure-picker-title" onCancel={onClose}>
      <div className="figure-picker-header">
        <div><h2 id="figure-picker-title">लेख में चित्र जोड़ें</h2><p>पुराना अपलोड चुनें या नया चित्र अपलोड करें।</p></div>
        <button type="button" onClick={onClose} aria-label="चित्र संग्रह बंद करें">✕</button>
      </div>
      <div className="figure-picker-tools">
        <form onSubmit={e => { e.preventDefault(); setQuery(search.trim()); setCursors([undefined]); }}>
          <input aria-label="फ़ाइल नाम से चित्र खोजें" placeholder="फ़ाइल नाम से खोजें…" maxLength={120} value={search} onChange={e => setSearch(e.target.value)} />
          <button type="submit">खोजें</button>
        </form>
        <label className="figure-upload-button">{uploading ? 'अपलोड हो रहा है…' : 'नया चित्र अपलोड करें'}
          <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={uploading} aria-label="नया चित्र अपलोड करें" onChange={e => { void upload(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
      </div>
      {error && <p role="alert">{error}</p>}
      {media.isPending && <p role="status">चित्र लोड हो रहे हैं…</p>}
      {media.isError && <p role="alert">मीडिया संग्रह लोड नहीं हुआ। <button type="button" onClick={() => void media.refetch()}>फिर से प्रयास करें</button></p>}
      {media.data?.items.length === 0 && <p>कोई चित्र नहीं मिला। नया चित्र अपलोड करें या खोज बदलें।</p>}
      <div className="figure-media-grid">
        {media.data?.items.filter(item => imageUrl(item.url)).map(item => <button type="button" key={item.id} disabled={uploading} onClick={() => onSelect(item.url, item.filename)}>
          <img src={item.url} alt="" loading="lazy" /><span>{item.filename}</span>
        </button>)}
      </div>
      <div className="figure-picker-pagination">
        <button type="button" disabled={cursors.length === 1 || media.isFetching || uploading} onClick={() => setCursors(cursors.slice(0, -1))}>पिछला पृष्ठ</button>
        <span>पृष्ठ {cursors.length}</span>
        <button type="button" disabled={!media.data?.nextCursor || media.isFetching || uploading} onClick={() => setCursors([...cursors, media.data!.nextCursor!])}>अगला पृष्ठ</button>
      </div>
    </dialog>, document.body,
  );
}
