import { registerAs } from '@nestjs/config';
import { envSchema } from './env.schema';

/** Đọc qua `@Inject(cloudinaryConfig.KEY) config: ConfigType<typeof cloudinaryConfig>`. */
export const cloudinaryConfig = registerAs('cloudinary', () => {
  const env = envSchema.parse(process.env);
  return {
    cloudName: env.CLOUDINARY_CLOUD_NAME,
    apiKey: env.CLOUDINARY_API_KEY,
    apiSecret: env.CLOUDINARY_API_SECRET,
  };
});
