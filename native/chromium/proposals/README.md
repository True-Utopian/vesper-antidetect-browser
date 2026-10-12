# Pending native corrections

By **true-utopian**. These original proposals are excluded from `kernel.json` until they can be applied to an idle checkout and compiled. A clean patch check is not compilation or runtime qualification.

`0003-canvas-export-scope.patch` restricts the existing Canvas2D seed policy to Canvas2D exports. The current two-patch implementation invokes the export transformation for GPU canvases as well, while WebGL `readPixels` retains upstream behavior. That creates a pixel/export contradiction when the seed is enabled. This is a source finding; its exact compiled-runtime manifestation remains to be measured.

The correction passes an explicit context flag through HTML/Offscreen asynchronous exports and selects the protected synchronous export factory only for Canvas2D. Other constructor callers default to upstream behavior. It does not implement WebGL masking.

The strengthened direct native qualification fixture checks WebGL 1/2 RGBA8 repeated reads against independently decoded blob/data-URL PNG exports, accounting for vertical row orientation. Supported GPU reads must be coherent, and the page fixture must expose both APIs. These checks run before a candidate can be marked qualified. Three source regressions exercise orientation, export-only mutation, read errors, accumulating reads and missing observations.

The existing compilation and output cache are preserved. Apply this proposal only after the current compiler and post-build helper have finished. Then add it to the active patch manifest, run the incremental build and repeat native unit, direct, copied-runtime and guarded installed integration checks. Do not activate the current candidate merely because its narrower Canvas2D tests pass.
