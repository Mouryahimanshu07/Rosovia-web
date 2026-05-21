-- =============================================================================
-- Rosovia Module 2: Seed Data
-- File: seed.sql
-- Description: Seeds the initial 9 platform categories.
--              Safe to run multiple times (ON CONFLICT DO UPDATE).
-- =============================================================================

insert into public.categories (name, slug, description, priority, type, icon_name, is_active)
values

  (
    'Handmade Gifts / Handmade Products',
    'handmade-gifts-handmade-products',
    'Discover unique, handcrafted physical products made with love — from custom gift boxes and personalised keepsakes to artisan home decor.',
    1,
    'product',
    'Gift',
    true
  ),

  (
    'Painting / Sketching / Digital Art',
    'painting-sketching-digital-art',
    'Commission original paintings, detailed pencil sketches, or vibrant digital illustrations from verified artists across India.',
    2,
    'learning',
    'Palette',
    true
  ),

  (
    'Pottery / Matti ki Murti / Clay Art',
    'pottery-matti-ki-murti-clay-art',
    'Explore beautiful handcrafted pottery, traditional clay sculptures (matti ki murti), and ceramic art made by skilled Indian artisans.',
    3,
    'product',
    'Hand',
    true
  ),

  (
    'Coding / Web Development / App Development',
    'coding-web-development-app-development',
    'Hire verified coders and developers for websites, mobile apps, custom software, and technical consulting services.',
    4,
    'service',
    'Code',
    true
  ),

  (
    'Graphic Design / Logo / Poster / UI Design',
    'graphic-design-logo-poster-ui-design',
    'Get professional design work including brand logos, marketing posters, social media graphics, and UI/UX design from verified designers.',
    5,
    'service',
    'PenTool',
    true
  ),

  (
    'Dance / Music / Singing',
    'dance-music-singing',
    'Book performers or learn from verified artists offering dance choreography, live music, singing lessons, and cultural performances.',
    6,
    'performance',
    'Music',
    true
  ),

  (
    'Photography / Videography / Editing',
    'photography-videography-editing',
    'Connect with verified photographers and videographers for events, portraits, product shoots, and post-production editing services.',
    7,
    'service',
    'Camera',
    true
  ),

  (
    'Teaching / Mentorship / Skill Learning',
    'teaching-mentorship-skill-learning',
    'Book 1-on-1 sessions with verified mentors, tutors, and coaches for academic subjects, professional skills, and personal development.',
    8,
    'learning',
    'GraduationCap',
    true
  ),

  (
    'Fashion / Handmade Clothes / Jewellery',
    'fashion-handmade-clothes-jewellery',
    'Shop or commission handcrafted clothing, traditional textiles, custom fashion pieces, and handmade jewellery from verified creators.',
    9,
    'product',
    'Gem',
    true
  )

on conflict (slug) do update set
  name        = excluded.name,
  description = excluded.description,
  priority    = excluded.priority,
  type        = excluded.type,
  icon_name   = excluded.icon_name,
  is_active   = excluded.is_active,
  updated_at  = now();
