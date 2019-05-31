import { app, errorHandler } from 'mu';

import request from 'request';

const queries = require('./queries');
const convertDocument = require('./convert_document');

app.get('/', async function (req, res) {
  res.send('Home of document conversion service');
});

app.get('/convert-document-versions/:uuid', async function (req, res, next) {
  try {
    await convertDocument(req.params.uuid);
    return res.status(201).send({status: 201, title: 'Document converted'});
  } catch (e) {
    console.log(e.message);
    return next(new Error(e.message));
  }
});

app.get('/convert-document-versions/', async function (req, res, next) {
  let documentVersions = await queries.fetchUnconvertedDocumentVersions();
  if (documentVersions.results.bindings.length > 0) {
    documentVersions.results.bindings.forEach(function (documentVersion) {
      convertDocument(documentVersion.documentVersionUuid.value).catch(function (e) {
        console.log(`Document version by uuid ${documentVersion.documentVersionUuid.value} failed converting`);
      });
    });
    return res.status(202).send({status: 202, title: `Converting ${documentVersions.results.bindings.length} new documents`});
  } else {
    return res.status(200).send({status: 200, title: 'No documents to convert'});
  }
});
