export type CategoryType = 'product' | 'service' | 'learning' | 'performance' | 'mixed';

/** Legacy display type — used on homepage static display */
export interface Category {
  name: string;
  slug: string;
  description: string;
  priority: number;
  type: CategoryType;
  iconName: string;
  shortReason: string;
}

/** Database row type returned by Supabase queries */
export interface DbCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  priority: number;
  type: CategoryType;
  icon_name: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
