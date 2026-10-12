// Copyright 2026 true-utopian
// SPDX-License-Identifier: BSD-3-Clause
#include "vesper_surface_algorithms.h"
#include <array>
#include <cstdlib>
#include <iostream>
#include <vector>

namespace {
unsigned checks = 0;
void Check(bool value, const char* reason) {
  ++checks;
  if (!value) { std::cerr << reason << '\n'; std::exit(1); }
}
uint32_t Bits(float value) { return std::bit_cast<uint32_t>(value); }
}
int main() {
  using namespace blink::vesper;
  Check(Restricted("restricted"), "explicit restriction");
  for (auto text : {"", "standard", "Restricted", "restricted ", "off"})
    Check(!Restricted(text), "malformed mode must retain upstream");
  Check(AudioSeed("0123456789abcdef") == 0x0123456789abcdefULL, "seed parse");
  Check(AudioSeed("0000000000000000") == 0, "zero seed is valid");
  Check(AudioSeed("ffffffffffffffff") == UINT64_MAX, "maximum seed");
  for (auto text : {"", "1", "0123456789abcde", "0123456789abcdef0",
                    "0123456789abcdeg", "0123456789abcdeF", "0123456789abcde "})
    Check(!AudioSeed(text), "malformed seed must retain upstream");
  for (uint32_t bits : {0U, 0x80000000U, 1U, 0x80000001U, 0x7f800000U,
                        0xff800000U, 0x7fc01234U, 0xffc05678U})
    Check(Bits(OfflineSample(std::bit_cast<float>(bits), 31, 1, 4)) == bits,
          "special sample payload must remain exact");
  std::vector<float> original(4096);
  for (size_t i = 0; i < original.size(); ++i)
    original[i] = static_cast<float>(static_cast<int>(i % 509) - 254) / 257.0f;
  auto first = original, restart = original, other = original, channel = original;
  OfflineSamples(first, 0x0123456789abcdefULL, 0, 0);
  OfflineSamples(restart, 0x0123456789abcdefULL, 0, 0);
  OfflineSamples(other, 0xfedcba9876543210ULL, 0, 0);
  OfflineSamples(channel, 0x0123456789abcdefULL, 1, 0);
  Check(first == restart, "restart determinism");
  Check(first != original, "policy must affect non-silent render");
  Check(first != other, "independent identities");
  Check(first != channel, "channel domains");
  auto repeated = first;
  OfflineSamples(repeated, 0x0123456789abcdefULL, 0, 0);
  Check(first == repeated, "projection must not accumulate");
  auto chunks = original;
  auto span = std::span<float>(chunks);
  OfflineSamples(span.first(17), 0x0123456789abcdefULL, 0, 0);
  OfflineSamples(span.subspan(17, 119), 0x0123456789abcdefULL, 0, 17);
  OfflineSamples(span.subspan(136), 0x0123456789abcdefULL, 0, 136);
  Check(first == chunks, "chunk boundaries must preserve frame domain");
  for (size_t i = 0; i < first.size(); ++i) {
    Check((Bits(first[i]) & ~7U) == (Bits(original[i]) & ~7U),
          "projection must stay within seven mantissa ULPs");
  }
  for (auto family : {"Arial", " arial\t", "@Arial", "Times New Roman",
                       "system-ui", "Noto Sans", "DejaVu Sans Mono"})
    Check(LocalFamilyAllowed(family), "essential family normalization");
  for (auto family : {"", "Private Installed Font", "Arial\n", "Arial\0extra",
                       "arial bold", "Not Arial", "@Private Installed Font"}) {
    // String literal containing NUL must include the suffix in the test view.
    if (std::string_view(family) == "Arial") continue;
    Check(!LocalFamilyAllowed(family), "unlisted local family must be hidden");
  }
  Check(!LocalFamilyAllowed(std::string_view("Arial\0extra", 11)), "embedded NUL");
  Check(!LocalFamilyAllowed(std::string(129, 'a')), "bounded family input");
  std::cout << "{\"state\":\"passed\",\"checks\":" << checks
            << ",\"scope\":\"standalone-native-policy\",\"nativeBrowserProof\":false}\n";
}
