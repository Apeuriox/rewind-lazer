import { Add, Remove } from "@mui/icons-material";
import { Box, IconButton, InputBase, Slider, Stack, Typography } from "@mui/material";
import { KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  commitPlaybackSpeedInput,
  formatPlaybackSpeed,
  HT_PLAYBACK_SPEED,
  PLAYBACK_SPEED_MAX,
  PLAYBACK_SPEED_MIN,
  PLAYBACK_SPEED_NUDGE,
  PlaybackSpeedMark,
  playbackSpeedMarks,
  playbackSpeedTrackPercent,
  roundPlaybackSpeed,
  sanitizePlaybackSpeedInput,
  snapPlaybackSpeed,
  nudgePlaybackSpeed,
} from "../../utils/constants";

interface BasePlaybackSpeedPanelProps {
  value: number;
  replaySpeed?: number;
  onChange: (value: number) => void;
}

function markAriaLabel(mark: PlaybackSpeedMark) {
  const speed = formatPlaybackSpeed(mark.value);
  if (mark.isReplay && mark.label.includes("HT")) return `Set playback speed to HT and replay rate ${speed}`;
  if (mark.isReplay && mark.label.includes("DT")) return `Set playback speed to DT and replay rate ${speed}`;
  if (mark.isReplay) return `Set playback speed to the replay rate ${speed}`;
  if (mark.value === HT_PLAYBACK_SPEED) return `Set playback speed to HT ${speed}`;
  return `Set playback speed to DT ${speed}`;
}

function SpeedMarkButton({
  mark,
  active,
  onSelect,
}: {
  mark: PlaybackSpeedMark;
  active: boolean;
  onSelect: (value: number) => void;
}) {
  const largerType = mark.label.includes("HT") || mark.label.includes("DT");
  return (
    <Box
      component="button"
      type="button"
      aria-label={markAriaLabel(mark)}
      aria-pressed={active}
      onClick={() => onSelect(mark.value)}
      sx={{
        position: "absolute",
        left: `${playbackSpeedTrackPercent(mark.value)}%`,
        top: mark.placement === "above" ? 0 : undefined,
        bottom: mark.placement === "below" ? 0 : undefined,
        transform: "translateX(-50%)",
        appearance: "none",
        p: 0,
        m: 0,
        border: "none",
        background: "none",
        fontFamily: "inherit",
        cursor: "pointer",
        color: active || mark.isReplay ? "primary.main" : "text.secondary",
        fontSize: largerType ? 14 : 11,
        fontWeight: active ? 600 : 500,
        lineHeight: 1,
        whiteSpace: "nowrap",
        zIndex: 1,
        "&:hover": { color: "primary.light" },
        "&:focus-visible": {
          outline: "2px solid",
          outlineColor: "primary.main",
          outlineOffset: 2,
          borderRadius: 0.5,
        },
      }}
    >
      {mark.label}
    </Box>
  );
}

function PlaybackSpeedValueInput({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const focusedRef = useRef(false);
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(() => roundPlaybackSpeed(value).toFixed(2));

  useEffect(() => {
    if (!focusedRef.current) setDraft(roundPlaybackSpeed(value).toFixed(2));
  }, [value]);

  const commit = () => {
    const next = commitPlaybackSpeedInput(draft, value);
    setDraft(next.toFixed(2));
    if (next !== value) onChange(next);
  };

  const handleChange = (raw: string) => {
    const sanitized = sanitizePlaybackSpeedInput(raw);
    setDraft(sanitized);
    if (sanitized === "" || sanitized === ".") return;
    const parsed = Number(sanitized);
    if (!Number.isFinite(parsed)) return;
    if (parsed > PLAYBACK_SPEED_MAX) {
      onChange(PLAYBACK_SPEED_MAX);
      return;
    }
    if (parsed >= PLAYBACK_SPEED_MIN) onChange(roundPlaybackSpeed(parsed));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
      event.currentTarget.blur();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setDraft(roundPlaybackSpeed(value).toFixed(2));
      event.currentTarget.blur();
    }
  };

  const idleValue = `${roundPlaybackSpeed(value).toFixed(2)}x`;

  return (
    <Box
      sx={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "flex-end",
        boxSizing: "border-box",
        width: "6ch",
        minHeight: "1.4em",
        px: 0.5,
        fontSize: "0.875rem",
        fontWeight: 600,
        fontVariantNumeric: "tabular-nums",
        lineHeight: 1.4,
        borderRadius: 0.5,
        "&:focus-within": {
          outline: "2px solid",
          outlineColor: "primary.main",
          outlineOffset: 0,
        },
      }}
    >
      {!focused && (
        <Typography
          component="span"
          sx={{
            fontSize: "inherit",
            fontWeight: "inherit",
            fontVariantNumeric: "inherit",
            lineHeight: "inherit",
            pointerEvents: "none",
          }}
        >
          {idleValue}
        </Typography>
      )}
      <InputBase
        value={draft}
        autoFocus
        onFocus={(event) => {
          focusedRef.current = true;
          setFocused(true);
          event.target.select();
        }}
        onBlur={() => {
          focusedRef.current = false;
          setFocused(false);
          commit();
        }}
        onChange={(event) => handleChange(event.target.value)}
        onKeyDown={handleKeyDown}
        inputProps={{
          inputMode: "decimal",
          "aria-label": "Playback speed value",
          autoComplete: "off",
          spellCheck: false,
        }}
        sx={{
          position: focused ? "static" : "absolute",
          inset: 0,
          width: "100%",
          opacity: focused ? 1 : 0,
          fontSize: "inherit",
          fontWeight: "inherit",
          fontVariantNumeric: "inherit",
          "& input": {
            boxSizing: "border-box",
            width: "100%",
            height: "100%",
            padding: 0,
            textAlign: "right",
            cursor: "text",
            lineHeight: "inherit",
          },
        }}
      />
    </Box>
  );
}

export function BasePlaybackSpeedPanel(props: BasePlaybackSpeedPanelProps) {
  const { value, replaySpeed, onChange } = props;
  const marks = useMemo(() => playbackSpeedMarks(replaySpeed), [replaySpeed]);
  const sliderValue = Math.min(PLAYBACK_SPEED_MAX, Math.max(PLAYBACK_SPEED_MIN, value));
  const canDecrease = value > PLAYBACK_SPEED_MIN;
  const canIncrease = value < PLAYBACK_SPEED_MAX;

  return (
    <Stack sx={{ p: 2, width: 380 }} gap={1}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography variant="body2" color="text.secondary">
          Playback speed
        </Typography>
        <PlaybackSpeedValueInput value={value} onChange={onChange} />
      </Stack>

      <Stack direction="row" alignItems="center" gap={0.5}>
        <IconButton
          size="small"
          aria-label="Decrease playback speed"
          disabled={!canDecrease}
          onClick={() => onChange(nudgePlaybackSpeed(value, -PLAYBACK_SPEED_NUDGE))}
          sx={{
            transitionProperty: "transform, opacity",
            transitionDuration: "120ms",
            "&:active": { transform: "scale(0.96)" },
          }}
        >
          <Remove fontSize="small" />
        </IconButton>

        <Box sx={{ position: "relative", flex: 1, height: 56 }}>
          <Box sx={{ position: "absolute", left: 10, right: 10, top: 0, bottom: 0 }}>
            {marks.map((mark) => (
              <SpeedMarkButton
                key={`${mark.label}-${mark.value}`}
                mark={mark}
                active={Math.abs(value - mark.value) < 0.005}
                onSelect={onChange}
              />
            ))}
            <Slider
              size="small"
              min={PLAYBACK_SPEED_MIN}
              max={PLAYBACK_SPEED_MAX}
              step={0.01}
              value={sliderValue}
              marks={marks.map((mark) => ({ value: mark.value }))}
              valueLabelDisplay="off"
              aria-label="Playback speed"
              getAriaValueText={formatPlaybackSpeed}
              onChange={(_, next) => onChange(snapPlaybackSpeed(next as number, marks))}
              sx={{
                position: "absolute",
                left: 0,
                right: 0,
                top: "50%",
                zIndex: 2,
                width: "auto",
                transform: "translateY(-50%)",
                padding: "6px 0",
                "& .MuiSlider-thumb": {
                  width: 14,
                  height: 14,
                  transitionProperty: "box-shadow, transform",
                  transitionDuration: "120ms",
                },
                "& .MuiSlider-rail": { opacity: 0.28, height: 4 },
                "& .MuiSlider-track": { height: 4 },
                "& .MuiSlider-mark": {
                  width: 2,
                  height: 10,
                  borderRadius: 1,
                  backgroundColor: "text.secondary",
                },
                "& .MuiSlider-markActive": { backgroundColor: "primary.main" },
              }}
            />
          </Box>
        </Box>

        <IconButton
          size="small"
          aria-label="Increase playback speed"
          disabled={!canIncrease}
          onClick={() => onChange(nudgePlaybackSpeed(value, PLAYBACK_SPEED_NUDGE))}
          sx={{
            transitionProperty: "transform, opacity",
            transitionDuration: "120ms",
            "&:active": { transform: "scale(0.96)" },
          }}
        >
          <Add fontSize="small" />
        </IconButton>
      </Stack>
    </Stack>
  );
}
