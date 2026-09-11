/** storybook: Unit tests for storybook component/module. Validates component behavior and interactions. */

import { act, cleanup, render, type RenderResult } from '@testing-library/react';
import { composeStories } from '@storybook/react';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

type StoryModule = Record<string, unknown>;
type ComposedStory = {
  (): ReactElement;
  play?: (context?: { canvasElement: HTMLElement }) => Promise<void>;
};

const storyModules = import.meta.glob('../design-system/**/*.stories.tsx', {
  eager: true,
}) as Record<string, StoryModule>;

const stories = Object.entries(storyModules).flatMap(([path, moduleExports]) => {
  const composed = composeStories(moduleExports as never);
  return Object.entries(composed).map(([storyName, story]) => ({
    storyId: `${path}#${storyName}`,
    Story: story as ComposedStory,
  }));
});

afterEach(() => {
  cleanup();
});

describe('storybook stories', () => {
  it.each(stories)('$storyId renders', async ({ Story }) => {
    let rendered!: RenderResult;

    await act(async () => {
      rendered = render(<Story />);
    });

    await act(async () => {
      await Story.play?.({
        canvasElement: rendered.container,
      });
    });

    expect(rendered.container.firstChild).not.toBeNull();
  });
});
