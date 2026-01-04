import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  ArrowLeft, Calendar, Share2, 
  Copy, Check, Volume2, VolumeX, Mail, Loader2, 
  AlertCircle, ChevronRight, Moon, Sun
} from 'lucide-react';
import { getPost, getPosts, apiFetch } from '../services/api';
import DOMPurify from 'dompurify';

const TwitterIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const LinkedinIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
  </svg>
);

export default function PostRead() {
  const { slug } = useParams<{ slug: string }>();
  const [copied, setCopied] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [subscribeMsg, setSubscribeMsg] = useState<string | null>(null);
  const [subscribeSuccess, setSubscribeSuccess] = useState(false);
  const viewLoggedRef = useRef<string | null>(null);
  
  // Theme state
  const [darkMode, setDarkMode] = useState(() => {
    return document.documentElement.classList.contains('dark');
  });

  // Sync theme
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Fetch the article details
  const { data: post, isLoading, isError } = useQuery({
    queryKey: ['post', slug],
    queryFn: () => getPost(slug || ''),
    enabled: !!slug,
    retry: 1,
  });

  // Trigger views tracking with a 1.5-second debounce on load
  useEffect(() => {
    if (!slug || !post) return;
    if (viewLoggedRef.current === post.id) return;

    const timer = setTimeout(() => {
      viewLoggedRef.current = post.id;
      apiFetch(`/posts/${post.id || slug}/view`, {
        method: 'POST',
      }).catch((err) => {
        console.error('Failed to log page view:', err);
      });
    }, 1500);

    return () => clearTimeout(timer);
  }, [slug, post]);

  // Fetch related posts from the same category
  const { data: relatedPosts } = useQuery({
    queryKey: ['related-posts', post?.categoryId],
    queryFn: () => getPosts({ status: 'PUBLISHED', categoryId: post?.categoryId }),
    enabled: !!post?.categoryId,
  });

  // Web Speech API Integration (Text-to-Speech)
  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  useEffect(() => {
    if (!('speechSynthesis' in window)) return;

    if (isPlaying && post) {
      // Cancel any ongoing speech
      window.speechSynthesis.cancel();

      // Clean up HTML syntax for better reading (since we migrated to ReactQuill WYSIWYG)
      let cleanContent = post.content
        .replace(/<\/p>|<br\s*\/?>/gi, '. ') // Add pauses at the end of paragraphs/breaks
        .replace(/<[^>]*>/g, '') // Remove all remaining HTML tags
        .replace(/&nbsp;/g, ' ') // Clean up HTML entities
        .replace(/\s+/g, ' ') // Collapse multiple spaces
        .trim();

      const textToRead = `${post.title}. ${cleanContent}`;
      
      const utterance = new SpeechSynthesisUtterance(textToRead);
      utterance.lang = 'hi-IN'; // Set to Hindi
      utterance.rate = 0.9;     // Slightly slower for better Hindi pronunciation
      
      // Reset button state when reading finishes or errors
      utterance.onend = () => setIsPlaying(false);
      utterance.onerror = () => setIsPlaying(false);

      window.speechSynthesis.speak(utterance);
    } else {
      // Stop playing if button is toggled off
      window.speechSynthesis.cancel();
    }
  }, [isPlaying, post]);


  // Format publication date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('hi-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Share action handlers
  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareTwitter = () => {
    if (!post) return;
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent(`"${post.title}" - सौतुक पर यह लेख पढ़ें`);
    window.open(`https://twitter.com/intent/tweet?url=${url}&text=${text}`, '_blank');
  };

  const handleShareLinkedin = () => {
    if (!post) return;
    const url = encodeURIComponent(window.location.href);
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${url}`, '_blank');
  };

  // Newsletter subscription handler
  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubscribeMsg(null);
    setSubscribeSuccess(false);

    try {
      const res = await apiFetch('/subscribers', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });

      const result = await res.json();
      setSubscribeMsg(result.message || 'Subscribed successfully!');
      
      if (res.ok) {
        setSubscribeSuccess(true);
        setEmail('');
      } else {
        setSubscribeSuccess(false);
      }
    } catch (err) {
      setSubscribeMsg('Network error. Please try again.');
      setSubscribeSuccess(false);
    } finally {
      setSubmitting(false);
    }
  };

  // Filter out the current post from related feed and take top 3
  const displayedRelated = relatedPosts
    ? relatedPosts.filter((rp: any) => rp.id !== post?.id).slice(0, 3)
    : [];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-sautuk-bg flex flex-col justify-center items-center text-sautuk-dark">
        <Loader2 className="w-10 h-10 animate-spin text-sautuk-accent mb-4" />
        <p className="font-semibold text-sm">Fetching article...</p>
      </div>
    );
  }

  if (isError || !post) {
    return (
      <div className="min-h-screen bg-sautuk-bg flex flex-col justify-center items-center text-sautuk-dark px-4 text-center">
        <AlertCircle className="w-16 h-16 text-sautuk-accent mb-6" />
        <h1 className="text-3xl font-display font-black tracking-tight mb-2">लेख नहीं मिला</h1>
        <p className="text-sautuk-muted max-w-md mb-8">
          अनुरोधित लेख अप्रकाशित, हटा दिया गया हो सकता है, या पता यूआरएल गलत टाइप किया गया हो सकता है।
        </p>
        <Link 
          to="/" 
          className="bg-sautuk-dark dark:bg-sautuk-accent text-sautuk-bg font-bold px-8 py-3.5 rounded-full hover:scale-105 transition-all shadow-md text-sm"
        >
          मुख्य पृष्ठ पर वापस जाएं
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-sautuk-bg font-sans selection:bg-sautuk-accent/30 flex flex-col">
      {/* Top Banner Navigation */}
      <header className="border-b border-sautuk-dark/10 bg-sautuk-bg/85 backdrop-blur-md sticky top-0 z-50 px-4 lg:px-8 py-4">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <Link to="/" className="p-2 rounded-full hover:bg-sautuk-dark/5 dark:hover:bg-white/5 text-sautuk-dark hover:text-sautuk-accent transition-colors" title="मुख्य पृष्ठ">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          
          <Link to="/" className="flex items-center gap-1">
            <span className="font-display text-xl font-black tracking-tight text-sautuk-dark">
              सौतुक<span className="text-sautuk-accent">.</span>
            </span>
          </Link>

          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2.5 rounded-full bg-sautuk-dark/5 dark:bg-white/5 hover:scale-105 transition-all text-sautuk-dark cursor-pointer"
            title="थीम बदलें"
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Reading Progress Indicator */}
      <div className="h-1 bg-sautuk-dark/5 sticky top-[69px] z-50 w-full">
        <div className="h-full bg-sautuk-accent transition-all duration-300" style={{ width: '100%' }}></div>
      </div>

      {/* Editorial Content Layout */}
      <main className="max-w-4xl mx-auto px-4 py-8 lg:py-16 w-full flex-grow flex flex-col">
        {/* Topic Accent Badge */}
        {post.category && (
          <div className="mb-4">
            <span className="inline-block bg-sautuk-accent text-white font-sans font-bold uppercase text-[10px] tracking-widest px-3.5 py-1.5 rounded-full shadow-sm">
              {post.category.name}
            </span>
          </div>
        )}

        {/* Headline Title */}
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-display font-black text-sautuk-dark tracking-tight leading-tight mb-6 font-serif">
          {post.title}
        </h1>

        {/* Excerpt Summary */}
        <p className="text-lg lg:text-xl text-sautuk-muted leading-relaxed font-sans font-medium mb-8 border-l-2 border-sautuk-accent/30 pl-4 py-1 italic">
          {post.excerpt}
        </p>

        {/* Meta Byline Details */}
        <div className="flex flex-row items-center justify-between border-y border-sautuk-dark/10 py-5 mb-8 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full overflow-hidden border border-sautuk-dark/5 shadow-inner bg-sautuk-accent/15 flex items-center justify-center shrink-0">
              {!avatarError ? (
                <img 
                  src="/kundan.jpg" 
                  onError={() => setAvatarError(true)} 
                  className="w-full h-full object-cover" 
                  alt="कुंदन पांडेय" 
                />
              ) : (
                <span className="font-bold text-sautuk-dark text-sm">क</span>
              )}
            </div>
            <div>
              <h4 className="font-bold text-sm text-sautuk-dark">कुंदन पांडेय</h4>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-semibold text-sautuk-muted shrink-0">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-sautuk-accent" /> {formatDate(post.createdAt)}
            </span>
          </div>
        </div>

        {/* Playback & Share Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8 bg-sautuk-card border border-sautuk-dark/5 p-4 rounded-2xl shadow-sm">
          {/* Audio Player Component Mock */}
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsPlaying(!isPlaying)}
              className={`flex items-center gap-2 px-4.5 py-2 rounded-full font-bold text-xs transition-all cursor-pointer ${
                isPlaying 
                  ? 'bg-sautuk-accent text-white shadow-md scale-105' 
                  : 'bg-sautuk-dark/5 dark:bg-white/5 text-sautuk-dark hover:bg-sautuk-dark/10'
              }`}
            >
              {isPlaying ? <VolumeX className="w-3.5 h-3.5 animate-bounce" /> : <Volume2 className="w-3.5 h-3.5" />}
              {isPlaying ? 'सुनना बंद करें' : 'लेख सुनें'}
            </button>
            {isPlaying && (
              <span className="text-[10px] text-sautuk-accent font-bold uppercase tracking-wider animate-pulse hidden sm:inline-block">
                एआई वॉयस एक्टिव
              </span>
            )}
          </div>

          {/* Social Toolbar */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase text-sautuk-dark/80 tracking-wider mr-2 flex items-center gap-1">
              <Share2 className="w-3.5 h-3.5" /> साझा करें
            </span>
            <button
              onClick={handleShareTwitter}
              className="p-2.5 rounded-full bg-sautuk-dark/5 dark:bg-white/5 text-sautuk-dark hover:bg-sautuk-dark/10 hover:text-sky-500 transition-all cursor-pointer"
              title="ट्विटर पर साझा करें"
            >
              <TwitterIcon className="w-4 h-4" />
            </button>
            <button
              onClick={handleShareLinkedin}
              className="p-2.5 rounded-full bg-sautuk-dark/5 dark:bg-white/5 text-sautuk-dark hover:bg-sautuk-dark/10 hover:text-blue-700 transition-all cursor-pointer"
              title="लिंक्डइन पर साझा करें"
            >
              <LinkedinIcon className="w-4 h-4" />
            </button>
            <button
              onClick={handleCopyLink}
              className="p-2.5 rounded-full bg-sautuk-dark/5 dark:bg-white/5 text-sautuk-dark hover:bg-sautuk-dark/10 transition-all relative cursor-pointer"
              title="लिंक कॉपी करें"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Featured Image */}
        {post.featuredImage && (
          <div className="w-full mb-10">
            <img 
              src={post.featuredImage} 
              alt={post.title} 
              className="rounded-3xl w-full max-h-[500px] object-cover shadow-md border border-sautuk-dark/5"
            />
          </div>
        )}

        {/* Main Article Body text */}
        <article 
          className="font-serif text-sautuk-dark text-lg leading-relaxed mb-16 max-w-3xl mx-auto prose prose-lg dark:prose-invert prose-headings:font-display prose-headings:font-black prose-p:font-sans prose-a:text-sautuk-accent max-w-none"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(post.content) }}
        />

        {/* Inline Subscribe Box */}
        <section className="bg-sautuk-card text-sautuk-dark rounded-3xl p-6 lg:p-10 mb-16 relative overflow-hidden shadow-lg border border-sautuk-dark/10">
          <div className="absolute -right-20 -bottom-20 w-60 h-60 rounded-full bg-sautuk-accent/10 blur-3xl"></div>
          <div className="relative z-10 max-w-2xl">
            <span className="inline-block bg-sautuk-accent/10 text-sautuk-accent font-sans font-bold uppercase text-[9px] tracking-widest px-3 py-1 rounded-full mb-3">
              पत्रिका न्यूज़लेटर
            </span>
            <h3 className="font-display font-black text-2xl lg:text-3xl text-sautuk-dark mb-2 leading-tight">
              अपने इनबॉक्स में विश्लेषण और अपडेट प्राप्त करें
            </h3>
            <p className="text-sautuk-dark/85 text-sm mb-6 leading-relaxed">
              हमारे न्यूज़लेटर के सदस्य बनें। हम जलवायु कार्रवाई, वैश्विक राजनीति, भू-राजनीति और सामाजिक-अर्थशास्त्र के संबंध में साप्ताहिक लेख और कॉलम भेजते हैं।
            </p>

            <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-3">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="अपना ईमेल पता दर्ज करें"
                className="bg-sautuk-dark/5 dark:bg-white/10 border border-transparent text-sautuk-dark rounded-full px-5 py-3 outline-none focus:border-sautuk-accent/40 focus:bg-sautuk-bg transition-all flex-grow text-sm font-semibold placeholder-sautuk-dark/40"
              />
              <button
                type="submit"
                disabled={submitting}
                className="bg-sautuk-dark dark:bg-sautuk-accent text-sautuk-bg font-bold px-6 py-3 rounded-full hover:scale-[1.02] active:scale-95 transition-all text-sm shadow-md shrink-0 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                सदस्य बनें
              </button>
            </form>

            {subscribeMsg && (
              <div className={`mt-4 text-xs font-bold ${subscribeSuccess ? 'text-emerald-700 dark:text-emerald-400' : 'text-sautuk-accent'}`}>
                {subscribeMsg}
              </div>
            )}
          </div>
        </section>

        {/* Related posts section */}
        {displayedRelated.length > 0 && (
          <section className="border-t border-sautuk-dark/10 pt-12">
            <h3 className="font-display font-black text-2xl text-sautuk-dark mb-8 tracking-tight">
              इस श्रेणी में आगे पढ़ें
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {displayedRelated.map((rp: any) => (
                <Link 
                  key={rp.id}
                  to={`/posts/${rp.slug}`}
                  className="group flex flex-col bg-sautuk-card border border-sautuk-dark/5 rounded-2xl overflow-hidden hover-lift p-4 shadow-sm"
                >
                  {rp.featuredImage && (
                    <div className="w-full aspect-[16/10] rounded-xl overflow-hidden mb-3.5">
                      <img 
                        src={rp.featuredImage} 
                        alt={rp.title} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    </div>
                  )}
                  <span className="text-[10px] font-bold text-sautuk-accent uppercase tracking-wider mb-1">
                    {rp.category?.name || 'Article'}
                  </span>
                  <h4 className="font-display font-black text-sm text-sautuk-dark leading-normal py-0.5 group-hover:text-sautuk-accent transition-colors line-clamp-2">
                    {rp.title}
                  </h4>
                  <p className="text-xs text-sautuk-dark/85 mt-2 line-clamp-2 leading-relaxed">
                    {rp.excerpt}
                  </p>
                  <span className="text-[10px] font-semibold text-sautuk-dark/80 mt-4 flex items-center gap-1 group-hover:underline">
                    पूरा लेख पढ़ें <ChevronRight className="w-3 h-3" />
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Footer copyright */}
      <footer className="border-t border-sautuk-dark/10 bg-sautuk-bg py-8 text-center text-xs text-sautuk-muted font-semibold">
        <p>© {new Date().getFullYear()} Sautuk Media. All rights reserved.</p>
      </footer>
    </div>
  );
}
