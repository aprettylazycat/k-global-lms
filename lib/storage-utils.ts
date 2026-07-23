import { supabaseAdmin } from '@/lib/supabase-server'

export function extractStoragePath(fileUrl: string, bucket: string): string | null {
  const marker = `/storage/v1/object/public/${bucket}/`
  const idx = fileUrl.indexOf(marker)
  if (idx === -1) return null
  return decodeURIComponent(fileUrl.slice(idx + marker.length))
}

export async function deleteSubmissionFile(fileUrl: string | null | undefined) {
  if (!fileUrl) return
  const path = extractStoragePath(fileUrl, 'submissions')
  if (path) {
    await supabaseAdmin.storage.from('submissions').remove([path])
  }
}