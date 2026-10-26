'use strict';
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { env } = require('../config/env');
const AppError = require('../utils/AppError');

const IMAGE_MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const CSV_MAX_BYTES = 1024 * 1024; // 1 MB

/** Identify an image by its magic bytes (the client-supplied mimetype/filename are never trusted). */
function detectImageType(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: '.jpg', mime: 'image/jpeg' };
  if (buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: '.png', mime: 'image/png' };
  if (buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP') return { ext: '.webp', mime: 'image/webp' };
  return null;
}

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: IMAGE_MAX_BYTES, files: 1, fields: 5 },
  fileFilter(req, file, cb) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      return cb(new AppError(415, 'Only JPEG, PNG or WebP images are allowed', 'UNSUPPORTED_FILE_TYPE'));
    }
    return cb(null, true);
  },
}).single('photo');

const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: CSV_MAX_BYTES, files: 1, fields: 5 },
  fileFilter(req, file, cb) {
    const okType = ['text/csv', 'application/vnd.ms-excel', 'text/plain', 'application/csv'].includes(file.mimetype);
    const okExt = path.extname(file.originalname || '').toLowerCase() === '.csv';
    if (!okType || !okExt) return cb(new AppError(415, 'Only .csv files are allowed', 'UNSUPPORTED_FILE_TYPE'));
    return cb(null, true);
  },
}).single('file');

/** Validates the buffer, writes it under a random server-generated name, returns that name. */
async function saveProfilePhoto(file) {
  if (!file) throw new AppError(400, 'No file uploaded (field name must be "photo")', 'NO_FILE');
  const type = detectImageType(file.buffer);
  if (!type) throw new AppError(415, 'File content is not a valid JPEG, PNG or WebP image', 'UNSUPPORTED_FILE_TYPE');
  const dir = path.join(env.uploadDir, 'profiles');
  await fs.mkdir(dir, { recursive: true });
  const name = `${crypto.randomBytes(16).toString('hex')}${type.ext}`;
  await fs.writeFile(path.join(dir, name), file.buffer, { flag: 'wx', mode: 0o640 });
  return name;
}

async function deleteProfilePhoto(name) {
  if (!name || !/^[a-f0-9]{32}\.(jpg|png|webp)$/.test(name)) return; // never build paths from untrusted names
  try {
    await fs.unlink(path.join(env.uploadDir, 'profiles', name));
  } catch (e) {
    /* already gone */
  }
}

function csvText(file) {
  if (!file) throw new AppError(400, 'No file uploaded (field name must be "file")', 'NO_FILE');
  if (file.buffer.includes(0)) throw new AppError(415, 'File is not a text CSV', 'UNSUPPORTED_FILE_TYPE');
  return file.buffer.toString('utf8');
}

module.exports = { imageUpload, csvUpload, saveProfilePhoto, deleteProfilePhoto, detectImageType, csvText, IMAGE_MAX_BYTES };
