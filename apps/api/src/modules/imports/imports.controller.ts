import { Body, Controller, Inject, Param, Patch, Post, UseGuards } from "@nestjs/common";
import type {
  ImportCacheRequest,
  ImportCacheResponse,
  ImportItemsUpdateRequest,
  ImportItemsUpdateResponse,
  ImportPreviewRequest,
  ImportPreviewResponse
} from "@ai-music-playlist/api-contract";

import type { AlphaAccessTokenPayload } from "../auth/alpha-auth";
import { AlphaAuthGuard } from "../auth/alpha-auth.guard";
import { CurrentAlphaUser } from "../auth/current-alpha-user.decorator";
import { ContentsService } from "../contents/contents.service";

@Controller("imports")
@UseGuards(AlphaAuthGuard)
export class ImportsController {
  constructor(@Inject(ContentsService) private readonly contentsService: ContentsService) {
    this.preview = this.preview.bind(this);
    this.updateItems = this.updateItems.bind(this);
    this.cacheItems = this.cacheItems.bind(this);
  }

  @Post("preview")
  preview(
    @CurrentAlphaUser() user: AlphaAccessTokenPayload,
    @Body() body: ImportPreviewRequest,
  ): Promise<ImportPreviewResponse> {
    return this.contentsService.previewImportForUser(user.userId, body);
  }

  @Patch(":collectionId/items")
  updateItems(
    @CurrentAlphaUser() user: AlphaAccessTokenPayload,
    @Param("collectionId") collectionId: string,
    @Body() body: ImportItemsUpdateRequest,
  ): Promise<ImportItemsUpdateResponse> {
    return this.contentsService.updateImportItemsForUser(user.userId, collectionId, body);
  }

  @Post(":collectionId/cache")
  cacheItems(
    @CurrentAlphaUser() user: AlphaAccessTokenPayload,
    @Param("collectionId") collectionId: string,
    @Body() body: ImportCacheRequest,
  ): Promise<ImportCacheResponse> {
    return this.contentsService.cacheImportItemsForUser(user.userId, collectionId, body);
  }
}
