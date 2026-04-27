export interface UploadOptions {
  folder: string; // e.g., 'sampradayas/xyz'
  filename: string;
  mimetype: string;
  buffer: Buffer;
  generateVariants?: boolean; // For images
}

export interface UploadResult {
  url: string;
  path: string;
  filename: string;
  size: number;
  mimetype: string;
  variants?: {
    sm?: string;
    md?: string;
    lg?: string;
  };
}

export interface StorageProvider {
  upload(options: UploadOptions): Promise<UploadResult>;
  delete(path: string): Promise<void>;
  deleteFolder(folderPath: string): Promise<void>;
  getUrl(path: string): string;
  exists(path: string): Promise<boolean>;
}
