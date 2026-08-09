import type { Meta, StoryObj } from '@storybook/react-vite';

import useGlobalStore from '@/utils/store/Store';

import Overlay from './Overlay';

/**
 * Switch the locale in the toolbar. The French copy runs about a third longer than the English
 * and the header has to hold both.
 */
const meta = {
  title: 'UI/Overlay',
  component: Overlay,
  parameters: { layout: 'fullscreen' }
} satisfies Meta<typeof Overlay>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const FirstVisit: Story = {
  decorators: [
    (Story) => {
      useGlobalStore.setState({ isFirstVisit: true });
      return <Story />;
    }
  ]
};

export const Mobile: Story = {
  globals: { viewport: { value: 'mobile1' } }
};
