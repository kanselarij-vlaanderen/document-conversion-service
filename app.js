import { app, errorHandler } from 'mu';

import request from 'request';

const convertDocument = require('./convert_document');

app.get('/', async function (req, res) {
  res.send('Home of document conversion service');
});

app.get('/convert-document-version/:uuid', async function (req, res, next) {
  console.log('Inside conversion route');
  try {
    await convertDocument(req.params.uuid);
    return res.status(202).send({status: 200, title: 'Document converted'});
  } catch (e) {
    console.log(e.message);
    return next(new Error(e.message));
  }
});
