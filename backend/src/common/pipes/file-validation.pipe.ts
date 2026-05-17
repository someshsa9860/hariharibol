import { BadRequestException, PipeTransform } from '@nestjs/common';

const BLOCKED_EXTENSIONS = [
  '.exe', '.sh', '.bat', '.cmd', '.php', '.js', '.ts',
  '.py', '.rb', '.pl', '.ps1', '.jar', '.class',
];

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const AUDIO_MIME_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/wav', 'audio/ogg', 'audio/aac'];
const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const AUDIO_MAX_BYTES = 50 * 1024 * 1024;

function validate(
  file: Express.Multer.File | undefined,
  allowedMimes: string[],
  maxBytes: number,
  label: string,
): Express.Multer.File {
  if (!file) {
    throw new BadRequestException('No file provided');
  }

  const ext = `.${file.originalname.split('.').pop()?.toLowerCase()}`;
  if (BLOCKED_EXTENSIONS.includes(ext)) {
    throw new BadRequestException('File type not allowed');
  }

  if (file.size > maxBytes) {
    throw new BadRequestException(`File exceeds ${maxBytes / (1024 * 1024)}MB limit`);
  }

  if (!allowedMimes.includes(file.mimetype)) {
    throw new BadRequestException(`Only ${label} files are allowed`);
  }

  return file;
}

export class ImageValidationPipe implements PipeTransform {
  transform(file: Express.Multer.File | undefined): Express.Multer.File {
    return validate(file, IMAGE_MIME_TYPES, IMAGE_MAX_BYTES, 'JPEG, PNG, and WebP image');
  }
}

export class AudioValidationPipe implements PipeTransform {
  transform(file: Express.Multer.File | undefined): Express.Multer.File {
    return validate(file, AUDIO_MIME_TYPES, AUDIO_MAX_BYTES, 'MP3, MP4, WAV, OGG, and AAC audio');
  }
}
