"use strict";

import { uuid } from 'mu';

const mammoth = require('mammoth');

const cheerio = require('cheerio');
require('./cheerio_wrapall_polyfill')(cheerio); // Polyfill
const _ = require('lodash');

const regexEnrichers = require('./regex_enrichers');
const regexUtils = require('./regex_utils');

const htmlEnrichers = require('./html_enrichers');

const config = require('./config');
const persistFile = require('./persist_file');

const MinisterTitleStarts = [
  "De Vlaamse minister van",
  "De minister-president van de Vlaamse Regering",
  "De viceminister-president van de Vlaamse Regering"
];

var isMinisterTitel = function (text) {
  let possibleTitle = _.trimStart(text.toLowerCase(), 'en').trim();
  return MinisterTitleStarts.some(function (title) {
    return possibleTitle.startsWith(title.toLowerCase());
  });
};

var isMinisterNaam = function (text) {
  let nameParts = text.split(' ');
  let lastPartIsUpper = (nameParts[-1] === nameParts[-1].toUpperCase());
  return lastPartIsUpper;
};

var options = {
  styleMap: [
    "b => b",
    "i => i",
    "u => u",
    "strike => s"
  ],
  ignoreEmptyParagraphs: false
  // includeDefaultStyleMap: false,
};

let enrichBVR = function (html) {
  html = html.split('<p></p>').join('<br>');
  html = html.split('<b></b>').join('<br>');
  html = html.split('<i></i>').join('<br>');
  html = html.split('<u></u>').join('<br>');
  html = html.split('<s></s>').join('<br>');
  html = html.split('<ol></ol>').join('<br>');
  html = html.split('<ul></ul>').join('<br>');
  html = html.split('<li></li>').join('');
  // html = html.replace('</i><i>', '');
  // html = html.replace('</u><u>', '');

  let replacements = [];
  replacements = replacements.concat(regexEnrichers.stuknummer(html));
  replacements = replacements.concat(regexEnrichers.numericDate(html));
  replacements = replacements.concat(regexEnrichers.alphaNumericDate(html));
  replacements = replacements.concat(regexEnrichers.name(html));
  console.log(regexEnrichers.name(html));
  html = regexUtils.applyReplacements(html, replacements);

  let $ = cheerio.load(html)('body').first();

  // Put logo at top of header (get out of table sometimes ...) and add new logo
  let headerImg = $.find('img').first();
  if (headerImg) {
    console.log("Found header image");
    $.prepend(headerImg);
    headerImg.addClass('original-logo');
    let newLogo = cheerio('<div class="vr-logo-wrapper inserted-logo"><img src="/kaleidos-viewer/assets/Logo_Vlaamse_Regering.svg" alt="Logo Vlaamse Regering"></div>');
    headerImg.after(newLogo);
  }

  // Find title
  let title = $.find('b').filter(function (id, elem) {
    return cheerio(elem).text().toLowerCase().trim().startsWith('Besluit van de Vlaamse Regering'.toLowerCase());
  });
  if (title.length > 0) { 
    console.log("Found title");
    title = title.first();
    title.parent().replaceWith(cheerio('<h1></h1>').append(title.contents()));
  }

  // Find rechtsgrond preamble
  let preamble = $.find('p').filter(function (id, elem) {
    return cheerio(elem).text().trim() === 'DE VLAAMSE REGERING,';
  });
  if (preamble.length > 0) {
    console.log("Found rechtsgrond preamble 'DE VLAAMSE REGERING,'");
    preamble = preamble.first();
    preamble.replaceWith(cheerio('<span class="rechtsgrond-preamble">DE VLAAMSE REGERING,</span>'));
  }

  // Find besluit preamble
  preamble = $.find('p').filter(function (id, elem) {
    return cheerio(elem).text().trim() === 'BESLUIT:';
  });
  if (preamble.length > 0) {
    console.log("Found besluit preamble 'BESLUIT:'");
    preamble = preamble.first();
    preamble.replaceWith(cheerio('<span class="besluit-preamble">BESLUIT:</span>'));
  }

  // Find footer preamble
  let firstFooterElem = $.contents().filter(function (id, elem) {
    return cheerio(elem).text().trim().startsWith('Brussel,');
  });
  if (firstFooterElem.length > 0) {
    console.log("Found footer");
    firstFooterElem = firstFooterElem.last();
    firstFooterElem.nextAll().addBack().wrapAll('<footer></footer>');
  }

  $ = cheerio.load($.html())('body').first(); // HACK: Somehow previous ops break the internal DOM representation, reset

  let rechtsgrondPreamble = $.find('.rechtsgrond-preamble');
  if (rechtsgrondPreamble.length > 0) {
    rechtsgrondPreamble.first().nextUntil('footer').addBack().wrapAll('<main></main>');
    $.contents().first().nextUntil('main').addBack().wrapAll('<header></header>');
  }

  let main = $.find('main');
  if (main.length > 0) {
    let titles = main.contents().filter(function (id, elem) {
      return cheerio(elem).text().trim().startsWith('Titel');
    });
    titles.addClass('temp-marker');
    titles.each(function (i, elem) {
      let title = cheerio(this);
      console.log('Found title:', title.text());
      if ((i + 1) < titles.length) {
        title.nextUntil('.temp-marker').addBack().wrapAll('<section class="title"></section>').end();
      } else {
        title.nextAll().addBack().wrapAll('<section class="title"></section>').end();
      }
    });
    $.find('main .temp-marker').each(function (i, elem) {
      let title = cheerio(this);
      let newTitle = cheerio('<h2></h2>').append(title.contents());
      title.replaceWith(newTitle);
    });
  }

  return $.html();
};

let generateImageConversionHandler = function (filegraph) {
  return function (image) {
    return image.read().then(function (imageBuffer) {
      let fileProperties = {
        uuid: uuid(),
        type: image.contentType
      };
      fileProperties.name = fileProperties.uuid;
      const fileDownloadPath = `files/${fileProperties.uuid}/download`;
      return persistFile(fileProperties, imageBuffer, config.IMG_PATH, filegraph).then(() => {
        return {
          src: fileDownloadPath
        };
      });
    });
  };
};

let convert = function (filePathIn, fileGraph) {
  options.convertImage = mammoth.images.imgElement(generateImageConversionHandler(fileGraph));
  return new Promise((resolve, reject) => {
    let conversion = mammoth.convertToHtml({path: filePathIn}, options);

    let enrichment = conversion.then(function (result) {
      let html = result.value; // The generated HTML
      let messages = result.messages; // Any messages, such as warnings during conversion
      console.log(messages);
      return enrichBVR(html);
    });

    return resolve(enrichment);
  });
};

module.exports = convert;
