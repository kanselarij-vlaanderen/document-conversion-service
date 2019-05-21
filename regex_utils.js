"use strict";

const fs = require('fs');

const matchAll = require('string.prototype.matchall');
matchAll.shim(); // PolyFill

function replaceRange (s, start, end, substitute) {
  return s.substring(0, start) + substitute + s.substring(end);
}

/**
 * Apply replacements (produced by regex_enrichers)
 *
 * @param {string} - String from which parts will be replaced
 * @param {Object[]} n - An array of replacement objects of the format
 * [
 *   {
 *     index: 4,
 *     source: "the cow",
 *     replace: "cat"
 *   },
 *   ...
 * ]
 *
 * @return {string} - The string with replacements applied
 */
const applyReplacements = function (string, replacements) {
  replacements.sort(function (a, b) {
    if (a['index'] < b['index']) {
      return -1;
    }
    if (a['index'] > b['index']) {
      return 1;
    }
    // a must be equal to b
    return 0;
  });
  if (replacements.length > 2) { // Check if regex replace ranges overlap to avoid interfering (if so, drop replacement)
    for (let i = 0; i < (replacements.length - 1); i++) {
      if ((replacements[i]['index'] + replacements[i]['source'].length) > replacements[i + 1]['index']) {
        console.log(`Interfering replacement at ${replacements[i + 1]['index']}: ${replacements[i + 1]['source']}, dropping ...`);
        replacements.splice(i + 1, 1);
        i--;
      }
    }
  }
  let indexDiff = 0;
  for (const replacement of replacements) { // apply all regex replacements
    let from = replacement['index'] + indexDiff;
    let to = from + replacement['source'].length;
    string = replaceRange(string, from, to, replacement['replace']);
    indexDiff += replacement['replace'].length - replacement['source'].length;
  }
  return string;
};

const loadRegexFromFile = function (path, flags) {
  let file = fs.readFileSync(path, 'utf8');
  let lines = file.split('\n');
  let i = 0;
  let regex = '';
  while (i < lines.length && lines[i].trim() !== '') {
    regex += lines[i].trim();
    i++;
  }
  return new RegExp(regex, flags);
};

module.exports = {
  loadRegexFromFile,
  applyReplacements
};
