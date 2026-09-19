import {
  Box,
  Button,
  CircularProgress,
  Divider,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Popover,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  Help,
  MoreVert,
  PauseCircle,
  PhotoCamera,
  PlayCircle,
  Settings,
  VolumeOff,
  VolumeUp,
} from "@mui/icons-material";
import { MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BaseAudioSettingsPanel } from "./BaseAudioSettingsPanel";
import { BaseGameTimeSlider } from "./BaseGameTimeSlider";
import { useGameClockControls, useGameClockTime } from "../../hooks/game-clock";
import { formatGameTime } from "@osujs/math";
import { useAudioSettings, useAudioSettingsService } from "../../hooks/audio";
import { useModControls } from "../../hooks/mods";
import modHiddenImg from "../../../assets/mod_hidden.png";
import { formatPlaybackSpeed, PlaybarColors } from "../../utils/constants";
import { BasePlaybackSpeedPanel } from "./BasePlaybackSpeedPanel";

import { useSettingsModalContext } from "../../providers/SettingsProvider";
import { ReplayAnalysisEvent, ReplayClient } from "@osujs/core";
import { useObservable } from "rxjs-hooks";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import { HelpModalDialog } from "./HelpModal";
import { BaseCurrentTime, GameCurrentTimeHandle } from "./BaseCurrentTime";
import { ignoreFocus } from "../../utils/focus";
import { useAnalysisApp, useCommonManagers } from "../../providers/TheaterProvider";
import { DEFAULT_PLAY_BAR_SETTINGS } from "../../services/common/playbar";
import type { HighPrecisionAudioState } from "../../services/manager/ScenarioManager";

const centerUp = {
  anchorOrigin: {
    vertical: "top",
    horizontal: "center",
  },
  transformOrigin: {
    vertical: "bottom",
    horizontal: "center",
  },
};

function MoreMenu() {
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);
  const handleClick = (event: any) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };

  const analyzer = useAnalysisApp();
  const handleTakeScreenshot = () => {
    analyzer.screenshotTaker.takeScreenshot();
    handleClose();
  };

  const [helpOpen, setHelpOpen] = useState(false);

  const handleOpenHelp = () => {
    setHelpOpen(true);
    handleClose();
  };

  return (
    <>
      <HelpModalDialog isOpen={helpOpen} onClose={() => setHelpOpen(false)} />
      <IconButton
        aria-label="more"
        id="long-button"
        aria-controls="long-menu"
        // aria-expanded={open ? "true" : undefined}
        aria-haspopup="true"
        onClick={handleClick}
        onFocus={ignoreFocus}
      >
        <MoreVert />
      </IconButton>
      <Menu
        open={open}
        onClose={handleClose}
        anchorEl={anchorEl}
        anchorOrigin={{
          vertical: "top",
          horizontal: "center",
        }}
        transformOrigin={{
          vertical: "bottom",
          horizontal: "center",
        }}
      >
        <MenuItem onClick={handleTakeScreenshot}>
          <ListItemIcon>
            <PhotoCamera />
          </ListItemIcon>
          <ListItemText>Take Screenshot</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleOpenHelp}>
          <ListItemIcon>
            <Help />
          </ListItemIcon>
          <ListItemText>Help</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
}

function AudioButton() {
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);
  const handlePopOverOpen = (event: any) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };
  const { volume, muted } = useAudioSettings();
  const service = useAudioSettingsService();

  const handleClick = () => {
    service.toggleMuted();
  };
  return (
    <>
      <IconButton onClick={handlePopOverOpen}>{muted ? <VolumeOff /> : <VolumeUp />}</IconButton>
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: "top",
          horizontal: "center",
        }}
        transformOrigin={{
          vertical: "bottom",
          horizontal: "center",
        }}
      >
        <Box width={256}>
          <BaseAudioSettingsPanel
            master={volume.master}
            music={volume.music}
            /* Currently it's disabled */
            effects={0}
            onMutedChange={(x) => service.setMuted(x)}
            onMasterChange={(x) => service.setMasterVolume(x)}
            onMusicChange={(x) => service.setMusicVolume(x)}
            onEffectsChange={(x) => service.setEffectsVolume(x)}
          />
        </Box>
      </Popover>
    </>
  );
}

// Connected
function PlayButton() {
  const { isPlaying, toggleClock } = useGameClockControls();
  const Icon = !isPlaying ? PlayCircle : PauseCircle;

  return (
    <IconButton onClick={toggleClock} onFocus={ignoreFocus}>
      <Icon fontSize={"large"} />
    </IconButton>
  );
}

const defaultHighPrecisionAudioState: HighPrecisionAudioState = {
  status: "UNAVAILABLE",
  reason: "NO_REPLAY",
};

function highPrecisionAudioTooltip(state: HighPrecisionAudioState) {
  switch (state.status) {
    case "AVAILABLE":
      return "Decode the MP3 to a temporary WAV for more accurate seeking. Uses extra memory and may take a moment.";
    case "ACTIVE":
      return state.automatic
        ? "High-precision audio was enabled automatically because this MP3 may seek inaccurately. Select to use the original MP3."
        : "High-precision audio is on. Select to restore the original MP3 and release memory.";
    case "CONVERTING":
      return "Creating temporary WAV audio…";
    case "ERROR":
      return "Unable to create high-precision audio. Select to try again.";
    case "UNAVAILABLE":
      switch (state.reason) {
        case "LOADING":
          return "Audio information is still loading.";
        case "NOT_MP3":
          return "High-precision mode is only needed for MP3 audio.";
        case "TOO_LONG":
          return "Unavailable for tracks over 15 minutes to avoid excessive memory usage.";
        case "NO_REPLAY":
          return "Load a replay to use high-precision audio.";
      }
  }
}

function HighPrecisionAudioButton() {
  const { scenarioManager } = useAnalysisApp();
  const state = useObservable(() => scenarioManager.highPrecisionAudioState$, defaultHighPrecisionAudioState);
  const active = state.status === "ACTIVE";
  const converting = state.status === "CONVERTING";
  const actionable = state.status === "AVAILABLE" || state.status === "ACTIVE" || state.status === "ERROR";
  const statusAnnouncement = converting
    ? "Creating temporary WAV audio."
    : active
    ? state.automatic
      ? "High-precision audio enabled automatically."
      : "High-precision audio enabled."
    : state.status === "ERROR"
    ? "Unable to create high-precision audio."
    : "";

  const handleClick = useCallback(() => {
    if (!actionable) return;
    void scenarioManager.toggleHighPrecisionAudio();
  }, [actionable, scenarioManager]);

  return (
    <Tooltip title={highPrecisionAudioTooltip(state)} placement="top" arrow>
      <Box component="span" sx={{ display: "inline-flex", position: "relative" }}>
        <Button
          size="small"
          variant={active ? "contained" : "outlined"}
          aria-label={active ? "Disable high-precision audio" : "Enable high-precision audio"}
          aria-pressed={active}
          aria-disabled={!actionable}
          onClick={handleClick}
          startIcon={converting ? <CircularProgress size={12} color="inherit" /> : undefined}
          sx={{
            minWidth: 52,
            height: 28,
            px: 1,
            fontSize: 12,
            lineHeight: 1,
            textTransform: "none",
            opacity: actionable ? 1 : 0.45,
            cursor: actionable ? "pointer" : "not-allowed",
            transitionProperty: "background-color, color, border-color, opacity, transform",
            transitionDuration: "120ms",
            "&:active": actionable ? { transform: "scale(0.96)" } : undefined,
          }}
        >
          WAV
        </Button>
        <Box
          component="span"
          role="status"
          aria-live="polite"
          sx={{
            position: "absolute",
            width: 1,
            height: 1,
            p: 0,
            m: -1,
            overflow: "hidden",
            clip: "rect(0 0 0 0)",
            whiteSpace: "nowrap",
            border: 0,
          }}
        >
          {statusAnnouncement}
        </Box>
      </Box>
    </Tooltip>
  );
}

// https://css-tricks.com/using-requestanimationframe-with-react-hooks/
const timeAnimateFPS = 30;

function CurrentTime() {
  const analyzer = useAnalysisApp();
  const requestRef = useRef<number>(0);
  const timeRef = useRef<GameCurrentTimeHandle>(null);

  // const animate = () => {};

  useEffect(() => {
    // requestRef.current = requestAnimationFrame(animate);
    let last = -1;
    const requiredElapsed = 1000 / timeAnimateFPS;

    function animate(currentTimestamp: number) {
      const elapsed = currentTimestamp - last;
      if (elapsed > requiredElapsed) {
        if (timeRef.current) timeRef.current.updateTime(analyzer.gameClock.timeElapsedInMs);
        last = currentTimestamp;
      }
      requestRef.current = requestAnimationFrame(animate);
    }

    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [analyzer]);
  return (
    // We MUST fix the width because the font is not monospace e.g. "111" is thinner than "000"
    // Also if the duration is more than an hour there will also be a slight shift
    <Box sx={{ width: "7em" }}>
      <BaseCurrentTime ref={timeRef} />
    </Box>
  );
}

function groupTimings(events: ReplayAnalysisEvent[], replayClient: ReplayClient | null) {
  const missTimings: number[] = [];
  const mehTimings: number[] = [];
  const okTimings: number[] = [];
  const sliderBreakTimings: number[] = [];

  events.forEach((e) => {
    switch (e.type) {
      case "HitObjectJudgement":
        if (e.isSliderHead && replayClient !== "LAZER") {
          if (e.verdict === "MISS") sliderBreakTimings.push(e.time);
          return;
        } else {
          if (e.verdict === "MISS") missTimings.push(e.time);
          if (e.verdict === "MEH") mehTimings.push(e.time);
          if (e.verdict === "OK") okTimings.push(e.time);
        }
        // if(e.verdict === "GREAT" && show300s) events.push(); // Not sure if this will ever be implemented
        break;
      case "CheckpointJudgement":
        if (!e.hit && !e.isLastTick) sliderBreakTimings.push(e.time);
        break;
      case "UnnecessaryClick":
        // TODO
        break;
    }
  });
  return { missTimings, mehTimings, okTimings, sliderBreakTimings };
}

function GameTimeSlider() {
  // TODO: Depending on if replay is loaded and settings
  const backgroundEnable = true;
  const currentTime = useGameClockTime(15);
  const { seekTo, duration } = useGameClockControls();
  const { gameSimulator } = useAnalysisApp();
  const { playbarSettingsStore } = useCommonManagers();
  const replayEvents = useObservable(() => gameSimulator.replayEvents$, []);
  const replayClient = useObservable(() => gameSimulator.replayClient$, null);
  const difficulties = useObservable(() => gameSimulator.difficulties$, []);
  const playbarSettings = useObservable(() => playbarSettingsStore.settings$, DEFAULT_PLAY_BAR_SETTINGS);

  const events = useMemo(() => {
    const { sliderBreakTimings, missTimings, mehTimings, okTimings } = groupTimings(replayEvents, replayClient);
    return [
      { color: PlaybarColors.MISS, timings: missTimings, tooltip: "Misses" },
      { color: PlaybarColors.SLIDER_BREAK, timings: sliderBreakTimings, tooltip: "Sliderbreaks" },
      { color: PlaybarColors.MEH, timings: mehTimings, tooltip: "50s" },
      { color: PlaybarColors.OK, timings: okTimings, tooltip: "100s" },
    ];
  }, [replayClient, replayEvents]);

  return (
    <BaseGameTimeSlider
      backgroundEnable={backgroundEnable}
      duration={duration}
      currentTime={currentTime}
      onChange={seekTo}
      events={events}
      difficulties={playbarSettings.difficultyGraphEnabled ? difficulties : []}
    />
  );
}

function Duration() {
  const { duration } = useGameClockControls();
  const f = formatGameTime(duration);

  return <Typography>{f}</Typography>;
}

function HiddenButton() {
  const { setHidden, hidden: hiddenEnabled } = useModControls();
  const handleClick = useCallback(() => setHidden(!hiddenEnabled), [hiddenEnabled, setHidden]);

  return (
    <Button onFocus={ignoreFocus} onClick={handleClick} sx={{ px: 0 }}>
      <img
        src={modHiddenImg}
        alt={"ModHidden"}
        style={{ filter: `grayscale(${hiddenEnabled ? "0%" : "100%"})`, width: "60%" }}
      />
    </Button>
  );
}

function SettingsButton() {
  const { onSettingsModalOpenChange } = useSettingsModalContext();
  return (
    <IconButton onClick={() => onSettingsModalOpenChange(true)} onFocus={ignoreFocus}>
      <Settings />
    </IconButton>
  );
}

interface BaseSpeedButtonProps {
  value: number;
  replaySpeed?: number;
  onChange: (value: number) => any;
}

function BaseSpeedButton(props: BaseSpeedButtonProps) {
  const { value, replaySpeed, onChange } = props;

  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);
  const handleClick = (event: MouseEvent<HTMLElement>) => {
    setAnchorEl(open ? null : event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };

  return (
    <>
      <Button
        sx={{
          color: "text.primary",
          textTransform: "none",
          fontSize: "1em",
          fontVariantNumeric: "tabular-nums",
          transitionProperty: "background-color, color, transform",
          transitionDuration: "120ms",
          "&:active": { transform: "scale(0.96)" },
        }}
        size={"small"}
        aria-label="Playback speed"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={handleClick}
        onFocus={ignoreFocus}
      >
        {formatPlaybackSpeed(value)}
      </Button>
      <Popover
        open={open}
        onClose={handleClose}
        anchorEl={anchorEl}
        PaperProps={{ sx: { overflow: "visible" } }}
        anchorOrigin={{
          vertical: "top",
          horizontal: "center",
        }}
        transformOrigin={{
          vertical: "bottom",
          horizontal: "center",
        }}
      >
        <BasePlaybackSpeedPanel value={value} replaySpeed={replaySpeed} onChange={onChange} />
      </Popover>
    </>
  );
}

function SpeedButton() {
  const { speed, replaySpeed, setSpeed } = useGameClockControls();
  return (
    // <Box sx={{ display: "flex", justifyContent: "center" }}>
    <BaseSpeedButton value={speed} replaySpeed={replaySpeed} onChange={setSpeed} />
    // </Box>
  );
}

function RecordButton() {
  // TODO: Probably stop at a certain time otherwise the program might crash due to memory issue
  const { clipRecorder } = useAnalysisApp();
  const recordingSince = useObservable(() => clipRecorder.recordingSince$, 0);

  const isRecording = recordingSince > 0;

  const recordingTime = "3:00";

  const handleClick = useCallback(() => {
    if (isRecording) {
      clipRecorder.stopRecording();
    } else {
      clipRecorder.startRecording();
    }
  }, [isRecording, clipRecorder]);

  return (
    <Tooltip title={"Start recording a clip"}>
      <IconButton onClick={handleClick}>
        <FiberManualRecordIcon
          sx={{
            color: isRecording ? "red" : "text.primary",
          }}
        />
      </IconButton>
    </Tooltip>
  );
}

const VerticalDivider = () => <Divider orientation={"vertical"} sx={{ height: "80%" }} />;

export function PlayBar() {
  return (
    <Stack height={64} gap={1} p={2} direction={"row"} alignItems={"center"}>
      <PlayButton />
      <HighPrecisionAudioButton />
      <CurrentTime />
      <GameTimeSlider />
      <Duration />
      <VerticalDivider />
      <Stack direction={"row"} alignItems={"center"} justifyContent={"center"}>
        <AudioButton />
        <SpeedButton />
        <HiddenButton />
        {/*<RecordButton />*/}
        <SettingsButton />
        <MoreMenu />
      </Stack>
    </Stack>
  );
}
