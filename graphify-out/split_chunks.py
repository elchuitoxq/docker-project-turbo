import json
from pathlib import Path

detect = json.loads(Path('graphify-out/.graphify_detect.json').read_text(encoding='utf-8'))
all_files = [f for files in detect['files'].values() for f in files]

# Exclude graphify-out
all_files = [f for f in all_files if 'graphify-out' not in f]

# Split into chunks of 22
chunk_size = 22
chunks = []
for i in range(0, len(all_files), chunk_size):
    chunks.append(all_files[i:i+chunk_size])

print(f'Total files: {len(all_files)}')
print(f'Chunks: {len(chunks)}')
for i, c in enumerate(chunks):
    print(f'Chunk {i+1}: {len(c)} files')
    for f in c[:3]:
        print(f'  - {f}')
    if len(c) > 3:
        print(f'  ... and {len(c)-3} more')
