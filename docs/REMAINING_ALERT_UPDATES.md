# 批量更新剩余文件的说明

以下文件仍需要将 `alert()` 替换为 `showAlert()`：

## Settings 页面

1. `/src/app/(main)/settings/page.tsx` - 2个 alert
2. `/src/app/(main)/settings/ai/pdf-extract-test/page.tsx` - 3个 alert  
3. `/src/app/(main)/settings/ai/pdf-extract-prompt/page.tsx` - 2个 alert
4. `/src/app/(main)/settings/report/multi-choice/page.tsx` - 3个 alert
5. `/src/app/(main)/settings/report/structure/page.tsx` - 2个 alert
6. `/src/app/(main)/settings/report/image-config/page.tsx` - 3个 alert
7. `/src/app/(main)/settings/report/static-info/page.tsx` - 2个 alert
8. `/src/app/(main)/settings/report/single-choice/page.tsx` - 3个 alert
9. `/src/app/(main)/settings/construct-chattels/page.tsx` - 4个 alert
10. `/src/app/(main)/settings/report/templates/page.tsx` - 4个 alert

## 更新步骤

对于每个文件，需要：

1. 在 imports 中添加：
   ```typescript
   import { useCustomAlert } from '@/components/CustomAlert';
   ```

2. 在组件函数开始处添加：
   ```typescript
   const { showAlert, AlertComponent } = useCustomAlert();
   ```

3. 将所有 `alert("message")` 替换为 `showAlert("message")`

4. 在 return 语句中包裹 JSX：
   ```typescript
   return (
     <>
       {AlertComponent}
       <div>
         {/* 原有内容 */}
       </div>
     </>
   );
   ```

## 已完成的文件 ✅

- `/src/app/(main)/dashboard/page.tsx`
- `/src/app/(main)/report/download/page.tsx`
- `/src/app/(main)/report/generate/page.tsx`
- `/src/app/(main)/report/meta/page.tsx`
- `/src/app/(main)/report/content/page.tsx`
- `/src/app/(main)/report/basic/page.tsx`
- `/src/app/(main)/report/preprocess/page.tsx`
