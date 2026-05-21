import Link from 'next/link';
import type { DbCategory } from '@rosovia/core';

interface CategoryCardProps {
  category: DbCategory;
}

const TYPE_COLORS: Record<string, string> = {
  product:     'bg-amber-50 text-amber-700 border-amber-200',
  service:     'bg-blue-50 text-blue-700 border-blue-200',
  learning:    'bg-emerald-50 text-emerald-700 border-emerald-200',
  performance: 'bg-purple-50 text-purple-700 border-purple-200',
  mixed:       'bg-gray-50 text-gray-700 border-gray-200',
};

const TYPE_LABELS: Record<string, string> = {
  product:     'Product',
  service:     'Service',
  learning:    'Learning',
  performance: 'Performance',
  mixed:       'Mixed',
};

// Simple icon-name → emoji fallback (no external icon dep required here)
const ICON_EMOJI: Record<string, string> = {
  Gift:        '🎁',
  Palette:     '🎨',
  Shapes:      '🏺',
  Code:        '💻',
  PenTool:     '✏️',
  Music:       '🎵',
  Camera:      '📷',
  BookOpen:    '📚',
  Shirt:       '👗',
};

export function CategoryCard({ category }: CategoryCardProps) {
  const emoji = category.icon_name ? (ICON_EMOJI[category.icon_name] ?? '📦') : '📦';
  const typeColor = TYPE_COLORS[category.type] ?? TYPE_COLORS.mixed;
  const typeLabel = TYPE_LABELS[category.type] ?? category.type;

  return (
    <div className="group relative flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all">
      {/* Icon + type */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-3xl" role="img" aria-label={category.name}>
          {emoji}
        </span>
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${typeColor}`}
        >
          {typeLabel}
        </span>
      </div>

      {/* Name */}
      <h3 className="font-semibold text-gray-900 group-hover:text-indigo-700 transition-colors mb-1 leading-snug">
        {category.name}
      </h3>

      {/* Description */}
      {category.description && (
        <p className="text-sm text-gray-500 line-clamp-2 flex-1 mb-4">
          {category.description}
        </p>
      )}

      {/* CTA */}
      <Link
        href={`/categories/${category.slug}`}
        className="mt-auto inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors self-start"
      >
        Explore →
      </Link>
    </div>
  );
}
