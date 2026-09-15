import { env } from '../../config/env.js';
import { supabaseAdmin } from '../../shared/supabase.js';

const bucket = env.SUPABASE_DOCUMENTS_BUCKET;

export async function uploadDocumentFile(
  path: string,
  data: Buffer,
  contentType: string,
): Promise<void> {
  const { error } = await supabaseAdmin.storage.from(bucket).upload(path, data, {
    contentType,
    upsert: true,
  });
  if (error) {
    throw new Error(`Failed to upload document: ${error.message}`);
  }
}

export async function createSignedDownloadUrl(
  path: string,
  expiresInSeconds = 60,
): Promise<string> {
  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);
  if (error || !data) {
    throw new Error(`Failed to create signed URL: ${error?.message ?? 'unknown error'}`);
  }
  return data.signedUrl;
}
