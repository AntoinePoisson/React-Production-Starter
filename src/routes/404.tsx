import { createFileRoute } from '@tanstack/react-router';

import NotFound from '@/app/pages/NotFound';

// A real route so the build emits 404.html. Static segments win over $locale.
export const Route = createFileRoute('/404')({
  component: NotFound
});
