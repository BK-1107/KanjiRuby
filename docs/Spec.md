# KanjiRuby – Specification

## 1. 项目目标

本项目是一个 Chrome 浏览器插件，用于增强日文网页阅读体验，方便日语学习者学习日语：
- 对网页中的**所有汉字进行假名注音（ruby）**
- 对**用户选中的任意日文文本**提供翻译
- 不提供自动全文翻译或语法解释

---

## 2. MVP 功能范围

### 2.1 注音（Ruby）规则
- 默认仅对**包含汉字**的文本进行假名标注
- 平假名、片假名不进行注音

### 2.2 翻译规则
- 翻译 **仅在用户选中时触发**
- 被选中的文本不区分文字类型：
  - 汉字
  - 平假名
  - 片假名
- 未被选中的文本不进行翻译

### 2.3 明确不做
- 自动全文翻译
- 语法分析或教学解释
- 复杂 UI（悬浮词典、联想提示等）

---

## 3. 行为规则总结（冻结）

- 是否注音，只取决于是否含有汉字
- 是否翻译，只取决于是否被用户选中
- 注音逻辑与翻译逻辑完全独立

---

## 4. 统一数据结构（后端 → 前端）

后端 API 接口 `/analyze` 接收 `AnalyzeRequest`，返回 `FullAnalyzeResponse`。

### 4.1 请求结构 (Request)
```json
{
  "text": "测试文本",
  "need_translation": true
}
```

### 4.2 响应结构 (Response)
```json
{
  "tokens": [
    {
      "surface": "解析",
      "reading": "かいせき",
      "pos": "名詞",
      "has_kanji": true,
      "ruby": true,
      "selected": false,
      "translation": null
    }
  ],
  "full_translation": "分析"
}
```

---

## 5. UI 与 交互规则

- **双层 Ruby 布局**：
  - 假名注音使用 `ruby-position: over`（上方）。
  - 翻译内容使用 `ruby-position: under`（下方），颜色跟随正文。
- **选区保护**：
  - 对已注音/已翻译内容再次选中时，选区会自动向外扩展至最外层 `ruby` 标签，确保替换时不产生嵌套 Bug。
- **清除功能**：
  - 点击 "Clear All" 必须能够通过 DOM 还原将页面恢复至纯文本状态，而不引起页面刷新。
- **事件穿透**：
  - `rt` 标签必须设置 `user-select: none` 和 `pointer-events: none`。