# Bug Fix: Save Action Using Wrong Configuration

## Issue Description

**Problem:** When clicking "Save" button, the data was being saved to the "default" configuration instead of the currently viewed configuration.

**Symptom:**
```
1. User navigates to /?config=mobile
2. Makes changes to configuration
3. Clicks "Save"
4. Data is saved to "default" config instead of "mobile"
5. Switching back to "default" shows the changes
6. "mobile" config remains unchanged ❌
```

**Root Cause:**
Multiple action handlers were hardcoded to use "default" instead of reading the current config_id from the form data.

## Affected Actions

### 1. Save Action ❌
**Before:**
```typescript
if (intent === "save") {
  const configJson = formData.get("config") as string;
  // ...
  saveConfig(userId, "default", config);  // ❌ Hardcoded "default"
}
```

**After:**
```typescript
if (intent === "save") {
  const configJson = formData.get("config") as string;
  const currentConfigId = (formData.get("currentConfigId") as string) || "default";
  // ...
  saveConfig(userId, currentConfigId, config);  // ✅ Uses current config
}
```

### 2. Export Action ❌
**Before:**
```typescript
if (intent === "export") {
  const fullRecord = getFullConfigRecord(userId, "default");  // ❌ Hardcoded
  // ...
  const filename = `config-export-${username}-${new Date()...}.json`;
}
```

**After:**
```typescript
if (intent === "export") {
  const currentConfigId = (formData.get("currentConfigId") as string) || "default";
  const fullRecord = getFullConfigRecord(userId, currentConfigId);  // ✅ Correct config
  // ...
  const filename = `config-export-${username}-${currentConfigId}-${new Date()...}.json`;  // ✅ Includes config name
}
```

### 3. Restore Version Action ❌
**Before:**
```typescript
if (intent === "restoreVersion") {
  const versionNumber = parseInt(formData.get("version") as string, 10);
  // ...
  const success = restoreConfigVersion(userId, "default", versionNumber);  // ❌ Hardcoded
  const restoredConfig = getConfigFromDb(userId, "default");  // ❌ Hardcoded
}
```

**After:**
```typescript
if (intent === "restoreVersion") {
  const versionNumber = parseInt(formData.get("version") as string, 10);
  const currentConfigId = (formData.get("currentConfigId") as string) || "default";
  // ...
  const success = restoreConfigVersion(userId, currentConfigId, versionNumber);  // ✅ Correct config
  const restoredConfig = getConfigFromDb(userId, currentConfigId);  // ✅ Correct config
}
```

## Frontend Changes

### 1. handleSave Update ✅

**Location:** app/routes/home.tsx

**Before:**
```typescript
const handleSave = () => {
  fetcher.submit(
    {
      intent: "save",
      config: JSON.stringify(config),
      [CSRF_FIELD_NAME]: csrfToken,
    },
    { method: "post" }
  );
};
```

**After:**
```typescript
const handleSave = () => {
  fetcher.submit(
    {
      intent: "save",
      config: JSON.stringify(config),
      currentConfigId: currentConfigId,  // ✅ Added
      [CSRF_FIELD_NAME]: csrfToken,
    },
    { method: "post" }
  );
};
```

### 2. handleRestoreVersion Update ✅

**Location:** app/routes/home.tsx

**Before:**
```typescript
const handleRestoreVersion = (version: number) => {
  fetcher.submit(
    {
      intent: "restoreVersion",
      version: version.toString(),
      [CSRF_FIELD_NAME]: csrfToken,
    },
    { method: "post" }
  );
};
```

**After:**
```typescript
const handleRestoreVersion = (version: number) => {
  fetcher.submit(
    {
      intent: "restoreVersion",
      version: version.toString(),
      currentConfigId: currentConfigId,  // ✅ Added
      [CSRF_FIELD_NAME]: csrfToken,
    },
    { method: "post" }
  );
};
```

### 3. Export Form Update ✅

**Location:** app/components/Editor/Editor.tsx

**Before:**
```tsx
<form ref={exportFormRef} method="post" className="hidden">
  <input type="hidden" name="intent" value="export" />
  <input type="hidden" name={CSRF_FIELD_NAME} value={csrfToken} />
</form>
```

**After:**
```tsx
<form ref={exportFormRef} method="post" className="hidden">
  <input type="hidden" name="intent" value="export" />
  <input type="hidden" name="currentConfigId" value={configId} />  {/* ✅ Added */}
  <input type="hidden" name={CSRF_FIELD_NAME} value={csrfToken} />
</form>
```

## Testing Scenarios

### Test 1: Save to Non-Default Config ✅
```
1. Navigate to /?config=mobile
2. Make changes to carousel images
3. Click "Save"
4. Expected: Changes saved to "mobile" config ✅
5. Navigate to /?config=default
6. Expected: No changes in "default" config ✅
7. Navigate back to /?config=mobile
8. Expected: Changes are present ✅
```

### Test 2: Export Non-Default Config ✅
```
1. Navigate to /?config=tablet
2. Click "Export"
3. Expected: File named "config-export-maks-tablet-2026-01-31.json" ✅
4. Expected: File contains "tablet" config data ✅
```

### Test 3: Restore Version in Non-Default Config ✅
```
1. Navigate to /?config=mobile
2. Create version v1
3. Make changes
4. Create version v2
5. Restore to v1
6. Expected: "mobile" config restored to v1 ✅
7. Expected: "default" config unchanged ✅
```

### Test 4: Save as New Version ✅
```
1. Navigate to /?config=mobile
2. Make changes
3. Click "Save as new version"
4. Expected: New version created for "mobile" config ✅
5. Expected: Version counter shows correct count ✅
```

### Test 5: Config Selector Integration ✅
```
1. On /?config=default
2. Use dropdown to switch to "mobile"
3. Make changes
4. Click "Save"
5. Expected: Changes saved to "mobile" ✅
6. Switch back to "default" using dropdown
7. Expected: "default" unchanged ✅
```

## Impact Analysis

### Before Fix:
- ❌ Save button always saved to "default"
- ❌ Export always exported "default" config
- ❌ Restore version always restored "default" versions
- ❌ Multiple configs feature was essentially broken
- ❌ Confusing user experience

### After Fix:
- ✅ Save button saves to current config
- ✅ Export exports current config (with config name in filename)
- ✅ Restore version works with current config
- ✅ Multiple configs feature works as intended
- ✅ Clear and predictable behavior

## Additional Improvements

### 1. Export Filename Enhancement
Export filenames now include the configuration name:
```
Before: config-export-maks-2026-01-31.json
After:  config-export-maks-mobile-2026-01-31.json
```

**Benefit:** Easier to identify which config was exported.

### 2. Consistent Fallback
All actions now use consistent fallback logic:
```typescript
const currentConfigId = (formData.get("currentConfigId") as string) || "default";
```

**Benefit:** Defensive coding - if currentConfigId is missing, falls back to "default".

## Prevention

### Code Review Checklist:
- [ ] All action handlers check for `currentConfigId` in form data
- [ ] Frontend handlers include `currentConfigId` in submissions
- [ ] No hardcoded "default" config references in actions
- [ ] Export filenames include config name
- [ ] Test with multiple configs before merging

### Future Safeguards:
1. Add TypeScript type for form data to ensure `currentConfigId` is always included
2. Add server-side logging to track which config is being modified
3. Add integration tests for multi-config scenarios
4. Consider adding visual indicator when save is successful (with config name)

## Summary

✅ **Status:** Bug fixed and tested
✅ **TypeScript:** All type checks passing
✅ **Actions Fixed:** Save, Export, Restore Version
✅ **Frontend Updated:** All handlers pass currentConfigId
✅ **Testing:** All scenarios pass
✅ **Server:** Running without errors

**Key Takeaway:** When adding multi-config support, it's critical to update all action handlers that interact with configurations to use the current config_id rather than hardcoded values.

---

*Bug fixed: 2026-01-31*
*All functionality working correctly ✅*
