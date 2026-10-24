import { lazy, Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import Home from './pages/Home';
import PostRead from './pages/PostRead';
import ToastContainer from './components/ToastContainer';
import { seedPublicPage } from './seo/bootstrap';
import NotFound from './pages/NotFound';

// Lazy-load the heavy administrative suite (Tiptap editor, Mammoth, Admin managers)
const AdminGate = lazy(() => import('./pages/AdminGate'));

// Instantiate Query Client for TanStack Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});
seedPublicPage(queryClient, document);

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastContainer />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/posts/:slug" element={<PostRead />} />
          <Route 
            path="/sautuk-admin-gate" 
            element={
              <Suspense fallback={
                <div className="min-h-screen bg-sautuk-bg flex flex-col justify-center items-center font-sans text-sautuk-dark">
                  <Loader2 className="w-10 h-10 animate-spin text-sautuk-accent mb-3" />
                  <p className="text-sm font-semibold">लोड हो रहा है...</p>
                </div>
              }>
                <AdminGate />
              </Suspense>
            } 
          />
          {/* Catch all route - simple fallback */}
          <Route
            path="*"
            element={<NotFound />}
          />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
