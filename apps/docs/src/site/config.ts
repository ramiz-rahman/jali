/** Site-wide constants. The repository URL is a placeholder until the public repo exists. */
export const SITE_NAME = "Jali";
export const REPO_URL = "https://github.com/ramiz-rahman/jali";
/** Where the docs' page sources live inside the repository, for "Edit this page". */
export const PAGES_DIR = "apps/docs/src/pages";
export const editUrl = (file: string) => `${REPO_URL}/edit/main/${PAGES_DIR}/${file}`;
