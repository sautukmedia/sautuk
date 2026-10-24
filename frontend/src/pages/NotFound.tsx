import { Link } from 'react-router-dom';
import { NOT_FOUND_METADATA } from '../seo/metadata';
import { usePageMetadata } from '../seo/usePageMetadata';

export default function NotFound() {
  usePageMetadata(NOT_FOUND_METADATA);
  return <main className="min-h-screen bg-sautuk-bg flex flex-col justify-center items-center font-sans text-sautuk-dark">
    <h1 className="text-9xl font-black text-sautuk-cta font-display">404</h1>
    <p className="text-xl font-bold mt-4">यह पृष्ठ उपलब्ध नहीं है।</p>
    <Link to="/" className="mt-6 bg-sautuk-dark dark:bg-sautuk-accent text-sautuk-bg px-6 py-3 rounded-full font-bold hover:scale-105 transition-all text-sm">मुख्य पृष्ठ पर वापस जाएं</Link>
  </main>;
}
