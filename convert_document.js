"use strict";

import { uuid } from 'mu';

const fs = require('fs');
const path = require('path');

const config = require('./config');
const queries = require('./queries');
const convertNota = require('./convert_nota');
const persistFile = require('./persist_file');

const beautifyHtml = require('js-beautify').html;
const fsp = fs.promises;

const NOTA_URI = 'http://kanselarij.vo.data.gift/id/concept/document-type-codes/9e5b1230-f3ad-438f-9c68-9d7b1b2d875d';
const DOC_TEMPLATE = fs.readFileSync(path.join(__dirname, './document_output_template.hbs'), 'utf8');


let convertDocument = async function (documentVersionUuid) {
  console.log(`converting document with uuid ${documentVersionUuid}`);
  let documentVersion = await queries.fetchDocumentVersion(documentVersionUuid);
  return new Promise((resolve, reject) => {
    if (documentVersion.results.bindings.length < 1) {
      return reject(new Error(`No document version found by uuid '${documentVersionUuid}', abort ...`));
    } else {
      documentVersion = documentVersion.results.bindings[0];
      console.log("documentVersion object", documentVersion);
    }
    if (!(documentVersion.fileExtension.value === 'docx')) {
      return reject(new Error(`File has extension '${documentVersion.fileExtension.value}' instead of 'docx', abort ...`));
    }
    let sharePath = documentVersion.physicalFile.value.replace('share://', '');
    let filePath = path.join(config.SHARE_FOLDER_PATH, sharePath);

    if (documentVersion.documentType.value === NOTA_URI) {
      let type = 'nota';
      let fileProperties = {
        uuid: uuid(),
        type: 'text/html',
        extension: 'html'
      };
      fileProperties.name = documentVersion.name.value || fileProperties.uuid;
      let fileUri = config.FILE_RESOURCES_PATH + fileProperties.uuid;
      let conversion = convertNota(filePath);

      let fileConversion = conversion.then(function (htmlSnippet) {
        console.log("sucessfully converted document, saving file, ..");
        htmlSnippet = DOC_TEMPLATE.replace('{{type}}', type).replace('{{outlet}}', htmlSnippet);
        htmlSnippet = beautifyHtml(htmlSnippet);
        fileProperties.size = Buffer.byteLength(htmlSnippet, 'utf8');
        return persistFile(fileProperties, htmlSnippet, config.HTML_PATH);
      });

      let documentUpdate = fileConversion.then(function () {
        return queries.upsertConvertedFile(documentVersion.documentVersion.value, fileUri);
      });

      return resolve(documentUpdate);
    } else {
      return reject(new Error(`Currently only documents of type '${NOTA_URI}' are supported. Got '${documentVersion.documentType.value}' instead. abort ...`));
    }
  });
};

module.exports = convertDocument;
