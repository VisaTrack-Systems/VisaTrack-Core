import type { Preview } from '@storybook/react';

import '../app/globals.css';
import { withMockApi } from '../figma/storybook/mockApi';

const preview: Preview = {
  decorators: [withMockApi],
  parameters: {
    layout: 'padded',
    controls: {
      expanded: true,
    },
    nextjs: {
      appDirectory: true,
    },
  },
};

export default preview;
