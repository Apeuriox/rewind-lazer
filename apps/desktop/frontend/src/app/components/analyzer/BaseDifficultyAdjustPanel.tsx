import { Box, Button, InputBase, Stack, Typography } from "@mui/material";
import { Beatmap } from "@osujs/core";
import { KeyboardEvent, useEffect, useRef, useState } from "react";
import {
  clampDifficultySliderValue,
  commitDifficultyInput,
  difficultySliderRange,
  difficultySliderSegments,
  DifficultySliderDimension,
  formatDifficultySliderValue,
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

      {ROWS.map((row) => {
        const value = currentValue(beatmap, viewer, row.key);
        const original = mapValue(beatmap, row.key);
        const range = difficultySliderRange(row.key, viewer.extendedLimits);
        return (
          <Box key={row.key}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.25 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {row.label}
              </Typography>
              <DifficultyValueInput
                value={value}
                min={range.min}
                max={range.max}
                disabled={disabled}
                ariaLabel={`${row.label} value`}
                onChange={(next) => onChange(row.key, next)}
              />
            </Stack>
            <CapsuleRangeSlider
              value={clampDifficultySliderValue(row.key, value, viewer.extendedLimits)}
              segments={difficultySliderSegments(row.key, viewer.extendedLimits)}
              marks={[{ value: original, label: "MAP" }]}
              disabled={disabled}
              ariaLabel={row.label}
              onChange={(next) => onChange(row.key, next)}
            />
          </Box>
        );
      })}
    </Stack>
  );
}
