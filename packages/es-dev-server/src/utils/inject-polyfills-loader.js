/** @typedef {import('polyfills-loader').GeneratedFile} GeneratedFile */

/**
 * @typedef {object} InjectPolyfillsLoaderConfig
 * @property {string} indexHTMLString
 * @property {string} indexUrl
 * @property {string} compatibilityMode
 * @property {string} polyfillsMode
 * @property {boolean} hashPolyfills
 * @property {import('./user-agent-compat').UserAgentCompat} uaCompat
 */

import {
  injectPolyfillsLoader as originalInjectPolyfillsLoader,
  resourceTypes,
} from 'polyfills-loader';
import { compatibilityModes, polyfillsModes, virtualFilePrefix } from '../constants.js';

export const systemJsTransformResolverPath = `${virtualFilePrefix}systemjs-transform-resolver.js`;

/** @type {import('polyfills-loader').PolyfillsConfig} */
const allPolyfills = {
  coreJs: true,
  regeneratorRuntime: true,
  fetch: true,
  webcomponents: true,
};

/** @type {import('polyfills-loader').PolyfillsConfig} */
const allPolyfillsWithSystemjs = {
  ...allPolyfills,
  systemJsExtended: true,
};

/**
 * In max compatibility mode, we need to load the regenerator runtime on all browsers since
 * we're always compiling to es5.
 */
/** @type {import('polyfills-loader').PolyfillsConfig} */
const maxPolyfills = {
  ...allPolyfillsWithSystemjs,
  regeneratorRuntime: 'always',
};

/**
 * @param {InjectPolyfillsLoaderConfig} cfg
 */
function getPolyfills(cfg) {
  if (cfg.polyfillsMode === polyfillsModes.NONE) {
    return {};
  }

  switch (cfg.compatibilityMode) {
    case compatibilityModes.MAX:
      return maxPolyfills;
    case compatibilityModes.MIN:
      return allPolyfills;
    case compatibilityModes.AUTO:
    case compatibilityModes.ALWAYS:
      if (cfg.compatibilityMode === compatibilityModes.AUTO && cfg.uaCompat.modern) {
        return {};
      }

      if (cfg.uaCompat.supportsEsm) {
        return allPolyfills;
      }
      return allPolyfillsWithSystemjs;
    default:
      return {};
  }
}

/**
 * transforms index.html, extracting any modules and import maps and adds them back
 * with the appropriate polyfills, shims and a script loader so that they can be loaded
 * at the right time
 *
 * @param {InjectPolyfillsLoaderConfig} cfg
 * @returns {{ indexHTML: string, inlineScripts: GeneratedFile[], polyfills: GeneratedFile[] }}
 */
export function injectPolyfillsLoader(cfg) {
  const polyfillModules =
    ([compatibilityModes.AUTO, compatibilityModes.ALWAYS].includes(cfg.compatibilityMode) &&
      !cfg.uaCompat.supportsEsm) ||
    cfg.compatibilityMode === compatibilityModes.MAX;

  const result = originalInjectPolyfillsLoader(cfg.indexHTMLString, {
    moduleType: polyfillModules ? resourceTypes.JS_SYSTEMJS : resourceTypes.JS_MODULE,
    // inject systemjs resolver which adds module transform
    extraResources: polyfillModules
      ? [
          {
            type: resourceTypes.JS_SYSTEMJS,
            path: systemJsTransformResolverPath,
          },
        ]
      : [],
    jsScripts: true,
    jsModules: true,
    inlineJsScripts: true,
    inlineJsModules: true,
    generateInlineScriptName: i =>
      `inline-script-${i}.js?source=${encodeURIComponent(cfg.indexUrl)}`,
    polyfills: {
      hash: cfg.hashPolyfills,
      ...getPolyfills(cfg),
    },
  });

  return {
    indexHTML: result.htmlString,
    inlineScripts: result.inlineScripts,
    polyfills: result.polyfills,
  };
}
