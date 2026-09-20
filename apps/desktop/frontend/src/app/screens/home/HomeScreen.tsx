import React from "react";
import { FaDiscord, FaTwitter, FaYoutube } from "react-icons/fa";
import { IconButton, Link, Stack, Typography } from "@mui/material";
import { FastRewind } from "@mui/icons-material";
import { useAppInfo } from "../../hooks/app-info";
import { discordUrl, RewindLinks, twitterUrl, youtubeUrl } from "../../utils/constants";

// This page is actually just a placeholder for an overview page that can show things such as "Recently Played", etc.

export function HomeScreen() {
  const { appVersion } = useAppInfo();
  return (
    <Stack gap={4} sx={{ justifyContent: "center", alignItems: "center", margin: "auto", height: "100%" }}>
      <Stack alignItems={"center"}>
        <FastRewind sx={{ height: "2em", width: "2em" }} />
        <Typography fontSize={"1em"} sx={{ userSelect: "none", marginBottom: 2 }}>
          REWIND LAZER
        </Typography>
        <Typography fontSize={"caption.fontSize"} color={"text.secondary"}>
          Rewind Lazer {appVersion}, forked by{" "}
          <Link href={RewindLinks.OsuPpyShAloic} target={"_blank"} color={"text.secondary"}>
            Aloic
          </Link>
        </Typography>
        <Typography fontSize={"caption.fontSize"} color={"text.secondary"}>
          Based on Rewind by{" "}
          <Link href={RewindLinks.OsuPpyShAbstrakt} target={"_blank"} color={"text.secondary"}>
            abstrakt
          </Link>
        </Typography>
        <Typography fontSize={"caption.fontSize"} color={"text.secondary"}>
          osu! University
          <IconButton href={discordUrl} target={"_blank"} size={"small"}>
            <FaDiscord />
          </IconButton>
          <IconButton href={twitterUrl} target={"_blank"} size={"small"}>
            <FaTwitter />
          </IconButton>
          <IconButton href={youtubeUrl} target={"_blank"} size={"small"}>
            <FaYoutube />
          </IconButton>
        </Typography>
      </Stack>
    </Stack>
  );
}
