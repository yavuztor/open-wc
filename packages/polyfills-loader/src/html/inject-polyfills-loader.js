/** @typedef {import('parse5').Document} DocumentAst */
/** @typedef {import('../loader/create-polyfills-loader').PolyfillsConfig} PolyfillsConfig */
/** @typedef {import('../loader/create-polyfills-loader').GeneratedFile} GeneratedFile */
/** @typedef {import('../loader/create-polyfills-loader').Resource} Resource */
/** @typedef {import('../loader/create-polyfills-loader').LegacyResources} LegacyResources */

/**
 * @typedef {object} InjectPolyfillsConfig
 * @property {PolyfillsConfig} [polyfills]
 * @property {boolean} jsScripts
 * @property {boolean} jsModules
 * @property {boolean} inlineJsScripts
 * @property {boolean} inlineJsModules
 * @property {string} [generatedFileDir]
 * @property {(index: number) => string} [generateInlineScriptName]
 * @property {Resource[]} [extraResources]
 * @property {string} [moduleType]
 * @property {{ moduleType: string, test: string, extraResources?: Resource[] }[]} [legacy]
 */

const { parse, serialize } = require('parse5');
const {
  query,
  predicates,
  getAttribute,
  setAttribute,
  remove,
  insertAfter,
  getTextContent,
  append,
  cloneNode,
} = require('@open-wc/building-utils/dom5-fork');
const path = require('path');
const {
  createPolyfillsLoader,
  DEFAULT_POLYFILLS_DIR,
} = require('../loader/create-polyfills-loader');
const {
  createScript,
  findImportMapScripts,
  findJsScripts,
  sortScripts,
  getGeneratedFileType,
  getResourceType,
} = require('../utils/utils');
const { resourceTypes } = require('../utils/constants');

const { join } = path.posix;

/**
 * @param {DocumentAst} documentAst
 * @param {Node} headAst
 * @param {InjectPolyfillsConfig} cfg
 */
function injectImportMapPolyfills(documentAst, headAst, cfg) {
  const legacyModuleTypes = cfg.legacy ? cfg.legacy.map(leg => leg.moduleType) : [];
  if ([cfg.moduleType, ...legacyModuleTypes].includes(resourceTypes.JS_SYSTEMJS)) {
    const importMapScripts = findImportMapScripts(documentAst);

    [...importMapScripts.external, ...importMapScripts.inline].forEach(script => {
      const systemJsScript = cloneNode(script);
      setAttribute(systemJsScript, 'type', 'systemjs-importmap');
      insertAfter(headAst, script, systemJsScript);
    });
  }
}

/**
 * @param {Resource[]} resources
 * @param {InjectPolyfillsConfig} cfg
 */
function getLegacyResources(resources, cfg) {
  if (!cfg.legacy) {
    return null;
  }

  /**
   * Sets legacy module type for js modules
   * @param {Resource} r
   * @param {string} legacyModuleType
   */
  function mapResource(r, legacyModuleType) {
    return { ...r, type: r.type === resourceTypes.JS_MODULE ? legacyModuleType : r.type };
  }

  return cfg.legacy.map(leg => ({
    test: leg.test,
    resources: [
      ...(leg.extraResources || []),
      ...resources.map(r => mapResource(r, leg.moduleType)),
    ],
  }));
}

/**
 * @param {DocumentAst} documentAst
 * @param {InjectPolyfillsConfig} cfg
 */
function getResources(documentAst, cfg) {
  /** @type {GeneratedFile[]} */
  const inlineScripts = [];
  let inlineScriptI = 0;
  const unsortedScripts = findJsScripts(documentAst, {
    jsScripts: cfg.jsScripts,
    jsModules: cfg.jsModules,
    inlineJsScripts: cfg.inlineJsScripts,
    inlineJsModules: cfg.inlineJsModules,
  });
  const sortedScripts = sortScripts(unsortedScripts);

  /** @type {Resource[]}  */
  const sharedResources = [];
  sortedScripts.forEach(script => {
    let src = getAttribute(script, 'src');
    if (!src) {
      // generate filename for inline script
      const name = cfg.generateInlineScriptName
        ? cfg.generateInlineScriptName(inlineScriptI)
        : `inline-script-${inlineScriptI}.js`;
      src = join(cfg.generatedFileDir || '', name);

      // register inline script as generated file
      inlineScripts.push({
        path: src,
        type: getGeneratedFileType(script),
        content: getTextContent(script),
      });
      inlineScriptI += 1;
    }

    const resourceType = getResourceType(script);

    // allow overriding the module type from config
    const type =
      cfg.moduleType && resourceType === resourceTypes.JS_MODULE ? cfg.moduleType : resourceType;

    // register resource
    sharedResources.push({ type, path: src });

    // remove script from document
    remove(script);
  });

  const resources = [...(cfg.extraResources || []), ...sharedResources];

  /** @type {LegacyResources[]} */
  const legacyResources = getLegacyResources(sharedResources, cfg);

  return { resources, legacyResources, inlineScripts };
}

/**
 * @param {Resource[]} resources
 * @param {LegacyResources[]} legacyResources
 * @param {Node} bodyAst
 * @param {InjectPolyfillsConfig} cfg
 */
function injectLoader(resources, legacyResources, bodyAst, cfg) {
  const polyfillsLoader = createPolyfillsLoader({
    resources,
    polyfillsDir: join(cfg.generatedFileDir || '', DEFAULT_POLYFILLS_DIR),
    polyfills: cfg.polyfills,
    legacyResources,
  });

  const loaderScript = createScript({}, polyfillsLoader.code);
  append(bodyAst, loaderScript);
  return polyfillsLoader.generatedFiles;
}

/**
 * Transforms an index.html file, injecting a polyfills loader for
 * compatibility with older browsers.
 *
 * @param {string} htmlString
 * @param {InjectPolyfillsConfig} cfg
 * @returns {{ htmlString: string, inlineScripts: GeneratedFile[], polyfills: GeneratedFile[] }}
 */
function injectPolyfillsLoader(htmlString, cfg) {
  if (
    (!cfg.legacy || !cfg.legacy.length) &&
    !cfg.polyfills &&
    (!cfg.moduleType || cfg.moduleType === resourceTypes.JS_MODULE)
  ) {
    return { htmlString, inlineScripts: [], polyfills: [] };
  }

  /** @type {DocumentAst} */
  const documentAst = parse(htmlString);

  const headAst = query(documentAst, predicates.hasTagName('head'));
  const bodyAst = query(documentAst, predicates.hasTagName('body'));

  if (!headAst || !bodyAst) {
    throw new Error(`Invalid index.html: missing <head> or <body>`);
  }

  const { resources, legacyResources, inlineScripts } = getResources(documentAst, cfg);
  const polyfills = injectLoader(resources, legacyResources, bodyAst, cfg);
  injectImportMapPolyfills(documentAst, headAst, cfg);

  return {
    htmlString: serialize(documentAst),
    inlineScripts,
    polyfills,
  };
}

module.exports = {
  injectPolyfillsLoader,
};
