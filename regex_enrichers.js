"use strict";

const matchAll = require('string.prototype.matchall');
matchAll.shim(); // PolyFill

const regexUtils = require('./regexUtils');

const DOSSIERNUMMER_REGEX = /VR(?:\/|\s)(\d{4})(?:\/|\s)(\d{2})(\d{2})(?:\/|\s)(?:(DOC|DEC|MED|VAR)\.(\d{4})(?:\/)(\d))?/gmiu;

let stuknummer = function (input) {
  let matches = input.matchAll(DOSSIERNUMMER_REGEX);
  let outputs = [];
  for (const match of matches) {
    let groups = match.slice(0, match.length);
    let index = match['index'];
    let source = match['input'];
    let matchString = groups[0];
    let t;
    if (groups[3]) {
      t = `Stuknummer VR ${groups[1]} ${groups[2]}${groups[3]} ${groups[4]}.${groups[5]}`;
      if (groups[6]) {
        t = t + `/${groups[6]}`;
      }
    } else {
      t = 'Dossier';
    }
    let replace = `<span class="dossiernummer" title="${t}">${matchString}</span>`;
    outputs.push({
      'index': index,
      'source': matchString,
      'replace': replace
    });
  }
  return outputs;
};


const NUMDATE_REGEX = /(?:\b|\s)([0-3]?[0-9])(?:\/|-)([0-1]?[0-9])(?:\/|-)(\d{2,4})/gmiu;

let numericDate = function (input) {
  let matches = input.matchAll(NUMDATE_REGEX);
  let outputs = [];
  for (const match of matches) {
    let groups = match.slice(0, match.length);
    let index = match['index'];
    let source = match['input'];
    let matchString = groups[0];
    let [day, month, year] = groups.slice(1);
    let date, datestring;
    try {
      date = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day)));
      datestring = date.toISOString().split('T')[0];
    } catch (error) {
      console.error('Failed to parse', day, month, year, ': ', error);
      continue;
    }
    let replace = `<time title="${matchString}" datetime="${datestring}">${matchString}</time>`;
    outputs.push({
      'index': index,
      'source': matchString,
      'replace': replace
    });
  }
  return outputs;
};


const ALPHANUMDATE_REGEX = /([0-3]?[0-9])(?:\s)(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)(?:(?:\s)(\d{4}))?(?:\b|\s)/gmiu;

let alphaNumericDate = function (input) {
  let matches = input.matchAll(ALPHANUMDATE_REGEX);
  let outputs = [];
  for (const match of matches) {
    let groups = match.slice(0, match.length);
    let index = match['index'];
    let source = match['input'];
    let matchString = groups[0];

    let [day, monthAlpha, year] = groups.slice(1);
    if (year === undefined) {
      let d = new Date();
      year = d.getYear();
    }
    monthAlpha = monthAlpha.toLowerCase();
    let monthMap = {
      'januari': 1,
      'februari': 2,
      'maart': 3,
      'april': 4,
      'mei': 5,
      'juni': 6,
      'juli': 7,
      'augustus': 8,
      'september': 9,
      'oktober': 10,
      'november': 11,
      'december': 12
    };
    let monthNum;
    try {
      monthNum = monthMap[monthAlpha];
    } catch (e) {
      console.error(`${monthAlpha} is not a valid month`);
    }
    let date, datestring;
    try {
      date = new Date(Date.UTC(parseInt(year), monthNum - 1, parseInt(day)));
      datestring = date.toISOString().split('T')[0];
    } catch (error) {
      console.error('Failed to parse', day, monthAlpha, year, ': ', error);
      continue;
    }
    // console.log(match);
    let replace = `<time title="${matchString}" datetime="${datestring}">${matchString}</time>`;
    outputs.push({
      'index': index,
      'source': matchString,
      'replace': replace
    });
  }
  return outputs;
};



const NAME_REGEX = regexUtils.loadRegexFromFile('./regex/name.regex', 'gmu');

let name = function (input) {
  let matches = input.matchAll(NAME_REGEX);
  let outputs = [];
  for (const match of matches) {
    let groups = match.slice(0, match.length);
    let index = match['index'];
    let source = match['input'];
    let matchString = groups[0];

    let [title, infix, fullOrLastName] = groups.slice(1);
    let name = infix ? infix + ' ' + fullOrLastName : fullOrLastName;
    let predicate = infix ? 'familyName' : 'name';
    let replace = `
      <span vocab="http://xmlns.com/foaf/0.1/" typeof="Person">
        <span property="title">${title}</span>
        <span property="${predicate}">${name}</span>
      </span>`;
    outputs.push({
      'index': index,
      'source': matchString,
      'replace': replace
    });
  }
  return outputs;
};



const MINISTER_TITLES_REGEX = regexUtils.loadRegexFromFile('./regex/flemish_minister_titles.regex', 'igmu');

let flemishMinisterTitles = function (input) {
  let matches = input.matchAll(MINISTER_TITLES_REGEX);
  let outputs = [];
  for (const match of matches) {
    let groups = match.slice(0, match.length);
    let index = match['index'];
    let source = match['input'];
    let matchString = groups[0];

    let replace;
    for (const group of groups) {
      replace = replace.concat(`<span class="minister-title">${group}</span>`);
    }
    outputs.push({
      'index': index,
      'source': matchString,
      'replace': replace
    });
  }
  return outputs;
};


module.exports = {
  stuknummer,
  numericDate,
  alphaNumericDate,
  name,
  flemishMinisterTitles
};