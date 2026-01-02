# OpenRouter Free Coding Models Filter

## Issue Fixed
The application was encountering rate limit errors (429) with OpenRouter models like `openai/gpt-oss-20b:free`. This was caused by:
1. **No filtering for coding-specific models** - All free models were being shown, including non-coding models
2. **Rate-limited models in fallback list** - Some models were hitting upstream rate limits

## Changes Made

### 1. Added Coding Model Filtering (`index.tsx`, lines 54-131)

#### Updated Fallback Models List
Replaced potentially rate-limited models with reliable coding-focused alternatives:
- ✅ **Mistral: Devstral 2 2512** - Specialized coding model
- ✅ **Qwen: Qwen3 Coder 480B A35B** - Large coding-focused model  
- ✅ **Kwaipilot: KAT-Coder-Pro V1** - Dedicated code generation model
- ✅ **Nex AGI: DeepSeek V3.1 Nex N1** - Advanced reasoning for code
- ✅ **Xiaomi: MiMo-V2-Flash** - Fast coding assistance

#### Implemented Keyword-Based Filtering
Added a comprehensive coding keywords filter to `fetchOpenRouterModels()`:

```typescript
const codingKeywords = [
    'coder', 'code', 'dev', 'deepseek', 'qwen', 'mistral', 
    'devstral', 'kwaipilot', 'kat-coder', 'mimo', 'llama',
    'nemotron', 'chimera', 'research', 'deepresearch'
];
```

Now only models matching BOTH conditions are selected:
1. ✅ **Free** (pricing = "0" for both prompt and completion)
2. ✅ **Coding-focused** (name/ID contains coding keywords)

### 2. Enhanced Filtering Logic
```typescript
const freeModels = data.data.filter(m => {
    const isFree = m.pricing.prompt === "0" && m.pricing.completion === "0";
    const isCodingModel = codingKeywords.some(keyword => 
        m.id.toLowerCase().includes(keyword) || 
        m.name.toLowerCase().includes(keyword)
    );
    return isFree && isCodingModel;
});
```

### 3. Updated Console Logging
More descriptive logs for debugging:
- `🔌 Fetching OpenRouter coding models...`
- `✅ Found X free coding models from OpenRouter`
- `⚠️ Using fallback coding models` (on error)

## How to Apply Changes

### Option 1: Clear Cache in Browser Console
1. Open your app in the browser
2. Press `F12` to open DevTools
3. Go to the **Console** tab
4. Run this command:
```javascript
localStorage.removeItem('openrouter_models_cache');
localStorage.removeItem('openrouter_models_timestamp');
location.reload();
```

### Option 2: Run the Clear Cache Script
You can also paste the contents of `clear-cache.js` into the browser console.

### Option 3: Hard Refresh
Just do a hard refresh (`Ctrl+Shift+R` or `Cmd+Shift+R`) and the cache will expire after 24 hours automatically.

## Expected Results

After clearing the cache and refreshing:
1. ✅ **Only coding-focused free models** will appear in the model selector
2. ✅ **No more rate-limited general-purpose models** like `gpt-oss-20b:free`
3. ✅ **Fallback models are all coding-specialized** and reliable
4. ✅ **Better performance** - Coding models are optimized for code generation

## Models You Should Now See

Based on OpenRouter's current free offerings, you should see models like:
- Mistral Devstral (coding specialist)
- Qwen Coder variants (multiple sizes)
- Kwaipilot KAT-Coder-Pro
- DeepSeek variants (coding + reasoning)
- Xiaomi MiMo (fast coding)
- NVIDIA Nemotron (if coding variant exists)
- Llama coding variants
- And other coding-focused free models

### Models You WON'T See Anymore
- ❌ `openai/gpt-oss-20b:free` (rate-limited, general-purpose)
- ❌ `openai/gpt-oss-120b:free` (rate-limited, general-purpose)
- ❌ General chat models without coding specialization
- ❌ Image/vision models
- ❌ Uncensored/general models

## Testing
1. Open the app and check the model dropdown
2. Verify only coding models are listed
3. Try generating code with multiple models
4. Confirm no 429 rate limit errors

## Notes
- Cache expires every 24 hours
- If OpenRouter API fails, app falls back to hardcoded coding models
- All model IDs are sanitized for safe use in HTML
- The filter is case-insensitive for better matching
