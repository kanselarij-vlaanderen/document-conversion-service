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
  "De viceminister-president van de Vlaamse Regering",
  "Vlaams minister van",
  "Minister-president van de Vlaamse Regering",
  "Viceminister-president van de Vlaamse Regering"
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
    "strike => s",
    "br[type='page'] => div.page",
    "p[style-name='Title'] => h1",
    "p[style-name='Heading 1'] => h2:fresh",
    // "p[style-name='header'] => h3:fresh",
    "p[style-name='opsomming numeriek°'] => ol > li:fresh",
    "p[style-name='List Paragraph'] => ul > li:fresh"
  ],
  ignoreEmptyParagraphs: false
  // includeDefaultStyleMap: false,
};

let enrichNota = function (html) {
  html = html.split('<p></p>').join('<br>');
  html = html.split('<h1></h1>').join('<br>');
  html = html.split('<h2></h2>').join('<br>');
  html = html.split('<h3></h3>').join('<br>');
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

  let notaHtml = cheerio.load(html)('body').first();

  // Wrap all titles known from template in proper header tags
  let mainTitleElems = htmlEnrichers.filterTextElements(notaHtml, function (elem) {
    let notaHeadings = [
      'inhoudelijk',
      'weerslag van het voorstel op de begroting van de vlaamse gemeenschap',
      'weerslag van het voorstel op de lokale besturen',
      'weerslag van het voorstel op het personeelsbestand en de personeelsbudgetten',
      'kwaliteit van de regelgeving',
      'voorstel van beslissing'];
    return notaHeadings.some(function (title) {
      return cheerio(elem).text().trim().toLowerCase().endsWith(title);
    });
  });
  if (mainTitleElems.length > 0) {
    mainTitleElems.forEach(function (elem) {
      console.log("Found title:", elem.text());
      if (elem.parent().get(0).tagName !== 'h2') {
        elem.wrap('<h2></h2>');
      }
      elem = elem.parent();
      elem = htmlEnrichers.unwrapUntil(elem, 'body');
    });
  }

  // Find first section header (title) and use it as end-boundary for the header
  const firstMainElems = htmlEnrichers.filterTextElements(notaHtml, function (elem) {
    let knownFirstTitle = [
      'inhoudelijk',
      'inleiding',
      'toelichting',
      'situering',
      'historiek'].includes(_.trim(elem.text().toLowerCase(), '1234567890. \t'));
    if (knownFirstTitle) {
      return true;
    } else if (elem.text().trim().startsWith('1. ')) {
      return true;
    } else {
      return false;
    }
  });
  if (firstMainElems.length > 0) {
    let firstMainElem = firstMainElems[0];
    console.log("Found first section header:", firstMainElem.text());

    if (firstMainElem.parent().get(0).tagName !== 'h2') {
      firstMainElem.wrap('<h2></h2>');
    }
    firstMainElem = firstMainElem.parent().addClass('temp_ref');
    firstMainElem = htmlEnrichers.unwrapUntil(firstMainElem, 'body').first();
    firstMainElem = notaHtml.find('.temp_ref').removeClass('temp_ref');
    let headerElems = notaHtml.contents().slice(0, firstMainElem.index());
    headerElems.wrapAll('<header></header>');

    // Wrap section tags around each titled parts of text
    notaHtml.children().not('header').filter('h2').each(function (i, elem) {
      console.log("Found section header:", cheerio(this).text());
      cheerio(this).nextUntil('h2').addBack().wrapAll('<section></section>');
    });

    // Last section stretches over whole footer. Try to separate last section and footer by finding the first signature within the last section
    let signatures = htmlEnrichers.filterTextElements(notaHtml.find('section').last(), function (elem) {
      return MinisterTitleStarts.some(function (titleStart) {
        return elem.text().toLowerCase().trim().startsWith(titleStart.toLowerCase());
      });
    });
    if (signatures.length > 0) {
      signatures.forEach(function (signature) {
        signature.wrap('<span class="minister-title"></span>');
        console.log("Found signature title:", signature.text());
      });
      let firstSignatureTitle = notaHtml.find('section:last-of-type .minister-title').parentsUntil(notaHtml.find('section:last-of-type').get(0)).last();
      console.log("First signature title:", firstSignatureTitle.text());
      let footerElems = firstSignatureTitle.nextAll().addBack();
      footerElems.wrapAll('<footer></footer>').parent();
      notaHtml.find('footer').insertAfter(notaHtml.find('section').last());
    }
    notaHtml.find('section').wrapAll('<main></main>');

    const header = notaHtml.find('header').first();
    const main = notaHtml.find('main').first();
    const footer = notaHtml.find('footer').first();

    // Put logo at top of header (get out of table sometimes ...) and add new logo
    let headerImg = header.find('img').first();
    if (headerImg) {
      header.prepend(headerImg);
      headerImg.addClass('original-logo');
      let newLogo = cheerio('<div class="vr-logo-wrapper inserted-logo"><img src="/kaleidos-viewer/assets/Logo_Vlaamse_Regering.svg" alt="Logo Vlaamse Regering"></div>');
      headerImg.after(newLogo);
    }

    // Put minister titles underneath Logo
    let ministerTitelElems = htmlEnrichers.filterTextElements(header, function (elem) {
      return isMinisterTitel(elem.text());
    });
    if (ministerTitelElems.length > 0) {
      console.log('Found minister titles', ministerTitelElems.length);
      ministerTitelElems.forEach(function (elem) {
        let replacements = regexEnrichers.flemishMinisterTitles(elem.text());
        console.log(replacements);
        let newTitles = cheerio(regexUtils.applyReplacements(elem.text(), replacements));
        elem.replaceWith(newTitles);
      });
      let ministerTitles = header.find('.minister-title');
      ministerTitles.parent().remove();
      let ministerList = cheerio('<ul class="minister-titles"></ul>');
      ministerList.append(ministerTitles);
      ministerTitles.wrap('<li></li>');
      ministerList.insertAfter(header.find('.vr-logo-wrapper'));
    }

    // Move document title after minister titles
    let title = header.find('h1').first();
    if (title.text().toLowerCase().includes('nota aan')) {
      title.addClass('title').insertAfter(header.find('.minister-titles'));
    }

    // Detect attachments in header
    let attachments = header.contents().filter(function (id, elem) {
      return cheerio(elem).text().toLowerCase().trim().startsWith('bijlage');
    });
    if (attachments.length > 0) {
      console.log('Found attachments', attachments.first());
      attachments.first().nextAll().addBack().wrapAll('<div class="attachments"></div>');
    }

    // Detect subjects and move into list
    let foundFirstSubject = false;
    let subjects = header.contents().filter('h2, p').filter(function (id, elem) {
      let txt = cheerio(elem).text().toLowerCase().trim();
      if (txt.startsWith('betreft')) {
        foundFirstSubject = true;
        return true;
      } else {
        return foundFirstSubject ? txt.startsWith('-') : false;
      }
    });
    if (subjects.length > 0) {
      // strip 'betreft' and '-'
      let txtNode = htmlEnrichers.filterTextElements(subjects.first(), (txt) => txt !== '')[0];
      txtNode.get(0).data = _.trim(txtNode.get(0).data.trim().slice('betreft'.length), ' :-\t');
      let subjectsList = cheerio(`<ul class="subjects"></ul>`);
      subjects.each(function (i, elem) {
        let subject = cheerio(elem);
        console.log("Found subject:", subject.text());
        txtNode = htmlEnrichers.filterTextElements(subject, (txt) => txt !== '')[0];
        txtNode.get(0).data = _.trim(txtNode.get(0).data, ' -\t');
        let listElem = cheerio('<span class="subject"></span>').append(subject.contents()).wrap('<li></li>').parent();
        subjectsList.append(listElem);
      });
      subjects.first().replaceWith(subjectsList);
      subjectsList.wrap('<div class="concerns"></div>');
    }

    // Add lingering elements to subjects
    header.find('.concerns').nextUntil('.attachments').not('br, :empty').each(function (i, elem) {
      let subject = cheerio(elem);
      if (subject.text().trim() !== '') {
        let listElem = cheerio('<span class="subject"></span>').append(subject.contents()).wrap('<li></li>').parent();
        header.find('.concerns .subjects').append(listElem);
      }
    });

    // remove empty elements from header
    let emptyElems = header.contents().filter((idx, elem) => cheerio(elem).text().trim() === '').not('img').not('div'); // workaround: filter(':empty') doesn't select all empty elements
    emptyElems.remove();

    // Detect attachments in footer
    attachments = footer.contents().filter(function (id, elem) {
      return cheerio(elem).text().toLowerCase().trim().startsWith('bijlage');
    });
    if (attachments.length > 0) {
      console.log('Found attachments', attachments.first());
      attachments.first().nextAll().addBack().wrapAll('<div class="attachments"></div>');
    }

    // Detect dangling minister name in last main section
    let ministerName = main.find('section').last().contents().not('h2').filter(function (id, elem) {
      return cheerio(elem).text().match(/[A-Z]{3,}(\s+)?,?(\s+)?$/g);
    });
    if (ministerName.length > 0) {
      ministerName.last().prependTo(footer);
    }
    // Detect minister names and move into list
    let ministerNames = footer.contents().filter(function (id, elem) {
      return cheerio(elem).text().match(/[A-Z]{3,}(\s+)?,?(\s+)?$/g);
    });
    if (ministerNames.length > 0) {
      ministerNames.each(function (i, elem) {
        let foundFirst = false;
        let ministerNamesText = htmlEnrichers.filterTextElements(cheerio(elem), function (elem) {
          if (!foundFirst) {
            foundFirst = true;
            return true;
          } else {
            return false;
          }
        });
        ministerNamesText.forEach(function (elem) {
          elem.parent().contents().wrapAll('<span class="minister-name"></span>');
        });
      });
    }

    // Group minister titles and names into signatures
    let ministerTitles = footer.find('.minister-title');
    ministerNames = footer.find('.minister-name');
    if (ministerTitles.length > 0 && (ministerTitles.length === ministerNames.length)) {
      let ministerList = cheerio('<ul class="minister-signatures"></ul>');
      ministerTitles.each(function (i, elem) {
        let ministerSignature = cheerio('<span class="minister-signature"></span>');
        ministerSignature.append(cheerio(elem));
        ministerSignature.append(ministerNames[i]);
        ministerList.append(ministerSignature);
        ministerSignature.wrap('<li></li>');
      });
      footer.prepend(ministerList);
    }
  }

  return notaHtml.html();
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
      return enrichNota(html);
    });

    return resolve(enrichment);
  });
};

module.exports = convert;
