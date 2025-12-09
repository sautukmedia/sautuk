import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Loader2, Mail, CheckCircle, TrendingUp, Search,
  ChevronLeft, ChevronRight, BookOpen, Calendar,
  Moon, Sun, ShieldCheck
} from 'lucide-react';
import { getPosts, apiFetch } from '../services/api';

export default function Home() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [subscribeMsg, setSubscribeMsg] = useState<string | null>(null);
  const [subscribeSuccess, setSubscribeSuccess] = useState(false);

  // Filtering states
  const [activeCategorySlug, setActiveCategorySlug] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Carousel slider index
  const [carouselIndex, setCarouselIndex] = useState(0);

  // QOL: Limit feed visible items (defaults to 3, resets on filter/search changes)
  const [visibleLimit, setVisibleLimit] = useState(3);

  useEffect(() => {
    setVisibleLimit(3);
  }, [activeCategorySlug, debouncedSearch]);

  // Mobile check to apply feed scrolling limits
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch categories
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await apiFetch('/categories');
      return res.json();
    },
  });

  // Active Category ID helper
  const activeCategoryId = activeCategorySlug
    ? categories?.find((c: any) => c.slug === activeCategorySlug)?.id
    : undefined;

  // Fetch posts based on active filters
  const { data: posts, isLoading: isLoadingPosts } = useQuery({
    queryKey: ['posts', activeCategoryId, debouncedSearch],
    queryFn: () => getPosts({
      categoryId: activeCategoryId,
      q: debouncedSearch.trim() !== '' ? debouncedSearch : undefined
    }),
  });

  // Fetch featured posts specifically for the top carousel
  const { data: featuredPosts } = useQuery({
    queryKey: ['featured-posts'],
    queryFn: () => getPosts({ featured: true }),
  });

  // Fallback slides: if no featured posts, take the top 3 latest
  const carouselSlides = featuredPosts && featuredPosts.length > 0
    ? featuredPosts.slice(0, 5)
    : (posts ? posts.slice(0, 3) : []);

  // Carousel autoplay timer
  useEffect(() => {
    if (carouselSlides.length <= 1) return;
    const interval = setInterval(() => {
      setCarouselIndex(prev => (prev + 1) % carouselSlides.length);
    }, 7000);
    return () => clearInterval(interval);
  }, [carouselSlides]);

  // Handle subscriber submit
  const handleSubscribeSubmit = async (e: React.FormEvent) => {
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


  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('hi-IN', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Filter trending posts (based on analytics or just latest 4 posts)
  const trendingPosts = posts ? posts.slice(0, 4) : [];

  return (
    <div className="min-h-screen bg-sautuk-bg font-sans flex flex-col selection:bg-sautuk-accent/30">

      {/* Editorial Header */}
      <header className="border-b border-sautuk-dark/10 bg-sautuk-bg/85 backdrop-blur-md sticky top-0 z-50 px-4 lg:px-8 py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <BookOpen className="w-8 h-8 text-sautuk-accent" />
            <span className="font-display text-2xl lg:text-3xl font-serif font-black tracking-tight text-sautuk-dark">
              सौतुक<span className="text-sautuk-accent">.</span>
            </span>
          </Link>

          {/* Search bar & Dark mode toggles */}
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <div className="relative flex-grow sm:flex-grow-0">
              <Search className="absolute left-3.5 top-3 w-4 h-4 text-sautuk-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="लेख खोजें..."
                className="w-full sm:w-64 bg-sautuk-dark/5 dark:bg-white/10 border border-transparent text-sautuk-dark text-xs rounded-full pl-10 pr-4 py-2.5 outline-none focus:border-sautuk-accent/40 focus:bg-sautuk-bg transition-all font-semibold"
              />
            </div>

            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2.5 rounded-full bg-sautuk-dark/5 dark:bg-white/5 hover:scale-105 transition-all text-sautuk-dark cursor-pointer"
              title="Toggle theme"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 lg:px-8 py-8 flex-grow w-full space-y-8">

        {/* Dynamic Carousel Slideshow */}
        {carouselSlides && carouselSlides.length > 0 && (
          <div className="relative h-[480px] w-full rounded-3xl overflow-hidden shadow-lg border border-sautuk-dark/5 bg-sautuk-dark group">
            {carouselSlides.map((slide: any, idx: number) => {
              const isActive = idx === carouselIndex;
              return (
                <div
                  key={slide.id}
                  className={`absolute inset-0 w-full h-full transition-opacity duration-1000 flex flex-col justify-end ${isActive ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
                    }`}
                >
                  {/* Background Image overlay */}
                  {slide.featuredImage ? (
                    <img
                      src={slide.featuredImage}
                      alt={slide.title}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-tr from-sautuk-dark to-sautuk-card/40"></div>
                  )}
                  {/* Gradient shadow overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent"></div>

                  {/* Content over slide */}
                  <div className="relative z-10 p-6 lg:p-12 max-w-4xl text-white">
                    {slide.category && (
                      <span className="inline-block bg-sautuk-accent text-white font-sans font-bold uppercase text-[9px] tracking-widest px-3 py-1 rounded-full mb-3.5 shadow-sm">
                        {slide.category.name}
                      </span>
                    )}
                    <Link
                      to={`/posts/${slide.slug}`}
                      className="block hover:underline"
                    >
                      <h2 className="text-2xl sm:text-4xl lg:text-5xl font-display font-black tracking-tight leading-tight mb-4 font-serif">
                        {slide.title}
                      </h2>
                    </Link>
                    <p className="text-slate-200 text-sm lg:text-base leading-relaxed mb-6 max-w-2xl line-clamp-2">
                      {slide.excerpt}
                    </p>

                    <div className="flex items-center gap-4 text-xs font-semibold text-slate-300">
                      <span>सौतुक संपादकीय</span>
                      <span>•</span>
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {formatDate(slide.createdAt)}</span>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Slider arrows */}
            {carouselSlides.length > 1 && (
              <>
                <button
                  onClick={() => setCarouselIndex(prev => (prev - 1 + carouselSlides.length) % carouselSlides.length)}
                  className="absolute left-4 top-1/2 -translate-y-1/2 z-20 p-2.5 rounded-full bg-black/40 hover:bg-black/60 text-white cursor-pointer hover:scale-105 transition-all opacity-0 group-hover:opacity-100"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setCarouselIndex(prev => (prev + 1) % carouselSlides.length)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-2.5 rounded-full bg-black/40 hover:bg-black/60 text-white cursor-pointer hover:scale-105 transition-all opacity-0 group-hover:opacity-100"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </>
            )}

            {/* Indicator dots */}
            {carouselSlides.length > 1 && (
              <div className="absolute bottom-4 right-6 lg:right-12 z-20 flex gap-2">
                {carouselSlides.map((_: any, idx: number) => (
                  <button
                    key={idx}
                    onClick={() => setCarouselIndex(idx)}
                    className={`w-2.5 h-2.5 rounded-full transition-all ${idx === carouselIndex ? 'bg-sautuk-accent w-6' : 'bg-white/40'
                      }`}
                  ></button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Mobile Swipeable Category ribbon */}
        <div className="border-b border-sautuk-dark/10 pb-4">
          <div className="flex gap-2.5 overflow-x-auto no-scrollbar py-1">
            <button
              onClick={() => setActiveCategorySlug(null)}
              className={`text-xs font-bold uppercase tracking-wider px-5 py-2.5 rounded-full transition-all cursor-pointer shrink-0 border ${activeCategorySlug === null
                  ? 'bg-sautuk-dark border-sautuk-dark text-sautuk-bg shadow-md'
                  : 'bg-sautuk-card/30 dark:bg-sautuk-card/10 border-sautuk-dark/5 text-sautuk-dark/80 hover:border-sautuk-accent/30'
                }`}
            >
              सभी लेख
            </button>
            {categories?.map((cat: any) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategorySlug(cat.slug)}
                className={`text-xs font-bold uppercase tracking-wider px-5 py-2.5 rounded-full transition-all cursor-pointer shrink-0 border ${activeCategorySlug === cat.slug
                    ? 'bg-sautuk-dark border-sautuk-dark text-sautuk-bg shadow-md'
                    : 'bg-sautuk-card/30 dark:bg-sautuk-card/10 border-sautuk-dark/5 text-sautuk-dark/80 hover:border-sautuk-accent/30'
                  }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Home Feed Columns Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Main Feed Column */}
          <div className="lg:col-span-2 space-y-6">
            <h3 className="font-display font-black text-xl text-sautuk-dark tracking-tight leading-tight">
              {activeCategorySlug
                ? `${categories?.find((c: any) => c.slug === activeCategorySlug)?.name} श्रेणी के लेख`
                : debouncedSearch.trim() !== '' ? `"${debouncedSearch}" के लिए खोज परिणाम` : 'नवीनतम लेख'}
            </h3>

            {isLoadingPosts ? (
              <div className="flex flex-col justify-center items-center py-20 text-sautuk-dark bg-sautuk-card rounded-3xl p-8 shadow-sm border border-sautuk-dark/5">
                <Loader2 className="w-8 h-8 animate-spin text-sautuk-accent mb-3" />
                <p className="text-sm font-semibold">लेख लोड हो रहे हैं...</p>
              </div>
            ) : !posts || posts.length === 0 ? (
              <div className="text-center py-16 bg-sautuk-card border border-sautuk-dark/10 rounded-3xl p-8">
                <BookOpen className="w-12 h-12 text-sautuk-dark/40 mx-auto mb-4" />
                <h4 className="font-display font-bold text-lg text-sautuk-dark">कोई लेख नहीं मिला</h4>
                <p className="text-xs text-sautuk-dark/70 max-w-sm mx-auto mt-1">
                  इस विषय से संबंधित कोई लेख उपलब्ध नहीं है। कृपया जल्द ही देखें।
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {(isMobile ? posts.slice(0, visibleLimit) : posts).map((post: any) => (
                  <Link
                    key={post.id}
                    to={`/posts/${post.slug}`}
                    className="group block bg-sautuk-card border border-sautuk-dark/5 rounded-3xl p-6 shadow-sm hover-lift"
                  >
                    <div className="flex flex-col md:flex-row md:items-center gap-6">
                      {/* Image representation */}
                      {post.featuredImage && (
                        <div className="w-full md:w-56 aspect-[16/10] md:h-36 rounded-2xl overflow-hidden shrink-0 border border-sautuk-dark/10">
                          <img
                            src={post.featuredImage}
                            alt={post.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        </div>
                      )}

                      {/* Content block */}
                      <div className="flex flex-col justify-between flex-grow">
                        <div>
                          {post.category && (
                            <span className="text-[10px] font-bold text-sautuk-accent uppercase tracking-wider mb-2 block">
                              {post.category.name}
                            </span>
                          )}
                          <h4 className="font-display font-black text-lg sm:text-xl text-sautuk-dark leading-snug group-hover:text-sautuk-accent transition-colors font-serif">
                            {post.title}
                          </h4>
                          <p className="text-xs lg:text-sm text-sautuk-dark/85 mt-2 line-clamp-2 leading-relaxed">
                            {post.excerpt}
                          </p>
                        </div>

                        <div className="flex items-center gap-3 text-[10px] font-bold text-sautuk-dark/60 uppercase tracking-wider mt-4">
                          <span className="flex items-center gap-1"><Calendar className="w-3 h-3 text-sautuk-accent" /> {formatDate(post.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}

                {isMobile && posts.length > visibleLimit && (
                  <div className="flex justify-center pt-2">
                    <button
                      onClick={() => setVisibleLimit(prev => prev + 3)}
                      className="bg-sautuk-dark dark:bg-sautuk-accent text-sautuk-bg hover:opacity-90 hover:scale-[1.02] active:scale-95 transition-all text-xs font-bold px-6 py-3 rounded-full cursor-pointer shadow-md"
                    >
                      और लेख देखें
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar Widgets Column */}
          <div className="space-y-5 lg:sticky lg:top-[90px] lg:self-start lg:max-h-[calc(100vh-120px)] lg:overflow-y-auto no-scrollbar pb-8">

            {/* Recommended Columns Articles */}
            <div className="bg-sautuk-card rounded-3xl p-5 shadow-sm border border-sautuk-dark/5">
              <div className="flex items-center gap-2 text-sautuk-accent mb-3 font-bold text-xs uppercase tracking-wider border-b border-sautuk-dark/10 pb-2.5">
                <TrendingUp className="w-4 h-4" /> सुझाए गए लेख
              </div>

              {!trendingPosts || trendingPosts.length === 0 ? (
                <p className="text-xs text-sautuk-dark/70 italic text-center py-4">कोई सामग्री उपलब्ध नहीं है।</p>
              ) : (
                <div className="space-y-3">
                  {trendingPosts.map((tp: any, index: number) => (
                    <div key={tp.id} className="flex gap-3 items-start border-b border-sautuk-dark/10 last:border-0 pb-2.5 last:pb-0">
                      <span className="font-display font-black text-2xl text-sautuk-accent/40 w-6 shrink-0 mt-0.5">
                        {index + 1}
                      </span>
                      <div>
                        <Link
                          to={`/posts/${tp.slug}`}
                          className="font-display font-black text-xs text-sautuk-dark hover:text-sautuk-accent hover:underline line-clamp-2 leading-snug font-serif"
                        >
                          {tp.title}
                        </Link>
                        <p className="text-[10px] text-sautuk-dark/70 mt-1 font-semibold">{formatDate(tp.createdAt)} • {tp.category?.name || 'Topic'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Newsletter Subscription Card */}
            <div className="bg-sautuk-card rounded-3xl p-5 shadow-sm border border-sautuk-dark/5">
              <div className="flex items-center gap-2 text-sautuk-accent mb-2.5 font-bold text-xs uppercase tracking-wider">
                <Mail className="w-4 h-4" /> न्यूज़लेटर प्रेषण
              </div>
              <h3 className="font-display font-black text-base text-sautuk-dark mb-1.5 font-serif">
                पाठक मंडल में शामिल हों
              </h3>
              <p className="text-[11px] text-sautuk-dark/85 mb-4 leading-relaxed">
                सातिरिक्त साप्ताहिक भू-राजनीतिक निबंधों, सामाजिक-आर्थिक कॉलम और जलवायु रिपोर्टों के संबंध में त्वरित ईमेल प्राप्त करें।
              </p>

              {subscribeMsg && (
                <div className={`mb-4 text-xs rounded-xl p-3.5 flex items-start gap-2 ${subscribeSuccess
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-100'
                    : 'bg-sautuk-cta/10 text-sautuk-cta border border-sautuk-cta/10'
                  }`}>
                  {subscribeSuccess ? <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" /> : null}
                  <span>{subscribeMsg}</span>
                </div>
              )}

              <form onSubmit={handleSubscribeSubmit} className="space-y-2.5">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="अपना ईमेल पता दर्ज करें"
                  className="w-full bg-sautuk-bg border border-sautuk-dark/10 text-sautuk-dark text-xs rounded-xl px-4 py-3 outline-none focus:border-sautuk-accent transition-colors placeholder-sautuk-dark/40"
                />
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-sautuk-dark dark:bg-sautuk-accent text-sautuk-bg font-bold py-3 rounded-full hover:scale-[1.02] active:scale-95 transition-all text-xs flex justify-center items-center gap-1.5 cursor-pointer shadow-md disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'सदस्य बनें'}
                </button>
              </form>
            </div>

          </div>
        </div>
      </main>

      {/* Footer & Secret Gate link */}
      <footer className="bg-sautuk-bg border-t border-sautuk-dark/10 py-10 px-4 text-center text-xs text-sautuk-muted font-semibold mt-16">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-6">
          <p>© {new Date().getFullYear()} सौतुक मीडिया कंपनी। सर्वाधिकार सुरक्षित।</p>
          <div className="flex flex-wrap justify-center gap-4.5 font-bold text-[10px] uppercase tracking-wider text-sautuk-muted">
            <a href="#" className="hover:text-sautuk-accent transition-colors">गोपनीयता नीति</a>
            <span>•</span>
            <a href="#" className="hover:text-sautuk-accent transition-colors">उपयोग की शर्तें</a>
            <span>•</span>
            <Link
              to="/sautuk-admin-gate"
              className="hover:text-sautuk-accent text-slate-400 dark:text-slate-600 transition-colors flex items-center gap-1 border-l border-sautuk-dark/10 pl-4.5"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              एडमिन पोर्टल
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
