/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabaseAdmin } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const branchId = searchParams.get('branch_id')

  let query = supabaseAdmin
    .from('modules')
    .select('*')
    .order('order_index', { ascending: true })

  if (branchId) {
    query = query.eq('branch_id', branchId)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ modules: data ?? [] })
}