"use strict";

const cheerio = require('cheerio');

let filterTextElements = function (node, filterFun) {
  let elements = [];
  node.contents().each(function (ix, el) {
    var $el = cheerio(el);
    for (let i = 0; i < $el.length; i++) {
      switch ($el[i].type) {
        case 'text':
          if (filterFun($el)) {
            elements.push($el);
          }
          break;
        case 'tag':
          elements = elements.concat(filterTextElements($el, filterFun));
          break;
      }
    }
  });
  return elements;
};

let unwrapUntil = function (node, selector) {
  let allParents = node.parentsUntil(selector);
  if (allParents.length > 0) {
    node.insertAfter(allParents.last());
    allParents.remove();
  }
  return node;
};


module.exports = {
  filterTextElements,
  unwrapUntil
};
