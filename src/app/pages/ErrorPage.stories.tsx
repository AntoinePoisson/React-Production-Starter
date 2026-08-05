import type { Meta, StoryObj } from '@storybook/react-vite';

import ErrorPage from './ErrorPage';

/**
 * The recoverable route error. Worth a story because it is the screen nobody looks at until a
 * visitor is already having a bad time — and the one place where an untranslated string or a
 * button with no contrast would go unnoticed for months.
 */
const meta = {
  title: 'Pages/Error',
  component: ErrorPage,
  parameters: { layout: 'fullscreen' },
  args: { error: new Error('Something failed while loading the scene') }
} satisfies Meta<typeof ErrorPage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
