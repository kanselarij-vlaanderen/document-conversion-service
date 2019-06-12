"use strict";

const fs = require('fs');
const path = require('path');

const MU_APPLICATION_GRAPH = process.env['MU_APPLICATION_GRAPH'] || 'http://mu.semte.ch/application';
const FILE_RESOURCES_PATH = 'http://kanselarij.vo.data.gift/id/files/';
const SHARE_FOLDER_PATH = '/share';
const FILE_SHARE_SUBFOLDER = 'html_conversions';

const NOTA_URI = 'http://kanselarij.vo.data.gift/id/concept/document-type-codes/9e5b1230-f3ad-438f-9c68-9d7b1b2d875d';
const BVR_URI = 'https://data.vlaanderen.be/id/concept/AardWetgeving/BesluitVanDeVlaamseRegering';

// PRIVATE

const IMG_PATH = path.join(FILE_SHARE_SUBFOLDER, 'img');
const HTML_PATH = path.join(FILE_SHARE_SUBFOLDER, 'html');

let dir;

dir = path.join(SHARE_FOLDER_PATH, FILE_SHARE_SUBFOLDER);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir);
}
dir = path.join(SHARE_FOLDER_PATH, IMG_PATH);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir);
}
dir = path.join(SHARE_FOLDER_PATH, HTML_PATH);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir);
}

module.exports = {
  MU_APPLICATION_GRAPH,
  FILE_RESOURCES_PATH,
  SHARE_FOLDER_PATH,
  IMG_PATH,
  HTML_PATH,
  NOTA_URI,
  BVR_URI
};
