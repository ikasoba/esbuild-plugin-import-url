import { Plugin } from "esbuild";
import fetch from "node-fetch";
import fs from "fs/promises";
import path from "path";

const urlRegexp =
  /^https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/=]*)$/;

export const ImportURLPlugin = (
  cacheDir: string,
  cacheDuration = 1000 * 60 * 60 * 24 * 3
): Plugin => {
  let self: Plugin;
  return (self = {
    name: "ImportURLPlugin",
    setup(build) {
      build.onResolve({ filter: urlRegexp }, async (args) => {
        const url = new URL(args.path);
        const encodedUrl = Buffer.from(url.toString()).toString("base64url");

        let isCacheExpired = true;

        const list = await fs.readdir(cacheDir).catch(async () => {
          await fs.mkdir(cacheDir);
          return [] as const;
        });

        for (const filename of list) {
          if (filename != encodedUrl) continue;

          const mtime =
            (
              await fs.stat(path.join(cacheDir, filename)).catch(() => null)
            )?.mtime?.getTime() ?? 0;

          if (Date.now() - mtime < cacheDuration) {
            isCacheExpired = false;
            break;
          } else {
            break;
          }
        }

        if (isCacheExpired) {
          let res = await fetch(url).then((x) => x.text());
          fs.writeFile(path.join(cacheDir, encodedUrl), res, "utf-8");

          await build.esbuild.build({
            ...build.initialOptions,
            entryPoints: [path.join(cacheDir, encodedUrl)],
            outfile: path.join(cacheDir, encodedUrl),
            bundle: true,
            allowOverwrite: true,
            minify: true,
            plugins: [self],
          });
        }

        return {
          path: path.resolve(path.join(cacheDir, encodedUrl)),
        };
      });
    },
  });
};
