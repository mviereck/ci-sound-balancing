#!/usr/bin/env bash
# Konvertiert 50 Thorsten-WAVs zu MP3s für Etappe 1.
# Quelle: .sprachdatensätze/thorsten-de_v03/wavs/HASH.wav
# Ziel:   assets/sentences/de-m/NN.mp3
# Voraussetzung: ffmpeg im PATH.

set -euo pipefail
SRC="$(dirname "$0")/../../.sprachdatensätze/thorsten-de_v03/wavs"
DST="$(dirname "$0")/de-m"
mkdir -p "$DST"

# id|hash – Reihenfolge entspricht sentences.json
while IFS='|' read -r id hash; do
  [ -z "$id" ] && continue
  if [ ! -f "$SRC/$hash.wav" ]; then
    echo "FEHLT: $hash.wav (Satz $id)" >&2
    exit 1
  fi
  ffmpeg -loglevel error -y -i "$SRC/$hash.wav" \
    -ar 22050 -ac 1 -b:a 64k "$DST/$id.mp3"
  echo "$id OK"
done <<'EOF'
01|bbefed7d92c4c1c225005dab40ede48c
02|3f282d4a63ad6c72d6d7d362d32efa1f
03|d4c7c84686b98d5bbe4e3956dcaee42d
04|eec9fb56bcf2c0ac7e108af965af928e
05|94afdbbbeb6f7db5d3270b3054c44290
06|97438423cdc763ec5303acda20212e2a
07|1d795720bc1392877385ec5a366ea5bf
08|5da28c34f0b8a6825bfa450f35c78c3e
09|ac22703ce4bdbc41ddc8c7da8ede9292
10|22474d944d5e6b3b39aa9b54a1850c2f
11|c1f3bae6ce2d58d7ce45de80d30288dd
12|8fc00b064fbacc077a38f89768353320
13|4498d14147f10205923ffcdba1ca58e9
14|cc2674f8a3c867439e70bc1ad7cdd5e8
15|ef66ef6d51edc4eb5bcd37ffdabaca4b
16|a775f666ead6dc11f6000071d7da52d2
17|49702db6df4f553aa1c0f931eb0a0850
18|4ffafb65834d538d63f108a00e9fa105
19|7b59338e5d7c7eccb5e1cea99d72c475
20|d59ffce3e293156810740403b1006ecd
21|cb8d6dd4437e43fd4c8bdf4d9067e133
22|3803b5cfbe8ffc20f69f4c2a1e667aa3
23|3b20665aed9eba1dbac6781f5487bb45
24|2790ac1f4807953bcd436bc16c9c4b33
25|bdced79872af7efca74a524b8cdc7f71
26|d8f330ca904285ebdc91858b7cb05e2a
27|637ae972e1347dc2fd13175446808db5
28|b5ed3fc0a48ebc0c3a0a73364826f713
29|2a66db987127271c518f4dcdf3fb6093
30|06ae070f972e96ab3f5f55f69aec42ce
31|f8ee5bd9ea5f3d30834f829af0ccb355
32|f0bcec18c20a08ea277061495cbeb8c2
33|e8df5c7bd3372df61affdb58f92d6517
34|467f3a511219dea32f3f6f6770a6c258
35|cb3e0f7009ce734d4cfeba1192f6a784
36|26f4cfe5abf5a89d16e016f41312da80
37|01969ee5c5add43e90bea8e360610e13
38|7468f1bf7931a7ce57188edb11a0ae17
39|76393bdfde45560bd2470a8cf57b79e2
40|a4ecfb54693d9e92625213e66a55dba6
41|4a0d8ae86941822c9509616274d74210
42|870d43b4bbd16456b43c2eb67ffa7cd8
43|33f1038f537d19eda47a3b0e83f7a8e1
44|ef6a0627776a8c90e9dd21fb0d95b935
45|553458a3c4857c5918db965f743ef081
46|0d8b49efb24eef0f7404862bd96c1ca0
47|86d5c67f14fcf5c1774cca5a3adc9e84
48|fa282f0102fd389c4e81c24aecb5024b
49|409862c043296a5042cfb199cafc8f85
50|3c4e1eedcfdf23a0bfa6ac207763d8a4
EOF

echo "Fertig. 50 MP3s in $DST/"
