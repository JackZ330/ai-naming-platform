import { createClient } from '@supabase/supabase-js'

/** 读取最近的起名历史，默认 20 条 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method Not Allowed' })
    return
  }

  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_ANON_KEY
  if (!url || !key) {
    res.status(200).json({ records: [], warning: '未配置 Supabase' })
    return
  }

  const limit = Math.min(Number(req.query?.limit) || 20, 50)
  const supabase = createClient(url, key)

  const { data, error } = await supabase
    .from('name_history')
    .select('id, user_requirement, name_result, model_name, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    res.status(200).json({ records: [], error: error.message })
    return
  }

  res.status(200).json({ records: data || [] })
}
