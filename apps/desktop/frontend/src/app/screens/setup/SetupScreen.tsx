import * as React from "react";
import { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Box, Button, IconButton, InputBase, Paper, Stack } from "@mui/material";
import { RewindLogo } from "../../components/logo/RewindLogo";
import { Help, RocketLaunch } from "@mui/icons-material";
import FolderIcon from "@mui/icons-material/Folder";
import { frontendAPI } from "../../api";
import { useNavigate } from "react-router-dom";
import { useAnalysisApp } from "../../providers/TheaterProvider";

interface DirectorySelectionProps {
  value: string | null;
  onChange: (value: string | null) => void;
  placeHolder: string;
  badgeOnEmpty?: boolean;
}

function DirectorySelection({ value, onChange, placeHolder, badgeOnEmpty }: DirectorySelectionProps) {
  const handleSelectFolderClick = useCallback(() => {
    frontendAPI.selectDirectory(value ?? "").then((path) => {
      if (path !== null) {
        onChange(path);
      }
    });
  }, [onChange, value]);

  const onInputChange = useCallback(
    (event: any) => {
      onChange(event.target.value);
    },
    [onChange],
  );

  const invisibleBadge = !badgeOnEmpty || !!value;
  return (
    <Paper sx={{ px: 2, py: 1, display: "flex", alignItems: "center", width: 400 }} elevation={2}>
      {/*<span className={"text-gray-400 select-none w-96"}>{value ?? placeHolder}</span>*/}
      <InputBase
        sx={{ flex: 1 }}
        placeholder={placeHolder}
        value={value ?? ""}
        onChange={onInputChange}
        disabled={true}
      />
      <IconButton onClick={handleSelectFolderClick}>
        <Badge invisible={invisibleBadge} color={"primary"} variant={"dot"}>
          <FolderIcon />
        </Badge>
      </IconButton>
    </Paper>
  );
}

const setupWikiUrl = "https://github.com/abstrakt8/rewind/wiki/Setup";

// TODO: Maybe tell which file is actually missing
export function SetupScreen() {
  const analyzer = useAnalysisApp();
  const [stablePath, setStablePath] = useState<string | null>(analyzer.osuFolderService.getOsuFolder() || null);
  const [lazerPath, setLazerPath] = useState<string | null>(analyzer.osuFolderService.getLazerFolder() || null);
  const [saveEnabled, setSaveEnabled] = useState(false);
  const navigate = useNavigate();
  // const [updateOsuDirectory, updateState] = useUpdateOsuDirectoryMutation();
  const [showErrorMessage, setShowErrorMessage] = useState(false);

  const handleConfirmClick = useCallback(async () => {
    const stableValid = !stablePath || (await analyzer.osuFolderService.isValidOsuFolder(stablePath));
    const lazerValid = !lazerPath || (await analyzer.osuFolderService.isValidLazerFolder(lazerPath));
    if ((stablePath || lazerPath) && stableValid && lazerValid) {
      analyzer.osuFolderService.setOsuFolder(stablePath ?? "");
      analyzer.osuFolderService.setLazerFolder(lazerPath ?? "");
      navigate("/app/analyzer");
    } else {
      setShowErrorMessage(true);
    }
  }, [navigate, analyzer.osuFolderService, stablePath, lazerPath]);

  const handleStablePathChange = useCallback((path: string | null) => {
    setStablePath(path);
    setShowErrorMessage(false);
  }, []);

  const handleLazerPathChange = useCallback((path: string | null) => {
    setLazerPath(path);
    setShowErrorMessage(false);
  }, []);

  // Makes sure that the button is only clickable when it's allowed.
  useEffect(() => {
    setSaveEnabled(!!stablePath || !!lazerPath);
  }, [stablePath, lazerPath]);

  return (
    <Box
      sx={{
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Paper elevation={1}>
        <Stack gap={2} sx={{ px: 6, py: 4 }}>
          <RewindLogo />
          {showErrorMessage && (
            <>
              <Alert severity="error" variant="filled">
                <div>Please select a valid osu!stable or osu!lazer data directory.</div>
              </Alert>
            </>
          )}
          <DirectorySelection
            value={stablePath}
            onChange={handleStablePathChange}
            placeHolder={"Select osu!stable directory (optional)"}
            badgeOnEmpty={!lazerPath}
          />
          <DirectorySelection
            value={lazerPath}
            onChange={handleLazerPathChange}
            placeHolder={"Select osu!lazer data directory (optional)"}
            badgeOnEmpty={!stablePath}
          />
          <Stack direction={"row-reverse"} gap={2}>
            <Button
              variant={"contained"}
              startIcon={<RocketLaunch />}
              disabled={!saveEnabled}
              onClick={handleConfirmClick}
            >
              Save & Continue
            </Button>
            <Button variant={"text"} onClick={() => window.open(setupWikiUrl)} startIcon={<Help />}>
              Help
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
}
