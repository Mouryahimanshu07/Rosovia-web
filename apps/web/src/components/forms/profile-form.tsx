'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Image from 'next/image';
import {
  User, MapPin, Globe, Tag, Film, BookOpen,
  CheckCircle2, Camera, Save, ArrowLeft, Loader2,
  ChevronDown, ChevronUp, Briefcase, Languages,
} from 'lucide-react';

import {
  profileFormSchema,
  type Profile,
  type CreatorProfile,
  type CreatorProfileWithCategory,
  type DbCategory,
} from '@rosovia/core';
import { updateProfileAction } from '~/app/actions/profiles';
import { Button, Input } from '@rosovia/ui';
import { ProfileImageUploader } from '~/components/profile/ProfileImageUploader';

interface ProfileFormProps {
  profile: Profile;
  creatorProfile?: CreatorProfileWithCategory | CreatorProfile | null;
  categories: DbCategory[];
}

/* ─── Reusable sub-components ─────────────────────────── */

function SectionCard({
  icon,
  title,
  subtitle,
  children,
  defaultOpen = true,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden transition-shadow hover:shadow-md">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-6 py-4 text-left hover:bg-gray-50/60 transition-colors"
      >
        <span className="flex-shrink-0 w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
          {icon}
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900 text-sm">{title}</p>
          {subtitle && <p className="text-xs text-gray-400 truncate">{subtitle}</p>}
        </div>
        <span className="text-gray-400 ml-2 flex-shrink-0">
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>
      {open && (
        <div className="px-6 pb-6 pt-1 space-y-5 border-t border-gray-50">
          {children}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1 text-sm font-semibold text-gray-700">
        {label}
        {required && <span className="text-indigo-500">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
      {error && (
        <p className="text-xs text-red-500 flex items-center gap-1 font-medium">
          <span>⚠</span> {error}
        </p>
      )}
    </div>
  );
}

const textareaClass =
  'w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all duration-200 placeholder:text-gray-400 resize-none';

/* ─── Main Form ────────────────────────────────────────── */

export function ProfileForm({ profile, creatorProfile, categories }: ProfileFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverSuccess, setServerSuccess] = useState<boolean>(false);
  const [coverPreview, setCoverPreview] = useState<string | null>(profile.cover_image_url ?? null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(profile.avatar_url ?? null);

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
    watch,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<any>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: defaults,
  });

  const watchedName = watch('fullName') || profile.full_name || 'Your Name';
  const watchedUsername = watch('username') || profile.username || 'username';
  const watchedBio = watch('bio') || '';
  const watchedHeadline = watch('headline') || '';

  const onSubmit = async (values: any) => {
    setServerError(null);
    setServerSuccess(false);
    try {
      const result = await updateProfileAction(values);
      if (!result.success) throw new Error(result.error);
      setServerSuccess(true);
      router.refresh();
      setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Failed to update profile');
    }
  };

  return (
    <div className="space-y-6">

      {/* ── Status Banners ── */}
      {serverSuccess && (
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 px-5 py-4 flex items-center gap-3 shadow-sm">
          <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />
          <div>
            <p className="font-bold text-emerald-800 text-sm">Profile saved!</p>
            <p className="text-xs text-emerald-600 mt-0.5">Your public profile has been updated.</p>
          </div>
        </div>
      )}
      {serverError && (
        <div className="rounded-2xl bg-rose-50 border border-rose-200 px-5 py-4 flex items-center gap-3 shadow-sm">
          <span className="text-lg">⚠️</span>
          <div>
            <p className="font-bold text-rose-800 text-sm">Couldn&apos;t save profile</p>
            <p className="text-xs text-rose-600 mt-0.5">{serverError}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>

        {/* ── COVER + AVATAR HERO (Instagram-style) ── */}
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
          {/* Cover banner with click-to-change overlay */}
          <ProfileImageUploader
            type="cover"
            currentUrl={coverPreview}
            onUploaded={(url) => {
              setCoverPreview(url);
              setValue('coverImageUrl', url, { shouldValidate: true, shouldDirty: true });
            }}
            categoryName={(creatorProfile as CreatorProfileWithCategory | null)?.category_name}
          />
          <input type="hidden" {...register('coverImageUrl')} />

          {/* Avatar + Name Preview row */}
          <div className="px-6 pb-5 pt-3 relative flex flex-col sm:flex-row items-center sm:items-end gap-4">
            {/* Avatar with upload overlay */}
            <ProfileImageUploader
              type="avatar"
              currentUrl={avatarPreview}
              onUploaded={(url) => {
                setAvatarPreview(url);
                setValue('avatarUrl', url, { shouldValidate: true, shouldDirty: true });
              }}
              displayName={watchedName}
            />
            <input type="hidden" {...register('avatarUrl')} />

            {/* Live name/username preview */}
            <div className="text-center sm:text-left space-y-0.5 pb-1">
              <p className="text-lg font-black text-gray-900 leading-tight">{watchedName}</p>
              <p className="text-sm text-indigo-500 font-semibold">@{watchedUsername}</p>
              {watchedHeadline && (
                <p className="text-xs text-gray-500 font-medium max-w-sm">{watchedHeadline}</p>
              )}
              {watchedBio && (
                <p className="text-xs text-gray-400 max-w-xs line-clamp-2 mt-0.5">{watchedBio}</p>
              )}
            </div>

            {/* Live preview badge */}
            <div className="sm:ml-auto flex-shrink-0">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-600 text-[10px] font-extrabold uppercase tracking-widest border border-indigo-100">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                Live Preview
              </span>
            </div>
          </div>
        </div>

        {/* ── SECTION: Identity ── */}
        <SectionCard icon={<User className="h-4 w-4" />} title="Identity" subtitle="Name, username, and bio">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Field label="Display Name" required error={errors.fullName?.message as string}>
              <Input id="fullName" placeholder="e.g. Anuj Sharma" {...register('fullName')} />
            </Field>
            <Field
              label="Username"
              required
              hint="Unique · alphanumeric, underscores & hyphens"
              error={errors.username?.message as string}
            >
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-semibold select-none">@</span>
                <Input id="username" placeholder="mouryaanuj" className="pl-8" {...register('username')} />
              </div>
            </Field>
          </div>

          <Field label="Bio" hint="Max 500 characters — shown on your public profile" error={errors.bio?.message as string}>
            <textarea
              id="bio"
              rows={3}
              placeholder="A short description about yourself, your work, or your style…"
              {...register('bio')}
              className={textareaClass}
            />
          </Field>
        </SectionCard>

        {/* ── SECTION: Location ── */}
        <SectionCard icon={<MapPin className="h-4 w-4" />} title="Location" subtitle="City, state & country">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <Field label="City" error={errors.city?.message as string}>
              <Input id="city" placeholder="e.g. Mumbai" {...register('city')} />
            </Field>
            <Field label="State" error={errors.state?.message as string}>
              <Input id="state" placeholder="e.g. Maharashtra" {...register('state')} />
            </Field>
            <Field label="Country" required error={errors.country?.message as string}>
              <Input id="country" placeholder="e.g. India" {...register('country')} />
            </Field>
          </div>
        </SectionCard>

        {/* ── SECTION: Languages ── */}
        <SectionCard icon={<Languages className="h-4 w-4" />} title="Languages" subtitle="Languages you work in" defaultOpen={false}>
          <Field
            label="Languages"
            hint="Comma-separated — e.g. English, Hindi, Spanish"
            error={errors.languages?.message as string}
          >
            <Input id="languages" placeholder="e.g. English, Hindi" {...register('languages')} />
          </Field>
        </SectionCard>

        {/* ── CREATOR PROFESSIONAL SECTION ── */}
        {isCreator && (
          <>
            <div className="flex items-center gap-3 pt-2">
              <div className="flex-1 h-px bg-gradient-to-r from-indigo-200 to-transparent" />
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500 px-1">Creator Professional Details</span>
              <div className="flex-1 h-px bg-gradient-to-l from-indigo-200 to-transparent" />
            </div>

            {/* Headline & Category */}
            <SectionCard
              icon={<Briefcase className="h-4 w-4" />}
              title="Professional Identity"
              subtitle="Headline, category & skills"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <Field
                  label="Professional Headline"
                  hint="One-line pitch — e.g. Award-Winning Clay Sculptor"
                  error={errors.headline?.message as string}
                >
                  <Input id="headline" placeholder="e.g. Web Dev & App Developer" {...register('headline')} />
                </Field>

                <Field label="Primary Category" required error={errors.primaryCategoryId?.message as string}>
                  <select
                    id="primaryCategoryId"
                    {...register('primaryCategoryId')}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all duration-200 appearance-none cursor-pointer"
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

              <Field
                label="Skills / Tags"
                hint="Comma-separated — e.g. React, Node.js, UI Design"
                error={errors.skills?.message as string}
              >
                <Input id="skills" placeholder="e.g. Pottery, Ceramics, Illustration" {...register('skills')} />
              </Field>
            </SectionCard>

            {/* Website & Intro Video */}
            <SectionCard
              icon={<Globe className="h-4 w-4" />}
              title="Links"
              subtitle="Website & intro video"
              defaultOpen={false}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <Field
                  label="Website URL"
                  hint="Portfolio, blog or socials"
                  error={errors.websiteUrl?.message as string}
                >
                  <Input id="websiteUrl" type="url" placeholder="https://yourwebsite.com" {...register('websiteUrl')} />
                </Field>
                <Field
                  label="Intro Video URL"
                  hint="YouTube or Vimeo short intro"
                  error={errors.introVideoUrl?.message as string}
                >
                  <Input id="introVideoUrl" type="url" placeholder="https://youtube.com/watch?v=..." {...register('introVideoUrl')} />
                </Field>
              </div>
            </SectionCard>

            {/* Story */}
            <SectionCard
              icon={<BookOpen className="h-4 w-4" />}
              title="My Story"
              subtitle="Tell buyers about your passion & journey"
              defaultOpen={false}
            >
              <Field
                label="Your Story"
                hint="Max 2000 characters"
                error={errors.story?.message as string}
              >
                <textarea
                  id="story"
                  rows={6}
                  placeholder="Share your creative journey, background, achievements, and what makes your work special…"
                  {...register('story')}
                  className={textareaClass}
                />
              </Field>
            </SectionCard>
          </>
        )}

        {/* ── SUBMIT BAR ── */}
        <div className="sticky bottom-0 bg-white/95 backdrop-blur border-t border-gray-100 -mx-0 px-0 py-4 flex items-center gap-3 z-10 rounded-b-3xl shadow-lg shadow-white">
          <Button
            type="submit"
            size="lg"
            className="flex-1 sm:flex-none bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition duration-200 shadow-md shadow-indigo-100 disabled:opacity-60 min-w-[160px] rounded-xl"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2 justify-center">
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving…
              </span>
            ) : (
              <span className="flex items-center gap-2 justify-center">
                <Save className="h-4 w-4" />
                Save Changes
              </span>
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
            className="rounded-xl"
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
