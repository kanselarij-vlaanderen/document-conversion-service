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

var imageConverter = mammoth.images.imgElement(function (image) {
  return image.read().then(function (imageBuffer) {
    let fileProperties = {
      uuid: uuid(),
      type: image.contentType
    };
    fileProperties.name = fileProperties.uuid;
    const fileDownloadPath = `files/${fileProperties.uuid}/download`;
    persistFile(fileProperties, imageBuffer, config.IMG_PATH).then(() => {
      return {
        src: fileDownloadPath
      };
    });
  });
});

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
  convertImage: imageConverter,
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
      console.log('Found title:', elem.text());
      if (elem.parent().get(0).tagName !== 'h2') {
        // console.log('Element wasnt h2:', elem.parent().get(0).tagName);
        elem.wrap('<h2></h2>');
      }
      elem = elem.parent();
      // console.log('Element now is', elem.get(0).tagName);
      // console.log('Element parent', elem.parent().get(0).tagName);
      elem = htmlEnrichers.unwrapUntil(elem, 'body');
      // console.log('Unwrapped element is', elem);
    });
  }
  // 
  // notaHtml.find('p:empty').replaceWith('<br>');
  // notaHtml.find('p').each(function(i, elem) {
  //   console.log('selected text', $(this).text());
  // });
  const firstMainElems = htmlEnrichers.filterTextElements(notaHtml, function (elem) {
    if (elem.text().trim().startsWith('1. ') || elem.text().trim().startsWith('1 ')) {
      return true;
    }
    return [
      'inhoudelijk',
      'inleiding',
      'toelichting',
      'situering',
      'historiek'].includes(elem.text().trim().toLowerCase());
  });
  if (firstMainElems.length > 0) {
    let firstMainElem = firstMainElems[0];

    if (firstMainElem.parent().get(0).tagName !== 'h2') {
      console.log('Element wasnt h2:', firstMainElem.parent().get(0).tagName);
      firstMainElem.wrap("<h2></h2>");
    }
    firstMainElem = firstMainElem.parent().addClass('temp_ref');
    firstMainElem = htmlEnrichers.unwrapUntil(firstMainElem, 'body').first();
    firstMainElem = notaHtml.find('.temp_ref').removeClass('.temp_ref');
    let headerElems = notaHtml.contents().slice(0, firstMainElem.index());
    if (headerElems.length > 0) {
      console.log("FOUND HEADER ELEMS");
      // console.log("header elements", headerElems );
    }
    headerElems.wrapAll('<header></header>');

    notaHtml.children().not('header').filter('h2').each(function (i, elem) {
      cheerio(this).nextUntil('h2').addBack().wrapAll('<section></section>');
    });
    // // Try to find signature in last section
    let signatures = htmlEnrichers.filterTextElements(notaHtml.find('section').last(), function (elem) {
      // console.log(elem.text())
      // if (elem.text().toLowerCase().contains('minister')){
      // }
      return MinisterTitleStarts.some(function (titleStart) {
        return elem.text().toLowerCase().trim().startsWith(titleStart.toLowerCase());
      });
    });
    if (signatures.length > 0) {
      signatures.forEach(function (signature) {
        signature.wrap('<span class="minister-title"></span>');
        console.log("FOUND SIGNATURE", signature.text());
      });
      let firstSignatureTitle = notaHtml.find('section:last-of-type .minister-title').parentsUntil(notaHtml.find('section:last-of-type').get(0)).last();
      console.log("First signature title", firstSignatureTitle);
      let footerElems = firstSignatureTitle.nextAll().addBack();
      // console.log("FOOTER ELEMS parent", signatures[0].parentsUntil('section'));
      // console.log("FOOTER ELEMS", footerElems);
      footerElems.wrapAll('<footer></footer>').parent();
      notaHtml.find('footer').insertAfter(notaHtml.find('section').last());
      // notaHtml.append(footer);
      // footer.appendTo(notaHtml);
    }
    notaHtml.find('section').wrapAll('<main></main>');

    let header = notaHtml.find('header').first();

    // Put image at top of header (get out of table sometimes ...)
    let headerImg = header.find('img').first().attr('src', 'assets/Logo_Vlaamse_Regering.svg'); // .wrap('<div class=\"vr-logo-wrapper\">').parent();
    if (headerImg) {
      header.prepend(headerImg);
      headerImg.wrap('<div class="vr-logo-wrapper"></div>');
    }

    // Put minister titles underneath image
    let ministerList = cheerio('<ul class="minister-titles"></ul>');
    // Primary method
    let ministerTitelElems = header.find('p').filter(function (id, elem) {
      return isMinisterTitel(cheerio(elem).text());
    });
    if (ministerTitelElems) {
      ministerTitelElems.each(function (i, elem) {
        let ministerLine = cheerio(`<li class="minister-title">${cheerio(this).text()}</li>`);
        ministerList.append(ministerLine);
        cheerio(this).remove();
      });
    }
    ministerTitelElems = [];
    ministerTitelElems = htmlEnrichers.filterTextElements(header, function (elem) {
      return isMinisterTitel(elem.text());
    });
    // Fallback/supplementary method
    if (ministerTitelElems) {
      console.log('Found minister titles', ministerTitelElems.length);
      ministerTitelElems.forEach(function (elem) {
        let cleanTitle = elem.text().replace(/(^((En)|[ ])+)|(((en)|[, ])+$)/gi, '');
        cleanTitle[0] = cleanTitle[0].toUpperCase();
        let ministerLine = cheerio(`<li class="minister-title">${cleanTitle}</li>`);
        ministerList.append(ministerLine);
        elem.remove();
        console.log('orig: ', elem.text());
        console.log('minister: ', cleanTitle);
      });
    }
    ministerList.insertAfter(header.find('.vr-logo-wrapper'));

    // Move title after Ministers
    let title = header.find('h1').first();
    if (title.text().toLowerCase().includes('nota aan')) {
      title.addClass('title').insertAfter(header.find('.minister-titles'));
    }

    // Detect subjects and move into list
    let subjectsList = cheerio('<ul class="subjects"></ul>');
    let firstSubject = header.find('h2').filter(function (id, elem) {
      return cheerio(elem).text().toLowerCase().trim().startsWith('betreft:');
    }).first();
    if (firstSubject.length > 0) {
      console.log('Trimmimg', firstSubject.text().trim().slice('betreft:'.length));
      let cleanSubject = _.trim(firstSubject.text().trim().slice('betreft:'.length), ' -\t');
      let subjectLine = cheerio(`<li><span class="subject">${cleanSubject}</span></li>`);
      subjectsList.append(subjectLine);
      // console.log('First subject', firstSubject.text());
      let nextSubjects = firstSubject.nextAll('h2');
      console.log(`Found ${1 + nextSubjects.length} subjects`);
      nextSubjects.each(function (i, elem) {
        cleanSubject = _.trim(cheerio(this).text(), ' -\t');
        subjectLine = cheerio(`<li><span class="subject">${cleanSubject}</span></li>`);
        subjectsList.append(subjectLine);
        cheerio(this).remove();
        // console.log('Following subjects', $(this).text());
      });
      firstSubject.remove();
    }
    subjectsList.insertAfter(header.find('.title')).wrap('<div class="concerns"></div>');
    // let ministerList = cheerio('<ul class="minister-titles"></ul>');

    // remove empty elements
    let emptyElems = header.contents().filter((idx, elem) => cheerio(elem).text().trim() === '').not('img').not('br').not('div'); // workaround: filter(':empty') doesn't select all empty elements
    emptyElems.remove();
  }

  return notaHtml.html();
};

let convert = function (filePathIn, filePathOut) {
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
