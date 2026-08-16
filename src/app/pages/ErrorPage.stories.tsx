import type { Meta, StoryObj } from '@storybook/react-vite';

import ErrorPage from './ErrorPage';

/**
 * Worth a story because nobody ever looks at this screen, so an untranslated string or a button
 * with no contrast can sit here for months.
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
