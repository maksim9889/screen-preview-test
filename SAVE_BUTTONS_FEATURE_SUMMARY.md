# Save Buttons Feature Summary

## Overview
Separated the save functionality into three distinct operations:
1. **Save** - Save current changes to the current configuration
2. **Save as new version** - Create a new version of the current configuration
3. **Save as new configuration** - Create a new configuration with a custom name

## Changes Made

### 1. Separated Save Operations ✅

#### **Three Distinct Actions:**

**Save Button (Green):**
- Saves current changes to the existing configuration
- No version creation
- Quick save for incremental work
- Intent: `"save"`

**Save as new version Button (Blue):**
- Creates a new version of the **current configuration**
- Config name remains the same
- Version number increments (e.g., v3 → v4)
- Intent: `"saveVersion"`
- **No dialog** - executes immediately

**Save as new config Button (Purple):**
- Creates a **new configuration** with a custom name
- Opens a dialog to enter the new configuration name
- Creates version v1 for the new configuration
- Intent: `"saveAsNewConfig"`
- **Shows dialog** for name input

### 2. Updated UI Layout ✅

**Location:** app/components/Editor/Editor.tsx

**New Button Structure:**
```tsx
{/* Row 2: Save button */}
<div className="flex gap-1.5">
  <button className="w-full ... bg-emerald-500">
    Save
  </button>
</div>

{/* Row 3: Version buttons */}
<div className="flex gap-1.5">
  <button className="flex-1 ... bg-blue-600">
    Save as new version
  </button>
  <button className="flex-1 ... bg-purple-600">
    Save as new config
  </button>
</div>

{/* Row 4: Version toggle */}
{latestVersionNumber > 0 && (
  <button>Show Versions ({latestVersionNumber})</button>
)}
```

**Visual Hierarchy:**
- **Row 1:** Import/Export (secondary actions)
- **Row 2:** Save (primary action - full width)
- **Row 3:** Version operations (side-by-side)
- **Row 4:** Version history toggle (conditional)

### 3. Backend Action Handlers ✅

**Location:** app/routes/home.tsx

#### **Save as new version (same config):**
```typescript
if (intent === "saveVersion") {
  const configJson = formData.get("config") as string;
  const currentConfigId = (formData.get("currentConfigId") as string) || "default";

  const config: AppConfig = JSON.parse(configJson);

  // Save to current config
  saveConfig(userId, currentConfigId, config);

  // Create new version for current config
  const versionRecord = createConfigVersion(userId, currentConfigId, config);
  const versions = getConfigVersions(userId, currentConfigId, 20);
  const latestVersionNumber = getLatestVersionNumber(userId, currentConfigId);

  return {
    success: true,
    savedAt: new Date().toISOString(),
    versionCreated: true,
    versionNumber: versionRecord.version,
    versions,
    latestVersionNumber,
  };
}
```

#### **Save as new configuration:**
```typescript
if (intent === "saveAsNewConfig") {
  const configJson = formData.get("config") as string;
  const newConfigId = (formData.get("newConfigId") as string)?.trim();

  // Validation
  if (!newConfigId) {
    return { error: "Configuration ID is required" };
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(newConfigId)) {
    return { error: "Configuration ID must contain only letters, numbers, hyphens, and underscores" };
  }

  if (newConfigId.length < 1 || newConfigId.length > 50) {
    return { error: "Configuration ID must be between 1 and 50 characters" };
  }

  const config: AppConfig = JSON.parse(configJson);

  // Save to new config
  saveConfig(userId, newConfigId, config);

  // Create first version for new config
  const versionRecord = createConfigVersion(userId, newConfigId, config);
  const versions = getConfigVersions(userId, newConfigId, 20);
  const latestVersionNumber = getLatestVersionNumber(userId, newConfigId);

  return {
    success: true,
    savedAt: new Date().toISOString(),
    configCreated: true,  // NEW: Flag indicating new config
    versionCreated: true,
    versionNumber: versionRecord.version,
    configId: newConfigId,  // NEW: Return the new config ID
    versions,
    latestVersionNumber,
  };
}
```

### 4. New Configuration Dialog ✅

**Location:** app/components/Editor/Editor.tsx

**Dialog Features:**
- Opens when "Save as new config" is clicked
- Input field for entering new configuration name
- Validation hint below input
- Shows current configuration name for reference
- Purple theme to match the button
- Auto-focuses on input field

```tsx
{/* Save as New Configuration Dialog */}
{showNewConfigDialog && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-5">
      <h3 className="text-base font-semibold text-gray-900 mb-4">
        Save as New Configuration
      </h3>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Configuration Name
        </label>
        <input
          type="text"
          value={newConfigId}
          onChange={(e) => setNewConfigId(e.target.value)}
          placeholder="e.g., mobile, tablet, dark-mode"
          className="w-full px-3 py-2 border border-gray-300 rounded-md..."
          autoFocus
        />
        <p className="mt-1.5 text-xs text-gray-500">
          Use letters, numbers, hyphens, and underscores only (1-50 characters).
        </p>
        <p className="mt-1 text-xs text-gray-600">
          Current config: <span className="font-semibold">{configId}</span>
        </p>
      </div>

      <div className="flex gap-3 justify-end">
        <button onClick={() => setShowNewConfigDialog(false)}>
          Cancel
        </button>
        <button
          onClick={() => {
            const trimmedId = newConfigId.trim();
            if (trimmedId) {
              onSaveAsNewConfig(trimmedId);
              setShowNewConfigDialog(false);
            }
          }}
          disabled={!newConfigId.trim() || isSaving}
          className="... bg-purple-600"
        >
          {isSaving ? "Saving..." : "Create Configuration"}
        </button>
      </div>
    </div>
  </div>
)}
```

### 5. Updated Status Messages ✅

**Location:** app/components/Editor/Editor.tsx

Added separate status message for config creation:

```tsx
{/* Version created (same config) */}
{versionCreated && versionNumber && !configCreated && (
  <div className="px-4 py-1.5 bg-blue-50 text-blue-600 text-xs border-b border-blue-200">
    Version {versionNumber} created
  </div>
)}

{/* New configuration created */}
{configCreated && versionNumber && (
  <div className="px-4 py-1.5 bg-purple-50 text-purple-600 text-xs border-b border-purple-200">
    New configuration created with version {versionNumber}
  </div>
)}
```

### 6. Frontend Handlers ✅

**Location:** app/routes/home.tsx

**Save as new version:**
```typescript
const handleSaveVersion = () => {
  fetcher.submit(
    {
      intent: "saveVersion",
      config: JSON.stringify(config),
      currentConfigId: currentConfigId,  // Pass current config ID
      [CSRF_FIELD_NAME]: csrfToken,
    },
    { method: "post" }
  );
};
```

**Save as new configuration:**
```typescript
const handleSaveAsNewConfig = (newConfigId: string) => {
  fetcher.submit(
    {
      intent: "saveAsNewConfig",
      config: JSON.stringify(config),
      newConfigId: newConfigId,  // Pass new config ID
      [CSRF_FIELD_NAME]: csrfToken,
    },
    { method: "post" }
  );
};
```

### 7. State Management Updates ✅

**Location:** app/routes/home.tsx

Updated effect to handle new configuration creation:

```typescript
useEffect(() => {
  if (!saveResult) return;

  // Update configId when new configuration is created
  if (saveResult.configId && saveResult.configCreated) {
    setCurrentConfigId(saveResult.configId);
  }

  // Update versions list when version is created
  if (saveResult.versions) {
    setVersions(saveResult.versions);
  }

  // Update latest version number
  if (saveResult.latestVersionNumber !== undefined) {
    setLatestVersionNumber(saveResult.latestVersionNumber);
  }
}, [saveResult]);
```

## User Workflows

### Workflow 1: Quick Save (Incremental Work)
```
User edits configuration
↓
Clicks "Save"
↓
Changes saved to current config
✓ No version created
✓ Work preserved
```

### Workflow 2: Create Version Checkpoint (Same Config)
```
User: Working on "default" config (v3)
↓
Makes significant changes
↓
Clicks "Save as new version"
↓
Version v4 created for "default"
✓ Config name: "default" (unchanged)
✓ Version: v4 (incremented)
✓ Status: "Version 4 created"
```

### Workflow 3: Create New Configuration Variant
```
User: Working on "default" config
↓
Wants to create mobile variant
↓
Clicks "Save as new config"
↓
Dialog opens
↓
Enters "mobile" as configuration name
↓
Clicks "Create Configuration"
↓
New config created
✓ Config name: "mobile" (changed)
✓ Version: v1 (new config)
✓ Status: "New configuration created with version 1"
✓ UI updates to show "Config: mobile • Version: v1"
```

### Workflow 4: A/B Testing
```
User: Has "default" config at v5
↓
Clicks "Save as new config" → Enter "variant-a"
↓
Creates "variant-a" with v1
↓
Makes changes, clicks "Save as new version"
↓
"variant-a" now at v2
↓
Clicks "Save as new config" → Enter "variant-b"
↓
Creates "variant-b" with v1
↓
Test both independently
```

## Validation Rules

### Configuration Name Validation:
- **Required:** Cannot be empty
- **Format:** `/^[a-zA-Z0-9_-]+$/` (letters, numbers, hyphens, underscores only)
- **Length:** 1-50 characters

**Examples:**
- ✅ Valid: `default`, `mobile`, `tablet-landscape`, `v2_dark`, `config-2025`
- ❌ Invalid:
  - `my config` (contains space)
  - `config!` (special character)
  - `` (empty)
  - `a-very-long-configuration-name-that-exceeds-the-fifty-character-limit` (too long)

### Error Messages:
```typescript
// Empty
"Configuration ID is required"

// Invalid format
"Configuration ID must contain only letters, numbers, hyphens, and underscores"

// Invalid length
"Configuration ID must be between 1 and 50 characters"
```

## Button Color Coding

### Visual Distinction:
- 🟢 **Green (Save):** Safe, incremental save
- 🔵 **Blue (Save as new version):** Version checkpoint for current config
- 🟣 **Purple (Save as new config):** New configuration creation

### Status Message Colors:
- 🟢 **Green:** Save successful
- 🔵 **Blue:** Version created (same config)
- 🟣 **Purple:** New configuration created

## Benefits

### 1. Clear Mental Model 🧠
- Three distinct operations with clear purposes
- No confusion about what each button does
- Color coding reinforces functionality

### 2. Streamlined Versioning 🚀
- Quick version creation without dialogs
- No friction for common operations
- Dialog only when needed (new config)

### 3. Flexible Configuration Management 📁
- Easy to experiment with variants
- Keep original config safe
- Create seasonal/contextual configs on demand

### 4. Reduced Cognitive Load 💡
- "Save as new version" - No decision needed, just click
- "Save as new config" - Prompts for name when appropriate
- Clear feedback for each operation

### 5. Better Organization 🗂️
- Versioning stays within configurations
- New configs get fresh version history
- Easy to track what changed where

## Technical Details

### Component Props:
```typescript
interface EditorProps {
  // ... existing props
  onSaveVersion: () => void;              // No parameters - uses current config
  onSaveAsNewConfig: (newConfigId: string) => void;  // Accepts new config ID
  configCreated?: boolean;                // NEW: Flag for new config creation
}
```

### State Variables:
```typescript
const [showNewConfigDialog, setShowNewConfigDialog] = useState(false);  // Dialog visibility
const [newConfigId, setNewConfigId] = useState("");  // Input value (empty by default)
const [currentConfigId, setCurrentConfigId] = useState(configId!);  // Tracks active config
```

### Action Responses:
```typescript
// saveVersion response
{
  success: true,
  savedAt: "2026-01-31T...",
  versionCreated: true,
  versionNumber: 4,
  versions: [...],
  latestVersionNumber: 4
}

// saveAsNewConfig response
{
  success: true,
  savedAt: "2026-01-31T...",
  configCreated: true,      // NEW
  versionCreated: true,
  versionNumber: 1,
  configId: "mobile",       // NEW
  versions: [...],
  latestVersionNumber: 1
}
```

## Comparison: Before vs After

### Before:
- "Save" button
- "Save as new version" button with dialog
  - Dialog allowed changing config name
  - Single button for two purposes (version + new config)
  - Confusion about what happens when name changes

### After:
- "Save" button (unchanged)
- "Save as new version" button **without dialog**
  - Immediate execution
  - Always uses current config
  - Clear purpose: version checkpoint
- "Save as new config" button **with dialog**
  - Prompts for new name
  - Creates new configuration
  - Clear purpose: configuration variant

## Summary

✅ **Status:** Fully implemented and tested
✅ **TypeScript:** All type checks passing
✅ **UI/UX:** Three distinct buttons with clear purposes
✅ **Backend:** Separate action handlers with proper validation
✅ **State Management:** Reactive updates for both workflows
✅ **Server:** Running without errors at http://localhost:5174/

**Key Improvement:** Separation of concerns between versioning (incremental checkpoints) and configuration management (creating variants).

---

*Feature completed: 2026-01-31*
*All functionality working as expected ✅*
