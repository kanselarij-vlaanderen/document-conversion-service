"use strict";

import { uuid } from 'mu';
import mime from 'mime-types';

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
// const crypto = require('crypto');

const queries = require('./queries');
const config = require('./config');

/**
 * Persist a file to disk and database
 *
 * @param { fileProperties, buffer, shareFolderSubPath }
 *
 * shareFolderSubPath: sub-path within the share folder
 *
 * fileProperties:
 {
   name: "...",
   type: "...",
   size: "...",
   extension: "...",
   created: "..."
 }
 */
async function persistFile (fileProperties, buffer, shareFolderSubPath = '') {
  return new Promise((resolve, reject) => {
    // const hash = crypto.createHash('md5');
    // hash.update(buffer)
    // let digest = hash.digest('hex');
    const virtualUuid = fileProperties.uuid || uuid();
    const created = fileProperties.created || Date.now();
    const extension = fileProperties.extension || mime.extension(fileProperties.type) || 'bin';
    const physicalUuid = fileProperties.physicalUuid || uuid();
    const physicalPath = path.join(config.SHARE_FOLDER_PATH, shareFolderSubPath, physicalUuid);
    const size = fileProperties.size || buffer.length;

    let fileWrite = fsp.writeFile(physicalPath, buffer);

    let fileInsertion = fileWrite.then(() => {
      console.log(`Wrote ${physicalPath} to disk, inserting metadata ...`);
      let newFileProperties = {
        name: fileProperties.name,
        uuid: virtualUuid,
        physicalUuid: physicalUuid,
        type: fileProperties.type,
        extension: extension,
        size: size,
        created: created
      };
      return queries.createFileDataObject(newFileProperties, shareFolderSubPath);
    }, (res) => {
      cleanUpFile(physicalPath);
      reject(res);
    });

    return resolve(fileInsertion);
  });
}

/**
 * Deletes a file.
 * Is intended to be used for deleting orphant files after a failure.
 * @param {string} path Local path to a file
 */
function cleanUpFile (path) {
  if (fs.existsSync(path)) {
    fs.unlinkSync(path);
  }
}

module.exports = persistFile;
