"""Read-only source integration with the existing expansion coach; runtime stays here."""
import json
import os
import sys
from pathlib import Path

root = Path(os.environ['EXPANSION_COACH_PATH']).resolve()
sys.path.insert(0, str(root / 'scripts'))
from web_core import CurrentUser, TrainingService  # noqa: E402


def main():
    payload = json.load(sys.stdin)
    raw = payload['user']
    user = CurrentUser(
        user_id=raw['id'],
        display_name=raw['name'],
        role='MEMBER',
        team_id=raw['region'],
        source_channel='store-learning-mvp',
    )
    service = TrainingService()
    action = payload['action']
    if action == 'options':
        result = service.options()
    elif action == 'start':
        config = payload.get('config') or {}
        mode = config.get('mode', 'practice')
        if mode not in ('practice', 'exam'):
            raise ValueError('仅支持练习和模拟考试')
        config['realtime_hint'] = mode == 'practice'
        result = service.start(user, config)
    elif action == 'message':
        result = service.message(user, payload['session_id'], payload['text'])
    elif action == 'finish':
        result = service.finish(user, payload['session_id'])
    else:
        raise ValueError('不支持的动作')
    print(json.dumps(result, ensure_ascii=False))


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        print(json.dumps({'error': str(exc)}, ensure_ascii=False))
        raise SystemExit(1)
