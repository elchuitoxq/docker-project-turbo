import json
from pathlib import Path

detect = json.loads(Path('graphify-out/.graphify_detect.json').read_text(encoding='utf-8'))
all_files = [f for files in detect['files'].values() for f in files]
all_files = [f for f in all_files if 'graphify-out' not in f]

chunk_size = 22
chunks = []
for i in range(0, len(all_files), chunk_size):
    chunks.append(all_files[i:i+chunk_size])

for i, chunk in enumerate(chunks):
    chunk_path = f'graphify-out/.graphify_chunk_{i+1:02d}_files.txt'
    Path(chunk_path).write_text('\n'.join(chunk), encoding='utf-8')
    print(f'Wrote chunk {i+1} with {len(chunk)} files to {chunk_path}')
