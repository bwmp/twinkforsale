// Environment configuration - simplified approach for Qwik City
export const getEnvConfig = () => {
  return {
    UPLOAD_DIR: process.env.UPLOAD_DIR || './uploads',
    MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10MB
    BASE_STORAGE_LIMIT: parseInt(process.env.BASE_STORAGE_LIMIT || '10737418240'), // 10GB
    BASE_URL: process.env.BASE_URL || 'https://twink.forsale',
    ALLOWED_MIME_TYPES: (process.env.ALLOWED_MIME_TYPES || 
      'image/png,image/jpeg,image/gif,image/webp,text/plain,application/pdf'
    ).split(','),
    NODE_ENV: process.env.NODE_ENV || 'development'
  };
};

// For non-request contexts (like server startup)
export const getServerEnvConfig = () => {
  return {
    UPLOAD_DIR: process.env.UPLOAD_DIR || './uploads',
    MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE || '10485760'),
    BASE_STORAGE_LIMIT: parseInt(process.env.BASE_STORAGE_LIMIT || '10737418240'), // 10GB
    BASE_URL: process.env.BASE_URL || 'https://twink.forsale',
    ALLOWED_MIME_TYPES: (process.env.ALLOWED_MIME_TYPES || 
      'image/png,image/jpeg,image/gif,image/webp,text/plain,application/pdf'
    ).split(','),
    NODE_ENV: process.env.NODE_ENV || 'development'
  };
};
