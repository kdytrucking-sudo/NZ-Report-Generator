# Text Templates 功能说明

## 功能概述

**Text Templates（文本模板）** 是一个新的设置功能，用于管理多行文本内容模板。与 Multi-Choice 功能类似，但专门针对需要多行文本输入的场景。

## 主要特点

### 1. 数据库表
- **表名**: `text_templates`
- **路径**: `users/{uid}/text_templates/{cardId}`

### 2. 数据结构
```typescript
interface TextTemplateCard {
    id: string;              // 文档ID（由卡片名称生成）
    uid: string;             // 用户ID
    name: string;            // 卡片名称
    placeholder: string;     // Word模板中的占位符
    options: TextTemplateOption[];
    createdAt: Date;
    updatedAt: Date;
}

interface TextTemplateOption {
    id: string;              // 选项ID
    label: string;           // 选项标签
    value: string;           // 多行文本内容
}
```

### 3. 与 Multi-Choice 的主要区别

| 特性 | Multi-Choice | Text Templates |
|------|-------------|----------------|
| 输入类型 | 单行文本框 (`<input>`) | 多行文本框 (`<textarea>`) |
| 数据库表 | `multi_choice_content` | `text_templates` |
| 适用场景 | 短文本选项 | 长文本、多段落内容 |
| 换行处理 | 不需要 | 自动处理换行符 |

## 换行符处理机制

### 前端存储
- 用户在 `<textarea>` 中输入的换行会自动保存为 `\n`
- 数据库中存储的是标准的 `\n` 换行符

### Word 文档替换
在 `/src/app/api/generate-report/route.ts` 中，已经实现了换行符的自动处理：

```typescript
// 第 159-164 行
safeValue = safeValue.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

// Replace newlines with Word line break tag
if (safeValue.includes("\n")) {
    safeValue = safeValue.replace(/\n/g, "<w:br/>");
}
```

这意味着：
1. 所有换行符统一转换为 `\n`
2. 在替换到 Word 文档时，`\n` 会被转换为 `<w:br/>`（Word 的换行标签）
3. 最终在 Word 文档中正确显示为换行

## 使用步骤

### 1. 访问设置页面
导航到：**Settings → Report Generation Settings → Text Templates Settings**

### 2. 创建新卡片
1. 点击 "Add New Card" 按钮
2. 设置卡片名称（例如："Standard Clauses"）
3. 设置占位符（例如："[Replace_StandardClause]"）

### 3. 添加选项
1. 点击 "Add Option" 添加新选项
2. 为每个选项设置：
   - **Label**: 选项的标识名称
   - **Text Content**: 多行文本内容（可以包含换行）

### 4. 保存卡片
点击 "Save Card" 按钮保存到数据库

### 5. 在 Word 模板中使用
在 Word 模板中添加对应的占位符（例如：`[Replace_StandardClause]`），生成报告时会自动替换为选中的文本内容，并保留换行格式。

## 文件结构

```
src/
├── lib/
│   └── firestore-text-templates.ts          # Firestore 数据操作
└── app/(main)/settings/report/text-templates/
    ├── page.tsx                              # 主页面组件
    └── page.module.css                       # 样式文件
```

## API 函数

### `getTextTemplateCards(uid: string)`
获取用户的所有文本模板卡片

### `saveTextTemplateCard(uid: string, card: TextTemplateCard)`
保存或更新文本模板卡片

### `deleteTextTemplateCard(uid: string, cardId: string)`
删除文本模板卡片

## 示例用例

### 用例 1: 标准条款
- **卡片名称**: Standard Clauses
- **占位符**: [Replace_StandardClause]
- **选项**:
  - Label: "Residential Standard"
    Value: "This property has been valued in accordance with...\n\nThe valuation is subject to the following conditions:\n1. ..."
  
### 用例 2: 免责声明
- **卡片名称**: Disclaimers
- **占位符**: [Replace_Disclaimer]
- **选项**:
  - Label: "General Disclaimer"
    Value: "This report is confidential...\n\nNo liability is accepted..."

## 技术实现细节

### 换行符在整个流程中的转换

1. **用户输入** → `\n` (浏览器标准)
2. **存储到 Firestore** → `\n` (保持不变)
3. **从 Firestore 读取** → `\n` (保持不变)
4. **生成 Word 文档** → `<w:br/>` (Word XML 格式)
5. **Word 文档显示** → 实际换行

### CSS 关键样式

```css
.textarea {
    resize: vertical;        /* 允许垂直调整大小 */
    min-height: 80px;       /* 最小高度 */
    font-family: inherit;   /* 继承字体 */
}
```

## 注意事项

1. **占位符命名**: 确保占位符在 Word 模板中唯一
2. **换行处理**: 系统会自动处理所有类型的换行符（`\r\n`, `\r`, `\n`）
3. **XML 转义**: 特殊字符（`<`, `>`, `&` 等）会自动转义，确保 Word 文档不会损坏
4. **数据验证**: 卡片名称不能为空

## 未来扩展建议

1. 添加富文本编辑器支持（粗体、斜体等）
2. 支持模板变量（在文本内容中使用其他占位符）
3. 添加预览功能
4. 支持导入/导出模板
