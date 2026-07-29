/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabaseAdmin } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

function extractStoragePath(fileUrl: string, bucket: string): string | null {
  const marker = `/storage/v1/object/public/${bucket}/`
  const idx = fileUrl.indexOf(marker)
  if (idx === -1) return null
  return decodeURIComponent(fileUrl.slice(idx + marker.length))
}

export async function POST(req: Request) {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')

  if (!token) {
    return NextResponse.json({ error: 'Thiếu token xác thực' }, { status: 401 })
  }

  const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
  if (userError || !user) {
    return NextResponse.json({ error: 'Token không hợp lệ' }, { status: 401 })
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles').select('role').eq('id', user.id).single()

  if (profile?.role !== 'admin' && profile?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Không có quyền admin' }, { status: 403 })
  }

  const { data: rows } = await supabaseAdmin
    .from('submissions')
    .select('id, file_url')
    .in('status', ['approved', 'rejected'])
    .not('file_url', 'is', null)
    .neq('file_url', '')

  let deletedCount = 0
  let failedCount = 0

  for (const row of rows || []) {
    const path = extractStoragePath(row.file_url, 'submissions')
    if (!path) { failedCount++; continue }
    const { error: removeError } = await supabaseAdmin.storage.from('submissions').remove([path])
    if (removeError) { failedCount++; continue }
    await supabaseAdmin.from('submissions').update({ file_url: '' }).eq('id', row.id)
    deletedCount++
  }

  return NextResponse.json({ success: true, deletedCount, failedCount, total: rows?.length ?? 0 })
}