# Stillness Handoff Notes

These notes are for parallel DBT/CBT/Insights work without rolling back the Android-first shell.

## Do Not Overwrite

- Keep the current 5-tab shell: `Today`, `Practice`, `Journal`, `Garden`, `More`.
- Do not replace `index.html` with an older snippet. Patch small sections only.
- Preserve all existing storage keys:
  - `mindful:day:*`
  - `mindful:config:`
  - `mindful:activity:`
  - `mindful:path:`
  - `mindful:theme`
  - `mindful:audio`
- Keep Memory/Backup behavior and the saved-data corner.

## Suggested Schema Additions

Add fields in `blankDay()` with backward-compatible defaults:

```js
dbtSkills: [],
thoughtRecords: []
```

Prefer plural `thoughtRecords` so multiple reframes can be saved in one day. Suggested record shape:

```js
{
  t: Date.now(),
  situation: '',
  feeling: '',
  intensity: 0,
  automaticThought: '',
  distortions: [],
  evidenceFor: '',
  evidenceAgainst: '',
  balancedThought: '',
  nextMove: ''
}
```

Suggested DBT log shape:

```js
{
  t: Date.now(),
  skill: 'TIPP',
  step: 'paced breathing',
  note: '',
  helped: null
}
```

Config addition:

```js
voiceCues: false
```

Save this inside `mindful:config:` with existing config fields.

## Content / Safety Tone

- Keep 988 visible in crisis/support flows.
- Use clear outside-help language: “If you might hurt yourself or someone else, call/text 988 or emergency services now.”
- Avoid diagnostic claims. Use “may help,” “try,” and “on days with...” instead of causal language.

## Test Asset

Use `test-data/stillness-insights-seed.json` through Memory -> Restore from file to test Insights, Search, thought records, DBT logs, and weekly summaries without needing weeks of real user data.
