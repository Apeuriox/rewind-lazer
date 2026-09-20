# Changelog

## 0.3.0

osu!lazer replay viewing, live PP/SR, and viewer Difficulty Adjust.

### Lazer replays

- osu!lazer hit registration, including slider heads, ticks, and ends
- Correct accuracy for lazer scores (slider ticks/ends counted separately from 300/100/50/miss)
- Load beatmaps from a lazer data directory
- Optional default of opening replays from lazer
- Watch newly exported lazer `.osr` files the same way stable exports are watched
- HUD shows Tick / End counts on lazer replays, plus a short “Lazer Replay” label

### Difficulty and playback

- Honor lazer Difficulty Adjust (DA), including values outside 0–10 and custom HT/DT `speed_change`
- Viewer sliders for Approach Rate, Overall Difficulty, and Circle Size
- Extended limits: AR −10–11, CS/OD 0–11; out-of-range replay DA turns this on automatically
- `+` / `−` on the difficulty sliders (0.1 steps), matching playback speed
- Beatmap rebuild, PP, and star rating run when the slider is released, not while dragging
- Negative AR no longer recolors the slider thumb/track
- Playback speed popover with HT/DT marks, custom clock rate from the replay, and typed values

### PP, stars, and the timeline graph

- Difficulty graph and performance use [Apeuriox/rosu-pp](https://github.com/Apeuriox/rosu-pp) (current osu!standard, including reading)
- Lazer mods are passed as the score-info JSON array (`HT` + `speed_change`, `DA`, `RX`, …); stable still uses the bitmask
- Live PP under accuracy, drawn with the skin score digits; seeking rewinds PP with the judgements
- Star rating under AR/OD/CS/HP
- Settings → Game → HUD: toggles for PP, stars, and AR/OD/CS/HP/mods

### Audio and skins

- MP3s without a usable CBR/VBR header are converted to WAV so seeking stays accurate
- Optional high-precision audio path for long or awkward MP3s
- Skin loading bugfix

### Build

- Windows CI no longer fails with `ENAMETOOLONG` (Electron caches stay outside the worktree)
- Linux and Windows GitHub Actions packages on `v*` tags

### Known limitations

- Stable PP has no live classic total score, so slider-break PP is combo-estimated and may differ from the website
- Flashlight is still not simulated in the viewer
