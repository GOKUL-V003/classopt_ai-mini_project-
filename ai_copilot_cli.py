"""
ai_copilot_cli.py - Standalone bridge for executing AI Copilot instructions,
scheduling meetings/events into SQLite, and persisting chat instruction logs.
Callable from Next.js server routes, command-line scripts, or background workers.
"""

import sys
import json
import os

# Set standard output encoding to utf-8 to prevent Windows cp1252 charmap errors
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

from db import get_db_connection, log_ai_instruction, get_ai_instructions, insert_event
from app import handle_ai_schedule_instruction

def main():
    prompt = ""
    api_key = None

    if len(sys.argv) > 1:
        raw_arg = " ".join(sys.argv[1:]).strip()
        if raw_arg.startswith('{') and raw_arg.endswith('}'):
            try:
                payload = json.loads(raw_arg)
                prompt = payload.get('prompt', '')
                api_key = payload.get('apiKey', None)
            except Exception:
                prompt = raw_arg
        else:
            prompt = raw_arg
    else:
        raw_input = sys.stdin.read().strip()
        if raw_input:
            try:
                payload = json.loads(raw_input)
                prompt = payload.get('prompt', '')
                api_key = payload.get('apiKey', None)
            except Exception:
                prompt = raw_input

    prompt = prompt.strip()
    if not prompt:
        print(json.dumps({'success': False, 'error': 'No prompt provided'}, ensure_ascii=False))
        return

    # 1. Check if asking to view logs
    q = prompt.lower()
    if any(k in q for k in ['instruction log', 'view instructions', 'ai history', 'stored instructions', 'chat logs', 'show logs', 'action logs']):
        logs = get_ai_instructions(limit=10)
        log_html = "📋 <strong>Recent AI Instructions Stored in Database:</strong><br><br>"
        if logs:
            for l in logs:
                log_html += (
                    f"• <strong>#{l['id']} [{l['action_type']}]</strong>: \"{l['user_prompt'][:45]}...\"<br>"
                    f"&nbsp;&nbsp;<span style='font-size: 11px; color: #166534;'>Status: {l['execution_status']} • {l['timestamp']}</span><br>"
                )
            log_html += "<br><em>All commands are persistently stored in SQLite table <code>ai_chat_instructions</code>.</em>"
        else:
            log_html = "📋 <strong>No instructions logged yet in the database.</strong>"

        log_ai_instruction(prompt, 'VIEW_LOGS', None, 'SUCCESS', log_html, 'SmartOccupy Copilot CLI')
        print(json.dumps({'success': True, 'text': log_html, 'source': 'SmartOccupy Copilot'}, ensure_ascii=False))
        return

    # 2. Check and execute scheduling instructions
    sched_res = handle_ai_schedule_instruction(prompt, api_key=api_key)
    if sched_res:
        print(json.dumps(sched_res, ensure_ascii=False))
        return

    # 3. Fallback or general query logging
    general_reply = (
        "💡 <strong>Campus Resource Copilot:</strong><br><br>"
        f"Processed query: <em>\"{prompt}\"</em><br><br>"
        "Instruction recorded in SQLite table <code>ai_chat_instructions</code>."
    )
    log_ai_instruction(prompt, 'GENERAL_QUERY', None, 'SUCCESS', general_reply, 'SmartOccupy Copilot CLI')
    print(json.dumps({
        'success': True,
        'text': general_reply,
        'source': 'SmartOccupy Copilot'
    }, ensure_ascii=False))

if __name__ == '__main__':
    main()
