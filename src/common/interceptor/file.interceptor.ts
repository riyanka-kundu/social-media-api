import { normalizeFilename } from '@/modules/helper/utils';
import { BadRequestException } from '@nestjs/common';
import {
  FileFieldsInterceptor,
  FilesInterceptor,
} from '@nestjs/platform-express';
import { Request } from 'express';
import { existsSync, mkdirSync, unlink } from 'fs';
import { diskStorage } from 'multer';
import { extname } from 'path';

export const allowedMimeTypes = [
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/jpg',
  'image/heic',
  'image/heif',

  // Documents
  'application/pdf',
  'application/msword', // .doc
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.ms-excel', // .xls
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'text/csv',
  'text/plain',

  // Presentations
  'application/vnd.ms-powerpoint', // .ppt
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx

  // Videos
  'video/mp4',
  'video/x-msvideo', // .avi
  'video/x-matroska', // .mkv
  'video/webm',
  'video/quicktime', // .mov
  'video/mpeg',
];

export const allowedExtensions = [
  // Images
  '.jpeg',
  '.jpg',
  '.png',
  '.gif',
  '.webp',
  '.svg',
  '.heic',
  '.heif',

  // Documents
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.csv',
  '.txt',

  // Presentations
  '.ppt',
  '.pptx',

  // Videos
  '.mp4',
  '.avi',
  '.mkv',
  '.webm',
  '.mov',
  '.mpeg',
];

export const SingleFileInterceptor = (directory: string, fieldName: string) =>
  FilesInterceptor(fieldName, 25, {
    limits: {
      fileSize: 10 * 1024 * 1024,
    },
    storage: diskStorage({
      destination(_req: Request, _file: Express.Multer.File, callback) {
        if (!existsSync('./public')) mkdirSync('./public');
        if (!existsSync('./public/uploads')) mkdirSync('./public/uploads');
        if (!existsSync(`./public/uploads/${directory}`))
          mkdirSync(`./public/uploads/${directory}`);

        callback(null, `./public/uploads/${directory}`);
      },
      filename(_req, file, callback) {
        callback(null, normalizeFilename(file.originalname));
      },
    }),
    fileFilter(_req, file, callback) {
      if (!allowedMimeTypes.includes(file.mimetype)) {
        return callback(
          new BadRequestException(`Unsupported file type: ${file.mimetype}.`),
          false,
        );
      }

      const ext = extname(file.originalname).toLowerCase();
      if (!allowedExtensions.includes(ext)) {
        return callback(new Error('Invalid file extension!'), false);
      }

      callback(null, true);
    },
  });

export const MultiFileInterceptor = (
  fileFields: { name: string; directory: string; maxCount?: number }[],
) =>
  FileFieldsInterceptor(fileFields, {
    storage: diskStorage({
      destination(_req: Request, file: Express.Multer.File, callback) {
        const currField = fileFields.find(
          (field) => file.fieldname === field.name,
        );

        if (!existsSync('./public')) mkdirSync('./public');
        if (!existsSync('./public/uploads')) mkdirSync('./public/uploads');
        if (!existsSync(`./public/uploads/${currField!.directory}`))
          mkdirSync(`./public/uploads/${currField!.directory}`);

        if (currField) {
          return callback(null, `./public/uploads/${currField.directory}`);
        }

        unlink(file.destination, (_err) => {
          if (_err) callback(_err, '');
          return callback(
            new BadRequestException(
              `Image fieldname not allowed: ${file.fieldname}. Please ensure the fieldname matches one of the specified fields.`,
            ),
            '',
          );
        });
      },
      filename(_req, file, callback) {
        return callback(null, normalizeFilename(file.originalname));
      },
    }),
    fileFilter(_req, file, callback) {
      if (!allowedMimeTypes.includes(file.mimetype)) {
        return callback(
          new BadRequestException(`Unsupported file type: ${file.mimetype}.`),
          false,
        );
      }

      const ext = extname(file.originalname).toLowerCase();
      if (!allowedExtensions.includes(ext)) {
        return callback(new Error('Invalid file extension!'), false);
      }

      return callback(null, true);
    },
  });
