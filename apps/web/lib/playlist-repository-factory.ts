import { createHttpPlaylistRepository } from "./http-playlist-repository";
import { createLocalPlaylistRepository, type LocalPlaylistRepositoryOptions } from "./local-playlist-repository";
import type { PlaylistDataSource } from "./playlist-domain";
import type { PlaylistRepository } from "./playlist-repository";

interface PlaylistRepositoryFactoryOptions extends LocalPlaylistRepositoryOptions {
  dataSource?: PlaylistDataSource;
}

export function createPlaylistRepository(
  options: PlaylistRepositoryFactoryOptions = {},
): PlaylistRepository {
  const configuredSource = options.dataSource ?? getConfiguredDataSource();

  if (configuredSource === "http") {
    return createHttpPlaylistRepository();
  }

  return createLocalPlaylistRepository(options);
}

function getConfiguredDataSource(): PlaylistDataSource {
  return process.env.NEXT_PUBLIC_PLAYLIST_DATA_SOURCE === "http" ? "http" : "local";
}
