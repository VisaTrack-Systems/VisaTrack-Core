import '@testing-library/jest-dom/vitest';
import { setProjectAnnotations } from '@storybook/react';
import { vi } from 'vitest';

import * as preview from './.storybook/preview';

setProjectAnnotations(preview);

window.open = vi.fn();

if (!URL.createObjectURL) {
  URL.createObjectURL = vi.fn(() => 'blob:storybook-test');
}

if (!URL.revokeObjectURL) {
  URL.revokeObjectURL = vi.fn();
}
