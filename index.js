const fs = require('fs-promise');
const postcss = require('postcss');
const hasha = require('hasha');
const globby = require('globby');

const cheerio = require('cheerio');

const COMPEXITY = /[\s>]/;

module.exports = postcss.plugin('postcss-simplify-selectors', function (opts) {


  opts.wrapHTML = opts.wrapHTML || false;

  const getFiles = async() => {
    const response = await globby(opts.html);
    
    if (!response) throw new Error('Must pass a valid list of HTML files');

    opts.html = response;

    const files = await Promise.all(opts.html.map(path => fs.promises.readFile(path)));

    return files.map(file => cheerio.load(file, null, opts.wrapHTML));
  }

  return (root, result) => {
    // Get an array of rules:
    const rules = []
    root.walkRules(rule => rules.push(rule))
    

    return getFiles().then(documents => {
      rules.forEach((rule) => {
        // Seperate selectors by commas, map, and join:
        rule.selector = postcss.list.comma(rule.selector).map(selector => {
          // Test complexity:
          if (!COMPEXITY.test(selector)) return selector;
          // Returns hash or selector
          return checkHTML(selector, documents, opts.wrapHTML);
        })
        .join(',');
      });
      // Replace HTML:
      return documents.map((doc, i) => fs.writeFile(opts.html[i], doc.html()));
    });
  };
});

function checkHTML(selector, documents) {
  let hash;
  documents.forEach(doc => {
    // Query selector:
    const elems = doc(selector);
    //Check if any elements match query selector
    if (elems.length) {
      if (!hash) hash = hasha(selector).substr(0, 5);
  
      elems.addClass(`_${hash}`);
    }
  })
  return hash ? `._${hash} `: selector;
}
