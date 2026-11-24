/** Site-wide constants. The repository URL is where the public repo will live. */
export const SITE_NAME = "Jali";
export const REPO_URL = "https://github.com/ramiz-rahman/jali";
/** Who makes Jali, as the package's author field and the footer say. */
export const AUTHOR = { name: "Ramiz Rahman", url: "https://ramizrahman.com/" };
/** Jali's licence, as the package says (SPDX), and where its text is. */
export const LICENSE = { spdx: "Apache-2.0", url: "https://www.apache.org/licenses/LICENSE-2.0" };
/** The branch the docs are written on, for "Edit this page". */
export const REPO_BRANCH = "master";
/** Where the docs' page sources live inside the repository, for "Edit this page". */
export const PAGES_DIR = "apps/docs/src/docs";
export const editUrl = (file: string) => `${REPO_URL}/edit/${REPO_BRANCH}/${PAGES_DIR}/${file}`;
/** "Report an issue" for a page: a new issue that names the page. */
export const issueUrl = (path: string, title: string) =>
  `${REPO_URL}/issues/new?${new URLSearchParams({ title: `Docs: ${title}`, body: `Page: ${path}\n\n` })}`;
