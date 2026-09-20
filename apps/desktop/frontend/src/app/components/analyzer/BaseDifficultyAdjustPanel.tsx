import { Add, Remove } from "@mui/icons-material";
import { Box, Button, IconButton, InputBase, Stack, Typography } from "@mui/material";
import { Beatmap } from "@osujs/core";
import { KeyboardEvent, useEffect, useRef, useState } from "react";
import {
  clampDifficultySliderValue,
  commitDifficultyInput,
  DIFFICULTY_SLIDER_STEP,
  difficultySliderRange,
  difficultySliderSegments,
  DifficultySliderDimension,
  formatDifficultySliderValue,
  nudgeDifficultySliderValue,
  sanitizeDifficultyInput,
  ViewerDifficultyFields,
} from "../../utils/difficulty-slider";
import { CapsuleRangeSlider } from "./CapsuleRangeSlider";

interface BaseDifficultyAdjustPanelProps {
  beatmap: Beatmap;
  viewer: ViewerDifficultyFields;
  disabled?: boolean;
  onChange: (dimension: DifficultySliderDimension, value: number) => void;
  onExtendedLimitsChange: (extended: boolean) => void;
}

const ROWS: Array<{ key: DifficultySliderDimension; label: string }> = [
  { key: "approachRate", label: "Approach Rate" },
  { key: "overallDifficulty", label: "Overall Difficulty" },
  { key: "circleSize", label: "Circle Size" },
];

function currentValue(beatmap: Beatmap, viewer: ViewerDifficultyFields, dimension: DifficultySliderDimension) {
  if (dimension === "approachRate") return viewer.approachRate ?? beatmap.difficulty.approachRate;
  if (dimension === "overallDifficulty") return viewer.overallDifficulty ?? beatmap.difficulty.overallDifficulty;
  return viewer.circleSize ?? beatmap.difficulty.circleSize;
}

function mapValue(beatmap: Beatmap, dimension: DifficultySliderDimension) {
  if (dimension === "approachRate") return beatmap.originalDifficulty.approachRate;
  if (dimension === "overallDifficulty") return beatmap.originalDifficulty.overallDifficulty;
  return beatmap.originalDifficulty.circleSize;
}

function isIncompleteDifficultyDraft(draft: string) {
  return draft === "" || draft === "-" || draft === "." || draft === "-." || draft.endsWith(".");
}

function DifficultyValueInput({
  value,
  min,
  max,
  disabled,
  ariaLabel,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  disabled?: boolean;
  ariaLabel: string;
  onChange: (value: number) => void;
}) {
  const focusedRef = useRef(false);
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(() => formatDifficultySliderValue(value));

  useEffect(() => {
    if (!focusedRef.current) setDraft(formatDifficultySliderValue(value));
  }, [value]);

  const commit = () => {
    const next = commitDifficultyInput(draft, value, min, max);
    setDraft(formatDifficultySliderValue(next));
    if (next !== value) onChange(next);
  };

  const handleChange = (raw: string) => {
    const sanitized = sanitizeDifficultyInput(raw, min, max);
    setDraft(sanitized);
    if (isIncompleteDifficultyDraft(sanitized)) return;
    const parsed = Number(sanitized);
    if (!Number.isFinite(parsed)) return;
    if (parsed > max) {
      onChange(max);
      return;
    }
    if (parsed < min) {
      onChange(min);
      return;
    }
    onChange(Math.round(parsed * 10) / 10);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
      event.currentTarget.blur();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setDraft(formatDifficultySliderValue(value));
      event.currentTarget.blur();
    }
  };

  return (
    <Box
      sx={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "flex-end",
        boxSizing: "border-box",
        width: "5.5ch",
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
          {formatDifficultySliderValue(value)}
        </Typography>
      )}
      <InputBase
        value={draft}
        disabled={disabled}
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
          "aria-label": ariaLabel,
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
            cursor: disabled ? "default" : "text",
            lineHeight: "inherit",
          },
        }}
      />
    </Box>
  );
}

function DifficultySliderRow({
  dimension,
  label,
  beatmap,
  viewer,
  disabled,
  onChange,
}: {
  dimension: DifficultySliderDimension;
  label: string;
  beatmap: Beatmap;
  viewer: ViewerDifficultyFields;
  disabled?: boolean;
  onChange: (dimension: DifficultySliderDimension, value: number) => void;
}) {
  const committed = currentValue(beatmap, viewer, dimension);
  const [draft, setDraft] = useState<number | null>(null);
  const value = draft ?? committed;
  const original = mapValue(beatmap, dimension);
  const range = difficultySliderRange(dimension, viewer.extendedLimits);

  useEffect(() => {
    setDraft(null);
  }, [committed, viewer.extendedLimits]);

  const commit = (next: number) => {
    setDraft(null);
    if (next !== committed) onChange(dimension, next);
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.25 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {label}
        </Typography>
        <DifficultyValueInput
          value={value}
          min={range.min}
          max={range.max}
          disabled={disabled}
          ariaLabel={`${label} value`}
          onChange={commit}
        />
      </Stack>
      <Stack direction="row" alignItems="center" gap={0.5}>
        <IconButton
          size="small"
          aria-label={`Decrease ${label}`}
          disabled={disabled || value <= range.min}
          onClick={() =>
            commit(nudgeDifficultySliderValue(dimension, value, -DIFFICULTY_SLIDER_STEP, viewer.extendedLimits))
          }
          sx={{
            transitionProperty: "transform, opacity",
            transitionDuration: "120ms",
            "&:active": { transform: "scale(0.96)" },
          }}
        >
          <Remove fontSize="small" />
        </IconButton>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <CapsuleRangeSlider
            value={clampDifficultySliderValue(dimension, value, viewer.extendedLimits)}
            segments={difficultySliderSegments(dimension, viewer.extendedLimits)}
            marks={[{ value: original, label: "MAP" }]}
            disabled={disabled}
            ariaLabel={label}
            onChange={setDraft}
            onChangeCommitted={commit}
          />
        </Box>
        <IconButton
          size="small"
          aria-label={`Increase ${label}`}
          disabled={disabled || value >= range.max}
          onClick={() =>
            commit(nudgeDifficultySliderValue(dimension, value, DIFFICULTY_SLIDER_STEP, viewer.extendedLimits))
          }
          sx={{
            transitionProperty: "transform, opacity",
            transitionDuration: "120ms",
            "&:active": { transform: "scale(0.96)" },
          }}
        >
          <Add fontSize="small" />
        </IconButton>
      </Stack>
    </Box>
  );
}

export function BaseDifficultyAdjustPanel(props: BaseDifficultyAdjustPanelProps) {
  const { beatmap, viewer, disabled, onChange, onExtendedLimitsChange } = props;

  return (
    <Stack sx={{ p: 2, width: 420 }} gap={1.5}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
        <Typography variant="body2" color="text.secondary">
          Difficulty
        </Typography>
        <Button
          size="small"
          variant={viewer.extendedLimits ? "contained" : "outlined"}
          aria-pressed={viewer.extendedLimits}
          disabled={disabled}
          onClick={() => onExtendedLimitsChange(!viewer.extendedLimits)}
          sx={{
            textTransform: "none",
            minWidth: 0,
            height: 28,
            px: 1.25,
            fontSize: 12,
            lineHeight: 1,
            transitionProperty: "background-color, color, border-color, transform",
            transitionDuration: "120ms",
            "&:active": { transform: "scale(0.96)" },
          }}
        >
          Extended limits
        </Button>
      </Stack>

      {ROWS.map((row) => (
        <DifficultySliderRow
          key={row.key}
          dimension={row.key}
          label={row.label}
          beatmap={beatmap}
          viewer={viewer}
          disabled={disabled}
          onChange={onChange}
        />
      ))}
    </Stack>
  );
}
