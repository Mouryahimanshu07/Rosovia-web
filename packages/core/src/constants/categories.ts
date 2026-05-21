import { Category } from '../types/category';

export const TOP_CATEGORIES: Category[] = [
  {
    name: 'Handmade Gifts / Handmade Products',
    slug: 'handmade-gifts',
    description: 'Unique, handcrafted gifts and physical products made with care.',
    priority: 1,
    type: 'product',
    iconName: 'Gift',
    shortReason: 'Unique gifts'
  },
  {
    name: 'Painting / Sketching / Digital Art',
    slug: 'art',
    description: 'Custom paintings, sketches, and digital artwork commissions.',
    priority: 2,
    type: 'mixed',
    iconName: 'Palette',
    shortReason: 'Custom artwork'
  },
  {
    name: 'Pottery / Matti ki Murti / Clay Art',
    slug: 'pottery',
    description: 'Beautiful ceramic and clay creations, including traditional sculptures.',
    priority: 3,
    type: 'product',
    iconName: 'Shapes',
    shortReason: 'Clay crafts'
  },
  {
    name: 'Coding / Web Development / App Development',
    slug: 'development',
    description: 'Professional software development and coding services.',
    priority: 4,
    type: 'service',
    iconName: 'Code',
    shortReason: 'Tech solutions'
  },
  {
    name: 'Graphic Design / Logo / Poster / UI Design',
    slug: 'design',
    description: 'Creative design services for branding, UI/UX, and marketing.',
    priority: 5,
    type: 'service',
    iconName: 'PenTool',
    shortReason: 'Creative design'
  },
  {
    name: 'Dance / Music / Singing',
    slug: 'performing-arts',
    description: 'Performances and lessons in dance, music, and vocals.',
    priority: 6,
    type: 'performance',
    iconName: 'Music',
    shortReason: 'Performances'
  },
  {
    name: 'Photography / Videography / Editing',
    slug: 'media-production',
    description: 'Professional photo/video shoots and post-production editing.',
    priority: 7,
    type: 'service',
    iconName: 'Camera',
    shortReason: 'Media services'
  },
  {
    name: 'Teaching / Mentorship / Skill Learning',
    slug: 'education',
    description: '1-on-1 mentorship, tutoring, and skill development classes.',
    priority: 8,
    type: 'learning',
    iconName: 'BookOpen',
    shortReason: 'Learn skills'
  },
  {
    name: 'Fashion / Handmade Clothes / Jewellery',
    slug: 'fashion',
    description: 'Custom clothing, fashion design, and handcrafted jewelry.',
    priority: 9,
    type: 'product',
    iconName: 'Shirt',
    shortReason: 'Custom fashion'
  }
];
