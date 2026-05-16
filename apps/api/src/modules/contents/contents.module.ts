import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { ContentsController } from "./contents.controller";
import { ContentsService } from "./contents.service";
import { LocalAudioController } from "./local-audio.controller";
import { LocalAudioCleanupService } from "./local-audio-cleanup.service";
import { LocalAudioConversionService } from "./local-audio-conversion.service";
import { FileHashService } from "./local-audio-file-hash.service";
import { LocalAudioJobRunnerService } from "./local-audio-job-runner.service";
import { LocalAudioPathService } from "./local-audio-path.service";
import { LocalAudioService } from "./local-audio.service";
import { LocalAudioStagingStorageService } from "./local-audio-staging-storage.service";
import { LocalAudioTempStorageService } from "./local-audio-temp-storage.service";
import {
  FfmpegAudioConverter,
  LocalAudioWorkerService,
  YtDlpSourceMediaDownloader
} from "./local-audio-worker.service";

@Module({
  imports: [AuthModule],
  controllers: [ContentsController, LocalAudioController],
  providers: [
    ContentsService,
    LocalAudioConversionService,
    LocalAudioPathService,
    LocalAudioStagingStorageService,
    LocalAudioTempStorageService,
    FileHashService,
    YtDlpSourceMediaDownloader,
    FfmpegAudioConverter,
    {
      provide: "SourceMediaDownloader",
      useExisting: YtDlpSourceMediaDownloader
    },
    {
      provide: "AudioConverter",
      useExisting: FfmpegAudioConverter
    },
    LocalAudioWorkerService,
    LocalAudioJobRunnerService,
    LocalAudioCleanupService,
    LocalAudioService
  ],
  exports: [ContentsService]
})
export class ContentsModule {}
