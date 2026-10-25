import json
from pathlib import Path

extraction = json.loads(Path('graphify-out/.graphify_extract.json').read_text(encoding='utf-8'))
analysis = json.loads(Path('graphify-out/.graphify_analysis.json').read_text(encoding='utf-8'))
communities = {int(k): v for k, v in analysis['communities'].items()}

# Build node lookup
nodes_by_id = {n['id']: n for n in extraction['nodes']}

# Label communities based on their nodes
labels = {}
for cid, node_ids in communities.items():
    if not node_ids:
        labels[cid] = f"Community {cid}"
        continue
    # Get top node labels to infer community name
    node_labels = [nodes_by_id.get(nid, {}).get('label', '') for nid in node_ids[:5] if nid in nodes_by_id]
    combined = ' '.join(node_labels).lower()
    if 'auth' in combined:
        labels[cid] = "Authentication & RBAC"
    elif 'order' in combined or 'invoice' in combined or 'payment' in combined:
        labels[cid] = "Orders & Payments"
    elif 'product' in combined or 'inventory' in combined or 'warehouse' in combined:
        labels[cid] = "Products & Inventory"
    elif 'branch' in combined or 'company' in combined:
        labels[cid] = "Branches & Companies"
    elif 'employee' in combined or 'hr' in combined or 'payroll' in combined:
        labels[cid] = "HR & Payroll"
    elif 'currency' in combined or 'exchange' in combined or 'bank' in combined:
        labels[cid] = "Finance & Banking"
    elif 'vercel' in combined or 'react' in combined or 'frontend' in combined:
        labels[cid] = "Frontend Performance"
    elif 'turborepo' in combined or 'monorepo' in combined or 'package' in combined:
        labels[cid] = "Monorepo & Build"
    elif 'skill' in combined or 'agent' in combined or 'eval' in combined:
        labels[cid] = "Agent Skills & Eval"
    elif 'seed' in combined or 'rbac' in combined:
        labels[cid] = "Database & RBAC"
    elif 'api' in combined or 'client' in combined or 'endpoint' in combined:
        labels[cid] = "API Client & Endpoints"
    elif 'schema' in combined or 'database' in combined or 'migration' in combined:
        labels[cid] = "Database Schema"
    elif 'i18n' in combined or 'locale' in combined or 'translation' in combined:
        labels[cid] = "i18n & Localization"
    elif 'store' in combined or 'zustand' in combined:
        labels[cid] = "State Management"
    elif 'cron' in combined or 'bcv' in combined:
        labels[cid] = "Cron & Exchange Rates"
    elif 'rule' in combined or 'best' in combined or 'practice' in combined:
        labels[cid] = "Best Practices"
    elif 'audit' in combined or 'report' in combined:
        labels[cid] = "Audit & Reports"
    elif 'component' in combined or 'ui' in combined or 'page' in combined:
        labels[cid] = "UI Components"
    else:
        labels[cid] = f"Community {cid}"

for cid, label in sorted(labels.items()):
    print(f"  {cid}: {label} ({len(communities[cid])} nodes)")
