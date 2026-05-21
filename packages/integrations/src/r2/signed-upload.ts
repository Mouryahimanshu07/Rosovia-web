// packages/integrations/src/r2/signed-upload.ts
// Server-only. Generates presigned PUT URLs for direct browser upload to R2.

import { HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createR2Client } from './client';
import { randomUUID } from 'crypto';

const EXPIRES_IN_SECONDS = 300; // 5 minutes

import { GetObjectCommand } from '@aws-sdk/client-s3';

const READ_EXPIRES_IN_SECONDS = 300;

export async function createSignedReadUrl(storageKey: string): Promise<{
  signedUrl: string;
  expiresIn: number;
}> {
  const bucket = process.env.CLOUDFLARE_R2_BUCKET_NAME;
  if (!bucket) {
    throw new Error('Missing CLOUDFLARE_R2_BUCKET_NAME environment variable.');
  }

  const client = createR2Client();

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: storageKey,
  });

  const signedUrl = await getSignedUrl(client, command, {
    expiresIn: READ_EXPIRES_IN_SECONDS,
  });

  return {
    signedUrl,
    expiresIn: READ_EXPIRES_IN_SECONDS,
  };
}

// ---------------------------------------------------------------------------
// Storage key generation
// ---------------------------------------------------------------------------

function sanitizeFileName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}

export type StorageKeyContext =
  | { scope: 'profile'; profileId: string }
  | { scope: 'listing'; listingId: string }
  | { scope: 'private'; profileId: string };

export function generateStorageKey(context: StorageKeyContext, fileName: string): string {
  const safe = sanitizeFileName(fileName);
  const uid = randomUUID();

  switch (context.scope) {
    case 'profile':
      return `public/profiles/${context.profileId}/${uid}-${safe}`;
    case 'listing':
      return `public/listings/${context.listingId}/${uid}-${safe}`;
    case 'private':
      return `private/users/${context.profileId}/${uid}-${safe}`;
  }
}

// ---------------------------------------------------------------------------
// Presigned PUT URL
// ---------------------------------------------------------------------------

export interface CreateSignedUploadUrlInput {
  storageKey: string;
  contentType: string;
  sizeBytes: number;
}

export interface CreateSignedUploadUrlResult {
  signedUrl: string;
  storageKey: string;
  publicUrl: string | null;
  expiresIn: number;
}

export async function createSignedUploadUrl(
  input: CreateSignedUploadUrlInput
): Promise<CreateSignedUploadUrlResult> {
  const bucket = process.env.CLOUDFLARE_R2_BUCKET_NAME;
  if (!bucket) {
    throw new Error('Missing CLOUDFLARE_R2_BUCKET_NAME environment variable.');
  }

  const isPrivate = input.storageKey.startsWith('private/');
  const client = createR2Client();

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: input.storageKey,
    ContentType: input.contentType,
    ContentLength: input.sizeBytes,
  });

  const signedUrl = await getSignedUrl(client, command, {
    expiresIn: EXPIRES_IN_SECONDS,
    signableHeaders: new Set(['content-type']),
  });

  let publicUrl: string | null = null;
  if (!isPrivate) {
    const base = process.env.CLOUDFLARE_R2_PUBLIC_URL;
    if (base) {
      publicUrl = `${base.replace(/\/$/, '')}/${input.storageKey}`;
    }
  }

  return {
    signedUrl,
    storageKey: input.storageKey,
    publicUrl,
    expiresIn: EXPIRES_IN_SECONDS,
  };
}

// ---------------------------------------------------------------------------
// Object metadata verification
// ---------------------------------------------------------------------------

export interface R2ObjectMetadata {
  exists: boolean;
  contentLength: number | null;
  contentType: string | null;
}

export async function getR2ObjectMetadata(storageKey: string): Promise<R2ObjectMetadata> {
  const bucket = process.env.CLOUDFLARE_R2_BUCKET_NAME;
  if (!bucket) {
    throw new Error('Missing CLOUDFLARE_R2_BUCKET_NAME environment variable.');
  }

  const client = createR2Client();

  try {
    const result = await client.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: storageKey,
      })
    );

    return {
      exists: true,
      contentLength: typeof result.ContentLength === 'number' ? result.ContentLength : null,
      contentType: result.ContentType ?? null,
    };
  } catch (error) {
    const err = error as { name?: string; $metadata?: { httpStatusCode?: number } };
    if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
      return { exists: false, contentLength: null, contentType: null };
    }
    throw error;
  }
}
