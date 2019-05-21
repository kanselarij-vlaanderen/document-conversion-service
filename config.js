"use strict";

const fs = require('fs');
const path = require('path');


const FILE_RESOURCES_PATH = 'http://kanselarij.vo.data.gift/id/files/';
const SHARE_FOLDER_PATH = '/share';
const FILE_SHARE_SUBFOLDER = 'html_conversions';

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
  FILE_RESOURCES_PATH,
  SHARE_FOLDER_PATH,
  IMG_PATH,
  HTML_PATH
};
