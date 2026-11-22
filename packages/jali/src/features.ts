/**
 * jali/features: `defaultFeatures()`, every feature Jali had on by itself before features were opt-in (the address,
 * ⌘K, Settings, the chooser, data-pressed), in one call. Add rename and Pop out after it, and give a feature again to
 * change its options: `[...defaultFeatures(), urlSync({ location }), rename({ run })]`.
 */
export { defaultFeatures } from "@jali/react/internal";
