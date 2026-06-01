import { DeleteObjectCommand, ListObjectsCommand, PutObjectCommand, S3 } from '@aws-sdk/client-s3';

import type { FileFromMulter } from '../../types/index.js';

export const digitalOceanUrl =
  process.env.DIGITAL_OCEAN_URL ?? 'https://lm-market-images.atl1.digitaloceanspaces.com/';

const endpoint = process.env.DIGITAL_OCEAN_SPACES_ENDPOINT ?? 'https://atl1.digitaloceanspaces.com';

const s3Client = new S3({
  credentials: {
    accessKeyId: process.env.DIGITAL_OCEAN_SPACES_KEY as string,
    secretAccessKey: process.env.DIGITAL_OCEAN_SPACES_SECRET as string,
  },
  endpoint,
  forcePathStyle: false,
  region: 'us-east-1',
});

export interface UploadBufferParams {
  buffer: Buffer;
  contentType: string;
  extension: string;
  fileName: string;
}

export const uploadBuffer = async ({
  buffer,
  contentType,
  extension,
  fileName,
}: UploadBufferParams): Promise<string> => {
  const path = `images/${fileName}.${extension}`;

  await s3Client.send(
    new PutObjectCommand({
      ACL: 'public-read',
      Body: buffer,
      Bucket: process.env.DIGITAL_OCEAN_BUCKET,
      ContentType: contentType,
      Key: path,
    }),
  );

  return digitalOceanUrl + path;
};

export const uploadFile = async (file: FileFromMulter, fileName: string): Promise<string> => {
  const ext = file.originalname.split('.').pop() ?? 'jpg';
  return uploadBuffer({
    buffer: file.buffer,
    contentType: file.mimetype,
    extension: ext,
    fileName,
  });
};

export const deleteFile = async (fileUrl: string) => {
  const pathPart = fileUrl.replace(digitalOceanUrl, '');
  try {
    const data = await s3Client.send(
      new DeleteObjectCommand({
        Bucket: process.env.DIGITAL_OCEAN_BUCKET,
        Key: pathPart,
      }),
    );
    return data;
  } catch (error) {
    return error;
  }
};

export const getAllFiles = async () => {
  try {
    const data = await s3Client.send(
      new ListObjectsCommand({ Bucket: process.env.DIGITAL_OCEAN_BUCKET }),
    );
    return data;
  } catch (error) {
    return error;
  }
};
