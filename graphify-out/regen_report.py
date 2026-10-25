import json
from pathlib import Path

extraction = json.loads(Path('graphify-out/.graphify_extract.json').read_text(encoding='utf-8'))
detection  = json.loads(Path('graphify-out/.graphify_detect.json').read_text(encoding='utf-8'))
analysis   = json.loads(Path('graphify-out/.graphify_analysis.json').read_text(encoding='utf-8'))

from graphify.build import build_from_json
from graphify.cluster import score_all
from graphify.analyze import god_nodes, surprising_connections, suggest_questions
from graphify.report import generate

G = build_from_json(extraction)
communities = {int(k): v for k, v in analysis['communities'].items()}
cohesion = {int(k): v for k, v in analysis['cohesion'].items()}
tokens = {'input': extraction.get('input_tokens', 0), 'output': extraction.get('output_tokens', 0)}

# LABELS
labels = {
    0: "UI Components", 1: "Frontend Performance", 2: "Agent Skills & Eval",
    3: "Authentication & RBAC", 4: "Frontend Performance", 5: "Products & Inventory",
    6: "Community 6", 7: "Community 7", 8: "Authentication & RBAC",
    9: "Finance & Banking", 10: "Audit & Reports", 11: "HR & Payroll",
    12: "API Client & Endpoints", 13: "Frontend Performance", 14: "Authentication & RBAC",
    15: "Authentication & RBAC", 16: "Branches & Companies", 17: "Branches & Companies",
    18: "Orders & Payments", 19: "HR & Payroll", 20: "Audit & Reports",
    21: "HR & Payroll", 22: "Monorepo & Build", 23: "API Client & Endpoints",
    24: "Products & Inventory", 25: "Products & Inventory", 26: "Community 26",
    27: "Community 27", 28: "Monorepo & Build", 29: "Community 29",
    30: "UI Components", 31: "Monorepo & Build", 32: "Authentication & RBAC",
    33: "Frontend Performance", 34: "Agent Skills & Eval", 35: "API Client & Endpoints",
    36: "UI Components", 37: "Community 37", 38: "Orders & Payments",
    39: "Orders & Payments", 40: "Finance & Banking", 41: "Authentication & RBAC",
    42: "Finance & Banking", 43: "Best Practices", 44: "Authentication & RBAC",
    45: "Community 45", 46: "Cron & Exchange Rates", 47: "Community 47",
    48: "Branches & Companies", 49: "Agent Skills & Eval", 50: "Branches & Companies",
    51: "UI Components", 52: "Community 52", 53: "Community 53",
    54: "Community 54", 55: "UI Components", 56: "Community 56",
    57: "Authentication & RBAC", 58: "Branches & Companies", 59: "Branches & Companies",
    60: "Branches & Companies", 61: "Branches & Companies", 62: "Branches & Companies",
    63: "Branches & Companies", 64: "Agent Skills & Eval", 65: "Orders & Payments",
    66: "Audit & Reports", 67: "HR & Payroll", 68: "HR & Payroll",
    69: "Products & Inventory", 70: "Community 70", 71: "Orders & Payments",
    72: "Orders & Payments", 73: "Database Schema", 74: "Community 74",
    75: "UI Components", 76: "Cron & Exchange Rates", 77: "Community 77",
    78: "Community 78", 79: "Community 79", 80: "Community 80",
    81: "Community 81", 82: "Database & RBAC", 83: "Community 83",
    84: "Community 84", 85: "Community 85", 86: "Community 86",
    87: "Community 87", 88: "Cron & Exchange Rates", 89: "Community 89",
    90: "Community 90", 91: "Community 91", 92: "Products & Inventory",
    93: "HR & Payroll", 94: "Branches & Companies", 95: "Branches & Companies",
    96: "Community 96", 97: "Agent Skills & Eval", 98: "Community 98",
    99: "Authentication & RBAC", 100: "Branches & Companies", 101: "Branches & Companies",
    102: "Community 102", 103: "Database Schema", 104: "API Client & Endpoints",
    105: "Community 105", 106: "UI Components", 107: "Community 107",
    108: "Community 108", 109: "Community 109", 110: "Community 110",
    111: "Community 111", 112: "Community 112", 113: "Community 113",
    114: "Community 114", 115: "Community 115", 116: "Community 116",
    117: "UI Components", 118: "Community 118", 119: "Community 119",
    120: "Community 120", 121: "Community 121", 122: "Community 122",
    123: "Community 123", 124: "Community 124", 125: "Community 125",
    126: "Community 126",
}

questions = suggest_questions(G, communities, labels)

report = generate(G, communities, cohesion, labels, analysis['gods'], analysis['surprises'], detection, tokens, '.', suggested_questions=questions)
Path('graphify-out/GRAPH_REPORT.md').write_text(report, encoding='utf-8')
Path('graphify-out/.graphify_labels.json').write_text(json.dumps({str(k): v for k, v in labels.items()}, ensure_ascii=False), encoding='utf-8')
print('Report updated with community labels')
