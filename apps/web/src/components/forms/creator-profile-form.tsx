'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import {
  creatorProfileFormSchema,
  type CreatorProfileFormInput,
  type CreatorProfile,
  type DbCategory,
  parseCommaSeparated,
} from '@rosovia/core';
import { createCreatorProfileAction, updateCreatorProfileAction } from '~/app/actions/creator-profile';
import { Button, Input } from '@rosovia/ui';

interface CreatorProfileFormProps {
  mode: 'create' | 'edit';
  categories: DbCategory[];
  existingProfile?: CreatorProfile | null;
}

function Field({ label, hint, error, children }: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

export function CreatorProfileForm({ mode, categories, existingProfile }: CreatorProfileFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const defaults = existingProfile
    ? {
        displayName: existingProfile.display_name,
        bio: existingProfile.bio ?? '',
        story: existingProfile.story ?? '',
        primaryCategoryId: existingProfile.primary_category_id ?? '',
        skills: existingProfile.skills.join(', '),
        languages: existingProfile.languages.join(', '),
        city: existingProfile.city ?? '',
        state: existingProfile.state ?? '',
        country: existingProfile.country,
        profileImageUrl: existingProfile.profile_image_url ?? '',
        introVideoUrl: existingProfile.intro_video_url ?? '',
      }
    : { country: 'India' };

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreatorProfileFormInput>({
    resolver: zodResolver(creatorProfileFormSchema),
    defaultValues: defaults,
  });

  const onSubmit = async (values: CreatorProfileFormInput) => {
    setServerError(null);


    const input = {
      displayName: values.displayName,
      bio: values.bio || undefined,
      story: values.story || undefined,
      primaryCategoryId: values.primaryCategoryId,
      skills: parseCommaSeparated(values.skills),
      languages: parseCommaSeparated(values.languages),
      city: values.city || undefined,
      state: values.state || undefined,
      country: values.country || 'India',
      profileImageUrl: values.profileImageUrl || undefined,
      introVideoUrl: values.introVideoUrl || undefined,
    };

    try {
      let result;
      if (mode === 'create') {
        result = await createCreatorProfileAction(input);
      } else {
        if (!existingProfile) throw new Error('No existing profile to update');
        result = await updateCreatorProfileAction(existingProfile.id, input);
      }
      
      if (!result.success) {
        throw new Error(result.error);
      }

      router.push('/dashboard/creator/profile');
      router.refresh();
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      <Field label="Display Name *" error={errors.displayName?.message}>
        <Input id="displayName" placeholder="e.g. Ravi Clay Artist" {...register('displayName')} />
      </Field>

      <Field label="Primary Category *" error={errors.primaryCategoryId?.message}>
        <select
          id="primaryCategoryId"
          {...register('primaryCategoryId')}
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        >
          <option value="">Select a category…</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Short Bio" hint="Max 500 characters" error={errors.bio?.message}>
        <textarea
          id="bio"
          rows={3}
          placeholder="A brief description of who you are and what you offer…"
          {...register('bio')}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
      </Field>

      <Field label="Your Story" hint="Max 2000 characters" error={errors.story?.message}>
        <textarea
          id="story"
          rows={5}
          placeholder="Tell buyers about your background, experience, and passion…"
          {...register('story')}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Skills" hint="Comma-separated. e.g. Pottery, Sculpture, Clay Art" error={errors.skills?.message}>
          <Input id="skills" placeholder="Pottery, Sculpture, Clay Art" {...register('skills')} />
        </Field>
        <Field label="Languages" hint="Comma-separated. e.g. Hindi, English" error={errors.languages?.message}>
          <Input id="languages" placeholder="Hindi, English" {...register('languages')} />
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label="City" error={errors.city?.message}>
          <Input id="city" placeholder="Mumbai" {...register('city')} />
        </Field>
        <Field label="State" error={errors.state?.message}>
          <Input id="state" placeholder="Maharashtra" {...register('state')} />
        </Field>
        <Field label="Country" error={errors.country?.message}>
          <Input id="country" placeholder="India" {...register('country')} />
        </Field>
      </div>

      <Field label="Profile Image URL" hint="Direct link to your photo (upload coming in a future module)" error={errors.profileImageUrl?.message}>
        <Input id="profileImageUrl" type="url" placeholder="https://..." {...register('profileImageUrl')} />
      </Field>

      <Field label="Intro Video URL" hint="YouTube or Vimeo link to a short introduction video" error={errors.introVideoUrl?.message}>
        <Input id="introVideoUrl" type="url" placeholder="https://youtube.com/..." {...register('introVideoUrl')} />
      </Field>

      {serverError && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3">
          <p className="text-sm text-red-600">{serverError}</p>
        </div>
      )}

      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : mode === 'create' ? 'Create Profile' : 'Save Changes'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/dashboard/creator/profile')}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
