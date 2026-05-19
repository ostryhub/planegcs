#!/bin/bash

if [ -f planegcs_dist/planegcs.wasm ] && [ -f planegcs_dist/planegcs.js ] && [ -f planegcs_dist/CHECKSUMS.txt ]; then
    rm -rf dist && \
    tsc && \
    mkdir -p dist/planegcs_dist && \
    cp planegcs_dist/planegcs.wasm planegcs_dist/planegcs.js planegcs_dist/CHECKSUMS.txt dist/planegcs_dist;
else
    echo 'Error: planegcs wasm artifacts/checksums not present, run npm run build:all before publishing'
    exit 1
fi
