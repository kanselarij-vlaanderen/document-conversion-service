"use strict";

import { uuid } from 'mu';

const fs = require('fs');
const path = require('path');

const config = require('./config');
const queries = require('./queries');
const convertNota = require('./convert_nota');

const beautifyHtml = require('js-beautify').html;
const fsp = fs.promises;

const NOTA_URI = 'http://kanselarij.vo.data.gift/id/concept/document-type-codes/9e5b1230-f3ad-438f-9c68-9d7b1b2d875d';
const DOC_TEMPLATE = fs.readFileSync('./document_output_template.hbs', 'utf8');


let convertDocument = async function (documentVersionUuid) {
  let documentVersion = await queries.fetchDocumentVersion(documentVersionUuid);
  return new Promise((resolve, reject) => {
    if (documentVersion.length < 1) {
      return reject(new Error(`No document version found by uuid '${documentVersionUuid}', abort ...`));
    } else {
      documentVersion = documentVersion[0];
    }
    if (!(documentVersion.fileExtension === 'docx')) {
      return reject(new Error(`File has extension '${documentVersion.fileExtension}' instead of 'docx', abort ...`));
    }
    let sharePath = documentVersion.physicalFile.replace('share://', '');
    let filePath = path.join(config.SHARE_FOLER_PATH, sharePath);

    if (documentVersion.documentType === NOTA_URI) {
      let type = 'nota';
      let fileProperties = {
        uuid: uuid(),
        type: 'text/html',
        extension: 'html'
      };
      fileProperties.name = documentVersion.name || fileProperties.uuid;
      let fileName = `${fileProperties.name}.${fileProperties.extension}`;
      let fileUri = config.FILE_RESOURCES_PATH + fileProperties.uuid;
      let conversion = convertNota(filePath);

      let fileWrite = conversion.then(function (htmlSnippet) {
        htmlSnippet = DOC_TEMPLATE.replace('{{type}}', type).replace('{{outlet}}', htmlSnippet);
        htmlSnippet = beautifyHtml(htmlSnippet);
        fileProperties.size = Buffer.byteLength(htmlSnippet, 'utf8');
        let filePath = path.join(config.SHARE_FOLER_PATH, config.HTML_PATH, fileName);
        return fsp.writeFile(filePath, htmlSnippet);
      });

      let fileInsertion = fileWrite.then(function () {
        let sharePath = 'share://' + path.join(config.HTML_PATH, fileName);
        return queries.createFileDataObject(fileProperties, sharePath);
      });

      let documentUpdate = fileInsertion.then(function () {
        return queries.upsertConvertedFile(documentVersion.documentVersion, fileUri);
      });

      return resolve(documentUpdate);
    } else {
      return reject(new Error(`Currently only documents of type '${NOTA_URI}' are supported. Got '${documentVersion.documentType}' instead. abort ...`));
    }
  });
};

module.exports = convertDocument;
