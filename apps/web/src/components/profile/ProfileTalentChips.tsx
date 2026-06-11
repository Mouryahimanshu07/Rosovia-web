'use client';

import Link from 'next/link';

interface ProfileTalentChipsProps {
  categoryName?: string | null;
  skills?: string[] | null;
  isOwner?: boolean;
  username?: string;
  limit?: number;
}

export function ProfileTalentChips({
  categoryName,
  skills,
  isOwner = false,
  username,
  limit,
}: ProfileTalentChipsProps) {
  // 1. Parse categories (split by '/')
  const categoriesList = categoryName
    ? categoryName.split('/').map((s) => s.trim()).filter(Boolean)
    : [];

  // 2. Parse skills
  const skillsList = skills
    ? skills.map((s) => s.trim()).filter(Boolean)
    : [];

  // 3. Combine and remove duplicates (case-insensitive deduplication)
  const categoriesParsed: string[] = [];
  const skillsParsed: string[] = [];
  const seen = new Set<string>();

  for (const cat of categoriesList) {
    const lower = cat.toLowerCase();
    if (lower && !seen.has(lower)) {
      seen.add(lower);
      categoriesParsed.push(cat);
    }
  }

  for (const skill of skillsList) {
    const lower = skill.toLowerCase();
    if (lower && !seen.has(lower)) {
      seen.add(lower);
      skillsParsed.push(skill);
    }
  }

  const combined = [...categoriesParsed, ...skillsParsed];

  if (combined.length === 0) {
    if (isOwner) {
      return (
        <div className="mt-1 flex items-center justify-center md:justify-start">
          <Link
            href={`/u/${username}/edit`}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-100/50 text-xs font-bold transition-colors cursor-pointer"
          >
            ✨ Add talent
          </Link>
        </div>
      );
    }
    // Visitor sees no ugly empty chips
    return null;
  }

  // 4. Set limits for desktop/mobile
  const desktopLimit = limit ?? 5;
  const mobileLimit = limit ?? 3;

  const desktopVisible = combined.slice(0, desktopLimit);
  const desktopExtra = combined.length - desktopLimit;

  const mobileVisible = combined.slice(0, mobileLimit);
  const mobileExtra = combined.length - mobileLimit;

  const renderChip = (chip: string, isCategory: boolean, key: string) => (
    <span
      key={key}
      className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-semibold border transition whitespace-nowrap ${
        isCategory
          ? 'bg-indigo-50 text-indigo-700 border-indigo-100 hover:bg-indigo-100/60'
          : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100/60'
      }`}
    >
      {chip}
    </span>
  );

  return (
    <>
      {/* Desktop view (sm and up): Horizontal flex row */}
      <div className="hidden sm:flex flex-row flex-wrap items-center justify-center md:justify-start gap-1.5 mt-1.5">
        {desktopVisible.map((chip, idx) => {
          const isCategory = categoriesParsed.includes(chip);
          return renderChip(chip, isCategory, `d-${idx}-${chip}`);
        })}
        {desktopExtra > 0 && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-semibold bg-gray-100 text-gray-500 border border-gray-200 whitespace-nowrap">
            +{desktopExtra} more
          </span>
        )}
      </div>

      {/* Mobile view (xs only): Horizontal flex row */}
      <div className="flex sm:hidden flex-row flex-wrap items-center justify-center gap-1.5 mt-1.5">
        {mobileVisible.map((chip, idx) => {
          const isCategory = categoriesParsed.includes(chip);
          return renderChip(chip, isCategory, `m-${idx}-${chip}`);
        })}
        {mobileExtra > 0 && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-semibold bg-gray-100 text-gray-500 border border-gray-200 whitespace-nowrap">
            +{mobileExtra} more
          </span>
        )}
      </div>
    </>
  );
}
