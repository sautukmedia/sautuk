import React from 'react';

interface MarkdownRendererProps {
  content: string;
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  // Safe simple markdown parsing and rendering to React nodes
  const parseMarkdownToReact = (text: string) => {
    // Replace \r\n with \n and split into blocks by double newline
    const normalizedText = text.replace(/\r\n/g, '\n');
    const blocks = normalizedText.split(/\n\n+/);
    
    return blocks.map((block, idx) => {
      const trimmedBlock = block.trim();
      if (!trimmedBlock) return null;

      // Handle Headings
      if (trimmedBlock.startsWith('# ')) {
        return <h1 key={idx} className="text-3xl lg:text-4xl font-display font-black text-sautuk-dark mt-8 mb-4 leading-tight">{renderInline(trimmedBlock.slice(2))}</h1>;
      }
      if (trimmedBlock.startsWith('## ')) {
        return <h2 key={idx} className="text-2xl lg:text-3xl font-display font-black text-sautuk-dark mt-8 mb-4 leading-tight border-b border-sautuk-dark/10 pb-2.5">{renderInline(trimmedBlock.slice(3))}</h2>;
      }
      if (trimmedBlock.startsWith('### ')) {
        return <h3 key={idx} className="text-xl lg:text-2xl font-display font-bold text-sautuk-dark mt-6 mb-3 leading-tight">{renderInline(trimmedBlock.slice(4))}</h3>;
      }

      // Handle Blockquotes (Pullquotes)
      if (trimmedBlock.startsWith('>')) {
        const quoteText = trimmedBlock
          .split('\n')
          .map(line => line.replace(/^>\s?/, ''))
          .join('\n');
        return (
          <blockquote key={idx} className="border-l-4 border-sautuk-accent pl-5 my-8 italic text-lg lg:text-xl font-serif text-sautuk-dark/90 bg-sautuk-accent/5 py-4 pr-6 rounded-r-2xl">
            {renderInline(quoteText)}
          </blockquote>
        );
      }

      // Handle Lists
      if (trimmedBlock.startsWith('- ') || trimmedBlock.startsWith('* ')) {
        const items = trimmedBlock.split(/\n[-*]\s+/);
        items[0] = items[0].replace(/^[-*]\s+/, '');
        return (
          <ul key={idx} className="list-disc pl-6 my-6 space-y-2.5 text-sautuk-dark font-sans text-base lg:text-lg">
            {items.map((item, itemIdx) => (
              <li key={itemIdx}>{renderInline(item)}</li>
            ))}
          </ul>
        );
      }
      
      if (/^\d+\.\s+/.test(trimmedBlock)) {
        const items = trimmedBlock.split(/\n\d+\.\s+/);
        items[0] = items[0].replace(/^\d+\.\s+/, '');
        return (
          <ol key={idx} className="list-decimal pl-6 my-6 space-y-2.5 text-sautuk-dark font-sans text-base lg:text-lg">
            {items.map((item, itemIdx) => (
              <li key={itemIdx}>{renderInline(item)}</li>
            ))}
          </ol>
        );
      }

      // Check for image blocks: ![alt](url) or ![alt](url "caption")
      const imgRegex = /^!\[(.*?)\]\((.*?)\)$/;
      const imgMatch = trimmedBlock.match(imgRegex);
      if (imgMatch) {
        const alt = imgMatch[1];
        const parts = imgMatch[2].split(/\s+["'](.*?)["']/);
        const url = parts[0];
        const caption = parts[1] || '';
        
        return (
          <figure key={idx} className="my-10 flex flex-col items-center w-full max-w-none">
            <img 
              src={url} 
              alt={alt} 
              className="rounded-3xl w-full shadow-md border border-sautuk-dark/5 max-h-[550px] object-cover hover:scale-[1.01] transition-transform duration-500" 
            />
            {(caption || alt) && (
              <figcaption className="mt-3.5 text-xs text-sautuk-muted font-sans text-center max-w-2xl px-4 italic leading-relaxed">
                {caption || alt}
              </figcaption>
            )}
          </figure>
        );
      }

      // Default Paragraph
      return (
        <p key={idx} className="text-sautuk-dark leading-relaxed font-sans text-base lg:text-lg mb-5 text-justify">
          {renderInline(trimmedBlock)}
        </p>
      );
    });
  };

  // Safe inline formatter (handles bold, italic, and links)
  const renderInline = (text: string) => {
    // Safety check against XSS: strip script injections
    let safeText = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    
    const parts: React.ReactNode[] = [];
    let currentIdx = 0;
    
    // Match bold, italic, and link syntaxes
    const inlineRegex = /(\*\*.*?\*\*|\*.*?\*|\[.*?\]\(.*?\))/g;
    let match;
    let keyCounter = 0;
    
    while ((match = inlineRegex.exec(safeText)) !== null) {
      const matchIndex = match.index;
      const matchText = match[0];
      
      // Push preceding plain text
      if (matchIndex > currentIdx) {
        parts.push(safeText.slice(currentIdx, matchIndex));
      }
      
      // Match type parsing
      if (matchText.startsWith('**') && matchText.endsWith('**')) {
        parts.push(<strong key={keyCounter++} className="font-bold text-sautuk-dark">{matchText.slice(2, -2)}</strong>);
      } else if (matchText.startsWith('*') && matchText.endsWith('*')) {
        parts.push(<em key={keyCounter++} className="italic text-sautuk-dark/95">{matchText.slice(1, -1)}</em>);
      } else if (matchText.startsWith('[') && matchText.includes('](')) {
        const closeBracketIdx = matchText.indexOf(']');
        const linkText = matchText.slice(1, closeBracketIdx);
        const linkUrl = matchText.slice(closeBracketIdx + 2, -1);
        parts.push(
          <a 
            key={keyCounter++} 
            href={linkUrl} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-sautuk-cta dark:text-sautuk-accent hover:underline font-bold transition-all"
          >
            {linkText}
          </a>
        );
      }
      
      currentIdx = inlineRegex.lastIndex;
    }
    
    // Push remaining text
    if (currentIdx < safeText.length) {
      parts.push(safeText.slice(currentIdx));
    }
    
    return parts.length > 0 ? parts : safeText;
  };

  return <div className="prose prose-slate dark:prose-invert max-w-none">{parseMarkdownToReact(content)}</div>;
}
