/** ImageWithFallback.stories: Storybook stories for ImageWithFallback components. Demonstrates various component states and usage patterns. */

import type { Meta, StoryObj } from '@storybook/react';

import { ImageWithFallback } from './ImageWithFallback';

const meta = {
  title: 'Components/Figma/ImageWithFallback',
  component: ImageWithFallback,
  tags: ['autodocs'],
} satisfies Meta<typeof ImageWithFallback>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    src: 'https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=800&q=80',
    alt: 'Office workspace',
    className: 'w-full max-w-xl rounded-xl',
  },
};

export const BrokenSourceFallback: Story = {
  args: {
    src: 'https://example.invalid/does-not-exist.jpg',
    alt: 'Broken source fallback',
    className: 'w-full max-w-xl rounded-xl',
  },
};
