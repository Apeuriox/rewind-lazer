import { Box, Slider } from "@mui/material";
import {
  DIFFICULTY_HIGH_COLOR,
  DIFFICULTY_LOW_COLOR,
  DIFFICULTY_SLIDER_STEP,
  DifficultySliderSegment,
  difficultyTrackPercent,
  segmentOwnsValue,
} from "../../utils/difficulty-slider";

export type CapsuleSliderMark = {
  value: number;
  label: string;
};

interface CapsuleRangeSliderProps {
  value: number;
  segments: DifficultySliderSegment[];
  marks?: CapsuleSliderMark[];
  disabled?: boolean;
  ariaLabel: string;
  onChange: (value: number) => void;
}

const VISUAL_GAP_PX = 4;
const RAIL_HEIGHT = 4;

function thumbColor(segments: DifficultySliderSegment[], value: number) {
  const active = segments.find((segment) => segmentOwnsValue(segment, value));
  if (active?.color === DIFFICULTY_LOW_COLOR) return "#1a1a1a";
  if (active?.color === DIFFICULTY_HIGH_COLOR) return "#ffffff";
  return undefined;
}

export function CapsuleRangeSlider(props: CapsuleRangeSliderProps) {
  const { value, segments, marks = [], disabled, ariaLabel, onChange } = props;
  const totalMin = segments[0].min;
  const totalMax = segments[segments.length - 1].max;
  const thumb = thumbColor(segments, value);

  return (
    <Box sx={{ position: "relative", height: 48 }}>
      {segments.map((segment, index) => {
        const left = difficultyTrackPercent(segment.min, totalMin, totalMax);
        const width = difficultyTrackPercent(segment.max, totalMin, totalMax) - left;
        const leftInset = index === 0 ? 0 : VISUAL_GAP_PX / 2;
        const rightInset = index === segments.length - 1 ? 0 : VISUAL_GAP_PX / 2;
        return (
          <Box
            key={`${segment.min}-${segment.max}-${index}`}
            sx={{
              position: "absolute",
              top: "50%",
              left: `calc(${left}% + ${leftInset}px)`,
              width: `calc(${width}% - ${leftInset + rightInset}px)`,
              height: RAIL_HEIGHT,
              transform: "translateY(-50%)",
              borderRadius: "999px",
              bgcolor: segment.color ?? "rgba(255,255,255,0.28)",
              opacity: disabled ? 0.4 : 1,
              pointerEvents: "none",
            }}
          />
        );
      })}

      {marks.map((mark) => (
        <Box
          key={`${mark.label}-${mark.value}`}
          component="button"
          type="button"
          aria-label={`Set to map value ${mark.value}`}
          disabled={disabled || mark.value < totalMin || mark.value > totalMax}
          onClick={() => onChange(mark.value)}
          sx={{
            position: "absolute",
            left: `${difficultyTrackPercent(mark.value, totalMin, totalMax)}%`,
            top: 28,
            transform: "translateX(-50%)",
            appearance: "none",
            p: 0,
            m: 0,
            border: "none",
            background: "none",
            fontFamily: "inherit",
            cursor: disabled ? "default" : "pointer",
            color: Math.abs(value - mark.value) < 0.05 ? "primary.main" : "text.secondary",
            fontSize: 14,
            fontWeight: Math.abs(value - mark.value) < 0.05 ? 600 : 500,
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
      ))}

      <Slider
        size="small"
        min={totalMin}
        max={totalMax}
        step={DIFFICULTY_SLIDER_STEP}
        value={value}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(_, next) => onChange(next as number)}
        sx={{
          position: "absolute",
          left: 0,
          right: 0,
          top: "50%",
          zIndex: 2,
          width: "auto",
          transform: "translateY(-50%)",
          padding: "6px 0",
          "& .MuiSlider-rail": { opacity: 0, height: RAIL_HEIGHT },
          "& .MuiSlider-track": { opacity: 0, height: RAIL_HEIGHT },
          "& .MuiSlider-thumb": {
            width: 14,
            height: 14,
            ...(thumb ? { bgcolor: thumb } : {}),
            boxShadow: "0 0 0 1px rgba(0,0,0,0.25)",
            transitionProperty: "box-shadow, transform, background-color",
            transitionDuration: "120ms",
            "&:hover, &.Mui-focusVisible, &.Mui-active": {
              boxShadow: "0 0 0 4px rgba(255,255,255,0.18)",
            },
          },
          "& .MuiSlider-mark": { display: "none" },
        }}
      />
    </Box>
  );
}
