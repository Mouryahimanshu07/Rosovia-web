'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Image from 'next/image';

import {
  profileFormSchema,
  type ProfileFormInput,
  type Profile,
  type CreatorProfile,
  type DbCategory,
} from '@rosovia/core';
import { updateProfileAction } from '~/app/actions/profiles';
import { Button, Input } from '@rosovia/ui';
import { ProfileImageUpload } from '~/components/media/profile-image-upload';
import { MediaUpload } from '~/components/media/media-upload';

interface ProfileFormProps {
  profile: Profile;
  creatorProfile?: CreatorProfile | null;
  categories: DbCategory[];
}

function Field({ label, hint, error, children }: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-semibold text-gray-800">{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-400 font-medium">{hint}</p>}
      {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
    </div>
  );
}

export function ProfileForm({ profile, creatorProfile, categories }: ProfileFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverSuccess, setServerSuccess] = useState<boolean>(false);
  const [coverPreview, setCoverPreview] = useState<string | null>(profile.cover_image_url);

  const isCreator = profile.role === 'creator';

  const defaults = {
    fullName: profile.full_name ?? '',
    username: profile.username ?? '',
    bio: profile.bio ?? '',
    city: profile.city ?? '',
    state: profile.state ?? '',
    country: profile.country ?? 'India',
    avatarUrl: profile.avatar_url ?? '',
    coverImageUrl: profile.cover_image_url ?? '',
    languages: creatorProfile?.languages.join(', ') ?? profile.language ?? '',
    // Creator fields
    headline: creatorProfile?.headline ?? '',
    story: creatorProfile?.story ?? '',
    skills: creatorProfile?.skills.join(', ') ?? '',
    primaryCategoryId: creatorProfile?.primary_category_id ?? '',
    websiteUrl: creatorProfile?.website_url ?? '',
    introVideoUrl: creatorProfile?.intro_video_url ?? '',
  };

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<any>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: defaults,
  });

  const onSubmit = async (values: any) => {
    setServerError(null);
    setServerSuccess(false);

    try {
      const result = await updateProfileAction(values);
      if (!result.success) {
        throw new Error(result.error);
      }
      setServerSuccess(true);
      router.refresh();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Failed to update profile');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8" noValidate>
      {serverSuccess && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-emerald-800 animate-fade-in flex items-center gap-3">
          <span className="text-2xl">✨</span>
          <div>
            <h4 className="font-semibold">Profile updated successfully!</h4>
            <p className="text-sm text-emerald-700 mt-0.5">Your public profile card and details have been synchronized.</p>
          </div>
        </div>
      )}

      {serverError && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 text-rose-800 flex items-center gap-3">
          <span className="text-2xl">⚠️</span>
          <div>
            <h4 className="font-semibold">Failed to save profile</h4>
            <p className="text-sm text-rose-700 mt-0.5">{serverError}</p>
          </div>
        </div>
      )}

      {/* Hero Banner Image Section */}
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-gray-800">Cover Banner</label>
        <div className="relative rounded-2xl overflow-hidden border border-gray-200 bg-gray-50 aspect-[3/1] group transition hover:border-gray-300">
          {coverPreview ? (
            <Image src={coverPreview} alt="Cover preview" fill unoptimized className="object-cover" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 gap-1.5">
              <span className="text-3xl">🖼️</span>
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">No cover image uploaded</span>
            </div>
          )}
          
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition duration-200">
            <MediaUpload
              usage="profile_image"
              currentUrl={null}
              onUploaded={(media) => {
                if (media.public_url) {
                  setCoverPreview(media.public_url);
                  setValue('coverImageUrl', media.public_url, { shouldValidate: true, shouldDirty: true });
                }
              }}
              label="Upload Banner"
              isPrivate={false}
            />
          </div>
        </div>
        <p className="text-xs text-gray-400 font-medium">Recommended aspect ratio: 3:1. Max size: 5 MB.</p>
        <input type="hidden" {...register('coverImageUrl')} />
      </div>

      {/* Avatar/Profile Image Section */}
      <div className="p-6 bg-gray-50/50 rounded-2xl border border-gray-100">
        <Field label="Avatar Image" error={errors.avatarUrl?.message as string}>
          <ProfileImageUpload
            currentUrl={profile.avatar_url}
            onUploaded={(url) => setValue('avatarUrl', url, { shouldValidate: true, shouldDirty: true })}
          />
          <input type="hidden" {...register('avatarUrl')} />
        </Field>
      </div>

      {/* Basic Info Section */}
      <div className="space-y-6">
        <h3 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-2">Base Information</h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <Field label="Display Name *" error={errors.fullName?.message as string}>
            <Input id="fullName" placeholder="e.g. John Doe" {...register('fullName')} />
          </Field>

          <Field label="Username *" error={errors.username?.message as string} hint="Must be unique. Alphanumeric, underscores and hyphens.">
            <Input id="username" placeholder="e.g. johndoe" {...register('username')} />
          </Field>
        </div>

        <Field label="Bio" hint="Max 500 characters" error={errors.bio?.message as string}>
          <textarea
            id="bio"
            rows={3}
            placeholder="A short public description about yourself..."
            {...register('bio')}
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900 transition-all duration-200 placeholder:text-gray-400"
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <Field label="City" error={errors.city?.message as string}>
            <Input id="city" placeholder="e.g. Mumbai" {...register('city')} />
          </Field>
          <Field label="State" error={errors.state?.message as string}>
            <Input id="state" placeholder="e.g. Maharashtra" {...register('state')} />
          </Field>
          <Field label="Country *" error={errors.country?.message as string}>
            <Input id="country" placeholder="e.g. India" {...register('country')} />
          </Field>
        </div>

        <Field label="Languages" hint="Comma-separated. e.g. English, Hindi, Spanish" error={errors.languages?.message as string}>
          <Input id="languages" placeholder="e.g. English, Hindi" {...register('languages')} />
        </Field>
      </div>

      {/* Creator Professional Section */}
      {isCreator && (
        <div className="space-y-6 pt-6 border-t border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">🚀</span>
            <h3 className="text-lg font-bold text-gray-900">Creator Professional Profile</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Field label="Professional Headline" hint="Brief one-line pitch of what you do" error={errors.headline?.message as string}>
              <Input id="headline" placeholder="e.g. Award-Winning Clay Sculptor" {...register('headline')} />
            </Field>

            <Field label="Primary Category *" error={errors.primaryCategoryId?.message as string}>
              <select
                id="primaryCategoryId"
                {...register('primaryCategoryId')}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900 transition-all duration-200"
              >
                <option value="">Select a category…</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Field label="Skills / Tags" hint="Comma-separated. e.g. Pottery, Ceramics, Clay Modeling" error={errors.skills?.message as string}>
              <Input id="skills" placeholder="e.g. Pottery, Ceramics" {...register('skills')} />
            </Field>

            <Field label="Website URL" hint="Link to your portfolio, blog or socials" error={errors.websiteUrl?.message as string}>
              <Input id="websiteUrl" type="url" placeholder="https://..." {...register('websiteUrl')} />
            </Field>
          </div>

          <Field label="My Story" hint="Max 2000 characters — tell buyers about your background, passion, and experience" error={errors.story?.message as string}>
            <textarea
              id="story"
              rows={5}
              placeholder="Tell buyers about your journey, experience, and passion for your craft…"
              {...register('story')}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900 transition-all duration-200 placeholder:text-gray-400"
            />
          </Field>

          <Field label="Intro Video URL" hint="YouTube or Vimeo link to a short introduction video" error={errors.introVideoUrl?.message as string}>
            <Input id="introVideoUrl" type="url" placeholder="https://youtube.com/..." {...register('introVideoUrl')} />
          </Field>
        </div>
      )}

      {/* Submit Actions */}
      <div className="flex items-center gap-4 pt-6 border-t border-gray-100">
        <Button
          type="submit"
          size="lg"
          className="bg-gray-950 text-white font-semibold hover:bg-gray-800 transition duration-200 shadow-md hover:shadow-lg disabled:opacity-50 min-w-[140px]"
          disabled={isSubmitting || (!isDirty && !coverPreview)}
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2 justify-center">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              Saving…
            </span>
          ) : (
            'Save Changes'
          )}
        </Button>
        
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => {
            if (profile.username) {
              router.push(`/u/${profile.username}`);
            } else {
              router.push(`/dashboard/${profile.role}`);
            }
          }}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
