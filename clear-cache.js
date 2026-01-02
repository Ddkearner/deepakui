// Clear OpenRouter models cache
// Run this in the browser console to force refresh of models with new coding filter

localStorage.removeItem('openrouter_models_cache');
localStorage.removeItem('openrouter_models_timestamp');

console.log('✅ Cache cleared! Refresh the page to fetch coding models.');
