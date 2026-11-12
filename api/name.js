import { createClient } from '@supabase/supabase-js'

/**
 * 模型配置表：只保存各平台的“差异项”
 * baseURL / apiKey / model 三项不同，其余请求逻辑完全共用
 * 新增模型只需在这里加一条，不改下面的调用代码
 */
const modelConfigMap = {
  doubao: {
    label: '豆包（火山方舟）',
    baseURL: 'https://ark.cn-beijing.volces.com/api/v3',
    apiKey: process.env.DOUBAO_API_KEY,
    model: process.env.DOUBAO_MODEL_ID
  },
  deepseek: {
    label: 'DeepSeek',
    baseURL: 'https://api.deepseek.com/v1',
    apiKey: process.env.DEEPSEEK_API_KEY,
    model: 'deepseek-chat'
  },
  qwen: {
    // 通义千问必须用 compatible-mode 地址
    label: '通义千问',
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiKey: process.env.QWEN_API_KEY,
    model: 'qwen-plus'
  },
  kimi: {
    label: 'Kimi',
    baseURL: 'https://api.moonshot.cn/v1',
    apiKey: process.env.KIMI_API_KEY,
    model: 'moonshot-v1-8k'
  }
}

const SYSTEM_PROMPT = [
  '你是一名精通汉语音韵与命名文化的起名顾问。',
  '请严格根据用户给出的性别、风格、字义偏好等需求，给出恰好 3 组名字。',
  '每组格式为：第一行只写名字，名字用中文书名号「」括起，后跟冒号；第二行起写不少于 40 字的寓意解释，说明用字含义与整体气质。',
  '全文禁止使用任何 Markdown 符号，不要出现星号、井号、下划线、短横线或反引号。',
  '只输出起名结果，不要输出与起名无关的寒暄、免责声明或额外评论。'
].join('')

let supabase = null
function getSupabase() {
  if (supabase) return supabase
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_ANON_KEY
  if (!url || !key) return null
  supabase = createClient(url, key)
  return supabase
}

function readBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body)
  if (typeof req.body === 'string') {
    try { return Promise.resolve(JSON.parse(req.body)) } catch { return Promise.resolve({}) }
  }
  return new Promise((resolve) => {
    let raw = ''
    req.on('data', (chunk) => { raw += chunk })
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}) } catch { resolve({}) }
    })
  })
}

function sendEvent(res, obj) {
  res.write(`data: ${JSON.stringify(obj)}\n\n`)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' })
    return
  }

  const body = await readBody(req)
  const requirement = String(body.requirement || '').trim()
  const modelKey = String(body.model || 'doubao')

  if (!requirement) {
    res.status(400).json({ error: '请先填写起名需求' })
    return
  }
  if (requirement.length > 300) {
    res.status(400).json({ error: '起名需求请控制在 300 字以内' })
    return
  }

  const config = modelConfigMap[modelKey]
  if (!config) {
    res.status(400).json({ error: `不支持的模型：${modelKey}` })
    return
  }
  if (!config.apiKey || !config.model) {
    res.status(500).json({ error: `${config.label} 的密钥或模型标识未配置，请检查环境变量` })
    return
  }

  // 关闭缓冲，逐条推送
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  })

  let fullText = ''

  try {
    const upstream = await fetch(`${config.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        stream: true,
        temperature: 0.8,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `起名需求：${requirement}` }
        ]
      })
    })

    if (!upstream.ok) {
      const errText = await upstream.text()
      sendEvent(res, { error: `上游返回 ${upstream.status}：${errText.slice(0, 300)}` })
      res.end()
      return
    }

    const reader = upstream.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() // 最后一段可能被截断，留到下一轮
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        const payload = trimmed.slice(5).trim()
        if (!payload || payload === '[DONE]') continue
        try {
          const json = JSON.parse(payload)
          const delta = json.choices?.[0]?.delta?.content || ''
          if (delta) {
            fullText += delta
            sendEvent(res, { delta })
          }
        } catch {
          // 心跳帧或非 JSON 分片，忽略
        }
      }
    }

    // 先落库再发结束事件，避免函数提前被回收导致记录丢失
    if (fullText) {
      const db = getSupabase()
      if (db) {
        const { error } = await db.from('name_history').insert({
          user_requirement: requirement,
          name_result: fullText,
          model_name: modelKey
        })
        if (error) sendEvent(res, { error: `写库失败：${error.message}` })
      } else {
        sendEvent(res, { warning: '未配置 Supabase，本次结果未写入历史' })
      }
    }

    sendEvent(res, { done: true })
    res.end()
  } catch (err) {
    sendEvent(res, { error: `调用失败：${err.message || err}` })
    res.end()
  }
}

export { modelConfigMap }
