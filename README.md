# AI 起名平台（练习三 · 多模型版）

一套可以直接跑起来的作业工程：Node 后端 + 静态页面 + Supabase 历史记录 + SSE 流式输出，支持豆包 / DeepSeek / 通义千问 / Kimi 四个模型切换。已按阶段二完成重构：新增模型只加一条配置，不改调用逻辑。

## 目录结构

```
ai-naming-platform/
├── api/
│   ├── name.js            # 核心后端：modelConfigMap + 统一调用 + 流式转发 + 落库
│   └── history.js         # 读取起名历史
├── index.html             # 前端页面：需求输入、模型下拉框、流式渲染、历史列表
├── local-server.js        # 不装 Vercel CLI 时的本地预览服务器
├── supabase/schema.sql    # 建表脚本（含 RLS 两阶段说明）
├── vercel.json            # 函数超时配置
├── package.json
├── .env.example           # 环境变量模板
└── .gitignore             # 已排除 .env
```

## 第一步：装依赖（1 分钟）

在云电脑终端、项目目录下执行：

```bash
npm install
```

## 第二步：填密钥

复制 `.env.example` 为 `.env`，把占位内容换成你自己的真实值：

```bash
cp .env.example .env
```

七个变量：

| 变量 | 从哪拿 |
| --- | --- |
| `SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `SUPABASE_ANON_KEY` | 同一页的 `anon` `public` key |
| `DOUBAO_API_KEY` | 火山方舟控制台 → API Key |
| `DOUBAO_MODEL_ID` | 火山方舟 → 在线推理 → 接入点 ID（形如 `ep-2026xxxx`） |
| `DEEPSEEK_API_KEY` | DeepSeek 控制台 → API Keys |
| `QWEN_API_KEY` | 阿里云百炼控制台 → API Key |
| `KIMI_API_KEY` | Moonshot 控制台 → API Key |

只想先测一个模型也可以：其他几个留空，页面选到未配置的模型时会提示“密钥未配置”，不影响已配好的那个。

## 第三步：建表

Supabase → SQL Editor → 粘贴 `supabase/schema.sql` 的全部内容 → Run。
执行成功后 `name_history` 表出现，并且已经带好了课堂调试用的匿名读写策略（正式上线怎么收紧，脚本末尾写了注释）。

## 第四步：本地跑起来

两种方式，任选一种。

**方式 A（推荐，和线上一致）：**

```bash
npm run dev          # 即 vercel dev
```

如果提示未登录，先执行 `npx vercel login`；或者直接用方式 B。

**方式 B（不装 Vercel CLI）：**

```bash
npm run dev:node
```

浏览器打开 `http://localhost:3000`，输入“男孩，国风，简约”，点生成 —— 名字和寓意应该逐字出现，下方“起名历史”出现一条记录。

## 第五步：推 GitHub

```bash
git init
git add .
git commit -m "feat: AI 起名平台 多模型流式版"
git branch -M main
git remote add origin https://github.com/你的用户名/ai-naming-platform.git
git push -u origin main
```

推之前跑一句 `git status`，确认待提交清单里**没有 `.env`**。

## 第六步：Vercel 部署

1. Vercel → Add New → Project → 导入上面那个仓库；
2. Settings → Environment Variables，把 `.env` 里的七个变量逐个填进去（Production 环境）；
3. Deploy，等构建完成，拿到公网域名；
4. 打开域名，再走一遍“输入需求 → 看到流式输出 → 历史多一条”。

## 怎么算作业做完了

对照四条，全过即可交：

- 页面能选 4 个模型，切换后都能返回 3 组名字 + 寓意；
- 文字是逐字出现的，不是等半天整段蹦出来；
- 每次生成后 Supabase 的 `name_history` 多一行，模型名与实际选择一致；
- 仓库里搜不到任何明文密钥，公网域名能正常访问。

## 常见报错对照

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 历史空白，插入报 `42501` | 表开了 RLS 但没策略 | 重新执行 `schema.sql` 里的两条 demo 策略 |
| 通义千问 400 / model not found | 用了普通地址或模型名不对 | 必须用 `compatible-mode/v1`，模型填 `qwen-plus` |
| 豆包 404 | 接入点 ID 或接口版本不对 | `DOUBAO_MODEL_ID` 填 `ep-` 开头的接入点；接口版本以控制台 curl 示例为准（常见 `/api/v3`） |
| 页面等很久才整段出现 | 响应被缓冲 | 后端已设 `no-transform`；若走 Nginx 之类代理需另关缓冲 |
| 线上 500、本地正常 | Vercel 没配环境变量 | 面板补齐后重新 Deploy |
| 生成到一半断掉 | 函数超时或输出过长 | `vercel.json` 已设 60s；提示词限制 3 组名字 |

## 阶段一单模型版（如果要交两次记录）

把 `api/name.js` 里的 `modelConfigMap` 只留 `doubao` 一条，前端删掉 `<select>`，硬编码 `model: 'doubao'`，就是阶段一的单模型版本。运行通、截好图之后，再换回当前这套多模型代码。

## 拓展任务（选做）

- 起名风格：前端加一组单选（国风 / 现代简约 / 英文名），拼进 `requirement` 一起发给后端；
- 新模型：在 `modelConfigMap` 里加一条 `{ baseURL, apiKey, model }`，前端加一个 `<option>`，其他代码不动。

## 本次实际部署记录（2026-11-12）

- 代码仓库：https://github.com/JackZ330/ai-naming-platform （public，main 分支）
- 线上地址：https://ai-naming-platform-rouge.vercel.app （README 里只需 3 个变量即可跑通：`SUPABASE_URL`、`SUPABASE_ANON_KEY`、`DEEPSEEK_API_KEY`，已在 Vercel Production 环境配置）
- Supabase：表 `name_history` 已建，含索引、RLS 与两条演示策略；线上每次生成都会写入一行
- 未配置豆包 / 千问 / Kimi 的密钥，页面选择这三个模型时会提示“密钥未配置”，属预期行为
- Vercel 的 Deployment Protection（Vercel Authentication）已关闭，否则 `*.vercel.app` 链接打开会跳登录页
