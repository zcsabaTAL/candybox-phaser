# Repository rules

## Long-running CI and deployment

- Do not stream `gh run watch` or repeatedly poll an unchanged CI or Pages deployment into the conversation.
- Prefer one concise `gh run view --json status,conclusion,url` check. Make at most two background status reads in one turn unless the state changes, the user explicitly asks for another check, or a failure needs diagnosis.
- If a run is still in progress, report the run URL and return control to the user. Do not keep the turn open solely to watch an unchanged run.
- When the user asks to test manually, provide the current playable URL and exact test target as soon as the build is usable. Do not delay manual testing for repetitive monitoring.
- On failure, fetch the failed log once, diagnose it, and run the smallest relevant local regression before starting another full CI run.
- Never expose repeated unchanged status output. Summarize only meaningful transitions: started, failed with cause, or deployed successfully.
