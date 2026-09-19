import { Add, Remove } from "@mui/icons-material";
import { Box, IconButton, Slider, Stack, Typography } from "@mui/material";
import { useMemo } from "react";
import {
  DT_PLAYBACK_SPEED,
  formatPlaybackSpeed,
  HT_PLAYBACK_SPEED,
  PLAYBACK_SPEED_MAX,
  PLAYBACK_SPEED_MIN,
  PLAYBACK_SPEED_NUDGE,
  PlaybackSpeedMark,
  playbackSpeedMarks,
  playbackSpeedTrackPercent,
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
        px: 0.5,
        py: 0.25,
        minWidth: 24,
        minHeight: 24,
        border: "none",
        background: "none",
        fontFamily: "inherit",
        cursor: "pointer",
        color: active || mark.isReplay ? "primary.main" : "text.secondary",
        fontSize: 11,
        fontWeight: active ? 600 : 500,
        lineHeight: 1.2,
        whiteSpace: "nowrap",
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

export function BasePlaybackSpeedPanel(props: BasePlaybackSpeedPanelProps) {
  const { value, replaySpeed, onChange } = props;
  const marks = useMemo(() => playbackSpeedMarks(replaySpeed), [replaySpeed]);
  const sliderValue = Math.min(PLAYBACK_SPEED_MAX, Math.max(PLAYBACK_SPEED_MIN, value));
  const canDecrease = value > PLAYBACK_SPEED_MIN;
  const canIncrease = value < PLAYBACK_SPEED_MAX;

  return (
    <Stack sx={{ p: 2, width: 280 }} gap={1}>
      <Stack direction="row" alignItems="baseline" justifyContent="space-between">
        <Typography variant="body2" color="text.secondary">
          Playback speed
        </Typography>
        <Typography variant="body2" sx={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
          {formatPlaybackSpeed(value)}
        </Typography>
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
          <Box sx={{ position: "absolute", left: 8, right: 8, top: 0, bottom: 0 }}>
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
                width: "auto",
                transform: "translateY(-50%)",
                py: 0,
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
