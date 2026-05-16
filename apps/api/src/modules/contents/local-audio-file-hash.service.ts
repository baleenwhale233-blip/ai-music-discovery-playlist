import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";

@Injectable()
export class FileHashService {
  sha256File(filePath: string) {
    return new Promise<string>((resolve, reject) => {
      const hash = createHash("sha256");
      const stream = createReadStream(filePath);

      stream.on("data", (chunk) => hash.update(chunk));
      stream.on("error", reject);
      stream.on("end", () => resolve(hash.digest("hex")));
    });
  }
}
