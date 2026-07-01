$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$clang = "C:\Program Files\LLVM\bin\clang++.exe"

if (!(Test-Path -LiteralPath $clang)) {
  throw "clang++ not found at $clang"
}

& $clang `
  --target=wasm32 `
  -O3 `
  -nostdlib `
  -fno-exceptions `
  -fno-rtti `
  "-Wl,--no-entry" `
  "-Wl,--export=soemdsp_ellipsoid_sample" `
  "-Wl,--export=soemdsp_ellipsoid_vector_sample" `
  "-Wl,--export=soemdsp_ellipsoid_mono" `
  "-Wl,--export=soemdsp_ellipsoid_x" `
  "-Wl,--export=soemdsp_ellipsoid_y" `
  "-Wl,--export=soemdsp_ellipsoid_version" `
  "-Wl,--export-memory" `
  -o "$root\native_modules\ellipsoid\ellipsoid.wasm" `
  "$root\native_modules\ellipsoid\ellipsoid.cpp"

& $clang `
  --target=wasm32 `
  -O3 `
  -nostdlib `
  -fno-exceptions `
  -fno-rtti `
  "-Wl,--no-entry" `
  "-Wl,--export=soemdsp_sabrina_reverb_create" `
  "-Wl,--export=soemdsp_sabrina_reverb_destroy" `
  "-Wl,--export=soemdsp_sabrina_reverb_reset" `
  "-Wl,--export=soemdsp_sabrina_reverb_set_params" `
  "-Wl,--export=soemdsp_sabrina_reverb_process" `
  "-Wl,--export=soemdsp_sabrina_reverb_left" `
  "-Wl,--export=soemdsp_sabrina_reverb_right" `
  "-Wl,--export=soemdsp_sabrina_reverb_wet" `
  "-Wl,--export=soemdsp_sabrina_reverb_wet_left" `
  "-Wl,--export=soemdsp_sabrina_reverb_wet_right" `
  "-Wl,--export=soemdsp_sabrina_reverb_version" `
  "-Wl,--export-memory" `
  -o "$root\native_modules\sabrina_reverb\sabrina_reverb.wasm" `
  "$root\native_modules\sabrina_reverb\sabrina_reverb.cpp"

& $clang `
  --target=wasm32 `
  -O3 `
  -nostdlib `
  -fno-exceptions `
  -fno-rtti `
  "-Wl,--no-entry" `
  "-Wl,--export=soemdsp_pll_version" `
  "-Wl,--export=soemdsp_pll_create" `
  "-Wl,--export=soemdsp_pll_destroy" `
  "-Wl,--export=soemdsp_pll_reset" `
  "-Wl,--export=soemdsp_pll_set_params" `
  "-Wl,--export=soemdsp_pll_process" `
  "-Wl,--export=soemdsp_pll_vco_out" `
  "-Wl,--export=soemdsp_pll_pc_out" `
  "-Wl,--export=soemdsp_pll_lpf_out" `
  "-Wl,--export=soemdsp_pll_locked" `
  "-Wl,--export-memory" `
  -o "$root\native_modules\pll\pll.wasm" `
  "$root\native_modules\pll\pll.cpp"

& $clang `
  --target=wasm32 `
  -O3 `
  -nostdlib `
  -fno-exceptions `
  -fno-rtti `
  "-Wl,--no-entry" `
  "-Wl,--export=soemdsp_helmholtz_version" `
  "-Wl,--export=soemdsp_helmholtz_create" `
  "-Wl,--export=soemdsp_helmholtz_destroy" `
  "-Wl,--export=soemdsp_helmholtz_set_params" `
  "-Wl,--export=soemdsp_helmholtz_process" `
  "-Wl,--export=soemdsp_helmholtz_frequency" `
  "-Wl,--export=soemdsp_helmholtz_fidelity" `
  "-Wl,--export-memory" `
  -o "$root\native_modules\helmholtz\helmholtz.wasm" `
  "$root\native_modules\helmholtz\helmholtz.cpp"

& $clang `
  --target=wasm32 `
  -O3 `
  -nostdlib `
  -fno-exceptions `
  -fno-rtti `
  "-Wl,--no-entry" `
  "-Wl,--export=soemdsp_noise_generator_create" `
  "-Wl,--export=soemdsp_noise_generator_destroy" `
  "-Wl,--export=soemdsp_noise_generator_sample" `
  "-Wl,--export=soemdsp_noise_generator_left" `
  "-Wl,--export=soemdsp_noise_generator_right" `
  "-Wl,--export=soemdsp_noise_generator_version" `
  "-Wl,--export-memory" `
  -o "$root\native_modules\noise_generator\noise_generator.wasm" `
  "$root\native_modules\noise_generator\noise_generator.cpp"

& $clang `
  --target=wasm32 `
  -O3 `
  -nostdlib `
  -fno-exceptions `
  -fno-rtti `
  "-Wl,--no-entry" `
  "-Wl,--export=soemdsp_soft_clipper_sample" `
  "-Wl,--export=soemdsp_soft_clipper_version" `
  "-Wl,--export=soemdsp_soft_clipper_metadata_json" `
  "-Wl,--export=soemdsp_soft_clipper_metadata_json_size" `
  "-Wl,--export-memory" `
  -o "$root\native_modules\soft_clipper\soft_clipper.wasm" `
  "$root\native_modules\soft_clipper\soft_clipper.cpp"

& $clang `
  --target=wasm32 `
  -O3 `
  -nostdlib `
  -fno-exceptions `
  -fno-rtti `
  "-Wl,--no-entry" `
  "-Wl,--export=soemdsp_fbm_create" `
  "-Wl,--export=soemdsp_fbm_destroy" `
  "-Wl,--export=soemdsp_fbm_sample" `
  "-Wl,--export=soemdsp_fbm_x" `
  "-Wl,--export=soemdsp_fbm_y" `
  "-Wl,--export=soemdsp_fbm_z" `
  "-Wl,--export=soemdsp_fbm_x_raw" `
  "-Wl,--export=soemdsp_fbm_y_raw" `
  "-Wl,--export=soemdsp_fbm_z_raw" `
  "-Wl,--export=soemdsp_fbm_version" `
  "-Wl,--export-memory" `
  -o "$root\native_modules\fractal_brownian_noise\fractal_brownian_noise.wasm" `
  "$root\native_modules\fractal_brownian_noise\fractal_brownian_noise.cpp"

& $clang `
  --target=wasm32 `
  -O3 `
  -nostdlib `
  -fno-exceptions `
  -fno-rtti `
  "-Wl,--no-entry" `
  "-Wl,--export=soemdsp_ladder_filter_create" `
  "-Wl,--export=soemdsp_ladder_filter_destroy" `
  "-Wl,--export=soemdsp_ladder_filter_sample" `
  "-Wl,--export=soemdsp_ladder_filter_version" `
  "-Wl,--export=soemdsp_ladder_filter_metadata_json" `
  "-Wl,--export=soemdsp_ladder_filter_metadata_json_size" `
  "-Wl,--export-memory" `
  -o "$root\native_modules\ladder_filter\ladder_filter.wasm" `
  "$root\native_modules\ladder_filter\ladder_filter.cpp"

& $clang `
  --target=wasm32 `
  -O3 `
  -nostdlib `
  -fno-exceptions `
  -fno-rtti `
  "-Wl,--no-entry" `
  "-Wl,--export=soemdsp_tb303_filter_create" `
  "-Wl,--export=soemdsp_tb303_filter_destroy" `
  "-Wl,--export=soemdsp_tb303_filter_sample" `
  "-Wl,--export=soemdsp_tb303_filter_version" `
  "-Wl,--export=soemdsp_tb303_filter_metadata_json" `
  "-Wl,--export=soemdsp_tb303_filter_metadata_json_size" `
  "-Wl,--export-memory" `
  -o "$root\native_modules\tb303_filter\tb303_filter.wasm" `
  "$root\native_modules\tb303_filter\tb303_filter.cpp"

& $clang `
  --target=wasm32 `
  -O3 `
  -nostdlib `
  -fno-exceptions `
  -fno-rtti `
  "-Wl,--no-entry" `
  "-Wl,--export=soemdsp_passive_filter_create" `
  "-Wl,--export=soemdsp_passive_filter_destroy" `
  "-Wl,--export=soemdsp_passive_filter_sample" `
  "-Wl,--export=soemdsp_passive_filter_version" `
  "-Wl,--export=soemdsp_passive_filter_metadata_json" `
  "-Wl,--export=soemdsp_passive_filter_metadata_json_size" `
  "-Wl,--export-memory" `
  -o "$root\native_modules\passive_filter\passive_filter.wasm" `
  "$root\native_modules\passive_filter\passive_filter.cpp"

& $clang `
  --target=wasm32 `
  -O3 `
  -nostdlib `
  -fno-exceptions `
  -fno-rtti `
  "-Wl,--no-entry" `
  "-Wl,--export=soemdsp_vactrol_envelope_create" `
  "-Wl,--export=soemdsp_vactrol_envelope_destroy" `
  "-Wl,--export=soemdsp_vactrol_envelope_sample" `
  "-Wl,--export=soemdsp_vactrol_envelope_version" `
  "-Wl,--export=soemdsp_vactrol_envelope_metadata_json" `
  "-Wl,--export=soemdsp_vactrol_envelope_metadata_json_size" `
  "-Wl,--export-memory" `
  -o "$root\native_modules\vactrol_envelope\vactrol_envelope.wasm" `
  "$root\native_modules\vactrol_envelope\vactrol_envelope.cpp"

& $clang `
  --target=wasm32 `
  -O3 `
  -nostdlib `
  -fno-exceptions `
  -fno-rtti `
  "-Wl,--no-entry" `
  "-Wl,--export=soemdsp_shooting_star_explosion_power" `
  "-Wl,--export=soemdsp_shooting_star_explosion_version" `
  "-Wl,--export=soemdsp_shooting_star_explosion_metadata_json" `
  "-Wl,--export=soemdsp_shooting_star_explosion_metadata_json_size" `
  "-Wl,--export-memory" `
  -o "$root\native_modules\shooting_star_explosion\shooting_star_explosion.wasm" `
  "$root\native_modules\shooting_star_explosion\shooting_star_explosion.cpp"

& $clang `
  --target=wasm32 `
  -O3 `
  -nostdlib `
  -fno-exceptions `
  -fno-rtti `
  "-Wl,--no-entry" `
  "-Wl,--export=soemdsp_polyblep_create" `
  "-Wl,--export=soemdsp_polyblep_destroy" `
  "-Wl,--export=soemdsp_polyblep_reset" `
  "-Wl,--export=soemdsp_polyblep_sample" `
  "-Wl,--export=soemdsp_polyblep_out" `
  "-Wl,--export=soemdsp_polyblep_saw" `
  "-Wl,--export=soemdsp_polyblep_ramp" `
  "-Wl,--export=soemdsp_polyblep_square" `
  "-Wl,--export=soemdsp_polyblep_tri" `
  "-Wl,--export=soemdsp_polyblep_sine" `
  "-Wl,--export=soemdsp_polyblep_version" `
  "-Wl,--export-memory" `
  -o "$root\native_modules\polyblep\polyblep.wasm" `
  "$root\native_modules\polyblep\polyblep.cpp"
