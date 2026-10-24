export interface Taxonomy {
  id: string;
  name: string;
  slug: string;
}

export interface PostSummary {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  featuredImage: string | null;
  status: 'DRAFT' | 'PUBLISHED';
  featured: boolean;
  categoryId: string | null;
  category: Taxonomy | null;
  tags: { tagId: string; tag: Taxonomy }[];
  analytics: { views: number }[];
  createdAt: string;
  updatedAt: string;
}

export interface Post extends PostSummary {
  content: string;
  seoTitle: string | null;
  seoDescription: string | null;
}
