import test from "node:test";
import assert from "node:assert/strict";
import { sniffImage } from "../middleware/upload.js";

/**
 * The byte-signature check is the only upload defence that an attacker
 * cannot simply lie their way past, so it is tested directly.
 */
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const WEBP = Buffer.concat([
  Buffer.from("RIFF"),
  Buffer.from([0x24, 0x00, 0x00, 0x00]),
  Buffer.from("WEBP"),
]);

test("real image headers are recognised", () => {
  assert.equal(sniffImage(JPEG).mime, "image/jpeg");
  assert.equal(sniffImage(PNG).mime, "image/png");
  assert.equal(sniffImage(WEBP).mime, "image/webp");
});

test("a script renamed to .jpg is rejected", () => {
  const php = Buffer.from('<?php system($_GET["c"]); ?>');
  assert.equal(sniffImage(php), null);
});

test("an HTML payload is rejected", () => {
  assert.equal(sniffImage(Buffer.from("<html><script>alert(1)</script>")), null);
});

test("an SVG is rejected - it can carry script", () => {
  assert.equal(sniffImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>')), null);
});

test("a truncated or empty buffer is rejected rather than crashing", () => {
  assert.equal(sniffImage(Buffer.alloc(0)), null);
  assert.equal(sniffImage(Buffer.from([0xff])), null);
  assert.equal(sniffImage(Buffer.from("RIFF")), null);
});

test("a RIFF container that is not WebP is rejected", () => {
  const wav = Buffer.concat([Buffer.from("RIFF"), Buffer.from([0, 0, 0, 0]), Buffer.from("WAVE")]);
  assert.equal(sniffImage(wav), null);
});
