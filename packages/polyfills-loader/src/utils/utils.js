/** @typedef {import('parse5').Document} Document */
/** @typedef {import('parse5').Node} Node */

const {
  constructors,
  setAttribute,
  append,
  queryAll,
  predicates,
  getAttribute,
  hasAttribute,
} = require('@open-wc/building-utils/dom5-fork');
const crypto = require('crypto');
const { isUri } = require('valid-url');
const { generatedFileTypes, resourceTypes } = require('./constants');

/**
 * @param {string} content
 * @returns {string}
 */
function createContentHash(content) {
  return crypto
    .createHash('md4')
    .update(content)
    .digest('hex');
}

/**
 * @param {string} path
 * @returns {string}
 */
function cleanImportPath(path) {
  if (path.startsWith('/')) {
    return path;
  }

  if (path.startsWith('../') || path.startsWith('./')) {
    return path;
  }

  return `./${path}`;
}

/**
 * @param {string} tag
 * @param {{ [key: string]: string}} attributes
 * @returns {Node}
 */
function createElement(tag, attributes) {
  const element = constructors.element(tag);
  if (attributes) {
    Object.keys(attributes).forEach(key => {
      if (attributes[key] != null) {
        setAttribute(element, key, attributes[key]);
      }
    });
  }
  return element;
}

/**
 * @param {{ [key: string]: string}} attributes
 * @param {string} [code]
 * @returns {Node}
 */
function createScript(attributes, code) {
  const script = createElement('script', attributes);
  if (code) {
    const scriptText = constructors.text(code);
    append(script, scriptText);
  }
  return script;
}

/** @param {string} code @returns {Node} */
function createScriptModule(code) {
  return createScript({ type: 'module' }, code);
}

/** @param {Node} script @returns {string} */
function getGeneratedFileType(script) {
  return getAttribute(script, 'module') === 'module'
    ? generatedFileTypes.JS_MODULE
    : generatedFileTypes.JS_SCRIPT;
}

/** @param {Node} script @returns {string} */
function getResourceType(script) {
  return getAttribute(script, 'type') === 'module'
    ? resourceTypes.JS_MODULE
    : resourceTypes.JS_SCRIPT;
}

/**
 * @param {import('../loader/create-polyfills-loader').CreatePolyfillsLoaderConfig} cfg
 * @param {string} type
 */
function hasResourceOfType(cfg, type) {
  return (
    cfg.resources.some(r => r.type === type) ||
    (cfg.legacyResources && cfg.legacyResources.some(lg => lg.resources.some(r => r.type === type)))
  );
}

/**
 * @param {Document} document
 * @returns {{ inline: Node[], external: Node[]}}
 */
function findImportMapScripts(document) {
  const scripts = queryAll(document, predicates.hasTagName('script')).filter(
    script => getAttribute(script, 'type') === 'importmap',
  );

  /** @type {Node[]} */
  const inline = [];
  /** @type {Node[]} */
  const external = [];
  scripts.forEach(script => {
    if (getAttribute(script, 'src')) {
      external.push(script);
    } else {
      inline.push(script);
    }
  });

  return { inline, external };
}

/**
 * @param {Document} document
 * @param {{ jsScripts?: boolean, jsModules?: boolean, inlineJsScripts?: boolean, inlineJsModules?: boolean }} include
 * @returns {Node[]}
 */
function findJsScripts(document, include) {
  const allScripts = queryAll(document, predicates.hasTagName('script'));

  return allScripts.filter(script => {
    const inline = !hasAttribute(script, 'src');
    const type = getAttribute(script, 'type');

    // we don't handle scripts which import from a URL (ex. a CDN)
    if (!inline && isUri(getAttribute(script, 'src'))) {
      return false;
    }

    if (!type || ['application/javascript', 'text/javascript'].includes(type)) {
      return inline ? include.inlineJsScripts : include.jsScripts;
    }
    if (type === 'module') {
      return inline ? include.inlineJsModules : include.jsModules;
    }
    return false;
  });
}

/** @param {Node} script */
function isDeferred(script) {
  return getAttribute(script, 'type') === 'module' || hasAttribute(script, 'defer');
}

/** @param {Node} script */
function isAsync(script) {
  return hasAttribute(script, 'async');
}

/** @param {Node[]} scripts @returns {Node[]} */
function sortScripts(scripts) {
  return scripts.sort((a, b) => {
    if (isAsync(a)) {
      return 0;
    }

    const aDeferred = isDeferred(a);
    const bDeferred = isDeferred(b);

    if (aDeferred && bDeferred) {
      return 0;
    }

    if (aDeferred) {
      return 1;
    }

    if (bDeferred) {
      return -1;
    }

    return 0;
  });
}

module.exports = {
  createContentHash,
  cleanImportPath,
  createElement,
  createScript,
  createScriptModule,
  findImportMapScripts,
  findJsScripts,
  sortScripts,
  getGeneratedFileType,
  getResourceType,
  hasResourceOfType,
};
