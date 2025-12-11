#!/bin/bash

# 批量更新所有 Settings 子页面的 alert() 调用

echo "开始批量更新 Settings 子页面..."

# 定义需要更新的文件
files=(
  "src/app/(main)/settings/ai/pdf-extract-prompt/page.tsx"
  "src/app/(main)/settings/ai/pdf-extract-test/page.tsx"
  "src/app/(main)/settings/report/static-info/page.tsx"
  "src/app/(main)/settings/report/single-choice/page.tsx"
  "src/app/(main)/settings/report/multi-choice/page.tsx"
  "src/app/(main)/settings/report/image-config/page.tsx"
  "src/app/(main)/settings/report/templates/page.tsx"
  "src/app/(main)/settings/construct-chattels/page.tsx"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "处理: $file"
    
    # 1. 检查是否已经导入了 useCustomAlert
    if ! grep -q "useCustomAlert" "$file"; then
      # 在第一个 import 语句后添加导入
      sed -i '' '1,/^import.*from/ {
        /^import.*from/a\
import { useCustomAlert } from "@/components/CustomAlert";
      }' "$file"
    fi
    
    # 2. 替换所有 alert( 为 showAlert(
    sed -i '' 's/\balert(/showAlert(/g' "$file"
    
    echo "  ✓ 完成"
  else
    echo "  ✗ 文件不存在: $file"
  fi
done

echo ""
echo "✅ 批量替换完成！"
echo ""
echo "⚠️  注意：你仍需要手动在每个文件中："
echo "1. 在组件函数开始处添加: const { showAlert, AlertComponent } = useCustomAlert();"
echo "2. 在 return 语句中包裹 JSX 并添加 {AlertComponent}"
