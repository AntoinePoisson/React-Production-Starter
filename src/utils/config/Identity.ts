/**
 * Project identity. First thing to edit in a new project — `node initialize.js` rewrites all
 * three from your answers.
 *
 * Keep this a leaf module: components read these constants, so anything imported here lands in
 * the eager bundle of every page. That is why they are not in `Metadata.ts`, whose `getI18n`
 * import pulls in both compiled catalogues.
 */

export const SITE_TITLE = 'React App Fondation';

export const AUTHOR = 'Antoine Poisson';

/**
 * Empty means "no `twitter:site` tag", which is the right default: pointing the card at a handle
 * you do not own hands your social preview to a stranger. Set it to `@yourhandle` when there is
 * one to set it to.
 */
export const TWITTER_HANDLE = '';
