const Terser = require('terser');
const htmlMinifier = require('html-minifier');

const defaultMinifyHTMLConfig = {
  collapseWhitespace: true,
  conservativeCollapse: true,
  removeComments: true,
  removeRedundantAttributes: true,
  removeScriptTypeAttributes: true,
  removeStyleLinkTypeAttributes: true,
  useShortDoctype: true,
  minifyCSS: true,
  minifyJS: code => Terser.minify(code).code,
};

/**
 * @param {string} htmlString
 * @param {object} config
 */
function minifyHTML(htmlString, config = defaultMinifyHTMLConfig) {
  return htmlMinifier.minify(htmlString, config);
}

module.exports = {
  minifyHTML,
};
