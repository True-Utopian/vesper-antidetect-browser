// Copyright 2026 true-utopian
// SPDX-License-Identifier: BSD-3-Clause
#ifndef VESPER_SURFACE_ALGORITHMS_H_
#define VESPER_SURFACE_ALGORITHMS_H_

#include <bit>
#include <cstddef>
#include <cstdint>
#include <optional>
#include <span>
#include <string>
#include <string_view>

namespace blink::vesper {

// Invalid launch input retains upstream behavior independently per surface.
inline bool Restricted(std::string_view mode) { return mode == "restricted"; }
inline std::optional<uint64_t> AudioSeed(std::string_view text) {
  if (text.size() != 16) return std::nullopt;
  uint64_t value = 0;
  for (char c : text) {
    unsigned digit;
    if (c >= '0' && c <= '9') digit = c - '0';
    else if (c >= 'a' && c <= 'f') digit = c - 'a' + 10;
    else return std::nullopt;
    value = (value << 4) | digit;
  }
  return value;
}

// A keyed, idempotent mantissa projection, applied once to completed offline
// buffers. Both channel read APIs keep their normal shared-buffer semantics.
// Signed zero, subnormals, infinities and NaN payloads are preserved exactly.
inline float OfflineSample(float sample, uint64_t seed, uint32_t channel,
                           uint64_t frame) {
  uint32_t bits = std::bit_cast<uint32_t>(sample);
  const uint32_t exponent = bits & 0x7f800000U;
  if (exponent == 0 || exponent == 0x7f800000U) return sample;
  uint64_t key = seed ^ (frame * 0x9e3779b97f4a7c15ULL) ^
                 (static_cast<uint64_t>(channel) * 0xd1b54a32d192ed03ULL);
  key ^= key >> 30;
  key *= 0xbf58476d1ce4e5b9ULL;
  key ^= key >> 27;
  key *= 0x94d049bb133111ebULL;
  key ^= key >> 31;
  return std::bit_cast<float>((bits & ~7U) | static_cast<uint32_t>(key & 7U));
}
inline void OfflineSamples(std::span<float> samples, uint64_t seed,
                           uint32_t channel, uint64_t first_frame) {
  for (size_t i = 0; i < samples.size(); ++i)
    samples[i] = OfflineSample(samples[i], seed, channel, first_frame + i);
}

// A bounded local-family discovery policy, not a virtual cross-OS font pack.
// CSS local() unique-face lookup is separately denied by the native hook.
inline bool LocalFamilyAllowed(std::string_view name) {
  if (!name.empty() && name.front() == '@') name.remove_prefix(1);
  while (!name.empty() && (name.front() == ' ' || name.front() == '\t'))
    name.remove_prefix(1);
  while (!name.empty() && (name.back() == ' ' || name.back() == '\t'))
    name.remove_suffix(1);
  if (name.empty() || name.size() > 128) return false;
  std::string normalized;
  normalized.reserve(name.size());
  for (unsigned char c : name) {
    if (c < 32 || c > 126) return false;
    normalized.push_back(c >= 'A' && c <= 'Z' ? c + ('a' - 'A') : c);
  }
  constexpr std::string_view families[] = {
      "serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui",
      "ui-serif", "ui-sans-serif", "ui-monospace", "ui-rounded", "emoji",
      "math", "fangsong", "arial", "times new roman", "courier new",
      "segoe ui", "segoe ui emoji", "segoe ui symbol", "tahoma", "verdana",
      "helvetica", "helvetica neue", "times", "courier", "noto sans",
      "noto serif", "noto sans mono", "noto color emoji", "dejavu sans",
      "dejavu serif", "dejavu sans mono", "liberation sans", "liberation serif",
      "liberation mono"};
  for (auto family : families) if (normalized == family) return true;
  return false;
}
}  // namespace blink::vesper
#endif  // VESPER_SURFACE_ALGORITHMS_H_
