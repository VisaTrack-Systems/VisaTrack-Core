import { act, cleanup, render, type RenderResult } from '@testing-library/react';
import { composeStories } from '@storybook/react';
import { afterEach, describe, expect, it } from 'vitest';

type StoryModule = Record<string, unknown>;
type ComposedStory = {
  (): JSX.Element;
  play?: (context?: { canvasElement: HTMLElement }) => Promise<void>;
};

const storyModules = import.meta.glob<StoryModule>('../figma/**/*.stories.tsx', {
  eager: true,
});

const stories = Object.entries(storyModules).flatMap(([path, moduleExports]) => {
  const composed = composeStories(moduleExports);
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
