# Report Status Management Implementation Plan

## Status Types

### 1. Report Status (metadata.status)
Located at: `report.metadata.status`

**Status Values:**
- `Initial` - When user clicks "New Report"
- `Preprocess:AI` - After updating AI PDF Extract tab
- `Preprocess:StaticInfo` - After updating Static Info tab
- `Preprocess:SWOT` - After updating SWOT tab
- `Preprocess:Valuation` - After updating Market Value tab
- `Preprocess:Chattels` - After updating Construct/Chattels tab
- `Preprocess:RoomOption` - After updating Room Option tab
- `Filling:Basic` - When clicking Next from Preprocess
- `Filling:Content` - When clicking Save & Next from Basic
- `Filling:Completed` - When clicking Save to Review from Content
- `Report:Text_Replaced` - When clicking Next to Text Replace from Generate
- `Report_Completed` - When completing Image Replace (Download page)

### 2. Job Status (metadata.fields.metaStatus.value)
Located at: `report.metadata.fields['metaStatus']?.value`
Placeholder: `[Replace_MetaStatus]`

**Display:**
- User manages this in Meta page
- Display in Dashboard Recent Reports
- Show "Initial" if empty

## Implementation Tasks

### Task 1: Dashboard Page
- [x] Set status to "Initial" when creating new report
- [ ] Display Job Status in Recent Reports table
- [ ] Add "Update Meta" button in Actions column

### Task 2: Preprocess Page
- [ ] Update status when clicking "Update Report Database" in each tab:
  - AI PDF Extract → `Preprocess:AI`
  - Static Info → `Preprocess:StaticInfo`
  - SWOT Data → `Preprocess:SWOT`
  - Market Value → `Preprocess:Valuation`
  - Construct/Chattels → `Preprocess:Chattels`
  - Room Option → `Preprocess:RoomOption`
- [ ] Set status to `Filling:Basic` when clicking Next

### Task 3: Basic Page
- [ ] Keep status unchanged when clicking Save & Back
- [ ] Set status to `Filling:Content` when clicking Save & Next

### Task 4: Content Page
- [ ] Set status to `Filling:Basic` when clicking Save & Back
- [ ] Set status to `Filling:Completed` when clicking Save to Review

### Task 5: Generate (Review) Page
- [ ] Set status to `Filling:Content` when clicking Back
- [ ] Rename "Generate Report" to "Next to Text Replace"
- [ ] Set status to `Report:Text_Replaced` when clicking Next to Text Replace

### Task 6: Download (Image Replace) Page
- [ ] Set status to `Report_Completed` when completing image replacement

## Files to Modify

1. `/src/app/(main)/dashboard/page.tsx` - Dashboard
2. `/src/app/(main)/report/preprocess/page.tsx` - Preprocess
3. `/src/app/(main)/report/basic/page.tsx` - Basic (already done for Save & Back)
4. `/src/app/(main)/report/content/page.tsx` - Content (already done for Save & Back)
5. `/src/app/(main)/report/generate/page.tsx` - Generate/Review
6. `/src/app/(main)/report/download/page.tsx` - Download/Image Replace

## Notes

- All status updates should be saved to Firestore
- Status updates should happen before navigation
- Use `updateReport(uid, reportId, { metadata: { ...metadata, status: 'new_status' } })`
