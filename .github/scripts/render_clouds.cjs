/* Optional asset authoring tool. Requires Playwright and a local Chromium.
   The site serves the exported PNG directly; this is not part of page startup. */
const { chromium } = require("playwright");
const { readFile, writeFile } = require("node:fs/promises");
const path = require("node:path");
const root = path.resolve(__dirname, "../..");
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CASTLE_BROWSER || undefined,
    args: ["--no-sandbox"],
  });
  try {
    const page = await browser.newPage();
    const source = await readFile(
      path.join(root, ".github/design/dark-castle-layers/clouds-hatched.png"),
    );
    await page.setContent(
      `<div class="layer-clouds"><img class="cloud-source" src="data:image/png;base64,${source.toString("base64")}"><canvas class="cloud-bank" width="3072" height="1024" hidden></canvas></div>`,
    );
    await page.evaluate(async () => {
      const layer = document.querySelector(".layer-clouds");
      const source = layer?.querySelector(".cloud-source");
      const bank = layer?.querySelector(".cloud-bank");
      if (!source || !bank) return;
      const makeCanvas = (width, height) => {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        return canvas;
      };
      await source
        .decode()
        .then(() => {
          const context = bank.getContext("2d");
          if (!context) return;
          const width = 800;
          const height = 512;
          const overlap = 32;
          const period = width - overlap;
          const texture = makeCanvas(width, height);
          const drawing = texture.getContext("2d", {
            willReadFrequently: true,
          });
          if (!drawing) return;
          drawing.drawImage(source, 0, 0, width, height);
          const pixels = drawing.getImageData(0, 0, width, height).data;

          // Locate the source bank's upper edge and smooth away individual dots.
          // Flattening that edge lets one continuous curve control the final shape.
          const edges = Array.from({ length: width }, (_, x) => {
            let sum = 0;
            for (let y = 0; y < height; y++) {
              sum += pixels[(y * width + x) * 4 + 3];
              if (y >= 20) sum -= pixels[((y - 20) * width + x) * 4 + 3];
              if (y >= 20 && sum / (20 * 255) > 0.18) return y - 10;
            }
            return 180;
          });
          const flat = makeCanvas(width, 768);
          const flatContext = flat.getContext("2d");
          if (!flatContext) return;
          for (let x = 0; x < width; x++) {
            let edge = 0;
            for (let n = -32; n <= 32; n++)
              edge += edges[Math.max(0, Math.min(width - 1, x + n))];
            edge /= 65;
            flatContext.drawImage(
              texture,
              x,
              0,
              1,
              height,
              x,
              128 - edge,
              1,
              height,
            );
          }

          // Crossfade a narrow end section into the start so both color and alpha
          // repeat continuously. This joins texture, never two different cloud heights.
          const tile = makeCanvas(period, flat.height);
          const tileContext = tile.getContext("2d");
          if (!tileContext) return;
          tileContext.globalCompositeOperation = "lighter";
          for (let x = 0; x < period; x++) {
            const weight = Math.min(1, x / overlap);
            tileContext.globalAlpha = weight;
            tileContext.drawImage(
              flat,
              x,
              0,
              1,
              flat.height,
              x,
              0,
              1,
              flat.height,
            );
            if (weight < 1) {
              tileContext.globalAlpha = 1 - weight;
              tileContext.drawImage(
                flat,
                period + x,
                0,
                1,
                flat.height,
                x,
                0,
                1,
                flat.height,
              );
            }
          }

          // One smooth, periodic outline: high at the tree and castle, low centrally.
          const contour = [
            [0, 155],
            [0.09, 150],
            [0.28, 260],
            [0.44, 350],
            [0.58, 355],
            [0.72, 250],
            [0.84, 155],
            [1, 155],
          ];
          const sceneWidth = bank.width / 2;
          for (let x = 0; x < sceneWidth; x++) {
            const t = x / sceneWidth;
            const index = contour.findIndex(
              (point, i) => i > 0 && t <= point[0],
            );
            const [x0, y0] = contour[index - 1];
            const [x1, y1] = contour[index];
            const progress =
              (1 - Math.cos((Math.PI * (t - x0)) / (x1 - x0))) / 2;
            const top = y0 + (y1 - y0) * progress;
            context.drawImage(
              tile,
              x % period,
              0,
              1,
              tile.height,
              x,
              top - 128,
              1,
              tile.height,
            );
          }
          context.drawImage(
            bank,
            0,
            0,
            sceneWidth,
            bank.height,
            sceneWidth,
            0,
            sceneWidth,
            bank.height,
          );
          bank.hidden = false;
          layer.dataset.ready = "";
        })
        .catch(() => {
          /* Leave the static cloud image available if decoding fails. */
        });
    });
    const image = await page.locator(".cloud-bank").evaluate((canvas) => {
      if (canvas.hidden) throw new Error("Cloud rendering did not complete");
      return canvas.toDataURL("image/png").split(",")[1];
    });
    const destination = path.join(
      root,
      "assets/darkcastle/layers/clouds-continuous.png",
    );
    await writeFile(destination, Buffer.from(image, "base64"));
    console.log("Rendered assets/darkcastle/layers/clouds-continuous.png");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
