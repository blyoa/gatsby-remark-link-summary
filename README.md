# gatsby-remark-link-summary

[![npm version](https://badge.fury.io/js/gatsby-remark-link-summary.svg)](https://badge.fury.io/js/gatsby-remark-link-summary)
[![test](https://github.com/blyoa/gatsby-remark-link-summary/actions/workflows/node.js.yml/badge.svg)](https://github.com/blyoa/gatsby-remark-link-summary/actions/workflows/node.js.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://https://github.com/blyoa/gatsby-remark-link-summary/blob/main/LICENSE)

This plugin scrapes link nodes and replaces the link nodes to summary nodes that you designed
using scraped data (e.g. og:title, og:image, og:description).

## Example Output

This plugin can convert text links in a markdown file to links with images as follows:

**from**

```md
[--small-card--](https://www.npmjs.com/package/gatsby-remark-link-summary)
[--large-card--](https://github.com/blyoa/gatsby-remark-link-summary)
```

**to**

![card with small image](https://raw.githubusercontent.com/blyoa/gatsby-remark-link-summary/main/examples/card-with-small-image/sample.png)
![card with large image](https://raw.githubusercontent.com/blyoa/gatsby-remark-link-summary/main/examples/card-with-large-image/sample.png)


## Installation

```
npm install gatsby-remark-link-summary
```

## Usage

```javascript
// In your gatsby-config.js
plugins: [
  {
    resolve: `gatsby-transformer-remark`,
    options: {
      plugins: [
        {
          // put `gatsby-remark-link-summary` before `gatsby-remark-images`
          // if generated nodes by `generator` includes img elements and
          // the image nodes should be processed by `gatsby-remark-images`
          resolve: `gatsby-remark-link-summary`,
          options: {
            cacheRootDirPath: 'path/to/cache',
            destinationSubDirPath: 'path/to/sub/dir',
            sites: [
              {
                pattern: /^https:\/\/github\.com\/.*/,
                generator: async ({ metadata: { url, title, image }, cacheRemoteFile }) => {
                  const deployedPath = await cacheRemoteFile(image, true)
                  return `<a href="${url}"><img src="${deployedPath}"/></a>`
                },
                rules: [
                  require('metascraper-url')(),
                  require('metascraper-image')(),
                ],
                gotOptions: {
                  // e.g.
                  // timeout: ...
                  // retry: ...
                },
                cacheExpirationSecond: 60 * 60 * 24 * 10, // 10 days
              },
              {
                // replace link nodes that have the text "--summary-card--"
                // e.g.
                // [--summary-card--](https://example.com)
                pattern: (node) => {
                  if (node.children.length === 0) return false
                  const [firstChild] = node.children
                  return  (firstChild.type === 'text' && firstChild.value === '--summary-card--')
                  // NOTE: The URL of a link node can be obtained from `node.url`
                },
                generator: async ({ metadata: { url, title, image }, cacheRemoteFile }) => {
                  const deployedPath = await cacheRemoteFile(image, true)
                  return `<a href="${url}"><img src="${deployedPath}"/></a>`
                },
                rules: [
                  require('metascraper-url')(),
                  require('metascraper-image')(),
                ],
              },
            ],
          },
        },
      ],
    },
  },
],
```

### Options

| name | type |  description |
|:---|:---|:---|
| `cacheRootDirPath` | `string \| undefined` |  A directory to place remote files fetched by `cacheRemoteFile` of `HTMLGeneratorParams` and a catalog file about the fetched files and scraped metadata. If this option is `undefined`, the catalog file is not saved. |
| `destinationSubDirPath` | `string` |  A subdirectory of the directory for built artifacts (i.e., the `public` directory) to place remote files fetched in the second argument of `generator`. |
| `sites` | `SiteOptions[]` | Node generator options for sites. |

#### SiteOptions

| name | type |  description |
|:---|:---|:---|
| `pattern` | `RegExp \| (node: Link) => boolean` |  A target link node to be substituted. `RegExp` specifies URLs of the link node to be substituted, and the function returns whether the link node should be substituted or not. `Link` is the type defined in [mdast](https://github.com/syntax-tree/mdast/blob/4.0.0/#link) package. |
| `generator` | `(params: HTMLGeneratorParams) => string \| Node \| Promise<string \| Node>` | A function to generate the node that substitute a link node. |
| `rules` | `Rule[]` | Rules for [metascraper](https://github.com/microlinkhq/metascraper/blob/v5.25.8/README.md#importing-rules). |
| `gotOptions` | `Options[] \| undefined` | Options for [got](https://github.com/sindresorhus/got/blob/v11.8.3/readme.md). |
| `cacheExpirationSecond` | `number \| undefined` | The expiration second of scraped metadata and fetched remote files. The metadata and the path to the fetched remote file are reused until this expiration second reaches.<br /><br />If this option is `undefined`, the fetched metadata and the fetched remote files never expire.  |

#### HTMLGeneratorParams

| name | type |  description |
|:---|:---|:---|
| `metadata` | `Record<string, string>` |  Metadata scraped by metascraper. |
| `orignalNode` | `Link` | An original link node that `generator` substitutes. |
| `cacheRemoteFile` | `(fileURL: string, persistent?: boolean) => Promise<string>` | A function to fetch a remote file and returns the path to the fetched file in `destinationSubDirPath`. `fileURL` is the URL of the remote file. When `persistent` is true, the fetched file is also saved in `cachedRootDirPath`.  |


## Example Settings

### Card With Small Image

![card with small image](https://raw.githubusercontent.com/blyoa/gatsby-remark-link-summary/main/examples/card-with-small-image/sample.png)

gatsby-config.js

<details>

```js
const descriptionRule = require("metascraper-description")
const imageRule = require("metascraper-image")
const titleRule = require("metascraper-title")
const urlRule = require("metascraper-url")

module.exports = {
  // snip...
  plugins: [
    // snip...
    {
      resolve: `gatsby-transformer-remark`,
      options: {
        plugins: [
          {
            resolve: `gatsby-remark-link-summary`,
            options: {
              cacheRootDirPath: "cache/link-summary",
              destinationSubDirPath: "link-summary",
              sites: [
                {
                  pattern: /^https:\/\/www\.npmjs\.com\/.*/,
                  generator: async ({
                    metadata: { image, url, title, description },
                    cacheRemoteFile,
                  }) => {
                    const filePath = await cacheRemoteFile(image, true)
                    return `
                      <div class="summary-card">
                        <a href="${url}">
                          <img
                            class="summary-card__image"
                            src="${filePath}"
                          />
                          <div class="summary-card__description">
                            <div class="summary-card__description__title"
                              >${title}</div
                            >
                            <div class="summary-card__description__summary"
                              >${description}</div
                            >
                            <div class="summary-card__description__url"
                              >${url}</div
                            >
                          </div>
                        </a>
                      </div>
                    `
                  },
                  rules: [
                    urlRule(),
                    titleRule(),
                    imageRule(),
                    descriptionRule(),
                  ],
                },
              ],
            },
          },
          // snip...
        ],
      },
    },
    // snip...
  ],
}
```

</details>

your-style-file.css

<details>

```css
/* import css, e.g. from gatsby-browser.js */
.summary-card {
  line-height: 1.5;
}

.summary-card a {
  color: inherit;
  text-decoration: none;
  display: flex;
  flex-direction: row-reverse;
  align-items: center;
  border: 1px solid #e5e5e5;
  border-radius: 3px;
}

.summary-card__image {
  width: 14rem;
  height: 10rem;
  object-fit: cover;
  border-inline-start: 1px solid #e5e5e5;
}

.summary-card__description {
  display: flex;
  flex-direction: column;
  flex: 1;
  padding: 0 1.2rem;
  overflow: hidden;
}

.summary-card__description__title {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  font-weight: 700;
  max-height: calc(2rem * 1.5);
  overflow: hidden;
}

.summary-card__description__summary {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  margin-block-start: 0.4rem;
  font-size: 0.8rem;
  max-height: calc(1.6rem * 1.5);
  overflow: hidden;
  color: #a3a3a3;
}

.summary-card__description__url {
  margin-block-start: 0.6rem;
  font-size: 0.8rem;
  overflow: hidden;
  text-overflow: ellipsis;
  color: #a3a3a3;
}
```

</details>

### Card With Large Image

![card with large image](https://raw.githubusercontent.com/blyoa/gatsby-remark-link-summary/main/examples/card-with-large-image/sample.png)

gatsby-config.js

<details>

```js
const descriptionRule = require("metascraper-description")
const imageRule = require("metascraper-image")
const titleRule = require("metascraper-title")
const urlRule = require("metascraper-url")

module.exports = {
  // snip...
  plugins: [
    // snip...
    {
      resolve: `gatsby-transformer-remark`,
      options: {
        plugins: [
          {
            resolve: `gatsby-remark-link-summary`,
            options: {
              cacheRootDirPath: "cache/link-summary",
              destinationSubDirPath: "link-summary",
              sites: [
                {
                  pattern: /^https:\/\/github\.com\/.*/,
                  generator: async ({
                    metadata: { image, url, title, description },
                    cacheRemoteFile,
                  }) => {
                    const filePath = await cacheRemoteFile(image, true)
                    return `
                      <div class="large-image-summary-card">
                        <a href="${url}">
                          <img
                            class="large-image-summary-card__image"
                            src="${filePath}"
                          />
                          <div class="large-image-summary-card__description">
                            <div class="large-image-summary-card__description__title"
                              >${title}</div
                            >
                            <div class="large-image-summary-card__description__summary"
                              >${description}</div
                            >
                            <div class="large-image-summary-card__description__url"
                              >${url}</div
                            >
                          </div>
                        </a>
                      </div>
                    `
                  },
                  rules: [
                    urlRule(),
                    titleRule(),
                    imageRule(),
                    descriptionRule(),
                  ],
                },
              ],
            },
          },
          // snip...
        ],
      },
    },
    // snip...
  ],
}
```

</details>
your-style-file.css

<details>

```css
/* import css, e.g. from gatsby-browser.js */
.large-image-summary-card {
  line-height: 1.5;
}

.large-image-summary-card a {
  display: flex;
  color: inherit;
  text-decoration: none;
  flex-direction: column;
  border: 1px solid #e5e5e5;
  border-radius: 3px;
}

.large-image-summary-card__image {
  width: 100%;
  object-fit: cover;
  border-block-end: 1px solid #e5e5e5;
}

.large-image-summary-card__description {
  display: flex;
  flex: 1;
  flex-direction: column;
  padding: 1.2rem;
}

.large-image-summary-card__description__title {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  font-weight: 700;
  max-height: calc(2rem * 1.5);
  overflow: hidden;
}

.large-image-summary-card__description__summary {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  margin-top: 0.2rem;
  font-size: 0.8rem;
  max-height: calc(1.6rem * 1.5);
  overflow: hidden;
  color: #a3a3a3;
}

.large-image-summary-card__description__url {
  margin-top: 0.4rem;
  font-size: 0.8rem;
  color: #a3a3a3;
  overflow: hidden;
  text-overflow: ellipsis;
}
```

</details>

