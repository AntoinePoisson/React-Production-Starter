import type { Meta, StoryObj } from '@storybook/react-vite';

import useGlobalStore from '@/utils/store/Store';

import Overlay from './Overlay';

/**
 * The DOM overlay that sits above the canvas. Switch the locale in the toolbar: the French copy
 * is roughly a third longer than the English, and the header has to hold both.
 */
const meta = {
  title: 'UI/Overlay',
  component: Overlay,
  parameters: { layout: 'fullscreen' }
} satisfies Meta<typeof Overlay>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** The entrance animation, which only plays for a visitor who has not been here in three days. */
export const FirstVisit: Story = {
  decorators: [
    (Story) => {
      useGlobalStore.setState({ isFirstVisit: true });
      return <Story />;
    }
  ]
};

/**
 * Below 640px the footer is hidden — a `hidden sm:block` variant, not a hook, because nothing
 * about that decision changes what runs.
 */
export const Mobile: Story = {
  globals: { viewport: { value: 'mobile1' } }
};
