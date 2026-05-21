import type { ListingMetadata } from '@rosovia/core';

interface ListingMetadataViewProps {
  metadata: ListingMetadata;
}

const FIELD_LABELS: Record<string, string> = {
  deliveryDays: 'Delivery Days',
  material: 'Material',
  techStack: 'Tech Stack',
  revisionCount: 'Revisions Included',
  fileFormats: 'File Formats',
};

export function ListingMetadataView({ metadata }: ListingMetadataViewProps) {
  const entries = Object.entries(metadata).filter(
    ([key, val]) => FIELD_LABELS[key] && val !== undefined && val !== null && val !== ''
  );

  if (entries.length === 0) return null;

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Additional Details</h3>
      <dl className="grid grid-cols-2 gap-3">
        {entries.map(([key, val]) => (
          <div key={key}>
            <dt className="text-xs text-gray-500">{FIELD_LABELS[key]}</dt>
            <dd className="text-sm text-gray-800 font-medium">{String(val)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
