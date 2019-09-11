/** @typedef {import('./src/loader/create-polyfills-loader').PolyfillsConfig} PolyfillsConfig */
/** @typedef {import('./src/loader/create-polyfills-loader').Resource} Resource */
/** @typedef {import('./src/loader/create-polyfills-loader').LegacyResources} LegacyResources */
/** @typedef {import('./src/loader/create-polyfills-loader').CreatePolyfillsLoaderConfig} CreatePolyfillsLoaderConfig */
/** @typedef {import('./src/loader/create-polyfills-loader').PolyfillConfig} PolyfillConfig */
/** @typedef {import('./src/loader/create-polyfills-loader').PolyfillsData} PolyfillsData */
/** @typedef {import('./src/loader/create-polyfills-loader').PolyfillsLoader} PolyfillsLoader */
/** @typedef {import('./src/html/inject-polyfills-loader').GeneratedFile} GeneratedFile */
/** @typedef {import('./src/html/inject-polyfills-loader').InjectPolyfillsConfig} InjectPolyfillsConfig */

const { injectPolyfillsLoader } = require('./src/html/inject-polyfills-loader');
const { createPolyfillsLoader } = require('./src/loader/create-polyfills-loader');
const { resourceTypes, generatedFileTypes, noModuleSupportTest } = require('./src/utils/constants');

module.exports = {
  injectPolyfillsLoader,
  createPolyfillsLoader,

  resourceTypes,
  generatedFileTypes,
  noModuleSupportTest,
};
