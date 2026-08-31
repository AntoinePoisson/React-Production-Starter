/**
 * `node initialize.js` rewrites all three. Keep this file a leaf: components read these, so
 * anything imported here lands in the eager bundle of every page.
 */

export const SITE_TITLE = 'React App Fondation';

export const AUTHOR = 'Antoine Poisson';

// Empty means no twitter:site tag at all, which is the right default. Pointing the card at a
// handle you don't own hands your social preview to a stranger.
export const TWITTER_HANDLE = '';

// The public demo points back to the template it demonstrates. Keep it upstream when forking,
// or replace it with the new project's source/docs URL during product customisation.
export const REPOSITORY_URL = 'https://github.com/AntoinePoisson/React-Production-Starter';
