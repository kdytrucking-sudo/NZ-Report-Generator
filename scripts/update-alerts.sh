#!/bin/bash

# 批量替换 alert() 为 showAlert() 的脚本
# 使用方法: ./update-alerts.sh

# 定义需要更新的文件列表
files=(
  "src/app/(main)/settings/page.tsx"
  "src/app/(main)/settings/ai/pdf-extract-test/page.tsx"
  "src/app/(main)/settings/ai/pdf-extract-prompt/page.tsx"
  "src/app/(main)/settings/report/multi-choice/page.tsx"
  "src/app/(main)/settings/report/structure/page.tsx"
  "src/app/(main)/settings/report/image-config/page.tsx"
  "src/app/(main)/settings/report/static-info/page.tsx"
  "src/app/(main)/settings/report/single-choice/page.tsx"
  "src/app/(main)/settings/construct-chattels/page.tsx"
  "src/app/(main)/settings/report/templates/page.tsx"
)

echo "开始批量更新 alert() 调用..."

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "处理文件: $file"
    
    # 1. 添加 import (如果不存在)
    if ! grep -q "useCustomAlert" "$file"; then
      # 在最后一个 import 后添加
      sed -i '' '/^import.*from/a\
import { useCustomAlert } from "@/components/CustomAlert";
' "$file"
    fi
    
    # 2. 替换 alert( 为 showAlert(
    sed -i '' 's/alert(/showAlert(/g' "$file"
    
    echo "  ✓ 完成"
  else
    echo "  ✗ 文件不存在: $file"
  fi
done

echo ""
echo "批量更新完成！"
echo "注意：你仍需要手动："
echo "1. 在每个组件中添加: const { showAlert, AlertComponent } = useCustomAlert();"
echo "2. 在 return 语句中添加 {AlertComponent}"
