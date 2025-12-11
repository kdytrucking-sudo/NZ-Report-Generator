#!/usr/bin/env python3
"""
自动更新所有 Settings 页面，将 alert() 替换为 showAlert()
"""

import re
import os

# 需要更新的文件列表
FILES_TO_UPDATE = [
    "src/app/(main)/settings/ai/pdf-extract-prompt/page.tsx",
    "src/app/(main)/settings/ai/pdf-extract-test/page.tsx",
    "src/app/(main)/settings/report/static-info/page.tsx",
    "src/app/(main)/settings/report/single-choice/page.tsx",
    "src/app/(main)/settings/report/multi-choice/page.tsx",
    "src/app/(main)/settings/report/image-config/page.tsx",
    "src/app/(main)/settings/report/templates/page.tsx",
    "src/app/(main)/settings/construct-chattels/page.tsx",
]

def update_file(filepath):
    """更新单个文件"""
    if not os.path.exists(filepath):
        print(f"❌ 文件不存在: {filepath}")
        return False
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_content = content
    
    # 1. 添加 import (如果不存在)
    if 'useCustomAlert' not in content:
        # 在最后一个 import 后添加
        import_pattern = r'(import.*from.*["\'];?\n)(?!import)'
        matches = list(re.finditer(import_pattern, content))
        if matches:
            last_import = matches[-1]
            insert_pos = last_import.end()
            import_statement = 'import { useCustomAlert } from "@/components/CustomAlert";\n'
            content = content[:insert_pos] + import_statement + content[insert_pos:]
    
    # 2. 替换 alert( 为 showAlert(
    content = re.sub(r'\balert\(', 'showAlert(', content)
    
    # 3. 在组件函数中添加 hook (如果不存在)
    if 'useCustomAlert()' not in content:
        # 查找 export default function 后的第一个 {
        function_pattern = r'(export default function \w+\([^)]*\)\s*\{)'
        match = re.search(function_pattern, content)
        if match:
            insert_pos = match.end()
            hook_statement = '\n    const { showAlert, AlertComponent } = useCustomAlert();'
            content = content[:insert_pos] + hook_statement + content[insert_pos:]
    
    # 4. 在 return 语句中添加 AlertComponent (如果不存在)
    if '{AlertComponent}' not in content:
        # 查找 return ( 后的第一个 JSX 元素
        return_pattern = r'(return\s*\(\s*\n?\s*)(<[^>]+>)'
        match = re.search(return_pattern, content)
        if match:
            # 替换为 Fragment 包裹
            before_return = content[:match.start(2)]
            after_return = content[match.start(2):]
            
            # 添加 Fragment 和 AlertComponent
            new_return = before_return + '<>\n        {AlertComponent}\n        ' + after_return
            
            # 找到对应的结束标签前添加 Fragment 结束
            # 简化处理：在最后的 ); 前添加 </>
            new_return = re.sub(r'(\s*</[^>]+>\s*\n?\s*)\);', r'\1\n        </>\n    );', new_return)
            
            content = new_return
    
    # 只有在内容有变化时才写入
    if content != original_content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"✅ 已更新: {filepath}")
        return True
    else:
        print(f"⏭️  无需更新: {filepath}")
        return False

def main():
    print("🚀 开始批量更新 Settings 页面...\n")
    
    updated_count = 0
    for filepath in FILES_TO_UPDATE:
        if update_file(filepath):
            updated_count += 1
    
    print(f"\n✨ 完成！共更新了 {updated_count} 个文件")
    print("\n⚠️  建议：")
    print("1. 检查每个文件确保语法正确")
    print("2. 运行 npm run dev 测试")
    print("3. 在浏览器中测试每个 Settings 页面")

if __name__ == "__main__":
    main()
