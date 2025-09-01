import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import AdminGate from './pages/AdminGate';
import PostRead from './pages/PostRead';

// Instantiate Query Client for TanStack Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/posts/:slug" element={<PostRead />} />
          <Route path="/sautuk-admin-gate" element={<AdminGate />} />
          {/* Catch all route - simple fallback */}
          <Route
            path="*"
            element={
              <div className="min-h-screen bg-sautuk-bg flex flex-col justify-center items-center font-sans text-sautuk-dark">
                <h1 className="text-9xl font-black text-sautuk-cta font-display">404</h1>
                <p className="text-xl font-bold mt-4">Page under development for upcoming phases.</p>
                <a
                  href="/"
                  className="mt-6 bg-sautuk-dark text-white px-6 py-3 rounded-full font-bold hover:scale-105 transition-all text-sm"
                >
                  Back to Home
                </a>
              </div>
            }
          />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
