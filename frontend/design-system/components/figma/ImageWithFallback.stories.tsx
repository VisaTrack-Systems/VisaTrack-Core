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

const ownedMark =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">' +
      '<rect width="640" height="360" fill="#111827"/>' +
      '<text x="48" y="200" fill="#ffffff" font-family="Arial,sans-serif" font-size="72">VisaTrack</text>' +
      '</svg>'
  );

export const Default: Story = {
  args: {
    src: ownedMark,
    alt: 'VisaTrack wordmark',
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
